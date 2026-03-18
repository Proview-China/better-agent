import type { RunId, SessionId } from "../types/kernel-session.js";
import type { IntentPriority } from "../types/kernel-intents.js";

export interface CapabilityInvocationPlan {
  planId: string;
  intentId: string;
  sessionId: SessionId;
  runId: RunId;
  capabilityKey: string;
  operation: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  idempotencyKey?: string;
  priority: IntentPriority;
  traceContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CapabilityLease {
  leaseId: string;
  capabilityId: string;
  bindingId: string;
  generation: number;
  grantedAt: string;
  expiresAt?: string;
  priority: IntentPriority;
  queueClass?: string;
  backpressureSnapshot?: Record<string, unknown>;
  preparedCacheKey?: string;
  metadata?: Record<string, unknown>;
}

export const CAPABILITY_EXECUTION_MODES = [
  "direct",
  "queued",
  "streaming",
  "long-running",
] as const;
export type CapabilityExecutionMode = (typeof CAPABILITY_EXECUTION_MODES)[number];

export interface PreparedCapabilityCall {
  preparedId: string;
  leaseId: string;
  capabilityKey: string;
  bindingId: string;
  generation: number;
  preparedPayloadRef?: string;
  executionMode: CapabilityExecutionMode;
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}

export const CAPABILITY_EXECUTION_STATES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type CapabilityExecutionState = (typeof CAPABILITY_EXECUTION_STATES)[number];

export interface CapabilityExecutionHandle {
  executionId: string;
  preparedId: string;
  startedAt: string;
  state: CapabilityExecutionState;
  cancelTokenRef?: string;
  streamRef?: string;
  metadata?: Record<string, unknown>;
}

