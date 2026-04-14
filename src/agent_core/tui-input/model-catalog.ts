import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import Anthropic from "@anthropic-ai/sdk";

import {
  CHATGPT_BACKEND_CLIENT_VERSION,
  createOpenAIClient,
  isGmnOpenAIGatewayBaseURL,
  isChatgptCodexBackendBaseURL,
  loadOpenAILiveConfig,
  prepareResponsesParamsForOpenAIAuth,
  type OpenAILiveConfig,
} from "../../rax/live-config.js";
import { loadResolvedEmbeddingConfig, type RaxcodeResolvedEmbeddingConfig } from "../../raxcode-config.js";
import { resolveCacheDir } from "../../runtime-paths.js";
import { mapAnthropicReasoningEffortToThinking } from "../../integrations/anthropic/api/shared.js";

export interface AvailableModelCatalogEntry {
  id: string;
  label: string;
  reasoningLevels: string[];
  reasoningLevelDescriptions: Record<string, string>;
  defaultReasoningLevel?: string;
  supportsFastServiceTier: boolean;
  source: "chat" | "embedding";
}

export interface ModelAvailabilityRecord {
  status: "available" | "unavailable";
  checkedAt: string;
  error?: string;
}

interface ModelAvailabilityCacheFile {
  version: 1;
  entries: Record<string, ModelAvailabilityRecord>;
}

const FAST_SERVICE_TIER_CANDIDATE_MODEL_IDS = new Set([
  "gpt-5.4",
]);
const GMN_FAST_SERVICE_TIER_CANDIDATE_MODEL_IDS = new Set([
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
]);
const FAST_SERVICE_TIER_PREFIX = "__fast_service_tier__";

export const EMBEDDING_MODEL_CATALOG: AvailableModelCatalogEntry[] = [
  {
    id: "text-embedding-3-large",
    label: "text-embedding-3-large",
    reasoningLevels: [],
    reasoningLevelDescriptions: {},
    supportsFastServiceTier: false,
    source: "embedding",
  },
  {
    id: "text-embedding-3-small",
    label: "text-embedding-3-small",
    reasoningLevels: [],
    reasoningLevelDescriptions: {},
    supportsFastServiceTier: false,
    source: "embedding",
  },
];

interface ChatgptBackendModelRecord {
  slug?: string;
  display_name?: string;
  supported_reasoning_levels?: Array<{ effort?: string; description?: string }>;
  default_reasoning_level?: string;
  additional_speed_tiers?: string[];
  supported_in_api?: boolean;
}

interface OpenAIModelsPayload {
  models?: ChatgptBackendModelRecord[];
  data?: Array<{ id?: string }>;
}

const PRIORITY_CHAT_MODEL_IDS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
] as const;

const OFFICIAL_EXTRA_REASONING_LEVELS = new Map<string, string[]>([
  ["gpt-5.4", ["none"]],
  ["gpt-5.4-mini", ["none"]],
]);

const MODEL_AVAILABILITY_CACHE_FILE = "model-availability.json";
const MODEL_AVAILABILITY_CACHE_VERSION = 1;
const ANTHROPIC_REASONING_LEVELS = ["none", "low", "medium", "high", "xhigh"] as const;

let modelAvailabilityCacheMemo:
  | {
      filePath: string;
      entries: Record<string, ModelAvailabilityRecord>;
    }
  | null = null;

function fallbackReasoningLevels(modelId: string): string[] {
  if (/^gpt/iu.test(modelId)) {
    return ["none", "low", "medium", "high", "xhigh"];
  }
  return [];
}

