import type { CapabilityInvocationPlan } from "../capability-types/index.js";
import type { IntentPriority } from "../types/index.js";
import type {
  AccessRequest,
  CapabilityGrant,
} from "../ta-pool-types/index.js";

export interface TaExecutionBridgeInput {
  grant: CapabilityGrant;
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
      ...(input.metadata ?? {}),
      ...(input.grant.metadata ?? {}),
    },
  };
}

export function lowerGrantToCapabilityPlan(input: TaExecutionBridgeInput): CapabilityInvocationPlan {
  const capabilityKey = input.grant.capabilityKey || input.request.requestedCapabilityKey;
  const derivedOperation = capabilityKey.split(".").slice(1).join(".");
  return {
    planId: input.planId,
    intentId: input.intentId,
    sessionId: input.request.sessionId,
    runId: input.request.runId,
    capabilityKey,
    operation: input.operation ?? (derivedOperation || capabilityKey),
    input: {
      ...(input.input ?? {}),
      taGrant: {
        grantId: input.grant.grantId,
        grantedTier: input.grant.grantedTier,
        mode: input.grant.mode,
      },
    },
    timeoutMs: input.timeoutMs,
    idempotencyKey: `${input.grant.grantId}:${input.intentId}`,
    priority: input.priority ?? "normal",
    traceContext: input.traceContext,
    metadata: {
      bridge: "ta-pool",
      requestId: input.planId,
      grantId: input.grant.grantId,
      ...(input.metadata ?? {}),
    },
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
