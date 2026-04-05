import assert from "node:assert/strict";
import test from "node:test";

import {
  RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
  createMcpReadCapabilityPackage,
  createRaxWebsearchCapabilityPackage,
} from "./capability-package/index.js";
import { createGoalSource } from "./goal/goal-source.js";
import type { ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { createRaxMcpCapabilityManifest } from "./integrations/rax-mcp-adapter.js";
import { createRaxSearchGroundCapabilityDefinition } from "./integrations/rax-port.js";
import { createRaxMcpCapabilityAdapter } from "./integrations/rax-mcp-adapter.js";
import { createRaxWebsearchActivationFactory } from "./integrations/rax-websearch-adapter.js";
import { createAgentCoreRuntime } from "./runtime.js";
import type { CapabilityAdapter, CapabilityCallIntent, CapabilityPackage } from "./index.js";
import { createAgentCapabilityProfile, createProvisionArtifactBundle, createProvisionRequest } from "./ta-pool-types/index.js";
import { createFirstWaveCapabilityProfile } from "./ta-pool-model/index.js";
import { createReviewerRuntime } from "./ta-pool-review/index.js";
import { createToolReviewGovernanceTrace } from "./ta-pool-tool-review/index.js";
import { TA_ENFORCEMENT_METADATA_KEY } from "./ta-pool-runtime/enforcement-guard.js";
import { createTaPendingReplay, createTaResumeEnvelope } from "./ta-pool-runtime/index.js";
import type { RaxFacade } from "../rax/facade.js";
import {
  DEFAULT_COMPATIBILITY_PROFILES,
  McpNativeRuntime,
  McpRuntime,
  SkillRuntime,
  createConfiguredRaxFacade,
  defaultCapabilityRouter,
  type WebSearchRuntimeLike,
} from "../rax/index.js";

function readCapabilityAccessAssignment(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const capabilityAccess = metadata?.capabilityAccess;
  if (
    capabilityAccess
    && typeof capabilityAccess === "object"
    && "assignment" in capabilityAccess
    && typeof capabilityAccess.assignment === "string"
  ) {
    return capabilityAccess.assignment;
  }

  return undefined;
}

function createFakeRaxFacade() {
  const fakeWebSearchRuntime: WebSearchRuntimeLike = {
    async executePreparedInvocation(invocation) {
      return {
        status: "success",
        provider: invocation.provider,
        model: invocation.model,
        layer: invocation.layer,
        capability: "search",
        action: "ground",
        output: {
          answer: "Example Domain",
          citations: [],
          sources: [{ url: "https://example.com", title: "Example Domain" }],
          raw: invocation.payload,
        },
        evidence: [{ adapterId: invocation.adapterId }],
      };
    },
    createErrorResult(params) {
      return {
        status: "failed",
        provider: params.provider,
        model: params.model,
        layer: "api",
        capability: "search",
        action: "ground",
        error: params.error,
      };
    },
  };

  return createConfiguredRaxFacade(
    defaultCapabilityRouter,
    DEFAULT_COMPATIBILITY_PROFILES,
    new McpRuntime(),
    fakeWebSearchRuntime,
    new SkillRuntime(),
    new McpNativeRuntime(),
  );
}

function createFakeMcpFacade(): Pick<RaxFacade, "mcp"> {
  return {
    mcp: {
      shared: {} as RaxFacade["mcp"]["shared"],
      native: {
        prepare: () => {
          throw new Error("not used");
        },
        serve: () => {
          throw new Error("not used");
        },
        build: () => {
          throw new Error("not used");
        },
        compose: () => {
          throw new Error("not used");
        },
        execute: async () => {
          throw new Error("not used");
        },
        composeAndExecute: async () => {
          throw new Error("not used");
        },
      },
      use: async () => {
        throw new Error("not used");
      },
      connect: async () => {
        throw new Error("not used");
      },
      listConnections: () => [],
      disconnect: async () => {},
      disconnectAll: async () => {},
      listTools: async (options) => ({
        connectionId: options.input.connectionId,
        tools: [{ name: "browser.search" }, { name: "filesystem.read" }],
      }),
      listResources: async () => {
        throw new Error("not used");
      },
      readResource: async (options) => ({
        connectionId: options.input.connectionId,
        uri: options.input.uri,
        contents: [{ type: "text", text: "resource-body" }],
      }),
      listPrompts: async () => {
        throw new Error("not used");
      },
      getPrompt: async () => {
        throw new Error("not used");
      },
      call: async () => {
        throw new Error("not used");
      },
      serve: () => {
        throw new Error("not used");
      },
    },
  };
}

function toRuntimeCapabilityManifest(
  capabilityPackage: CapabilityPackage,
  capabilityId: string,
) {
  return {
    capabilityId,
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    kind: capabilityPackage.manifest.capabilityKind,
    version: capabilityPackage.manifest.version,
    generation: capabilityPackage.manifest.generation,
    description: capabilityPackage.manifest.description,
    routeHints: capabilityPackage.manifest.routeHints,
    tags: capabilityPackage.manifest.tags,
    metadata: capabilityPackage.manifest.metadata,
  };
}

test("AgentCoreRuntime can persist and recover TAP control-plane snapshot through checkpoint store", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap-checkpoint",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-tap-checkpoint",
      sessionId: session.sessionId,
      userInput: "Persist tap runtime snapshot after a human gate is opened.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-checkpoint-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T18:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-ta-checkpoint-1",
      intentId: "intent-ta-checkpoint-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "capture screenshot",
      },
      priority: "normal",
    },
  };

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Checkpoint should persist the waiting human gate snapshot.",
  });

  assert.equal(waiting.status, "waiting_human");
  const stored = await runtime.writeTapDurableCheckpoint(created.run.runId, "manual");
  assert.ok(stored);

  const tapSnapshot = await runtime.recoverTapRuntimeSnapshot(created.run.runId);
  assert.equal(tapSnapshot?.humanGates.length, 1);
  assert.equal(tapSnapshot?.humanGates[0]?.capabilityKey, "computer.use");
});