function normalizeReasoningLevelDescriptions(
  supportedReasoningLevels?: Array<{ effort?: string; description?: string }>,
): Record<string, string> {
  return Object.fromEntries(
    (supportedReasoningLevels ?? [])
      .map((entry) => [entry.effort?.trim(), entry.description?.trim()] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );
}

function normalizeReasoningLevels(
  modelId: string,
  supportedReasoningLevels?: Array<{ effort?: string; description?: string }>,
): string[] {
  const resolved = supportedReasoningLevels
    ?.map((entry) => entry.effort?.trim())
    .filter((entry): entry is string => Boolean(entry));
  if (resolved && resolved.length > 0) {
    return [...new Set(resolved)];
  }
  return fallbackReasoningLevels(modelId);
}

function normalizeChatgptCodexModels(payload: OpenAIModelsPayload): AvailableModelCatalogEntry[] {
  const models = (payload.models ?? [])
    .filter((entry) => entry.supported_in_api !== false && typeof entry.slug === "string" && entry.slug.trim().length > 0)
    .map((entry) => {
      const id = entry.slug!.trim();
      const reasoningLevels = normalizeReasoningLevels(id, entry.supported_reasoning_levels);
      const reasoningLevelDescriptions = normalizeReasoningLevelDescriptions(entry.supported_reasoning_levels);
      return {
        id,
        label: typeof entry.display_name === "string" && entry.display_name.trim().length > 0
          ? entry.display_name.trim()
          : id,
        reasoningLevels,
        reasoningLevelDescriptions,
        defaultReasoningLevel: typeof entry.default_reasoning_level === "string" ? entry.default_reasoning_level : undefined,
        supportsFastServiceTier: Array.isArray(entry.additional_speed_tiers)
          && entry.additional_speed_tiers.includes("fast"),
        source: "chat",
      } satisfies AvailableModelCatalogEntry;
    });
  return [...models].sort((left, right) => {
    const leftPriority = PRIORITY_CHAT_MODEL_IDS.indexOf(left.id as (typeof PRIORITY_CHAT_MODEL_IDS)[number]);
    const rightPriority = PRIORITY_CHAT_MODEL_IDS.indexOf(right.id as (typeof PRIORITY_CHAT_MODEL_IDS)[number]);
    if (leftPriority >= 0 && rightPriority >= 0) {
      return leftPriority - rightPriority;
    }
    if (leftPriority >= 0) {
      return -1;
    }
    if (rightPriority >= 0) {
      return 1;
    }
    return 0;
  });
}

function applyOfficialReasoningLevelOverrides(
  models: AvailableModelCatalogEntry[],
): AvailableModelCatalogEntry[] {
  return models.map((model) => {
    const extraLevels = OFFICIAL_EXTRA_REASONING_LEVELS.get(model.id);
    if (!extraLevels?.length) {
      return model;
    }
    return {
      ...model,
      reasoningLevels: [...new Set([...extraLevels, ...model.reasoningLevels])],
    };
  });
}

function normalizeApiModels(payload: OpenAIModelsPayload): AvailableModelCatalogEntry[] {
  return (payload.data ?? [])
    .filter((entry) => typeof entry.id === "string" && entry.id.trim().length > 0)
    .map((entry) => {
      const id = entry.id!.trim();
      return {
        id,
        label: id,
        reasoningLevels: fallbackReasoningLevels(id),
        reasoningLevelDescriptions: {},
        supportsFastServiceTier: false,
        source: "chat",
      } satisfies AvailableModelCatalogEntry;
    });
}

function supportsFastServiceTierByRoute(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL">,
  modelId: string,
): boolean {
  if (
    config.authMode === "chatgpt_oauth"
    && isChatgptCodexBackendBaseURL(config.baseURL)
    && FAST_SERVICE_TIER_CANDIDATE_MODEL_IDS.has(modelId)
  ) {
    return true;
  }
  if (isGmnOpenAIGatewayBaseURL(config.baseURL) && GMN_FAST_SERVICE_TIER_CANDIDATE_MODEL_IDS.has(modelId)) {
    return true;
  }
  return false;
}

export async function listAvailableChatModels(
  config: OpenAILiveConfig = loadOpenAILiveConfig(),
): Promise<AvailableModelCatalogEntry[]> {
  const baseURL = config.baseURL.replace(/\/$/u, "");
  const url = new URL(`${baseURL}/models`);
  if (isChatgptCodexBackendBaseURL(config.baseURL)) {
    url.searchParams.set("client_version", CHATGPT_BACKEND_CLIENT_VERSION);
  }
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      ...(config.defaultHeaders ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to load models: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as OpenAIModelsPayload;
  return isChatgptCodexBackendBaseURL(config.baseURL)
    ? applyOfficialReasoningLevelOverrides(normalizeChatgptCodexModels(payload))
    : normalizeApiModels(payload).map((entry) => ({
        ...entry,
        supportsFastServiceTier: supportsFastServiceTierByRoute(config, entry.id),
      }));
}

export async function listAvailableAnthropicModels(config: {
  apiKey: string;
  baseURL: string;
}): Promise<AvailableModelCatalogEntry[]> {
  const response = await fetch(`${config.baseURL.replace(/\/$/u, "")}/v1/models`, {
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to load Anthropic models: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as { data?: Array<{ id?: string }> };
  return (payload.data ?? [])
    .map((entry) => entry.id?.trim())
    .filter((entry): entry is string => Boolean(entry))
    .map((id) => ({
      id,
      label: id,
      reasoningLevels: [...ANTHROPIC_REASONING_LEVELS],
      reasoningLevelDescriptions: {},
      defaultReasoningLevel: "medium",
      supportsFastServiceTier: false,
      source: "chat",
    } satisfies AvailableModelCatalogEntry));
}

function resolveModelAvailabilityCachePath(fallbackDir = process.cwd()): string {
  return `${resolveCacheDir(fallbackDir)}/${MODEL_AVAILABILITY_CACHE_FILE}`;
}

function loadModelAvailabilityCache(
  fallbackDir = process.cwd(),
): Record<string, ModelAvailabilityRecord> {
  const filePath = resolveModelAvailabilityCachePath(fallbackDir);
  if (modelAvailabilityCacheMemo?.filePath === filePath) {
    return modelAvailabilityCacheMemo.entries;
  }
  let entries: Record<string, ModelAvailabilityRecord> = {};
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<ModelAvailabilityCacheFile>;
      if (parsed.version === MODEL_AVAILABILITY_CACHE_VERSION && parsed.entries && typeof parsed.entries === "object") {
        entries = parsed.entries as Record<string, ModelAvailabilityRecord>;
      }
    } catch {
      entries = {};
    }
  }
  modelAvailabilityCacheMemo = { filePath, entries };
  return entries;
}

function writeModelAvailabilityCache(
  entries: Record<string, ModelAvailabilityRecord>,
  fallbackDir = process.cwd(),
): void {
  const filePath = resolveModelAvailabilityCachePath(fallbackDir);
  mkdirSync(resolveCacheDir(fallbackDir), { recursive: true });
  writeFileSync(filePath, JSON.stringify({
    version: MODEL_AVAILABILITY_CACHE_VERSION,
    entries,
  } satisfies ModelAvailabilityCacheFile, null, 2));
  modelAvailabilityCacheMemo = { filePath, entries };
}

function hashScopeFingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export function buildChatModelAvailabilityScopeKey(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "apiKey" | "accountId" | "defaultHeaders">,
): string {
  const accountId = typeof config.defaultHeaders?.["chatgpt-account-id"] === "string"
    ? config.defaultHeaders["chatgpt-account-id"]
    : config.accountId;
  const fingerprint = config.authMode === "chatgpt_oauth"
    ? hashScopeFingerprint([config.authMode, config.baseURL, accountId ?? ""])
    : hashScopeFingerprint([config.authMode, config.baseURL, config.apiKey]);
  return `chat:${fingerprint}`;
}

export function buildEmbeddingModelAvailabilityScopeKey(
  config: Pick<RaxcodeResolvedEmbeddingConfig, "baseURL" | "apiKey" | "authProfileId">,
): string {
  return `embedding:${hashScopeFingerprint([config.baseURL, config.authProfileId, config.apiKey])}`;
}

function fastServiceTierModelCacheKey(modelId: string): string {
  return `${FAST_SERVICE_TIER_PREFIX}:${modelId}`;
}

export function getCachedModelAvailability(
  scopeKey: string,
  modelId: string,
  fallbackDir = process.cwd(),
): ModelAvailabilityRecord | undefined {
  const entries = loadModelAvailabilityCache(fallbackDir);
  return entries[`${scopeKey}:${modelId}`];
}

export function setCachedModelAvailability(
  scopeKey: string,
  modelId: string,
  record: ModelAvailabilityRecord,
  fallbackDir = process.cwd(),
): ModelAvailabilityRecord {
  const entries = { ...loadModelAvailabilityCache(fallbackDir) };
  entries[`${scopeKey}:${modelId}`] = record;
  writeModelAvailabilityCache(entries, fallbackDir);
  return record;
}

export function getCachedFastServiceTierAvailability(
  scopeKey: string,
  modelId: string,
  fallbackDir = process.cwd(),
): ModelAvailabilityRecord | undefined {
  return getCachedModelAvailability(scopeKey, fastServiceTierModelCacheKey(modelId), fallbackDir);
}

export function setCachedFastServiceTierAvailability(
  scopeKey: string,
  modelId: string,
  record: ModelAvailabilityRecord,
  fallbackDir = process.cwd(),
): ModelAvailabilityRecord {
  return setCachedModelAvailability(scopeKey, fastServiceTierModelCacheKey(modelId), record, fallbackDir);
}

export function resolveFastServiceTierSupportFromCache(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "apiKey" | "accountId" | "defaultHeaders">,
  modelId: string,
  _fallbackDir = process.cwd(),
): boolean {
  return supportsFastServiceTierByRoute(config, modelId);
}

export function applyFastServiceTierCacheSupport(
  models: AvailableModelCatalogEntry[],
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "apiKey" | "accountId" | "defaultHeaders">,
  fallbackDir = process.cwd(),
): AvailableModelCatalogEntry[] {
  return models.map((model) => ({
    ...model,
    supportsFastServiceTier:
      model.supportsFastServiceTier
      || resolveFastServiceTierSupportFromCache(config, model.id, fallbackDir),
  }));
}

function summarizeProbeFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

export async function probeChatModelAvailability(
  modelId: string,
  config: OpenAILiveConfig = loadOpenAILiveConfig(),
  fallbackReasoning = "low",
): Promise<ModelAvailabilityRecord> {
  try {
    const client = createOpenAIClient(config);
    const prepared = prepareResponsesParamsForOpenAIAuth(
      config,
      {
        model: modelId,
        input: "Reply with exactly OK.",
        reasoning: { effort: fallbackReasoning },
        max_output_tokens: 16,
        stream: false,
      },
      "Reply with exactly OK.",
    );
    const response = await client.responses.create(prepared as never);
    if (response && typeof response === "object" && Symbol.asyncIterator in response) {
      const iterator = (response as AsyncIterable<unknown>)[Symbol.asyncIterator]();
      try {
        await iterator.next();
      } finally {
        await iterator.return?.(undefined);
      }
    }
    return {
      status: "available",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: summarizeProbeFailure(error),
    };
  }
}

export async function probeChatCompletionsModelAvailability(
  modelId: string,
  config: OpenAILiveConfig = loadOpenAILiveConfig(),
): Promise<ModelAvailabilityRecord> {
  try {
    const client = createOpenAIClient(config);
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "user",
          content: "Reply with exactly OK.",
        },
      ],
      max_completion_tokens: 16,
      stream: false,
    });
    if (response && typeof response === "object" && Symbol.asyncIterator in response) {
      const iterator = (response as AsyncIterable<unknown>)[Symbol.asyncIterator]();
      try {
        await iterator.next();
      } finally {
        await iterator.return?.(undefined);
      }
    }
    return {
      status: "available",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: summarizeProbeFailure(error),
    };
  }
}

