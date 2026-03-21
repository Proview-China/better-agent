import type { CapabilityCallIntent, CapabilityPortRequest } from "../types/index.js";
import type {
  CapabilityExecutionHandle,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import {
  createCapabilityExecutionHandle as createNewCapabilityExecutionHandle,
  createPreparedCapabilityCall as createNewPreparedCapabilityCall,
} from "./capability-execution.js";
import {
  createCapabilityInvocationPlanFromIntent,
  createCapabilityInvocationPlanFromRequest,
  deriveCapabilityOperation,
} from "./capability-plan.js";

export function createInvocationPlanFromCapabilityIntent(intent: CapabilityCallIntent): CapabilityInvocationPlan {
  return createCapabilityInvocationPlanFromIntent(intent, {
    idFactory: () => intent.intentId,
    operation: deriveCapabilityOperation(intent.request.capabilityKey),
  });
}

export function createInvocationPlanFromRequest(params: {
  request: CapabilityPortRequest;
  priority: CapabilityCallIntent["priority"];
  metadata?: Record<string, unknown>;
}): CapabilityInvocationPlan {
  return createCapabilityInvocationPlanFromRequest(params.request, {
    idFactory: () => params.request.intentId,
    operation: deriveCapabilityOperation(params.request.capabilityKey),
    metadata: params.metadata,
  });
}

export function createPreparedCapabilityCall(params: {
  preparedId: string;
  lease: CapabilityLease;
  plan: CapabilityInvocationPlan;
  executionMode?: PreparedCapabilityCall["executionMode"];
  preparedPayloadRef?: string;
  cacheKey?: string;
}): PreparedCapabilityCall {
  return createNewPreparedCapabilityCall(
    {
      lease: params.lease,
      capabilityKey: params.plan.capabilityKey,
      executionMode: params.executionMode,
      preparedPayloadRef: params.preparedPayloadRef,
      cacheKey: params.cacheKey,
      metadata: {
        ...(params.plan.metadata ?? {}),
      },
    },
    {
      idFactory: () => params.preparedId,
    },
  );
}

export function createCapabilityExecutionHandle(params: {
  executionId: string;
  prepared: PreparedCapabilityCall;
  startedAt: string;
  state?: CapabilityExecutionHandle["state"];
}): CapabilityExecutionHandle {
  return createNewCapabilityExecutionHandle(
    {
      prepared: params.prepared,
      state: params.state ?? "running",
    },
    {
      idFactory: () => params.executionId,
      clock: {
        now: () => new Date(params.startedAt),
      },
    },
  );
}

export const createPreparedCapabilityCallFromPlan = createPreparedCapabilityCall;
export const createLegacyCapabilityExecutionHandle = createCapabilityExecutionHandle;
