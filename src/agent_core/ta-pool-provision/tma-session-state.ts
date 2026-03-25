import type { TmaExecutionLane } from "../ta-pool-types/index.js";

export const TMA_SESSION_PHASES = [
  "planner",
  "executor",
] as const;
export type TmaSessionPhase = (typeof TMA_SESSION_PHASES)[number];

export const TMA_SESSION_STATUSES = [
  "in_progress",
  "resumable",
  "completed",
] as const;
export type TmaSessionStatus = (typeof TMA_SESSION_STATUSES)[number];

export interface TmaSessionState {
  sessionId: string;
  provisionId: string;
  planId: string;
  requestedCapabilityKey: string;
  lane: TmaExecutionLane;
  phase: TmaSessionPhase;
  status: TmaSessionStatus;
  createdAt: string;
  updatedAt: string;
  resumeSummary: string;
  boundary: {
    mayExecuteOriginalTask: false;
    scope: "capability_build_only";
  };
  reportId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTmaSessionStateInput {
  sessionId: string;
  provisionId: string;
  planId: string;
  requestedCapabilityKey: string;
  lane: TmaExecutionLane;
  phase: TmaSessionPhase;
  status: TmaSessionStatus;
  createdAt: string;
  updatedAt?: string;
  resumeSummary: string;
  reportId?: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createTmaSessionState(
  input: CreateTmaSessionStateInput,
): TmaSessionState {
  return {
    sessionId: assertNonEmpty(input.sessionId, "TMA session state sessionId"),
    provisionId: assertNonEmpty(input.provisionId, "TMA session state provisionId"),
    planId: assertNonEmpty(input.planId, "TMA session state planId"),
    requestedCapabilityKey: assertNonEmpty(
      input.requestedCapabilityKey,
      "TMA session state requestedCapabilityKey",
    ),
    lane: input.lane,
    phase: input.phase,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    resumeSummary: assertNonEmpty(input.resumeSummary, "TMA session state resumeSummary"),
    boundary: {
      mayExecuteOriginalTask: false,
      scope: "capability_build_only",
    },
    reportId: input.reportId?.trim() || undefined,
    metadata: input.metadata,
  };
}

export function cloneTmaSessionState(
  state: TmaSessionState,
): TmaSessionState {
  return createTmaSessionState({
    sessionId: state.sessionId,
    provisionId: state.provisionId,
    planId: state.planId,
    requestedCapabilityKey: state.requestedCapabilityKey,
    lane: state.lane,
    phase: state.phase,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    resumeSummary: state.resumeSummary,
    reportId: state.reportId,
    metadata: state.metadata,
  });
}

export function markTmaSessionResumable(
  state: TmaSessionState,
  input: {
    updatedAt: string;
    resumeSummary: string;
    metadata?: Record<string, unknown>;
  },
): TmaSessionState {
  return createTmaSessionState({
    sessionId: state.sessionId,
    provisionId: state.provisionId,
    planId: state.planId,
    requestedCapabilityKey: state.requestedCapabilityKey,
    lane: state.lane,
    phase: state.phase,
    status: "resumable",
    createdAt: state.createdAt,
    updatedAt: input.updatedAt,
    resumeSummary: input.resumeSummary,
    reportId: state.reportId,
    metadata: {
      ...(state.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function markTmaSessionCompleted(
  state: TmaSessionState,
  input: {
    updatedAt: string;
    reportId?: string;
    metadata?: Record<string, unknown>;
  },
): TmaSessionState {
  return createTmaSessionState({
    sessionId: state.sessionId,
    provisionId: state.provisionId,
    planId: state.planId,
    requestedCapabilityKey: state.requestedCapabilityKey,
    lane: state.lane,
    phase: state.phase,
    status: "completed",
    createdAt: state.createdAt,
    updatedAt: input.updatedAt,
    resumeSummary: state.resumeSummary,
    reportId: input.reportId ?? state.reportId,
    metadata: {
      ...(state.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}
