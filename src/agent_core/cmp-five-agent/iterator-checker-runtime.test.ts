import assert from "node:assert/strict";
import test from "node:test";

import { createCmpIteratorCheckerRuntime } from "./iterator-checker-runtime.js";

test("CmpIteratorCheckerRuntime keeps commit as minimum review unit and separates checked from promote", () => {
  const runtime = createCmpIteratorCheckerRuntime();

  const iterator = runtime.advanceIterator({
    agentId: "child-a",
    deltaId: "delta-1",
    candidateId: "candidate-1",
    branchRef: "refs/heads/cmp/child-a",
    commitRef: "commit-1",
    reviewRef: "refs/review/candidate-1",
    createdAt: "2026-03-25T00:00:00.000Z",
    metadata: {
      sourceRequestId: "request-1",
      sourceSectionIds: ["section-pre-1", "section-pre-2"],
    },
  });
  assert.equal(iterator.stage, "update_review_ref");
  assert.equal(iterator.reviewOutput.sourceRequestId, "request-1");
  assert.deepEqual(iterator.reviewOutput.sourceSectionIds, ["section-pre-1", "section-pre-2"]);
  assert.equal(iterator.reviewOutput.minimumReviewUnit, "commit");
  assert.deepEqual(iterator.metadata?.reviewDiscipline, {
    minimumReviewUnit: "commit",
    reviewRefMode: "stable_review_ref",
    gitAuthority: "cmp_primary_writer",
    handoffTarget: "checker",
  });

  const checked = runtime.evaluateChecker({
    agentId: "child-a",
    candidateId: "candidate-1",
    checkedSnapshotId: "checked-1",
    checkedAt: "2026-03-25T00:00:01.000Z",
    suggestPromote: true,
    parentAgentId: "parent-a",
    metadata: {
      sourceSectionIds: ["section-pre-1", "section-pre-2"],
      checkedSectionIds: ["section-checked-1"],
    },
  });
  assert.equal(checked.checkerRecord.stage, "suggest_promote");
  assert.equal(checked.promoteRequest?.reviewerRole, "dbagent");
  assert.deepEqual(checked.checkerRecord.reviewOutput.sourceSectionIds, ["section-pre-1", "section-pre-2"]);
  assert.deepEqual(checked.checkerRecord.reviewOutput.checkedSectionIds, ["section-checked-1"]);
  assert.equal(checked.checkerRecord.reviewOutput.trimSummary, "checker trims to section-level high-signal content");
  const reviewDiscipline = checked.checkerRecord.metadata?.reviewDiscipline as
    | { checkedDetachedFromPromote?: boolean }
    | undefined;
  assert.equal(reviewDiscipline?.checkedDetachedFromPromote, true);
  assert.deepEqual(checked.checkerRecord.metadata?.parentHelperSemantics, {
    status: "available",
    mode: "assist_parent_dbagent",
    responsibilities: [
      "evidence_restructure",
      "history_check",
      "narrow_for_child_task",
    ],
  });
  const promoteReviewDiscipline = checked.promoteRequest?.metadata?.reviewDiscipline as
    | { parentPrimaryReviewer?: string }
    | undefined;
  assert.equal(promoteReviewDiscipline?.parentPrimaryReviewer, "dbagent");

  const snapshot = runtime.createSnapshot("child-a");
  assert.equal(snapshot.checkpoints.filter((item) => item.role === "iterator").length, 3);
  assert.equal(snapshot.checkpoints.filter((item) => item.role === "checker").length, 4);
});
