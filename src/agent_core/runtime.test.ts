import assert from "node:assert/strict";
import test from "node:test";

import { createGoalSource } from "./goal/goal-source.js";
import type { ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { createRaxSearchGroundCapabilityDefinition } from "./integrations/rax-port.js";
import { createRaxMcpCapabilityAdapter } from "./integrations/rax-mcp-adapter.js";
import { createAgentCoreRuntime } from "./runtime.js";
import { createMcpReadCapabilityPackage } from "./capability-package/index.js";
import type { CapabilityAdapter, CapabilityCallIntent, CapabilityPackage } from "./index.js";
import { createAgentCapabilityProfile, createProvisionRequest } from "./ta-pool-types/index.js";
import { createReviewerRuntime } from "./ta-pool-review/index.js";
import { TA_ENFORCEMENT_METADATA_KEY } from "./ta-pool-runtime/enforcement-guard.js";
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

test("AgentCoreRuntime wires session, run, and internal journal flow together", async () => {
  const runtime = createAgentCoreRuntime();
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-1",
      sessionId: session.sessionId,
      userInput: "Inspect the current state and continue.",
    }),
  );

  const outcome = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const header = runtime.sessionManager.loadSessionHeader(session.sessionId);

  assert.equal(header?.activeRunId, outcome.run.runId);
  assert.equal(outcome.run.sessionId, session.sessionId);
  assert.deepEqual(
    runtime.readRunEvents(outcome.run.runId).map((entry) => entry.event.type),
    ["run.created", "state.delta_applied", "intent.queued"],
  );
});

test("AgentCoreRuntime can dispatch a capability intent through the new gateway and pool path", async () => {
  const runtime = createAgentCoreRuntime();
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-4",
      sessionId: session.sessionId,
      userInput: "Use a pooled capability when needed.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.pool",
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
          answer: "gateway-path-ok",
        },
        completedAt: new Date("2026-03-18T00:00:03.000Z").toISOString(),
        metadata: {
          resultSource: "capability",
        },
      };
    },
  };

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-pool",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Pooled grounded search capability.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-search-gateway-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:03.000Z").toISOString(),
    priority: "high",
    request: {
      requestId: "request-search-gateway-1",
      intentId: "intent-search-gateway-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "Praxis capability pool",
      },
      priority: "high",
    },
  };

  const dispatched = await runtime.dispatchCapabilityIntentViaGateway(intent);
  assert.equal(dispatched.prepared.capabilityKey, "search.ground");
  assert.equal(dispatched.handle.state, "running");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(
    runtime.readRunEvents(created.run.runId).some((entry) => {
      return entry.event.type === "capability.result_received";
    }),
  );
});

test("AgentCoreRuntime can resolve a baseline T/A grant and dispatch it through the pooled path", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime",
      agentClass: "main-agent",
      baselineCapabilities: ["search.ground"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-1",
      sessionId: session.sessionId,
      userInput: "Use baseline capabilities when available.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.ta-baseline",
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
          answer: "ta-baseline-ok",
        },
        completedAt: new Date("2026-03-18T00:00:04.000Z").toISOString(),
        metadata: {
          resultSource: "capability",
        },
      };
    },
  };

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-ta-baseline",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Baseline grounded search capability via ta control-plane.",
  }, adapter);

  const resolved = runtime.resolveTaCapabilityAccess({
    sessionId: session.sessionId,
    runId: created.run.runId,
    agentId: "agent-main",
    capabilityKey: "search.ground",
    reason: "Baseline search should not need review.",
    requestedTier: "B0",
  });

  assert.equal(resolved.status, "baseline_granted");

  const dispatched = await runtime.dispatchTaCapabilityGrant({
    grant: resolved.grant,
    sessionId: session.sessionId,
    runId: created.run.runId,
    intentId: "intent-ta-baseline-1",
    input: {
      query: "Praxis ta pool",
    },
    priority: "high",
  });

  assert.equal(dispatched.prepared.capabilityKey, "search.ground");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(
    runtime.readRunEvents(created.run.runId).some((entry) => entry.event.type === "capability.result_received"),
  );
});

