import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

import type { OpenAIInvocationPayload } from "../../integrations/openai/api/index.js";
import {
  createOpenAIClient,
  loadOpenAILiveConfig,
  prepareResponsesParamsForOpenAIAuth,
  resolveProviderGenerationVariant,
  resolveOpenAIGenerationVariant,
} from "../../rax/live-config.js";
import type { ProviderId, SdkLayer } from "../../rax/index.js";
import { rax } from "../../rax/index.js";
import { isRaxcodeRoleId, loadResolvedRoleConfig, type RaxcodeRoleId } from "../../raxcode-config.js";
import { refreshOpenAIOAuthIfNeeded } from "../../raxcode-openai-auth.js";
import type { ModelInferenceIntent, KernelResult } from "../types/index.js";
import type { RaxFacade as FullRaxFacade } from "../../rax/facade.js";
import {
  buildChatCompletionMessagesFromPromptParts,
  buildResponsesInputFromPromptParts,
  readPromptMessagesMetadata,
  type PromptMessagePart,
} from "./prompt-message-parts.js";
import { resolveFastServiceTierSupportFromCache } from "../tui-input/model-catalog.js";
import { resolveAppRoot } from "../../runtime-paths.js";
import { mapAnthropicReasoningEffortToThinking } from "../../integrations/anthropic/api/shared.js";
import {
  resolveProviderRouteKind,
  sanitizeProviderRouteFeatureOptions,
} from "./model-route-features.js";

type GenerateFacade = Pick<FullRaxFacade, "generate">;

export interface ModelInferenceExecutionParams {
  intent: ModelInferenceIntent;
  facade?: GenerateFacade;
}

export interface ModelInferenceExecutionResult {
  result: KernelResult;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  raw: unknown;
}

type OpenAIModelInvocation = {
  payload: OpenAIInvocationPayload<Record<string, unknown>>;
};

type AnthropicModelInvocation = {
  adapterId: string;
  payload: Record<string, unknown>;
};

type DeepMindModelInvocation = {
  payload: {
    method: string;
    params: Record<string, unknown>;
  };
};

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const headers = "headers" in error ? (error as { headers?: unknown }).headers : undefined;
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const retryAfter = "retry-after" in headers
    ? (headers as Record<string, unknown>)["retry-after"]
    : "Retry-After" in headers
      ? (headers as Record<string, unknown>)["Retry-After"]
      : undefined;

  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
    return Math.max(0, retryAfter * 1000);
  }

  if (typeof retryAfter === "string") {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }
  }

  return undefined;
}

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function readPositiveIntegerMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function buildOpenAIProviderMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const allowedKeys = [
    "provider",
    "model",
    "layer",
    "variant",
    "compatibilityProfileId",
    "cmpRole",
    "cmpLiveMode",
    "tapWorkerKind",
    "tapWorkerModel",
  ] as const;

  const normalized = Object.fromEntries(
    allowedKeys.flatMap((key) => {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) {
        return [[key, value]];
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return [[key, String(value)]];
      }
      return [];
    }),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function readTextFromUnknownRecord(record: Record<string, unknown>): string | undefined {
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    for (const item of record.output) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const outputRecord = item as Record<string, unknown>;
      if (!Array.isArray(outputRecord.content)) {
        continue;
      }
      for (const contentItem of outputRecord.content) {
        if (!contentItem || typeof contentItem !== "object") {
          continue;
        }
        const contentRecord = contentItem as Record<string, unknown>;
        if (typeof contentRecord.text === "string" && contentRecord.text.trim()) {
          return contentRecord.text;
        }
        if (
          contentRecord.text &&
          typeof contentRecord.text === "object" &&
          "value" in contentRecord.text &&
          typeof (contentRecord.text as { value?: unknown }).value === "string" &&
          (contentRecord.text as { value: string }).value.trim()
        ) {
          return (contentRecord.text as { value: string }).value;
        }
      }
    }
  }

  if (Array.isArray(record.choices)) {
    const firstChoice = record.choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const choiceRecord = firstChoice as Record<string, unknown>;
      if (typeof choiceRecord.text === "string" && choiceRecord.text.trim()) {
        return choiceRecord.text;
      }
      if (choiceRecord.message && typeof choiceRecord.message === "object") {
        const message = choiceRecord.message as { content?: string | Array<{ type?: string; text?: string }> };
        const content = message.content;
        if (typeof content === "string" && content.trim()) {
          return content;
        }
        if (Array.isArray(content)) {
          const textPart = content.find((item) => item?.type === "text" && typeof item.text === "string" && item.text.trim());
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    }
  }

  return undefined;
}

