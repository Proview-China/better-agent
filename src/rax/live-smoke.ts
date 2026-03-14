import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import {
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
  getCompatibilityProfile
} from "./compatibility.js";
import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import type { PreparedInvocation } from "./contracts.js";
import { UnsupportedCapabilityError } from "./errors.js";
import { loadLiveProviderConfig } from "./live-config.js";
import { rax } from "./runtime.js";

interface SmokeResult {
  name: string;
  status: "pass" | "fail" | "skip";
  details: string;
}

type AnthropicTarget = "primary" | "alt";

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

async function collectStreamPreview(stream: AsyncIterable<unknown>, limit = 3): Promise<unknown[]> {
  const preview: unknown[] = [];
  for await (const event of stream) {
    preview.push(event);
    if (preview.length >= limit) {
      break;
    }
  }
  return preview;
}

async function executeOpenAI(
  invocation: PreparedInvocation,
  override?: { apiKey: string; baseURL: string }
): Promise<unknown> {
  const config = override ?? loadLiveProviderConfig().openai;
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
      throw new Error(`Unsupported OpenAI surface: ${payload.surface}`);
  }
}

async function executeAnthropic(
  invocation: PreparedInvocation,
  target: AnthropicTarget = "primary"
): Promise<unknown> {
  const config = loadLiveProviderConfig();
  const selected = target === "alt" ? config.anthropicAlt : config.anthropic;
  if (!selected) {
    throw new Error("Anthropic alt config is not available.");
  }

  const client = new Anthropic({
    apiKey: selected.apiKey,
    baseURL: selected.baseURL
  });

  switch (invocation.adapterId) {
    case "anthropic.api.generation.messages.create":
    case "anthropic.api.generation.messages.stream":
      return client.messages.create(invocation.payload as never);
    case "anthropic.api.resources.files.upload":
      return client.beta.files.upload(invocation.payload as never);
    case "anthropic.api.operations.batches.submit":
      return client.beta.messages.batches.create(invocation.payload as never);
    default:
      throw new Error(`Unsupported Anthropic adapter: ${invocation.adapterId}`);
  }
}

async function executeDeepMind(invocation: PreparedInvocation): Promise<unknown> {
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
      throw new Error(`Unsupported DeepMind method: ${payload.method}`);
  }
}

function skip(results: SmokeResult[], name: string, details: string): void {
  results.push({ name, status: "skip", details });
}

