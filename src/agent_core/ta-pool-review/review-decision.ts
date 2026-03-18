import type {
  AccessRequest,
  CapabilityGrant,
  ProvisionRequest,
  ReviewDecision,
  ReviewDecisionKind,
} from "../ta-pool-types/index.js";
import { createProvisionRequest } from "../ta-pool-types/index.js";

export function reviewDecisionHasGrant(decision: ReviewDecision): boolean {
  return decision.decision === "approved" || decision.decision === "partially_approved";
}

export function reviewDecisionRequiresProvisioning(decision: ReviewDecision): boolean {
  return decision.decision === "redirected_to_provisioning";
}

export function reviewDecisionRequiresHuman(decision: ReviewDecision): boolean {
  return decision.decision === "escalated_to_human";
}

export function reviewDecisionBlocksExecution(decision: ReviewDecision): boolean {
  return (
    decision.decision === "denied" ||
    decision.decision === "deferred" ||
    decision.decision === "escalated_to_human" ||
    decision.decision === "redirected_to_provisioning"
  );
}

export function assertReviewDecisionCompatibleWithRequest(params: {
  request: AccessRequest;
  decision: ReviewDecision;
}): void {
  const { request, decision } = params;
  if (request.requestId !== decision.requestId) {
    throw new Error(
      `Review decision ${decision.decisionId} does not belong to access request ${request.requestId}.`,
    );
  }

  if (!reviewDecisionHasGrant(decision)) {
    return;
  }

  const grant = decision.grant as CapabilityGrant;
  if (grant.requestId !== request.requestId) {
    throw new Error(
      `Capability grant ${grant.grantId} does not belong to access request ${request.requestId}.`,
    );
  }

  if (grant.capabilityKey !== request.requestedCapabilityKey) {
    throw new Error(
      `Capability grant ${grant.grantId} targets ${grant.capabilityKey}, expected ${request.requestedCapabilityKey}.`,
    );
  }
}

export function resolveExecutionReadiness(decision: ReviewDecision): {
  ready: boolean;
  blockedBy: ReviewDecisionKind | "none";
  grant?: CapabilityGrant;
} {
  if (reviewDecisionHasGrant(decision)) {
    return {
      ready: true,
      blockedBy: "none",
      grant: decision.grant,
    };
  }

  return {
    ready: false,
    blockedBy: decision.decision,
  };
}

export function toProvisionRequestFromReviewDecision(params: {
  request: AccessRequest;
  decision: ReviewDecision;
  provisionId: string;
  createdAt: string;
}): ProvisionRequest {
  const { request, decision, provisionId, createdAt } = params;
  if (!reviewDecisionRequiresProvisioning(decision)) {
    throw new Error(
      `Review decision ${decision.decisionId} does not require provisioning.`,
    );
  }

  return createProvisionRequest({
    provisionId,
    sourceRequestId: request.requestId,
    requestedCapabilityKey: decision.provisionCapabilityKey ?? request.requestedCapabilityKey,
    requestedTier: request.requestedTier,
    reason: `${request.reason} [redirected-to-provisioning:${decision.decisionId}]`,
    desiredProviderOrRuntime: request.requestedScope?.providerHints?.[0],
    requiredVerification: ["smoke", "ready"],
    expectedArtifacts: ["tool", "binding", "verification", "usage"],
    createdAt,
    metadata: {
      sourceDecisionId: decision.decisionId,
      sourceMode: request.mode,
    },
  });
}