function readRoleIdMetadata(
  metadata: Record<string, unknown> | undefined,
): RaxcodeRoleId | undefined {
  const value = metadata?.roleId;
  return typeof value === "string" && isRaxcodeRoleId(value)
    ? value
    : undefined;
}

function readStringArrayMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = metadata?.[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return normalized.length > 0 ? normalized : undefined;
}

function parseDataImageUrl(imageUrl: string): { mediaType: string; data: string } | null {
  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/u);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    mediaType: match[1],
    data: match[2],
  };
}

function buildAnthropicSystemAndMessagesFromPromptParts(input: {
  instructionText: string;
  promptMessages?: PromptMessagePart[];
  inputImageUrls?: string[];
}): { system?: string; messages: Array<{ role: "user"; content: string | Array<Record<string, unknown>> }> } {
  const systemParts: string[] = [];
  const messages: Array<{ role: "user"; content: string | Array<Record<string, unknown>> }> = [];
  const promptMessages = input.promptMessages ?? [];

  if (promptMessages.length === 0) {
    messages.push({
      role: "user",
      content: input.instructionText,
    });
  } else {
    for (const message of promptMessages) {
      if (message.role === "system" || message.role === "developer") {
        systemParts.push(message.content);
        continue;
      }
      messages.push({
        role: "user",
        content: message.content,
      });
    }
  }

  const imageParts = (input.inputImageUrls ?? [])
    .map(parseDataImageUrl)
    .filter((entry): entry is { mediaType: string; data: string } => entry !== null)
    .map((entry) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: entry.mediaType,
        data: entry.data,
      },
    }));

  if (imageParts.length > 0) {
    const lastUserIndex = messages.length > 0 ? messages.length - 1 : -1;
    if (lastUserIndex === -1) {
      messages.push({
        role: "user",
        content: imageParts,
      });
    } else {
      const lastUser = messages[lastUserIndex]!;
      const currentContent = typeof lastUser.content === "string"
        ? [{ type: "text", text: lastUser.content }]
        : lastUser.content;
      messages[lastUserIndex] = {
        role: "user",
        content: [
          ...currentContent,
          ...imageParts,
        ],
      };
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages,
  };
}

function buildDeepMindContentsFromPromptParts(input: {
  instructionText: string;
  promptMessages?: PromptMessagePart[];
  inputImageUrls?: string[];
}): string {
  if (!input.promptMessages?.length && !input.inputImageUrls?.length) {
    return input.instructionText;
  }
  const parts: string[] = [];
  for (const message of input.promptMessages ?? []) {
    parts.push(`${message.role.toUpperCase()}: ${message.content}`);
  }
  if (input.inputImageUrls?.length) {
    parts.push(`USER_IMAGES: ${input.inputImageUrls.length} attached image(s)`);
  }
  if (!parts.some((entry) => entry.includes("USER:")) && input.instructionText.trim()) {
    parts.push(`USER: ${input.instructionText}`);
  }
  return parts.join("\n\n").trim();
}

function isOpenAIResponseEnvelope(record: Record<string, unknown>): boolean {
  return typeof record.object === "string"
    && ("usage" in record || "output" in record || "choices" in record);
}

export function isOpenAITextResponseEmpty(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const record = raw as Record<string, unknown>;
  if (!isOpenAIResponseEnvelope(record)) {
    return false;
  }

  return readTextFromUnknownRecord(record) === undefined;
}

export async function collectOpenAIResponsesStreamText(stream: AsyncIterable<unknown>): Promise<Record<string, unknown>> {
  let text = "";
  let completedResponse: Record<string, unknown> | undefined;

  for await (const event of stream) {
    if (!event || typeof event !== "object") {
      continue;
    }
    const record = event as Record<string, unknown>;
    if (record.type === "response.output_text.delta" && typeof record.delta === "string") {
      text += record.delta;
      continue;
    }
    if (record.type === "response.output_text.done" && typeof record.text === "string") {
      text = record.text;
      continue;
    }
    if (record.type === "response.completed" && record.response && typeof record.response === "object") {
      completedResponse = record.response as Record<string, unknown>;
    }
  }

  return {
    ...(completedResponse ?? {}),
    output_text: text,
    output: text
      ? [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text,
              },
            ],
          },
        ]
      : (completedResponse?.output as unknown[] | undefined) ?? [],
  };
}