export async function probeAnthropicModelAvailability(
  modelId: string,
  config: {
    apiKey: string;
    baseURL: string;
  },
  thinkingEffort: "none" | "low" | "medium" | "high" | "xhigh" = "none",
): Promise<ModelAvailabilityRecord> {
  try {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    await client.messages.create({
      model: modelId,
      max_tokens: 16,
      messages: [
        {
          role: "user",
          content: "Reply with exactly OK.",
        },
      ],
      thinking: mapAnthropicReasoningEffortToThinking(thinkingEffort),
    });
    return {
      status: "available",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: summarizeProbeFailure(error),
    };
  }
}

export async function probeFastServiceTierAvailability(
  modelId: string,
  config: OpenAILiveConfig = loadOpenAILiveConfig(),
): Promise<ModelAvailabilityRecord> {
  if (!supportsFastServiceTierByRoute(config, modelId)) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: "FAST service tier is unavailable for the current model and route.",
    };
  }
  try {
    const client = createOpenAIClient(config);
    const prepared = prepareResponsesParamsForOpenAIAuth(
      config,
      {
        model: modelId,
        input: "Reply with exactly FAST_OK.",
        reasoning: { effort: "low" },
        service_tier: "fast",
        stream: false,
      },
      "Reply with exactly FAST_OK.",
    );
    const response = await client.responses.create(prepared as never);
    if (response && typeof response === "object" && Symbol.asyncIterator in response) {
      const iterator = (response as AsyncIterable<unknown>)[Symbol.asyncIterator]();
      try {
        await iterator.next();
      } finally {
        await iterator.return?.(undefined);
      }
    }
    return {
      status: "available",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: summarizeProbeFailure(error),
    };
  }
}

export async function probeEmbeddingModelAvailability(
  modelId: RaxcodeResolvedEmbeddingConfig["model"],
  config = loadResolvedEmbeddingConfig(),
): Promise<ModelAvailabilityRecord> {
  if (!config) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: "Embedding upstream is not configured.",
    };
  }
  try {
    const client = createOpenAIClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    const response = await client.embeddings.create({
      model: modelId,
      input: "availability probe",
    });
    const vector = Array.isArray(response.data) ? response.data[0]?.embedding : undefined;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error("Embedding probe returned no vector values.");
    }
    return {
      status: "available",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      error: summarizeProbeFailure(error),
    };
  }
}
