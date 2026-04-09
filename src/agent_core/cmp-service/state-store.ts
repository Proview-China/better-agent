import type { AgentCoreRuntime } from "../runtime.js";

export interface AgentCoreCmpStateStore {
  readonly runtime: AgentCoreRuntime;
}

export function createAgentCoreCmpStateStore(runtime: AgentCoreRuntime): AgentCoreCmpStateStore {
  return { runtime };
}
