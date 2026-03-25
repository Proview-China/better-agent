import assert from "node:assert/strict";
import test from "node:test";

import { createGoalSource } from "./goal/goal-source.js";
import type { ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { createRaxSearchGroundCapabilityDefinition } from "./integrations/rax-port.js";
import { createAgentCoreRuntime } from "./runtime.js";
import type { CapabilityAdapter, CapabilityCallIntent, CmpActionIntent } from "./index.js";
import {
  createAgentLineage,
  createCmpAgentLocalTableSet,
  createCmpBranchFamily,
  createCmpDbPostgresAdapter,
  createCmpGitAgentBranchRuntime,
  createInMemoryCmpGitBackend,
  type CmpGitBranchRef,
  type CmpGitProjectRepoBootstrapPlan,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
  createCmpGitProjectRepoBootstrapPlan,
  createCmpProjectDbTopology,
  createInMemoryCmpRedisMqAdapter,
} from "./index.js";
import { createAgentCapabilityProfile, createProvisionRequest } from "./ta-pool-types/index.js";
import { createReviewerRuntime } from "./ta-pool-review/index.js";
import { TA_ENFORCEMENT_METADATA_KEY } from "./ta-pool-runtime/enforcement-guard.js";
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

test("AgentCoreRuntime can keep CMP infra backends on the runtime boundary without wiring them yet", async () => {
  const projectId = "proj-runtime-cmp-backends";
  const topology = createCmpProjectDbTopology({
    projectId,
  });
  const lineage = createCmpGitLineageNode({
    agentId: "main",
    projectId,
    status: "active",
  });
  const projectRepo = createCmpGitProjectRepo({
    projectId,
    repoName: "proj-runtime-cmp-backends",
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    lineage,
    projectRepo,
    repoRootPath: "/tmp/praxis/proj-runtime-cmp-backends",
  });

  const gitBackend = {
    bootstrapProjectRepo(plan: ReturnType<typeof createCmpGitProjectRepoBootstrapPlan>) {
      return {
        projectRepo: plan.projectRepo,
        repoRootPath: plan.repoRootPath,
        defaultBranchName: plan.defaultBranchName,
        createdBranchNames: plan.branchKinds.map((kind) => `${kind}/${plan.projectRepo.defaultAgentId}`),
        status: "bootstrapped" as const,
      };
    },
    bootstrapAgentBranchRuntime(runtime: typeof branchRuntime) {
      return [runtime.branchFamily.cmp.fullRef, runtime.branchFamily.work.fullRef] as const;
    },
    readBranchHead(runtime: typeof branchRuntime) {
      return {
        branchRef: runtime.branchFamily.cmp,
      };
    },
    writeCheckedRef(runtime: typeof branchRuntime, commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        checkedRefName: runtime.checkedRefName,
        checkedCommitSha: commitSha,
      };
    },
    writePromotedRef(runtime: typeof branchRuntime, commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        promotedRefName: runtime.promotedRefName,
        promotedCommitSha: commitSha,
      };
    },
  };
  const dbAdapter = createCmpDbPostgresAdapter({
    topology,
    localTableSets: [
      createCmpAgentLocalTableSet({
        projectId,
        agentId: "main",
      }),
    ],
  });
  const mqAdapter = createInMemoryCmpRedisMqAdapter();

  const runtime = createAgentCoreRuntime({
    cmpInfraBackends: {
      git: gitBackend,
      db: dbAdapter,
      mq: mqAdapter,
    },
  });

  assert.equal(runtime.cmpInfraBackends.git, gitBackend);
  assert.equal(runtime.cmpInfraBackends.db, dbAdapter);
  assert.equal(runtime.cmpInfraBackends.mq, mqAdapter);
});

