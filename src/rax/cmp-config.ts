import type {
  RaxCmpDatabaseConfig,
  RaxCmpGitInfraConfig,
  RaxCmpMode,
  RaxCmpMqConfig,
} from "./cmp-types.js";

export interface RaxCmpConfig {
  projectId: string;
  profileId: string;
  defaultAgentId: string;
  mode: RaxCmpMode;
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

