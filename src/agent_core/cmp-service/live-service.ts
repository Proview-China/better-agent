import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpFiveAgentApi } from "../cmp-api/index.js";

export function createAgentCoreCmpLiveService(runtime: AgentCoreRuntime): AgentCoreCmpFiveAgentApi {
  return {
    getSummary(agentId) {
      return runtime.getCmpFiveAgentRuntimeSummary(agentId);
    },
    getSnapshot(agentId) {
      return runtime.getCmpFiveAgentRuntimeSnapshot(agentId);
    },
    captureIcmaWithLlm(input, options) {
      return runtime.captureCmpIcmaWithLlm(input, options);
    },
    advanceIteratorWithLlm(input, options) {
      return runtime.advanceCmpIteratorWithLlm(input, options);
    },
    evaluateCheckerWithLlm(input, options) {
      return runtime.evaluateCmpCheckerWithLlm(input, options);
    },
    materializeDbAgentWithLlm(input, options) {
      return runtime.materializeCmpDbAgentWithLlm(input, options);
    },
    servePassiveDbAgentWithLlm(input, options) {
      return runtime.servePassiveCmpDbAgentWithLlm(input, options);
    },
    dispatchDispatcherWithLlm(input, options) {
      return runtime.dispatchCmpDispatcherWithLlm(input, options);
    },
    deliverPassiveDispatcherWithLlm(input, options) {
      return runtime.deliverPassiveCmpDispatcherWithLlm(input, options);
    },
    runActiveLoopWithLlm(input) {
      return runtime.runCmpFiveAgentActiveLiveLoop(input);
    },
    runPassiveLoopWithLlm(input) {
      return runtime.runCmpFiveAgentPassiveLiveLoop(input);
    },
  };
}
