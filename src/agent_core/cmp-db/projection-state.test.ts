import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCmpProjectionRecord,
  canTransitionCmpProjectionState,
  createCmpProjectionRecordFromCheckedSnapshot,
  isTerminalCmpProjectionState,
} from "./index.js";

test("cmp projection state machine preserves the frozen promotion lifecycle", () => {
  assert.equal(canTransitionCmpProjectionState({
    from: "local_only",
    to: "submitted_to_parent",
  }), true);
  assert.equal(canTransitionCmpProjectionState({
    from: "accepted_by_parent",
    to: "dispatched_downward",
  }), false);
  assert.equal(isTerminalCmpProjectionState("archived"), true);
});

test("createCmpProjectionRecordFromCheckedSnapshot materializes a local projection record", () => {
  const record = createCmpProjectionRecordFromCheckedSnapshot({
    projectionId: "projection-1",
    snapshot: {
      snapshotId: "snapshot-1",
      agentId: "agent-yahoo",
      branchRef: "cmp/yahoo",
      commitRef: "abc123",
      checkedAt: "2026-03-20T10:00:00.000Z",
      qualityLabel: "high-signal",
    },
  });

  assert.equal(record.state, "local_only");
  assert.equal(record.branchRef, "cmp/yahoo");
  assert.equal(record.metadata?.qualityLabel, "high-signal");
});

test("advanceCmpProjectionRecord enforces non-skipping promotion order", () => {
  const localRecord = createCmpProjectionRecordFromCheckedSnapshot({
    projectionId: "projection-2",
    snapshot: {
      snapshotId: "snapshot-2",
      agentId: "agent-yahoo",
      branchRef: "cmp/yahoo",
      commitRef: "def456",
      checkedAt: "2026-03-20T10:00:00.000Z",
    },
  });
  const submitted = advanceCmpProjectionRecord({
    record: localRecord,
    to: "submitted_to_parent",
    updatedAt: "2026-03-20T10:01:00.000Z",
  });
  const accepted = advanceCmpProjectionRecord({
    record: submitted,
    to: "accepted_by_parent",
    updatedAt: "2026-03-20T10:02:00.000Z",
  });

  assert.equal(accepted.state, "accepted_by_parent");
  assert.throws(() => advanceCmpProjectionRecord({
    record: localRecord,
    to: "promoted_by_parent",
    updatedAt: "2026-03-20T10:03:00.000Z",
  }), /cannot transition/i);
});