test("AgentCoreRuntime can hydrate reviewer, tool_reviewer, and provision durable state from TAP snapshot", async () => {
  const profile = createAgentCapabilityProfile({
    profileId: "profile.runtime.tap-hydrate",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
    allowedCapabilityPatterns: ["computer.*"],
  });
  const runtime = createAgentCoreRuntime({ taProfile: profile });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-tap-hydrate",
      sessionId: session.sessionId,
      userInput: "Hydrate reviewer, tool reviewer, and provision durable state.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-hydrate-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T18:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-ta-hydrate-1",
      intentId: "intent-ta-hydrate-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "hydrate durable lanes",
      },
      priority: "normal",
    },
  };

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Need a waiting human gate for durability hydration.",
  });
  assert.equal(waiting.status, "waiting_human");
  assert.ok(waiting.accessRequest);

  await runtime.reviewerRuntime?.submit({
    request: waiting.accessRequest,
    profile,
  });
  assert.equal(runtime.reviewerRuntime?.listDurableStates().length, 1);

  const toolReviewTrace = createToolReviewGovernanceTrace({
    actionId: "tool-review-action-1",
    actorId: "tool-reviewer",
    reason: "Stage activation governance review.",
    createdAt: "2026-03-25T18:00:01.000Z",
  });
  await runtime.toolReviewerRuntime?.submit({
    governanceAction: {
      kind: "activation",
      trace: toolReviewTrace,
      provisionId: "provision-hydrate-1",
      capabilityKey: "computer.use",
      activationSpec: {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify",
        registerOrReplace: "register_or_replace",
        generationStrategy: "create_next_generation",
        drainStrategy: "graceful",
        adapterFactoryRef: "factory:computer.use",
      },
    },
    sessionId: "tool-review-session-hydrate-1",
  });

  const provisionRequest = createProvisionRequest({
    provisionId: "provision-hydrate-1",
    sourceRequestId: "request-hydrate-1",
    requestedCapabilityKey: "computer.use",
    reason: "Need provision runtime durable state.",
    createdAt: "2026-03-25T18:00:02.000Z",
  });
  await runtime.provisionerRuntime?.submit(provisionRequest);

  const snapshot = runtime.createTapRuntimeSnapshot();
  assert.ok(snapshot.reviewerDurableSnapshot);
  assert.ok(snapshot.toolReviewerSessions);
  assert.ok(snapshot.provisionerDurableSnapshot);
  assert.equal(snapshot.humanGateContexts?.length, 1);

  const recovered = createAgentCoreRuntime({ taProfile: profile });
  recovered.hydrateRecoveredTapRuntimeSnapshot(snapshot);

  assert.equal(recovered.reviewerRuntime?.listDurableStates().length, 1);
  assert.equal(recovered.toolReviewerRuntime?.listSessions().length, 2);
  assert.equal(recovered.provisionerRuntime?.getBundleHistory("provision-hydrate-1").length, 2);
  assert.equal(recovered.listTaHumanGates().length, 1);
  assert.equal(recovered.listTaResumeEnvelopes().length >= 1, true);
});