test("AgentCoreRuntime routes capability_call through TAP by default in dispatchIntent", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap-default",
      agentClass: "main-agent",
      baselineCapabilities: ["search.ground"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-default-route",
      sessionId: session.sessionId,
      userInput: "Default capability routing should go through TAP.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.tap-default-route",
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
          answer: "tap-default-route-ok",
        },
        completedAt: new Date("2026-03-18T00:00:04.500Z").toISOString(),
      };
    },
  };

  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-tap-default-route",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Default TAP-routed grounded search capability.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-tap-default-route-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:04.500Z").toISOString(),
    priority: "high",
    request: {
      requestId: "request-tap-default-route-1",
      intentId: "intent-tap-default-route-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "Praxis TAP default route",
      },
      priority: "high",
    },
  };

  const dispatched = await runtime.dispatchIntent(intent);

  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.grant?.capabilityKey, "search.ground");
  assert.equal(dispatched.dispatch?.prepared.capabilityKey, "search.ground");
  assert.equal(dispatched.runOutcome?.run.runId, created.run.runId);
  assert.deepEqual(
    runtime.readRunEvents(created.run.runId).map((entry) => entry.event.type).slice(-3),
    ["capability.result_received", "state.delta_applied", "intent.queued"],
  );
});

test("AgentCoreRuntime dispatches MCP read family capability packages through the default TAP path", async () => {
  const listToolsPackage = createMcpReadCapabilityPackage({
    capabilityKey: "mcp.listTools",
  });
  const readResourcePackage = createMcpReadCapabilityPackage({
    capabilityKey: "mcp.readResource",
  });
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.mcp-read-default-route",
      agentClass: "main-agent",
      baselineCapabilities: [
        listToolsPackage.manifest.capabilityKey,
        readResourcePackage.manifest.capabilityKey,
      ],
    }),
  });
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFakeMcpFacade(),
  });

  runtime.registerCapabilityAdapter(
    toRuntimeCapabilityManifest(listToolsPackage, "cap-mcp-list-tools"),
    adapter,
  );
  runtime.registerCapabilityAdapter(
    toRuntimeCapabilityManifest(readResourcePackage, "cap-mcp-read-resource"),
    adapter,
  );

  const scenarios = [
    {
      package: listToolsPackage,
      goalId: "goal-runtime-mcp-list-tools-default-route",
      runIdSuffix: "list-tools",
      requestInput: {
        route: { provider: "openai", model: "gpt-5.4" },
        input: { connectionId: "conn-read-1" },
      },
    },
    {
      package: readResourcePackage,
      goalId: "goal-runtime-mcp-read-resource-default-route",
      runIdSuffix: "read-resource",
      requestInput: {
        route: { provider: "openai", model: "gpt-5.4" },
        input: { connectionId: "conn-read-1", uri: "memory://resource" },
      },
    },
  ] as const;

  for (const scenario of scenarios) {
    const session = runtime.createSession();
    const goal = runtime.createCompiledGoal(
      createGoalSource({
        goalId: scenario.goalId,
        sessionId: session.sessionId,
        userInput: `Dispatch ${scenario.package.manifest.capabilityKey} through TAP.`,
      }),
    );
    const created = await runtime.createRun({
      sessionId: session.sessionId,
      goal,
    });

    const result = await runtime.dispatchIntent({
      intentId: `intent-${scenario.runIdSuffix}`,
      sessionId: session.sessionId,
      runId: created.run.runId,
      kind: "capability_call",
      createdAt: "2026-03-25T09:00:00.000Z",
      priority: "high",
      request: {
        requestId: `request-${scenario.runIdSuffix}`,
        intentId: `intent-${scenario.runIdSuffix}`,
        sessionId: session.sessionId,
        runId: created.run.runId,
        capabilityKey: scenario.package.manifest.capabilityKey,
        input: scenario.requestInput,
        priority: "high",
      },
    });

    assert.equal(result.status, "dispatched");
    assert.equal(result.grant?.capabilityKey, scenario.package.manifest.capabilityKey);
    assert.equal(result.dispatch?.prepared.capabilityKey, scenario.package.manifest.capabilityKey);
    assert.equal(result.runOutcome?.run.runId, created.run.runId);
    assert.deepEqual(
      runtime.readRunEvents(created.run.runId).map((entry) => entry.event.type).slice(-3),
      ["capability.result_received", "state.delta_applied", "intent.queued"],
    );
  }
});