test("AgentCoreRuntime can bootstrap CMP infra through configured git and mq backends", async () => {
  const projectId = "proj-runtime-bootstrap";
  const gitBackend = {
    bootstrapProjectRepo(plan: CmpGitProjectRepoBootstrapPlan) {
      return {
        projectRepo: plan.projectRepo,
        repoRootPath: plan.repoRootPath,
        defaultBranchName: plan.defaultBranchName,
        createdBranchNames: plan.branchKinds.map((kind: string) => `${kind}/${plan.projectRepo.defaultAgentId}`),
        status: "bootstrapped" as const,
      };
    },
    bootstrapAgentBranchRuntime(runtime: { branchFamily: { work: { fullRef: string }; cmp: { fullRef: string }; mp: { fullRef: string }; tap: { fullRef: string } } }) {
      return [
        runtime.branchFamily.work.fullRef,
        runtime.branchFamily.cmp.fullRef,
        runtime.branchFamily.mp.fullRef,
        runtime.branchFamily.tap.fullRef,
      ] as const;
    },
    readBranchHead(runtime: { branchFamily: { cmp: CmpGitBranchRef } }) {
      return {
        branchRef: runtime.branchFamily.cmp,
      };
    },
    writeCheckedRef(runtime: { branchFamily: { cmp: CmpGitBranchRef }; checkedRefName: string }, commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        checkedRefName: runtime.checkedRefName,
        checkedCommitSha: commitSha,
      };
    },
    writePromotedRef(runtime: { branchFamily: { cmp: CmpGitBranchRef }; promotedRefName: string }, commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        promotedRefName: runtime.promotedRefName,
        promotedCommitSha: commitSha,
      };
    },
  };
  const runtime = createAgentCoreRuntime({
    cmpInfraBackends: {
      git: gitBackend,
      mq: createInMemoryCmpRedisMqAdapter(),
      db: createCmpDbPostgresAdapter({
        topology: createCmpProjectDbTopology({
          projectId,
        }),
        localTableSets: [
          createCmpAgentLocalTableSet({
            projectId,
            agentId: "main",
          }),
        ],
      }),
      dbExecutor: {
        connection: {
          databaseName: projectId,
        },
        async executeStatement() {
          throw new Error("not used in bootstrapCmpProjectInfra test");
        },
        async executeBootstrapContract(contract) {
          return {
            receipt: {
              projectId: contract.projectId,
              databaseName: contract.databaseName,
              schemaName: contract.schemaName,
              status: "bootstrapped" as const,
              expectedTargetCount: contract.readbackStatements.length,
              presentTargetCount: contract.readbackStatements.length,
              readbackRecords: contract.readbackStatements.map((statement) => ({
                target: statement.target,
                schemaName: contract.schemaName,
                tableName: statement.target.split(".").slice(1).join("."),
                tableRef: statement.target,
                status: "present" as const,
              })),
            },
            bootstrapExecutions: [],
            readbackExecutions: [],
          };
        },
      },
    },
  });

  const receipt = await runtime.bootstrapCmpProjectInfra({
    projectId,
    repoName: projectId,
    repoRootPath: `/tmp/praxis/${projectId}`,
    agents: [
      { agentId: "main", depth: 0 },
      { agentId: "child-a", parentAgentId: "main", depth: 1 },
    ],
  });

  assert.equal(receipt.git.projectRepo.projectId, projectId);
  assert.equal(receipt.gitBranchBootstraps.length, 2);
  assert.equal(receipt.dbReceipt.status, "bootstrapped");
  assert.equal(receipt.mqBootstraps.length, 2);
  assert.equal(runtime.listCmpLineages().length, 2);
  assert.equal(runtime.getCmpProjectInfraBootstrapReceipt(projectId)?.git.projectRepo.projectId, projectId);
  assert.equal(runtime.listCmpProjectInfraBootstrapReceipts().length, 1);
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

test("AgentCoreRuntime can run the first CMP active path through ingest, delta, snapshot, package, and dispatch", () => {
  const runtime = createAgentCoreRuntime();
  const lineage = createAgentLineage({
    agentId: "main",
    depth: 0,
    projectId: "cmp-project",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    }),
    childAgentIds: ["child-1"],
  });

  const ingested = runtime.ingestRuntimeContext({
    agentId: "main",
    sessionId: "session-cmp-1",
    runId: "run-cmp-1",
    lineage,
    taskSummary: "ingest active cmp context",
    materials: [
      {
        kind: "user_input",
        ref: "payload:user-1",
      },
    ],
  });
  assert.equal(ingested.status, "accepted");
  assert.equal(ingested.acceptedEventIds.length, 1);

  const committed = runtime.commitContextDelta({
    agentId: "main",
    sessionId: "session-cmp-1",
    runId: "run-cmp-1",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Record the first active CMP delta.",
    syncIntent: "local_record",
  });
  assert.equal(committed.status, "accepted");
  assert.ok(committed.snapshotCandidateId);

  const resolved = runtime.resolveCheckedSnapshot({
    agentId: "main",
    projectId: "cmp-project",
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.found, true);
  assert.ok(resolved.snapshot);

  const materialized = runtime.materializeContextPackage({
    agentId: "main",
    snapshotId: resolved.snapshot!.snapshotId,
    targetAgentId: "child-1",
    packageKind: "child_seed",
  });
  assert.equal(materialized.status, "materialized");
  assert.equal(materialized.contextPackage.packageKind, "child_seed");

  const dispatched = runtime.dispatchContextPackage({
    agentId: "main",
    packageId: materialized.contextPackage.packageId,
    sourceAgentId: "main",
    targetAgentId: "child-1",
    targetKind: "child",
  });
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.receipt.status, "delivered");

  assert.equal(runtime.readCmpEvents("main").length, 1);
  assert.equal(runtime.listCmpDeltas().length, 1);
  assert.equal(runtime.listCmpSyncEvents("main").length >= 2, true);
  assert.ok(runtime.getCmpDispatchReceipt(dispatched.receipt.dispatchId));
});

