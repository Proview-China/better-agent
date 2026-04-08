import {
  createInMemoryMpLanceDbAdapter,
  createMpLanceBootstrapPlan,
  createMpLanceTableNames,
  type MpLanceBootstrapPlan,
  type MpLanceBootstrapReceipt,
  type MpLanceDbAdapter,
  type MpScopeLevel,
} from "../agent_core/index.js";

export type MpConnectorOwnership = "shared_infra";

export interface MpSharedInfraConnectorMetadata {
  ownership: MpConnectorOwnership;
  scope: "multi_agent_system";
  notes?: string;
}

export interface MpLanceConnector {
  readonly kind: "shared_lancedb";
  readonly metadata: MpSharedInfraConnectorMetadata;
  readonly adapter: MpLanceDbAdapter;
  createBootstrapPlan(input: {
    projectId: string;
    agentIds: readonly string[];
    rootPath: string;
    schemaVersion?: number;
    metadata?: Record<string, unknown>;
  }): MpLanceBootstrapPlan;
  bootstrapProject(plan: MpLanceBootstrapPlan): Promise<MpLanceBootstrapReceipt>;
  resolveTableName(input: {
    projectId: string;
    agentId: string;
    scopeLevel: MpScopeLevel;
  }): string;
}

export interface MpSharedInfraConnectors {
  lance: MpLanceConnector;
}

async function awaitMaybe<T>(value: Promise<T> | T): Promise<T> {
  return value;
}

export function createMpLanceConnector(input: {
  adapter?: MpLanceDbAdapter;
  notes?: string;
} = {}): MpLanceConnector {
  const adapter = input.adapter ?? createInMemoryMpLanceDbAdapter();
  return {
    kind: "shared_lancedb",
    metadata: {
      ownership: "shared_infra",
      scope: "multi_agent_system",
      notes: input.notes ?? "Shared LanceDB connector for MP runtime integration.",
    },
    adapter,
    createBootstrapPlan(params) {
      return createMpLanceBootstrapPlan(params);
    },
    async bootstrapProject(plan) {
      return await awaitMaybe(adapter.bootstrap(plan));
    },
    resolveTableName(params) {
      const names = createMpLanceTableNames({
        projectId: params.projectId,
        agentId: params.agentId,
      });
      switch (params.scopeLevel) {
        case "global":
          return names.globalMemories;
        case "project":
          return names.projectMemories;
        case "agent_isolated":
          return names.agentMemories ?? "";
      }
    },
  };
}

export function createMpSharedInfraConnectors(input: {
  adapter?: MpLanceDbAdapter;
} = {}): MpSharedInfraConnectors {
  return {
    lance: createMpLanceConnector({
      adapter: input.adapter,
    }),
  };
}
