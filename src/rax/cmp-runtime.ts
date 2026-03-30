import {
  type AgentCoreRuntime,
  createAgentCoreRuntime,
} from "../agent_core/runtime.js";
import {
  createCmpDbPsqlLiveExecutor,
  type CmpDbPsqlLiveExecutor,
} from "../agent_core/cmp-db/index.js";
import {
  createGitCliCmpGitBackend,
  createInMemoryCmpGitBackend,
  type CmpGitBackend,
} from "../agent_core/cmp-git/index.js";
import {
  createInMemoryCmpRedisMqAdapter,
  createRedisCliCmpRedisMqAdapter,
  type CmpRedisMqAdapter,
} from "../agent_core/cmp-mq/index.js";
import { createCmpSharedInfraConnectors, type CmpSharedInfraConnectors } from "./cmp-connectors.js";
import type { RaxCmpConfig } from "./cmp-config.js";
import type { RaxCmpRuntimeLike } from "./cmp-types.js";

export interface CreateRaxCmpRuntimeInput {
  config: RaxCmpConfig;
  runtime?: AgentCoreRuntime;
  connectors?: CmpSharedInfraConnectors;
  gitBackend?: CmpGitBackend;
  dbExecutor?: CmpDbPsqlLiveExecutor;
  mqAdapter?: CmpRedisMqAdapter;
}

export interface RaxCmpRuntime extends RaxCmpRuntimeLike {
  readonly config: RaxCmpConfig;
  readonly connectors: CmpSharedInfraConnectors;
  readonly agentCoreRuntime: AgentCoreRuntime;
}

function createDefaultGitBackend(): CmpGitBackend {
  try {
    return createGitCliCmpGitBackend();
  } catch {
    return createInMemoryCmpGitBackend();
  }
}

function createDefaultDbExecutor(config: RaxCmpConfig): CmpDbPsqlLiveExecutor | undefined {
  if (!config.db.liveExecutionPreferred) {
    return undefined;
  }
  return createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: config.db.databaseName,
    },
  });
}

function createDefaultMqAdapter(config: RaxCmpConfig): CmpRedisMqAdapter {
  if (!config.mq.liveExecutionPreferred) {
    return createInMemoryCmpRedisMqAdapter();
  }
  return createRedisCliCmpRedisMqAdapter();
}

export function createRaxCmpRuntime(input: CreateRaxCmpRuntimeInput): RaxCmpRuntime {
  const connectors = input.connectors ?? createCmpSharedInfraConnectors({
    gitBackend: input.gitBackend ?? createDefaultGitBackend(),
    dbExecutor: input.dbExecutor ?? createDefaultDbExecutor(input.config),
    mqAdapter: input.mqAdapter ?? createDefaultMqAdapter(input.config),
  });
  const agentCoreRuntime = input.runtime ?? createAgentCoreRuntime({
    cmpInfraBackends: {
      git: connectors.git.backend,
      dbExecutor: connectors.db.executor,
      mq: connectors.mq.adapter,
    },
  });

  return {
    config: input.config,
    connectors,
    agentCoreRuntime,
    bootstrapCmpProjectInfra(params) {
      return agentCoreRuntime.bootstrapCmpProjectInfra(params);
    },
    getCmpProjectInfraBootstrapReceipt(projectId) {
      return agentCoreRuntime.getCmpProjectInfraBootstrapReceipt(projectId);
    },
    getCmpRuntimeInfraProjectState(projectId) {
      return agentCoreRuntime.getCmpRuntimeInfraProjectState(projectId);
    },
    getCmpRuntimeRecoverySummary() {
      return agentCoreRuntime.getCmpRuntimeRecoverySummary();
    },
    getCmpRuntimeProjectRecoverySummary(projectId) {
      return agentCoreRuntime.getCmpRuntimeProjectRecoverySummary(projectId);
    },
    getCmpRuntimeDeliveryTruthSummary(projectId) {
      return agentCoreRuntime.getCmpRuntimeDeliveryTruthSummary(projectId);
    },
    getCmpFiveAgentRuntimeSummary(agentId) {
      return agentCoreRuntime.getCmpFiveAgentRuntimeSummary(agentId);
    },
    resolveCmpFiveAgentCapabilityAccess(input) {
      return agentCoreRuntime.resolveCmpFiveAgentCapabilityAccess(input);
    },
    dispatchCmpFiveAgentCapability(input) {
      return agentCoreRuntime.dispatchCmpFiveAgentCapability(input);
    },
    reviewCmpPeerExchangeApproval(input) {
      return agentCoreRuntime.reviewCmpPeerExchangeApproval(input);
    },
    advanceCmpMqDeliveryTimeouts(input) {
      return agentCoreRuntime.advanceCmpMqDeliveryTimeouts(input);
    },
    recoverCmpRuntimeSnapshot(snapshot) {
      return agentCoreRuntime.recoverCmpRuntimeSnapshot(snapshot);
    },
    ingestRuntimeContext(params) {
      return agentCoreRuntime.ingestRuntimeContext(params);
    },
    commitContextDelta(params) {
      return agentCoreRuntime.commitContextDelta(params);
    },
    resolveCheckedSnapshot(params) {
      return agentCoreRuntime.resolveCheckedSnapshot(params);
    },
    materializeContextPackage(params) {
      return agentCoreRuntime.materializeContextPackage(params);
    },
    dispatchContextPackage(params) {
      return agentCoreRuntime.dispatchContextPackage(params);
    },
    requestHistoricalContext(params) {
      return agentCoreRuntime.requestHistoricalContext(params);
    },
  };
}
