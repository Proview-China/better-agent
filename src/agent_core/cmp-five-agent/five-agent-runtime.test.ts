import assert from "node:assert/strict";
import test from "node:test";

import { createCmpBranchFamily } from "../cmp-types/index.js";
import { createCmpFiveAgentRuntime } from "./five-agent-runtime.js";

test("CmpFiveAgentRuntime creates per-role summaries", () => {
  const runtime = createCmpFiveAgentRuntime();
  runtime.icma.capture({
    ingest: {
      agentId: "main",
      sessionId: "session-1",
      taskSummary: "bootstrap five-agent",
      materials: [{ kind: "user_input", ref: "msg:1" }],
      lineage: {
        agentId: "main",
        projectId: "proj-1",
        depth: 0,
        status: "active",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        }),
      },
    },
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "icma-loop-1",
  });

  const summary = runtime.createSummary("main");
  assert.equal(summary.roleCounts.icma, 1);
  assert.equal(summary.configurationVersion, "cmp-five-agent-role-catalog/v1");
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/v1");
  assert.deepEqual(summary.capabilityMatrix.gitWriters, ["iterator", "checker"]);
  assert.deepEqual(summary.capabilityMatrix.dbWriters, ["dbagent"]);
  assert.equal(summary.tapProfiles.icma.profileId, "cmp-five-agent/icma-tap-profile/v1");
});

test("CmpFiveAgentRuntime live wrappers reuse default executors and surface live summary", async () => {
  const runtime = createCmpFiveAgentRuntime({
    live: {
      executors: {
        icma: async () => ({
          output: {
            intent: "live ingress intent",
            sourceAnchorRefs: ["msg:1"],
            candidateBodyRefs: ["msg:1"],
            boundary: "preserve_root_system_and_emit_controlled_fragments_only",
            operatorGuide: "operator via llm",
            childGuide: "child via llm",
            llmIntentRationale: "focus on latest high-signal material",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-icma-live",
        }),
        checker: async () => ({
          output: {
            sourceSectionIds: ["section-pre-1"],
            checkedSectionIds: ["section-checked-1"],
            splitDecisionRefs: ["split-1"],
            mergeDecisionRefs: ["merge-1"],
            trimSummary: "trimmed to high-signal context",
            shortReason: "ready for checked snapshot",
            detailedReason: "checker reorganized the snapshot and kept only current task evidence",
            promoteRationale: "child evidence is ready for parent review",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-checker-live",
        }),
      },
    },
  });

  const icma = await runtime.captureIcmaWithLlm({
    ingest: {
      agentId: "main-live",
      sessionId: "session-live",
      taskSummary: "bootstrap live wrappers",
      materials: [{ kind: "user_input", ref: "msg:1" }],
      lineage: {
        agentId: "main-live",
        projectId: "proj-live",
        depth: 0,
        status: "active",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/main-live",
          cmpBranch: "cmp/main-live",
          mpBranch: "mp/main-live",
          tapBranch: "tap/main-live",
        }),
      },
    },
    createdAt: "2026-03-31T00:00:00.000Z",
    loopId: "icma-live-loop-1",
  });

  const checker = await runtime.evaluateCheckerWithLlm({
    agentId: "main-live",
    candidateId: "candidate-live-1",
    checkedSnapshotId: "snapshot-live-1",
    checkedAt: "2026-03-31T00:00:01.000Z",
    suggestPromote: true,
    parentAgentId: "parent-live",
    metadata: {
      sourceSectionIds: ["section-pre-1"],
      checkedSectionIds: ["section-checked-1"],
    },
  });

  assert.equal(icma.loop.liveTrace?.status, "live_applied");
  assert.equal(icma.loop.structuredOutput.intent, "live ingress intent");
  assert.equal(checker.checkerRecord.liveTrace?.status, "live_applied");
  assert.equal(checker.checkerRecord.reviewOutput.trimSummary, "trimmed to high-signal context");

  const summary = runtime.createSummary("main-live");
  assert.equal(summary.live.icma.status, "succeeded");
  assert.equal(summary.live.icma.mode, "llm_assisted");
  assert.equal(summary.live.checker.status, "succeeded");
  assert.equal(summary.live.checker.provider, "openai");
});

