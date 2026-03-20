import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCmpActiveLineRecord,
  createCmpActiveLineRecord,
  isCmpPromotionPending,
} from "./active-line.js";

test("CMP active line advances from captured to checked_ready without collapsing promotion", () => {
  const captured = createCmpActiveLineRecord({
    lineId: "line-1",
    agentId: "agent-main",
    deltaRef: "delta:1",
    stage: "captured",
    updatedAt: "2026-03-20T08:10:00.000Z",
  });
  const written = advanceCmpActiveLineRecord({
    record: captured,
    nextStage: "written_to_git",
    updatedAt: "2026-03-20T08:10:01.000Z",
    gitUpdateRef: {
      branchRef: "cmp/main",
      commitRef: "commit-1",
    },
  });
  const candidate = advanceCmpActiveLineRecord({
    record: written,
    nextStage: "candidate_ready",
    updatedAt: "2026-03-20T08:10:02.000Z",
    snapshotCandidateRef: "candidate:1",
  });
  const checked = advanceCmpActiveLineRecord({
    record: candidate,
    nextStage: "checked_ready",
    updatedAt: "2026-03-20T08:10:03.000Z",
    checkedSnapshotRef: "checked:1",
  });
  const promotedPending = advanceCmpActiveLineRecord({
    record: checked,
    nextStage: "promoted_pending",
    updatedAt: "2026-03-20T08:10:04.000Z",
  });

  assert.equal(checked.stage, "checked_ready");
  assert.equal(promotedPending.stage, "promoted_pending");
  assert.equal(isCmpPromotionPending(promotedPending), true);
});

test("CMP active line refuses checked_ready without a checked snapshot ref", () => {
  const record = createCmpActiveLineRecord({
    lineId: "line-2",
    agentId: "agent-main",
    deltaRef: "delta:2",
    stage: "candidate_ready",
    updatedAt: "2026-03-20T08:11:00.000Z",
    gitUpdateRef: {
      branchRef: "cmp/main",
      commitRef: "commit-2",
    },
    snapshotCandidateRef: "candidate:2",
  });

  assert.throws(() => advanceCmpActiveLineRecord({
    record,
    nextStage: "checked_ready",
    updatedAt: "2026-03-20T08:11:01.000Z",
  }), /requires a checkedSnapshotRef/i);
});

