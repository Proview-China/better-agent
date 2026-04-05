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

test("AgentCoreRuntime can recover and resume a pending replay from a stored TAP envelope", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.resume-replay-envelope",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-resume-replay-envelope",
      sessionId: session.sessionId,
      userInput: "Recover and resume a staged replay envelope.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-resume-replay-envelope-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:20:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-resume-replay-envelope-1",
      intentId: "intent-resume-replay-envelope-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "recover replay envelope",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Need a staged replay before recovery.",
  });

  assert.equal(provisioned.status, "provisioned");

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.resume-envelope",
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
          answer: "resume-envelope-ok",
        },
        completedAt: "2026-03-25T20:20:03.000Z",
      };
    },
  }));
  await runtime.activateTaProvisionAsset(provisioned.provisionRequest!.provisionId);
  await runtime.writeTapDurableCheckpoint(created.run.runId, "manual");

  const replayEnvelope = runtime.listTaResumeEnvelopes().find((envelope) => envelope.source === "replay");
  assert.ok(replayEnvelope);

  const recovered = createAgentCoreRuntime({
    journal: runtime.journal,
    checkpointStore: runtime.checkpointStore,
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.resume-envelope",
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
          answer: "resume-envelope-ok",
        },
        completedAt: "2026-03-25T20:20:04.000Z",
      };
    },
  }));
  await recovered.recoverAndHydrateTapRuntime(created.run.runId);

  assert.equal(recovered.listTaActivationAttempts().length, 1);
  assert.equal(recovered.toolReviewerRuntime?.listActions().some((action) => action.governanceKind === "activation"), true);

  const resumed = await recovered.resumeTaEnvelope(replayEnvelope!.envelopeId);

  assert.equal(resumed.status, "dispatched");
  assert.equal(resumed.dispatchResult?.grant?.capabilityKey, "computer.use");
  assert.equal(recovered.getTaResumeEnvelope(replayEnvelope!.envelopeId), undefined);
});

test("AgentCoreRuntime can continue recovered TAP replay backlog through the runtime driver", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-recovered-tap-runtime",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-recovered-tap-runtime",
      sessionId: session.sessionId,
      userInput: "Continue recovered replay backlog through the runtime driver.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-continue-recovered-tap-runtime-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-30T11:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-continue-recovered-tap-runtime-1",
      intentId: "intent-continue-recovered-tap-runtime-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "recover runtime backlog",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Need a provisioned replay backlog first.",
  });

  assert.equal(provisioned.status, "provisioned");

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.continue-recovered-runtime",
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
          answer: "continue-recovered-runtime-ok",
        },
        completedAt: "2026-03-30T11:00:04.000Z",
      };
    },
  }));
  await runtime.activateTaProvisionAsset(provisioned.provisionRequest!.provisionId);
  await runtime.writeTapDurableCheckpoint(created.run.runId, "manual");

  const recovered = createAgentCoreRuntime({
    journal: runtime.journal,
    checkpointStore: runtime.checkpointStore,
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.continue-recovered-runtime",
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
          answer: "continue-recovered-runtime-ok",
        },
        completedAt: "2026-03-30T11:00:05.000Z",
      };
    },
  }));
  await recovered.recoverAndHydrateTapRuntime(created.run.runId);

  const continued = await recovered.continueRecoveredTapRuntime(created.run.runId);

  assert.equal(continued.provisionResults.length, 1);
  assert.equal(continued.provisionResults[0]?.provisionId, provisioned.provisionRequest!.provisionId);
  assert.equal(continued.provisionResults[0]?.continueResult?.status, "dispatched");
  assert.equal(continued.provisionResults[0]?.continueResult?.dispatchResult?.grant?.capabilityKey, "computer.use");
});

