import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpProjectApi } from "../cmp-api/index.js";

export function createAgentCoreCmpProjectService(runtime: AgentCoreRuntime): AgentCoreCmpProjectApi {
  return {
    bootstrapProjectInfra(input) {
      return runtime.bootstrapCmpProjectInfra(input);
    },
    getBootstrapReceipt(projectId) {
      return runtime.getCmpProjectInfraBootstrapReceipt(projectId);
    },
    getInfraProjectState(projectId) {
      return runtime.getCmpRuntimeInfraProjectState(projectId);
    },
    getRecoverySummary() {
      return runtime.getCmpRuntimeRecoverySummary();
    },
    getProjectRecoverySummary(projectId) {
      return runtime.getCmpRuntimeProjectRecoverySummary(projectId);
    },
    getDeliveryTruthSummary(projectId) {
      return runtime.getCmpRuntimeDeliveryTruthSummary(projectId);
    },
    createSnapshot() {
      return runtime.createCmpRuntimeSnapshot();
    },
    recoverSnapshot(snapshot) {
      return runtime.recoverCmpRuntimeSnapshot(snapshot);
    },
    advanceDeliveryTimeouts(input) {
      return runtime.advanceCmpMqDeliveryTimeouts(input);
    },
  };
}
