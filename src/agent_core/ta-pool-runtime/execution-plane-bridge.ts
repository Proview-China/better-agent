import type { CapabilityInvocationPlan } from "../capability-types/index.js";
import type { CapabilityGrant } from "../ta-pool-types/index.js";

export interface TaPoolExecutionRequest {
  requestId: string;
  sessionId: string;
  runId: string;
  intentId: string;
  capabilityKey: string;
  operation: string;
  input: Record<string, unknown>;
  priority: CapabilityInvocationPlan["priority"];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export type GrantExecutionRequest = TaPoolExecutionRequest;

export interface GrantToInvocationPlanInput {
  grant: CapabilityGrant;
  request: TaPoolExecutionRequest;
}

function deriveOperation(capabilityKey: string): string {
  return capabilityKey.split(".").slice(1).join(".") || capabilityKey;
}

export function createExecutionRequest(input: TaPoolExecutionRequest): TaPoolExecutionRequest {
  return {
    ...input,
    operation: input.operation.trim() || deriveOperation(input.capabilityKey),
  };
}

export function canGrantExecuteRequest(
  input: Partial<TaPoolExecutionRequest>,
): input is TaPoolExecutionRequest {
  return (
    typeof input.requestId === "string" &&
    input.requestId.length > 0 &&
    typeof input.sessionId === "string" &&
    input.sessionId.length > 0 &&
    typeof input.runId === "string" &&
    input.runId.length > 0 &&
    typeof input.intentId === "string" &&
    input.intentId.length > 0 &&
    typeof input.capabilityKey === "string" &&
    input.capabilityKey.length > 0 &&
    typeof input.operation === "string" &&
    !!input.input &&
    typeof input.input === "object" &&
    typeof input.priority === "string"
  );
}

export function createInvocationPlanFromGrant(
  input: GrantToInvocationPlanInput,
): CapabilityInvocationPlan {
  const request = createExecutionRequest(input.request);
  return {
    planId: request.requestId,
    intentId: request.intentId,
    sessionId: request.sessionId,
    runId: request.runId,
    capabilityKey: input.grant.capabilityKey,
    operation: request.operation,
    input: request.input,
    timeoutMs: request.timeoutMs,
    idempotencyKey: `${input.grant.grantId}:${request.requestId}`,
    priority: request.priority,
    metadata: {
      grantId: input.grant.grantId,
      grantTier: input.grant.grantedTier,
      grantMode: input.grant.mode,
      grantedScope: input.grant.grantedScope,
      constraints: input.grant.constraints,
      ...(input.grant.metadata ?? {}),
      ...(request.metadata ?? {}),
    },
  };
}