test("CmpFiveAgentRuntime can orchestrate one active live loop without touching the sync mainline", async () => {
  const runtime = createCmpFiveAgentRuntime({
    live: {
      executors: {
        icma: async () => ({
          output: {
            intent: "active live loop intent",
            sourceAnchorRefs: ["msg:active:1"],
            candidateBodyRefs: ["msg:active:1"],
            boundary: "preserve_root_system_and_emit_controlled_fragments_only",
            operatorGuide: "operator active loop",
            childGuide: "child active loop",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-live-loop-icma",
        }),
        iterator: async () => ({
          output: {
            sourceSectionIds: ["section-pre-active-1"],
            commitRationale: "iterator active live loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-live-loop-iterator",
        }),
        checker: async () => ({
          output: {
            sourceSectionIds: ["section-pre-active-1"],
            checkedSectionIds: ["section-checked-active-1"],
            splitDecisionRefs: ["split-active-1"],
            mergeDecisionRefs: ["merge-active-1"],
            trimSummary: "checker active live loop trim",
            shortReason: "checker active live loop short reason",
            detailedReason: "checker active live loop detailed reason",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-live-loop-checker",
        }),
        dbagent: async () => ({
          output: {
            packageTopology: "active_plus_timeline_plus_task_snapshots",
            bundleSchemaVersion: "cmp-dispatch-bundle/v1",
            materializationRationale: "dbagent active live loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-live-loop-dbagent",
        }),
        dispatcher: async () => ({
          output: {
            routeRationale: "dispatcher active live loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-live-loop-dispatcher",
        }),
      },
    },
  });

  const result = await runtime.runActiveLoopWithLlm({
    icma: {
      input: {
        ingest: {
          agentId: "main-loop",
          sessionId: "session-loop",
          taskSummary: "active live loop task",
          materials: [{ kind: "user_input", ref: "msg:active:1" }],
          lineage: {
            agentId: "main-loop",
            projectId: "proj-loop",
            depth: 0,
            status: "active",
            branchFamily: createCmpBranchFamily({
              workBranch: "work/main-loop",
              cmpBranch: "cmp/main-loop",
              mpBranch: "mp/main-loop",
              tapBranch: "tap/main-loop",
            }),
          },
        },
        createdAt: "2026-03-31T00:10:00.000Z",
        loopId: "loop-icma-active",
      },
    },
    iterator: {
      input: {
        agentId: "main-loop",
        deltaId: "delta-active-1",
        candidateId: "candidate-active-1",
        branchRef: "refs/heads/cmp/main-loop",
        commitRef: "commit-active-1",
        reviewRef: "refs/cmp/review/candidate-active-1",
        createdAt: "2026-03-31T00:10:01.000Z",
        metadata: {
          sourceSectionIds: ["section-pre-active-1"],
        },
      },
    },
    checker: {
      input: {
        agentId: "main-loop",
        candidateId: "candidate-active-1",
        checkedSnapshotId: "snapshot-active-1",
        checkedAt: "2026-03-31T00:10:02.000Z",
        suggestPromote: false,
        metadata: {
          sourceSectionIds: ["section-pre-active-1"],
          checkedSectionIds: ["section-checked-active-1"],
        },
      },
    },
    dbagent: {
      input: {
        checkedSnapshot: {
          snapshotId: "snapshot-active-1",
          agentId: "main-loop",
          lineageRef: "lineage:main-loop",
          branchRef: "refs/heads/cmp/main-loop",
          commitRef: "commit-active-1",
          checkedAt: "2026-03-31T00:10:03.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
        projectionId: "projection-active-1",
        contextPackage: {
          packageId: "package-active-1",
          sourceProjectionId: "projection-active-1",
          targetAgentId: "child-loop",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-active-1:child-loop:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:10:03.000Z",
        },
        createdAt: "2026-03-31T00:10:03.000Z",
        loopId: "loop-dbagent-active",
        metadata: {
          sourceRequestId: "request-active-1",
          sourceSectionIds: ["section-checked-active-1"],
        },
      },
    },
    dispatcher: {
      input: {
        contextPackage: {
          packageId: "package-active-1",
          sourceProjectionId: "projection-active-1",
          targetAgentId: "child-loop",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-active-1:child-loop:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:10:04.000Z",
        },
        dispatch: {
          agentId: "main-loop",
          packageId: "package-active-1",
          sourceAgentId: "main-loop",
          targetAgentId: "child-loop",
          targetKind: "child",
          metadata: {
            sourceRequestId: "request-active-1",
            sourceSnapshotId: "snapshot-active-1",
          },
        },
        receipt: {
          dispatchId: "dispatch-active-1",
          packageId: "package-active-1",
          sourceAgentId: "main-loop",
          targetAgentId: "child-loop",
          status: "delivered",
          deliveredAt: "2026-03-31T00:10:04.000Z",
        },
        createdAt: "2026-03-31T00:10:04.000Z",
        loopId: "loop-dispatcher-active",
      },
    },
  });

  assert.equal(result.icma.loop.liveTrace?.status, "live_applied");
  assert.equal(result.iterator.liveTrace?.status, "live_applied");
  assert.equal(result.checker.checkerRecord.liveTrace?.status, "live_applied");
  assert.equal(result.dbagent.loop.liveTrace?.status, "live_applied");
  assert.equal(result.dispatcher.loop.liveTrace?.status, "live_applied");
  assert.equal(result.summary.live.dispatcher.status, "succeeded");
});

test("CmpFiveAgentRuntime can orchestrate one passive live loop for historical return", async () => {
  const runtime = createCmpFiveAgentRuntime({
    live: {
      executors: {
        dbagent: async () => ({
          output: {
            packageTopology: "passive_reply_plus_timeline_plus_task_snapshots",
            bundleSchemaVersion: "cmp-dispatch-bundle/v1",
            materializationRationale: "dbagent passive live loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-passive-dbagent",
        }),
        dispatcher: async () => ({
          output: {
            routeRationale: "dispatcher passive live loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
          requestId: "req-passive-dispatcher",
        }),
      },
    },
  });

  const result = await runtime.runPassiveLoopWithLlm({
    dbagent: {
      input: {
        loopId: "loop-passive-dbagent",
        request: {
          requesterAgentId: "child-passive",
          projectId: "proj-passive",
          reason: "need historical context",
          query: {
            snapshotId: "snapshot-passive-1",
          },
        },
        snapshot: {
          snapshotId: "snapshot-passive-1",
          agentId: "child-passive",
          lineageRef: "lineage:child-passive",
          branchRef: "refs/heads/cmp/child-passive",
          commitRef: "commit-passive-1",
          checkedAt: "2026-03-31T00:30:00.000Z",
          qualityLabel: "usable",
          promotable: false,
        },
        contextPackage: {
          packageId: "package-passive-1",
          sourceProjectionId: "projection-passive-1",
          targetAgentId: "child-passive",
          packageKind: "historical_reply",
          packageRef: "cmp-package:snapshot-passive-1:child-passive:historical_reply",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:30:00.000Z",
        },
        createdAt: "2026-03-31T00:30:00.000Z",
        metadata: {
          sourceRequestId: "request-passive-1",
          sourceSectionIds: ["section-passive-1"],
        },
      },
    },
    dispatcher: {
      input: {
        loopId: "loop-passive-dispatcher",
        request: {
          requesterAgentId: "child-passive",
          projectId: "proj-passive",
          reason: "need historical context",
          query: {
            snapshotId: "snapshot-passive-1",
          },
        },
        contextPackage: {
          packageId: "package-passive-1",
          sourceProjectionId: "projection-passive-1",
          targetAgentId: "child-passive",
          packageKind: "historical_reply",
          packageRef: "cmp-package:snapshot-passive-1:child-passive:historical_reply",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:30:01.000Z",
        },
        createdAt: "2026-03-31T00:30:01.000Z",
      },
    },
  });

  assert.equal(result.dbagent.loop.liveTrace?.status, "live_applied");
  assert.equal(result.dispatcher.liveTrace?.status, "live_applied");
  assert.equal(result.dispatcher.bundle.governance.routeRationale, "dispatcher passive live loop rationale");
  assert.equal(result.summary.live.dispatcher.status, "succeeded");
});
