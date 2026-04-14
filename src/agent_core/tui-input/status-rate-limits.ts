import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  CHATGPT_BACKEND_CLIENT_VERSION,
  isChatgptCodexBackendBaseURL,
  loadOpenAILiveConfig,
  type OpenAILiveConfig,
} from "../../rax/live-config.js";
import { resolveCacheDir } from "../../runtime-paths.js";

export interface StatusRateLimitWindowSnapshot {
  usedPercent: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

export interface StatusRateLimitCreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance?: string;
}

export interface StatusRateLimitSnapshot {
  limitId: string;
  limitName?: string;
  primary?: StatusRateLimitWindowSnapshot;
  secondary?: StatusRateLimitWindowSnapshot;
  credits?: StatusRateLimitCreditsSnapshot;
  planType?: string;
  capturedAt: string;
  source: "usage_endpoint" | "response_headers";
}

export interface StatusRateLimitCacheRecord {
  scopeKey: string;
  snapshots: StatusRateLimitSnapshot[];
  capturedAt: string;
  source: "usage_endpoint" | "response_headers";
  lastError?: string;
}

interface StatusRateLimitCacheFile {
  version: 1;
  entries: Record<string, StatusRateLimitCacheRecord>;
}

interface StatusRateLimitStatusPayload {
  plan_type?: string;
  rate_limit?: {
    primary_window?: {
      used_percent?: number;
      limit_window_seconds?: number;
      reset_at?: number;
    } | null;
    secondary_window?: {
      used_percent?: number;
      limit_window_seconds?: number;
      reset_at?: number;
    } | null;
  } | null;
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: string | null;
  } | null;
  additional_rate_limits?: Array<{
    limit_name?: string;
    metered_feature?: string;
    rate_limit?: {
      primary_window?: {
        used_percent?: number;
        limit_window_seconds?: number;
        reset_at?: number;
      } | null;
      secondary_window?: {
        used_percent?: number;
        limit_window_seconds?: number;
        reset_at?: number;
      } | null;
    } | null;
  }> | null;
}

export interface StatusRateLimitDisplayRow {
  label: string;
  bar: string;
  summary: string;
  resetsAt?: string;
}

export interface StatusRateLimitDisplayView {
  availability: "available" | "stale" | "unavailable" | "missing" | "error";
  rows: StatusRateLimitDisplayRow[];
  capturedAt?: string;
  planType?: string;
  error?: string;
}

const STATUS_RATE_LIMIT_CACHE_FILE = "openai-rate-limits.json";
const STATUS_RATE_LIMIT_CACHE_VERSION = 1;
const STATUS_LIMIT_BAR_SEGMENTS = 20;
const STATUS_RATE_LIMIT_STALE_THRESHOLD_MS = 15 * 60 * 1000;

function compactRateLimitErrorMessage(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }
  return `${normalized.slice(0, 157).trimEnd()}...`;
}

function resolveStatusRateLimitCachePath(fallbackDir = process.cwd()): string {
  return `${resolveCacheDir(fallbackDir)}/${STATUS_RATE_LIMIT_CACHE_FILE}`;
}

function normalizeLimitId(name: string): string {
  return name.trim().toLowerCase().replace(/-/gu, "_");
}

function parseHeaderNumber(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name)?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHeaderBoolean(headers: Headers, name: string): boolean | undefined {
  const raw = headers.get(name)?.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  return undefined;
}

function parseHeaderWindow(
  headers: Headers,
  prefix: string,
  suffix: "primary" | "secondary",
): StatusRateLimitWindowSnapshot | undefined {
  const usedPercent = parseHeaderNumber(headers, `${prefix}-${suffix}-used-percent`);
  const windowDurationMins = parseHeaderNumber(headers, `${prefix}-${suffix}-window-minutes`);
  const resetsAt = parseHeaderNumber(headers, `${prefix}-${suffix}-reset-at`);
  const hasData = usedPercent !== undefined || windowDurationMins !== undefined || resetsAt !== undefined;
  if (!hasData) {
    return undefined;
  }
  return {
    usedPercent: usedPercent ?? 0,
    windowDurationMins,
    resetsAt,
  };
}

