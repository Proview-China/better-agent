import assert from "node:assert/strict";
import test from "node:test";

import { createGoalSource } from "./goal/goal-source.js";
import type { ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { createRaxSearchGroundCapabilityDefinition } from "./integrations/rax-port.js";
import { createAgentCoreRuntime } from "./runtime.js";
import type { CapabilityAdapter, CapabilityCallIntent } from "./index.js";
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

test("AgentCoreRuntime can dispatch a capability intent through a real rax bridge", async () => {
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