test("AgentCoreRuntime can dispatch a cmp_action intent through the kernel loop", async () => {
  const runtime = createAgentCoreRuntime();
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-runtime-cmp-intent",
      sessionId: session.sessionId,
      userInput: "Drive CMP through the kernel intent path.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const lineage = createAgentLineage({
    agentId: "cmp-main",
    depth: 0,
    projectId: "cmp-project-kernel-intent",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/cmp-main",
      cmpBranch: "cmp/cmp-main",
      mpBranch: "mp/cmp-main",
      tapBranch: "tap/cmp-main",
    }),
  });

  const intent: CmpActionIntent<"ingest_runtime_context"> = {
    intentId: "cmp-intent-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "cmp_action",
    createdAt: "2026-03-25T00:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "cmp-request-1",
      intentId: "cmp-intent-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      action: "ingest_runtime_context",
      input: {
        agentId: "cmp-main",
        sessionId: session.sessionId,
        runId: created.run.runId,
        lineage,
        taskSummary: "Kernel CMP ingest path",
        materials: [
          {
            kind: "user_input",
            ref: "payload:cmp-kernel-intent",
          },
        ],
      },
      priority: "normal",
    },
  };

  const dispatched = await runtime.dispatchIntent(intent);

  assert.equal(dispatched.action, "ingest_runtime_context");
  assert.equal(dispatched.error, undefined);
  assert.equal(dispatched.runOutcome.run.status, "waiting");
  assert.equal(dispatched.runOutcome.queuedIntent?.kind, "model_inference");
  assert.equal(runtime.readCmpEvents("cmp-main").length, 1);
  const tailEventTypes = runtime.readRunEvents(created.run.runId).slice(-3).map((entry) => entry.event.type);
  assert.deepEqual(tailEventTypes, [
    "capability.result_received",
    "state.delta_applied",
    "intent.queued",
  ]);
});

test("AgentCoreRuntime can serve the first CMP passive historical reply", () => {
  const runtime = createAgentCoreRuntime();
  const lineage = createAgentLineage({
    agentId: "main",
    depth: 0,
    projectId: "cmp-project-passive",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    }),
  });

  const ingested = runtime.ingestRuntimeContext({
    agentId: "main",
    sessionId: "session-cmp-2",
    runId: "run-cmp-2",
    lineage,
    taskSummary: "prepare passive history",
    materials: [
      {
        kind: "assistant_output",
        ref: "payload:assistant-1",
      },
    ],
  });
  runtime.commitContextDelta({
    agentId: "main",
    sessionId: "session-cmp-2",
    runId: "run-cmp-2",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Prepare checked snapshot for passive query.",
    syncIntent: "submit_to_parent",
  });

  const historical = runtime.requestHistoricalContext({
    requesterAgentId: "main",
    projectId: "cmp-project-passive",
    reason: "Need the latest checked historical package.",
    query: {},
  });

  assert.equal(historical.status, "materialized");
  assert.equal(historical.found, true);
  assert.ok(historical.snapshot);
  assert.ok(historical.contextPackage);
  assert.equal(historical.contextPackage?.packageKind, "historical_reply");
});

test("AgentCoreRuntime second wave promotes submit_to_parent deltas through cmp-git governance", () => {
  const runtime = createAgentCoreRuntime();
  const parentLineage = createAgentLineage({
    agentId: "parent",
    depth: 0,
    projectId: "cmp-project-governance",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/parent",
      cmpBranch: "cmp/parent",
      mpBranch: "mp/parent",
      tapBranch: "tap/parent",
    }),
    childAgentIds: ["child"],
  });
  const childLineage = createAgentLineage({
    agentId: "child",
    parentAgentId: "parent",
    depth: 1,
    projectId: "cmp-project-governance",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/child",
      cmpBranch: "cmp/child",
      mpBranch: "mp/child",
      tapBranch: "tap/child",
    }),
  });

  runtime.ingestRuntimeContext({
    agentId: "parent",
    sessionId: "session-parent",
    runId: "run-parent",
    lineage: parentLineage,
    taskSummary: "seed parent lineage",
    materials: [{ kind: "state_marker", ref: "payload:parent-seed" }],
    requiresActiveSync: false,
  });
  const ingested = runtime.ingestRuntimeContext({
    agentId: "child",
    sessionId: "session-child",
    runId: "run-child",
    lineage: childLineage,
    taskSummary: "child reports upward",
    materials: [{ kind: "assistant_output", ref: "payload:child-report" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "child",
    sessionId: "session-child",
    runId: "run-child",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Submit child context upward.",
    syncIntent: "submit_to_parent",
  });

  assert.ok(committed.snapshotCandidateId);
  assert.equal(runtime.listCmpGitPullRequests().length, 1);
  assert.equal(runtime.listCmpGitPromotions().length, 1);
  const checked = runtime.resolveCheckedSnapshot({
    agentId: "child",
    projectId: "cmp-project-governance",
  });
  assert.equal(checked.found, true);
  const projection = runtime.getCmpDbProjectionRecord(`projection:${checked.snapshot!.snapshotId}`);
  assert.equal(projection?.state, "promoted_by_parent");
});

