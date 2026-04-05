import type { RunId, SessionId } from "../types/index.js";
import {
  TA_CAPABILITY_TIERS,
  isTaPoolMode,
  toCanonicalTaPoolMode,
  type CanonicalTaPoolMode,
  type TaCapabilityTier,
  type TaPoolMode,
} from "./ta-pool-profile.js";

export const TA_POOL_RISK_LEVELS = [
  "normal",
  "risky",
  "dangerous",
] as const;
export type TaPoolRiskLevel = (typeof TA_POOL_RISK_LEVELS)[number];

export const REVIEW_VOTES = [
  "allow",
  "allow_with_constraints",
  "deny",
  "defer",
  "escalate_to_human",
  "redirect_to_provisioning",
] as const;
export type ReviewVote = (typeof REVIEW_VOTES)[number];

export const REVIEW_DECISION_KINDS = [
  "approved",
  "partially_approved",
  "denied",
  "deferred",
  "escalated_to_human",
  "redirected_to_provisioning",
] as const;
export type ReviewDecisionKind = (typeof REVIEW_DECISION_KINDS)[number];

export interface PlainLanguageRiskUserAction {
  actionId: string;
  label: string;
  description?: string;
  kind:
    | "approve"
    | "deny"
    | "defer"
    | "view_details"
    | "ask_for_safer_alternative";
  metadata?: Record<string, unknown>;
}

export interface PlainLanguageRiskPayload {
  plainLanguageSummary: string;
  requestedAction: string;
  riskLevel: TaPoolRiskLevel;
  whyItIsRisky: string;
  possibleConsequence: string;
  whatHappensIfNotRun: string;
  availableUserActions: PlainLanguageRiskUserAction[];
  metadata?: Record<string, unknown>;
}

export interface CreatePlainLanguageRiskPayloadInput {
  plainLanguageSummary: string;
  requestedAction: string;
  riskLevel: TaPoolRiskLevel;
  whyItIsRisky: string;
  possibleConsequence: string;
  whatHappensIfNotRun: string;
  availableUserActions: PlainLanguageRiskUserAction[];
  metadata?: Record<string, unknown>;
}

