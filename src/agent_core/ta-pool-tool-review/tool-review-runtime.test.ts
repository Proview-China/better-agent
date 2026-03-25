import assert from "node:assert/strict";
import test from "node:test";

import type { CreateReviewDecisionInput } from "../ta-pool-types/index.js";
import {
  createAccessRequest,
  createPoolActivationSpec,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import {
  createTaActivationFailure,
} from "../ta-pool-runtime/activation-types.js";
import {
  createTaHumanGateEvent,
  createTaHumanGateState,
} from "../ta-pool-runtime/human-gate.js";
import {
  createTaPendingReplay,
} from "../ta-pool-runtime/replay-policy.js";
import {
  createToolReviewGovernanceTrace,
} from "./tool-review-contract.js";
import {
  createToolReviewSessionState,
  type ToolReviewSessionSnapshot,
} from "./tool-review-session.js";
import {
  createToolReviewerRuntime,
} from "./tool-review-runtime.js";

function createSourceDecision(
  overrides: Partial<CreateReviewDecisionInput> = {},
) {
  return createReviewDecision({
    decisionId: overrides.decisionId ?? "decision-1",
    requestId: overrides.requestId ?? "req-1",
    decision: overrides.decision ?? "redirected_to_provisioning",
    vote: overrides.vote ?? "redirect_to_provisioning",
    mode: overrides.mode ?? "strict",
    reason: overrides.reason ?? "Need provisioning before execution.",
    escalationTarget: overrides.escalationTarget,
    createdAt: overrides.createdAt ?? "2026-03-25T08:00:00.000Z",
  });
}

test("tool reviewer runtime stages activation and lifecycle shells as handoff-ready placeholders", async () => {
  const recorded: string[] = [];
  const runtime = createToolReviewerRuntime({
    recordHook: (result) => {
      recorded.push(`${result.governanceKind}:${result.runtimeStatus}`);
    },
  });
  const trace = createToolReviewGovernanceTrace({
    actionId: "action-activation-1",
    actorId: "tool-reviewer",
    reason: "Prepare activation handoff.",
    createdAt: "2026-03-25T08:00:00.000Z",
    sourceDecision: {
      decisionId: "decision-1",
      decision: "redirected_to_provisioning",
      vote: "redirect_to_provisioning",
      reason: "Need provisioning before execution.",
      createdAt: "2026-03-25T07:59:59.000Z",
    },
  });

  const activation = await runtime.submit({
    governanceAction: {
      kind: "activation",
      trace,
      provisionId: "prov-1",
      capabilityKey: "mcp.playwright",
      activationSpec: createPoolActivationSpec({
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify",
        registerOrReplace: "register_or_replace",
        generationStrategy: "create_next_generation",
        drainStrategy: "graceful",
        adapterFactoryRef: "factory:playwright",
        manifestPayload: { capabilityKey: "mcp.playwright" },
        bindingPayload: { bindingId: "binding-playwright-1" },
      }),
    },
  });
  const lifecycle = await runtime.submit({
    governanceAction: {
      kind: "lifecycle",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-lifecycle-1",
        actorId: "tool-reviewer",
        reason: "Prepare lifecycle registration.",
        createdAt: "2026-03-25T08:01:00.000Z",
      }),
      capabilityKey: "mcp.playwright",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
      binding: {
        bindingId: "binding-playwright-1",
        capabilityId: "cap-playwright-1",
        generation: 2,
        state: "disabled",
        adapterId: "adapter-playwright-1",
      },
    },
  });

  assert.equal(activation.runtimeStatus, "ready_for_handoff");
  assert.equal(activation.placeholder, false);
  assert.equal(activation.action.boundaryMode, "governance_only");
  assert.equal(activation.output.kind, "activation");
  assert.equal(activation.output.status, "ready_for_activation_handoff");
  assert.match(activation.output.summary, /staged/u);
  assert.equal(lifecycle.runtimeStatus, "ready_for_handoff");
  assert.equal(lifecycle.output.kind, "lifecycle");
  assert.equal(lifecycle.output.targetBindingState, "active");
  assert.deepEqual(recorded, [
    "activation:ready_for_handoff",
    "lifecycle:ready_for_handoff",
  ]);
  assert.equal(runtime.listSessions().length, 1);
  assert.equal(runtime.listActions(activation.sessionId).length, 2);
  const plan = runtime.createGovernancePlan(activation.sessionId);
  assert.ok(plan);
  assert.deepEqual(plan?.capabilityKeys, ["mcp.playwright"]);
  assert.equal(plan?.counts.readyForHandoff, 2);
  assert.equal(plan?.latestActionId, "action-lifecycle-1");
  const report = runtime.createQualityReport(activation.sessionId);
  assert.ok(report);
  assert.equal(report?.verdict, "handoff_ready");
  assert.equal(report?.readyForHandoffReviewIds.length, 2);
});