test("AgentCoreRuntime second wave syncs DB package and delivery records during dispatch", () => {
  const runtime = createAgentCoreRuntime();
  const parentLineage = createAgentLineage({
    agentId: "main",
    depth: 0,
    projectId: "cmp-project-delivery",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    }),
    childAgentIds: ["child-a"],
  });
  runtime.ingestRuntimeContext({
    agentId: "main",
    sessionId: "session-delivery",
    runId: "run-delivery",
    lineage: parentLineage,
    taskSummary: "prepare delivery path",
    materials: [{ kind: "user_input", ref: "payload:delivery-user" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "main",
    sessionId: "session-delivery",
    runId: "run-delivery",
    eventIds: runtime.readCmpEvents("main").map((event) => event.eventId),
    changeSummary: "Prepare materialized package.",
    syncIntent: "dispatch_to_children",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "main",
    snapshotId: checked!.snapshotId,
    targetAgentId: "child-a",
    packageKind: "child_seed",
  });
  const dispatched = runtime.dispatchContextPackage({
    agentId: "main",
    packageId: materialized.contextPackage.packageId,
    sourceAgentId: "main",
    targetAgentId: "child-a",
    targetKind: "child",
  });

  const packageRecord = runtime.getCmpDbContextPackageRecord(materialized.contextPackage.packageId);
  const deliveryRecord = runtime.getCmpDbDeliveryRecord(dispatched.receipt.dispatchId);
  assert.equal(packageRecord?.state, "delivered");
  assert.equal(deliveryRecord?.state, "delivered");
});

test("AgentCoreRuntime second wave blocks non-skipping lineage dispatch to an ancestor", () => {
  const runtime = createAgentCoreRuntime();
  const root = createAgentLineage({
    agentId: "root",
    depth: 0,
    projectId: "cmp-project-nonskipping",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/root",
      cmpBranch: "cmp/root",
      mpBranch: "mp/root",
      tapBranch: "tap/root",
    }),
    childAgentIds: ["mid"],
  });
  const mid = createAgentLineage({
    agentId: "mid",
    parentAgentId: "root",
    depth: 1,
    projectId: "cmp-project-nonskipping",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/mid",
      cmpBranch: "cmp/mid",
      mpBranch: "mp/mid",
      tapBranch: "tap/mid",
    }),
    childAgentIds: ["leaf"],
    metadata: { ancestorAgentIds: ["root"] },
  });
  const leaf = createAgentLineage({
    agentId: "leaf",
    parentAgentId: "mid",
    depth: 2,
    projectId: "cmp-project-nonskipping",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/leaf",
      cmpBranch: "cmp/leaf",
      mpBranch: "mp/leaf",
      tapBranch: "tap/leaf",
    }),
    metadata: { ancestorAgentIds: ["mid", "root"] },
  });

  runtime.ingestRuntimeContext({
    agentId: "root",
    sessionId: "session-root",
    runId: "run-root",
    lineage: root,
    taskSummary: "seed root",
    materials: [{ kind: "state_marker", ref: "payload:root-seed" }],
    requiresActiveSync: false,
  });
  runtime.ingestRuntimeContext({
    agentId: "mid",
    sessionId: "session-mid",
    runId: "run-mid",
    lineage: mid,
    taskSummary: "seed mid",
    materials: [{ kind: "state_marker", ref: "payload:mid-seed" }],
    requiresActiveSync: false,
  });
  const ingested = runtime.ingestRuntimeContext({
    agentId: "leaf",
    sessionId: "session-leaf",
    runId: "run-leaf",
    lineage: leaf,
    taskSummary: "leaf tries to over-report",
    materials: [{ kind: "assistant_output", ref: "payload:leaf-output" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "leaf",
    sessionId: "session-leaf",
    runId: "run-leaf",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Prepare non-skipping test package.",
    syncIntent: "submit_to_parent",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "leaf",
    snapshotId: checked!.snapshotId,
    targetAgentId: "root",
    packageKind: "promotion_update",
  });

  assert.throws(() => {
    runtime.dispatchContextPackage({
      agentId: "leaf",
      packageId: materialized.contextPackage.packageId,
      sourceAgentId: "leaf",
      targetAgentId: "root",
      targetKind: "parent",
    });
  }, /not allowed for non-skipping delivery|not visible/i);
});