test("AgentCoreRuntime can pick up handoff-ready tool reviewer provision sessions and continue them", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tool-review-runtime-pickup",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-tool-review-runtime-pickup",
      sessionId: session.sessionId,
      userInput: "Pick up a handoff-ready tool reviewer session.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-runtime-pickup-1",
    sourceRequestId: "request-runtime-pickup-1",
    requestedCapabilityKey: "computer.use",
    reason: "Stage a replay that runtime pickup should continue.",
    replayPolicy: "re_review_then_dispatch",
    createdAt: "2026-03-31T12:00:00.000Z",
  }));
  assert.equal(provisionBundle?.status, "ready");

  const replay = createTaPendingReplay({
    replayId: "replay:runtime-pickup-1",
    request: {
      requestId: "request-runtime-pickup-1",
      requestedCapabilityKey: "computer.use",
    },
    provisionBundle: provisionBundle!,
    createdAt: "2026-03-31T12:00:01.000Z",
    metadata: {
      sessionId: session.sessionId,
      runId: created.run.runId,
      mode: "balanced",
      requestedTier: "B2",
      taskContext: {
        source: "runtime-pickup-test",
      },
    },
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [replay],
    activationAttempts: [],
    resumeEnvelopes: [createTaResumeEnvelope({
      envelopeId: "resume:replay:runtime-pickup-1",
      source: "replay",
      requestId: "request-runtime-pickup-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      requestedTier: "B2",
      mode: "balanced",
      reason: "Runtime pickup should continue this replay.",
      intentRequest: {
        requestId: "request-runtime-pickup-1",
        intentId: "intent-runtime-pickup-1",
        capabilityKey: "computer.use",
        input: {
          task: "continue runtime pickup replay",
        },
        priority: "normal",
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: "provision-runtime-pickup-1",
        agentId: "agent-main",
        taskContext: {
          source: "runtime-pickup-test",
        },
      },
    })],
  });

  await runtime.toolReviewerRuntime?.submit({
    sessionId: "tool-review:provision:provision-runtime-pickup-1",
    governanceAction: {
      kind: "replay",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-tool-review-runtime-pickup-1",
        actorId: "tool-reviewer",
        reason: "Replay is ready for runtime pickup.",
        createdAt: "2026-03-31T12:00:02.000Z",
      }),
      capabilityKey: "computer.use",
      replay,
    },
  });

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.runtime-pickup",
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
          answer: "runtime-pickup-ok",
        },
        completedAt: "2026-03-31T12:00:04.000Z",
      };
    },
  }));

  const pickedUp = await runtime.pickupToolReviewerReadyHandoffs();

  assert.equal(pickedUp.length, 1);
  assert.equal(pickedUp[0]?.status, "continued");
  assert.equal(pickedUp[0]?.continueResult?.status, "dispatched");
  assert.equal(pickedUp[0]?.continueResult?.dispatchResult?.grant?.capabilityKey, "computer.use");
  assert.equal(runtime.listTaResumeEnvelopes().some((entry) => entry.source === "replay"), false);
});