function parseCreditsFromHeaders(headers: Headers): StatusRateLimitCreditsSnapshot | undefined {
  const hasCredits = parseHeaderBoolean(headers, "x-codex-credits-has-credits");
  const unlimited = parseHeaderBoolean(headers, "x-codex-credits-unlimited");
  if (hasCredits === undefined || unlimited === undefined) {
    return undefined;
  }
  const balance = headers.get("x-codex-credits-balance")?.trim() ?? undefined;
  return {
    hasCredits,
    unlimited,
    balance: balance && balance.length > 0 ? balance : undefined,
  };
}

function parseSnapshotsFromHeaders(
  headers: Headers,
  capturedAt: string,
): StatusRateLimitSnapshot[] {
  const snapshots: StatusRateLimitSnapshot[] = [];
  const planType = headers.get("x-codex-plan-type")?.trim() ?? undefined;
  const primary = parseHeaderWindow(headers, "x-codex", "primary");
  const secondary = parseHeaderWindow(headers, "x-codex", "secondary");
  const credits = parseCreditsFromHeaders(headers);
  if (primary || secondary || credits) {
    snapshots.push({
      limitId: "codex",
      primary,
      secondary,
      credits,
      planType,
      capturedAt,
      source: "response_headers",
    });
  }
  return snapshots;
}

function mapPayloadWindow(
  input: {
    used_percent?: number;
    limit_window_seconds?: number;
    reset_at?: number;
  } | null | undefined,
): StatusRateLimitWindowSnapshot | undefined {
  if (!input) {
    return undefined;
  }
  const usedPercent = typeof input.used_percent === "number" ? input.used_percent : undefined;
  const windowDurationMins = typeof input.limit_window_seconds === "number"
    ? Math.round(input.limit_window_seconds / 60)
    : undefined;
  const resetsAt = typeof input.reset_at === "number" ? input.reset_at : undefined;
  const hasData = usedPercent !== undefined || windowDurationMins !== undefined || resetsAt !== undefined;
  if (!hasData) {
    return undefined;
  }
  return {
    usedPercent: usedPercent ?? 0,
    windowDurationMins,
    resetsAt,
  };
}