test("AgentCoreRuntime third wave can complete parent-child reseed and acknowledgement", () => {
  const runtime = createAgentCoreRuntime();
  const parent = createAgentLineage({
    agentId: "parent",
    depth: 0,
    projectId: "cmp-project-reseed",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/parent",
      cmpBranch: "cmp/parent",
      mpBranch: "mp/parent",
      tapBranch: "tap/parent",
    }),
    childAgentIds: ["child-r"],
  });

  const ingested = runtime.ingestRuntimeContext({
    agentId: "parent",
    sessionId: "session-reseed",
    runId: "run-reseed",
    lineage: parent,
    taskSummary: "prepare child reseed package",
    materials: [{ kind: "context_package", ref: "payload:reseed-package" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "parent",
    sessionId: "session-reseed",
    runId: "run-reseed",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Build child reseed package.",
    syncIntent: "dispatch_to_children",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "parent",
    snapshotId: checked!.snapshotId,
    targetAgentId: "child-r",
    packageKind: "child_seed",
  });
  const dispatched = runtime.dispatchContextPackage({
    agentId: "parent",
    packageId: materialized.contextPackage.packageId,
    sourceAgentId: "parent",
    targetAgentId: "child-r",
    targetKind: "child",
  });
  const acknowledged = runtime.acknowledgeCmpDispatch({
    dispatchId: dispatched.receipt.dispatchId,
  });

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(runtime.getCmpDbContextPackageRecord(materialized.contextPackage.packageId)?.state, "acknowledged");
  assert.equal(runtime.getCmpDbDeliveryRecord(dispatched.receipt.dispatchId)?.state, "acknowledged");
});

test("AgentCoreRuntime can advance MQ delivery timeout into retry and expiry states", async () => {
  const runtime = createAgentCoreRuntime({
    cmpInfraBackends: {
      git: createInMemoryCmpGitBackend(),
      mq: createInMemoryCmpRedisMqAdapter(),
    },
  });

  await runtime.bootstrapCmpProjectInfra({
    projectId: "cmp-project-timeout",
    repoName: "cmp-project-timeout",
    repoRootPath: "/tmp/praxis/cmp-project-timeout",
    agents: [
      { agentId: "parent", depth: 0 },
      { agentId: "child", parentAgentId: "parent", depth: 1 },
    ],
    defaultAgentId: "parent",
  });

  const parent = createAgentLineage({
    agentId: "parent",
    depth: 0,
    projectId: "cmp-project-timeout",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/parent",
      cmpBranch: "cmp/parent",
      mpBranch: "mp/parent",
      tapBranch: "tap/parent",
    }),
    childAgentIds: ["child"],
  });

  const ingested = runtime.ingestRuntimeContext({
    agentId: "parent",
    sessionId: "session-timeout",
    runId: "run-timeout",
    lineage: parent,
    taskSummary: "prepare timeout package",
    materials: [{ kind: "context_package", ref: "payload:timeout-package" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "parent",
    sessionId: "session-timeout",
    runId: "run-timeout",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Build timeout package.",
    syncIntent: "dispatch_to_children",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "parent",
    snapshotId: checked!.snapshotId,
    targetAgentId: "child",
    packageKind: "child_seed",
  });
  const dispatched = runtime.dispatchContextPackage({
    agentId: "parent",
    packageId: materialized.contextPackage.packageId,
    sourceAgentId: "parent",
    targetAgentId: "child",
    targetKind: "child",
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (runtime.getCmpDispatchReceipt(dispatched.receipt.dispatchId)?.metadata?.mqReceiptId) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const firstSweep = runtime.advanceCmpMqDeliveryTimeouts({
    projectId: "cmp-project-timeout",
    now: "2099-03-25T01:01:10.000Z",
  });
  const secondSweep = runtime.advanceCmpMqDeliveryTimeouts({
    projectId: "cmp-project-timeout",
    now: "2099-03-25T01:02:20.000Z",
  });
  const thirdSweep = runtime.advanceCmpMqDeliveryTimeouts({
    projectId: "cmp-project-timeout",
    now: "2099-03-25T01:03:30.000Z",
  });

  assert.equal(firstSweep.retryScheduledCount, 1);
  assert.equal(secondSweep.retryScheduledCount, 1);
  assert.equal(thirdSweep.expiredCount, 1);
  assert.equal(runtime.getCmpDbDeliveryRecord(dispatched.receipt.dispatchId)?.state, "expired");
  assert.equal(runtime.getCmpRuntimeDeliveryTruthSummary("cmp-project-timeout").expiredCount, 1);
});

test("AgentCoreRuntime third wave keeps sibling exchange out of upward promotion", () => {
  const runtime = createAgentCoreRuntime();
  const root = createAgentLineage({
    agentId: "root-s",
    depth: 0,
    projectId: "cmp-project-sibling",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/root-s",
      cmpBranch: "cmp/root-s",
      mpBranch: "mp/root-s",
      tapBranch: "tap/root-s",
    }),
    childAgentIds: ["sib-a", "sib-b"],
  });
  const siblingA = createAgentLineage({
    agentId: "sib-a",
    parentAgentId: "root-s",
    depth: 1,
    projectId: "cmp-project-sibling",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/sib-a",
      cmpBranch: "cmp/sib-a",
      mpBranch: "mp/sib-a",
      tapBranch: "tap/sib-a",
    }),
  });
  const siblingB = createAgentLineage({
    agentId: "sib-b",
    parentAgentId: "root-s",
    depth: 1,
    projectId: "cmp-project-sibling",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/sib-b",
      cmpBranch: "cmp/sib-b",
      mpBranch: "mp/sib-b",
      tapBranch: "tap/sib-b",
    }),
  });
  runtime.ingestRuntimeContext({
    agentId: "root-s",
    sessionId: "session-sibling-root",
    runId: "run-sibling-root",
    lineage: root,
    taskSummary: "seed root lineage",
    materials: [{ kind: "state_marker", ref: "payload:root-s" }],
    requiresActiveSync: false,
  });
  runtime.ingestRuntimeContext({
    agentId: "sib-b",
    sessionId: "session-sibling-b",
    runId: "run-sibling-b",
    lineage: siblingB,
    taskSummary: "register sibling B before direct peer attempt",
    materials: [{ kind: "state_marker", ref: "payload:sibling-b" }],
    requiresActiveSync: false,
  });
  const ingested = runtime.ingestRuntimeContext({
    agentId: "sib-a",
    sessionId: "session-sibling-a",
    runId: "run-sibling-a",
    lineage: siblingA,
    taskSummary: "prepare peer exchange package",
    materials: [{ kind: "assistant_output", ref: "payload:sibling-a" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "sib-a",
    sessionId: "session-sibling-a",
    runId: "run-sibling-a",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Prepare sibling exchange without upward promotion.",
    syncIntent: "broadcast_to_peers",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "sib-a",
    snapshotId: checked!.snapshotId,
    targetAgentId: "sib-b",
    packageKind: "peer_exchange",
  });
  assert.throws(() => {
    runtime.dispatchContextPackage({
      agentId: "sib-a",
      packageId: materialized.contextPackage.packageId,
      sourceAgentId: "sib-a",
      targetAgentId: "sib-b",
      targetKind: "peer",
    });
  }, /not visible|non-skipping/i);
  assert.equal(runtime.listCmpGitPromotions().length, 0);
});