function parseAnthropicTextResponse(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return JSON.stringify(raw);
  }
  const record = raw as Record<string, unknown>;
  const content = Array.isArray(record.content) ? record.content : [];
  const textParts = content.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const typed = item as Record<string, unknown>;
    return typed.type === "text" && typeof typed.text === "string" && typed.text.trim()
      ? [typed.text]
      : [];
  });
  return textParts.join("\n").trim() || JSON.stringify(raw);
}

function parseDeepMindTextResponse(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return JSON.stringify(raw);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text;
  }
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const content = (candidate as Record<string, unknown>).content;
    const parts = content && typeof content === "object" && Array.isArray((content as { parts?: unknown[] }).parts)
      ? (content as { parts: unknown[] }).parts
      : [];
    const text = parts
      .flatMap((part) => {
        if (!part || typeof part !== "object") {
          return [];
        }
        const typed = part as Record<string, unknown>;
        return typeof typed.text === "string" && typed.text.trim() ? [typed.text] : [];
      })
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }
  return JSON.stringify(raw);
}

export async function collectOpenAIChatCompletionsStreamText(stream: AsyncIterable<unknown>): Promise<Record<string, unknown>> {
  let text = "";
  let lastChunk: Record<string, unknown> | undefined;

  for await (const event of stream) {
    if (!event || typeof event !== "object") {
      continue;
    }
    lastChunk = event as Record<string, unknown>;
    const choices = Array.isArray(lastChunk.choices) ? lastChunk.choices : [];
    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== "object") {
      continue;
    }
    const delta = (firstChoice as Record<string, unknown>).delta;
    if (!delta || typeof delta !== "object") {
      continue;
    }
    const content = (delta as Record<string, unknown>).content;
    if (typeof content === "string") {
      text += content;
    }
  }

  return {
    id: lastChunk?.id,
    object: "chat.completion",
    model: lastChunk?.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: "stop",
      },
    ],
  };
}

export function parseOpenAITextResponse(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return parseOpenAITextResponse(JSON.parse(raw));
    } catch {
      return raw;
    }
  }

  if (raw && typeof raw === "object") {
    const text = readTextFromUnknownRecord(raw as Record<string, unknown>);
    if (typeof text === "string") {
      return text;
    }
  }

  return JSON.stringify(raw);
}

export function omitResponsesMetadataForGatewayRetry<T extends Record<string, unknown>>(params: T): T {
  if (!("metadata" in params)) {
    return params;
  }

  const cloned = {
    ...params,
  };
  delete cloned.metadata;
  return cloned as T;
}

export function shouldRetryOpenAIResponsesWithoutMetadata(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (input.invocation.payload.params.metadata === undefined) {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 502 || status === 403;
}

export function shouldRetryOpenAIResponsesOnRateLimit(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 429;
}

export function shouldRetryOpenAIResponsesOnTransientGateway(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 503;
}

async function executeOpenAIInvocation(
  invocation: OpenAIModelInvocation,
  roleId?: RaxcodeRoleId,
): Promise<unknown> {
  await refreshOpenAIOAuthIfNeeded();
  const config = loadOpenAILiveConfig(roleId);
  const client = createOpenAIClient(config);

  switch (invocation.payload.surface) {
    case "responses":
      {
        let params = prepareResponsesParamsForOpenAIAuth(
          config,
          invocation.payload.params as Record<string, unknown>,
          typeof (invocation.payload.params as Record<string, unknown>).instructions === "string"
            ? (invocation.payload.params as Record<string, unknown>).instructions as string
            : undefined,
        );
        let metadataStripped = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            const response = await client.responses.create(params as never);
            if (isAsyncIterable(response)) {
              return collectOpenAIResponsesStreamText(response);
            }
            if (!isOpenAITextResponseEmpty(response)) {
              return response;
            }

            const streamed = await client.responses.create({
              ...params,
              stream: true,
            } as never);
            if (isAsyncIterable(streamed)) {
              return collectOpenAIResponsesStreamText(streamed);
            }
            return response;
          } catch (error) {
            if (
              !metadataStripped
              && shouldRetryOpenAIResponsesWithoutMetadata({
                invocation: {
                  payload: {
                    ...invocation.payload,
                    params,
                  },
                },
                error,
              })
            ) {
              params = omitResponsesMetadataForGatewayRetry(params);
              metadataStripped = true;
              continue;
            }

            if (attempt < 4) {
              const retryInvocation = {
                payload: {
                  ...invocation.payload,
                  params,
                },
              };

              if (
                shouldRetryOpenAIResponsesOnRateLimit({
                  invocation: retryInvocation,
                  error,
                })
                || shouldRetryOpenAIResponsesOnTransientGateway({
                  invocation: retryInvocation,
                  error,
                })
              ) {
                await sleep(readRetryAfterMs(error) ?? 2500 * (attempt + 1));
                continue;
              }
            }

            throw error;
          }
        }
        throw new Error("OpenAI responses invocation exhausted retry policy unexpectedly.");
      }
    case "chat_completions":
      {
        const response = await client.chat.completions.create(invocation.payload.params as never);
        if (!isOpenAITextResponseEmpty(response)) {
          return response;
        }
        const streamed = await client.chat.completions.create({
          ...invocation.payload.params,
          stream: true,
        } as never);
        if (isAsyncIterable(streamed)) {
          return collectOpenAIChatCompletionsStreamText(streamed);
        }
        return response;
      }
    default:
      throw new Error(`Unsupported OpenAI generation surface for model inference: ${invocation.payload.surface}`);
  }
}

