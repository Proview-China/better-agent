import {
  createCmpAgentLocalTableSet,
  createCmpDbPostgresAdapter,
  createCmpProjectDbBootstrapReceipt,
  createCmpProjectDbBootstrapContract,
  type CmpAgentLocalTableSet,
  type CmpDbContextPackageRecord,
  type CmpDbDeliveryRegistryRecord,
  type CmpDbPostgresAdapter,
  type CmpDbPsqlLiveExecutor,
  type CmpProjectDbBootstrapContract,
  type CmpProjectDbBootstrapReceipt,
  type CmpProjectDbReadbackRowInput,
  type CmpProjectDbTopology,
  type CmpProjectionRecord,
} from "../agent_core/cmp-db/index.js";
import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepoBootstrapPlan,
  type CmpGitAgentBranchRuntime,
  type CmpGitBackend,
  type CmpGitBackendBootstrapReceipt,
  type CmpGitLineageNode,
  type CmpGitProjectRepoBootstrapInput,
  type CmpGitProjectRepoBootstrapPlan,
  type CmpGitRefReadback,
} from "../agent_core/cmp-git/index.js";
import {
  type BootstrapCmpRedisProjectInput,
  type CmpCriticalEscalationEnvelope,
  type CmpIcmaPublishEnvelope,
  type CmpRedisEscalationReceipt,
  type CmpRedisMqAdapter,
  type CmpRedisProjectBootstrap,
  type CmpRedisPublishReceipt,
  createCmpRedisProjectBootstrap,
} from "../agent_core/cmp-mq/index.js";

export type CmpConnectorOwnership = "shared_infra";

export interface CmpSharedInfraConnectorMetadata {
  ownership: CmpConnectorOwnership;
  scope: "multi_agent_system";
  notes?: string;
}

export interface CmpWorkflowAgentInput {
  agentId: string;
  parentAgentId?: string;
  depth?: number;
  metadata?: Record<string, unknown>;
}

export interface CmpSharedGitInfraConnector {
  readonly kind: "shared_git_infra";
  readonly metadata: CmpSharedInfraConnectorMetadata;
  readonly backend: CmpGitBackend;
  createProjectBootstrapPlan(
    input: CmpGitProjectRepoBootstrapInput,
  ): CmpGitProjectRepoBootstrapPlan;
  createLineages(input: {
    projectId: string;
    agents: readonly CmpWorkflowAgentInput[];
  }): CmpGitLineageNode[];
  createBranchRuntimes(input: {
    plan: CmpGitProjectRepoBootstrapPlan;
    lineages: readonly CmpGitLineageNode[];
  }): CmpGitAgentBranchRuntime[];
  bootstrapProject(
    plan: CmpGitProjectRepoBootstrapPlan,
  ): Promise<CmpGitBackendBootstrapReceipt>;
  bootstrapBranchRuntimes(
    runtimes: readonly CmpGitAgentBranchRuntime[],
  ): Promise<Array<{ agentId: string; createdBranchNames: readonly string[] }>>;
  readBranchRuntime(runtime: CmpGitAgentBranchRuntime): Promise<CmpGitRefReadback>;
  writeCheckedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback>;
  writePromotedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback>;
}

