import type { ReviewDecisionKind, TaCapabilityTier, TaPoolMode } from "../ta-pool-types/index.js";

export const TA_MODE_REVIEWER_STRATEGIES = [
  "skip",
  "fast",
  "normal",
  "strict",
  "interrupt_only",
  "human_gate",
] as const;
export type TaModeReviewerStrategy = (typeof TA_MODE_REVIEWER_STRATEGIES)[number];

export const TA_MODE_EXECUTION_PATHS = [
  "baseline_fast_path",
  "review_path",
  "guarded_execution",
  "human_gate",
] as const;
export type TaModeExecutionPath = (typeof TA_MODE_EXECUTION_PATHS)[number];

export const TA_MODE_REVIEW_REQUIREMENTS = [
  "none",
  "explicit_review",
  "strict_review",
  "human_escalation",
  "interruptible_execution",
] as const;
export type TaModeReviewRequirement = (typeof TA_MODE_REVIEW_REQUIREMENTS)[number];

export const TA_MODE_REQUEST_PATHS = [
  "baseline",
  "review",
  "guarded",
  "human",
] as const;
export type TaModeRequestPath = (typeof TA_MODE_REQUEST_PATHS)[number];

export interface TaModeTierPolicy {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
  executionPath: TaModeExecutionPath;
  reviewerStrategy: TaModeReviewerStrategy;
  reviewRequirement: TaModeReviewRequirement;
  autoApprove: boolean;
  allowProvisioningRedirect: boolean;
  allowEmergencyInterrupt: boolean;
  defaultDecisionHint: ReviewDecisionKind;
}

export interface TaModeReviewerSnapshot {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
  requestPath: TaModeRequestPath;
  executionPath: TaModeExecutionPath;
  reviewerStrategy: TaModeReviewerStrategy;
  reviewRequirement: TaModeReviewRequirement;
  autoApprove: boolean;
  shouldSkipReview: boolean;
  requiresHumanGate: boolean;
  allowProvisioningRedirect: boolean;
  allowEmergencyInterrupt: boolean;
  defaultDecisionHint: ReviewDecisionKind;
}

export interface TaModePolicy extends TaModeReviewerSnapshot {
  allowsAutoGrant: boolean;
  requiresReview: boolean;
  allowsDeferred: boolean;
  escalatesToHuman: boolean;
}

export interface ModePolicyEntry {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
  decision:
    | "allow"
    | "review"
    | "review_strict"
    | "interrupt"
    | "escalate_to_human";
  requiresReview: boolean;
  allowsAutoGrant: boolean;
  requiresHuman: boolean;
  actsAsSafetyAirbag: boolean;
}
export type ModePolicyDecision = ModePolicyEntry["decision"];

type ModeMatrixEntry = Omit<TaModeTierPolicy, "mode" | "tier">;

const MODE_MATRIX: Record<TaPoolMode, Record<TaCapabilityTier, ModeMatrixEntry>> = {
  strict: {
    B0: {
      executionPath: "baseline_fast_path",
      reviewerStrategy: "skip",
      reviewRequirement: "none",
      autoApprove: true,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: false,
      defaultDecisionHint: "approved",
    },
    B1: {
      executionPath: "review_path",
      reviewerStrategy: "normal",
      reviewRequirement: "explicit_review",
      autoApprove: false,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: false,
      defaultDecisionHint: "deferred",
    },
    B2: {
      executionPath: "review_path",
      reviewerStrategy: "strict",
      reviewRequirement: "strict_review",
      autoApprove: false,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "deferred",
    },
    B3: {
      executionPath: "human_gate",
      reviewerStrategy: "human_gate",
      reviewRequirement: "human_escalation",
      autoApprove: false,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "escalated_to_human",
    },
  },
  balanced: {
    B0: {
      executionPath: "baseline_fast_path",
      reviewerStrategy: "skip",
      reviewRequirement: "none",
      autoApprove: true,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: false,
      defaultDecisionHint: "approved",
    },
    B1: {
      executionPath: "review_path",
      reviewerStrategy: "fast",
      reviewRequirement: "explicit_review",
      autoApprove: false,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: false,
      defaultDecisionHint: "deferred",
    },
    B2: {
      executionPath: "review_path",
      reviewerStrategy: "normal",
      reviewRequirement: "explicit_review",
      autoApprove: false,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "deferred",
    },
    B3: {
      executionPath: "guarded_execution",
      reviewerStrategy: "interrupt_only",
      reviewRequirement: "interruptible_execution",
      autoApprove: false,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "denied",
    },
  },
  yolo: {
    B0: {
      executionPath: "baseline_fast_path",
      reviewerStrategy: "skip",
      reviewRequirement: "none",
      autoApprove: true,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: false,
      defaultDecisionHint: "approved",
    },
    B1: {
      executionPath: "baseline_fast_path",
      reviewerStrategy: "interrupt_only",
      reviewRequirement: "interruptible_execution",
      autoApprove: true,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "approved",
    },
    B2: {
      executionPath: "guarded_execution",
      reviewerStrategy: "interrupt_only",
      reviewRequirement: "interruptible_execution",
      autoApprove: true,
      allowProvisioningRedirect: true,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "approved",
    },
    B3: {
      executionPath: "guarded_execution",
      reviewerStrategy: "interrupt_only",
      reviewRequirement: "interruptible_execution",
      autoApprove: false,
      allowProvisioningRedirect: false,
      allowEmergencyInterrupt: true,
      defaultDecisionHint: "denied",
    },
  },
};