test("AgentCoreRuntime records tool reviewer governance sessions from runtime human-gate, replay, and activation paths", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tool-review-mainline",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-tool-review-mainline",
      sessionId: session.sessionId,
      userInput: "Record tool reviewer mainline governance events.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-tool-review-mainline-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-tool-review-mainline-1",
      intentId: "intent-tool-review-mainline-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "capture screenshot",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Need tool reviewer to follow the human gate path.",
  });

  assert.equal(waiting.status, "waiting_human");
  assert.equal(runtime.toolReviewerRuntime?.listSessions().length, 1);
  assert.equal(runtime.toolReviewerRuntime?.listActions().length, 1);
  assert.equal(runtime.toolReviewerRuntime?.listActions()[0]?.governanceKind, "human_gate");
  assert.equal(runtime.toolReviewerRuntime?.listActions().every((action) => action.boundaryMode === "governance_only"), true);
  assert.equal(runtime.getToolReviewerSession(`tool-review:request:${waiting.accessRequest!.requestId}`)?.status, "waiting_human");
  assert.equal(runtime.listToolReviewerQualityReports()[0]?.verdict, "waiting_human");

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: runtime.listTaHumanGates()[0]!.gateId,
    action: "approve",
    actorId: "user-tool-reviewer",
  });
  assert.equal(approved.status, "provisioned");
  assert.equal(runtime.toolReviewerRuntime?.listActions().some((action) => action.governanceKind === "replay"), true);
  assert.equal(runtime.listTmaSessions().length >= 2, true);
  assert.equal(runtime.getProvisionDeliveryReport(approved.provisionRequest!.provisionId)?.status, "ready");
  assert.equal(
    runtime.getProvisionDeliveryReport(approved.provisionRequest!.provisionId)?.recommendedNextStep,
    "Bundle is ready for tool reviewer quality checks, activation review, and replay planning.",
  );

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.tool-review-mainline",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "computer.use";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "tool-review-mainline-activation-ok",
        },
        completedAt: "2026-03-25T20:00:02.000Z",
      };
    },
  }));

  const activation = await runtime.activateTaProvisionAsset(approved.provisionRequest!.provisionId);
  assert.equal(activation.status, "activated");
  assert.equal(runtime.toolReviewerRuntime?.listActions().some((action) => action.governanceKind === "activation"), true);
  assert.equal(runtime.toolReviewerRuntime?.listActions().every((action) => action.boundaryMode === "governance_only"), true);
  const governancePlans = runtime.listToolReviewerGovernancePlans();
  assert.equal(governancePlans.length >= 1, true);
  assert.equal(governancePlans.some((plan) => plan.counts.readyForHandoff >= 1), true);
  assert.equal(runtime.hasPendingTapGovernanceWork(), true);
  assert.equal(runtime.createTapGovernanceSnapshot().blockingCapabilityKeys.includes("computer.use"), true);
  assert.equal(runtime.listToolReviewerQualityReports().some((report) => report.verdict === "handoff_ready"), true);
  assert.equal(runtime.listToolReviewerTmaWorkOrders().some((workOrder) => workOrder.capabilityKey === "computer.use"), true);
  assert.equal(
    runtime.getToolReviewerTmaWorkOrder(`tool-review:provision:${approved.provisionRequest!.provisionId}`)?.requestedLane,
    "bootstrap",
  );
  const governanceObject = runtime.createTapGovernanceObject({
    taskMode: "restricted",
    userOverride: {
      automationDepth: "prefer_human",
    },
  });
  assert.equal(governanceObject.shared15ViewMatrix.length, 15);
  assert.equal(governanceObject.taskPolicy.effectiveMode, "restricted");
  assert.equal(governanceObject.userSurface.automationDepth, "prefer_human");
  assert.equal(runtime.createTapUserSurfaceSnapshot().visibleMode, "permissive");
  assert.equal(runtime.createTapCmpMpReadyChecklist().reviewerSectionRegistryReady, true);
  const taskGovernance = runtime.createTapTaskGovernance({
    taskId: "task-tool-review-mainline",
    requestedMode: "standard",
    userOverride: {
      requestedMode: "permissive",
      automationDepth: "prefer_auto",
    },
  });
  assert.equal(taskGovernance.taskPolicy.effectiveMode, "permissive");
  assert.equal(taskGovernance.taskPolicy.automationDepth, "prefer_auto");
  assert.equal(taskGovernance.objectId, "tap-governance:profile.runtime.tool-review-mainline:permissive:task-tool-review-mainline");
});

