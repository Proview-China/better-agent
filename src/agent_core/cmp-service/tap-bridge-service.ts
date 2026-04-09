import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpTapBridgeApi } from "../cmp-api/index.js";

export function createAgentCoreCmpTapBridgeService(runtime: AgentCoreRuntime): AgentCoreCmpTapBridgeApi {
  return {
    resolveCapabilityAccess(input) {
      return runtime.resolveCmpFiveAgentCapabilityAccess(input);
    },
    dispatchCapability(input) {
      return runtime.dispatchCmpFiveAgentCapability(input);
    },
    reviewPeerExchangeApproval(input) {
      return runtime.reviewCmpPeerExchangeApproval(input);
    },
  };
}