export interface CmpPostgresConnector {
  readonly kind: "shared_postgresql";
  readonly metadata: CmpSharedInfraConnectorMetadata;
  readonly executor?: CmpDbPsqlLiveExecutor;
  createBootstrapContract(input: {
    projectId: string;
    agentIds: readonly string[];
    databaseName?: string;
    schemaName?: string;
    metadata?: Record<string, unknown>;
  }): CmpProjectDbBootstrapContract;
  createLocalTableSets(input: {
    projectId: string;
    schemaName: string;
    agentIds: readonly string[];
  }): CmpAgentLocalTableSet[];
  createAdapter(input: {
    topology: CmpProjectDbTopology;
    localTableSets: readonly CmpAgentLocalTableSet[];
  }): CmpDbPostgresAdapter;
  executeBootstrap(
    contract: CmpProjectDbBootstrapContract,
  ): Promise<{
    receipt: CmpProjectDbBootstrapReceipt;
    bootstrapExecutions: readonly unknown[];
    readbackExecutions: readonly unknown[];
  }>;
  createBootstrapReceiptFromReadback(input: {
    contract: CmpProjectDbBootstrapContract;
    readbackRows?: readonly CmpProjectDbReadbackRowInput[];
  }): CmpProjectDbBootstrapReceipt;
  buildProjectionUpsert(
    adapter: CmpDbPostgresAdapter,
    record: CmpProjectionRecord,
  ): ReturnType<CmpDbPostgresAdapter["buildProjectionUpsert"]>;
  buildContextPackageUpsert(
    adapter: CmpDbPostgresAdapter,
    record: CmpDbContextPackageRecord,
  ): ReturnType<CmpDbPostgresAdapter["buildContextPackageUpsert"]>;
  buildDeliveryUpsert(
    adapter: CmpDbPostgresAdapter,
    record: CmpDbDeliveryRegistryRecord,
  ): ReturnType<CmpDbPostgresAdapter["buildDeliveryUpsert"]>;
}

export interface CmpRedisConnector {
  readonly kind: "shared_redis";
  readonly metadata: CmpSharedInfraConnectorMetadata;
  readonly adapter: CmpRedisMqAdapter;
  createProjectBootstrap(input: BootstrapCmpRedisProjectInput): CmpRedisProjectBootstrap;
  bootstrapProject(input: BootstrapCmpRedisProjectInput): Promise<CmpRedisProjectBootstrap>;
  readProjectBootstrap(params: {
    projectId: string;
    agentId: string;
  }): Promise<CmpRedisProjectBootstrap | undefined>;
  publishEnvelope(input: {
    envelope: CmpIcmaPublishEnvelope;
  }): Promise<CmpRedisPublishReceipt>;
  publishCriticalEscalation(input: {
    envelope: CmpCriticalEscalationEnvelope;
  }): Promise<CmpRedisEscalationReceipt>;
}

export interface CmpSharedInfraConnectors {
  git: CmpSharedGitInfraConnector;
  db: CmpPostgresConnector;
  mq: CmpRedisConnector;
}

function normalizeAgents(agents: readonly CmpWorkflowAgentInput[]): CmpWorkflowAgentInput[] {
  const normalized = agents.map((agent) => ({
    agentId: agent.agentId.trim(),
    parentAgentId: agent.parentAgentId?.trim() || undefined,
    depth: agent.depth,
    metadata: agent.metadata,
  }));
  if (normalized.length === 0) {
    throw new Error("CMP shared connector requires at least one agent.");
  }
  return normalized;
}

async function awaitMaybe<T>(value: Promise<T> | T): Promise<T> {
  return value;
}

export function createCmpSharedGitInfraConnector(input: {
  backend: CmpGitBackend;
  notes?: string;
}): CmpSharedGitInfraConnector {
  const metadata: CmpSharedInfraConnectorMetadata = {
    ownership: "shared_infra",
    scope: "multi_agent_system",
    notes: input.notes ?? "Shared git_infra connector for CMP workflow integration.",
  };

  return {
    kind: "shared_git_infra",
    metadata,
    backend: input.backend,
    createProjectBootstrapPlan(planInput) {
      return createCmpGitProjectRepoBootstrapPlan(planInput);
    },
    createLineages(params) {
      return normalizeAgents(params.agents).map((agent) =>
        createCmpGitLineageNode({
          projectId: params.projectId,
          agentId: agent.agentId,
          parentAgentId: agent.parentAgentId,
          depth: agent.depth,
          metadata: agent.metadata,
        }),
      );
    },
    createBranchRuntimes(params) {
      return params.lineages.map((lineage) =>
        createCmpGitAgentBranchRuntime({
          projectRepo: params.plan.projectRepo,
          lineage,
          repoRootPath: params.plan.repoRootPath,
          worktreeRootPath: params.plan.worktreeRootPath,
          metadata: params.plan.metadata,
        }),
      );
    },
    async bootstrapProject(plan) {
      return await awaitMaybe(input.backend.bootstrapProjectRepo(plan));
    },
    async bootstrapBranchRuntimes(runtimes) {
      const results: Array<{ agentId: string; createdBranchNames: readonly string[] }> = [];
      for (const runtime of runtimes) {
        results.push({
          agentId: runtime.agentId,
          createdBranchNames: await awaitMaybe(input.backend.bootstrapAgentBranchRuntime(runtime)),
        });
      }
      return results;
    },
    async readBranchRuntime(runtime) {
      return await awaitMaybe(input.backend.readBranchHead(runtime));
    },
    async writeCheckedRef(runtime, commitSha) {
      return await awaitMaybe(input.backend.writeCheckedRef(runtime, commitSha));
    },
    async writePromotedRef(runtime, commitSha) {
      return await awaitMaybe(input.backend.writePromotedRef(runtime, commitSha));
    },
  };
}

