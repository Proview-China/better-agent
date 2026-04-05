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

test("AgentCoreRuntime pickupToolReviewerReadyHandoffs can target one provision session without draining another ready handoff", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.pickup-tool-reviewer-targeted",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-pickup-tool-reviewer-targeted",
      sessionId: session.sessionId,
      userInput: "Pick up only one ready tool reviewer provision session.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.pickup-targeted",
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
          answer: "pickup-targeted-ok",
        },
        completedAt: "2026-03-31T14:00:03.000Z",
      };
    },
  }));

  const provisionIds = [
    "provision-pickup-target-1",
    "provision-pickup-target-2",
  ] as const;

  for (const provisionId of provisionIds) {
    const bundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
      provisionId,
      sourceRequestId: `request-${provisionId}`,
      requestedCapabilityKey: "computer.use",
      reason: `Need staged replay for ${provisionId}.`,
      replayPolicy: "re_review_then_dispatch",
      createdAt: "2026-03-31T14:00:00.000Z",
    }));
    assert.equal(bundle?.status, "ready");

    const replay = createTaPendingReplay({
      replayId: `replay:${provisionId}`,
      request: {
        requestId: `request-${provisionId}`,
        requestedCapabilityKey: "computer.use",
      },
      provisionBundle: bundle!,
      createdAt: "2026-03-31T14:00:01.000Z",
      metadata: {
        sessionId: session.sessionId,
        runId: created.run.runId,
        mode: "balanced",
        requestedTier: "B2",
      },
    });
    const snapshot = runtime.createTapRuntimeSnapshot();
    runtime.hydrateRecoveredTapRuntimeSnapshot({
      ...snapshot,
      pendingReplays: [...snapshot.pendingReplays, replay],
      resumeEnvelopes: [
        ...snapshot.resumeEnvelopes,
        createTaResumeEnvelope({
          envelopeId: `resume:replay:${replay.replayId}`,
          source: "replay",
          requestId: `request-${provisionId}`,
          sessionId: session.sessionId,
          runId: created.run.runId,
          capabilityKey: "computer.use",
          requestedTier: "B2",
          mode: "balanced",
          reason: `Resume ${provisionId}.`,
          intentRequest: {
            requestId: `request-${provisionId}`,
            intentId: `intent-${provisionId}`,
            capabilityKey: "computer.use",
            input: {
              task: `resume ${provisionId}`,
            },
            priority: "normal",
          },
          metadata: {
            replayId: replay.replayId,
            provisionId,
            agentId: "agent-main",
          },
        }),
      ],
    });
    await runtime.toolReviewerRuntime?.submit({
      sessionId: `tool-review:provision:${provisionId}`,
      governanceAction: {
        kind: "delivery",
        trace: createToolReviewGovernanceTrace({
          actionId: `action-delivery-${provisionId}`,
          actorId: "tool-reviewer",
          reason: `Ready bundle is waiting for runtime pickup for ${provisionId}.`,
          createdAt: "2026-03-31T14:00:02.000Z",
          request: {
            requestId: `request-${provisionId}`,
            sessionId: session.sessionId,
            runId: created.run.runId,
            requestedCapabilityKey: "computer.use",
            requestedTier: "B2",
            mode: "permissive",
            canonicalMode: "permissive",
          },
        }),
        provisionId,
        capabilityKey: "computer.use",
        receipt: runtime.provisionerRuntime?.getBundleHistory(provisionId).at(-1)?.metadata?.tmaDeliveryReceipt as never,
      },
    });
  }

  const picked = await runtime.pickupToolReviewerReadyHandoffs({
    sessionId: "tool-review:provision:provision-pickup-target-1",
  });

  assert.equal(picked.length, 1);
  assert.equal(picked[0]?.status, "continued");
  assert.equal(picked[0]?.provisionId, "provision-pickup-target-1");
  assert.equal(picked[0]?.continueResult?.status, "dispatched");
  assert.equal(runtime.getTaReplayResumeEnvelope("replay:provision-pickup-target-1"), undefined);
  assert.ok(runtime.getTaReplayResumeEnvelope("replay:provision-pickup-target-2"));
});

