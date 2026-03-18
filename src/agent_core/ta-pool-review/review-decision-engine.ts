import {
  createCapabilityGrant,
  createReviewDecision,
  isCapabilityDeniedByProfile,
  type AccessRequest,
  type AgentCapabilityProfile,
  type ReviewDecision,
} from "../ta-pool-types/index.js";
import { getModePolicyEntry } from "../ta-pool-model/mode-policy.js";
import { resolveBaselineCapability } from "../ta-pool-model/profile-baseline.js";

export interface ReviewDecisionEngineInventory {
  availableCapabilityKeys?: string[];
  pendingProvisionKeys?: string[];
}

export interface EvaluateReviewDecisionInput {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
  decisionId?: string;
  reviewerId?: string;
  createdAt?: string;
  defaultEscalationTarget?: string;
}

export type ReviewDecisionEngineInput = EvaluateReviewDecisionInput;

function normalizeStringArray(values?: string[]): string[] {
  if (!values) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function hasCapability(inventory: ReviewDecisionEngineInventory | undefined, capabilityKey: string): boolean {
  return normalizeStringArray(inventory?.availableCapabilityKeys).includes(capabilityKey);
}

function isPendingProvision(inventory: ReviewDecisionEngineInventory | undefined, capabilityKey: string): boolean {
  return normalizeStringArray(inventory?.pendingProvisionKeys).includes(capabilityKey);
}

export function evaluateReviewDecision(input: EvaluateReviewDecisionInput): ReviewDecision {
  const {
    request,
    profile,
    inventory,
    decisionId = `${request.requestId}:decision`,
    reviewerId,
    createdAt = request.createdAt,
    defaultEscalationTarget = "human-review",
  } = input;

  if (isCapabilityDeniedByProfile({
    profile,
    capabilityKey: request.requestedCapabilityKey,
  })) {
    return createReviewDecision({
      decisionId,
      requestId: request.requestId,
      decision: "denied",
      reviewerId,
      mode: request.mode,
      reason: `Capability ${request.requestedCapabilityKey} is denied by the active profile.`,
      createdAt,
    });
  }

  const baselineResolution = resolveBaselineCapability({
    profile,
    capabilityKey: request.requestedCapabilityKey,
    requestedTier: request.requestedTier,
  });
  if (baselineResolution.status === "baseline_allowed") {
    return createReviewDecision({
      decisionId,
      requestId: request.requestId,
      decision: "approved",
      reviewerId,
      mode: request.mode,
      reason: `Capability ${request.requestedCapabilityKey} is in the baseline set.`,
      grant: createCapabilityGrant({
        grantId: `${request.requestId}:grant`,
        requestId: request.requestId,
        capabilityKey: request.requestedCapabilityKey,
        grantedTier: request.requestedTier,
        grantedScope: request.requestedScope,
        mode: request.mode,
        issuedAt: createdAt,
        constraints: {
          source: "baseline-fast-path",
        },
      }),
      createdAt,
    });
  }

  if (isPendingProvision(inventory, request.requestedCapabilityKey)) {
    return createReviewDecision({
      decisionId,
      requestId: request.requestId,
      decision: "deferred",
      reviewerId,
      mode: request.mode,
      reason: `Capability ${request.requestedCapabilityKey} is already provisioning.`,
      deferredReason: "Awaiting provision artifact bundle completion.",
      createdAt,
    });
  }

  if (!hasCapability(inventory, request.requestedCapabilityKey)) {
    return createReviewDecision({
      decisionId,
      requestId: request.requestId,
      decision: "redirected_to_provisioning",
      reviewerId,
      mode: request.mode,
      reason: `Capability ${request.requestedCapabilityKey} is not currently available.`,
      provisionCapabilityKey: request.requestedCapabilityKey,
      createdAt,
    });
  }

  const policy = getModePolicyEntry(request.mode, request.requestedTier);
  if (policy.requiresHuman) {
    return createReviewDecision({
      decisionId,
      requestId: request.requestId,
      decision: "escalated_to_human",
      reviewerId,
      mode: request.mode,
      reason: `Capability ${request.requestedCapabilityKey} at tier ${request.requestedTier} requires human review in ${request.mode} mode.`,
      escalationTarget: defaultEscalationTarget,
      createdAt,
    });
  }

  return createReviewDecision({
    decisionId,
    requestId: request.requestId,
    decision: "approved",
    reviewerId,
    mode: request.mode,
    reason: `Capability ${request.requestedCapabilityKey} is available and allowed under ${request.mode} mode.`,
    grant: createCapabilityGrant({
      grantId: `${request.requestId}:grant`,
      requestId: request.requestId,
      capabilityKey: request.requestedCapabilityKey,
      grantedTier: request.requestedTier,
      grantedScope: request.requestedScope,
      mode: request.mode,
      issuedAt: createdAt,
      constraints: {
        source: policy.allowsAutoGrant ? "mode-auto-grant" : "review-approved",
        modeDecision: policy.decision,
      },
    }),
    createdAt,
  });
}