test("AgentCoreRuntime records a unified three-agent usage ledger across reviewer, tool reviewer, and TMA", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.three-agent-usage-ledger",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-three-agent-usage-ledger",
      sessionId: session.sessionId,
      userInput: "Leave a durable three-agent TAP usage trace.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-three-agent-ledger-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-31T08:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-three-agent-ledger-1",
      intentId: "intent-three-agent-ledger-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "capture a preview screenshot",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-three-agent-ledger",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Force reviewer -> tool reviewer -> TMA ledger flow.",
  });

  assert.equal(waiting.status, "waiting_human");
  const waitingReport = runtime.createTapThreeAgentUsageReport({
    sessionId: session.sessionId,
    runId: created.run.runId,
  });
  assert.equal(waitingReport.recordCount >= 2, true);
  assert.equal(waitingReport.latestByActor.reviewer?.status, "escalated_to_human");
  assert.equal(waitingReport.latestByActor.tool_reviewer?.status, "waiting_human");
  assert.equal(waitingReport.latestByActor.tma, undefined);

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: runtime.listTaHumanGates()[0]!.gateId,
    action: "approve",
    actorId: "user-three-agent-ledger",
  });

  assert.equal(approved.status, "provisioned");
  const records = runtime.listTapAgentRecords({
    sessionId: session.sessionId,
    runId: created.run.runId,
  });
  assert.equal(records.some((record) => record.actor === "reviewer"), true);
  assert.equal(
    records.some((record) => record.actor === "reviewer" && record.status === "approved"),
    true,
  );
  assert.equal(records.some((record) => record.actor === "tool_reviewer"), true);
  assert.equal(records.some((record) => record.actor === "tma"), true);
  assert.match(
    records.find((record) => record.actor === "tma")?.summary ?? "",
    /Executed plan|bundle/i,
  );

  const report = runtime.createTapThreeAgentUsageReport({
    sessionId: session.sessionId,
    runId: created.run.runId,
  });
  assert.equal(report.latestByActor.reviewer?.status, "approved");
  assert.equal(report.latestByActor.tool_reviewer?.status, "ready_for_handoff");
  assert.equal(report.latestByActor.tma?.status, "ready");
  assert.match(report.summary, /Reviewer is approved/i);
  assert.match(report.summary, /tool reviewer is ready_for_handoff/i);
  assert.match(report.summary, /TMA is ready/i);
});

test("AgentCoreRuntime preserves three-agent usage ledger records across TAP snapshot hydration", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.three-agent-ledger-hydration",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-three-agent-ledger-hydration",
      sessionId: session.sessionId,
      userInput: "Hydrate the three-agent usage ledger.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-three-agent-ledger-hydration-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-31T08:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-three-agent-ledger-hydration-1",
      intentId: "intent-three-agent-ledger-hydration-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "hydrate after reviewer and TMA trace",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-three-agent-ledger-hydration",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Create a resumable three-agent ledger before snapshot.",
  });
  assert.equal(waiting.status, "waiting_human");

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: runtime.listTaHumanGates()[0]!.gateId,
    action: "approve",
    actorId: "user-three-agent-ledger-hydration",
  });
  assert.equal(approved.status, "provisioned");

  const beforeSnapshot = runtime.createTapThreeAgentUsageReport({
    sessionId: session.sessionId,
    runId: created.run.runId,
  });
  const snapshot = runtime.createTapRuntimeSnapshot();
  assert.equal(
    snapshot.agentRecords?.filter((record) =>
      record.sessionId === session.sessionId && record.runId === created.run.runId
    ).length,
    beforeSnapshot.recordCount,
  );

  const recovered = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.three-agent-ledger-hydration",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  recovered.hydrateRecoveredTapRuntimeSnapshot(snapshot);

  const afterSnapshot = recovered.createTapThreeAgentUsageReport({
    sessionId: session.sessionId,
    runId: created.run.runId,
  });
  assert.equal(afterSnapshot.recordCount, beforeSnapshot.recordCount);
  assert.equal(afterSnapshot.latestByActor.reviewer?.status, beforeSnapshot.latestByActor.reviewer?.status);
  assert.equal(afterSnapshot.latestByActor.tool_reviewer?.status, beforeSnapshot.latestByActor.tool_reviewer?.status);
  assert.equal(afterSnapshot.latestByActor.tma?.status, beforeSnapshot.latestByActor.tma?.status);
});