export function createCmpPostgresConnector(input: {
  executor?: CmpDbPsqlLiveExecutor;
  notes?: string;
} = {}): CmpPostgresConnector {
  const metadata: CmpSharedInfraConnectorMetadata = {
    ownership: "shared_infra",
    scope: "multi_agent_system",
    notes: input.notes ?? "Shared PostgreSQL connector for CMP workflow integration.",
  };

  return {
    kind: "shared_postgresql",
    metadata,
    executor: input.executor,
    createBootstrapContract(params) {
      return createCmpProjectDbBootstrapContract(params);
    },
    createLocalTableSets(params) {
      return [...new Set(params.agentIds.map((agentId) => agentId.trim()).filter(Boolean))].map((agentId) =>
        createCmpAgentLocalTableSet({
          projectId: params.projectId,
          schemaName: params.schemaName,
          agentId,
        }),
      );
    },
    createAdapter(params) {
      return createCmpDbPostgresAdapter(params);
    },
    async executeBootstrap(contract) {
      if (!input.executor) {
        throw new Error("CMP shared PostgreSQL connector has no live executor configured.");
      }
      return await input.executor.executeBootstrapContract(contract);
    },
    createBootstrapReceiptFromReadback(params) {
      return createCmpProjectDbBootstrapReceipt({
        contract: params.contract,
        readbackRows: params.readbackRows,
      });
    },
    buildProjectionUpsert(adapter, record) {
      return adapter.buildProjectionUpsert(record);
    },
    buildContextPackageUpsert(adapter, record) {
      return adapter.buildContextPackageUpsert(record);
    },
    buildDeliveryUpsert(adapter, record) {
      return adapter.buildDeliveryUpsert(record);
    },
  };
}

export function createCmpRedisConnector(input: {
  adapter: CmpRedisMqAdapter;
  notes?: string;
}): CmpRedisConnector {
  const metadata: CmpSharedInfraConnectorMetadata = {
    ownership: "shared_infra",
    scope: "multi_agent_system",
    notes: input.notes ?? "Shared Redis connector for CMP workflow integration.",
  };

  return {
    kind: "shared_redis",
    metadata,
    adapter: input.adapter,
    createProjectBootstrap(params) {
      return {
        ...createCmpRedisProjectBootstrap(params),
      };
    },
    async bootstrapProject(params) {
      return await awaitMaybe(input.adapter.bootstrapProject(params));
    },
    async readProjectBootstrap(params) {
      return await awaitMaybe(input.adapter.readProjectBootstrap(params));
    },
    async publishEnvelope(params) {
      return await awaitMaybe(input.adapter.publishEnvelope(params));
    },
    async publishCriticalEscalation(params) {
      return await awaitMaybe(input.adapter.publishCriticalEscalation(params));
    },
  };
}

export function createCmpSharedInfraConnectors(input: {
  gitBackend: CmpGitBackend;
  dbExecutor?: CmpDbPsqlLiveExecutor;
  mqAdapter: CmpRedisMqAdapter;
}): CmpSharedInfraConnectors {
  return {
    git: createCmpSharedGitInfraConnector({
      backend: input.gitBackend,
    }),
    db: createCmpPostgresConnector({
      executor: input.dbExecutor,
    }),
    mq: createCmpRedisConnector({
      adapter: input.mqAdapter,
    }),
  };
}
