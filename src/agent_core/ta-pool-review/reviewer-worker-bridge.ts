import type { ReviewContextApertureSnapshot } from "../ta-pool-context/context-aperture.js";
import type {
  AccessRequest,
  AccessRequestScope,
  AgentCapabilityProfile,
  ReviewDecision,
  ReviewVote,
  TaCapabilityTier,
  TaPoolRiskLevel,
} from "../ta-pool-types/index.js";
import {
  REVIEW_VOTES,
  TA_CAPABILITY_TIERS,
  TA_POOL_RISK_LEVELS,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import type {
  EvaluateReviewDecisionInput,
  ReviewDecisionEngineInventory,
} from "./review-decision-engine.js";
import { assertReviewDecisionCompatibleWithRequest } from "./review-decision.js";
import type { ReviewRoutingResult } from "./review-routing.js";

export const REVIEWER_WORKER_BRIDGE_LANE = "bootstrap-reviewer";
export const REVIEWER_WORKER_PROMPT_PACK_VERSION = "tap-reviewer-prompt-pack/v1";
export const REVIEWER_WORKER_INPUT_SCHEMA_VERSION = "tap-reviewer-worker-input/v1";
export const REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION = "tap-reviewer-worker-output/v1";

const REVIEWER_ALLOWED_READS = [
  "review context aperture",
  "project summary",
  "run summary",
  "profile snapshot",
  "inventory snapshot",
  "memory/context summary",
  "user intent summary",
  "risk summary",
] as const;

const REVIEWER_FORBIDDEN_ACTIONS = [
  "write files",
  "modify code",
  "perform shell writes",
  "install dependencies",
  "dispatch execution",
  "emit capability grants",
  "approve its own execution plan",
] as const;

const FORBIDDEN_OUTPUT_KEYS = [
  "grant",
  "grantId",
  "compiledGrant",
  "compiledGrantId",
  "decisionToken",
  "executionRequest",
  "dispatchGrant",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeScope(scope: unknown): AccessRequestScope | undefined {
  if (!isRecord(scope)) {
    return undefined;
  }

  return {
    pathPatterns: normalizeStringArray(scope.pathPatterns),
    allowedOperations: normalizeStringArray(scope.allowedOperations),
    providerHints: normalizeStringArray(scope.providerHints),
    denyPatterns: normalizeStringArray(scope.denyPatterns),
    metadata: isRecord(scope.metadata) ? scope.metadata : undefined,
  };
}

function validateVoteScopedFields(params: {
  request: AccessRequest;
  output: ReviewerWorkerVoteOutput;
}): void {
  const { output, request } = params;

  if (output.vote === "allow" || output.vote === "allow_with_constraints") {
    if (
      !request.requestedScope
      && output.recommendedScope
      && (
        (output.recommendedScope.pathPatterns?.length ?? 0) > 0
        || (output.recommendedScope.allowedOperations?.length ?? 0) > 0
        || (output.recommendedScope.providerHints?.length ?? 0) > 0
      )
    ) {
      throw new Error(
        "Reviewer worker output cannot introduce granted scope allow-lists when the access request did not request a scope.",
      );
    }
    return;
  }

  if (output.recommendedTier || output.recommendedScope || output.recommendedConstraints || output.denyPatterns) {
    throw new Error(
      `Reviewer worker vote ${output.vote} cannot carry grant compiler directives.`,
    );
  }
}

export interface ReviewerWorkerPromptPack {
  schemaVersion: typeof REVIEWER_WORKER_PROMPT_PACK_VERSION;
  workerKind: "reviewer";
  lane: typeof REVIEWER_WORKER_BRIDGE_LANE;
  mission: string;
  outputContract: string[];
  voteSemantics: Record<ReviewVote, string>;
  allowedReads: string[];
  forbiddenActions: string[];
}

export interface ReviewerWorkerDecisionPreview {
  decision: ReviewDecision["decision"];
  vote: ReviewDecision["vote"];
  reason: string;
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
}

export interface ReviewerWorkerInputEnvelope {
  schemaVersion: typeof REVIEWER_WORKER_INPUT_SCHEMA_VERSION;
  workerKind: "reviewer";
  lane: typeof REVIEWER_WORKER_BRIDGE_LANE;
  runtimeContract: {
    apertureOnly: true;
    canExecute: false;
    canDispatchGrant: false;
    canWrite: false;
    fallbackStrategy: "review-decision-engine";
  };
  request: AccessRequest;
  profileSnapshot: AgentCapabilityProfile;
  inventorySnapshot?: ReviewDecisionEngineInventory;
  routed: {
    outcome: ReviewRoutingResult["outcome"];
    decisionPreview: ReviewerWorkerDecisionPreview;
  };
  reviewContext: ReviewContextApertureSnapshot;
}

export interface ReviewerWorkerVoteOutput {
  schemaVersion: typeof REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION;
  workerKind: "reviewer";
  lane: typeof REVIEWER_WORKER_BRIDGE_LANE;
  vote: ReviewVote;
  reason: string;
  reviewerId?: string;
  decisionId?: string;
  createdAt?: string;
  riskLevel?: TaPoolRiskLevel;
  recommendedTier?: TaCapabilityTier;
  recommendedScope?: AccessRequestScope;
  recommendedConstraints?: Record<string, unknown>;
  denyPatterns?: string[];
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
  humanSummary?: string;
  userFacingExplanation?: string;
  contextFindings?: string[];
  operatorNotes?: string[];
  requiredFollowups?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateReviewerWorkerEnvelopeInput {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
  reviewContext: ReviewContextApertureSnapshot;
  routed: ReviewRoutingResult;
}

export interface CompileReviewerWorkerVoteInput {
  request: AccessRequest;
  promptPack: ReviewerWorkerPromptPack;
  output: unknown;
}

export function createReviewerWorkerPromptPack(): ReviewerWorkerPromptPack {
  return {
    schemaVersion: REVIEWER_WORKER_PROMPT_PACK_VERSION,
    workerKind: "reviewer",
    lane: REVIEWER_WORKER_BRIDGE_LANE,
    mission:
      "Review the access request from the bootstrap reviewer lane and return one structured vote without executing work or minting grants.",
    outputContract: [
      "Return only structured vote JSON.",
      "Allowed votes: allow, allow_with_constraints, deny, defer, escalate_to_human, redirect_to_provisioning.",
      "Do not return inline grants, dispatch requests, tool artifacts, or execution payloads.",
      "If narrowing scope, only return subsets of the requested scope plus optional denyPatterns.",
    ],
    voteSemantics: {
      allow: "Approve within the existing request envelope.",
      allow_with_constraints: "Approve with narrower scope or explicit compiler constraints.",
      deny: "Reject the request.",
      defer: "Keep the request pending for a later replay or prerequisite.",
      escalate_to_human: "Require human review instead of autonomous approval.",
      redirect_to_provisioning: "Send the request back to provisioning before review can succeed.",
    },
    allowedReads: [...REVIEWER_ALLOWED_READS],
    forbiddenActions: [...REVIEWER_FORBIDDEN_ACTIONS],
  };
}

export function createReviewerWorkerEnvelope(
  input: CreateReviewerWorkerEnvelopeInput,
): ReviewerWorkerInputEnvelope {
  return {
    schemaVersion: REVIEWER_WORKER_INPUT_SCHEMA_VERSION,
    workerKind: "reviewer",
    lane: REVIEWER_WORKER_BRIDGE_LANE,
    runtimeContract: {
      apertureOnly: true,
      canExecute: false,
      canDispatchGrant: false,
      canWrite: false,
      fallbackStrategy: "review-decision-engine",
    },
    request: input.request,
    profileSnapshot: input.profile,
    inventorySnapshot: input.inventory,
    routed: {
      outcome: input.routed.outcome,
      decisionPreview: {
        decision: input.routed.decision.decision,
        vote: input.routed.decision.vote,
        reason: input.routed.decision.reason,
        deferredReason: input.routed.decision.deferredReason,
        escalationTarget: input.routed.decision.escalationTarget,
        provisionCapabilityKey: input.routed.decision.provisionCapabilityKey,
      },
    },
    reviewContext: input.reviewContext,
  };
}

export function parseReviewerWorkerVoteOutput(
  output: unknown,
): ReviewerWorkerVoteOutput {
  if (!isRecord(output)) {
    throw new Error("Reviewer worker output must be a plain object.");
  }

  for (const key of FORBIDDEN_OUTPUT_KEYS) {
    if (key in output) {
      throw new Error(
        `Reviewer worker output must be vote-only; forbidden field ${key} is not allowed.`,
      );
    }
  }

  const rawVote = output.vote;
  if (typeof rawVote !== "string" || !REVIEW_VOTES.includes(rawVote as ReviewVote)) {
    throw new Error("Reviewer worker output contains an unsupported vote.");
  }
  const vote = rawVote as ReviewVote;

  const schemaVersion = output.schemaVersion;
  if (schemaVersion !== REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION) {
    throw new Error(
      `Reviewer worker output schemaVersion must be ${REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION}.`,
    );
  }

  if (output.workerKind !== "reviewer") {
    throw new Error("Reviewer worker output workerKind must be reviewer.");
  }

  if (output.lane !== REVIEWER_WORKER_BRIDGE_LANE) {
    throw new Error(
      `Reviewer worker output lane must be ${REVIEWER_WORKER_BRIDGE_LANE}.`,
    );
  }

  if (typeof output.reason !== "string" || !output.reason.trim()) {
    throw new Error("Reviewer worker output requires a non-empty reason.");
  }

  const recommendedTier = output.recommendedTier;
  if (
    recommendedTier !== undefined
    && (typeof recommendedTier !== "string" || !TA_CAPABILITY_TIERS.includes(recommendedTier as TaCapabilityTier))
  ) {
    throw new Error("Reviewer worker output contains an unsupported recommendedTier.");
  }

  const riskLevel = output.riskLevel;
  if (
    riskLevel !== undefined
    && (typeof riskLevel !== "string" || !TA_POOL_RISK_LEVELS.includes(riskLevel as TaPoolRiskLevel))
  ) {
    throw new Error("Reviewer worker output contains an unsupported riskLevel.");
  }

  const requiredFollowups = normalizeStringArray(output.requiredFollowups);
  const contextFindings = normalizeStringArray(output.contextFindings);
  const operatorNotes = normalizeStringArray(output.operatorNotes);
  const denyPatterns = normalizeStringArray(output.denyPatterns);
  const recommendedScope = normalizeScope(output.recommendedScope);

  return {
    schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
    workerKind: "reviewer",
    lane: REVIEWER_WORKER_BRIDGE_LANE,
    vote: vote as ReviewVote,
    reason: output.reason.trim(),
    reviewerId: typeof output.reviewerId === "string" ? output.reviewerId.trim() || undefined : undefined,
    decisionId: typeof output.decisionId === "string" ? output.decisionId.trim() || undefined : undefined,
    createdAt: typeof output.createdAt === "string" ? output.createdAt : undefined,
    riskLevel: riskLevel as TaPoolRiskLevel | undefined,
    recommendedTier: recommendedTier as TaCapabilityTier | undefined,
    recommendedScope,
    recommendedConstraints: isRecord(output.recommendedConstraints)
      ? output.recommendedConstraints
      : undefined,
    denyPatterns,
    deferredReason: typeof output.deferredReason === "string" ? output.deferredReason.trim() || undefined : undefined,
    escalationTarget: typeof output.escalationTarget === "string" ? output.escalationTarget.trim() || undefined : undefined,
    provisionCapabilityKey: typeof output.provisionCapabilityKey === "string"
      ? output.provisionCapabilityKey.trim() || undefined
      : undefined,
    humanSummary: typeof output.humanSummary === "string" ? output.humanSummary.trim() || undefined : undefined,
    userFacingExplanation: typeof output.userFacingExplanation === "string"
      ? output.userFacingExplanation.trim() || undefined
      : undefined,
    contextFindings,
    operatorNotes,
    requiredFollowups,
    metadata: isRecord(output.metadata) ? output.metadata : undefined,
  };
}

export function compileReviewerWorkerVote(
  input: CompileReviewerWorkerVoteInput,
): ReviewDecision {
  const output = parseReviewerWorkerVoteOutput(input.output);

  if (
    output.provisionCapabilityKey
    && output.provisionCapabilityKey !== input.request.requestedCapabilityKey
  ) {
    throw new Error(
      `Reviewer worker output cannot redirect provisioning to ${output.provisionCapabilityKey}; expected ${input.request.requestedCapabilityKey}.`,
    );
  }

  validateVoteScopedFields({
    request: input.request,
    output,
  });

  const constraintMetadata = {
    source: "reviewer-worker-bridge",
    lane: output.lane,
    promptPackVersion: input.promptPack.schemaVersion,
    ...(output.requiredFollowups ? { requiredFollowups: output.requiredFollowups } : {}),
    ...(output.recommendedConstraints ? { reviewerConstraints: output.recommendedConstraints } : {}),
  };
  const reviewerExplanation = {
    summary: output.humanSummary
      ?? input.request.plainLanguageRisk?.plainLanguageSummary
      ?? output.reason,
    rationale: output.userFacingExplanation
      ?? input.request.plainLanguageRisk?.whyItIsRisky
      ?? output.reason,
    userImpact: input.request.plainLanguageRisk?.possibleConsequence
      ?? "This request changes the TAP execution path and needs an explicit reviewer decision.",
    nextStep: output.vote === "redirect_to_provisioning"
      ? "Wait for TMA to prepare the capability package before retrying this request."
      : output.vote === "escalate_to_human"
        ? "Stop and wait for a human decision."
        : output.vote === "defer"
          ? "Keep the request pending until its prerequisite or replay condition is satisfied."
          : "Continue on the approved runtime path with the reviewer constraints applied.",
  };

  const decision = createReviewDecision({
    decisionId: output.decisionId ?? `${input.request.requestId}:reviewer-worker`,
    requestId: input.request.requestId,
    vote: output.vote,
    reviewerId: output.reviewerId,
    mode: input.request.mode,
    reason: output.reason,
    riskLevel: output.riskLevel ?? input.request.riskLevel,
    plainLanguageRisk: input.request.plainLanguageRisk,
    reviewerExplanation,
    grantCompilerDirective:
      output.vote === "allow" || output.vote === "allow_with_constraints"
        ? {
            grantedTier: output.recommendedTier ?? input.request.requestedTier,
            grantedScope: {
              ...(output.recommendedScope ?? input.request.requestedScope ?? {}),
              ...(output.denyPatterns ? { denyPatterns: output.denyPatterns } : {}),
            },
            denyPatterns: output.denyPatterns,
            constraints: constraintMetadata,
          }
        : undefined,
    deferredReason: output.vote === "defer"
      ? output.deferredReason ?? "Deferred by bootstrap reviewer lane."
      : undefined,
    escalationTarget: output.vote === "escalate_to_human"
      ? output.escalationTarget ?? "human-review"
      : undefined,
    provisionCapabilityKey: output.vote === "redirect_to_provisioning"
      ? input.request.requestedCapabilityKey
      : undefined,
    createdAt: output.createdAt ?? input.request.createdAt,
    metadata: {
      source: "reviewer-worker-bridge",
      workerKind: output.workerKind,
      lane: output.lane,
      schemaVersion: output.schemaVersion,
      promptPackVersion: input.promptPack.schemaVersion,
      reviewerExplanation: {
        ...reviewerExplanation,
        contextFindings: output.contextFindings,
        operatorNotes: output.operatorNotes,
      },
      ...(output.requiredFollowups ? { requiredFollowups: output.requiredFollowups } : {}),
      ...(output.metadata ? { reviewerWorkerMetadata: output.metadata } : {}),
    },
  });

  assertReviewDecisionCompatibleWithRequest({
    request: input.request,
    decision,
  });
  return decision;
}

export interface ReviewerRuntimeWorkerInput {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
  reviewContext: ReviewContextApertureSnapshot;
  routed: ReviewRoutingResult;
  fallback: EvaluateReviewDecisionInput;
  promptPack: ReviewerWorkerPromptPack;
  workerEnvelope: ReviewerWorkerInputEnvelope;
}
