import OpenAI from "openai";

import type { OpenAIInvocationPayload } from "../../integrations/openai/api/index.js";
import { loadOpenAILiveConfig } from "../../rax/live-config.js";
import type { ProviderId, SdkLayer } from "../../rax/index.js";
import { rax } from "../../rax/index.js";
import type { ModelInferenceIntent, KernelResult } from "../types/index.js";
import type { RaxFacade as FullRaxFacade } from "../../rax/facade.js";
import {
  buildChatCompletionMessagesFromPromptParts,
  buildResponsesInputFromPromptParts,
  readPromptMessagesMetadata,
} from "./prompt-message-parts.js";

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
): Promise<unknown> {
  const config = loadOpenAILiveConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  switch (invocation.payload.surface) {
    case "responses":
      {
        let params = invocation.payload.params;
        let metadataStripped = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            const response = await client.responses.create(params as never);
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

export async function executeModelInference(
  params: ModelInferenceExecutionParams,
): Promise<ModelInferenceExecutionResult> {
  const facade = params.facade ?? (rax as unknown as GenerateFacade);
  const metadata = params.intent.frame.metadata;
  const provider = (readStringMetadata(metadata, "provider") as ProviderId | undefined) ?? "openai";
  const model = readStringMetadata(metadata, "model") ?? loadOpenAILiveConfig().model;
  const layer = (readStringMetadata(metadata, "layer") as SdkLayer | undefined) ?? "api";
  const variant = readStringMetadata(metadata, "variant") ?? "chat_completions_compat";
  const compatibilityProfileId = readStringMetadata(metadata, "compatibilityProfileId");
  const maxOutputTokens = readPositiveIntegerMetadata(metadata, "maxOutputTokens");
  const reasoningEffort = readStringMetadata(metadata, "reasoningEffort") as "low" | "medium" | "high" | undefined;
  const inputImageUrls = readStringArrayMetadata(metadata, "inputImageUrls");
  const promptMessages = readPromptMessagesMetadata(metadata?.promptMessages);

  if (provider !== "openai") {
    throw new Error(`Model inference integration currently only supports provider ${"openai"}, received ${provider}.`);
  }

  const config = loadOpenAILiveConfig();
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
            reasoningEffort: reasoningEffort ?? config.reasoningEffort as "low" | "medium" | "high" | undefined,
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

  const raw = await executeOpenAIInvocation(invocation);
  if (isOpenAITextResponseEmpty(raw)) {
    throw new Error(
      `OpenAI ${invocation.payload.surface} invocation returned completed metadata but no text output.`,
    );
  }
  const text = parseOpenAITextResponse(raw);

  return {
    provider: invocation.provider,
    model: invocation.model,
    layer: invocation.layer,
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
        provider: invocation.provider,
        model: invocation.model,
        layer: invocation.layer,
        variant: invocation.payload.surface,
      },
    },
  };
}
