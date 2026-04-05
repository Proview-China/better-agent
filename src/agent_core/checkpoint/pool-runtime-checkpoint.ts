import type { PoolRuntimeSnapshots } from "../ta-pool-runtime/index.js";
import type { CmpRuntimeSnapshot } from "../cmp-runtime/index.js";
import type { RunRecord } from "../types/kernel-run.js";
import type { AgentState } from "../types/kernel-state.js";
import type { SessionHeader } from "../types/kernel-session.js";
import type {
  CheckpointRecoveryResult,
  CheckpointSnapshotData,
} from "./checkpoint-types.js";

export interface CreatePoolRuntimeCheckpointSnapshotInput {
  run: RunRecord;
  state: AgentState;
  sessionHeader?: SessionHeader;
  poolRuntimeSnapshots?: PoolRuntimeSnapshots;
  cmpRuntimeSnapshot?: CmpRuntimeSnapshot;
}

export function createPoolRuntimeCheckpointSnapshot(
  input: CreatePoolRuntimeCheckpointSnapshotInput,
): CheckpointSnapshotData {
  return {
    run: structuredClone(input.run),
    state: structuredClone(input.state),
    sessionHeader: input.sessionHeader ? structuredClone(input.sessionHeader) : undefined,
    poolRuntimeSnapshots: input.poolRuntimeSnapshots
      ? structuredClone(input.poolRuntimeSnapshots)
      : undefined,
    cmpRuntimeSnapshot: input.cmpRuntimeSnapshot
      ? structuredClone(input.cmpRuntimeSnapshot)
      : undefined,
  };
}

export function mergePoolRuntimeSnapshotsIntoCheckpointSnapshot(params: {
  snapshot: CheckpointSnapshotData;
  poolRuntimeSnapshots?: PoolRuntimeSnapshots;
}): CheckpointSnapshotData {
  return {
    ...structuredClone(params.snapshot),
    poolRuntimeSnapshots: params.poolRuntimeSnapshots
      ? structuredClone(params.poolRuntimeSnapshots)
      : params.snapshot.poolRuntimeSnapshots
        ? structuredClone(params.snapshot.poolRuntimeSnapshots)
        : undefined,
  };
}

export function readTapPoolRuntimeSnapshots(
  recovery: Pick<CheckpointRecoveryResult, "poolRuntimeSnapshots">,
): PoolRuntimeSnapshots["tap"] | undefined {
  return recovery.poolRuntimeSnapshots?.tap
    ? structuredClone(recovery.poolRuntimeSnapshots.tap)
    : undefined;
}

export function getPoolRuntimeSnapshotsFromRecoveryResult(
  recovery: Pick<CheckpointRecoveryResult, "poolRuntimeSnapshots">,
): PoolRuntimeSnapshots | undefined {
  return recovery.poolRuntimeSnapshots
    ? structuredClone(recovery.poolRuntimeSnapshots)
    : undefined;
}

export const getTapPoolRuntimeSnapshotFromRecoveryResult = readTapPoolRuntimeSnapshots;
