import type {
  AccessRequest,
  ReviewDecision,
  ReviewDecisionKind,
  ReviewVote,
  TaCapabilityTier,
  TaPoolMode,
} from "../ta-pool-types/index.js";

export const REVIEWER_DURABLE_STAGES = [
  "waiting_human",
  "ready_to_resume",
  "completed",
] as const;
export type ReviewerDurableStage =
  (typeof REVIEWER_DURABLE_STAGES)[number];

export const REVIEWER_DURABLE_SOURCES = [
  "routing_fast_path",
  "review_engine",
  "llm_hook",
] as const;
export type ReviewerDurableSource =
  (typeof REVIEWER_DURABLE_SOURCES)[number];

export interface ReviewerDurableState {
  requestId: string;
  sessionId: string;
  runId: string;
  agentId: string;
  capabilityKey: string;
  requestedTier: TaCapabilityTier;
  mode: TaPoolMode;
  canonicalMode: AccessRequest["canonicalMode"];
  stage: ReviewerDurableStage;
  source: ReviewerDurableSource;
  decisionId: string;
  decision: ReviewDecisionKind;
  vote: ReviewVote;
  reviewerId?: string;
  reason: string;
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
  plainLanguageRiskSummary?: string;
  hasGrantCompilerDirective: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateReviewerDurableStateInput {
  request: AccessRequest;
  decision: ReviewDecision;
  source: ReviewerDurableSource;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewerDurableSnapshot {
  states: ReviewerDurableState[];
  metadata?: Record<string, unknown>;
}

function mapDecisionToStage(decision: ReviewDecisionKind): ReviewerDurableStage {
  switch (decision) {
    case "escalated_to_human":
      return "waiting_human";
    case "deferred":
    case "redirected_to_provisioning":
      return "ready_to_resume";
    case "approved":
    case "partially_approved":
    case "denied":
      return "completed";
  }
}

function assertReviewerDurableBoundary(decision: ReviewDecision): void {
  if (decision.grant) {
    throw new Error(
      "Reviewer durable state is vote-only and cannot persist inline grants.",
    );
  }
}

export function createReviewerDurableState(
  input: CreateReviewerDurableStateInput,
): ReviewerDurableState {
  assertReviewerDurableBoundary(input.decision);

  return {
    requestId: input.request.requestId,
    sessionId: input.request.sessionId,
    runId: input.request.runId,
    agentId: input.request.agentId,
    capabilityKey: input.request.requestedCapabilityKey,
    requestedTier: input.request.requestedTier,
    mode: input.request.mode,
    canonicalMode: input.request.canonicalMode,
    stage: mapDecisionToStage(input.decision.decision),
    source: input.source,
    decisionId: input.decision.decisionId,
    decision: input.decision.decision,
    vote: input.decision.vote,
    reviewerId: input.decision.reviewerId,
    reason: input.decision.reason,
    deferredReason: input.decision.deferredReason,
    escalationTarget: input.decision.escalationTarget,
    provisionCapabilityKey: input.decision.provisionCapabilityKey,
    plainLanguageRiskSummary: input.decision.plainLanguageRisk?.plainLanguageSummary,
    hasGrantCompilerDirective: input.decision.grantCompilerDirective !== undefined,
    createdAt: input.decision.createdAt,
    updatedAt: input.updatedAt ?? input.decision.createdAt,
    metadata: {
      requestedAction: input.request.requestedAction,
      riskLevel: input.request.riskLevel,
      ...(input.metadata ?? {}),
    },
  };
}

export function createReviewerDurableSnapshot(
  states: Iterable<ReviewerDurableState>,
  metadata?: Record<string, unknown>,
): ReviewerDurableSnapshot {
  return {
    states: [...states],
    metadata,
  };
}

export function hydrateReviewerDurableSnapshot(
  snapshot: ReviewerDurableSnapshot | undefined,
): Map<string, ReviewerDurableState> {
  const result = new Map<string, ReviewerDurableState>();
  for (const state of snapshot?.states ?? []) {
    if (result.has(state.requestId)) {
      throw new Error(
        `Duplicate reviewer durable state requestId detected: ${state.requestId}.`,
      );
    }
    result.set(state.requestId, state);
  }
  return result;
}
