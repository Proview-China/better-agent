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

test("AgentCoreRuntime auto-picks a wired existing provision asset on the reviewer mainline", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.review-existing-asset-auto-pickup",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-review-existing-asset-auto-pickup",
      sessionId: session.sessionId,
      userInput: "Auto-pick an existing provision asset on the reviewer mainline.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-review-existing-asset-auto-pickup-1",
    sourceRequestId: "request-review-existing-asset-auto-pickup-1",
    requestedCapabilityKey: "computer.use",
    reason: "Seed ready asset before reviewer auto pickup.",
    createdAt: "2026-03-31T18:10:00.000Z",
  }));
  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.review-existing-asset-auto-pickup",
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
          answer: "review-existing-asset-auto-pickup-ok",
        },
        completedAt: "2026-03-31T18:10:03.000Z",
      };
    },
  }));

  const result = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-review-existing-asset-auto-pickup-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-31T18:10:01.000Z",
    priority: "normal",
    request: {
      requestId: "request-review-existing-asset-auto-pickup-1",
      intentId: "intent-review-existing-asset-auto-pickup-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "auto-pick existing asset from reviewer mainline",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Existing wired asset should auto-pick after reviewer handoff.",
  });

  assert.equal(result.status, "dispatched");
  assert.equal(result.dispatch?.prepared.capabilityKey, "computer.use");
  assert.equal(result.continueResult?.status, "dispatched");
  assert.equal(runtime.listTaPendingReplays().length, 0);
});

test("AgentCoreRuntime can replay provisioned capabilities after activation handoff and re-review", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.activation-replay",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-activation-replay",
      sessionId: session.sessionId,
      userInput: "Provision first, then replay after activation handoff.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.computer.use.activation-replay",
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
          answer: "computer-use-activation-replay-ok",
        },
        completedAt: new Date("2026-03-19T09:30:03.000Z").toISOString(),
      };
    },
  };

  const firstIntent: CapabilityCallIntent = {
    intentId: "intent-ta-activation-replay-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T09:30:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-ta-activation-replay-1",
      intentId: "intent-ta-activation-replay-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "capture screenshot",
      },
      priority: "normal",
    },
  };

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool(firstIntent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Capability should be provisioned before replay.",
  });

  assert.equal(provisioned.status, "provisioned");
  assert.equal(provisioned.provisionBundle?.replayPolicy, "re_review_then_dispatch");

  const provisionId = provisioned.provisionRequest?.provisionId;
  assert.ok(provisionId);

  runtime.registerTaActivationFactory("factory:computer.use", () => adapter);
  const activation = await runtime.activateTaProvisionAsset(provisionId);
  assert.equal(activation.status, "activated");
  assert.equal(runtime.listTaActivationAttempts().length, 1);
  assert.equal(activation.activation?.status, "active");
  const activationCheckpoint = await runtime.checkpointStore.loadLatestCheckpoint(created.run.runId);
  assert.equal(activationCheckpoint?.snapshot?.poolRuntimeSnapshots?.tap?.activationAttempts.length, 1);

  const replayIntent: CapabilityCallIntent = {
    ...firstIntent,
    intentId: "intent-ta-activation-replay-2",
    createdAt: "2026-03-19T09:30:02.500Z",
    request: {
      ...firstIntent.request,
      requestId: "request-ta-activation-replay-2",
      intentId: "intent-ta-activation-replay-2",
    },
  };

  const replayed = await runtime.dispatchCapabilityIntentViaTaPool(replayIntent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Mounted capability should re-enter review and dispatch after activation.",
  });

  assert.equal(replayed.status, "dispatched");
  assert.equal(replayed.reviewDecision?.decision, "approved");
  assert.equal(replayed.grant?.capabilityKey, "computer.use");
  assert.equal(replayed.dispatch?.prepared.capabilityKey, "computer.use");
});

test("AgentCoreRuntime can continue a provisioned capability through activation and replay in one call", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-provisioning",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-provisioning",
      sessionId: session.sessionId,
      userInput: "Continue provisioning through activation and replay.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-continue-provisioning-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-continue-provisioning-1",
      intentId: "intent-continue-provisioning-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "continue provisioning mainline",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Provision first and then continue automatically.",
  });

  assert.equal(provisioned.status, "provisioned");
  const provisionId = provisioned.provisionRequest?.provisionId;
  assert.ok(provisionId);

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.continue-provisioning",
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
          answer: "continue-provisioning-ok",
        },
        completedAt: "2026-03-25T21:10:03.000Z",
      };
    },
  }));

  const continued = await runtime.continueTaProvisioning(provisionId!);

  assert.equal(continued.status, "dispatched");
  assert.equal(continued.dispatchResult?.grant?.capabilityKey, "computer.use");
  assert.equal(continued.activationResult?.status, "activated");
  assert.equal(runtime.getTaActivationAttempt(continued.activationResult?.attempt?.attemptId ?? "")?.status, "succeeded");
  assert.equal(runtime.listTaResumeEnvelopes().some((entry) => entry.source === "replay"), false);
});

test("AgentCoreRuntime continueTaProvisioning reuses an already active asset without creating a second activation attempt", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.continue-provisioning-active-asset",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-continue-provisioning-active-asset",
      sessionId: session.sessionId,
      userInput: "Reuse active asset when continuing provisioning.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const provisioned = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-continue-provisioning-active-asset-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:20:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-continue-provisioning-active-asset-1",
      intentId: "intent-continue-provisioning-active-asset-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "reuse active asset",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "balanced",
    reason: "Create replay envelope, then activate before continue call.",
  });

  assert.equal(provisioned.status, "provisioned");
  const provisionId = provisioned.provisionRequest?.provisionId;
  assert.ok(provisionId);

  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.continue-active-asset",
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
          answer: "continue-active-asset-ok",
        },
        completedAt: "2026-03-25T21:20:03.000Z",
      };
    },
  }));

  const activation = await runtime.activateTaProvisionAsset(provisionId!);
  assert.equal(activation.status, "activated");
  const attemptsBeforeContinue = runtime.listTaActivationAttempts().length;

  const continued = await runtime.continueTaProvisioning(provisionId!);

  assert.equal(continued.status, "dispatched");
  assert.equal(continued.activationResult?.status, "activated");
  assert.equal(runtime.listTaActivationAttempts().length, attemptsBeforeContinue);
  assert.equal(continued.dispatchResult?.grant?.capabilityKey, "computer.use");
});