test("AgentCoreRuntime surfaces review-required T/A access when capability is not baseline", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-2",
      sessionId: session.sessionId,
      userInput: "Request richer capabilities when needed.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const resolved = runtime.resolveTaCapabilityAccess({
    sessionId: session.sessionId,
    runId: created.run.runId,
    agentId: "agent-main",
    capabilityKey: "mcp.playwright",
    reason: "User explicitly asked for playwright screenshots.",
    requestedTier: "B1",
    mode: "balanced",
  });

  assert.equal(resolved.status, "review_required");
  assert.equal(resolved.request.requestedCapabilityKey, "mcp.playwright");
});

test("AgentCoreRuntime can assemble review -> dispatch through T/A pool for available capabilities", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.review",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-3",
      sessionId: session.sessionId,
      userInput: "Review and then dispatch an available capability.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.ta-review",
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
          answer: "ta-review-ok",
        },
        completedAt: new Date("2026-03-18T00:00:05.000Z").toISOString(),
      };
    },
  };
  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-ta-review",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Review-driven grounded search capability.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-review-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:05.000Z").toISOString(),
    priority: "high",
    request: {
      requestId: "request-ta-review-1",
      intentId: "intent-ta-review-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "Praxis runtime assembly",
      },
      priority: "high",
    },
  };

  const result = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "balanced",
    reason: "Capability is available but should still go through review path.",
  });

  assert.equal(result.status, "dispatched");
  assert.equal(result.reviewDecision?.decision, "approved");
  assert.equal(result.reviewDecision?.grant, undefined);
  assert.equal(result.reviewDecision?.grantCompilerDirective?.grantedTier, "B1");
  assert.equal(result.grant?.capabilityKey, "search.ground");
  assert.equal(result.decisionToken?.decisionId, result.reviewDecision?.decisionId);
  assert.equal(result.dispatch?.prepared.capabilityKey, "search.ground");
  assert.equal(
    (result.dispatch?.prepared.metadata?.[TA_ENFORCEMENT_METADATA_KEY] as { decisionToken?: { decisionId?: string } })
      ?.decisionToken?.decisionId,
    result.decisionToken?.decisionId,
  );
});

test("AgentCoreRuntime dispatchIntent uses TAP reviewer worker bridge by default for non-baseline capabilities", async () => {
  let reviewerHookCalled = false;
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap-reviewer-default",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
    reviewerRuntime: createReviewerRuntime({
      llmReviewerHook: async ({ request, workerEnvelope }) => {
        reviewerHookCalled = true;
        assert.equal(workerEnvelope.runtimeContract.canExecute, false);
        assert.equal(workerEnvelope.runtimeContract.canDispatchGrant, false);
        assert.equal(workerEnvelope.routed.outcome, "review_required");

        return {
          schemaVersion: "tap-reviewer-worker-output/v1",
          workerKind: "reviewer",
          lane: "bootstrap-reviewer",
          decisionId: "decision-runtime-default-reviewer-1",
          vote: "allow_with_constraints",
          reviewerId: "bootstrap-reviewer-runtime",
          reason: "Approve grounded search after reviewer worker inspection.",
          recommendedTier: request.requestedTier,
          createdAt: "2026-03-19T09:00:01.000Z",
        };
      },
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-default-reviewer-route",
      sessionId: session.sessionId,
      userInput: "Default dispatchIntent should enter the reviewer worker bridge.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.tap-reviewer-default-route",
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
          answer: "tap-reviewer-default-route-ok",
        },
        completedAt: new Date("2026-03-19T09:00:02.000Z").toISOString(),
      };
    },
  };
  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-tap-reviewer-default-route",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Default TAP route through reviewer worker bridge.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-tap-reviewer-default-route-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T09:00:00.000Z",
    priority: "high",
    request: {
      requestId: "request-tap-reviewer-default-route-1",
      intentId: "intent-tap-reviewer-default-route-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "Praxis TAP default reviewer route",
      },
      priority: "high",
    },
  };

  const result = await runtime.dispatchIntent(intent);

  assert.equal(reviewerHookCalled, true);
  assert.equal(result.status, "dispatched");
  assert.equal(result.reviewDecision?.vote, "allow_with_constraints");
  assert.equal(result.grant?.capabilityKey, "search.ground");
  assert.equal(result.dispatch?.prepared.capabilityKey, "search.ground");
  assert.equal(result.runOutcome?.run.runId, created.run.runId);
});

