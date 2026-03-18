import { randomUUID } from "node:crypto";

import type {
  CapabilityExecutionHandle,
  CapabilityExecutionMode,
  CapabilityExecutionState,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import type { CapabilityInvocationClock } from "./capability-plan.js";

export interface CreatePreparedCapabilityCallInput {
  lease: CapabilityLease;
  capabilityKey?: string;
  plan?: CapabilityInvocationPlan;
  preparedId?: string;
  executionMode?: CapabilityExecutionMode;
  preparedPayloadRef?: string;
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCapabilityExecutionHandleInput {
  prepared: PreparedCapabilityCall;
  executionId?: string;
  startedAt?: string;
  state?: CapabilityExecutionState;
  cancelTokenRef?: string;
  streamRef?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityExecutionFactoryOptions {
  clock?: CapabilityInvocationClock;
  idFactory?: () => string;
}

const DEFAULT_CLOCK: CapabilityInvocationClock = {
  now: () => new Date(),
};

export function createPreparedCapabilityCall(
  input: CreatePreparedCapabilityCallInput,
  options: CapabilityExecutionFactoryOptions = {},
): PreparedCapabilityCall {
  const idFactory = options.idFactory ?? randomUUID;
  const capabilityKey = input.capabilityKey ?? input.plan?.capabilityKey;
  if (!capabilityKey) {
    throw new Error("createPreparedCapabilityCall requires capabilityKey or plan.capabilityKey.");
  }

  return {
    preparedId: input.preparedId ?? (input.plan ? `${input.plan.planId}:prepared` : idFactory()),
    leaseId: input.lease.leaseId,
    capabilityKey,
    bindingId: input.lease.bindingId,
    generation: input.lease.generation,
    preparedPayloadRef: input.preparedPayloadRef,
    executionMode: input.executionMode ?? "direct",
    cacheKey: input.cacheKey ?? input.lease.preparedCacheKey ?? input.plan?.idempotencyKey,
    metadata: input.metadata,
  };
}

export function createCapabilityExecutionHandle(
  input: CreateCapabilityExecutionHandleInput,
  options: CapabilityExecutionFactoryOptions = {},
): CapabilityExecutionHandle {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const idFactory = options.idFactory ?? randomUUID;

  return {
    executionId: input.executionId ?? idFactory(),
    preparedId: input.prepared.preparedId,
    startedAt: input.startedAt ?? clock.now().toISOString(),
    state: input.state ?? "queued",
    cancelTokenRef: input.cancelTokenRef,
    streamRef: input.streamRef,
    metadata: input.metadata,
  };
}

export function transitionCapabilityExecutionHandle(
  handle: CapabilityExecutionHandle,
  state: CapabilityExecutionState,
  metadata?: Record<string, unknown>,
): CapabilityExecutionHandle {
  return {
    ...handle,
    state,
    metadata: metadata ? { ...(handle.metadata ?? {}), ...metadata } : handle.metadata,
  };
}
