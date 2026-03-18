export const CAPABILITY_RESULT_STATUSES = [
  "success",
  "partial",
  "failed",
  "blocked",
  "timeout",
  "cancelled",
] as const;
export type CapabilityResultStatus = (typeof CAPABILITY_RESULT_STATUSES)[number];

export interface CapabilityResultArtifact {
  id: string;
  kind: string;
  ref?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityResultError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface CapabilityResultEnvelope {
  executionId: string;
  resultId: string;
  status: CapabilityResultStatus;
  output?: unknown;
  artifacts?: CapabilityResultArtifact[];
  evidence?: unknown[];
  error?: CapabilityResultError;
  usage?: Record<string, unknown>;
  completedAt: string;
  metadata?: Record<string, unknown>;
}

export const CAPABILITY_BACKPRESSURE_SOURCES = [
  "global",
  "binding",
  "provider",
] as const;
export type CapabilityBackpressureSource = (typeof CAPABILITY_BACKPRESSURE_SOURCES)[number];

export const CAPABILITY_BACKPRESSURE_ACTIONS = [
  "wait",
  "retry-later",
  "degrade",
  "switch-binding",
] as const;
export type CapabilityBackpressureAction = (typeof CAPABILITY_BACKPRESSURE_ACTIONS)[number];

export interface CapabilityBackpressureSignal {
  source: CapabilityBackpressureSource;
  queueDepth: number;
  inflight: number;
  reason: string;
  suggestedAction: CapabilityBackpressureAction;
  emittedAt: string;
  metadata?: Record<string, unknown>;
}

