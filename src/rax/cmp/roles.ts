import type { RaxCmpPeerApprovalInput, RaxCmpRoleCapabilityAccessInput, RaxCmpRoleCapabilityDispatchInput, RaxCmpRolesApi } from "../cmp-types.js";

export function createRaxCmpRolesApi(): RaxCmpRolesApi {
  return {
    async resolveCapabilityAccess(roleInput: RaxCmpRoleCapabilityAccessInput) {
      const rolesPort = roleInput.session.runtime.roles;
      if (!rolesPort.resolveCapabilityAccess) {
        throw new Error("CMP five-agent TAP capability resolution is not available on this runtime.");
      }
      return rolesPort.resolveCapabilityAccess({
        role: roleInput.role,
        sessionId: roleInput.session.sessionId,
        runId: roleInput.payload.metadata?.runId as string ?? `${roleInput.session.sessionId}:cmp-five-agent`,
        agentId: roleInput.payload.agentId,
        capabilityKey: roleInput.payload.capabilityKey,
        reason: roleInput.payload.reason,
        requestedTier: roleInput.payload.requestedTier,
        mode: roleInput.payload.mode,
        taskContext: roleInput.payload.taskContext,
        requestedScope: roleInput.payload.requestedScope,
        requestedDurationMs: roleInput.payload.requestedDurationMs,
        metadata: roleInput.payload.metadata,
      });
    },
    async dispatchCapability(roleInput: RaxCmpRoleCapabilityDispatchInput) {
      const rolesPort = roleInput.session.runtime.roles;
      if (!rolesPort.dispatchCapability) {
        throw new Error("CMP five-agent TAP execution bridge is not available on this runtime.");
      }
      return rolesPort.dispatchCapability({
        role: roleInput.role,
        sessionId: roleInput.session.sessionId,
        runId: roleInput.payload.metadata?.runId as string ?? `${roleInput.session.sessionId}:cmp-five-agent`,
        agentId: roleInput.payload.agentId,
        capabilityKey: roleInput.payload.capabilityKey,
        reason: roleInput.payload.reason,
        capabilityInput: roleInput.payload.capabilityInput,
        priority: roleInput.payload.priority,
        timeoutMs: roleInput.payload.timeoutMs,
        requestedTier: roleInput.payload.requestedTier,
        mode: roleInput.payload.mode,
        taskContext: roleInput.payload.taskContext,
        requestedScope: roleInput.payload.requestedScope,
        requestedDurationMs: roleInput.payload.requestedDurationMs,
        cmpContext: roleInput.payload.cmpContext,
        metadata: roleInput.payload.metadata,
      });
    },
    async approvePeerExchange(approvalInput: RaxCmpPeerApprovalInput) {
      const rolesPort = approvalInput.session.runtime.roles;
      if (!rolesPort.approvePeerExchange) {
        throw new Error("CMP peer exchange approval is not available on this runtime.");
      }
      return rolesPort.approvePeerExchange({
        approvalId: approvalInput.approvalId,
        actorAgentId: approvalInput.actorAgentId,
        decision: approvalInput.decision,
        note: approvalInput.note,
      });
    },
  };
}
