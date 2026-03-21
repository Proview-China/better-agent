import { randomUUID } from "node:crypto";

import type {
  CapabilityCallIntent,
  CapabilityPortRequest,
  IntentPriority,
} from "../types/kernel-intents.js";
import type { CapabilityInvocationPlan } from "../capability-types/index.js";

export interface CapabilityInvocationClock {
  now(): Date;
}

export interface CreateCapabilityInvocationPlanInput {
  intentId: string;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  operation?: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  idempotencyKey?: string;
  priority: IntentPriority;
  traceContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CapabilityPlanFactoryOptions {
  clock?: CapabilityInvocationClock;
  idFactory?: () => string;
}

const DEFAULT_CLOCK: CapabilityInvocationClock = {
  now: () => new Date(),
};

export function deriveCapabilityOperation(capabilityKey: string): string {
  return capabilityKey.split(".").slice(1).join(".") || capabilityKey;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

export function buildCapabilityInvocationFingerprint(
  input: Pick<
    CreateCapabilityInvocationPlanInput,
    "capabilityKey" | "operation" | "input" | "timeoutMs" | "priority"
  >,
): string {
  return stableStringify({
    capabilityKey: input.capabilityKey,
    operation: input.operation ?? deriveCapabilityOperation(input.capabilityKey),
    input: input.input,
    timeoutMs: input.timeoutMs ?? null,
    priority: input.priority,
  });
}

export function createCapabilityInvocationPlan(
  input: CreateCapabilityInvocationPlanInput,
  options: CapabilityPlanFactoryOptions = {},
): CapabilityInvocationPlan {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const idFactory = options.idFactory ?? randomUUID;

  return {
    planId: idFactory(),
    intentId: input.intentId,
    sessionId: input.sessionId,
    runId: input.runId,
    capabilityKey: input.capabilityKey,
    operation: input.operation ?? deriveCapabilityOperation(input.capabilityKey),
    input: input.input,
    timeoutMs: input.timeoutMs,
    idempotencyKey: input.idempotencyKey,
    priority: input.priority,
    traceContext: input.traceContext,
    metadata: {
      createdAt: clock.now().toISOString(),
      ...input.metadata,
    },
  };
}

export function createCapabilityInvocationPlanFromRequest(
  request: CapabilityPortRequest,
  options: Omit<CreateCapabilityInvocationPlanInput, "intentId" | "sessionId" | "runId" | "capabilityKey" | "input" | "timeoutMs" | "idempotencyKey" | "priority"> &
    CapabilityPlanFactoryOptions = {},
): CapabilityInvocationPlan {
  return createCapabilityInvocationPlan(
    {
      intentId: request.intentId,
      sessionId: request.sessionId,
      runId: request.runId,
      capabilityKey: request.capabilityKey,
      operation: options.operation,
      input: request.input,
      timeoutMs: request.timeoutMs,
      idempotencyKey: request.idempotencyKey,
      priority: request.priority,
      traceContext: options.traceContext,
      metadata: options.metadata,
    },
    options,
  );
}

export function createCapabilityInvocationPlanFromIntent(
  intent: CapabilityCallIntent,
  options: Omit<CreateCapabilityInvocationPlanInput, "intentId" | "sessionId" | "runId" | "capabilityKey" | "input" | "timeoutMs" | "idempotencyKey" | "priority"> &
    CapabilityPlanFactoryOptions = {},
): CapabilityInvocationPlan {
  return createCapabilityInvocationPlan(
    {
      intentId: intent.intentId,
      sessionId: intent.sessionId,
      runId: intent.runId,
      capabilityKey: intent.request.capabilityKey,
      operation: options.operation,
      input: intent.request.input,
      timeoutMs: intent.request.timeoutMs,
      idempotencyKey: intent.request.idempotencyKey ?? intent.idempotencyKey,
      priority: intent.request.priority,
      traceContext: options.traceContext,
      metadata: {
        correlationId: intent.correlationId,
        ...intent.metadata,
        ...options.metadata,
      },
    },
    options,
  );
}