export function classifyRequestPath(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): TaModeRequestPath {
  const policy = MODE_MATRIX[params.mode][params.tier];
  switch (policy.executionPath) {
    case "baseline_fast_path":
      return "baseline";
    case "review_path":
      return "review";
    case "guarded_execution":
      return "guarded";
    case "human_gate":
      return "human";
  }
}

export function getModeTierPolicy(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): TaModeTierPolicy {
  return {
    mode: params.mode,
    tier: params.tier,
    ...MODE_MATRIX[params.mode][params.tier],
  };
}

export function getModePolicySnapshot(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): TaModeReviewerSnapshot {
  const policy = getModeTierPolicy(params);
  return {
    mode: policy.mode,
    tier: policy.tier,
    requestPath: classifyRequestPath(params),
    executionPath: policy.executionPath,
    reviewerStrategy: policy.reviewerStrategy,
    reviewRequirement: policy.reviewRequirement,
    autoApprove: policy.autoApprove,
    shouldSkipReview: policy.reviewerStrategy === "skip",
    requiresHumanGate: policy.executionPath === "human_gate",
    allowProvisioningRedirect: policy.allowProvisioningRedirect,
    allowEmergencyInterrupt: policy.allowEmergencyInterrupt,
    defaultDecisionHint: policy.defaultDecisionHint,
  };
}

export function getTaModePolicy(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): TaModePolicy {
  const snapshot = getModePolicySnapshot(params);
  return {
    ...snapshot,
    allowsAutoGrant: snapshot.autoApprove,
    requiresReview:
      snapshot.reviewRequirement === "explicit_review" ||
      snapshot.reviewRequirement === "strict_review" ||
      (snapshot.reviewRequirement === "interruptible_execution" && !snapshot.autoApprove),
    allowsDeferred:
      snapshot.reviewRequirement === "explicit_review" ||
      snapshot.reviewRequirement === "strict_review",
    escalatesToHuman: snapshot.requiresHumanGate,
  };
}

export function getModePolicyEntry(
  mode: TaPoolMode,
  tier: TaCapabilityTier,
): ModePolicyEntry {
  const snapshot = getModePolicySnapshot({ mode, tier });

  let decision: ModePolicyEntry["decision"];
  if (snapshot.requiresHumanGate) {
    decision = "escalate_to_human";
  } else if (snapshot.executionPath === "guarded_execution") {
    decision = "interrupt";
  } else if (snapshot.reviewRequirement === "strict_review") {
    decision = "review_strict";
  } else if (snapshot.reviewRequirement === "explicit_review") {
    decision = "review";
  } else {
    decision = "allow";
  }

  return {
    mode,
    tier,
    decision,
    requiresReview:
      snapshot.reviewRequirement === "explicit_review" ||
      snapshot.reviewRequirement === "strict_review",
    allowsAutoGrant: snapshot.autoApprove,
    requiresHuman: snapshot.requiresHumanGate,
    actsAsSafetyAirbag: snapshot.allowEmergencyInterrupt && mode === "yolo",
  };
}

export function getModePolicyMatrix(): Record<TaPoolMode, Record<TaCapabilityTier, ModePolicyEntry["decision"]>> {
  return {
    strict: {
      B0: getModePolicyEntry("strict", "B0").decision,
      B1: getModePolicyEntry("strict", "B1").decision,
      B2: getModePolicyEntry("strict", "B2").decision,
      B3: getModePolicyEntry("strict", "B3").decision,
    },
    balanced: {
      B0: getModePolicyEntry("balanced", "B0").decision,
      B1: getModePolicyEntry("balanced", "B1").decision,
      B2: getModePolicyEntry("balanced", "B2").decision,
      B3: getModePolicyEntry("balanced", "B3").decision,
    },
    yolo: {
      B0: getModePolicyEntry("yolo", "B0").decision,
      B1: getModePolicyEntry("yolo", "B1").decision,
      B2: getModePolicyEntry("yolo", "B2").decision,
      B3: getModePolicyEntry("yolo", "B3").decision,
    },
  };
}

export function listModePolicyMatrix(): TaModeTierPolicy[] {
  return (Object.entries(MODE_MATRIX) as Array<[TaPoolMode, Record<TaCapabilityTier, ModeMatrixEntry>]>)
    .flatMap(([mode, tiers]) =>
      (Object.entries(tiers) as Array<[TaCapabilityTier, ModeMatrixEntry]>).map(([tier, policy]) => ({
        mode,
        tier,
        ...policy,
      })),
    );
}

export function shouldSkipReview(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getModePolicySnapshot(params).shouldSkipReview;
}

export function shouldReviewForTier(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getTaModePolicy(params).requiresReview;
}

export function allowsAutoGrantForTier(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getTaModePolicy(params).allowsAutoGrant;
}

export function requiresHumanGate(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getModePolicySnapshot(params).requiresHumanGate;
}

export function supportsProvisioningRedirect(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getModePolicySnapshot(params).allowProvisioningRedirect;
}

export function allowsEmergencyInterrupt(params: {
  mode: TaPoolMode;
  tier: TaCapabilityTier;
}): boolean {
  return getModePolicySnapshot(params).allowEmergencyInterrupt;
}