test("tool reviewer runtime preserves human gate waiting status and replay re-review status", async () => {
  const runtime = createToolReviewerRuntime();
  const request = {
    requestId: "req-2",
    sessionId: "session-2",
    runId: "run-2",
    agentId: "agent-2",
    requestedCapabilityKey: "computer.use",
    requestedTier: "B3" as const,
    reason: "Need human approval before taking desktop control.",
    mode: "strict" as const,
    createdAt: "2026-03-25T09:00:00.000Z",
  };
  const reviewDecision = createSourceDecision({
    decisionId: "decision-human-1",
    requestId: request.requestId,
    decision: "escalated_to_human",
    vote: "escalate_to_human",
    reason: "Desktop control requires explicit approval.",
    escalationTarget: "human-review",
  });
  const accessRequest = createAccessRequest(request);
  const gate = createTaHumanGateState({
    gateId: "gate-1",
    request: accessRequest,
    plainLanguageRisk: {
      plainLanguageSummary: "Desktop control needs a human gate.",
      requestedAction: "Take desktop control",
      riskLevel: "dangerous",
      whyItIsRisky: "The tool can affect the user's machine directly.",
      possibleConsequence: "Unexpected local side effects.",
      whatHappensIfNotRun: "The task stays blocked.",
      availableUserActions: [],
    },
    reason: reviewDecision.reason,
    createdAt: "2026-03-25T09:00:01.000Z",
    sourceDecisionId: reviewDecision.decisionId,
  });
  const latestEvent = createTaHumanGateEvent({
    eventId: "gate-event-1",
    gateId: gate.gateId,
    requestId: gate.requestId,
    type: "human_gate.requested",
    createdAt: "2026-03-25T09:00:02.000Z",
    actorId: "tool-reviewer",
  });
  const humanGate = await runtime.submit({
    governanceAction: {
      kind: "human_gate",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-human-1",
        actorId: "tool-reviewer",
        reason: "Carry gate state into tool reviewer shell.",
        createdAt: "2026-03-25T09:00:02.000Z",
        request: {
          requestId: request.requestId,
          sessionId: request.sessionId,
          runId: request.runId,
          requestedCapabilityKey: request.requestedCapabilityKey,
          requestedTier: request.requestedTier,
          mode: request.mode,
          canonicalMode: accessRequest.canonicalMode,
        },
        sourceDecision: {
          decisionId: reviewDecision.decisionId,
          decision: reviewDecision.decision,
          vote: reviewDecision.vote,
          reason: reviewDecision.reason,
          escalationTarget: reviewDecision.escalationTarget,
          createdAt: reviewDecision.createdAt,
        },
      }),
      capabilityKey: request.requestedCapabilityKey,
      gate,
      latestEvent,
    },
  });
  const replay = await runtime.submit({
    governanceAction: {
      kind: "replay",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-replay-1",
        actorId: "tool-reviewer",
        reason: "Carry replay state into tool reviewer shell.",
        createdAt: "2026-03-25T09:05:00.000Z",
      }),
      capabilityKey: "computer.use",
      replay: createTaPendingReplay({
        replayId: "replay-1",
        request: {
          requestId: "req-2",
          requestedCapabilityKey: "computer.use",
        },
        provisionBundle: {
          provisionId: "prov-2",
          replayPolicy: "re_review_then_dispatch",
        },
        createdAt: "2026-03-25T09:04:59.000Z",
      }),
    },
  });
  const activationFailure = await runtime.submit({
    governanceAction: {
      kind: "activation",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-activation-failed-1",
        actorId: "tool-reviewer",
        reason: "Record failed activation handoff.",
        createdAt: "2026-03-25T09:06:00.000Z",
      }),
      provisionId: "prov-3",
      capabilityKey: "computer.use",
      activationSpec: createPoolActivationSpec({
        targetPool: "ta-capability-pool",
        activationMode: "activate_immediately",
        registerOrReplace: "replace",
        generationStrategy: "shadow_generation",
        drainStrategy: "force",
        adapterFactoryRef: "factory:computer-use",
        manifestPayload: { capabilityKey: "computer.use" },
        bindingPayload: { bindingId: "binding-computer-use-1" },
      }),
      latestFailure: createTaActivationFailure({
        attemptId: "attempt-1",
        provisionId: "prov-3",
        capabilityKey: "computer.use",
        failedAt: "2026-03-25T09:06:01.000Z",
        code: "driver_unavailable",
        message: "Activation driver has not been wired yet.",
      }),
    },
  });

  assert.equal(humanGate.runtimeStatus, "waiting_human");
  assert.equal(humanGate.placeholder, false);
  assert.equal(humanGate.output.kind, "human_gate");
  assert.equal(humanGate.output.status, "waiting_human");
  assert.equal(replay.runtimeStatus, "ready_for_handoff");
  assert.equal(replay.output.kind, "replay");
  assert.equal(replay.output.status, "ready_for_re_review");
  assert.equal(activationFailure.runtimeStatus, "blocked");
  assert.equal(activationFailure.output.kind, "activation");
  assert.equal(activationFailure.output.status, "activation_failed");
  const humanGateSession = runtime.getSession(humanGate.sessionId);
  assert.ok(humanGateSession);
  assert.equal(humanGateSession?.status, "waiting_human");
  const defaultSession = runtime.getSession(replay.sessionId);
  assert.ok(defaultSession);
  assert.equal(defaultSession?.status, "blocked");
  const quality = runtime.createQualityReport(replay.sessionId);
  assert.ok(quality);
  assert.equal(quality?.verdict, "blocked");
  assert.equal(quality?.blockingReviewIds.length, 1);
  const humanGateQuality = runtime.createQualityReport(humanGate.sessionId);
  assert.ok(humanGateQuality);
  assert.equal(humanGateQuality?.verdict, "waiting_human");
  assert.equal(humanGateQuality?.waitingHumanReviewIds.length, 1);
  const plans = runtime.listGovernancePlans();
  assert.equal(plans.length, 2);
});