test("AgentCoreRuntime third wave can recover a CMP runtime snapshot and continue serving history", () => {
  const runtime = createAgentCoreRuntime();
  const lineage = createAgentLineage({
    agentId: "recover-main",
    depth: 0,
    projectId: "cmp-project-recover",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/recover-main",
      cmpBranch: "cmp/recover-main",
      mpBranch: "mp/recover-main",
      tapBranch: "tap/recover-main",
    }),
    childAgentIds: ["recover-child"],
  });
  const ingested = runtime.ingestRuntimeContext({
    agentId: "recover-main",
    sessionId: "session-recover",
    runId: "run-recover",
    lineage,
    taskSummary: "prepare snapshot recovery",
    materials: [{ kind: "assistant_output", ref: "payload:recover-main" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "recover-main",
    sessionId: "session-recover",
    runId: "run-recover",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Prepare runtime snapshot.",
    syncIntent: "submit_to_parent",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const materialized = runtime.materializeContextPackage({
    agentId: "recover-main",
    snapshotId: checked!.snapshotId,
    targetAgentId: "recover-child",
    packageKind: "child_seed",
  });
  runtime.dispatchContextPackage({
    agentId: "recover-main",
    packageId: materialized.contextPackage.packageId,
    sourceAgentId: "recover-main",
    targetAgentId: "recover-child",
    targetKind: "child",
  });

  const snapshot = runtime.createCmpRuntimeSnapshot();
  const recovered = createAgentCoreRuntime();
  recovered.recoverCmpRuntimeSnapshot(snapshot);

  assert.equal(recovered.listCmpLineages().length, 2);
  assert.equal(recovered.listCmpContextPackages().length, 1);
  assert.equal(recovered.listCmpDispatchReceipts().length, 1);

  const historical = recovered.requestHistoricalContext({
    requesterAgentId: "recover-main",
    projectId: "cmp-project-recover",
    reason: "Read history after runtime recovery.",
    query: {},
  });
  assert.equal(historical.found, true);
  assert.equal(historical.contextPackage?.packageKind, "historical_reply");
});

test("AgentCoreRuntime third wave can reseed a child lineage through a parent-dispatched context package", () => {
  const runtime = createAgentCoreRuntime();
  const parent = createAgentLineage({
    agentId: "parent-reseed",
    depth: 0,
    projectId: "cmp-project-reseed",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/parent-reseed",
      cmpBranch: "cmp/parent-reseed",
      mpBranch: "mp/parent-reseed",
      tapBranch: "tap/parent-reseed",
    }),
    childAgentIds: ["child-reseed"],
  });
  const child = createAgentLineage({
    agentId: "child-reseed",
    parentAgentId: "parent-reseed",
    depth: 1,
    projectId: "cmp-project-reseed",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/child-reseed",
      cmpBranch: "cmp/child-reseed",
      mpBranch: "mp/child-reseed",
      tapBranch: "tap/child-reseed",
    }),
  });

  const parentIngest = runtime.ingestRuntimeContext({
    agentId: "parent-reseed",
    sessionId: "session-parent-reseed",
    runId: "run-parent-reseed",
    lineage: parent,
    taskSummary: "Parent prepares a high-signal child seed.",
    materials: [{ kind: "system_prompt", ref: "payload:parent-seed" }],
  });
  const parentCommit = runtime.commitContextDelta({
    agentId: "parent-reseed",
    sessionId: "session-parent-reseed",
    runId: "run-parent-reseed",
    eventIds: parentIngest.acceptedEventIds,
    changeSummary: "Prepare child reseed package.",
    syncIntent: "dispatch_to_children",
  });
  const parentChecked = runtime.getCmpCheckedSnapshot(parentCommit.metadata?.checkedSnapshotId as string);
  const seedPackage = runtime.materializeContextPackage({
    agentId: "parent-reseed",
    snapshotId: parentChecked!.snapshotId,
    targetAgentId: "child-reseed",
    packageKind: "child_seed",
  });
  const delivered = runtime.dispatchContextPackage({
    agentId: "parent-reseed",
    packageId: seedPackage.contextPackage.packageId,
    sourceAgentId: "parent-reseed",
    targetAgentId: "child-reseed",
    targetKind: "child",
  });

  assert.equal(delivered.receipt.status, "delivered");

  const childIngest = runtime.ingestRuntimeContext({
    agentId: "child-reseed",
    sessionId: "session-child-reseed",
    runId: "run-child-reseed",
    lineage: child,
    taskSummary: "Child consumes reseeded context package.",
    materials: [
      {
        kind: "context_package",
        ref: seedPackage.contextPackage.packageRef,
      },
    ],
  });
  const childCommit = runtime.commitContextDelta({
    agentId: "child-reseed",
    sessionId: "session-child-reseed",
    runId: "run-child-reseed",
    eventIds: childIngest.acceptedEventIds,
    changeSummary: "Child records reseeded context locally.",
    syncIntent: "local_record",
  });

  const childChecked = runtime.getCmpCheckedSnapshot(childCommit.metadata?.checkedSnapshotId as string);
  assert.ok(childChecked);
  assert.equal(runtime.readCmpEvents("child-reseed").at(-1)?.kind, "context_package_received");
});