test("AgentCoreRuntime replay resume keeps tap governance directive after recovery", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.resume-replay-governance",
      agentClass: "main-agent",
      baselineCapabilities: ["search.ground"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-resume-replay-governance",
      sessionId: session.sessionId,
      userInput: "Recovered replay should keep governance directive.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const replay = createTaPendingReplay({
    replayId: "replay:governance-resume-1",
    request: {
      requestId: "request-governance-resume-1",
      requestedCapabilityKey: "search.ground",
    },
    provisionBundle: createProvisionArtifactBundle({
      bundleId: "bundle-governance-resume-1",
      provisionId: "provision-governance-resume-1",
      status: "ready",
      replayPolicy: "re_review_then_dispatch",
      toolArtifact: {
        artifactId: "artifact-governance-tool",
        kind: "tool",
        ref: "tool.json",
      },
      bindingArtifact: {
        artifactId: "artifact-governance-binding",
        kind: "binding",
        ref: "binding.json",
      },
      verificationArtifact: {
        artifactId: "artifact-governance-verification",
        kind: "verification",
        ref: "verification.json",
      },
      usageArtifact: {
        artifactId: "artifact-governance-usage",
        kind: "usage",
        ref: "usage.md",
      },
    }),
    createdAt: "2026-03-30T10:00:00.000Z",
    metadata: {
      sessionId: session.sessionId,
      runId: created.run.runId,
      mode: "restricted",
      requestedTier: "B1",
    },
  });
  const envelope = createTaResumeEnvelope({
    envelopeId: "resume:replay:governance-resume-1",
    source: "replay",
    requestId: "request-governance-resume-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    capabilityKey: "search.ground",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Resume replay with preserved governance directive.",
    intentRequest: {
      requestId: "request-governance-resume-1",
      intentId: "intent-governance-resume-1",
      capabilityKey: "search.ground",
      input: {
        query: "resume with governance",
      },
      priority: "normal",
    },
    metadata: {
      replayId: replay.replayId,
      agentId: "agent-main",
      tapGovernanceDirective: {
        governanceObjectId: "tap-governance:resume-1",
        effectiveMode: "restricted",
        automationDepth: "prefer_human",
        explanationStyle: "plain_language",
        derivedRiskLevel: "normal",
        matchedToolPolicy: "human_gate",
        matchedToolPolicySelector: "search.ground",
        forceHumanByRisk: false,
      },
    },
  });

  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [replay],
    activationAttempts: [],
    resumeEnvelopes: [envelope],
  });

  const resumed = await runtime.resumeTaEnvelope(envelope.envelopeId);

  assert.equal(resumed.status, "waiting_human");
  assert.equal(resumed.dispatchResult?.reviewDecision?.decision, "escalated_to_human");
  assert.equal(runtime.listTaHumanGates().length, 1);
  assert.equal(runtime.listReviewerDurableStates().at(-1)?.decision, "escalated_to_human");
});

test("AgentCoreRuntime continueRecoveredTapRuntime leaves recovered human gates untouched", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-recovered-human-gate-boundary",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-recovered-human-gate-boundary",
      sessionId: session.sessionId,
      userInput: "Recovered human gate should stay untouched by continue driver.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-continue-recovered-human-gate-boundary-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-30T11:05:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-continue-recovered-human-gate-boundary-1",
      intentId: "intent-continue-recovered-human-gate-boundary-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "keep human gate pending",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Recovered continue driver must ignore human gate backlog.",
  });

  assert.equal(waiting.status, "waiting_human");

  const recovered = createAgentCoreRuntime({
    taProfile: runtime.taControlPlaneGateway?.profile,
  });
  recovered.hydrateRecoveredTapRuntimeSnapshot(runtime.createTapRuntimeSnapshot());

  const continued = await recovered.continueRecoveredTapRuntime(created.run.runId);

  assert.equal(continued.provisionResults.length, 0);
  assert.equal(recovered.listTaHumanGates()[0]?.status, "waiting_human");
});

test("AgentCoreRuntime returns resume_envelope_not_found for unknown envelope ids", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.resume-envelope-missing",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });

  const result = await runtime.resumeTaEnvelope("resume:missing");

  assert.equal(result.status, "resume_envelope_not_found");
  assert.equal(runtime.listTaResumeEnvelopes().length, 0);
});

test("AgentCoreRuntime returns resume_not_supported for malformed replay envelopes", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.resume-envelope-malformed",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });
  const malformed = createTaResumeEnvelope({
    envelopeId: "resume:malformed-replay",
    source: "replay",
    requestId: "request-malformed-replay",
    sessionId: "session-malformed-replay",
    runId: "run-malformed-replay",
    capabilityKey: "computer.use",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Malformed replay envelope for boundary testing.",
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [],
    activationAttempts: [],
    resumeEnvelopes: [malformed],
  });

  const result = await runtime.resumeTaEnvelope(malformed.envelopeId);

  assert.equal(result.status, "resume_not_supported");
  assert.equal(runtime.getTaResumeEnvelope(malformed.envelopeId)?.envelopeId, malformed.envelopeId);
});