test("AgentCoreRuntime can assemble review -> provisioning through T/A pool for missing capabilities", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.provision",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-4",
      sessionId: session.sessionId,
      userInput: "Provision a missing capability.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-provision-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:06.000Z").toISOString(),
    priority: "normal",
    request: {
      requestId: "request-ta-provision-1",
      intentId: "intent-ta-provision-1",
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
    reason: "Capability is currently missing and should trigger provisioning.",
  });

  assert.equal(result.status, "provisioned");
  assert.equal(result.reviewDecision?.decision, "redirected_to_provisioning");
  assert.equal(result.provisionRequest?.requestedCapabilityKey, "computer.use");
  assert.equal(result.provisionBundle?.status, "ready");
  assert.equal(result.replay?.policy, "re_review_then_dispatch");
  assert.equal(result.replay?.state, "pending_re_review");
  assert.equal(runtime.listTaPendingReplays().length, 1);
});

test("AgentCoreRuntime keeps restricted requests inside TAP until human approval arrives", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.restricted-human-gate",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-restricted-human-gate",
      sessionId: session.sessionId,
      userInput: "Wait for a human decision before dispatching restricted capabilities.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.search.ground.restricted-human-gate",
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
          answer: "restricted-human-gate-ok",
        },
        completedAt: "2026-03-19T10:10:02.000Z",
      };
    },
  };
  runtime.registerCapabilityAdapter({
    capabilityId: "cap-search-ground-restricted-human-gate",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Restricted path waits for human approval before dispatch.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-restricted-human-gate-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T10:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-restricted-human-gate-1",
      intentId: "intent-restricted-human-gate-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "restricted human gate",
      },
      priority: "normal",
    },
  };

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Restricted mode should wait for human approval.",
  });

  assert.equal(waiting.status, "waiting_human");
  assert.equal(waiting.reviewDecision?.decision, "escalated_to_human");
  assert.equal(waiting.humanGate?.status, "waiting_human_approval");
  assert.equal(runtime.listTaHumanGates().length, 1);
  const waitingCheckpoint = await runtime.checkpointStore.loadLatestCheckpoint(created.run.runId);
  assert.equal(waitingCheckpoint?.snapshot?.poolRuntimeSnapshots?.tap?.humanGates.length, 1);
  assert.equal(waitingCheckpoint?.snapshot?.poolRuntimeSnapshots?.tap?.humanGateEvents.length, 1);

  const gate = runtime.listTaHumanGates()[0];
  assert.ok(gate);
  assert.equal(runtime.listTaHumanGateEvents(gate.gateId).length, 1);

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-1",
    note: "Approved for this one restricted search request.",
  });

  assert.equal(approved.status, "dispatched");
  assert.equal(approved.grant?.capabilityKey, "search.ground");
  assert.equal(approved.runOutcome?.run.runId, created.run.runId);
  assert.equal(runtime.getTaHumanGate(gate.gateId)?.status, "approved");
  assert.equal(runtime.listTaHumanGateEvents(gate.gateId).length, 2);
});