test("AgentCoreRuntime third wave can route sibling exchange through parent mediation without turning it into upward promotion", () => {
  const runtime = createAgentCoreRuntime();
  const parent = createAgentLineage({
    agentId: "parent-peer",
    depth: 0,
    projectId: "cmp-project-peer",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/parent-peer",
      cmpBranch: "cmp/parent-peer",
      mpBranch: "mp/parent-peer",
      tapBranch: "tap/parent-peer",
    }),
    childAgentIds: ["left-peer", "right-peer"],
  });
  const left = createAgentLineage({
    agentId: "left-peer",
    parentAgentId: "parent-peer",
    depth: 1,
    projectId: "cmp-project-peer",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/left-peer",
      cmpBranch: "cmp/left-peer",
      mpBranch: "mp/left-peer",
      tapBranch: "tap/left-peer",
    }),
  });
  const right = createAgentLineage({
    agentId: "right-peer",
    parentAgentId: "parent-peer",
    depth: 1,
    projectId: "cmp-project-peer",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/right-peer",
      cmpBranch: "cmp/right-peer",
      mpBranch: "mp/right-peer",
      tapBranch: "tap/right-peer",
    }),
  });

  runtime.ingestRuntimeContext({
    agentId: "parent-peer",
    sessionId: "session-parent-peer",
    runId: "run-parent-peer",
    lineage: parent,
    taskSummary: "Seed parent lineage for sibling exchange.",
    materials: [{ kind: "state_marker", ref: "payload:parent-peer-seed" }],
    requiresActiveSync: false,
  });
  runtime.ingestRuntimeContext({
    agentId: "right-peer",
    sessionId: "session-right-peer-seed",
    runId: "run-right-peer-seed",
    lineage: right,
    taskSummary: "Register the right sibling lineage before peer delivery.",
    materials: [{ kind: "state_marker", ref: "payload:right-peer-seed" }],
    requiresActiveSync: false,
  });

  const leftIngest = runtime.ingestRuntimeContext({
    agentId: "left-peer",
    sessionId: "session-left-peer",
    runId: "run-left-peer",
    lineage: left,
    taskSummary: "Left sibling prepares a peer package.",
    materials: [{ kind: "assistant_output", ref: "payload:left-peer-output" }],
  });
  const leftCommit = runtime.commitContextDelta({
    agentId: "left-peer",
    sessionId: "session-left-peer",
    runId: "run-left-peer",
    eventIds: leftIngest.acceptedEventIds,
    changeSummary: "Prepare sibling exchange package.",
    syncIntent: "submit_to_parent",
  });
  const leftChecked = runtime.getCmpCheckedSnapshot(leftCommit.metadata?.checkedSnapshotId as string);
  const upwardPackage = runtime.materializeContextPackage({
    agentId: "left-peer",
    snapshotId: leftChecked!.snapshotId,
    targetAgentId: "parent-peer",
    packageKind: "promotion_update",
  });
  const upwardDispatch = runtime.dispatchContextPackage({
    agentId: "left-peer",
    packageId: upwardPackage.contextPackage.packageId,
    sourceAgentId: "left-peer",
    targetAgentId: "parent-peer",
    targetKind: "parent",
  });
  assert.equal(upwardDispatch.receipt.status, "delivered");

  const parentIngest = runtime.ingestRuntimeContext({
    agentId: "parent-peer",
    sessionId: "session-parent-peer-forward",
    runId: "run-parent-peer-forward",
    lineage: parent,
    taskSummary: "Parent mediates a sibling exchange.",
    materials: [{ kind: "context_package", ref: upwardPackage.contextPackage.packageRef }],
  });
  const parentCommit = runtime.commitContextDelta({
    agentId: "parent-peer",
    sessionId: "session-parent-peer-forward",
    runId: "run-parent-peer-forward",
    eventIds: parentIngest.acceptedEventIds,
    changeSummary: "Repackage sibling exchange through the parent.",
    syncIntent: "dispatch_to_children",
  });
  const parentChecked = runtime.getCmpCheckedSnapshot(parentCommit.metadata?.checkedSnapshotId as string);
  const peerPackage = runtime.materializeContextPackage({
    agentId: "parent-peer",
    snapshotId: parentChecked!.snapshotId,
    targetAgentId: "right-peer",
    packageKind: "peer_exchange",
  });
  assert.equal(peerPackage.contextPackage.packageKind, "peer_exchange");
  const promotion = runtime.listCmpGitPromotions().find((record) => record.sourceAgentId === "left-peer");
  assert.ok(promotion);

  const rightIngest = runtime.ingestRuntimeContext({
    agentId: "right-peer",
    sessionId: "session-right-peer",
    runId: "run-right-peer",
    lineage: right,
    taskSummary: "Right sibling consumes peer package.",
    materials: [{ kind: "context_package", ref: peerPackage.contextPackage.packageRef }],
  });
  assert.equal(rightIngest.status, "accepted");
  assert.equal(runtime.readCmpEvents("right-peer").at(-1)?.kind, "context_package_received");
});

