import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpWorkflowApi } from "../cmp-api/index.js";

export function createAgentCoreCmpPackageFlowService(runtime: AgentCoreRuntime): Pick<
  AgentCoreCmpWorkflowApi,
  "materialize" | "dispatch" | "requestHistory"
> {
  return {
    materialize(input) {
      return runtime.materializeContextPackage(input);
    },
    dispatch(input) {
      return runtime.dispatchContextPackage(input);
    },
    requestHistory(input) {
      return runtime.requestHistoricalContext(input);
    },
  };
}