export interface AccessRequestScope {
  pathPatterns?: string[];
  allowedOperations?: string[];
  providerHints?: string[];
  denyPatterns?: string[];
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
  requestedAction?: string;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  mode: TaPoolMode;
  canonicalMode: CanonicalTaPoolMode;
  riskLevel?: TaPoolRiskLevel;
  plainLanguageRisk?: PlainLanguageRiskPayload;
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
  requestedAction?: string;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  mode: TaPoolMode;
  riskLevel?: TaPoolRiskLevel;
  plainLanguageRisk?: PlainLanguageRiskPayload;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GrantCompilerDirective {
  capabilityKey?: string;
  grantedTier?: TaCapabilityTier;
  grantedScope?: AccessRequestScope;
  expiresAt?: string;
  constraints?: Record<string, unknown>;
  denyPatterns?: string[];
  metadata?: Record<string, unknown>;
}

export interface ReviewerStructuredExplanation {
  summary: string;
  rationale: string;
  userImpact: string;
  nextStep: string;
}

export interface CapabilityGrant {
  grantId: string;
  requestId: string;
  capabilityKey: string;
  grantedTier: TaCapabilityTier;
  grantedScope?: AccessRequestScope;
  mode: TaPoolMode;
  canonicalMode: CanonicalTaPoolMode;
  issuedAt: string;
  expiresAt?: string;
  reviewVote?: ReviewVote;
  sourceDecisionId?: string;
  decisionTokenId?: string;
  compilerVersion?: string;
  integrityMarker?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ReviewDecision {
  decisionId: string;
  requestId: string;
  decision: ReviewDecisionKind;
  vote: ReviewVote;
  reviewerId?: string;
  mode: TaPoolMode;
  canonicalMode: CanonicalTaPoolMode;
  reason: string;
  riskLevel?: TaPoolRiskLevel;
  plainLanguageRisk?: PlainLanguageRiskPayload;
  reviewerExplanation?: ReviewerStructuredExplanation;
  grant?: CapabilityGrant;
  grantCompilerDirective?: GrantCompilerDirective;
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
  reviewVote?: ReviewVote;
  sourceDecisionId?: string;
  decisionTokenId?: string;
  compilerVersion?: string;
  integrityMarker?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateReviewDecisionInput {
  decisionId: string;
  requestId: string;
  decision?: ReviewDecisionKind;
  vote?: ReviewVote;
  mode: TaPoolMode;
  reason: string;
  reviewerId?: string;
  riskLevel?: TaPoolRiskLevel;
  plainLanguageRisk?: PlainLanguageRiskPayload;
  reviewerExplanation?: ReviewerStructuredExplanation;
  grant?: CapabilityGrant;
  grantCompilerDirective?: GrantCompilerDirective;
  deferredReason?: string;
  escalationTarget?: string;
  provisionCapabilityKey?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionToken {
  requestId: string;
  decisionId: string;
  compiledGrantId: string;
  mode: TaPoolMode;
  canonicalMode: CanonicalTaPoolMode;
  issuedAt: string;
  expiresAt?: string;
  signatureOrIntegrityMarker: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDecisionTokenInput {
  requestId: string;
  decisionId: string;
  compiledGrantId: string;
  mode: TaPoolMode;
  issuedAt: string;
  expiresAt?: string;
  signatureOrIntegrityMarker: string;
  metadata?: Record<string, unknown>;
}

export interface GrantCompilerInput {
  compiledGrantId: string;
  request: Pick<
    AccessRequest,
    | "requestId"
    | "requestedCapabilityKey"
    | "requestedTier"
    | "requestedScope"
    | "mode"
    | "canonicalMode"
    | "riskLevel"
  >;
  reviewDecision: Pick<
    ReviewDecision,
    | "decisionId"
    | "vote"
    | "mode"
    | "canonicalMode"
    | "riskLevel"
    | "grantCompilerDirective"
    | "plainLanguageRisk"
  >;
  issuedAt: string;
  compilerVersion?: string;
  integrityMarker: string;
  expiresAt?: string;
}

export interface CompiledGrantEnvelope {
  grant: CapabilityGrant;
  decisionToken: DecisionToken;
  plainLanguageRisk?: PlainLanguageRiskPayload;
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
    denyPatterns: normalizeStringArray(scope.denyPatterns),
    metadata: scope.metadata,
  };
}

function normalizeRiskAction(
  action: PlainLanguageRiskUserAction,
): PlainLanguageRiskUserAction {
  return {
    actionId: action.actionId.trim(),
    label: action.label.trim(),
    description: action.description?.trim() || undefined,
    kind: action.kind,
    metadata: action.metadata,
  };
}

export function validatePlainLanguageRiskPayload(
  payload: PlainLanguageRiskPayload,
): void {
  if (!payload.plainLanguageSummary.trim()) {
    throw new Error("Plain-language risk payload requires a non-empty plainLanguageSummary.");
  }

  if (!payload.requestedAction.trim()) {
    throw new Error("Plain-language risk payload requires a non-empty requestedAction.");
  }

  if (!TA_POOL_RISK_LEVELS.includes(payload.riskLevel)) {
    throw new Error(`Unsupported ta-pool risk level: ${payload.riskLevel}.`);
  }

  if (!payload.whyItIsRisky.trim()) {
    throw new Error("Plain-language risk payload requires a non-empty whyItIsRisky.");
  }

  if (!payload.possibleConsequence.trim()) {
    throw new Error("Plain-language risk payload requires a non-empty possibleConsequence.");
  }

  if (!payload.whatHappensIfNotRun.trim()) {
    throw new Error("Plain-language risk payload requires a non-empty whatHappensIfNotRun.");
  }

  if (payload.availableUserActions.length === 0) {
    throw new Error("Plain-language risk payload requires at least one availableUserAction.");
  }

  for (const action of payload.availableUserActions) {
    if (!action.actionId.trim()) {
      throw new Error("Plain-language risk action requires a non-empty actionId.");
    }

    if (!action.label.trim()) {
      throw new Error("Plain-language risk action requires a non-empty label.");
    }
  }
}

export function createPlainLanguageRiskPayload(
  input: CreatePlainLanguageRiskPayloadInput,
): PlainLanguageRiskPayload {
  const payload: PlainLanguageRiskPayload = {
    plainLanguageSummary: input.plainLanguageSummary.trim(),
    requestedAction: input.requestedAction.trim(),
    riskLevel: input.riskLevel,
    whyItIsRisky: input.whyItIsRisky.trim(),
    possibleConsequence: input.possibleConsequence.trim(),
    whatHappensIfNotRun: input.whatHappensIfNotRun.trim(),
    availableUserActions: input.availableUserActions.map(normalizeRiskAction),
    metadata: input.metadata,
  };

  validatePlainLanguageRiskPayload(payload);
  return payload;
}

function normalizePlainLanguageRisk(
  payload?: PlainLanguageRiskPayload,
): PlainLanguageRiskPayload | undefined {
  if (!payload) {
    return undefined;
  }

  const normalized = createPlainLanguageRiskPayload(payload);
  return normalized;
}

function normalizeReviewerStructuredExplanation(
  explanation?: ReviewerStructuredExplanation,
): ReviewerStructuredExplanation | undefined {
  if (!explanation) {
    return undefined;
  }

  return {
    summary: explanation.summary.trim(),
    rationale: explanation.rationale.trim(),
    userImpact: explanation.userImpact.trim(),
    nextStep: explanation.nextStep.trim(),
  };
}

function normalizeGrantCompilerDirective(
  directive?: GrantCompilerDirective,
): GrantCompilerDirective | undefined {
  if (!directive) {
    return undefined;
  }

  return {
    capabilityKey: directive.capabilityKey?.trim() || undefined,
    grantedTier: directive.grantedTier,
    grantedScope: normalizeScope(directive.grantedScope),
    expiresAt: directive.expiresAt,
    constraints: directive.constraints,
    denyPatterns: normalizeStringArray(directive.denyPatterns),
    metadata: directive.metadata,
  };
}

export function reviewVoteToDecisionKind(vote: ReviewVote): ReviewDecisionKind {
  switch (vote) {
    case "allow":
      return "approved";
    case "allow_with_constraints":
      return "partially_approved";
    case "deny":
      return "denied";
    case "defer":
      return "deferred";
    case "escalate_to_human":
      return "escalated_to_human";
    case "redirect_to_provisioning":
      return "redirected_to_provisioning";
  }
}

export function decisionKindToReviewVote(decision: ReviewDecisionKind): ReviewVote {
  switch (decision) {
    case "approved":
      return "allow";
    case "partially_approved":
      return "allow_with_constraints";
    case "denied":
      return "deny";
    case "deferred":
      return "defer";
    case "escalated_to_human":
      return "escalate_to_human";
    case "redirected_to_provisioning":
      return "redirect_to_provisioning";
  }
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

  if (!isTaPoolMode(request.mode)) {
    throw new Error(`Unsupported ta-pool mode: ${request.mode}.`);
  }

  if (!TA_POOL_RISK_LEVELS.includes(request.riskLevel ?? "normal")) {
    throw new Error(`Unsupported ta-pool risk level: ${request.riskLevel}.`);
  }

  if (request.plainLanguageRisk) {
    validatePlainLanguageRiskPayload(request.plainLanguageRisk);
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
    requestedAction: input.requestedAction?.trim() || undefined,
    taskContext: input.taskContext,
    requestedScope: normalizeScope(input.requestedScope),
    requestedDurationMs: input.requestedDurationMs,
    mode: input.mode,
    canonicalMode: toCanonicalTaPoolMode(input.mode),
    riskLevel: input.riskLevel,
    plainLanguageRisk: normalizePlainLanguageRisk(input.plainLanguageRisk),
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

  if (!TA_CAPABILITY_TIERS.includes(grant.grantedTier)) {
    throw new Error(`Unsupported ta capability tier: ${grant.grantedTier}.`);
  }

  if (!isTaPoolMode(grant.mode)) {
    throw new Error(`Unsupported ta-pool mode: ${grant.mode}.`);
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
    canonicalMode: toCanonicalTaPoolMode(input.mode),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    reviewVote: input.reviewVote,
    sourceDecisionId: input.sourceDecisionId?.trim() || undefined,
    decisionTokenId: input.decisionTokenId?.trim() || undefined,
    compilerVersion: input.compilerVersion?.trim() || undefined,
    integrityMarker: input.integrityMarker?.trim() || undefined,
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

  if (!isTaPoolMode(reviewDecision.mode)) {
    throw new Error(`Unsupported ta-pool mode: ${reviewDecision.mode}.`);
  }

  if (reviewDecision.riskLevel && !TA_POOL_RISK_LEVELS.includes(reviewDecision.riskLevel)) {
    throw new Error(`Unsupported ta-pool risk level: ${reviewDecision.riskLevel}.`);
  }

  if (reviewDecision.plainLanguageRisk) {
    validatePlainLanguageRiskPayload(reviewDecision.plainLanguageRisk);
  }

  if (reviewDecision.reviewerExplanation) {
    if (!reviewDecision.reviewerExplanation.summary.trim()) {
      throw new Error("Reviewer explanation requires a non-empty summary.");
    }
    if (!reviewDecision.reviewerExplanation.rationale.trim()) {
      throw new Error("Reviewer explanation requires a non-empty rationale.");
    }
    if (!reviewDecision.reviewerExplanation.userImpact.trim()) {
      throw new Error("Reviewer explanation requires a non-empty userImpact.");
    }
    if (!reviewDecision.reviewerExplanation.nextStep.trim()) {
      throw new Error("Reviewer explanation requires a non-empty nextStep.");
    }
  }

  if (
    reviewDecision.vote === "allow" ||
    reviewDecision.vote === "allow_with_constraints"
  ) {
    if (!reviewDecision.grant && !reviewDecision.grantCompilerDirective) {
      throw new Error(
        `Review vote ${reviewDecision.vote} requires a grant or grantCompilerDirective.`,
      );
    }
  }

  if (reviewDecision.vote === "defer" && !reviewDecision.deferredReason?.trim()) {
    throw new Error("Deferred review decisions require a deferredReason.");
  }

  if (
    reviewDecision.vote === "escalate_to_human" &&
    !reviewDecision.escalationTarget?.trim()
  ) {
    throw new Error("Human escalations require an escalationTarget.");
  }

  if (
    reviewDecision.vote === "redirect_to_provisioning" &&
    !reviewDecision.provisionCapabilityKey?.trim()
  ) {
    throw new Error("Provision redirects require a provisionCapabilityKey.");
  }
}

export function createReviewDecision(input: CreateReviewDecisionInput): ReviewDecision {
  const vote = input.vote ?? decisionKindToReviewVote(input.decision ?? "deferred");
  const decision = input.decision ?? reviewVoteToDecisionKind(vote);
  const reviewDecision: ReviewDecision = {
    decisionId: input.decisionId.trim(),
    requestId: input.requestId.trim(),
    decision,
    vote,
    reviewerId: input.reviewerId?.trim() || undefined,
    mode: input.mode,
    canonicalMode: toCanonicalTaPoolMode(input.mode),
    reason: input.reason.trim(),
    riskLevel: input.riskLevel,
    plainLanguageRisk: normalizePlainLanguageRisk(input.plainLanguageRisk),
    reviewerExplanation: normalizeReviewerStructuredExplanation(input.reviewerExplanation),
    grant: input.grant,
    grantCompilerDirective: normalizeGrantCompilerDirective(input.grantCompilerDirective),
    deferredReason: input.deferredReason?.trim() || undefined,
    escalationTarget: input.escalationTarget?.trim() || undefined,
    provisionCapabilityKey: input.provisionCapabilityKey?.trim() || undefined,
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateReviewDecision(reviewDecision);
  return reviewDecision;
}

export function validateDecisionToken(token: DecisionToken): void {
  if (!token.requestId.trim()) {
    throw new Error("Decision token requires a non-empty requestId.");
  }

  if (!token.decisionId.trim()) {
    throw new Error("Decision token requires a non-empty decisionId.");
  }

  if (!token.compiledGrantId.trim()) {
    throw new Error("Decision token requires a non-empty compiledGrantId.");
  }

  if (!isTaPoolMode(token.mode)) {
    throw new Error(`Unsupported ta-pool mode: ${token.mode}.`);
  }

  if (!token.signatureOrIntegrityMarker.trim()) {
    throw new Error("Decision token requires a non-empty signatureOrIntegrityMarker.");
  }
}

export function createDecisionToken(input: CreateDecisionTokenInput): DecisionToken {
  const token: DecisionToken = {
    requestId: input.requestId.trim(),
    decisionId: input.decisionId.trim(),
    compiledGrantId: input.compiledGrantId.trim(),
    mode: input.mode,
    canonicalMode: toCanonicalTaPoolMode(input.mode),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    signatureOrIntegrityMarker: input.signatureOrIntegrityMarker.trim(),
    metadata: input.metadata,
  };

  validateDecisionToken(token);
  return token;
}

export function isTerminalReviewDecision(decision: ReviewDecisionKind): boolean {
  return (
    decision === "approved" ||
    decision === "partially_approved" ||
    decision === "denied" ||
    decision === "escalated_to_human"
  );
}