test("AgentCoreRuntime third wave exposes recoverable lineage snapshot anchors after an interruption-shaped flow", () => {
  const runtime = createAgentCoreRuntime();
  const lineage = createAgentLineage({
    agentId: "recover-main",
    depth: 0,
    projectId: "cmp-project-recover",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/recover-main",
      cmpBranch: "cmp/recover-main",
      mpBranch: "mp/recover-main",
      tapBranch: "tap/recover-main",
    }),
    childAgentIds: ["recover-child"],
  });

  const ingested = runtime.ingestRuntimeContext({
    agentId: "recover-main",
    sessionId: "session-recover-main",
    runId: "run-recover-main",
    lineage,
    taskSummary: "Prepare interrupted lineage snapshot anchors.",
    materials: [{ kind: "assistant_output", ref: "payload:recover-main-output" }],
  });
  const committed = runtime.commitContextDelta({
    agentId: "recover-main",
    sessionId: "session-recover-main",
    runId: "run-recover-main",
    eventIds: ingested.acceptedEventIds,
    changeSummary: "Stage checked snapshot and child package before interruption.",
    syncIntent: "dispatch_to_children",
  });
  const checked = runtime.getCmpCheckedSnapshot(committed.metadata?.checkedSnapshotId as string);
  const pkg = runtime.materializeContextPackage({
    agentId: "recover-main",
    snapshotId: checked!.snapshotId,
    targetAgentId: "recover-child",
    packageKind: "child_seed",
  });

  assert.ok(runtime.getCmpSnapshotCandidate(committed.snapshotCandidateId!));
  assert.ok(runtime.getCmpCheckedSnapshot(checked!.snapshotId));
  assert.ok(runtime.getCmpPromotedProjection(pkg.contextPackage.sourceProjectionId));
  assert.ok(runtime.getCmpDbProjectionRecord(`projection:${checked!.snapshotId}`));
  assert.ok(runtime.getCmpDbContextPackageRecord(pkg.contextPackage.packageId));

  const historical = runtime.requestHistoricalContext({
    requesterAgentId: "recover-main",
    projectId: "cmp-project-recover",
    reason: "Use the last checked snapshot as a recovery anchor after interruption.",
    query: {
      snapshotId: checked!.snapshotId,
      packageKindHint: "historical_reply",
    },
  });

  assert.equal(historical.found, true);
  assert.equal(historical.snapshot?.snapshotId, checked!.snapshotId);
  assert.equal(historical.contextPackage?.packageKind, "historical_reply");
});
