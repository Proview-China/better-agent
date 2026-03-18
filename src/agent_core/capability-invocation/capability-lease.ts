import { randomUUID } from "node:crypto";

import type {
  CapabilityInvocationPlan,
  CapabilityLease,
} from "../capability-types/index.js";
import type { CapabilityInvocationClock } from "./capability-plan.js";

export interface CreateCapabilityLeaseInput {
  capabilityId: string;
  bindingId: string;
  generation: number;
  plan: CapabilityInvocationPlan;
  expiresAt?: string;
  queueClass?: string;
  backpressureSnapshot?: Record<string, unknown>;
  preparedCacheKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityLeaseFactoryOptions {
  clock?: CapabilityInvocationClock;
  idFactory?: () => string;
}

const DEFAULT_CLOCK: CapabilityInvocationClock = {
  now: () => new Date(),
};

export function createCapabilityLease(
  input: CreateCapabilityLeaseInput,
  options: CapabilityLeaseFactoryOptions = {},
): CapabilityLease {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const idFactory = options.idFactory ?? randomUUID;

  return {
    leaseId: idFactory(),
    capabilityId: input.capabilityId,
    bindingId: input.bindingId,
    generation: input.generation,
    grantedAt: clock.now().toISOString(),
    expiresAt: input.expiresAt,
    priority: input.plan.priority,
    queueClass: input.queueClass,
    backpressureSnapshot: input.backpressureSnapshot,
    preparedCacheKey: input.preparedCacheKey,
    metadata: input.metadata,
  };
}