async function executeAnthropicInvocation(
  invocation: AnthropicModelInvocation,
  roleId?: RaxcodeRoleId,
): Promise<unknown> {
  const config = roleId
    ? (() => {
        const resolved = loadResolvedRoleConfig(roleId);
        if (resolved.profile.provider !== "anthropic") {
          throw new Error(`Role ${roleId} is configured for provider ${resolved.profile.provider}, not anthropic.`);
        }
        return {
          apiKey: resolved.authProfile.credentials.apiKey ?? "",
          baseURL: resolved.profile.route.baseURL,
          model: resolved.profile.model,
          reasoningEffort: resolved.profile.reasoningEffort,
        };
      })()
    : (() => {
        const resolved = loadResolvedRoleConfig("core.main");
        if (resolved.profile.provider === "anthropic") {
          return {
            apiKey: resolved.authProfile.credentials.apiKey ?? "",
            baseURL: resolved.profile.route.baseURL,
            model: resolved.profile.model,
            reasoningEffort: resolved.profile.reasoningEffort,
          };
        }
        throw new Error("Anthropic invocation requires an anthropic-configured role.");
      })();

  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return client.messages.create(invocation.payload as never);
}

async function executeDeepMindInvocation(
  invocation: DeepMindModelInvocation,
  roleId?: RaxcodeRoleId,
): Promise<unknown> {
  const resolved = roleId ? loadResolvedRoleConfig(roleId) : loadResolvedRoleConfig("core.main");
  if (resolved.profile.provider !== "deepmind") {
    throw new Error(`Role ${roleId ?? "core.main"} is configured for provider ${resolved.profile.provider}, not deepmind.`);
  }
  const client = new GoogleGenAI({
    apiKey: resolved.authProfile.credentials.apiKey ?? "",
    httpOptions: {
      baseUrl: resolved.profile.route.baseURL,
    },
  });
  switch (invocation.payload.method) {
    case "ai.models.generateContent":
      return client.models.generateContent(invocation.payload.params as never);
    case "ai.models.generateContentStream":
      return client.models.generateContentStream(invocation.payload.params as never);
    default:
      throw new Error(`Unsupported DeepMind generation method for model inference: ${invocation.payload.method}`);
  }
}