function parseSnapshotsFromUsagePayload(
  payload: StatusRateLimitStatusPayload,
  capturedAt: string,
): StatusRateLimitSnapshot[] {
  const snapshots: StatusRateLimitSnapshot[] = [];
  const primaryCredits = payload.credits
    ? {
        hasCredits: Boolean(payload.credits.has_credits),
        unlimited: Boolean(payload.credits.unlimited),
        balance: typeof payload.credits.balance === "string" && payload.credits.balance.trim().length > 0
          ? payload.credits.balance.trim()
          : undefined,
      } satisfies StatusRateLimitCreditsSnapshot
    : undefined;
  const primarySnapshot: StatusRateLimitSnapshot = {
    limitId: "codex",
    primary: mapPayloadWindow(payload.rate_limit?.primary_window),
    secondary: mapPayloadWindow(payload.rate_limit?.secondary_window),
    credits: primaryCredits,
    planType: typeof payload.plan_type === "string" ? payload.plan_type : undefined,
    capturedAt,
    source: "usage_endpoint",
  };
  if (primarySnapshot.primary || primarySnapshot.secondary || primarySnapshot.credits) {
    snapshots.push(primarySnapshot);
  }
  for (const entry of payload.additional_rate_limits ?? []) {
    const limitId = typeof entry.metered_feature === "string" && entry.metered_feature.trim().length > 0
      ? normalizeLimitId(entry.metered_feature)
      : undefined;
    if (!limitId) {
      continue;
    }
    const snapshot: StatusRateLimitSnapshot = {
      limitId,
      limitName: typeof entry.limit_name === "string" && entry.limit_name.trim().length > 0
        ? entry.limit_name.trim()
        : undefined,
      primary: mapPayloadWindow(entry.rate_limit?.primary_window),
      secondary: mapPayloadWindow(entry.rate_limit?.secondary_window),
      planType: typeof payload.plan_type === "string" ? payload.plan_type : undefined,
      capturedAt,
      source: "usage_endpoint",
    };
    if (snapshot.primary || snapshot.secondary) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

function selectPrimarySnapshot(
  snapshots: StatusRateLimitSnapshot[],
): StatusRateLimitSnapshot | undefined {
  return snapshots.find((entry) => entry.limitId === "codex") ?? snapshots[0];
}

function formatResetTimestamp(timestampSeconds: number, capturedAt: Date): string {
  const resetDate = new Date(timestampSeconds * 1000);
  const time = resetDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const sameDay = resetDate.getFullYear() === capturedAt.getFullYear()
    && resetDate.getMonth() === capturedAt.getMonth()
    && resetDate.getDate() === capturedAt.getDate();
  if (sameDay) {
    return time;
  }
  const dayMonth = resetDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${time} on ${dayMonth}`;
}

function displayLabelForWindow(windowDurationMins?: number, fallback = "Limit"): string {
  if (windowDurationMins === 300) {
    return "5h limit";
  }
  if (windowDurationMins === 10080) {
    return "Weekly limit";
  }
  if (typeof windowDurationMins === "number" && windowDurationMins > 0) {
    if (windowDurationMins % 60 === 0 && windowDurationMins < 60 * 24 * 7) {
      return `${windowDurationMins / 60}h limit`;
    }
    if (windowDurationMins === 1440) {
      return "Daily limit";
    }
  }
  return fallback;
}

export function renderStatusLimitProgressBar(percentRemaining: number): string {
  const ratio = Math.max(0, Math.min(100, percentRemaining)) / 100;
  const filled = Math.min(STATUS_LIMIT_BAR_SEGMENTS, Math.round(ratio * STATUS_LIMIT_BAR_SEGMENTS));
  const empty = Math.max(0, STATUS_LIMIT_BAR_SEGMENTS - filled);
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

export function formatStatusLimitSummary(percentRemaining: number): string {
  return `${Math.round(percentRemaining)}% left`;
}

function scopeKeyForConfig(config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "accountId" | "defaultHeaders">): string {
  const accountId = typeof config.defaultHeaders?.["chatgpt-account-id"] === "string"
    ? config.defaultHeaders["chatgpt-account-id"]
    : config.accountId ?? "";
  return `${config.authMode}:${config.baseURL}:${accountId}`;
}

export function readCachedStatusRateLimitRecord(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "accountId" | "defaultHeaders">,
  fallbackDir = process.cwd(),
): StatusRateLimitCacheRecord | null {
  const filePath = resolveStatusRateLimitCachePath(fallbackDir);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<StatusRateLimitCacheFile>;
    const entries = parsed.entries;
    if (!entries || typeof entries !== "object") {
      return null;
    }
    const record = entries[scopeKeyForConfig(config)];
    return record ?? null;
  } catch {
    return null;
  }
}

export function writeCachedStatusRateLimitRecord(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL" | "accountId" | "defaultHeaders">,
  record: Omit<StatusRateLimitCacheRecord, "scopeKey">,
  fallbackDir = process.cwd(),
): void {
  const filePath = resolveStatusRateLimitCachePath(fallbackDir);
  const existing = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as Partial<StatusRateLimitCacheFile>
    : { version: STATUS_RATE_LIMIT_CACHE_VERSION, entries: {} };
  const entries: Record<string, StatusRateLimitCacheRecord> =
    existing.entries && typeof existing.entries === "object"
      ? existing.entries as Record<string, StatusRateLimitCacheRecord>
      : {};
  entries[scopeKeyForConfig(config)] = {
    ...record,
    scopeKey: scopeKeyForConfig(config),
  };
  mkdirSync(resolveCacheDir(fallbackDir), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify({
    version: STATUS_RATE_LIMIT_CACHE_VERSION,
    entries,
  }, null, 2)}\n`, "utf8");
}

function assertChatgptRateLimitConfig(config: OpenAILiveConfig): void {
  if (config.authMode !== "chatgpt_oauth" || !isChatgptCodexBackendBaseURL(config.baseURL)) {
    throw new Error("Official ChatGPT Codex auth is required to read subscription usage limits.");
  }
}

function buildCommonHeaders(config: OpenAILiveConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "User-Agent": "codex-cli/0.120.0",
    ...(config.defaultHeaders ?? {}),
  };
}

