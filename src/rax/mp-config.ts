import type { MpScopeLevel } from "../agent_core/index.js";
import type { RaxMpLanceConfig, RaxMpMode, RaxMpSearchDefaults } from "./mp-types.js";

export interface RaxMpConfig {
  projectId: string;
  profileId: string;
  defaultAgentId: string;
  mode: RaxMpMode;
  lance: RaxMpLanceConfig;
  searchDefaults: RaxMpSearchDefaults;
  metadata?: Record<string, unknown>;
}

export interface CreateRaxMpConfigInput {
  projectId: string;
  profileId?: string;
  defaultAgentId?: string;
  mode?: RaxMpMode;
  lance?: Partial<Omit<RaxMpLanceConfig, "kind">> & Pick<RaxMpLanceConfig, "rootPath">;
  searchDefaults?: Partial<RaxMpSearchDefaults>;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_RAX_MP_PROFILE_ID = "mp.default";
export const DEFAULT_RAX_MP_MODE: RaxMpMode = "balanced";
export const DEFAULT_RAX_MP_DEFAULT_AGENT_ID = "main";
export const DEFAULT_RAX_MP_SCHEMA_VERSION = 1;
export const DEFAULT_RAX_MP_SEARCH_LIMIT = 10;
export const DEFAULT_RAX_MP_SCOPE_LEVELS: MpScopeLevel[] = [
  "agent_isolated",
  "project",
  "global",
];

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeScopeLevels(scopeLevels?: MpScopeLevel[]): MpScopeLevel[] {
  const normalized = [...new Set((scopeLevels ?? DEFAULT_RAX_MP_SCOPE_LEVELS).filter(Boolean))];
  if (normalized.length === 0) {
    throw new Error("RAX MP searchDefaults.scopeLevels requires at least one scope level.");
  }
  return normalized;
}

export function createRaxMpConfig(input: CreateRaxMpConfigInput): RaxMpConfig {
  return {
    projectId: assertNonEmpty(input.projectId, "RAX MP projectId"),
    profileId: input.profileId?.trim() || DEFAULT_RAX_MP_PROFILE_ID,
    defaultAgentId: input.defaultAgentId?.trim() || DEFAULT_RAX_MP_DEFAULT_AGENT_ID,
    mode: input.mode ?? DEFAULT_RAX_MP_MODE,
    lance: {
      kind: "lancedb",
      rootPath: assertNonEmpty(
        input.lance?.rootPath ?? `/tmp/praxis/mp/${input.projectId}`,
        "RAX MP lance.rootPath",
      ),
      schemaVersion: input.lance?.schemaVersion ?? DEFAULT_RAX_MP_SCHEMA_VERSION,
      liveExecutionPreferred: input.lance?.liveExecutionPreferred ?? true,
      metadata: input.lance?.metadata,
    },
    searchDefaults: {
      limit: input.searchDefaults?.limit ?? DEFAULT_RAX_MP_SEARCH_LIMIT,
      scopeLevels: normalizeScopeLevels(input.searchDefaults?.scopeLevels),
      preferSameAgent: input.searchDefaults?.preferSameAgent ?? true,
      metadata: input.searchDefaults?.metadata,
    },
    metadata: input.metadata,
  };
}

export function loadRaxMpConfigFromEnv(
  source: Record<string, string | undefined> = process.env,
): RaxMpConfig {
  return createRaxMpConfig({
    projectId: assertNonEmpty(source.PRAXIS_MP_PROJECT_ID ?? "", "PRAXIS_MP_PROJECT_ID"),
    profileId: source.PRAXIS_MP_PROFILE_ID,
    defaultAgentId: source.PRAXIS_MP_DEFAULT_AGENT_ID,
    mode: source.PRAXIS_MP_MODE as RaxMpMode | undefined,
    lance: {
      rootPath: assertNonEmpty(source.PRAXIS_MP_ROOT_PATH ?? "", "PRAXIS_MP_ROOT_PATH"),
      schemaVersion: source.PRAXIS_MP_SCHEMA_VERSION
        ? Number(source.PRAXIS_MP_SCHEMA_VERSION)
        : undefined,
      liveExecutionPreferred: source.PRAXIS_MP_LIVE !== "0",
    },
    searchDefaults: {
      limit: source.PRAXIS_MP_SEARCH_LIMIT ? Number(source.PRAXIS_MP_SEARCH_LIMIT) : undefined,
      scopeLevels: source.PRAXIS_MP_SCOPE_LEVELS
        ? source.PRAXIS_MP_SCOPE_LEVELS.split(",")
          .map((value) => value.trim())
          .filter(Boolean) as MpScopeLevel[]
        : undefined,
      preferSameAgent: source.PRAXIS_MP_PREFER_SAME_AGENT !== "0",
    },
  });
}