test("AgentCoreRuntime continueTaProvisioning can continue auto-after-verify replay once activation is ready", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-provisioning-auto-after-verify",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-provisioning-auto-after-verify",
      sessionId: session.sessionId,
      userInput: "Continue auto-after-verify replay from runtime continue driver.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-auto-after-verify-continue",
    sourceRequestId: "request-auto-after-verify-continue-1",
    requestedCapabilityKey: "computer.use",
    reason: "Auto-after-verify replay should keep a resumable runtime path.",
    replayPolicy: "auto_after_verify",
    createdAt: "2026-03-25T21:30:00.000Z",
  }));
  assert.equal(provisionBundle?.status, "ready");

  const replay = createTaPendingReplay({
    replayId: "replay:auto-after-verify-continue",
    request: {
      requestId: "request-auto-after-verify-continue-1",
      requestedCapabilityKey: "computer.use",
    },
    provisionBundle: provisionBundle!,
    createdAt: "2026-03-25T21:30:02.000Z",
    metadata: {
      sessionId: session.sessionId,
      runId: created.run.runId,
      mode: "balanced",
      requestedTier: "B2",
      taskContext: {
        source: "runtime-test",
      },
    },
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [replay],
    activationAttempts: [],
    resumeEnvelopes: [createTaResumeEnvelope({
      envelopeId: "resume:replay:replay:auto-after-verify-continue",
      source: "replay",
      requestId: "request-auto-after-verify-continue-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      requestedTier: "B2",
      mode: "balanced",
      reason: "Resume auto-after-verify replay from continue driver.",
      intentRequest: {
        requestId: "request-auto-after-verify-continue-1",
        intentId: "intent-auto-after-verify-continue-1",
        capabilityKey: "computer.use",
        input: {
          task: "continue auto-after-verify replay",
        },
        priority: "normal",
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: "provision-auto-after-verify-continue",
        agentId: "agent-main",
        taskContext: {
          source: "runtime-test",
        },
      },
    })],
  });
  assert.equal(runtime.getTaReplayResumeEnvelope(replay.replayId)?.envelopeId, "resume:replay:replay:auto-after-verify-continue");

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.continue-auto-after-verify",
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
          answer: "continue-auto-after-verify-ok",
        },
        completedAt: "2026-03-25T21:30:04.000Z",
      };
    },
  }));

  const continued = await runtime.continueTaProvisioning("provision-auto-after-verify-continue");

  assert.equal(continued.status, "dispatched");
  assert.equal(continued.activationResult?.status, "activated");
  assert.equal(continued.dispatchResult?.grant?.capabilityKey, "computer.use");
  assert.equal(runtime.listTaResumeEnvelopes().some((entry) => entry.source === "replay"), false);
});

