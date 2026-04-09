import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpWorkflowApi } from "../cmp-api/index.js";

export function createAgentCoreCmpActiveFlowService(runtime: AgentCoreRuntime): Pick<
  AgentCoreCmpWorkflowApi,
  "ingest" | "commit" | "resolve"
> {
  return {
    ingest(input) {
      return runtime.ingestRuntimeContext(input);
    },
    commit(input) {
      return runtime.commitContextDelta(input);
    },
    resolve(input) {
      return runtime.resolveCheckedSnapshot(input);
    },
  };
}