async function fetchUsageEndpointSnapshots(config: OpenAILiveConfig): Promise<StatusRateLimitSnapshot[]> {
  const url = new URL(`${config.baseURL.replace(/\/$/u, "")}/wham/usage`);
  url.searchParams.set("client_version", CHATGPT_BACKEND_CLIENT_VERSION);
  const response = await fetch(url, {
    headers: buildCommonHeaders(config),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GET ${url} failed: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as StatusRateLimitStatusPayload;
  return parseSnapshotsFromUsagePayload(payload, new Date().toISOString());
}

async function fetchResponseHeaderSnapshots(config: OpenAILiveConfig): Promise<StatusRateLimitSnapshot[]> {
  const url = new URL(`${config.baseURL.replace(/\/$/u, "")}/responses`);
  url.searchParams.set("client_version", CHATGPT_BACKEND_CLIENT_VERSION);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildCommonHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      instructions: "Reply exactly OK.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "OK",
            },
          ],
        },
      ],
      stream: true,
      store: false,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`POST ${url} failed: ${response.status} ${detail || response.statusText}`);
  }
  const snapshots = parseSnapshotsFromHeaders(response.headers, new Date().toISOString());
  try {
    const reader = response.body?.getReader();
    await reader?.cancel();
  } catch {
    // ignore cancellation failures
  }
  return snapshots;
}

export async function refreshStatusRateLimitRecord(
  config: OpenAILiveConfig = loadOpenAILiveConfig("core.main"),
  fallbackDir = process.cwd(),
): Promise<StatusRateLimitCacheRecord> {
  assertChatgptRateLimitConfig(config);
  let snapshots: StatusRateLimitSnapshot[] = [];
  let source: StatusRateLimitCacheRecord["source"] = "usage_endpoint";
  let lastError: string | undefined;
  try {
    snapshots = await fetchUsageEndpointSnapshots(config);
    source = "usage_endpoint";
  } catch (error) {
    lastError = compactRateLimitErrorMessage(error instanceof Error ? error.message : String(error));
    snapshots = await fetchResponseHeaderSnapshots(config);
    source = "response_headers";
  }
  const capturedAt = new Date().toISOString();
  const record: StatusRateLimitCacheRecord = {
    scopeKey: scopeKeyForConfig(config),
    snapshots: snapshots.map((snapshot) => ({
      ...snapshot,
      capturedAt,
      source,
    })),
    capturedAt,
    source,
    lastError,
  };
  writeCachedStatusRateLimitRecord(config, record, fallbackDir);
  return record;
}

export function composeStatusRateLimitDisplayView(
  record: StatusRateLimitCacheRecord | null,
  now = new Date(),
): StatusRateLimitDisplayView {
  if (!record) {
    return {
      availability: "missing",
      rows: [],
    };
  }
  const primary = selectPrimarySnapshot(record.snapshots);
  if (!primary) {
    return {
      availability: record.lastError ? "error" : "unavailable",
      rows: [],
      capturedAt: record.capturedAt,
      error: record.lastError,
    };
  }
  const rows: StatusRateLimitDisplayRow[] = [];
  for (const [window, fallbackLabel] of [
    [primary.primary, "5h limit"],
    [primary.secondary, "Weekly limit"],
  ] as const) {
    if (!window) {
      continue;
    }
    const percentRemaining = 100 - window.usedPercent;
    rows.push({
      label: displayLabelForWindow(window.windowDurationMins, fallbackLabel),
      bar: renderStatusLimitProgressBar(percentRemaining),
      summary: formatStatusLimitSummary(percentRemaining),
      resetsAt: typeof window.resetsAt === "number"
        ? formatResetTimestamp(window.resetsAt, now)
        : undefined,
    });
  }
  const capturedAt = new Date(record.capturedAt);
  const stale = Number.isFinite(capturedAt.getTime())
    ? now.getTime() - capturedAt.getTime() > STATUS_RATE_LIMIT_STALE_THRESHOLD_MS
    : false;
  return {
    availability: rows.length === 0
      ? (record.lastError ? "error" : "unavailable")
      : (stale ? "stale" : "available"),
    rows,
    capturedAt: record.capturedAt,
    planType: primary.planType,
    error: record.lastError,
  };
}