test("AgentCoreRuntime continueTaProvisioning stops when tool reviewer still marks the provision lane blocked", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-provisioning-blocked-by-tool-review",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-blocked-by-tool-review",
    sourceRequestId: "request-blocked-by-tool-review-1",
    requestedCapabilityKey: "computer.use",
    reason: "Tool reviewer should be able to keep the provision lane blocked.",
    replayPolicy: "re_review_then_dispatch",
    createdAt: "2026-03-25T21:40:00.000Z",
  }));
  assert.equal(provisionBundle?.status, "ready");

  const replay = createTaPendingReplay({
    replayId: "replay:blocked-by-tool-review",
    request: {
      requestId: "request-blocked-by-tool-review-1",
      requestedCapabilityKey: "computer.use",
    },
    provisionBundle: provisionBundle!,
    createdAt: "2026-03-25T21:40:01.000Z",
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [replay],
    activationAttempts: [],
    resumeEnvelopes: [createTaResumeEnvelope({
      envelopeId: "resume:replay:blocked-by-tool-review",
      source: "replay",
      requestId: "request-blocked-by-tool-review-1",
      sessionId: "session-blocked-by-tool-review",
      runId: "run-blocked-by-tool-review",
      capabilityKey: "computer.use",
      requestedTier: "B2",
      mode: "balanced",
      reason: "Blocked governance should stop continueTaProvisioning before replay resumes.",
      intentRequest: {
        requestId: "request-blocked-by-tool-review-1",
        intentId: "intent-blocked-by-tool-review-1",
        capabilityKey: "computer.use",
        input: {
          task: "do not continue while tool reviewer is blocked",
        },
        priority: "normal",
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: "provision-blocked-by-tool-review",
        agentId: "agent-main",
      },
    })],
  });
  await runtime.toolReviewerRuntime?.submit({
    sessionId: "tool-review:provision:provision-blocked-by-tool-review",
    governanceAction: {
      kind: "lifecycle",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-tool-review-blocked-provision",
        actorId: "tool-reviewer",
        reason: "Keep the provision lane blocked until lifecycle issues are fixed.",
        createdAt: "2026-03-25T21:40:02.000Z",
      }),
      capabilityKey: "computer.use",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
      failure: {
        code: "binding_missing",
        message: "Binding is not ready yet.",
      },
    },
  });

  const continued = await runtime.continueTaProvisioning("provision-blocked-by-tool-review");

  assert.equal(continued.status, "blocked");
  assert.equal(runtime.getTaPendingReplay(replay.replayId)?.replayId, replay.replayId);
  assert.equal(runtime.getTaReplayResumeEnvelope(replay.replayId)?.envelopeId, "resume:replay:blocked-by-tool-review");
});

test("AgentCoreRuntime continueTaProvisioning keeps replay backlog when resumed replay opens a fresh human gate", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-provisioning-waiting-human",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-provisioning-waiting-human",
      sessionId: session.sessionId,
      userInput: "Continue provisioning should preserve replay backlog when a new gate opens.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-waiting-human-on-continue",
    sourceRequestId: "request-waiting-human-on-continue-1",
    requestedCapabilityKey: "computer.use",
    reason: "Replay resume should reopen a human gate in restricted mode.",
    replayPolicy: "re_review_then_dispatch",
    createdAt: "2026-03-25T21:50:00.000Z",
  }));
  assert.equal(provisionBundle?.status, "ready");
  const replay = createTaPendingReplay({
    replayId: "replay:waiting-human-on-continue",
    request: {
      requestId: "request-waiting-human-on-continue-1",
      requestedCapabilityKey: "computer.use",
    },
    provisionBundle: provisionBundle!,
    createdAt: "2026-03-25T21:50:01.000Z",
    metadata: {
      sessionId: session.sessionId,
      runId: created.run.runId,
      mode: "restricted",
      requestedTier: "B3",
    },
  });
  runtime.hydrateRecoveredTapRuntimeSnapshot({
    humanGates: [],
    humanGateEvents: [],
    pendingReplays: [replay],
    activationAttempts: [],
    resumeEnvelopes: [createTaResumeEnvelope({
      envelopeId: "resume:replay:waiting-human-on-continue",
      source: "replay",
      requestId: "request-waiting-human-on-continue-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      requestedTier: "B3",
      mode: "restricted",
      reason: "Restricted replay should reopen a human gate instead of dropping backlog.",
      intentRequest: {
        requestId: "request-waiting-human-on-continue-1",
        intentId: "intent-waiting-human-on-continue-1",
        capabilityKey: "computer.use",
        input: {
          task: "reopen restricted gate",
        },
        priority: "normal",
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: "provision-waiting-human-on-continue",
        agentId: "agent-main",
      },
    })],
  });
  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.waiting-human-on-continue",
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
          answer: "should-not-run-before-human-gate",
        },
        completedAt: "2026-03-25T21:50:04.000Z",
      };
    },
  }));

  const continued = await runtime.continueTaProvisioning("provision-waiting-human-on-continue");

  assert.equal(continued.status, "waiting_human");
  assert.equal(runtime.getTaPendingReplay(replay.replayId)?.replayId, replay.replayId);
  assert.equal(runtime.getTaReplayResumeEnvelope(replay.replayId)?.envelopeId, "resume:replay:waiting-human-on-continue");
  assert.equal(runtime.listTaHumanGates().length, 1);
});