function uniqueStrings(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function tryAnthropicGeneration(
  target: AnthropicTarget,
  mode: "create" | "stream",
  modelCandidates: string[],
  prompt: string
): Promise<{ selectedModel: string; response: unknown }> {
  let lastError: unknown;

  for (const candidate of modelCandidates) {
    try {
      const invocation =
        mode === "create"
          ? rax.generate.create({
              provider: "anthropic",
              model: candidate,
              input: {
                maxTokens: 64,
                messages: [{ role: "user", content: prompt }]
              }
            })
          : rax.generate.stream({
              provider: "anthropic",
              model: candidate,
              input: {
                maxTokens: 64,
                messages: [{ role: "user", content: prompt }]
              }
            });

      const response = await executeAnthropic(invocation, target);
      return {
        selectedModel: candidate,
        response
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function tryDeepMindOpenAICompatGeneration(
  mode: "create" | "stream",
  modelCandidates: string[],
  baseURL: string,
  apiKey: string
): Promise<{ selectedModel: string; response: unknown }> {
  let lastError: unknown;
  const normalizedBase = `${baseURL.replace(/\/$/u, "")}/v1`;

  for (const candidate of modelCandidates) {
    try {
      const invocation =
        mode === "create"
          ? rax.generate.create({
              provider: "openai",
              model: candidate,
              variant: "chat_completions_compat",
              input: {
                model: candidate,
                messages: [{ role: "user", content: "Reply with the single token OK." }]
              }
            })
          : rax.generate.stream({
              provider: "openai",
              model: candidate,
              variant: "chat_completions_compat",
              input: {
                model: candidate,
                messages: [{ role: "user", content: "Reply with OK and stop." }]
              }
            });

      const response = await executeOpenAI(invocation, {
        apiKey,
        baseURL: normalizedBase
      });

      return {
        selectedModel: candidate,
        response
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function runSmoke(): Promise<SmokeResult[]> {
  const config = loadLiveProviderConfig();
  const openAIProfile = getCompatibilityProfile("openai", LOCAL_GATEWAY_COMPATIBILITY_PROFILES);
  const anthropicProfile = getCompatibilityProfile("anthropic", LOCAL_GATEWAY_COMPATIBILITY_PROFILES);
  const deepMindProfile = getCompatibilityProfile("deepmind", LOCAL_GATEWAY_COMPATIBILITY_PROFILES);
  const tempDir = await mkdtemp(join(tmpdir(), "rax-thin-smoke-"));
  const results: SmokeResult[] = [];

  try {
    const textFilePath = join(tempDir, "rax-smoke.txt");
    const openAIBatchInputPath = join(tempDir, "openai-batch.jsonl");
    await writeFile(textFilePath, "rax thin capability smoke\n", "utf8");
    await writeFile(
      openAIBatchInputPath,
      `${JSON.stringify({
        custom_id: "rax-openai-batch-smoke",
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: config.openai.model,
          messages: [{ role: "user", content: "Reply with OK." }]
        }
      })}\n`,
      "utf8"
    );

    try {
      const invocation = rax.generate.create({
        provider: "openai",
        model: config.openai.model,
        variant:
          openAIProfile.provider === "openai"
            ? openAIProfile.defaultGenerationVariant
            : undefined,
        input:
          openAIProfile.provider === "openai" &&
          openAIProfile.defaultGenerationVariant === "chat_completions_compat"
            ? {
                model: config.openai.model,
                messages: [{ role: "user", content: "Reply with the single token OK." }]
              }
            : {
                input: "Reply with the single token OK.",
                reasoning: config.openai.reasoningEffort
                  ? { effort: config.openai.reasoningEffort }
                  : undefined
              }
      });
      const response = await executeOpenAI(invocation);
      const text =
        typeof response === "object" && response !== null && "choices" in response
          ? JSON.stringify((response as { choices?: unknown }).choices).slice(0, 120)
          : typeof response === "object" && response !== null && "output_text" in response
            ? String((response as { output_text?: unknown }).output_text ?? "")
            : "no completion text";
      results.push({
        name: "openai.generate.create",
        status: "pass",
        details: text
      });
    } catch (error) {
      results.push({
        name: "openai.generate.create",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      const invocation = rax.generate.stream({
        provider: "openai",
        model: config.openai.model,
        variant:
          openAIProfile.provider === "openai"
            ? openAIProfile.defaultGenerationVariant
            : undefined,
        input:
          openAIProfile.provider === "openai" &&
          openAIProfile.defaultGenerationVariant === "chat_completions_compat"
            ? {
                model: config.openai.model,
                messages: [{ role: "user", content: "Reply with OK and stop." }]
              }
            : {
                input: "Reply with OK and stop."
              }
      });
      const stream = await executeOpenAI(invocation);
      const preview = isAsyncIterable(stream) ? await collectStreamPreview(stream) : [stream];
      results.push({
        name: "openai.generate.stream",
        status: "pass",
        details: `events=${preview.length}`
      });
    } catch (error) {
      results.push({
        name: "openai.generate.stream",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    if (openAIProfile.provider === "openai" && openAIProfile.supportsEmbeddings === false) {
      skip(results, "openai.embed.create", "Skipped by compatibility profile: embeddings unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.embed.create({
          provider: "openai",
          model: "text-embedding-3-large",
          input: {
            input: "rax thin embedding smoke",
            model: "text-embedding-3-large"
          }
        });
        const response = await executeOpenAI(invocation);
        const dataLength =
          typeof response === "object" && response !== null && "data" in response
            ? Array.isArray((response as { data?: unknown }).data)
              ? (response as { data: unknown[] }).data.length
              : 0
            : 0;
        results.push({
          name: "openai.embed.create",
          status: dataLength > 0 ? "pass" : "fail",
          details: `vectors=${dataLength}`
        });
      } catch (error) {
        results.push({
          name: "openai.embed.create",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    let openAIFileId: string | undefined;
    if (openAIProfile.provider === "openai" && openAIProfile.supportsFiles === false) {
      skip(results, "openai.file.upload", "Skipped by compatibility profile: files unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.file.upload({
          provider: "openai",
          model: config.openai.model,
          input: {
            file: createReadStream(openAIBatchInputPath),
            purpose: "batch"
          }
        });
        const response = await executeOpenAI(invocation);
        openAIFileId =
          typeof response === "object" && response !== null && "id" in response
            ? String((response as { id?: unknown }).id ?? "")
            : undefined;
        results.push({
          name: "openai.file.upload",
          status: openAIFileId ? "pass" : "fail",
          details: openAIFileId ? `file=${openAIFileId}` : "missing file id"
        });
      } catch (error) {
        results.push({
          name: "openai.file.upload",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (openAIProfile.provider === "openai" && openAIProfile.supportsBatches === false) {
      skip(results, "openai.batch.submit", "Skipped by compatibility profile: batches unsupported on this gateway.");
    } else {
      try {
        if (!openAIFileId) {
          throw new Error("Skipped because OpenAI file upload did not return a file id.");
        }
        const invocation = rax.batch.submit({
          provider: "openai",
          model: config.openai.model,
          input: {
            endpoint: "/v1/chat/completions",
            inputFileId: openAIFileId
          }
        });
        const response = await executeOpenAI(invocation);
        const id =
          typeof response === "object" && response !== null && "id" in response
            ? String((response as { id?: unknown }).id ?? "")
            : "";
        results.push({
          name: "openai.batch.submit",
          status: id ? "pass" : "fail",
          details: id || "missing batch id"
        });
      } catch (error) {
        results.push({
          name: "openai.batch.submit",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    try {
      const modelCandidates =
        anthropicProfile.provider === "anthropic"
          ? uniqueStrings([config.anthropic.model, ...(anthropicProfile.preferredModelNames ?? [])])
          : [config.anthropic.model];
      const { selectedModel, response } = await tryAnthropicGeneration(
        "primary",
        "create",
        modelCandidates,
        "Reply with the single token OK."
      );
      const text =
        typeof response === "object" && response !== null && "content" in response
          ? JSON.stringify((response as { content?: unknown }).content).slice(0, 120)
          : "no content";
      results.push({
        name: "anthropic.generate.create",
        status: "pass",
        details: `${selectedModel}: ${text}`
      });
    } catch (error) {
      results.push({
        name: "anthropic.generate.create",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      const modelCandidates =
        anthropicProfile.provider === "anthropic"
          ? uniqueStrings([config.anthropic.model, ...(anthropicProfile.preferredModelNames ?? [])])
          : [config.anthropic.model];
      const { selectedModel, response } = await tryAnthropicGeneration(
        "primary",
        "stream",
        modelCandidates,
        "Reply with OK and stop."
      );
      const preview = isAsyncIterable(response) ? await collectStreamPreview(response) : [response];
      results.push({
        name: "anthropic.generate.stream",
        status: "pass",
        details: `${selectedModel}: events=${preview.length}`
      });
    } catch (error) {
      results.push({
        name: "anthropic.generate.stream",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    if (config.anthropicAlt) {
      try {
        const modelCandidates =
          anthropicProfile.provider === "anthropic"
            ? uniqueStrings([config.anthropicAlt.model, ...(anthropicProfile.preferredModelNames ?? [])])
            : [config.anthropicAlt.model];
        const { selectedModel, response } = await tryAnthropicGeneration(
          "alt",
          "create",
          modelCandidates,
          "Reply with the single token OK."
        );
        const text =
          typeof response === "object" && response !== null && "content" in response
            ? JSON.stringify((response as { content?: unknown }).content).slice(0, 120)
            : "no content";
        results.push({
          name: "anthropic.alt.generate.create",
          status: "pass",
          details: `${selectedModel}: ${text}`
        });
      } catch (error) {
        results.push({
          name: "anthropic.alt.generate.create",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (anthropicProfile.provider === "anthropic" && anthropicProfile.supportsFilesBeta === false) {
      skip(results, "anthropic.file.upload", "Skipped by compatibility profile: files unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.file.upload({
          provider: "anthropic",
          model: config.anthropic.model,
          input: {
            file: createReadStream(textFilePath)
          }
        });
        const response = await executeAnthropic(invocation);
        const id =
          typeof response === "object" && response !== null && "id" in response
            ? String((response as { id?: unknown }).id ?? "")
            : "";
        results.push({
          name: "anthropic.file.upload",
          status: id ? "pass" : "fail",
          details: id || "missing file id"
        });
      } catch (error) {
        results.push({
          name: "anthropic.file.upload",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (anthropicProfile.provider === "anthropic" && anthropicProfile.supportsMessageBatches === false) {
      skip(results, "anthropic.batch.submit", "Skipped by compatibility profile: message batches unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.batch.submit({
          provider: "anthropic",
          model: config.anthropic.model,
          input: {
            requests: [
              {
                customId: "rax-anthropic-batch-smoke",
                maxTokens: 64,
                messages: [{ role: "user", content: "Reply with the single token OK." }]
              }
            ]
          }
        });
        const response = await executeAnthropic(invocation);
        const id =
          typeof response === "object" && response !== null && "id" in response
            ? String((response as { id?: unknown }).id ?? "")
            : "";
        results.push({
          name: "anthropic.batch.submit",
          status: id ? "pass" : "fail",
          details: id || "missing batch id"
        });
      } catch (error) {
        results.push({
          name: "anthropic.batch.submit",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    try {
      rax.embed.create({
        provider: "anthropic",
        model: config.anthropic.model,
        input: { text: "unsupported" }
      });
      results.push({
        name: "anthropic.embed.create",
        status: "fail",
        details: "Expected unsupported_capability but routing succeeded."
      });
    } catch (error) {
      results.push({
        name: "anthropic.embed.create",
        status: error instanceof UnsupportedCapabilityError ? "pass" : "fail",
        details:
          error instanceof UnsupportedCapabilityError
            ? "unsupported_capability"
            : error instanceof Error
              ? error.message
              : String(error)
      });
    }

    try {
      const modelCandidates =
        deepMindProfile.provider === "deepmind"
          ? uniqueStrings([config.deepmind.model, ...(deepMindProfile.supportedModelHints ?? [])])
          : [config.deepmind.model];

      const { selectedModel, response } =
        deepMindProfile.provider === "deepmind" &&
        deepMindProfile.protocolFlavor === "openai-compatible-gemini-backend"
          ? await tryDeepMindOpenAICompatGeneration(
              "create",
              modelCandidates,
              config.deepmind.baseURL,
              config.deepmind.apiKey
            )
          : (() => {
              throw new Error("Unexpected deepmind profile flavor for live smoke.");
            })();

      const text =
        typeof response === "object" && response !== null && "choices" in response
          ? JSON.stringify((response as { choices?: unknown }).choices).slice(0, 120)
          : JSON.stringify(response).slice(0, 120);
      results.push({
        name: "deepmind.generate.create",
        status: "pass",
        details: `${selectedModel}: ${text}`
      });
    } catch (error) {
      results.push({
        name: "deepmind.generate.create",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      const modelCandidates =
        deepMindProfile.provider === "deepmind"
          ? uniqueStrings([config.deepmind.model, ...(deepMindProfile.supportedModelHints ?? [])])
          : [config.deepmind.model];

      const { selectedModel, response } =
        deepMindProfile.provider === "deepmind" &&
        deepMindProfile.protocolFlavor === "openai-compatible-gemini-backend"
          ? await tryDeepMindOpenAICompatGeneration(
              "stream",
              modelCandidates,
              config.deepmind.baseURL,
              config.deepmind.apiKey
            )
          : (() => {
              throw new Error("Unexpected deepmind profile flavor for live smoke.");
            })();

      const preview = isAsyncIterable(response) ? await collectStreamPreview(response) : [response];
      results.push({
        name: "deepmind.generate.stream",
        status: "pass",
        details: `${selectedModel}: events=${preview.length}`
      });
    } catch (error) {
      results.push({
        name: "deepmind.generate.stream",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      if (deepMindProfile.provider === "deepmind" && deepMindProfile.supportsOpenAIEmbeddings === true) {
        const invocation = rax.embed.create({
          provider: "openai",
          model: "gemini-embedding-001",
          input: {
            input: "rax thin embedding smoke",
            model: "gemini-embedding-001"
          }
        });
        const response = await executeOpenAI(invocation, {
          apiKey: config.deepmind.apiKey,
          baseURL: `${config.deepmind.baseURL.replace(/\/$/u, "")}/v1`
        });
        const dataLength =
          typeof response === "object" && response !== null && "data" in response
            ? Array.isArray((response as { data?: unknown }).data)
              ? (response as { data: unknown[] }).data.length
              : 0
            : 0;
        results.push({
          name: "deepmind.embed.create",
          status: dataLength > 0 ? "pass" : "fail",
          details: `vectors=${dataLength}`
        });
      } else {
        throw new Error("DeepMind compatibility profile did not expose an embeddings path.");
      }
    } catch (error) {
      results.push({
        name: "deepmind.embed.create",
        status: "fail",
        details: error instanceof Error ? error.message : String(error)
      });
    }

    if (deepMindProfile.provider === "deepmind" && deepMindProfile.supportsFileUpload === false) {
      skip(results, "deepmind.file.upload", "Skipped by compatibility profile: Gemini file upload unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.file.upload({
          provider: "deepmind",
          model: config.deepmind.model,
          input: {
            file: textFilePath,
            config: {
              mimeType: "text/plain",
              displayName: "rax-thin-smoke.txt"
            }
          }
        });
        const response = await executeDeepMind(invocation);
        const name =
          typeof response === "object" && response !== null && "name" in response
            ? String((response as { name?: unknown }).name ?? "")
            : "";
        results.push({
          name: "deepmind.file.upload",
          status: name ? "pass" : "fail",
          details: name || JSON.stringify(response).slice(0, 120)
        });
      } catch (error) {
        results.push({
          name: "deepmind.file.upload",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (deepMindProfile.provider === "deepmind" && deepMindProfile.supportsBatches === false) {
      skip(results, "deepmind.batch.submit", "Skipped by compatibility profile: Gemini batch unsupported on this gateway.");
    } else {
      try {
        const invocation = rax.batch.submit({
          provider: "deepmind",
          model: config.deepmind.model,
          input: {
            src: {
              inlinedRequests: [
                {
                  model: config.deepmind.model,
                  contents: "Reply with the single token OK."
                }
              ]
            },
            config: {
              displayName: "rax-thin-batch-smoke"
            }
          }
        });
        const response = await executeDeepMind(invocation);
        const name =
          typeof response === "object" && response !== null && "name" in response
            ? String((response as { name?: unknown }).name ?? "")
            : "";
        results.push({
          name: "deepmind.batch.submit",
          status: name ? "pass" : "fail",
          details: name || JSON.stringify(response).slice(0, 120)
        });
      } catch (error) {
        results.push({
          name: "deepmind.batch.submit",
          status: "fail",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function printResults(results: SmokeResult[]): void {
  for (const result of results) {
    console.log(`${result.status.toUpperCase()} ${result.name}: ${result.details}`);
  }
}

const entrypoint = process.argv[1];
const isDirectRun =
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isDirectRun) {
  void runSmoke()
    .then((results) => {
      printResults(results);
      const hasFailure = results.some((result) => result.status === "fail");
      process.exitCode = hasFailure ? 1 : 0;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
