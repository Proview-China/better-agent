import { createCmpFiveAgentTapBridgeCompiled } from "../cmp-five-agent/tap-bridge.js";
import { createCmpRoleTapProfile } from "../cmp-five-agent/configuration.js";
import type { CmpPeerExchangeApprovalRecord } from "../cmp-five-agent/index.js";
import { createDispatchReceipt, type DispatchReceipt } from "../cmp-types/index.js";
import type { AgentCoreCmpTapBridgeApi } from "../cmp-api/index.js";
import { TaControlPlaneGateway, type ResolveCapabilityAccessResult } from "../ta-pool-runtime/index.js";
import type { DispatchCmpFiveAgentCapabilityResult } from "../runtime.js";

export interface AgentCoreCmpTapBridgeServiceDeps {
  dispatchCapabilityIntentViaTaPool: import("../runtime.js").AgentCoreRuntime["dispatchCapabilityIntentViaTaPool"];
  hasLineage(agentId: string): boolean;
  recordDispatchSyncEvent(input: {
    agentId: string;
    objectRef: string;
    role: string;
    capabilityKey: string;
    profileId: string;
    dispatchStatus: string;
    grantId?: string;
    reviewDecisionId?: string;
    provisionId?: string;
    bridgeMetadata: Record<string, unknown>;
  }): void;
  approvePeerExchange(input: {
    approvalId: string;
    actorAgentId: string;
    decision: "approved" | "rejected";
    note?: string;
    decidedAt?: string;
  }): CmpPeerExchangeApprovalRecord;
  listDispatchReceipts(): readonly DispatchReceipt[];
  setDispatchReceipt(dispatchId: string, receipt: DispatchReceipt): void;
}

export function createAgentCoreCmpTapBridgeService(
  deps: AgentCoreCmpTapBridgeServiceDeps,
): AgentCoreCmpTapBridgeApi {
  return {
    resolveCapabilityAccess(input) {
      const profile = createCmpRoleTapProfile(input.role);
      const gateway = new TaControlPlaneGateway({ profile });
      const resolution: ResolveCapabilityAccessResult = gateway.resolveCapabilityAccess({
        sessionId: input.sessionId,
        runId: input.runId,
        agentId: input.agentId,
        capabilityKey: input.capabilityKey,
        reason: input.reason,
        requestedTier: input.requestedTier,
        mode: input.mode,
        taskContext: input.taskContext,
        requestedScope: input.requestedScope,
        requestedDurationMs: input.requestedDurationMs,
        metadata: {
          cmpRole: input.role,
          ...(input.metadata ?? {}),
        },
      });
      return {
        role: input.role,
        profile,
        resolution,
      };
    },
    async dispatchCapability(input): Promise<DispatchCmpFiveAgentCapabilityResult> {
      const compiled = createCmpFiveAgentTapBridgeCompiled({
        role: input.role,
        sessionId: input.sessionId,
        runId: input.runId,
        agentId: input.agentId,
        capabilityKey: input.capabilityKey,
        reason: input.reason,
        capabilityInput: input.capabilityInput,
        priority: input.priority,
        timeoutMs: input.timeoutMs,
        requestedTier: input.requestedTier,
        mode: input.mode,
        taskContext: input.taskContext,
        requestedScope: input.requestedScope,
        requestedDurationMs: input.requestedDurationMs,
        cmpContext: input.cmpContext,
        metadata: input.metadata,
      });
      const dispatch = await deps.dispatchCapabilityIntentViaTaPool(
        compiled.intent,
        compiled.dispatchOptions,
      );
      if (deps.hasLineage(input.agentId)) {
        deps.recordDispatchSyncEvent({
          agentId: input.agentId,
          objectRef: dispatch.accessRequest?.requestId
            ?? dispatch.reviewDecision?.requestId
            ?? compiled.intent.request.requestId,
          role: input.role,
          capabilityKey: input.capabilityKey,
          profileId: compiled.profile.profileId,
          dispatchStatus: dispatch.status,
          grantId: dispatch.grant?.grantId,
          reviewDecisionId: dispatch.reviewDecision?.decisionId,
          provisionId: dispatch.provisionRequest?.provisionId,
          bridgeMetadata: compiled.bridgeMetadata,
        });
      }
      return {
        role: input.role,
        profile: compiled.profile,
        intent: compiled.intent,
        bridgeMetadata: compiled.bridgeMetadata,
        dispatch,
      };
    },
    reviewPeerExchangeApproval(input) {
      const approval = deps.approvePeerExchange(input);
      for (const receipt of deps.listDispatchReceipts()) {
        if (receipt.metadata?.cmpPeerExchangeApprovalId !== approval.approvalId) {
          continue;
        }
        deps.setDispatchReceipt(receipt.dispatchId, createDispatchReceipt({
          ...receipt,
          metadata: {
            ...(receipt.metadata ?? {}),
            cmpPeerExchangeApprovalStatus: approval.status,
            cmpPeerExchangeApprovedAt: approval.approvedAt,
            cmpPeerExchangeApprovedBy: approval.approvedByAgentId,
          },
        }));
      }
      return approval;
    },
  };
}
