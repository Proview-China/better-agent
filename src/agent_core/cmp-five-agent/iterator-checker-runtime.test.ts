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
  assert.equal(iterator.reviewOutput.progressionVerdict, "advance_review");
  assert.equal(iterator.reviewOutput.reviewRefAnnotation, "candidate prepared as the next auditable review unit");
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
  assert.equal(checked.checkerRecord.reviewOutput.splitExecutions?.[0]?.decisionRef, "checked-1:split");
  assert.equal(checked.checkerRecord.reviewOutput.splitExecutions?.[0]?.sourceSectionId, "section-pre-1");
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

test("CmpIteratorCheckerRuntime live methods apply llm_assisted output and preserve fallback behavior", async () => {
  const runtime = createCmpIteratorCheckerRuntime();

  const iterator = await runtime.advanceIteratorWithLlm({
    agentId: "child-a",
    deltaId: "delta-live",
    candidateId: "candidate-live",
    branchRef: "refs/heads/cmp/child-a",
    commitRef: "commit-live",
    reviewRef: "refs/review/candidate-live",
    createdAt: "2026-03-30T00:00:00.000Z",
    metadata: {
      sourceSectionIds: ["section-pre-live-1", "section-pre-live-2"],
    },
  }, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        sourceSectionIds: ["section-pre-live-2"],
        progressionVerdict: "advance_commit",
        reviewRefAnnotation: "stable review ref is ready to advance into commit stage",
        commitRationale: "这一批变更已经形成单一可审查单元，适合推进 review ref。",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-iterator-live",
    }),
  });
  assert.deepEqual(iterator.reviewOutput.sourceSectionIds, ["section-pre-live-2"]);
  assert.equal(iterator.reviewOutput.progressionVerdict, "advance_commit");
  assert.equal(iterator.reviewOutput.reviewRefAnnotation, "stable review ref is ready to advance into commit stage");
  assert.equal(iterator.reviewOutput.commitRationale, "这一批变更已经形成单一可审查单元，适合推进 review ref。");
  assert.equal(iterator.liveTrace?.status, "live_applied");
  assert.equal(iterator.liveTrace?.provider, "openai");
  assert.equal((iterator.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");

  const checked = await runtime.evaluateCheckerWithLlm({
    agentId: "child-a",
    candidateId: "candidate-live",
    checkedSnapshotId: "checked-live",
    checkedAt: "2026-03-30T00:00:01.000Z",
    suggestPromote: true,
    parentAgentId: "parent-a",
    metadata: {
      sourceSectionIds: ["section-pre-live-1", "section-pre-live-2"],
      checkedSectionIds: ["section-checked-live-1"],
    },
  }, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        sourceSectionIds: ["section-pre-live-2"],
        checkedSectionIds: ["section-checked-live-1"],
        splitExecutions: [{
          decisionRef: "checked-live:split",
          sourceSectionId: "section-pre-live-2",
          proposedSectionIds: ["section-checked-live-1", "section-checked-live-2"],
          rationale: "split live evidence into executable checked targets",
        }],
        mergeExecutions: [{
          decisionRef: "checked-live:merge",
          sourceSectionIds: ["section-checked-live-1", "section-checked-live-2"],
          targetSectionId: "section-checked-live-merged",
          rationale: "merge overlapping checked sections into one executable target",
        }],
        trimSummary: "保留真正和当前任务相关的高信噪比证据。",
        shortReason: "已完成精裁。",
        detailedReason: "噪音已被剥离，当前 checked snapshot 足够支持父层 DBAgent 审查。",
        promoteRationale: "当前结果已经具备 promote-ready 条件。",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-checker-live",
    }),
  });
  assert.equal(checked.checkerRecord.reviewOutput.trimSummary, "保留真正和当前任务相关的高信噪比证据。");
  assert.equal(checked.checkerRecord.reviewOutput.splitExecutions?.[0]?.decisionRef, "checked-live:split");
  assert.equal(checked.checkerRecord.reviewOutput.mergeExecutions?.[0]?.targetSectionId, "section-checked-live-merged");
  assert.equal(checked.checkerRecord.reviewOutput.promoteRationale, "当前结果已经具备 promote-ready 条件。");
  assert.equal(checked.checkerRecord.liveTrace?.status, "live_applied");
  assert.equal(checked.checkerRecord.liveTrace?.provider, "openai");
  assert.equal((checked.checkerRecord.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");

  const fallback = await runtime.evaluateCheckerWithLlm({
    agentId: "child-a",
    candidateId: "candidate-fallback",
    checkedSnapshotId: "checked-fallback",
    checkedAt: "2026-03-30T00:00:02.000Z",
    suggestPromote: false,
    metadata: {
      sourceSectionIds: ["section-pre-fallback-1"],
      checkedSectionIds: ["section-checked-fallback-1"],
    },
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("gateway failed");
    },
  });
  assert.equal(fallback.checkerRecord.reviewOutput.trimSummary, "checker trims to section-level high-signal content");
  assert.equal(fallback.checkerRecord.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.checkerRecord.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((fallback.checkerRecord.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);

  await assert.rejects(
    () => runtime.advanceIteratorWithLlm({
      agentId: "child-a",
      deltaId: "delta-required",
      candidateId: "candidate-required",
      branchRef: "refs/heads/cmp/child-a",
      commitRef: "commit-required",
      reviewRef: "refs/review/candidate-required",
      createdAt: "2026-03-30T00:00:03.000Z",
    }, {
      mode: "llm_required",
      executor: async () => {
        throw new Error("hard fail");
      },
    }),
    /hard fail/u,
  );

  const iteratorFallback = await runtime.advanceIteratorWithLlm({
    agentId: "child-a",
    deltaId: "delta-fallback",
    candidateId: "candidate-fallback",
    branchRef: "refs/heads/cmp/child-a",
    commitRef: "commit-fallback",
    reviewRef: "refs/review/candidate-fallback",
    createdAt: "2026-03-30T00:00:04.000Z",
    metadata: {
      sourceSectionIds: ["section-pre-fallback-1", "section-pre-fallback-2"],
    },
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("iterator gateway failed");
    },
  });
  assert.deepEqual(iteratorFallback.reviewOutput.sourceSectionIds, ["section-pre-fallback-1", "section-pre-fallback-2"]);
  assert.equal(iteratorFallback.reviewOutput.progressionVerdict, "advance_review");
  assert.equal(iteratorFallback.reviewOutput.reviewRefAnnotation, "candidate prepared as the next auditable review unit");
  assert.equal(iteratorFallback.reviewOutput.commitRationale, undefined);
  assert.equal(iteratorFallback.liveTrace?.status, "fallback_rules");
  assert.equal((iteratorFallback.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((iteratorFallback.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);
});
