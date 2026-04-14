import { randomUUID } from "node:crypto";

import type {
  AccessRequest,
  AgentCapabilityProfile,
  CapabilityGrant,
  ReviewDecision,
  ReviewDecisionKind,
} from "../ta-pool-types/index.js";
import {
  createCapabilityGrant,
  createReviewDecision,
  isCapabilityDeniedByProfile,
} from "../ta-pool-types/index.js";
import {
  classifyCapabilityRisk,
  resolveBaselineCapability,
  getTaModePolicy,
  getModeRiskPolicyEntry,
} from "../ta-pool-model/index.js";

export const REVIEW_ROUTING_OUTCOMES = [
  "baseline_approved",
  "review_required",
  "redirected_to_provisioning",
  "escalated_to_human",
  "denied",
] as const;
export type ReviewRoutingOutcome = (typeof REVIEW_ROUTING_OUTCOMES)[number];

export interface ReviewRoutingResult {
  outcome: ReviewRoutingOutcome;
  decision: ReviewDecision;
  grant?: CapabilityGrant;
}

export interface RouteAccessRequestOptions {
  profile: AgentCapabilityProfile;
  request: AccessRequest;
  capabilityAvailable?: boolean;
  idFactory?: () => string;
  clock?: () => Date;
}

function defaultIdFactory(): string {
  return randomUUID();
}

function defaultClock(): Date {
  return new Date();
}

function createDeniedDecision(params: {
  request: AccessRequest;
  reason: string;
  decision: Extract<ReviewDecisionKind, "denied" | "escalated_to_human" | "redirected_to_provisioning">;
  capabilityKey?: string;
  idFactory: () => string;
  clock: () => Date;
}): ReviewDecision {
  const createdAt = params.clock().toISOString();
  return createReviewDecision({
    decisionId: params.idFactory(),
    requestId: params.request.requestId,
    decision: params.decision,
    mode: params.request.mode,
    reason: params.reason,
    provisionCapabilityKey: params.decision === "redirected_to_provisioning"
      ? params.capabilityKey ?? params.request.requestedCapabilityKey
      : undefined,
    escalationTarget: params.decision === "escalated_to_human" ? "human-review" : undefined,
    createdAt,
  });
}

export function routeAccessRequest(params: RouteAccessRequestOptions): ReviewRoutingResult {
  const idFactory = params.idFactory ?? defaultIdFactory;
  const clock = params.clock ?? defaultClock;
  const { profile, request } = params;

  if (isCapabilityDeniedByProfile({
    profile,
    capabilityKey: request.requestedCapabilityKey,
  })) {
    const decision = createDeniedDecision({
      request,
      reason: `Capability ${request.requestedCapabilityKey} is denied by profile ${profile.profileId}.`,
      decision: "denied",
      idFactory,
      clock,
    });
    return {
      outcome: "denied",
      decision,
    };
  }

  const modePolicy = getTaModePolicy({
    mode: request.mode,
    tier: request.requestedTier,
  });
  const effectiveRiskLevel = request.riskLevel ?? classifyCapabilityRisk({
    capabilityKey: request.requestedCapabilityKey,
    requestedTier: request.requestedTier,
  }).riskLevel;
  const riskPolicy = getModeRiskPolicyEntry(request.mode, effectiveRiskLevel);
  const baselineResolution = resolveBaselineCapability({
    profile,
    capabilityKey: request.requestedCapabilityKey,
    requestedTier: request.requestedTier,
  });
  const baselineAllowed = baselineResolution.status === "baseline_allowed";
  const shouldAutoGrant =
    riskPolicy.decision === "allow"
    || (riskPolicy.baselineFastPath && baselineAllowed);

  if (riskPolicy.decision === "deny") {
    const decision = createDeniedDecision({
      request,
      reason: `Capability ${request.requestedCapabilityKey} is denied for ${effectiveRiskLevel} risk in ${request.mode} mode.`,
      decision: "denied",
      idFactory,
      clock,
    });
    return {
      outcome: "denied",
      decision,
    };
  }

  if (riskPolicy.decision === "human_gate" && !shouldAutoGrant) {
    const decision = createDeniedDecision({
      request,
      reason: `Capability ${request.requestedCapabilityKey} requires human approval for ${effectiveRiskLevel} risk in ${request.mode} mode.`,
      decision: "escalated_to_human",
      idFactory,
      clock,
    });
    return {
      outcome: "escalated_to_human",
      decision,
    };
  }

  if (params.capabilityAvailable === false && modePolicy.allowProvisioningRedirect) {
    const decision = createDeniedDecision({
      request,
      reason: `Capability ${request.requestedCapabilityKey} is not currently available and should be provisioned first.`,
      decision: "redirected_to_provisioning",
      capabilityKey: request.requestedCapabilityKey,
      idFactory,
      clock,
    });
    return {
      outcome: "redirected_to_provisioning",
      decision,
    };
  }

  if (shouldAutoGrant) {
    const createdAt = clock().toISOString();
    const grant = createCapabilityGrant({
      grantId: idFactory(),
      requestId: request.requestId,
      capabilityKey: request.requestedCapabilityKey,
      grantedTier: request.requestedTier,
      grantedScope: request.requestedScope,
      mode: request.mode,
      issuedAt: createdAt,
    });
    const decision = createReviewDecision({
      decisionId: idFactory(),
      requestId: request.requestId,
      vote: "allow",
      mode: request.mode,
      riskLevel: effectiveRiskLevel,
      reason: baselineAllowed
        ? `Capability ${request.requestedCapabilityKey} is baseline-allowed for profile ${profile.profileId}.`
        : `Capability ${request.requestedCapabilityKey} is auto-granted by the ${request.mode}/${effectiveRiskLevel} governance matrix.`,
      grantCompilerDirective: {
        grantedTier: request.requestedTier,
        grantedScope: request.requestedScope,
      },
      createdAt,
    });
    return {
      outcome: "baseline_approved",
      decision,
      grant,
    };
  }

  const decision = createReviewDecision({
    decisionId: idFactory(),
    requestId: request.requestId,
    decision: "deferred",
    mode: request.mode,
    riskLevel: effectiveRiskLevel,
    reason: `Capability ${request.requestedCapabilityKey} requires reviewer handling.`,
    deferredReason: `Route through reviewer strategy before execution in ${request.mode} mode.`,
    createdAt: clock().toISOString(),
  });
  return {
    outcome: "review_required",
    decision,
  };
}
