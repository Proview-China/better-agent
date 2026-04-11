import assert from "node:assert/strict";
import test from "node:test";

import { createCmpBranchFamily } from "../cmp-types/index.js";
import { createCmpFiveAgentConfiguration } from "./configuration.js";
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

test("CmpFiveAgentRuntime can surface peer exchange pending approval inside the active loop", async () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v8" }),
    live: {
      executors: {
        icma: async () => ({
          output: {
            intent: "peer exchange active loop intent",
            sourceAnchorRefs: ["msg:peer:1"],
            candidateBodyRefs: ["msg:peer:1"],
            boundary: "preserve_root_system_and_emit_controlled_fragments_only",
            operatorGuide: "operator peer loop",
            childGuide: "child peer loop",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        iterator: async () => ({
          output: {
            sourceSectionIds: ["section-pre-peer-1"],
            commitRationale: "iterator peer loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        checker: async () => ({
          output: {
            sourceSectionIds: ["section-pre-peer-1"],
            checkedSectionIds: ["section-checked-peer-1"],
            splitExecutions: [{
              decisionRef: "split-peer-1",
              sourceSectionId: "section-pre-peer-1",
              proposedSectionIds: ["section-checked-peer-1"],
              rationale: "peer split",
            }],
            mergeExecutions: [],
            trimSummary: "checker peer loop trim",
            shortReason: "peer checked short",
            detailedReason: "peer checked detail",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        dbagent: async () => ({
          output: {
            packageTopology: "active_plus_timeline_plus_task_snapshots",
            bundleSchemaVersion: "cmp-dispatch-bundle/v1",
            materializationRationale: "dbagent peer loop rationale",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        dispatcher: async () => ({
          output: {
            routeRationale: "peer exchange should stay slim and await parent approval",
            bodyStrategy: "peer_exchange_slim",
            slimExchangeFields: ["packageId", "packageKind", "primaryRef"],
            scopePolicy: "peer_exchange_requires_explicit_parent_approval",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
      },
    },
  });

  const result = await runtime.runActiveLoopWithLlm({
    icma: {
      input: {
        ingest: {
          agentId: "peer-main",
          sessionId: "peer-session",
          taskSummary: "peer exchange active loop task",
          materials: [{ kind: "user_input", ref: "msg:peer:1" }],
          lineage: {
            agentId: "peer-main",
            projectId: "peer-proj",
            depth: 0,
            status: "active",
            branchFamily: createCmpBranchFamily({
              workBranch: "work/peer-main",
              cmpBranch: "cmp/peer-main",
              mpBranch: "mp/peer-main",
              tapBranch: "tap/peer-main",
            }),
          },
        },
        createdAt: "2026-04-11T00:20:00.000Z",
        loopId: "peer-icma-loop",
      },
    },
    iterator: {
      input: {
        agentId: "peer-main",
        deltaId: "delta-peer-1",
        candidateId: "candidate-peer-1",
        branchRef: "refs/heads/cmp/peer-main",
        commitRef: "commit-peer-1",
        reviewRef: "refs/cmp/review/candidate-peer-1",
        createdAt: "2026-04-11T00:20:01.000Z",
        metadata: {
          sourceSectionIds: ["section-pre-peer-1"],
        },
      },
    },
    checker: {
      input: {
        agentId: "peer-main",
        candidateId: "candidate-peer-1",
        checkedSnapshotId: "snapshot-peer-1",
        checkedAt: "2026-04-11T00:20:02.000Z",
        metadata: {
          sourceSectionIds: ["section-pre-peer-1"],
          checkedSectionIds: ["section-checked-peer-1"],
        },
      },
    },
    dbagent: {
      input: {
        checkedSnapshot: {
          snapshotId: "snapshot-peer-1",
          agentId: "peer-main",
          lineageRef: "lineage:peer-main",
          branchRef: "refs/heads/cmp/peer-main",
          commitRef: "commit-peer-1",
          checkedAt: "2026-04-11T00:20:03.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
        projectionId: "projection-peer-1",
        contextPackage: {
          packageId: "package-peer-1",
          sourceProjectionId: "projection-peer-1",
          targetAgentId: "peer-b",
          packageKind: "peer_exchange",
          packageRef: "cmp-package:snapshot-peer-1:peer-b:peer_exchange",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-04-11T00:20:03.000Z",
        },
        createdAt: "2026-04-11T00:20:03.000Z",
        loopId: "peer-dbagent-loop",
        metadata: {
          sourceRequestId: "request-peer-1",
          sourceSectionIds: ["section-checked-peer-1"],
        },
      },
    },
    dispatcher: {
      input: {
        contextPackage: {
          packageId: "package-peer-1",
          sourceProjectionId: "projection-peer-1",
          targetAgentId: "peer-b",
          packageKind: "peer_exchange",
          packageRef: "cmp-package:snapshot-peer-1:peer-b:peer_exchange",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-04-11T00:20:04.000Z",
        },
        dispatch: {
          agentId: "peer-main",
          packageId: "package-peer-1",
          sourceAgentId: "peer-main",
          targetAgentId: "peer-b",
          targetKind: "peer",
          metadata: {
            parentAgentId: "parent-main",
            currentStateSummary: "peer package awaits approval",
            sourceRequestId: "request-peer-1",
            sourceSnapshotId: "snapshot-peer-1",
          },
        },
        receipt: {
          dispatchId: "dispatch-peer-1",
          packageId: "package-peer-1",
          sourceAgentId: "peer-main",
          targetAgentId: "peer-b",
          status: "delivered",
          deliveredAt: "2026-04-11T00:20:04.000Z",
        },
        createdAt: "2026-04-11T00:20:04.000Z",
        loopId: "peer-dispatcher-loop",
      },
    },
  });

  assert.equal(result.dispatcher.loop.packageMode, "peer_exchange_slim");
  assert.equal(result.dispatcher.loop.bundle.target.targetIngress, "peer_exchange");
  assert.equal(result.dispatcher.loop.bundle.governance.scopePolicy, "peer_exchange_requires_explicit_parent_approval");
  assert.equal(result.summary.flow.pendingPeerApprovalCount, 1);
  assert.equal(result.summary.flow.approvedPeerApprovalCount, 0);
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

test("CmpFiveAgentRuntime passes configured prompt variants into role runtimes", async () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workflow_v3" }),
    live: {
      executors: {
        icma: async () => ({
          output: {
            intent: "variant ingress intent",
            sourceAnchorRefs: ["msg:variant:1"],
            candidateBodyRefs: ["msg:variant:1"],
            boundary: "preserve_root_system_and_emit_controlled_fragments_only",
            operatorGuide: "variant operator",
            childGuide: "variant child",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        checker: async () => ({
          output: {
            sourceSectionIds: ["section-pre-variant-1"],
            checkedSectionIds: ["section-checked-variant-1"],
            splitExecutions: [{
              decisionRef: "split-variant-1",
              sourceSectionId: "section-pre-variant-1",
              proposedSectionIds: ["section-checked-variant-1"],
              rationale: "variant split",
            }],
            mergeExecutions: [],
            trimSummary: "variant trim",
            shortReason: "variant short",
            detailedReason: "variant detail",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
        dbagent: async () => ({
          output: {
            passivePackagingStrategy: "variant_passive_strategy",
          },
          provider: "openai",
          model: "gpt-5.4",
        }),
      },
    },
  });

  const icma = await runtime.captureIcmaWithLlm({
    ingest: {
      agentId: "variant-main",
      sessionId: "variant-session",
      taskSummary: "variant task",
      materials: [{ kind: "user_input", ref: "msg:variant:1" }],
      lineage: {
        agentId: "variant-main",
        projectId: "variant-proj",
        depth: 0,
        status: "active",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/variant-main",
          cmpBranch: "cmp/variant-main",
          mpBranch: "mp/variant-main",
          tapBranch: "tap/variant-main",
        }),
      },
    },
    createdAt: "2026-04-11T00:00:00.000Z",
    loopId: "variant-icma-loop",
  });

  const checker = await runtime.evaluateCheckerWithLlm({
    agentId: "variant-main",
    candidateId: "variant-candidate",
    checkedSnapshotId: "variant-snapshot",
    checkedAt: "2026-04-11T00:00:01.000Z",
    metadata: {
      sourceSectionIds: ["section-pre-variant-1"],
      checkedSectionIds: ["section-checked-variant-1"],
    },
  });

  const dbagent = await runtime.servePassiveDbAgentWithLlm({
    request: {
      requesterAgentId: "variant-main",
      projectId: "variant-proj",
      reason: "need historical context",
      query: {
        snapshotId: "variant-snapshot",
      },
    },
    snapshot: {
      snapshotId: "variant-snapshot",
      agentId: "variant-main",
      lineageRef: "variant:main",
      branchRef: "refs/heads/cmp/variant-main",
      commitRef: "commit-variant",
      checkedAt: "2026-04-11T00:00:02.000Z",
    },
    contextPackage: {
      packageId: "variant-package",
      sourceProjectionId: "variant-projection",
      targetAgentId: "variant-main",
      packageKind: "historical_reply",
      packageRef: "cmp-package:variant",
      fidelityLabel: "checked_high_fidelity",
      createdAt: "2026-04-11T00:00:02.000Z",
    },
    createdAt: "2026-04-11T00:00:02.000Z",
    loopId: "variant-dbagent-loop",
  });

  assert.equal(icma.loop.metadata?.promptPackId, "cmp-five-agent/icma-prompt-pack/lean-v2");
  assert.equal(checker.checkerRecord.metadata?.promptPackId, "cmp-five-agent/checker-prompt-pack/workflow-v3");
  assert.equal(dbagent.loop.metadata?.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workflow-v3");
  assert.equal(runtime.createSummary("variant-main").configuredRoles.checker.promptPackId, "cmp-five-agent/checker-prompt-pack/workflow-v3");
});

test("CmpFiveAgentRuntime surfaces workmode prompt ids in summaries", () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v4" }),
  });

  const summary = runtime.createSummary();
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v4");
  assert.equal(summary.configuredRoles.iterator.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v4");
  assert.equal(summary.configuredRoles.checker.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v4");
  assert.equal(summary.configuredRoles.dbagent.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v4");
  assert.equal(summary.configuredRoles.dispatcher.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v4");
});

test("CmpFiveAgentRuntime surfaces v5 workmode prompt ids in summaries", () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v5" }),
  });

  const summary = runtime.createSummary();
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v5");
  assert.equal(summary.configuredRoles.iterator.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v5");
  assert.equal(summary.configuredRoles.checker.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v5");
  assert.equal(summary.configuredRoles.dbagent.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v5");
  assert.equal(summary.configuredRoles.dispatcher.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v5");
});

test("CmpFiveAgentRuntime surfaces v6 workmode prompt ids in summaries", () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v6" }),
  });

  const summary = runtime.createSummary();
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.iterator.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.checker.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.dbagent.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.dispatcher.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v6");
});

test("CmpFiveAgentRuntime surfaces v7 workmode prompt ids in summaries", () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v7" }),
  });

  const summary = runtime.createSummary();
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v7");
  assert.equal(summary.configuredRoles.dispatcher.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v7");
});

test("CmpFiveAgentRuntime surfaces v8 hybrid prompt ids in summaries", () => {
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({ promptVariant: "workmode_v8" }),
  });

  const summary = runtime.createSummary();
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/v1");
  assert.equal(summary.configuredRoles.iterator.promptPackId, "cmp-five-agent/iterator-prompt-pack/v1");
  assert.equal(summary.configuredRoles.checker.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.dbagent.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v6");
  assert.equal(summary.configuredRoles.dispatcher.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/v1");
});