test("tool reviewer runtime can restore durable-friendly session snapshots", async () => {
  const snapshotSession = createToolReviewSessionState({
    sessionId: "tool-review-session:restore",
    createdAt: "2026-03-25T10:30:00.000Z",
  });
  const restoreSnapshot: ToolReviewSessionSnapshot[] = [
    {
      session: snapshotSession,
      actions: [],
    },
  ];
  const runtime = createToolReviewerRuntime({
    restoreSnapshot,
  });

  const result = await runtime.submit({
    sessionId: "tool-review-session:restore",
    governanceAction: {
      kind: "replay",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-restore-1",
        actorId: "tool-reviewer",
        reason: "Resume replay governance after restart.",
        createdAt: "2026-03-25T10:31:00.000Z",
      }),
      capabilityKey: "mcp.playwright",
      replay: createTaPendingReplay({
        replayId: "replay-restore-1",
        request: {
          requestId: "req-restore-1",
          requestedCapabilityKey: "mcp.playwright",
        },
        provisionBundle: {
          provisionId: "prov-restore-1",
          replayPolicy: "re_review_then_dispatch",
        },
        createdAt: "2026-03-25T10:30:59.000Z",
      }),
    },
  });

  assert.equal(result.sessionId, "tool-review-session:restore");
  assert.equal(runtime.listSessions().length, 1);
  assert.equal(runtime.listActions(result.sessionId).length, 1);
  const snapshots = runtime.createSnapshots();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.session.latestActionId, "action-restore-1");
  const restoredPlan = runtime.createGovernancePlan("tool-review-session:restore");
  assert.ok(restoredPlan);
  assert.equal(restoredPlan?.counts.readyForHandoff, 1);
});

