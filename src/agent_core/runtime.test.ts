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
    taProfile: createFirstWaveCapabilityProfile({
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
  assert.equal(readCapabilityAccessAssignment(resolved.grant.metadata), "baseline");

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

test("AgentCoreRuntime can dispatch search.ground through TAP after package-backed activation materialization", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap.search-ground-package",
      agentClass: "main-agent",
      baselineCapabilities: ["search.ground"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-search-ground-package",
      sessionId: session.sessionId,
      userInput: "Package-backed grounded search should dispatch through TAP.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const capabilityPackage = createRaxWebsearchCapabilityPackage();
  runtime.registerTaActivationFactory(
    RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
    createRaxWebsearchActivationFactory({
      facade: createFakeRaxFacade(),
    }),
  );

  const provisionRequest = createProvisionRequest({
    provisionId: "provision-search-ground-package-1",
    sourceRequestId: "source-search-ground-package-1",
    requestedCapabilityKey: capabilityPackage.manifest.capabilityKey,
    requestedTier: "B1",
    reason: "Activate the package-backed search.ground capability through TAP runtime.",
    replayPolicy: capabilityPackage.replayPolicy,
    createdAt: "2026-03-25T00:00:00.000Z",
  });
  const provisionBundle = createProvisionArtifactBundle({
    bundleId: capabilityPackage.metadata?.bundleId as string,
    provisionId: provisionRequest.provisionId,
    status: "ready",
    toolArtifact: capabilityPackage.artifacts?.toolArtifact,
    bindingArtifact: capabilityPackage.artifacts?.bindingArtifact,
    verificationArtifact: capabilityPackage.artifacts?.verificationArtifact,
    usageArtifact: capabilityPackage.artifacts?.usageArtifact,
    activationSpec: capabilityPackage.activationSpec,
    replayPolicy: capabilityPackage.replayPolicy,
    completedAt: "2026-03-25T00:00:00.500Z",
    metadata: {
      source: "runtime-test",
      packageKey: capabilityPackage.manifest.capabilityKey,
    },
  });
  runtime.provisionerRuntime?.registry.registerRequest(provisionRequest);
  runtime.provisionerRuntime?.registry.attachBundle(provisionBundle);
  const provisionRecord = runtime.provisionerRuntime?.registry.get(provisionRequest.provisionId);
  assert.ok(provisionRecord?.bundle);
  runtime.provisionerRuntime?.assetIndex.ingest(provisionRecord);

  const activation = await runtime.activateTaProvisionAsset(provisionRequest.provisionId);
  assert.equal(activation.status, "activated");
  assert.equal(activation.activation?.status, "active");
  assert.equal(runtime.listTaActivationAttempts().length, 1);

  const intent: CapabilityCallIntent = {
    intentId: "intent-search-ground-package-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T00:00:01.000Z",
    priority: "high",
    request: {
      requestId: "request-search-ground-package-1",
      intentId: "intent-search-ground-package-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "What is Praxis?",
      },
      priority: "high",
    },
  };

  const dispatched = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "standard",
    reason: "Package-backed search.ground should dispatch as a first-class TAP capability.",
  });

  assert.equal(capabilityPackage.activationSpec?.targetPool, "ta-capability-pool");
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.grant?.capabilityKey, "search.ground");
  assert.equal(dispatched.dispatch?.prepared.capabilityKey, "search.ground");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(
    runtime.readRunEvents(created.run.runId).some((entry) => {
      return entry.event.type === "capability.result_received";
    }),
  );
});

test("AgentCoreRuntime surfaces review-required T/A access when capability is not baseline", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createFirstWaveCapabilityProfile({
      profileId: "profile.runtime",
      agentClass: "main-agent",
      reviewOnlyCapabilities: ["mcp.playwright"],
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
  assert.equal(readCapabilityAccessAssignment(resolved.request.metadata), "review_only");
});

test("AgentCoreRuntime uses packaged MCP call policy as a review-required thick capability", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.mcp-call-package",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["mcp.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-mcp-call-package",
      sessionId: session.sessionId,
      userInput: "Route MCP tool calls through TAP package policy.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const manifest = createRaxMcpCapabilityManifest({
    capabilityKey: "mcp.call",
  });
  const capabilityPackage = manifest.metadata?.capabilityPackage as {
    policy: {
      defaultBaseline: {
        grantedTier: "B1" | "B2" | "B3" | "B0";
      };
      recommendedMode: "standard" | "restricted" | "permissive" | "balanced" | "strict" | "yolo" | "bapr";
      riskLevel: string;
    };
  };

  const resolved = runtime.resolveTaCapabilityAccess({
    sessionId: session.sessionId,
    runId: created.run.runId,
    agentId: "agent-main",
    capabilityKey: manifest.capabilityKey,
    reason: "Packaged MCP tool calls should go through reviewer flow first.",
    requestedTier: capabilityPackage.policy.defaultBaseline.grantedTier,
    mode: capabilityPackage.policy.recommendedMode,
    metadata: {
      riskLevel: capabilityPackage.policy.riskLevel,
    },
  });

  assert.equal(resolved.status, "review_required");
  assert.equal(resolved.request.requestedCapabilityKey, "mcp.call");
  assert.equal(resolved.request.requestedTier, capabilityPackage.policy.defaultBaseline.grantedTier);
  assert.equal(resolved.request.mode, capabilityPackage.policy.recommendedMode);
});