export async function executeModelInference(
  params: ModelInferenceExecutionParams,
): Promise<ModelInferenceExecutionResult> {
  const facade = params.facade ?? (rax as unknown as GenerateFacade);
  const metadata = params.intent.frame.metadata;
  const roleId = readRoleIdMetadata(metadata);
  const resolvedRole = roleId ? loadResolvedRoleConfig(roleId) : undefined;
  const provider = (readStringMetadata(metadata, "provider") as ProviderId | undefined)
    ?? resolvedRole?.profile.provider
    ?? "openai";
  const layer = (readStringMetadata(metadata, "layer") as SdkLayer | undefined) ?? "api";
  const roleApiStyle = resolvedRole?.profile.route.apiStyle;
  const roleBaseURL = resolvedRole?.profile.route.baseURL ?? "";
  const variant = readStringMetadata(metadata, "variant")
    ?? resolveProviderGenerationVariant({
      provider,
      baseURL: roleBaseURL,
      apiStyle: roleApiStyle,
    });
  const routeKind = resolveProviderRouteKind({
    provider,
    baseURL: roleBaseURL,
    apiStyle: roleApiStyle,
    variant,
  });
  const compatibilityProfileId = readStringMetadata(metadata, "compatibilityProfileId");
  const maxOutputTokens = readPositiveIntegerMetadata(metadata, "maxOutputTokens");
  const sanitized = sanitizeProviderRouteFeatureOptions(routeKind, {
    reasoningEffort: readStringMetadata(metadata, "reasoningEffort") as string | undefined,
    serviceTier: readStringMetadata(metadata, "serviceTier") as "fast" | undefined,
  });
  const reasoningEffort = sanitized.reasoningEffort;
  const requestedServiceTier = sanitized.serviceTier;
  const inputImageUrls = readStringArrayMetadata(metadata, "inputImageUrls");
  const promptMessages = readPromptMessagesMetadata(metadata?.promptMessages);
  const model = readStringMetadata(metadata, "model")
    ?? resolvedRole?.profile.model
    ?? (provider === "openai" ? loadOpenAILiveConfig(roleId).model : "");

  let raw: unknown;
  let text = "";

  if (provider === "openai") {
    const config = loadOpenAILiveConfig(roleId);
    const serviceTier = requestedServiceTier === "fast"
      && resolveFastServiceTierSupportFromCache(config, model, resolveAppRoot())
      ? "fast"
      : undefined;
    const invocation = facade.generate.create({
      provider,
      model,
      layer,
      variant,
      compatibilityProfileId,
      input:
        variant === "chat_completions_compat"
          ? {
              model,
              messages: buildChatCompletionMessagesFromPromptParts({
                instructionText: params.intent.frame.instructionText,
                promptMessages,
                inputImageUrls,
              }),
              maxCompletionTokens: maxOutputTokens,
              reasoningEffort: reasoningEffort ?? config.reasoningEffort,
            }
          : {
              input: buildResponsesInputFromPromptParts({
                instructionText: params.intent.frame.instructionText,
                promptMessages,
                inputImageUrls,
              }),
              maxOutputTokens,
              reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
            },
    }) as {
      provider: ProviderId;
      model: string;
      layer: Exclude<SdkLayer, "auto">;
      payload: OpenAIInvocationPayload<Record<string, unknown>>;
    };
    if (serviceTier) {
      invocation.payload.params = {
        ...invocation.payload.params,
        service_tier: serviceTier,
      };
    }

    raw = await executeOpenAIInvocation(invocation, roleId);
    if (isOpenAITextResponseEmpty(raw)) {
      throw new Error(
        `OpenAI ${invocation.payload.surface} invocation returned completed metadata but no text output.`,
      );
    }
    text = parseOpenAITextResponse(raw);
  } else if (provider === "anthropic") {
    const anthropicConfig = resolvedRole;
    if (!anthropicConfig || anthropicConfig.profile.provider !== "anthropic") {
      throw new Error(`Anthropic model inference requires an anthropic-configured role; received ${roleId ?? "no role"}.`);
    }
    const prepared = buildAnthropicSystemAndMessagesFromPromptParts({
      instructionText: params.intent.frame.instructionText,
      promptMessages,
      inputImageUrls,
    });
    const invocation = facade.generate.create({
      provider: "anthropic",
      model,
      layer,
      input: {
        maxTokens: maxOutputTokens ?? anthropicConfig.profile.maxOutputTokens ?? 1024,
        system: prepared.system,
        messages: prepared.messages,
        thinking: mapAnthropicReasoningEffortToThinking(reasoningEffort ?? anthropicConfig.profile.reasoningEffort),
      },
    }) as AnthropicModelInvocation & {
      provider: ProviderId;
      model: string;
      layer: Exclude<SdkLayer, "auto">;
    };
    raw = await executeAnthropicInvocation(invocation, roleId);
    text = parseAnthropicTextResponse(raw);
  } else if (provider === "deepmind") {
    const invocation = facade.generate.create({
      provider: "deepmind",
      model,
      layer,
      input: {
        contents: buildDeepMindContentsFromPromptParts({
          instructionText: params.intent.frame.instructionText,
          promptMessages,
          inputImageUrls,
        }),
      },
    }) as DeepMindModelInvocation & {
      provider: ProviderId;
      model: string;
      layer: Exclude<SdkLayer, "auto">;
    };
    raw = await executeDeepMindInvocation(invocation, roleId);
    text = parseDeepMindTextResponse(raw);
  } else {
    throw new Error(`Model inference integration currently only supports provider openai/anthropic/deepmind, received ${provider}.`);
  }

  return {
    provider,
    model,
    layer: (layer === "auto" ? "api" : layer),
    raw,
    result: {
      resultId: params.intent.intentId,
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      source: "model",
      status: "success",
      output: {
        text,
        raw,
      },
      evidence: [],
      emittedAt: new Date().toISOString(),
      correlationId: params.intent.correlationId,
      metadata: {
        provider,
        model,
        layer: layer === "auto" ? "api" : layer,
        variant,
      },
    },
  };
}