test("tool reviewer hydration restores governance records without auto-creating new actions", async () => {
  const original = createToolReviewerRuntime();
  const trace = createToolReviewGovernanceTrace({
    actionId: "action-no-auto-run-1",
    actorId: "tool-reviewer",
    reason: "Persist a replay handoff without executing it.",
    createdAt: "2026-03-25T10:40:00.000Z",
  });

  await original.submit({
    governanceAction: {
      kind: "replay",
      trace,
      capabilityKey: "computer.use",
      replay: createTaPendingReplay({
        replayId: "replay-no-auto-run-1",
        request: {
          requestId: "req-no-auto-run-1",
          requestedCapabilityKey: "computer.use",
        },
        provisionBundle: {
          provisionId: "prov-no-auto-run-1",
          replayPolicy: "re_review_then_dispatch",
        },
        createdAt: "2026-03-25T10:39:59.000Z",
      }),
    },
    sessionId: "tool-review-session:no-auto-run",
  });

  const snapshots = original.createSnapshots();
  const restored = createToolReviewerRuntime({
    restoreSnapshot: snapshots,
  });

  assert.equal(restored.listSessions().length, 1);
  assert.equal(restored.listActions().length, 1);
  assert.equal(restored.listActions()[0]?.governanceKind, "replay");
  assert.equal(restored.listActions()[0]?.status, "ready_for_handoff");
  const restoredReport = restored.createQualityReport("tool-review-session:no-auto-run");
  assert.ok(restoredReport);
  assert.equal(restoredReport?.verdict, "handoff_ready");
});

test("tool reviewer lifecycle blocked output stays governance-only and preserves failure details", async () => {
  const runtime = createToolReviewerRuntime();

  const result = await runtime.submit({
    governanceAction: {
      kind: "lifecycle",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-lifecycle-blocked-1",
        actorId: "tool-reviewer",
        reason: "Lifecycle should stay declarative when target binding is missing.",
        createdAt: "2026-03-25T10:45:00.000Z",
      }),
      capabilityKey: "mcp.playwright",
      lifecycleAction: "suspend",
      targetPool: "ta-capability-pool",
      failure: {
        code: "agent_core_capability_binding_missing",
        message: "Capability binding missing.",
      },
    },
  });

  assert.equal(result.runtimeStatus, "blocked");
  assert.equal(result.action.boundaryMode, "governance_only");
  assert.equal(result.output.kind, "lifecycle");
  assert.equal(result.output.status, "lifecycle_blocked");
  assert.equal(result.output.failure?.code, "agent_core_capability_binding_missing");
});

test("tool reviewer runtime can summarize a governance plan and quality report from recorded actions", async () => {
  const runtime = createToolReviewerRuntime();
  const sessionId = "tool-review-session:plan-1";

  await runtime.submit({
    sessionId,
    governanceAction: {
      kind: "replay",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-plan-replay-1",
        actorId: "tool-reviewer",
        reason: "Replay should be staged for re-review.",
        createdAt: "2026-03-25T11:00:00.000Z",
      }),
      capabilityKey: "computer.use",
      replay: createTaPendingReplay({
        replayId: "replay-plan-1",
        request: {
          requestId: "req-plan-1",
          requestedCapabilityKey: "computer.use",
        },
        provisionBundle: {
          provisionId: "prov-plan-1",
          replayPolicy: "re_review_then_dispatch",
        },
        createdAt: "2026-03-25T10:59:59.000Z",
      }),
    },
  });

  const plan = runtime.createGovernancePlan(sessionId);
  const report = runtime.createQualityReport(sessionId);

  assert.ok(plan);
  assert.equal(plan?.counts.readyForHandoff, 1);
  assert.equal(plan?.recommendedNextStep, "Continue the next activation, lifecycle, or replay handoff on the runtime mainline.");
  assert.equal(plan?.items[0]?.readyForHandoff, true);
  assert.ok(report);
  assert.equal(report?.verdict, "handoff_ready");
  assert.equal(report?.readyForHandoffReviewIds.length, 1);
  assert.match(report?.summary ?? "", /ready to hand back/i);
});
