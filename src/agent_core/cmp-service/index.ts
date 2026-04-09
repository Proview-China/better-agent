import type { AgentCoreCmpApi } from "../cmp-api/index.js";
import type { AgentCoreRuntime } from "../runtime.js";
import { createAgentCoreCmpActiveFlowService } from "./active-flow-service.js";
import { createAgentCoreCmpLiveService } from "./live-service.js";
import { createAgentCoreCmpPackageFlowService } from "./package-flow-service.js";
import { createAgentCoreCmpProjectService } from "./project-service.js";
import { createAgentCoreCmpTapBridgeService } from "./tap-bridge-service.js";
import { createAgentCoreCmpStateStore, type AgentCoreCmpStateStore } from "./state-store.js";

export interface AgentCoreCmpServices {
  readonly stateStore: AgentCoreCmpStateStore;
  readonly api: AgentCoreCmpApi;
}

export function createAgentCoreCmpServices(runtime: AgentCoreRuntime): AgentCoreCmpServices {
  const stateStore = createAgentCoreCmpStateStore(runtime);
  const activeFlow = createAgentCoreCmpActiveFlowService(runtime);
  const packageFlow = createAgentCoreCmpPackageFlowService(runtime);

  return {
    stateStore,
    api: {
      project: createAgentCoreCmpProjectService(runtime),
      workflow: {
        ...activeFlow,
        ...packageFlow,
      },
      fiveAgent: createAgentCoreCmpLiveService(runtime),
      tapBridge: createAgentCoreCmpTapBridgeService(runtime),
    },
  };
}