test("AgentCoreRuntime records blocked tool-review lifecycle when target binding is missing", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tool-review-lifecycle-blocked",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });

  const bindingsBefore = runtime.capabilityPool.listBindings();
  const result = await runtime.applyTaCapabilityLifecycle({
    capabilityKey: "mcp.playwright",
    lifecycleAction: "suspend",
    targetPool: "ta-capability-pool",
    bindingId: "binding-missing",
    reason: "Missing bindings should be recorded as blocked lifecycle governance.",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.error?.code, "agent_core_capability_binding_missing");
  assert.equal(runtime.capabilityPool.listBindings().length, bindingsBefore.length);
  const latestLifecycleAction = runtime.toolReviewerRuntime?.listActions().slice(-1)[0];
  assert.equal(latestLifecycleAction?.governanceKind, "lifecycle");
  assert.equal(latestLifecycleAction?.boundaryMode, "governance_only");
  assert.equal(latestLifecycleAction?.output.status, "lifecycle_blocked");
  assert.equal(runtime.listToolReviewerQualityReports()[0]?.verdict, "blocked");
});

test("AgentCoreRuntime auto-continues eligible provisioning after lifecycle application", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.lifecycle-continue-provisioning",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-lifecycle-continue-provisioning",
      sessionId: session.sessionId,
      userInput: "Lifecycle apply should continue staged provisioning when replay is eligible.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-lifecycle-continue-provisioning-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:30:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-lifecycle-continue-provisioning-1",
      intentId: "intent-lifecycle-continue-provisioning-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "auto continue after lifecycle apply",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Stage provisioning, then continue it through lifecycle application.",
  });

  assert.equal(provisioned.status, "provisioned");
  const provisionId = provisioned.provisionRequest?.provisionId;
  assert.ok(provisionId);

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.lifecycle-continue-provisioning",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "computer.use";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "lifecycle-continue-provisioning-ok",
        },
        completedAt: "2026-03-25T21:30:03.000Z",
      };
    },
  }));

  const activation = await runtime.activateTaProvisionAsset(provisionId!);
  assert.equal(activation.status, "activated");
  const bindingId = activation.receipt?.bindingId;
  assert.ok(bindingId);
  const attemptsBeforeLifecycle = runtime.listTaActivationAttempts().length;

  const lifecycleResult = await runtime.applyTaCapabilityLifecycle({
    capabilityKey: "computer.use",
    lifecycleAction: "resume",
    targetPool: "ta-capability-pool",
    bindingId,
    reason: "Lifecycle acceptance should continue the staged replay.",
  });

  assert.equal(lifecycleResult.status, "applied");
  assert.equal(lifecycleResult.continuedProvisioning?.length, 1);
  assert.equal(lifecycleResult.continuedProvisioning?.[0]?.status, "dispatched");
  assert.equal(lifecycleResult.continuedProvisioning?.[0]?.dispatchResult?.grant?.capabilityKey, "computer.use");
  assert.equal(lifecycleResult.continuedProvisioning?.[0]?.activationResult?.status, "activated");
  assert.equal(runtime.listTaActivationAttempts().length, attemptsBeforeLifecycle);
  assert.equal(runtime.listTaResumeEnvelopes().some((entry) => entry.source === "replay"), false);
});

test("AgentCoreRuntime can recover and continue a waiting human gate approval path", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.recover-human-gate",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-recover-human-gate",
      sessionId: session.sessionId,
      userInput: "Recover and continue a human gate.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-recover-human-gate",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Recovered human gate capability.",
  }, {
    id: "adapter.search.ground.recover-human-gate",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "recovered-human-gate-ok",
        },
        completedAt: "2026-03-25T20:10:02.000Z",
      };
    },
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-recover-human-gate-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-recover-human-gate-1",
      intentId: "intent-recover-human-gate-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "recover and continue",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Need recovery to preserve the human gate path.",
  });

  assert.equal(waiting.status, "waiting_human");
  await runtime.writeTapDurableCheckpoint(created.run.runId, "manual");

  const recovered = createAgentCoreRuntime({
    journal: runtime.journal,
    checkpointStore: runtime.checkpointStore,
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-recover-human-gate",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Recovered human gate capability.",
  }, {
    id: "adapter.search.ground.recover-human-gate",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "recovered-human-gate-ok",
        },
        completedAt: "2026-03-25T20:10:03.000Z",
      };
    },
  });
  await recovered.recoverAndHydrateTapRuntime(created.run.runId);

  const gate = recovered.listTaHumanGates()[0];
  assert.ok(gate);

  const approved = await recovered.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-after-recovery",
  });

  assert.equal(approved.status, "dispatched");
  assert.equal(approved.runOutcome?.run.runId, created.run.runId);
  assert.equal(recovered.getTaHumanGate(gate.gateId)?.status, "approved");
});

