import type { AgentCoreCmpApi } from "../cmp-api/index.js";
import type { AgentCoreRuntime } from "../runtime.js";
import {
  createAgentCoreCmpActiveFlowService,
  type AgentCoreCmpActiveFlowServiceDeps,
} from "./active-flow-service.js";
import { createAgentCoreCmpLiveService } from "./live-service.js";
import { createAgentCoreCmpPackageFlowService } from "./package-flow-service.js";
import { createAgentCoreCmpProjectService, type AgentCoreCmpProjectServiceDeps } from "./project-service.js";
import { createAgentCoreCmpTapBridgeService, type AgentCoreCmpTapBridgeServiceDeps } from "./tap-bridge-service.js";
import { createAgentCoreCmpStateStore, type AgentCoreCmpStateStore } from "./state-store.js";

export interface AgentCoreCmpServices {
  readonly stateStore: AgentCoreCmpStateStore;
  readonly api: AgentCoreCmpApi;
}

export interface AgentCoreCmpServicesInput {
  readonly runtime: AgentCoreRuntime;
  readonly activeFlow: AgentCoreCmpActiveFlowServiceDeps;
  readonly project: AgentCoreCmpProjectServiceDeps;
  readonly tapBridge: AgentCoreCmpTapBridgeServiceDeps;
}

export function createAgentCoreCmpServices(input: AgentCoreCmpServicesInput): AgentCoreCmpServices {
  const runtime = input.runtime;
  const stateStore = createAgentCoreCmpStateStore(runtime);
  const activeFlow = createAgentCoreCmpActiveFlowService(input.activeFlow);
  const packageFlow = createAgentCoreCmpPackageFlowService(runtime);

  return {
    stateStore,
    api: {
      project: createAgentCoreCmpProjectService(input.project),
      workflow: {
        ...activeFlow,
        ...packageFlow,
      },
      fiveAgent: createAgentCoreCmpLiveService(runtime),
      tapBridge: createAgentCoreCmpTapBridgeService(input.tapBridge),
    },
  };
}
