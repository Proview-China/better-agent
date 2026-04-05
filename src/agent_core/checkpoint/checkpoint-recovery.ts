import { projectStateFromEvents } from "../state/index.js";
import { createInitialAgentState } from "../state/state-types.js";
import type { CheckpointRecoveryInput, CheckpointRecoveryResult, StoredCheckpoint } from "./checkpoint-types.js";

function cloneCheckpoint(checkpoint: StoredCheckpoint | undefined): StoredCheckpoint | undefined {
  return checkpoint ? structuredClone(checkpoint) : undefined;
}

export function recoverFromCheckpoint(
  input: CheckpointRecoveryInput & {
    checkpoint: StoredCheckpoint | undefined;
  }
): CheckpointRecoveryResult {
  const checkpoint = cloneCheckpoint(input.checkpoint);
  const replayedEvents = checkpoint?.record.journalCursor
    ? input.journal.readFromCursor(checkpoint.record.journalCursor)
    : input.journal.readRunEvents(input.runId);

  const baseState = checkpoint?.snapshot?.state
    ? structuredClone(checkpoint.snapshot.state)
    : createInitialAgentState();
  const state = projectStateFromEvents(
    replayedEvents.map((entry) => entry.event),
    baseState
  );

  const run = checkpoint?.snapshot?.run
    ? structuredClone(checkpoint.snapshot.run)
    : undefined;
  if (run) {
    const latestEvent = replayedEvents.at(-1)?.event;
    run.lastCheckpointRef = checkpoint?.record.checkpointId ?? run.lastCheckpointRef;
    run.lastEventId = latestEvent?.eventId ?? run.lastEventId;
  }

  return {
    checkpoint,
    state,
    run,
    poolRuntimeSnapshots: checkpoint?.snapshot?.poolRuntimeSnapshots
      ? structuredClone(checkpoint.snapshot.poolRuntimeSnapshots)
      : undefined,
    cmpRuntimeSnapshot: checkpoint?.snapshot?.cmpRuntimeSnapshot
      ? structuredClone(checkpoint.snapshot.cmpRuntimeSnapshot)
      : undefined,
    replayedEvents,
    resumeCursor: replayedEvents.at(-1)?.cursor ?? checkpoint?.record.journalCursor
  };
}
