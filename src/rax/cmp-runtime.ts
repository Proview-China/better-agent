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
import type { RaxCmpPort } from "./cmp-types.js";

export interface CreateRaxCmpRuntimeInput {
  config: RaxCmpConfig;
  runtime?: AgentCoreRuntime;
  connectors?: CmpSharedInfraConnectors;
  gitBackend?: CmpGitBackend;
  dbExecutor?: CmpDbPsqlLiveExecutor;
  mqAdapter?: CmpRedisMqAdapter;
}

export interface RaxCmpRuntime extends RaxCmpPort {
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
    project: {
      bootstrapProjectInfra(params) {
        return agentCoreRuntime.cmp.project.bootstrapProjectInfra(params);
      },
      getBootstrapReceipt(projectId) {
        return agentCoreRuntime.cmp.project.getBootstrapReceipt(projectId);
      },
      getInfraProjectState(projectId) {
        return agentCoreRuntime.cmp.project.getInfraProjectState(projectId);
      },
      getRecoverySummary() {
        return agentCoreRuntime.cmp.project.getRecoverySummary();
      },
      getProjectRecoverySummary(projectId) {
        return agentCoreRuntime.cmp.project.getProjectRecoverySummary(projectId);
      },
      getDeliveryTruthSummary(projectId) {
        return agentCoreRuntime.cmp.project.getDeliveryTruthSummary(projectId);
      },
      createSnapshot() {
        return agentCoreRuntime.cmp.project.createSnapshot();
      },
      recoverSnapshot(snapshot) {
        return agentCoreRuntime.cmp.project.recoverSnapshot(snapshot);
      },
      advanceDeliveryTimeouts(input) {
        return agentCoreRuntime.cmp.project.advanceDeliveryTimeouts(input);
      },
    },
    flow: {
      ingest(params) {
        return agentCoreRuntime.cmp.workflow.ingest(params);
      },
      commit(params) {
        return agentCoreRuntime.cmp.workflow.commit(params);
      },
      resolve(params) {
        return agentCoreRuntime.cmp.workflow.resolve(params);
      },
      materialize(params) {
        return agentCoreRuntime.cmp.workflow.materialize(params);
      },
      dispatch(params) {
        return agentCoreRuntime.cmp.workflow.dispatch(params);
      },
      requestHistory(params) {
        return agentCoreRuntime.cmp.workflow.requestHistory(params);
      },
    },
    fiveAgent: {
      getSummary(agentId) {
        return agentCoreRuntime.cmp.fiveAgent.getSummary(agentId);
      },
    },
    roles: {
      resolveCapabilityAccess(input) {
        return agentCoreRuntime.cmp.tapBridge.resolveCapabilityAccess(input);
      },
      dispatchCapability(input) {
        return agentCoreRuntime.cmp.tapBridge.dispatchCapability(input);
      },
      approvePeerExchange(input) {
        return agentCoreRuntime.cmp.tapBridge.reviewPeerExchangeApproval(input);
      },
    },
  };
}