test("AgentCoreRuntime returns resume_not_supported for activation envelopes without provisionId", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.activation-envelope-malformed",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });
  const malformed = createTaResumeEnvelope({
    envelopeId: "resume:activation:malformed",
    source: "activation",
    requestId: "request-activation-malformed",
    sessionId: "session-activation-malformed",
    runId: "run-activation-malformed",
    capabilityKey: "computer.use",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Activation envelope should carry a provision id.",
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [],
    activationAttempts: [],
    resumeEnvelopes: [malformed],
  });

  const result = await runtime.resumeTaEnvelope(malformed.envelopeId);

  assert.equal(result.status, "resume_not_supported");
  assert.equal(result.activationResult, undefined);
});

test("AgentCoreRuntime keeps replay envelope pending when activation fails during resume", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.resume-replay-activation-fail",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-resume-replay-activation-fail",
      sessionId: session.sessionId,
      userInput: "Replay resume should stop if activation fails.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-resume-replay-activation-fail-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:30:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-resume-replay-activation-fail-1",
      intentId: "intent-resume-replay-activation-fail-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "do not dispatch after failed activation",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Create a replay envelope that will fail activation.",
  });

  assert.equal(provisioned.status, "provisioned");
  const replayEnvelope = runtime.listTaResumeEnvelopes().find((envelope) => envelope.source === "replay");
  assert.ok(replayEnvelope);

  const result = await runtime.resumeTaEnvelope(replayEnvelope!.envelopeId);

  assert.equal(result.status, "failed");
  assert.equal(result.dispatchResult, undefined);
  assert.equal(runtime.getTaResumeEnvelope(replayEnvelope!.envelopeId)?.envelopeId, replayEnvelope!.envelopeId);
});

test("AgentCoreRuntime keeps manual replay policy at handoff only without auto-opening human gate", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.manual-replay-boundary",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-manual-replay-boundary",
      sessionId: session.sessionId,
      userInput: "Manual replay should stay at handoff only.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-manual-replay-boundary",
    sourceRequestId: "request-manual-replay-boundary",
    requestedCapabilityKey: "computer.use",
    reason: "Manual replay boundary test.",
    replayPolicy: "manual",
    createdAt: "2026-03-25T20:40:00.000Z",
  }));
  assert.equal(provisionBundle?.status, "ready");

  const result = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-manual-replay-boundary-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T20:40:01.000Z",
    priority: "normal",
    request: {
      requestId: "request-manual-replay-boundary-1",
      intentId: "intent-manual-replay-boundary-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "manual replay handoff only",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Ready manual replay asset should only surface handoff state.",
  });

  assert.equal(result.status, "deferred");
  assert.equal(result.replay?.policy, "manual");
  assert.equal(result.humanGate?.source, "replay_policy");
  assert.equal(runtime.listTaHumanGates().length, 0);
});

test("AgentCoreRuntime inventory sees ready provision assets and avoids duplicate provisioning redirects", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.asset-index",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-asset-1",
      sessionId: session.sessionId,
      userInput: "Do not re-provision when a ready asset is already indexed.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisionRequest = createProvisionRequest({
    provisionId: "prebuilt-provision-1",
    sourceRequestId: "request-prebuilt-1",
    requestedCapabilityKey: "computer.use",
    reason: "Seed ready asset before review.",
    createdAt: "2026-03-19T05:00:00.000Z",
  });
  await runtime.provisionerRuntime?.submit(provisionRequest);

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-asset-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T05:00:10.000Z",
    priority: "normal",
    request: {
      requestId: "request-ta-asset-1",
      intentId: "intent-ta-asset-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "capture screenshot",
      },
      priority: "normal",
    },
  };

  const result = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Ready asset should defer activation handoff, not re-provision.",
  });

  assert.equal(result.status, "deferred");
  assert.equal(result.reviewDecision?.decision, "deferred");
  assert.equal(
    result.reviewDecision?.deferredReason,
    "Provision asset is ready for review/activation; replay stays pending in this wave.",
  );
  assert.equal(result.provisionRequest, undefined);
  assert.equal(result.provisionBundle, undefined);
});