test("AgentCoreRuntime can assemble review -> dispatch through T/A pool for available capabilities", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createFirstWaveCapabilityProfile({
      profileId: "profile.runtime.review",
      agentClass: "main-agent",
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

  const resolved = runtime.resolveTaCapabilityAccess({
    sessionId: session.sessionId,
    runId: created.run.runId,
    agentId: "agent-main",
    capabilityKey: "search.ground",
    reason: "Pattern-allowed capability should stay on the reviewer path in balanced mode.",
    requestedTier: "B1",
    mode: "balanced",
  });

  assert.equal(resolved.status, "review_required");
  assert.equal(readCapabilityAccessAssignment(resolved.request.metadata), "allowed_pattern");

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
  assert.equal(typeof result.replay?.resumeEnvelopeId, "string");
  assert.equal(result.replay?.resumeEnvelopeId?.startsWith("resume:replay:"), true);
  assert.equal(runtime.listTaPendingReplays().length, 1);
  assert.deepEqual(runtime.listResumableTmaSessions(), []);
  assert.equal(
    (result.provisionBundle?.metadata?.tmaDeliveryReceipt as { completionTarget?: string } | undefined)?.completionTarget,
    "ready_bundle",
  );
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

test("AgentCoreRuntime keeps packaged mcp.native.execute behind a human gate in restricted mode", async () => {
  let executed = false;
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.mcp-native-package",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["mcp.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-mcp-native-package",
      sessionId: session.sessionId,
      userInput: "Keep native MCP execution behind package policy and human review.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const manifest = createRaxMcpCapabilityManifest({
    capabilityKey: "mcp.native.execute",
  });
  const capabilityPackage = manifest.metadata?.capabilityPackage as {
    policy: {
      defaultBaseline: {
        grantedTier: "B0" | "B1" | "B2" | "B3";
      };
      recommendedMode: "bapr" | "yolo" | "permissive" | "standard" | "restricted";
    };
  };
  const adapter: CapabilityAdapter = {
    id: "adapter.mcp-native.execute.human-gate",
    runtimeKind: "rax-mcp",
    supports(plan) {
      return plan.capabilityKey === "mcp.native.execute";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "long-running",
      };
    },
    async execute() {
      executed = true;
      return {
        executionId: "mcp-native-execute:unexpected",
        resultId: "mcp-native-execute:unexpected",
        status: "success",
        completedAt: "2026-03-25T12:00:02.000Z",
      };
    },
  };

  runtime.registerCapabilityAdapter(manifest, adapter);

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-mcp-native-package-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T12:00:00.000Z",
    priority: "high",
    request: {
      requestId: "request-mcp-native-package-1",
      intentId: "intent-mcp-native-package-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "mcp.native.execute",
      input: {
        route: { provider: "openai", model: "gpt-5.4", layer: "agent" },
        input: {
          transport: {
            kind: "stdio",
            command: "node",
            args: ["server.js"],
          },
        },
      },
      priority: "high",
    },
  }, {
    agentId: "agent-main",
    requestedTier: capabilityPackage.policy.defaultBaseline.grantedTier,
    mode: capabilityPackage.policy.recommendedMode,
    reason: "Packaged native execute should wait for a human before dispatch.",
  });

  assert.equal(waiting.status, "waiting_human");
  assert.equal(waiting.reviewDecision?.decision, "escalated_to_human");
  assert.equal(waiting.humanGate?.capabilityKey, "mcp.native.execute");
  assert.equal(executed, false);
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

test("AgentCoreRuntime does not reprovision on human-gate approval when a provision asset is already tracked", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.human-gate-existing-asset",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-human-gate-existing-asset",
      sessionId: session.sessionId,
      userInput: "Approve against an already tracked provision asset.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-existing-asset-1",
    sourceRequestId: "request-existing-asset-1",
    requestedCapabilityKey: "computer.use",
    reason: "Seed existing asset before human approval.",
    createdAt: "2026-03-25T21:00:00.000Z",
  }));

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-human-gate-existing-asset-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-25T21:00:01.000Z",
    priority: "normal",
    request: {
      requestId: "request-human-gate-existing-asset-1",
      intentId: "intent-human-gate-existing-asset-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "reuse ready provision asset",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Restricted approval should reuse tracked asset instead of reprovisioning.",
  });

  assert.equal(waiting.status, "waiting_human");
  const gate = runtime.listTaHumanGates()[0];
  assert.ok(gate);

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: gate.gateId,
    action: "approve",
    actorId: "user-existing-asset",
  });

  assert.equal(approved.status, "deferred");
  assert.equal(approved.provisionRequest, undefined);
  assert.equal(approved.activation?.source, "provision_asset");
  assert.equal(approved.replay?.source, "provision_asset");
  assert.deepEqual(
    runtime.provisionerRuntime?.getBundleHistory("provision-existing-asset-1").map((bundle) => bundle.status),
    ["building", "ready"],
  );
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
  assert.equal(runtime.listToolReviewerQualityReports()[0]?.verdict, "waiting_human");

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: runtime.listTaHumanGates()[0]!.gateId,
    action: "approve",
    actorId: "user-tool-reviewer",
  });
  assert.equal(approved.status, "provisioned");
  assert.equal(runtime.toolReviewerRuntime?.listActions().some((action) => action.governanceKind === "replay"), true);

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
  const governancePlan = runtime.listToolReviewerGovernancePlans()[0];
  assert.ok(governancePlan);
  assert.equal(governancePlan?.counts.readyForHandoff >= 1, true);
  assert.equal(runtime.listToolReviewerQualityReports()[0]?.verdict, "handoff_ready");
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
