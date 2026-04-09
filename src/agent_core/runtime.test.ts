import assert from "node:assert/strict";
import test from "node:test";

import {
  RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
  createMcpReadCapabilityPackage,
  createRaxMpCapabilityPackage,
  RAX_MP_ACTIVATION_FACTORY_REFS,
  createRaxWebsearchCapabilityPackage,
} from "./capability-package/index.js";
import { createGoalSource } from "./goal/goal-source.js";
import type { ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { createRaxMcpCapabilityManifest } from "./integrations/rax-mcp-adapter.js";
import { createRaxSearchGroundCapabilityDefinition } from "./integrations/rax-port.js";
import { createRaxMcpCapabilityAdapter } from "./integrations/rax-mcp-adapter.js";
import { createRaxMpActivationFactory } from "./integrations/rax-mp-adapter.js";
import { createRaxWebsearchActivationFactory } from "./integrations/rax-websearch-adapter.js";
import { createMpMemoryRecord } from "./mp-types/index.js";
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

function createFakeMpFacade() {
  const facade: Pick<RaxFacade, "mp"> = {
    mp: {
      create() {
        return {
          sessionId: "mp-session-test",
          projectId: "project.praxis",
          createdAt: "2026-04-08T00:00:00.000Z",
          config: {
            projectId: "project.praxis",
            profileId: "mp.default",
            defaultAgentId: "main",
            mode: "balanced" as const,
            lance: {
              kind: "lancedb" as const,
              rootPath: "/tmp/praxis/mp/project.praxis",
              schemaVersion: 1,
              liveExecutionPreferred: false,
            },
            searchDefaults: {
              limit: 10,
              scopeLevels: ["agent_isolated", "project", "global"] as const,
              preferSameAgent: true,
            },
            workflow: {
              enabled: true,
              roleModes: {
                icma: "llm_assisted" as const,
                iterator: "llm_assisted" as const,
                checker: "llm_assisted" as const,
                dbagent: "llm_assisted" as const,
                dispatcher: "llm_assisted" as const,
              },
              freshnessPolicy: {
                preferFresh: true,
                allowStaleFallback: true,
              },
              alignmentPolicy: {
                autoSupersede: true,
                markOlderAsStale: true,
              },
              retrievalPolicy: {
                primaryBundleLimit: 3,
                supportingBundleLimit: 5,
                omitSupersededFromPrimary: true,
              },
            },
          },
          runtime: {} as never,
        };
      },
      async bootstrap(input: Parameters<RaxFacade["mp"]["bootstrap"]>[0]) {
        return {
          status: "bootstrapped" as const,
          receipt: {
            projectId: input.session.projectId,
          } as never,
          session: input.session,
        };
      },
      async materialize() {
        return [];
      },
      async readback() {
        return {
          status: "found" as const,
          summary: {} as never,
        };
      },
      async smoke() {
        return {
          status: "ready" as const,
          checks: [],
        };
      },
      async ingest() {
        return {
          status: "ingested" as const,
          records: [],
          supersededMemoryIds: [],
          staleMemoryIds: [],
          summary: {} as never,
        };
      },
      async align() {
        return {
          status: "aligned" as const,
          primary: createMpMemoryRecord({
            memoryId: "memory-1",
            projectId: "project.praxis",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
            lineagePath: ["main"],
            payloadRefs: ["payload-1"],
            tags: ["history"],
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-08T00:00:01.000Z",
          }),
          updatedRecords: [],
          supersededMemoryIds: [],
          staleMemoryIds: [],
          summary: {} as never,
        };
      },
      async resolve() {
        return {
          status: "resolved" as const,
          bundle: {
            scope: {
              projectId: "project.praxis",
              agentId: "main",
              scopeLevel: "project",
              sessionMode: "shared",
              visibilityState: "project_shared",
              promotionState: "promoted_to_project",
            },
            primary: [],
            supporting: [],
            diagnostics: {
              omittedSupersededMemoryIds: [],
              rerankComposition: {
                fresh: 0,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 0,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
          summary: {} as never,
        };
      },
      async requestHistory() {
        return {
          status: "history_returned" as const,
          bundle: {
            scope: {
              projectId: "project.praxis",
              agentId: "main",
              scopeLevel: "project",
              sessionMode: "shared",
              visibilityState: "project_shared",
              promotionState: "promoted_to_project",
            },
            primary: [],
            supporting: [],
            diagnostics: {
              omittedSupersededMemoryIds: [],
              rerankComposition: {
                fresh: 0,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 0,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
          summary: {} as never,
        };
      },
      async materializeBatch() {
        return [];
      },
      async search() {
        return {
          projectId: "project.praxis",
          queryText: "history answer",
          hits: [{
            memoryId: "memory-1",
            tableName: "mp_project_project_praxis_memories",
            score: 1,
            record: createMpMemoryRecord({
              memoryId: "memory-1",
              projectId: "project.praxis",
              agentId: "main",
              scopeLevel: "project",
              sessionMode: "shared",
              visibilityState: "project_shared",
              promotionState: "promoted_to_project",
              lineagePath: ["main"],
              payloadRefs: ["payload-1"],
              tags: ["history"],
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:01.000Z",
            }),
          }],
        };
      },
      async archive() {
        return undefined;
      },
      async promote() {
        throw new Error("not used");
      },
      async split() {
        throw new Error("not used");
      },
      async merge() {
        throw new Error("not used");
      },
      async reindex() {
        throw new Error("not used");
      },
      async compact() {
        throw new Error("not used");
      },
    },
  };
  return facade;
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

test("AgentCoreRuntime registers the MP capability family by default and can opt out", () => {
  const runtime = createAgentCoreRuntime();
  const capabilityKeys = new Set(runtime.capabilityPool.listCapabilities().map((entry) => entry.capabilityKey));

  assert.equal(capabilityKeys.has("mp.ingest"), true);
  assert.equal(capabilityKeys.has("mp.align"), true);
  assert.equal(capabilityKeys.has("mp.resolve"), true);
  assert.equal(capabilityKeys.has("mp.history.request"), true);
  assert.equal(capabilityKeys.has("mp.search"), true);
  assert.equal(capabilityKeys.has("mp.materialize"), true);
  assert.equal(capabilityKeys.has("mp.promote"), true);
  assert.equal(capabilityKeys.has("mp.archive"), true);
  assert.equal(capabilityKeys.has("mp.split"), true);
  assert.equal(capabilityKeys.has("mp.merge"), true);
  assert.equal(capabilityKeys.has("mp.reindex"), true);
  assert.equal(capabilityKeys.has("mp.compact"), true);

  const optOutRuntime = createAgentCoreRuntime({
    registerDefaultMpCapabilityFamily: false,
  });
  const optOutKeys = new Set(optOutRuntime.capabilityPool.listCapabilities().map((entry) => entry.capabilityKey));
  assert.equal(optOutKeys.has("mp.search"), false);
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

test("AgentCoreRuntime default TAP dispatch applies governance tool-policy overrides before baseline fast path", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap-governance-default-route",
      agentClass: "main-agent",
      baselineCapabilities: ["search.ground"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-tap-governance-default-route",
      sessionId: session.sessionId,
      userInput: "Governance object should override default TAP routing.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-tap-governance-default-route-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: new Date("2026-03-30T09:00:00.000Z").toISOString(),
    priority: "high",
    request: {
      requestId: "request-tap-governance-default-route-1",
      intentId: "intent-tap-governance-default-route-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "search.ground",
      input: {
        query: "Force human review through governance override",
      },
      priority: "high",
      metadata: {
        tapUserOverride: {
          toolPolicyOverrides: [
            {
              capabilitySelector: "search.ground",
              policy: "human_gate",
            },
          ],
        },
      },
    },
  };

  const dispatched = await runtime.dispatchIntent(intent);

  assert.equal(dispatched.status, "waiting_human");
  assert.equal(dispatched.dispatch, undefined);
  assert.equal(dispatched.grant, undefined);
  assert.equal(dispatched.reviewDecision?.decision, "escalated_to_human");
  assert.equal(runtime.listTaHumanGates().length, 1);
  const userSurface = runtime.createTapUserSurfaceSnapshot();
  assert.equal(userSurface.currentLayer, "reviewer");
  assert.equal(userSurface.pendingHumanGateCount, 2);
  assert.deepEqual(userSurface.activeCapabilityKeys, []);
  assert.match(userSurface.summary, /waiting for 2 human approval/i);
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
    toolArtifact: capabilityPackage.artifacts?.toolArtifact ?? {
      artifactId: "tool:mp.search",
      kind: "tool",
      ref: "tool:mp.search",
    },
    bindingArtifact: capabilityPackage.artifacts?.bindingArtifact ?? {
      artifactId: "binding:mp.search",
      kind: "binding",
      ref: "binding:mp.search",
    },
    verificationArtifact: capabilityPackage.artifacts?.verificationArtifact ?? {
      artifactId: "verification:mp.search",
      kind: "verification",
      ref: "verification:mp.search",
    },
    usageArtifact: capabilityPackage.artifacts?.usageArtifact ?? {
      artifactId: "usage:mp.search",
      kind: "usage",
      ref: "usage:mp.search",
    },
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

test("AgentCoreRuntime can dispatch mp.search through TAP after package-backed activation materialization", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.tap.mp-search-package",
      agentClass: "main-agent",
      baselineCapabilities: ["mp.search"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-mp-search-package",
      sessionId: session.sessionId,
      userInput: "Package-backed mp.search should dispatch through TAP.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const capabilityPackage = createRaxMpCapabilityPackage({
    capabilityKey: "mp.search",
  });
  runtime.registerTaActivationFactory(
    RAX_MP_ACTIVATION_FACTORY_REFS["mp.search"],
    createRaxMpActivationFactory({
      facade: createFakeMpFacade(),
    }),
  );

  const provisionRequest = createProvisionRequest({
    provisionId: "provision-mp-search-package-1",
    sourceRequestId: "source-mp-search-package-1",
    requestedCapabilityKey: capabilityPackage.manifest.capabilityKey,
    requestedTier: "B1",
    reason: "Activate the package-backed mp.search capability through TAP runtime.",
    replayPolicy: capabilityPackage.replayPolicy,
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const provisionBundle = createProvisionArtifactBundle({
    bundleId: capabilityPackage.metadata?.bundleId as string,
    provisionId: provisionRequest.provisionId,
    status: "ready",
    toolArtifact: capabilityPackage.artifacts?.toolArtifact ?? {
      artifactId: "tool:mp.search",
      kind: "tool",
      ref: "tool:mp.search",
    },
    bindingArtifact: capabilityPackage.artifacts?.bindingArtifact ?? {
      artifactId: "binding:mp.search",
      kind: "binding",
      ref: "binding:mp.search",
    },
    verificationArtifact: capabilityPackage.artifacts?.verificationArtifact ?? {
      artifactId: "verification:mp.search",
      kind: "verification",
      ref: "verification:mp.search",
    },
    usageArtifact: capabilityPackage.artifacts?.usageArtifact ?? {
      artifactId: "usage:mp.search",
      kind: "usage",
      ref: "usage:mp.search",
    },
    activationSpec: capabilityPackage.activationSpec,
    replayPolicy: capabilityPackage.replayPolicy,
    completedAt: "2026-04-08T00:00:00.500Z",
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

  const intent: CapabilityCallIntent = {
    intentId: "intent-mp-search-package-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-04-08T00:00:01.000Z",
    priority: "high",
    request: {
      requestId: "request-mp-search-package-1",
      intentId: "intent-mp-search-package-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "mp.search",
      input: {
        projectId: "project.praxis",
        rootPath: "/tmp/praxis/mp/project.praxis",
        agentIds: ["main"],
        queryText: "history answer",
        requesterLineage: {
          projectId: "project.praxis",
          agentId: "main",
          depth: 0,
        },
        sourceLineages: [
          {
            projectId: "project.praxis",
            agentId: "main",
            depth: 0,
          },
        ],
      },
      priority: "high",
    },
  };

  const dispatched = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "standard",
    reason: "Package-backed mp.search should dispatch as a first-class TAP capability.",
  });

  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.grant?.capabilityKey, "mp.search");
  assert.equal(dispatched.dispatch?.prepared.capabilityKey, "mp.search");

  await new Promise((resolve) => setTimeout(resolve, 20));

  const resultEvent = runtime
    .readRunEvents(created.run.runId)
    .find((entry) => entry.event.type === "capability.result_received");
  assert.ok(resultEvent);
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
    metadata: {
      tapGovernanceDirective: {
        governanceObjectId: "tap-governance:test-provision-replay",
        effectiveMode: "permissive",
        automationDepth: "prefer_auto",
        explanationStyle: "plain_language",
        derivedRiskLevel: "normal",
        matchedToolPolicy: "review_only",
        matchedToolPolicySelector: "computer.use",
        forceHumanByRisk: false,
      },
    },
  });

  assert.equal(result.status, "provisioned");
  assert.equal(result.reviewDecision?.decision, "redirected_to_provisioning");
  assert.equal(result.provisionRequest?.requestedCapabilityKey, "computer.use");
  assert.equal(result.provisionBundle?.status, "ready");
  assert.equal(result.replay?.policy, "re_review_then_dispatch");
  assert.equal(result.replay?.state, "pending_re_review");
  assert.equal(runtime.listTaPendingReplays().length, 1);
  assert.deepEqual(runtime.listResumableTmaSessions(), []);
  assert.equal(
    (result.provisionBundle?.metadata?.tmaDeliveryReceipt as { completionTarget?: string } | undefined)?.completionTarget,
    "ready_bundle",
  );
  const replayEnvelopes = runtime.listTaResumeEnvelopes();
  assert.equal(replayEnvelopes.length, 1);
  assert.equal(replayEnvelopes[0]?.source, "replay");
  const toolReviewSessionId = `tool-review:provision:${result.provisionRequest!.provisionId}`;
  const toolReviewPlan = runtime.getToolReviewerGovernancePlan(toolReviewSessionId);
  assert.equal(toolReviewPlan?.items.some((item) =>
    item.governanceKind === "provision_request" && item.readyForHandoff), true);
  assert.equal(
    toolReviewPlan?.items.some((item) =>
      item.governanceKind === "delivery" && item.readyForHandoff),
    true,
  );
  assert.equal(
    runtime.listToolReviewerQualityReports().find((report) => report.sessionId === toolReviewSessionId)?.verdict,
    "handoff_ready",
  );
  const workOrder = runtime.listToolReviewerTmaWorkOrders().find((entry) => entry.sessionId === toolReviewSessionId);
  assert.equal(
    workOrder?.sourceGovernanceKind,
    "replay",
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

test("AgentCoreRuntime auto-picks an existing provision asset after human approval when activation is already wired", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.human-gate-existing-asset-auto-pickup",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["computer.*"],
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-human-gate-existing-asset-auto-pickup",
      sessionId: session.sessionId,
      userInput: "Auto-pick an existing provision asset after human approval.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-existing-asset-auto-pickup-1",
    sourceRequestId: "request-existing-asset-auto-pickup-1",
    requestedCapabilityKey: "computer.use",
    reason: "Seed existing asset before human approval and auto pickup.",
    createdAt: "2026-03-31T18:00:00.000Z",
  }));
  runtime.registerTaActivationFactory("factory:computer.use", () => ({
    id: "adapter.computer.use.human-gate-existing-asset-auto-pickup",
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
          answer: "human-gate-existing-asset-auto-pickup-ok",
        },
        completedAt: "2026-03-31T18:00:03.000Z",
      };
    },
  }));

  const waiting = await runtime.dispatchCapabilityIntentViaTaPool({
    intentId: "intent-human-gate-existing-asset-auto-pickup-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-31T18:00:01.000Z",
    priority: "normal",
    request: {
      requestId: "request-human-gate-existing-asset-auto-pickup-1",
      intentId: "intent-human-gate-existing-asset-auto-pickup-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "computer.use",
      input: {
        task: "reuse and auto-pick existing provision asset after approval",
      },
      priority: "normal",
    },
  }, {
    agentId: "agent-main",
    requestedTier: "B2",
    mode: "restricted",
    reason: "Restricted approval should auto-pick a wired existing asset once human says yes.",
  });

  assert.equal(waiting.status, "waiting_human");

  const approved = await runtime.submitTaHumanGateDecision({
    gateId: runtime.listTaHumanGates()[0]!.gateId,
    action: "approve",
    actorId: "user-existing-asset-auto-pickup",
  });

  assert.equal(approved.status, "waiting_human");
  assert.equal(approved.humanGate?.status, "approved");
  assert.equal(approved.continueResult?.status, "waiting_human");
  assert.equal(runtime.listTaPendingReplays().length, 1);
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

test("AgentCoreRuntime can route model inference through TAP when model.infer is baseline-granted", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.model-infer-via-tap",
      agentClass: "main-agent",
      baselineCapabilities: ["model.infer"],
      defaultMode: "permissive",
    }),
    modelInferenceExecutor: async ({ intent }): Promise<ModelInferenceExecutionResult> => ({
      provider: "openai",
      model: "gpt-5.4",
      layer: "api",
      raw: { answer: "意义在于被你活出来。" },
      result: {
        resultId: `${intent.intentId}:result`,
        sessionId: intent.sessionId,
        runId: intent.runId,
        source: "model",
        status: "success",
        output: {
          text: "意义在于被你活出来。",
        },
        evidence: [],
        emittedAt: new Date("2026-03-30T00:00:02.000Z").toISOString(),
        correlationId: intent.correlationId,
      },
    }),
  });
  const session = runtime.createSession();
  const result = await runtime.runUntilTerminal({
    sessionId: session.sessionId,
    source: createGoalSource({
      goalId: "goal-runtime-model-via-tap",
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
  assert.equal(result.capabilityDispatch?.status, "dispatched");
  assert.equal(result.capabilityDispatch?.dispatch?.prepared.capabilityKey, "model.infer");
  assert.match(result.answer ?? "", /意义|活出来/u);
  assert.deepEqual(
    result.finalEvents.map((entry) => entry.event.type).slice(-4),
    ["state.delta_applied", "intent.queued", "capability.result_received", "state.delta_applied"],
  );
});

test("AgentCoreRuntime defaults reviewer, tool reviewer, and TMA to model-backed workers", async () => {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.runtime.default-tap-workers-model-backed",
      agentClass: "main-agent",
      defaultMode: "permissive",
    }),
    modelInferenceExecutor: async ({ intent }): Promise<ModelInferenceExecutionResult> => {
      const workerKind = intent.frame.metadata?.tapWorkerKind;
      const text = workerKind === "tap-reviewer"
        ? JSON.stringify({
          schemaVersion: "tap-reviewer-worker-output/v1",
          workerKind: "reviewer",
          lane: "bootstrap-reviewer",
          vote: "allow_with_constraints",
          reason: "default model-backed reviewer",
        })
        : workerKind === "tap-tool-reviewer"
          ? JSON.stringify({
            summary: "default model-backed tool reviewer",
            metadata: {
              trace: "tool-reviewer",
            },
          })
          : workerKind === "tap-tma"
            ? JSON.stringify({
              buildSummary: "default model-backed tma",
              replayRecommendationReason: "default model-backed replay reason",
              metadata: {
                trace: "tma",
              },
            })
            : JSON.stringify({
              text: "fallback",
            });

      return {
        provider: "openai",
        model: "gpt-5.4",
        layer: "api",
        raw: { text },
        result: {
          resultId: `${intent.intentId}:result`,
          sessionId: intent.sessionId,
          runId: intent.runId,
          source: "model",
          status: "success",
          output: { text },
          emittedAt: "2026-03-30T10:30:00.000Z",
        },
      };
    },
  });

  const reviewerDecision = await runtime.reviewerRuntime!.submit({
    request: {
      requestId: "req-runtime-workers-1",
      sessionId: "session-runtime-workers-1",
      runId: "run-runtime-workers-1",
      agentId: "agent-runtime-workers-1",
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
      reason: "Need browser tooling.",
      mode: "permissive",
      canonicalMode: "permissive",
      createdAt: "2026-03-30T10:30:00.000Z",
    },
    profile: createAgentCapabilityProfile({
      profileId: "profile-runtime-workers-reviewer",
      agentClass: "main-agent",
      defaultMode: "permissive",
      baselineCapabilities: ["docs.read"],
    }),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  const toolReview = await runtime.toolReviewerRuntime!.submit({
    governanceAction: {
      kind: "lifecycle",
      trace: createToolReviewGovernanceTrace({
        actionId: "action-runtime-workers-1",
        actorId: "tool-reviewer",
        reason: "Need lifecycle staging.",
        createdAt: "2026-03-30T10:30:01.000Z",
      }),
      capabilityKey: "mcp.playwright",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
    },
  });

  const provisionBundle = await runtime.provisionerRuntime!.submit(createProvisionRequest({
    provisionId: "provision-runtime-workers-1",
    sourceRequestId: "req-runtime-workers-1",
    requestedCapabilityKey: "repo.write",
    reason: "Need bootstrap tooling package.",
    createdAt: "2026-03-30T10:30:02.000Z",
  }));

  assert.equal(reviewerDecision.reason, "default model-backed reviewer");
  assert.equal(toolReview.output.summary, "default model-backed tool reviewer");
  assert.equal(provisionBundle.metadata?.buildSummary, "default model-backed tma");
  const provisionReplayMetadata = provisionBundle.metadata?.replayRecommendation as
    | { reason?: string }
    | undefined;
  assert.equal(
    provisionReplayMetadata?.reason,
    "default model-backed replay reason",
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
