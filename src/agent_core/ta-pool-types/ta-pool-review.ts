import type { RunId, SessionId } from "../types/index.js";
import type { TaCapabilityTier, TaPoolMode } from "./ta-pool-profile.js";

export const REVIEW_DECISION_KINDS = [
  "approved",
  "partially_approved",
  "denied",
  "deferred",
  "escalated_to_human",
  "redirected_to_provisioning",
] as const;
export type ReviewDecisionKind = (typeof REVIEW_DECISION_KINDS)[number];

export interface AccessRequestScope {
  pathPatterns?: string[];
  allowedOperations?: string[];
  providerHints?: string[];
  metadata?: Record<string, unknown>;
}

export interface AccessRequest {
  requestId: string;
  sessionId: SessionId;
  runId: RunId;
  agentId: string;
  requestedCapabilityKey: string;
  requestedTier: TaCapabilityTier;
  reason: string;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  mode: TaPoolMode;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAccessRequestInput {
  requestId: string;
  sessionId: SessionId;
  runId: RunId;
  agentId: string;
  requestedCapabilityKey: string;
  requestedTier?: TaCapabilityTier;
  reason: string;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  mode: TaPoolMode;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityGrant {
  grantId: string;
  requestId: string;
  capabilityKey: string;
  grantedTier: TaCapabilityTier;
  grantedScope?: AccessRequestScope;
  mode: TaPoolMode;
  issuedAt: string;
  expiresAt?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ReviewDecision {
  decisionId: string;
  requestId: string;
  decision: ReviewDecisionKind;
  reviewerId?: string;
  mode: TaPoolMode;
  reason: string;
  grant?: CapabilityGrant;
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCapabilityGrantInput {
  grantId: string;
  requestId: string;
  capabilityKey: string;
  grantedTier: TaCapabilityTier;
  grantedScope?: AccessRequestScope;
  mode: TaPoolMode;
  issuedAt: string;
  expiresAt?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateReviewDecisionInput {
  decisionId: string;
  requestId: string;
  decision: ReviewDecisionKind;
  mode: TaPoolMode;
  reason: string;
  reviewerId?: string;
  grant?: CapabilityGrant;
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeScope(scope?: AccessRequestScope): AccessRequestScope | undefined {
  if (!scope) {
    return undefined;
  }

  return {
    pathPatterns: normalizeStringArray(scope.pathPatterns),
    allowedOperations: normalizeStringArray(scope.allowedOperations),
    providerHints: normalizeStringArray(scope.providerHints),
    metadata: scope.metadata,
  };
}

export function validateAccessRequest(request: AccessRequest): void {
  if (!request.requestId.trim()) {
    throw new Error("Access request requires a non-empty requestId.");
  }

  if (!request.agentId.trim()) {
    throw new Error("Access request requires a non-empty agentId.");
  }

  if (!request.requestedCapabilityKey.trim()) {
    throw new Error("Access request requires a non-empty requestedCapabilityKey.");
  }

  if (!request.reason.trim()) {
    throw new Error("Access request requires a non-empty reason.");
  }
}

export function createAccessRequest(input: CreateAccessRequestInput): AccessRequest {
  const request: AccessRequest = {
    requestId: input.requestId.trim(),
    sessionId: input.sessionId,
    runId: input.runId,
    agentId: input.agentId.trim(),
    requestedCapabilityKey: input.requestedCapabilityKey.trim(),
    requestedTier: input.requestedTier ?? "B1",
    reason: input.reason.trim(),
    taskContext: input.taskContext,
    requestedScope: normalizeScope(input.requestedScope),
    requestedDurationMs: input.requestedDurationMs,
    mode: input.mode,
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateAccessRequest(request);
  return request;
}

export function validateCapabilityGrant(grant: CapabilityGrant): void {
  if (!grant.grantId.trim()) {
    throw new Error("Capability grant requires a non-empty grantId.");
  }

  if (!grant.requestId.trim()) {
    throw new Error("Capability grant requires a non-empty requestId.");
  }

  if (!grant.capabilityKey.trim()) {
    throw new Error("Capability grant requires a non-empty capabilityKey.");
  }
}

export function createCapabilityGrant(input: CreateCapabilityGrantInput): CapabilityGrant {
  const grant: CapabilityGrant = {
    grantId: input.grantId.trim(),
    requestId: input.requestId.trim(),
    capabilityKey: input.capabilityKey.trim(),
    grantedTier: input.grantedTier,
    grantedScope: normalizeScope(input.grantedScope),
    mode: input.mode,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    constraints: input.constraints,
    metadata: input.metadata,
  };

  validateCapabilityGrant(grant);
  return grant;
}

export function validateReviewDecision(reviewDecision: ReviewDecision): void {
  if (!reviewDecision.decisionId.trim()) {
    throw new Error("Review decision requires a non-empty decisionId.");
  }

  if (!reviewDecision.requestId.trim()) {
    throw new Error("Review decision requires a non-empty requestId.");
  }

  if (!reviewDecision.reason.trim()) {
    throw new Error("Review decision requires a non-empty reason.");
  }

  if (reviewDecision.decision === "approved" || reviewDecision.decision === "partially_approved") {
    if (!reviewDecision.grant) {
      throw new Error(`Review decision ${reviewDecision.decision} requires a grant.`);
    }
  }

  if (reviewDecision.decision === "deferred" && !reviewDecision.deferredReason?.trim()) {
    throw new Error("Deferred review decisions require a deferredReason.");
  }

  if (reviewDecision.decision === "escalated_to_human" && !reviewDecision.escalationTarget?.trim()) {
    throw new Error("Human escalations require an escalationTarget.");
  }

  if (reviewDecision.decision === "redirected_to_provisioning" && !reviewDecision.provisionCapabilityKey?.trim()) {
    throw new Error("Provision redirects require a provisionCapabilityKey.");
  }
}

export function createReviewDecision(input: CreateReviewDecisionInput): ReviewDecision {
  const reviewDecision: ReviewDecision = {
    decisionId: input.decisionId.trim(),
    requestId: input.requestId.trim(),
    decision: input.decision,
    reviewerId: input.reviewerId?.trim() || undefined,
    mode: input.mode,
    reason: input.reason.trim(),
    grant: input.grant,
    deferredReason: input.deferredReason?.trim() || undefined,
    escalationTarget: input.escalationTarget?.trim() || undefined,
    provisionCapabilityKey: input.provisionCapabilityKey?.trim() || undefined,
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateReviewDecision(reviewDecision);
  return reviewDecision;
}

export function isTerminalReviewDecision(decision: ReviewDecisionKind): boolean {
  return (
    decision === "approved" ||
    decision === "partially_approved" ||
    decision === "denied" ||
    decision === "escalated_to_human"
  );
}
