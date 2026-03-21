import type { CapabilityInvocationPlan } from "../capability-types/index.js";
import type { IntentPriority } from "../types/index.js";
import type {
  AccessRequest,
  CapabilityGrant,
  DecisionToken,
} from "../ta-pool-types/index.js";
import {
  createExecutionGovernanceMetadata,
  createExecutionRequest,
  createInvocationPlanFromGrant as createInvocationPlanFromExecutionRequest,
} from "./execution-plane-bridge.js";

export interface TaExecutionBridgeInput {
  grant: CapabilityGrant;
  decisionToken?: DecisionToken;
  request: Pick<AccessRequest, "sessionId" | "runId" | "requestedCapabilityKey">;
  planId: string;
  intentId: string;
  operation?: string;
  input?: Record<string, unknown>;
  timeoutMs?: number;
  priority?: IntentPriority;
  traceContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TaExecutionBridgeRequest {
  requestId: string;
  grantId: string;
  capabilityKey: string;
  sessionId: string;
  runId: string;
  constraints?: Record<string, unknown>;
  scope?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type GrantExecutionRequest = TaExecutionBridgeRequest;

export function createTaExecutionBridgeRequest(input: TaExecutionBridgeInput): TaExecutionBridgeRequest {
  const derivedOperation = input.grant.capabilityKey.split(".").slice(1).join(".");
  const operation = input.operation ?? (derivedOperation || input.grant.capabilityKey);
  const executionGovernance = createExecutionGovernanceMetadata({
    capabilityKey: input.grant.capabilityKey,
    operation,
    input: input.input ?? {},
  });

  return {
    requestId: input.planId,
    grantId: input.grant.grantId,
    capabilityKey: input.grant.capabilityKey,
    sessionId: input.request.sessionId,
    runId: input.request.runId,
    constraints: input.grant.constraints,
    scope: input.grant.grantedScope?.metadata,
    metadata: {
      mode: input.grant.mode,
      grantedTier: input.grant.grantedTier,
      executionGovernance,
      ...(input.metadata ?? {}),
      ...(input.grant.metadata ?? {}),
    },
  };
}

export function lowerGrantToCapabilityPlan(input: TaExecutionBridgeInput): CapabilityInvocationPlan {
  const capabilityKey = input.grant.capabilityKey || input.request.requestedCapabilityKey;
  const operation = input.operation ?? (capabilityKey.split(".").slice(1).join(".") || capabilityKey);
  const request = createExecutionRequest({
    requestId: input.planId,
    sessionId: input.request.sessionId,
    runId: input.request.runId,
    intentId: input.intentId,
    capabilityKey,
    operation,
    input: input.input ?? {},
    timeoutMs: input.timeoutMs,
    priority: input.priority ?? "normal",
    metadata: {
      ...(input.metadata ?? {}),
    },
  });
  const basePlan = createInvocationPlanFromExecutionRequest({
    grant: input.grant,
    request,
    decisionToken: input.decisionToken,
  });

  return {
    ...basePlan,
    traceContext: input.traceContext,
    input: {
      ...(basePlan.input as Record<string, unknown>),
      taGrant: {
        grantId: input.grant.grantId,
        grantedTier: input.grant.grantedTier,
        mode: input.grant.mode,
        executionGovernance: request.metadata?.executionGovernance,
      },
    },
    idempotencyKey: `${input.grant.grantId}:${input.intentId}`,
  };
}

export function createInvocationPlanFromGrant(input: TaExecutionBridgeInput): CapabilityInvocationPlan {
  return lowerGrantToCapabilityPlan(input);
}

export function canGrantExecuteRequest(params: {
  grant: CapabilityGrant | undefined;
}): params is { grant: CapabilityGrant } {
  return params.grant !== undefined;
}
