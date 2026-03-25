import type {
  TaToolReviewActionStatus,
  ToolReviewActionLedgerEntry,
} from "./tool-review-contract.js";

export const TA_TOOL_REVIEW_SESSION_STATUSES = [
  "open",
  "waiting_human",
  "blocked",
  "completed",
] as const;
export type TaToolReviewSessionStatus =
  (typeof TA_TOOL_REVIEW_SESSION_STATUSES)[number];

export interface ToolReviewSessionState {
  sessionId: string;
  status: TaToolReviewSessionStatus;
  actionIds: string[];
  latestActionId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateToolReviewSessionStateInput {
  sessionId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewSessionSnapshot {
  session: ToolReviewSessionState;
  actions: ToolReviewActionLedgerEntry[];
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function resolveSessionStatus(
  status: TaToolReviewActionStatus,
): TaToolReviewSessionStatus {
  switch (status) {
    case "waiting_human":
      return "waiting_human";
    case "blocked":
      return "blocked";
    case "completed":
      return "completed";
    case "recorded":
    case "ready_for_handoff":
      return "open";
  }
}

export function createToolReviewSessionState(
  input: CreateToolReviewSessionStateInput,
): ToolReviewSessionState {
  return {
    sessionId: assertNonEmpty(input.sessionId, "Tool review session sessionId"),
    status: "open",
    actionIds: [],
    createdAt: assertNonEmpty(input.createdAt, "Tool review session createdAt"),
    updatedAt: assertNonEmpty(input.createdAt, "Tool review session updatedAt"),
    metadata: input.metadata,
  };
}

export function appendToolReviewActionToSession(
  session: ToolReviewSessionState,
  action: ToolReviewActionLedgerEntry,
): ToolReviewSessionState {
  const actionIds = session.actionIds.includes(action.actionId)
    ? [...session.actionIds]
    : [...session.actionIds, action.actionId];
  return {
    ...session,
    status: resolveSessionStatus(action.status),
    actionIds,
    latestActionId: action.actionId,
    updatedAt: action.updatedAt,
  };
}

export function createToolReviewSessionSnapshot(
  session: ToolReviewSessionState,
  actions: readonly ToolReviewActionLedgerEntry[],
): ToolReviewSessionSnapshot {
  return {
    session: {
      ...session,
      actionIds: [...session.actionIds],
    },
    actions: actions.map((action) => ({
      ...action,
      metadata: action.metadata ? { ...action.metadata } : undefined,
    })),
  };
}

export function restoreToolReviewSessionSnapshot(
  snapshot: ToolReviewSessionSnapshot,
): ToolReviewSessionSnapshot {
  return createToolReviewSessionSnapshot(snapshot.session, snapshot.actions);
}