test("AgentCoreRuntime can reject a waiting restricted human gate without throwing", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.restricted-human-gate-reject",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-restricted-human-gate-reject",
      sessionId: session.sessionId,
      userInput: "Reject a restricted capability request.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-restricted-human-gate-reject-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T10:15:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-restricted-human-gate-reject-1",
      intentId: "intent-restricted-human-gate-reject-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "reject restricted request",
      },
      priority: "normal",
    },
  };

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "restricted",
    reason: "Restricted mode should wait for human rejection too.",
  });

  assert.equal(waiting.status, "waiting_human");

  const gate = runtime.listTaHumanGates()[0];
  assert.ok(gate);

  const rejected = await runtime.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "reject",
    actorId: "user-2",
    note: "Do not continue this restricted request.",
  });

  assert.equal(rejected.status, "denied");
  assert.equal(rejected.reviewDecision?.decision, "denied");
  assert.equal(rejected.dispatch, undefined);
  assert.equal(runtime.getTaHumanGate(gate.gateId)?.status, "rejected");
  assert.equal(runtime.listTaHumanGateEvents(gate.gateId).length, 2);
});

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

test("AgentCoreRuntime lets bapr mode dispatch straight through TAP for available capabilities", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.bapr",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["shell.*"],
      deniedCapabilityPatterns: [],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-bapr",
      sessionId: session.sessionId,
      userInput: "BAPR mode should bypass reviewer waiting for available capabilities.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const adapter: CapabilityAdapter = {
    id: "adapter.shell.exec.bapr",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "shell.exec";
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
          answer: "bapr-direct-ok",
        },
        completedAt: new Date("2026-03-19T10:00:01.000Z").toISOString(),
      };
    },
  };
  runtime.registerCapabilityAdapter({
    capabilityId: "cap-shell-exec-bapr",
    capabilityKey: "shell.exec",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Available shell execution capability for bapr mode smoke.",
  }, adapter);

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-bapr-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-19T10:00:00.000Z",
    priority: "high",
    request: {
      requestId: "request-ta-bapr-1",
      intentId: "intent-ta-bapr-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "shell.exec",
      input: {
        command: "echo praxis",
      },
      priority: "high",
    },
  };

  const result = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "bapr",
    reason: "BAPR mode should flow straight through the TAP approval path.",
  });

  assert.equal(result.status, "dispatched");
  assert.equal(result.reviewDecision?.decision, "approved");
  assert.equal(result.reviewDecision?.vote, "allow");
  assert.equal(result.safety, undefined);
  assert.equal(result.grant?.reviewVote, "allow");
  assert.equal(result.dispatch?.prepared.capabilityKey, "shell.exec");
});

test("AgentCoreRuntime can assemble safety interruption through T/A pool", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.safety",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-ta-5",
      sessionId: session.sessionId,
      userInput: "Interrupt dangerous capability requests in yolo mode.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-ta-safety-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:07.000Z").toISOString(),
    priority: "critical",
    request: {
      requestId: "request-ta-safety-1",
      intentId: "intent-ta-safety-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "shell.rm.force",
      input: {
        command: "rm -rf /important",
      },
      priority: "critical",
    },
  };

  const result = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B3",
    mode: "yolo",
    reason: "Dangerous shell action should be interrupted before dispatch.",
  });

  assert.equal(result.status, "interrupted");
  assert.equal(result.safety?.outcome, "interrupt");
  assert.equal(result.dispatch, undefined);
});