test("AgentCoreRuntime resolves recovered human-gate decisions idempotently after approval", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.human-gate-idempotent",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-human-gate-idempotent",
      sessionId: session.sessionId,
      userInput: "Recovered approval should stay idempotent.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-human-gate-idempotent",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Search capability for human gate idempotency.",
  }, {
    id: "adapter.search.ground.human-gate-idempotent",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "human-gate-idempotent-ok",
        },
        completedAt: "2026-03-25T21:05:02.000Z",
      };
    },
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-human-gate-idempotent-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:05:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-human-gate-idempotent-1",
      intentId: "intent-human-gate-idempotent-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "idempotent approval",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Approval should not be replayed twice after recovery.",
  });

  assert.equal(waiting.status, "waiting_human");
  const gate = runtime.listTaHumanGates()[0];
  assert.ok(gate);
  await runtime.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-idempotent",
  });
  await runtime.writeTapDurableCheckpoint(created.run.runId, "manual");

  const recovered = createAgentCoreRuntime({
    journal: runtime.journal,
    checkpointStore: runtime.checkpointStore,
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-human-gate-idempotent",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Search capability for human gate idempotency.",
  }, {
    id: "adapter.search.ground.human-gate-idempotent",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "human-gate-idempotent-ok",
        },
        completedAt: "2026-03-25T21:05:03.000Z",
      };
    },
  });
  await recovered.recoverAndHydrateTapRuntime(created.run.runId);

  const eventCountBefore = recovered.listTaHumanGateEvents(gate.gateId).length;
  const second = await recovered.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-idempotent-again",
  });

  assert.equal(second.status, "dispatched");
  assert.equal(recovered.listTaHumanGateEvents(gate.gateId).length, eventCountBefore);
  assert.equal(recovered.getTaResumeEnvelope(`resume:human-gate:${gate.gateId}`), undefined);
});

test("AgentCoreRuntime snapshots completed reviewer durable state after human-gate resolution", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.reviewer-completed-after-gate",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-reviewer-completed-after-gate",
      sessionId: session.sessionId,
      userInput: "Reviewer durable state should finish after gate resolution.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-reviewer-completed",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Search capability for reviewer completion.",
  }, {
    id: "adapter.search.ground.reviewer-completed",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          answer: "reviewer-completed-ok",
        },
        completedAt: "2026-03-25T21:10:02.000Z",
      };
    },
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-reviewer-completed-after-gate-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-reviewer-completed-after-gate-1",
      intentId: "intent-reviewer-completed-after-gate-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "reviewer durable completion",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Force a gate and then complete reviewer durable state.",
  });

  assert.equal(waiting.status, "waiting_human");

  const gate = runtime.listTaHumanGates()[0];
  assert.ok(gate);
  await runtime.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-reviewer-completed",
  });

  assert.equal(runtime.reviewerRuntime?.getDurableState(waiting.accessRequest!.requestId)?.stage, "completed");
});

test("AgentCoreRuntime does not auto-resume a human-gate envelope after hydration", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.human-gate-envelope-boundary",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-human-gate-envelope-boundary",
      sessionId: session.sessionId,
      userInput: "Hydration should not auto-approve a human gate.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-human-gate-envelope-boundary-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:15:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-human-gate-envelope-boundary-1",
      intentId: "intent-human-gate-envelope-boundary-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "do not auto resume",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Hydration must leave the human gate pending.",
  });

  assert.equal(waiting.status, "waiting_human");
  const envelope = runtime.listTaResumeEnvelopes().find((entry) => entry.source === "human_gate");
  assert.ok(envelope);

  const recovered = createAgentCoreRuntime({
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.hydrateRecoveredTapRuntimeSnapshot(runtime.createTapRuntimeSnapshot());

  const resumed = await recovered.resumeTaEnvelope(envelope!.envelopeId);

  assert.equal(resumed.status, "human_gate_pending");
  assert.equal(resumed.dispatchResult, undefined);
  assert.equal(recovered.listTaHumanGates()[0]?.status, "waiting_human");
});

