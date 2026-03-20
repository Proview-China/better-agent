import {
  CMP_PROJECTION_STATES,
  type CheckedSnapshotLike,
  type CmpProjectionRecord,
  type CmpProjectionState,
  validateCheckedSnapshotLike,
  validateCmpProjectionRecord,
} from "./cmp-db-types.js";

export const CMP_PROJECTION_STATE_TRANSITIONS: Record<
  CmpProjectionState,
  readonly CmpProjectionState[]
> = {
  local_only: ["submitted_to_parent", "archived"],
  submitted_to_parent: ["accepted_by_parent", "archived"],
  accepted_by_parent: ["promoted_by_parent", "archived"],
  promoted_by_parent: ["dispatched_downward", "archived"],
  dispatched_downward: ["archived"],
  archived: [],
};

export function canTransitionCmpProjectionState(params: {
  from: CmpProjectionState;
  to: CmpProjectionState;
}): boolean {
  return CMP_PROJECTION_STATE_TRANSITIONS[params.from].includes(params.to);
}

export function assertCmpProjectionStateTransition(params: {
  from: CmpProjectionState;
  to: CmpProjectionState;
}): void {
  if (!canTransitionCmpProjectionState(params)) {
    throw new Error(
      `CMP projection state cannot transition from ${params.from} to ${params.to}.`,
    );
  }
}

export function createCmpProjectionRecordFromCheckedSnapshot(input: {
  projectionId: string;
  snapshot: CheckedSnapshotLike;
  updatedAt?: string;
  state?: CmpProjectionState;
  metadata?: Record<string, unknown>;
}): CmpProjectionRecord {
  validateCheckedSnapshotLike(input.snapshot);
  const record: CmpProjectionRecord = {
    projectionId: input.projectionId.trim(),
    snapshotId: input.snapshot.snapshotId,
    agentId: input.snapshot.agentId,
    branchRef: input.snapshot.branchRef,
    commitRef: input.snapshot.commitRef,
    state: input.state ?? "local_only",
    updatedAt: input.updatedAt ?? input.snapshot.checkedAt,
    metadata: {
      checkedAt: input.snapshot.checkedAt,
      qualityLabel: input.snapshot.qualityLabel,
      ...(input.snapshot.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpProjectionRecord(record);
  return record;
}

export function advanceCmpProjectionRecord(params: {
  record: CmpProjectionRecord;
  to: CmpProjectionState;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpProjectionRecord {
  validateCmpProjectionRecord(params.record);
  assertCmpProjectionStateTransition({
    from: params.record.state,
    to: params.to,
  });
  return {
    ...params.record,
    state: params.to,
    updatedAt: params.updatedAt,
    metadata: {
      ...(params.record.metadata ?? {}),
      ...(params.metadata ?? {}),
    },
  };
}

export function isTerminalCmpProjectionState(state: CmpProjectionState): boolean {
  return state === "archived";
}

export function isCmpProjectionState(value: string): value is CmpProjectionState {
  return CMP_PROJECTION_STATES.includes(value as CmpProjectionState);
}

