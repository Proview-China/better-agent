import {
  createCmpProjectDbBootstrapReceipt,
  createCmpProjectDbBootstrapContract,
  type CmpProjectDbBootstrapContract,
  type CmpProjectDbBootstrapReceipt,
  type CmpDbPsqlLiveExecutor,
} from "../cmp-db/index.js";
import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepoBootstrapPlan,
  type CmpGitAgentBranchRuntime,
  type CmpGitBackend,
  type CmpGitBackendBootstrapReceipt,
  type CmpGitLineageNode,
  type CmpGitProjectRepoBootstrapPlan,
} from "../cmp-git/index.js";
import {
  createCmpRedisProjectBootstrap,
  type CmpRedisMqAdapter,
  type CmpRedisProjectBootstrap,
} from "../cmp-mq/index.js";

export interface CmpInfraBootstrapAgentInput {
  agentId: string;
  parentAgentId?: string;
  depth?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpProjectInfraBootstrapPlanInput {
  projectId: string;
  repoName: string;
  repoRootPath: string;
  agents: readonly CmpInfraBootstrapAgentInput[];
  defaultAgentId?: string;
  defaultBranchName?: string;
  worktreeRootPath?: string;
  databaseName?: string;
  dbSchemaName?: string;
  redisNamespaceRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpProjectInfraBootstrapPlan {
  git: CmpGitProjectRepoBootstrapPlan;
  db: CmpProjectDbBootstrapContract;
  mqBootstraps: CmpRedisProjectBootstrap[];
  lineages: CmpGitLineageNode[];
  branchRuntimes: CmpGitAgentBranchRuntime[];
  metadata?: Record<string, unknown>;
}

export interface ExecuteCmpProjectInfraBootstrapInput {
  plan: CmpProjectInfraBootstrapPlan;
  gitBackend: CmpGitBackend;
  dbExecutor?: CmpDbPsqlLiveExecutor;
  mqAdapter: CmpRedisMqAdapter;
}

export interface CmpProjectInfraBootstrapReceipt {
  git: CmpGitBackendBootstrapReceipt;
  gitBranchBootstraps: {
    agentId: string;
    createdBranchNames: readonly string[];
  }[];
  db: CmpProjectDbBootstrapContract;
  dbReceipt: CmpProjectDbBootstrapReceipt;
  mqBootstraps: CmpRedisProjectBootstrap[];
  lineages: CmpGitLineageNode[];
  branchRuntimes: CmpGitAgentBranchRuntime[];
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeAgents(
  agents: readonly CmpInfraBootstrapAgentInput[],
): CmpInfraBootstrapAgentInput[] {
  const normalized = agents.map((agent) => ({
    agentId: assertNonEmpty(agent.agentId, "CMP infra bootstrap agentId"),
    parentAgentId: agent.parentAgentId?.trim() || undefined,
    depth: agent.depth,
    metadata: agent.metadata,
  }));
  if (normalized.length === 0) {
    throw new Error("CMP infra bootstrap requires at least one agent.");
  }
  return normalized;
}

export function createCmpProjectInfraBootstrapPlan(
  input: CreateCmpProjectInfraBootstrapPlanInput,
): CmpProjectInfraBootstrapPlan {
  const agents = normalizeAgents(input.agents);
  const git = createCmpGitProjectRepoBootstrapPlan({
    projectId: input.projectId,
    repoName: input.repoName,
    repoRootPath: input.repoRootPath,
    defaultAgentId: input.defaultAgentId ?? agents[0]?.agentId,
    defaultBranchName: input.defaultBranchName,
    worktreeRootPath: input.worktreeRootPath,
    metadata: input.metadata,
  });

  const lineages = agents.map((agent) => createCmpGitLineageNode({
    projectId: input.projectId,
    agentId: agent.agentId,
    parentAgentId: agent.parentAgentId,
    depth: agent.depth,
    metadata: agent.metadata,
  }));

  const branchRuntimes = lineages.map((lineage) => createCmpGitAgentBranchRuntime({
    projectRepo: git.projectRepo,
    lineage,
    repoRootPath: git.repoRootPath,
    worktreeRootPath: git.worktreeRootPath,
    metadata: input.metadata,
  }));

  const db = createCmpProjectDbBootstrapContract({
    projectId: input.projectId,
    agentIds: agents.map((agent) => agent.agentId),
    databaseName: input.databaseName,
    schemaName: input.dbSchemaName,
    metadata: input.metadata,
  });

  const mqBootstraps = agents.map((agent) => createCmpRedisProjectBootstrap({
    projectId: input.projectId,
    agentId: agent.agentId,
    namespaceRoot: input.redisNamespaceRoot,
    metadata: input.metadata,
  }));

  return {
    git,
    db,
    mqBootstraps,
    lineages,
    branchRuntimes,
    metadata: input.metadata,
  };
}

export async function executeCmpProjectInfraBootstrap(
  input: ExecuteCmpProjectInfraBootstrapInput,
): Promise<CmpProjectInfraBootstrapReceipt> {
  const git = await input.gitBackend.bootstrapProjectRepo(input.plan.git);
  const gitBranchBootstraps = await Promise.all(input.plan.branchRuntimes.map(async (runtime) => ({
    agentId: runtime.agentId,
    createdBranchNames: await input.gitBackend.bootstrapAgentBranchRuntime(runtime),
  })));
  const mqBootstraps = await Promise.all(input.plan.mqBootstraps.map((bootstrap) => input.mqAdapter.bootstrapProject({
    projectId: bootstrap.projectId,
    agentId: bootstrap.agentId,
    namespaceRoot: bootstrap.namespace.namespaceRoot,
    metadata: bootstrap.metadata,
  })));
  const dbReceipt = input.dbExecutor
    ? (await input.dbExecutor.executeBootstrapContract(input.plan.db)).receipt
    : createCmpProjectDbBootstrapReceipt({
      contract: input.plan.db,
    });

  return {
    git,
    gitBranchBootstraps,
    db: input.plan.db,
    dbReceipt,
    mqBootstraps,
    lineages: input.plan.lineages,
    branchRuntimes: input.plan.branchRuntimes,
    metadata: input.plan.metadata,
  };
}
