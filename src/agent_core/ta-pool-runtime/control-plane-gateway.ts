import { randomUUID } from "node:crypto";

import {
  createAccessRequest,
  createCapabilityGrant,
  type AccessRequest,
  type AccessRequestScope,
  type AgentCapabilityProfile,
  type CapabilityGrant,
  type DecisionToken,
  type ReviewDecision,
  type ReviewDecisionKind,
  type TaCapabilityTier,
  type TaPoolMode,
  type TaPoolRiskLevel,
} from "../ta-pool-types/index.js";
import {
  classifyCapabilityRisk,
  getModeRiskPolicyEntry,
  resolveBaselineCapability,
  toCapabilityAccessAssignment,
} from "../ta-pool-model/index.js";
import type {
  ReviewRoutingResult,
  RouteAccessRequestOptions,
} from "../ta-pool-review/review-routing.js";
import {
  assertReviewDecisionCompatibleWithRequest,
  compileGrantFromReviewDecision,
} from "../ta-pool-review/index.js";
import { routeAccessRequest } from "../ta-pool-review/review-routing.js";

export interface ResolveCapabilityAccessInput {
  sessionId: string;
  runId: string;
  agentId: string;
  capabilityKey: string;
  reason: string;
  requestedTier?: TaCapabilityTier;
  mode?: TaPoolMode;
  riskLevel?: TaPoolRiskLevel;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionBridgeRequestPlaceholder {
  bridgeRequestId: string;
  grantId: string;
  capabilityKey: string;
  grantedTier: TaCapabilityTier;
  mode: TaPoolMode;
  scope?: AccessRequestScope;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface BaselineGrantedResolution {
  status: "baseline_granted";
  grant: CapabilityGrant;
}

export interface ReviewRequiredResolution {
  status: "review_required";
  request: AccessRequest;
}

export type ResolveCapabilityAccessResult =
  | BaselineGrantedResolution
  | ReviewRequiredResolution;

export interface ReviewDecisionConsumedResult {
  status: ReviewDecisionKind;
  request: AccessRequest;
  grant?: CapabilityGrant;
  decisionToken?: DecisionToken;
  executionRequest?: ExecutionBridgeRequestPlaceholder;
  reviewDecision: ReviewDecision;
}

export type ControlPlaneOutcomeKind =
  | ResolveCapabilityAccessResult["status"]
  | ReviewDecisionKind;

export interface PendingExecutionAuthorization {
  request: AccessRequest;
  grant: CapabilityGrant;
  executionRequest: ExecutionBridgeRequestPlaceholder;
}

export interface TaControlPlaneGatewayOptions {
  profile: AgentCapabilityProfile;
  clock?: () => Date;
  idFactory?: () => string;
}

export interface TaControlPlaneGatewayLike {
  authorize(input: RouteAccessRequestOptions): ReviewRoutingResult;
  toExecutionGrant(result: ReviewRoutingResult): CapabilityGrant | undefined;
  shouldEnterExecution(result: ReviewRoutingResult): boolean;
  requiresProvisioning(result: ReviewRoutingResult): boolean;
  requiresHuman(result: ReviewRoutingResult): boolean;
  isDenied(result: ReviewRoutingResult): boolean;
}

export interface TaControlPlaneRouterOptions {
  reviewRouter?: (input: RouteAccessRequestOptions) => ReviewRoutingResult;
}

export interface TaControlPlaneAuthorizationInput {
  profile: AgentCapabilityProfile;
  request: AccessRequest;
  capabilityAvailable?: boolean;
  idFactory?: () => string;
  clock?: () => Date;
}

function isApprovedDecision(decision: ReviewDecision["decision"]): boolean {
  return decision === "approved" || decision === "partially_approved";
}

export class TaControlPlaneGateway {
  readonly profile: AgentCapabilityProfile;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #requests = new Map<string, AccessRequest>();
  readonly #decisions = new Map<string, ReviewDecision>();

  constructor(options: TaControlPlaneGatewayOptions) {
    this.profile = options.profile;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  resolveCapabilityAccess(input: ResolveCapabilityAccessInput): ResolveCapabilityAccessResult {
    const effectiveMode = input.mode ?? this.profile.defaultMode;
    const effectiveRiskLevel = input.riskLevel ?? classifyCapabilityRisk({
      capabilityKey: input.capabilityKey,
      requestedTier: input.requestedTier,
    }).riskLevel;
    const riskPolicy = getModeRiskPolicyEntry(effectiveMode, effectiveRiskLevel);
    const baseline = resolveBaselineCapability({
      profile: this.profile,
      capabilityKey: input.capabilityKey,
      requestedTier: input.requestedTier,
    });
    const baselineEligible = baseline.status === "baseline_allowed";
    const matrixAllowsAutoGrant =
      riskPolicy.decision === "allow"
      || (riskPolicy.baselineFastPath && baselineEligible);

    if (matrixAllowsAutoGrant) {
      return {
        status: "baseline_granted",
        grant: this.#createBaselineGrant(input, baseline.matchedPattern),
      };
    }

    const capabilityAccess = {
      assignment: toCapabilityAccessAssignment(baseline.status),
      matchedPattern: baseline.matchedPattern,
      profileId: this.profile.profileId,
    };

    return {
      status: "review_required",
      request: this.submitAccessRequest({
        ...input,
        riskLevel: effectiveRiskLevel,
        metadata: {
          ...(input.metadata ?? {}),
          capabilityAccess,
        },
      }),
    };
  }

  submitAccessRequest(input: ResolveCapabilityAccessInput): AccessRequest {
    const request = createAccessRequest({
      requestId: this.#idFactory(),
      sessionId: input.sessionId,
      runId: input.runId,
      agentId: input.agentId,
      requestedCapabilityKey: input.capabilityKey,
      requestedTier: input.requestedTier ?? "B1",
      reason: input.reason,
      taskContext: input.taskContext,
      requestedScope: input.requestedScope,
      requestedDurationMs: input.requestedDurationMs,
      mode: input.mode ?? this.profile.defaultMode,
      riskLevel: input.riskLevel,
      createdAt: this.#clock().toISOString(),
      metadata: input.metadata,
    });
    this.#requests.set(request.requestId, request);
    return request;
  }

  consumeReviewDecision(reviewDecision: ReviewDecision): ReviewDecisionConsumedResult {
    const request = this.#requests.get(reviewDecision.requestId);
    if (!request) {
      throw new Error(`Access request ${reviewDecision.requestId} was not found.`);
    }

    assertReviewDecisionCompatibleWithRequest({
      request,
      decision: reviewDecision,
    });
    this.#decisions.set(reviewDecision.decisionId, reviewDecision);
    if (reviewDecision.decision === "approved" || reviewDecision.decision === "partially_approved") {
      const compiled = compileGrantFromReviewDecision({
        compiledGrantId: this.#idFactory(),
        request,
        reviewDecision,
        issuedAt: this.#clock().toISOString(),
        compilerVersion: "tap-grant-compiler/v1",
        integrityMarker: `tap-grant-compiler/v1:${reviewDecision.decisionId}:${request.requestId}`,
      });
      return {
        status: reviewDecision.decision,
        request,
        grant: compiled.grant,
        decisionToken: compiled.decisionToken,
        executionRequest: this.lowerGrantToExecutionRequest(compiled.grant),
        reviewDecision,
      };
    }

    return {
      status: reviewDecision.decision,
      request,
      reviewDecision,
    };
  }

  lowerGrantToExecutionRequest(grant: CapabilityGrant): ExecutionBridgeRequestPlaceholder {
    return {
      bridgeRequestId: this.#idFactory(),
      grantId: grant.grantId,
      capabilityKey: grant.capabilityKey,
      grantedTier: grant.grantedTier,
      mode: grant.mode,
      scope: grant.grantedScope,
      constraints: grant.constraints,
      metadata: grant.metadata
        ? {
            ...grant.metadata,
            sourceDecisionId: grant.sourceDecisionId,
            decisionTokenId: grant.decisionTokenId,
            integrityMarker: grant.integrityMarker,
          }
        : {
            sourceDecisionId: grant.sourceDecisionId,
            decisionTokenId: grant.decisionTokenId,
            integrityMarker: grant.integrityMarker,
          },
    };
  }

  getRequest(requestId: string): AccessRequest | undefined {
    return this.#requests.get(requestId);
  }

  getDecision(decisionId: string): ReviewDecision | undefined {
    return this.#decisions.get(decisionId);
  }

  listRequests(): readonly AccessRequest[] {
    return [...this.#requests.values()];
  }

  restoreRequest(request: AccessRequest): void {
    this.#requests.set(request.requestId, request);
  }

  restoreDecision(decision: ReviewDecision): void {
    this.#decisions.set(decision.decisionId, decision);
  }

  #createBaselineGrant(
    input: ResolveCapabilityAccessInput,
    matchedPattern?: string,
  ): CapabilityGrant {
    return createCapabilityGrant({
      grantId: this.#idFactory(),
      requestId: `baseline:${input.capabilityKey}:${input.runId}`,
      capabilityKey: input.capabilityKey,
      grantedTier: input.requestedTier ?? this.profile.baselineTier,
      grantedScope: input.requestedScope,
      mode: input.mode ?? this.profile.defaultMode,
      issuedAt: this.#clock().toISOString(),
      constraints: {
        source: "baseline",
      },
      metadata: {
        ...(input.metadata ?? {}),
        capabilityAccess: {
          assignment: "baseline",
          matchedPattern,
          profileId: this.profile.profileId,
        },
      },
    });
  }
}

export class DefaultTaControlPlaneGateway implements TaControlPlaneGatewayLike {
  readonly #reviewRouter: (input: RouteAccessRequestOptions) => ReviewRoutingResult;

  constructor(options: TaControlPlaneRouterOptions = {}) {
    this.#reviewRouter = options.reviewRouter ?? routeAccessRequest;
  }

  authorize(input: TaControlPlaneAuthorizationInput): ReviewRoutingResult {
    return this.#reviewRouter(input);
  }

  toExecutionGrant(result: ReviewRoutingResult): CapabilityGrant | undefined {
    if (!isApprovedDecision(result.decision.decision)) {
      return undefined;
    }
    return result.grant ?? result.decision.grant;
  }

  shouldEnterExecution(result: ReviewRoutingResult): boolean {
    return this.toExecutionGrant(result) !== undefined;
  }

  requiresProvisioning(result: ReviewRoutingResult): boolean {
    return result.decision.decision === "redirected_to_provisioning";
  }

  requiresHuman(result: ReviewRoutingResult): boolean {
    return result.decision.decision === "escalated_to_human";
  }

  isDenied(result: ReviewRoutingResult): boolean {
    return result.decision.decision === "denied";
  }
}

export function createTaControlPlaneGateway(
  options: TaControlPlaneRouterOptions = {},
): TaControlPlaneGatewayLike {
  return new DefaultTaControlPlaneGateway(options);
}
