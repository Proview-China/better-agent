import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import type { PreparedInvocation } from "./contracts.js";
import {
  CompatibilityBlockedError,
  MissingAdapterError,
  RaxRoutingError,
  UnsupportedCapabilityError
} from "./errors.js";
import { loadLiveProviderConfig } from "./live-config.js";
import {
  toWebSearchCapabilityResult,
  toWebSearchFailureResult
} from "./websearch-result.js";
import type { CapabilityResult, ProviderId } from "./types.js";
import type { WebSearchOutput } from "./websearch-types.js";

const execFileAsync = promisify(execFile);

function extractErrorCode(error: unknown, fallback = "websearch_failed"): string {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return fallback;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : fallback;
}

function extractFirstJsonArray(source: string): string {
  const start = source.indexOf("[{");
  if (start === -1) {
    throw new Error("Claude Code output did not contain a JSON event array.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error("Claude Code output ended before the JSON event array closed.");
}

export interface WebSearchRuntimeLike {
  executePreparedInvocation(
    invocation: PreparedInvocation,
    compatibilityProfileId?: string
  ): Promise<CapabilityResult<WebSearchOutput>>;
  createErrorResult(params: {
    provider: ProviderId;
    model: string;
    compatibilityProfileId?: string;
    error: unknown;
  }): CapabilityResult<WebSearchOutput>;
}

export class WebSearchRuntime implements WebSearchRuntimeLike {
  async executePreparedInvocation(
    invocation: PreparedInvocation,
    compatibilityProfileId?: string
  ): Promise<CapabilityResult<WebSearchOutput>> {
    try {
      const raw = await this.#executeRaw(invocation);
      return toWebSearchCapabilityResult(
        invocation.provider,
        invocation.model,
        invocation.layer,
        raw,
        compatibilityProfileId
      );
    } catch (error) {
      return toWebSearchFailureResult(
        invocation.provider,
        invocation.model,
        invocation.layer,
        error instanceof Error ? error.message : "Unknown websearch execution failure.",
        error,
        compatibilityProfileId,
        extractErrorCode(error)
      );
    }
  }

  createErrorResult(params: {
    provider: ProviderId;
    model: string;
    compatibilityProfileId?: string;
    error: unknown;
  }): CapabilityResult<WebSearchOutput> {
    const { provider, model, compatibilityProfileId, error } = params;
    const layer = "api";

    if (
      error instanceof CompatibilityBlockedError ||
      error instanceof UnsupportedCapabilityError
    ) {
      return {
        status: "blocked",
        provider,
        model,
        layer,
        compatibilityProfileId,
        capability: "search",
        action: "ground",
        error: {
          code: error.code,
          message: error.message,
          raw: error
        }
      };
    }

    if (error instanceof MissingAdapterError || error instanceof RaxRoutingError) {
      return toWebSearchFailureResult(
        provider,
        model,
        layer,
        error.message,
        error,
        compatibilityProfileId,
        error.code
      );
    }

    return toWebSearchFailureResult(
      provider,
      model,
      layer,
      error instanceof Error ? error.message : "Unknown websearch routing failure.",
      error,
      compatibilityProfileId,
      extractErrorCode(error)
    );
  }

  async #executeRaw(invocation: PreparedInvocation): Promise<unknown> {
    switch (invocation.provider) {
      case "openai":
        return this.#executeOpenAI(invocation);
      case "anthropic":
        return this.#executeAnthropic(invocation);
      case "deepmind":
        return this.#executeDeepMind(invocation);
    }
  }

  async #executeOpenAI(invocation: PreparedInvocation): Promise<unknown> {
    const config = loadLiveProviderConfig().openai;
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;

    switch (payload.surface) {
      case "responses":
        return client.responses.create(payload.params as never);
      case "chat_completions":
        return client.chat.completions.create(payload.params as never);
      case "embeddings":
        return client.embeddings.create(payload.params as never);
      case "files":
        return client.files.create(payload.params as never);
      case "batches":
        return client.batches.create(payload.params as never);
      default:
        throw new Error(`Unsupported OpenAI surface for websearch runtime: ${payload.surface}`);
    }
  }

  async #executeAnthropic(invocation: PreparedInvocation): Promise<unknown> {
    if (invocation.layer === "agent") {
      return this.#executeAnthropicAgent(invocation);
    }

    const config = loadLiveProviderConfig().anthropic;
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });

    switch (invocation.adapterId) {
      case "anthropic.api.tools.search.ground":
      case "anthropic.api.generation.messages.create":
      case "anthropic.api.generation.messages.stream":
        return client.messages.create(invocation.payload as never);
      default:
        throw new Error(`Unsupported Anthropic adapter for websearch runtime: ${invocation.adapterId}`);
    }
  }

  async #executeAnthropicAgent(invocation: PreparedInvocation): Promise<unknown> {
    if (process.platform === "win32") {
      throw new RaxRoutingError(
        "anthropic_agent_unavailable_on_windows",
        "Anthropic Claude Code agent websearch currently requires a Unix-like shell via script(1); use layer: \"api\" on Windows."
      );
    }

    const payload = invocation.payload as {
      command: string;
      args: string[];
      prompt: string;
    };

    const shellCommand = [
      payload.command,
      ...payload.args.map((entry) => JSON.stringify(entry)),
      JSON.stringify(payload.prompt)
    ].join(" ");

    const { stdout } = await execFileAsync(
      "script",
      ["-qec", shellCommand, "/dev/null"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env
        },
        maxBuffer: 10 * 1024 * 1024
      }
    );

    try {
      const normalized = stdout.replace(/\r/gu, "");
      return JSON.parse(extractFirstJsonArray(normalized));
    } catch (error) {
      throw new Error(
        `Failed to parse Claude Code JSON output: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async #executeDeepMind(invocation: PreparedInvocation): Promise<unknown> {
    const config = loadLiveProviderConfig().deepmind;
    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        baseUrl: config.baseURL
      }
    });

    const payload = invocation.payload as {
      method: string;
      params: Record<string, unknown>;
    };

    switch (payload.method) {
      case "ai.interactions.create":
        return client.interactions.create(payload.params as never);
      case "ai.models.generateContent":
        return client.models.generateContent(payload.params as never);
      case "ai.models.generateContentStream":
        return client.models.generateContentStream(payload.params as never);
      case "ai.models.embedContent":
        return client.models.embedContent(payload.params as never);
      case "ai.files.upload":
        return client.files.upload(payload.params as never);
      case "ai.batches.create":
        return client.batches.create(payload.params as never);
      default:
        throw new Error(`Unsupported DeepMind method for websearch runtime: ${payload.method}`);
    }
  }
}
