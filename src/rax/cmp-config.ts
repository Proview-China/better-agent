import type {
  RaxCmpDatabaseConfig,
  RaxCmpGitInfraConfig,
  RaxCmpManualControlInput,
  RaxCmpManualControlSurface,
  RaxCmpMode,
  RaxCmpMqConfig,
} from "./cmp-types.js";
import { createRaxCmpManualControlSurface } from "./cmp-types.js";

export interface RaxCmpConfig {
  projectId: string;
  profileId: string;
  defaultAgentId: string;
  mode: RaxCmpMode;
  controlDefaults: RaxCmpManualControlSurface;
  git: RaxCmpGitInfraConfig;
  db: RaxCmpDatabaseConfig;
  mq: RaxCmpMqConfig;
  metadata?: Record<string, unknown>;
}

export interface CreateRaxCmpConfigInput {
  projectId: string;
  profileId?: string;
  defaultAgentId?: string;
  mode?: RaxCmpMode;
  controlDefaults?: RaxCmpManualControlInput;
  git: Omit<RaxCmpGitInfraConfig, "provider" | "defaultBranchName"> & {
    defaultBranchName?: string;
  };
  db?: Partial<Omit<RaxCmpDatabaseConfig, "kind">> & Pick<RaxCmpDatabaseConfig, "databaseName">;
  mq?: Partial<Omit<RaxCmpMqConfig, "kind">>;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_RAX_CMP_PROFILE_ID = "cmp.default";
export const DEFAULT_RAX_CMP_MODE: RaxCmpMode = "active_preferred";
export const DEFAULT_RAX_CMP_DEFAULT_AGENT_ID = "main";
export const DEFAULT_RAX_CMP_DEFAULT_BRANCH = "main";

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createRaxCmpConfig(input: CreateRaxCmpConfigInput): RaxCmpConfig {
  const projectId = assertNonEmpty(input.projectId, "RAX CMP projectId");
  const repoName = assertNonEmpty(input.git.repoName, "RAX CMP git repoName");
  const repoRootPath = assertNonEmpty(input.git.repoRootPath, "RAX CMP git repoRootPath");
  const databaseName = assertNonEmpty(
    input.db?.databaseName ?? `cmp_${projectId.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`,
    "RAX CMP databaseName",
  );

  return {
    projectId,
    profileId: input.profileId?.trim() || DEFAULT_RAX_CMP_PROFILE_ID,
    defaultAgentId: input.defaultAgentId?.trim() || DEFAULT_RAX_CMP_DEFAULT_AGENT_ID,
    mode: input.mode ?? DEFAULT_RAX_CMP_MODE,
    controlDefaults: createRaxCmpManualControlSurface({
      mode: input.mode ?? DEFAULT_RAX_CMP_MODE,
      ...(input.controlDefaults ?? {}),
    }),
    git: {
      provider: "shared_git_infra",
      repoName,
      repoRootPath,
      defaultBranchName: input.git.defaultBranchName?.trim() || DEFAULT_RAX_CMP_DEFAULT_BRANCH,
      worktreeRootPath: input.git.worktreeRootPath?.trim() || `${repoRootPath}/.cmp-worktrees`,
      metadata: input.git.metadata,
    },
    db: {
      kind: "postgresql",
      databaseName,
      schemaName: input.db?.schemaName?.trim() || undefined,
      liveExecutionPreferred: input.db?.liveExecutionPreferred ?? true,
      metadata: input.db?.metadata,
    },
    mq: {
      kind: "redis",
      namespaceRoot: input.mq?.namespaceRoot?.trim() || "cmp",
      liveExecutionPreferred: input.mq?.liveExecutionPreferred ?? true,
      metadata: input.mq?.metadata,
    },
    metadata: input.metadata,
  };
}

export function loadRaxCmpConfigFromEnv(
  source: Record<string, string | undefined> = process.env,
): RaxCmpConfig {
  const projectId = assertNonEmpty(source.PRAXIS_CMP_PROJECT_ID ?? "", "PRAXIS_CMP_PROJECT_ID");
  const repoRootPath = assertNonEmpty(source.PRAXIS_CMP_REPO_ROOT ?? "", "PRAXIS_CMP_REPO_ROOT");
  return createRaxCmpConfig({
    projectId,
    profileId: source.PRAXIS_CMP_PROFILE_ID,
    defaultAgentId: source.PRAXIS_CMP_DEFAULT_AGENT_ID,
    mode: source.PRAXIS_CMP_MODE as RaxCmpMode | undefined,
    controlDefaults: {
      executionStyle: source.PRAXIS_CMP_EXECUTION_STYLE as
        | "automatic"
        | "guided"
        | "manual"
        | undefined,
      truth: {
        readbackPriority: source.PRAXIS_CMP_READBACK_PRIORITY as
          | "git_first"
          | "db_first"
          | "redis_first"
          | "reconcile"
          | undefined,
        fallbackPolicy: source.PRAXIS_CMP_FALLBACK_POLICY as
          | "git_rebuild"
          | "degraded"
          | "strict_not_found"
          | undefined,
        recoveryPreference: source.PRAXIS_CMP_RECOVERY_PREFERENCE as
          | "snapshot_first"
          | "infra_first"
          | "reconcile"
          | "dry_run"
          | undefined,
      },
      scope: {
        dispatch: source.PRAXIS_CMP_DISPATCH_SCOPE as
          | "lineage_only"
          | "core_agent_only"
          | "manual_targets"
          | "disabled"
          | undefined,
      },
      automation: {
        autoReturnToCoreAgent: source.PRAXIS_CMP_AUTO_RETURN_TO_CORE_AGENT !== "0",
        autoSeedChildren: source.PRAXIS_CMP_AUTO_SEED_CHILDREN !== "0",
      },
    },
    git: {
      repoName: source.PRAXIS_CMP_REPO_NAME?.trim() || projectId,
      repoRootPath,
      defaultBranchName: source.PRAXIS_CMP_GIT_DEFAULT_BRANCH,
      worktreeRootPath: source.PRAXIS_CMP_GIT_WORKTREE_ROOT,
    },
    db: {
      databaseName: source.PRAXIS_CMP_DB_NAME?.trim() || `cmp_${projectId.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`,
      schemaName: source.PRAXIS_CMP_DB_SCHEMA,
      liveExecutionPreferred: source.PRAXIS_CMP_DB_LIVE !== "0",
    },
    mq: {
      namespaceRoot: source.PRAXIS_CMP_REDIS_NAMESPACE_ROOT,
      liveExecutionPreferred: source.PRAXIS_CMP_REDIS_LIVE !== "0",
    },
  });
}