test("AgentCoreRuntime keeps the legacy broker/port path as an explicit bypass", async () => {
  const runtime = createAgentCoreRuntime();
  const facade = createFakeRaxFacade();
  runtime.registerCapabilityPort(
    createRaxSearchGroundCapabilityDefinition({
      facade,
    }),
  );

  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-2",
      sessionId: session.sessionId,
      userInput: "Use web search when needed.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-search-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-17T00:00:01.000Z").toISOString(),
    priority: "high",
    request: {
      requestId: "request-search-1",
      intentId: "intent-search-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "example domain",
      },
      priority: "high",
    },
  };

  const dispatched = await runtime.dispatchCapabilityIntent(intent);

  assert.equal(dispatched.dispatchReceipt?.response.status, "completed");
  assert.equal(dispatched.dispatchReceipt?.response.result?.status, "success");
  assert.equal(
    (dispatched.dispatchReceipt?.response.result?.output as { answer: string } | undefined)?.answer,
    "Example Domain",
  );
  assert.equal(dispatched.latestEvent?.type, "capability.result_received");
  assert.equal(dispatched.runOutcome?.run.runId, created.run.runId);
  assert.deepEqual(
    runtime.readRunEvents(created.run.runId).map((entry) => entry.event.type).slice(-4),
    ["intent.dispatched", "capability.result_received", "state.delta_applied", "intent.queued"],
  );
});

test("AgentCoreRuntime can finish a minimal direct-answer run through model inference", async () => {
  const runtime = createAgentCoreRuntime({
    modelInferenceExecutor: async ({ intent }): Promise<ModelInferenceExecutionResult> => ({
      provider: "openai",
      model: "gpt-5.4",
      layer: "api",
      raw: { answer: "意义往往不是被发现的，而是被创造的。" },
      result: {
        resultId: `${intent.intentId}:result`,
        sessionId: intent.sessionId,
        runId: intent.runId,
        source: "model",
        status: "success",
        output: {
          text: "意义往往不是被发现的，而是被创造的。",
        },
        evidence: [],
        emittedAt: new Date("2026-03-17T00:00:02.000Z").toISOString(),
        correlationId: intent.correlationId,
      },
    }),
  });
  const session = runtime.createSession();
  const result = await runtime.runUntilTerminal({
    sessionId: session.sessionId,
    source: createGoalSource({
      goalId: "goal-runtime-3",
      sessionId: session.sessionId,
      userInput: "请你回答我生命存在的意义是什么?",
      metadata: {
        provider: "openai",
        model: "gpt-5.4",
      },
    }),
    maxSteps: 2,
  });

  assert.equal(result.outcome.run.status, "completed");
  assert.equal(result.outcome.run.phase, "commit");
  assert.match(result.answer ?? "", /意义|创造|生命/u);
  assert.deepEqual(
    result.finalEvents.map((entry) => entry.event.type).slice(-4),
    ["capability.result_received", "state.delta_applied", "run.completed", "state.delta_applied"],
  );
});

test("AgentCoreRuntime runUntilTerminal stops cleanly when TAP returns a non-dispatched capability status", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.run-until-terminal-non-dispatched",
      agentClass: "main-agent",
    }),
  });
  const session = runtime.createSession();
  const source = createGoalSource({
    goalId: "goal-runtime-run-until-terminal-capability",
    sessionId: session.sessionId,
    userInput: "Pause on TAP review before capability execution.",
  });
  const goal = runtime.createCompiledGoal(source);
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });
  const queuedIntent: CapabilityCallIntent = {
    intentId: "intent-run-until-terminal-capability-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-18T00:00:08.000Z").toISOString(),
    priority: "normal",
    request: {
      requestId: "request-run-until-terminal-capability-1",
      intentId: "intent-run-until-terminal-capability-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "wait for review",
      },
      priority: "normal",
    },
  };

  runtime.createRunFromSource = async () => ({
    ...created,
    queuedIntent,
  });
  runtime.dispatchCapabilityIntentViaTaPool = async () => ({
    status: "deferred",
  });

  const result = await runtime.runUntilTerminal({
    sessionId: session.sessionId,
    source,
    maxSteps: 2,
  });

  assert.equal(result.capabilityDispatch?.status, "deferred");
  assert.equal(result.outcome.run.runId, created.run.runId);
  assert.equal(result.steps, 1);
  assert.deepEqual(
    result.finalEvents.map((entry) => entry.event.type),
    ["run.created", "state.delta_applied", "intent.queued"],
  );
});
