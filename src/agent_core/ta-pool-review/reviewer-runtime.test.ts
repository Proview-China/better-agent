import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import {
  REVIEWER_WORKER_BRIDGE_LANE,
  REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
} from "./reviewer-worker-bridge.js";
import { createReviewerRuntime } from "./reviewer-runtime.js";
import { createDefaultReviewerLlmHook } from "./reviewer-model-hook.js";

function createProfile() {
  return createAgentCapabilityProfile({
    profileId: "profile.main",
    agentClass: "main-agent",
    defaultMode: "balanced",
    baselineTier: "B0",
    baselineCapabilities: ["docs.read", "code.read"],
    deniedCapabilityPatterns: ["shell.*", "system.*"],
    allowedCapabilityPatterns: ["search.*", "mcp.*"],
  });
}

function createRequest(overrides: Partial<ReturnType<typeof createAccessRequest>> = {}) {
  return createAccessRequest({
    requestId: overrides.requestId ?? "req-reviewer-1",
    sessionId: overrides.sessionId ?? "session-1",
    runId: overrides.runId ?? "run-1",
    agentId: overrides.agentId ?? "agent-main",
    requestedCapabilityKey: overrides.requestedCapabilityKey ?? "mcp.playwright",
    requestedTier: overrides.requestedTier ?? "B1",
    reason: overrides.reason ?? "Need reviewer runtime decision.",
    mode: overrides.mode ?? "balanced",
    createdAt: overrides.createdAt ?? "2026-03-18T03:00:00.000Z",
  });
}

test("reviewer runtime returns baseline-approved decisions through the fast path", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "docs.read",
      requestedTier: "B0",
    }),
    profile: createProfile(),
  });

  assert.equal(decision.decision, "approved");
  assert.equal(decision.vote, "allow");
  assert.equal(decision.grant, undefined);
  assert.equal(decision.grantCompilerDirective?.grantedTier, "B0");
});

test("reviewer runtime redirects missing capabilities to provisioning", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "computer.use",
      requestedTier: "B2",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "redirected_to_provisioning");
  assert.equal(decision.provisionCapabilityKey, "computer.use");
});

test("reviewer runtime falls back to review engine and can defer pending provisioning", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
      pendingProvisionKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "deferred");
});

test("reviewer runtime escalates strict critical requests to human", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B3",
      mode: "strict",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "escalated_to_human");
  assert.equal(decision.escalationTarget, "human-review");
});

test("reviewer runtime routes review-required requests through the bootstrap reviewer worker bridge", async () => {
  const runtime = createReviewerRuntime({
    llmReviewerHook: async ({ request, reviewContext, promptPack, workerEnvelope }) => {
      assert.equal(reviewContext.projectSummary.status, "ready");
      assert.match(reviewContext.projectSummary.summary, /Reviewing mcp\.playwright/u);
      assert.equal(reviewContext.memorySummaryPlaceholder.status, "ready");
      assert.match(reviewContext.memorySummaryPlaceholder.summary, /Section-backed context is available/u);
      assert.equal(reviewContext.userIntentSummary.summary, "Need reviewer runtime decision.");
      assert.equal(reviewContext.riskSummary.requestedAction, "request capability mcp.playwright");
      assert.equal(reviewContext.riskSummary.plainLanguageRisk.riskLevel, "normal");
      assert.equal(reviewContext.sections.length >= 3, true);
      assert.equal(reviewContext.sections[0]?.sectionId, "review.request");
      assert.deepEqual(reviewContext.inventorySnapshot.metadata?.readyProvisionAssetKeys, ["mcp.playwright"]);
      assert.deepEqual(reviewContext.inventorySnapshot.metadata?.activeProvisionAssetKeys, ["computer.use"]);
      assert.equal(promptPack.lane, REVIEWER_WORKER_BRIDGE_LANE);
      assert.match(promptPack.mission, /structured vote/i);
      assert.equal(workerEnvelope.schemaVersion, "tap-reviewer-worker-input/v1");
      assert.equal(workerEnvelope.lane, REVIEWER_WORKER_BRIDGE_LANE);
      assert.equal(workerEnvelope.runtimeContract.canExecute, false);
      assert.equal(workerEnvelope.runtimeContract.canDispatchGrant, false);
      assert.equal(workerEnvelope.runtimeContract.canWrite, false);
      assert.equal(workerEnvelope.routed.outcome, "review_required");
      assert.equal(workerEnvelope.request.requestId, request.requestId);

      return {
        schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
        workerKind: "reviewer",
        lane: REVIEWER_WORKER_BRIDGE_LANE,
        decisionId: "hook-decision-1",
        vote: "allow_with_constraints",
        reason: "reviewer worker override",
        reviewerId: "bootstrap-reviewer-1",
        recommendedTier: request.requestedTier,
        recommendedConstraints: {
          sourceHint: "llm-hook",
        },
        requiredFollowups: ["record reviewer trace"],
        createdAt: "2026-03-18T03:00:05.000Z",
      };
    },
  });

  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
      readyProvisionAssetKeys: ["mcp.playwright"],
      activeProvisionAssetKeys: ["computer.use"],
    },
  });

  assert.equal(runtime.hasLlmReviewerHook(), true);
  assert.equal(decision.vote, "allow_with_constraints");
  assert.equal(decision.reason, "reviewer worker override");
  assert.equal(decision.grant, undefined);
  assert.equal(decision.reviewerId, "bootstrap-reviewer-1");
  assert.equal(decision.grantCompilerDirective?.constraints?.source, "reviewer-worker-bridge");
  assert.equal(
    decision.grantCompilerDirective?.constraints?.promptPackVersion,
    "tap-reviewer-prompt-pack/v1",
  );
  assert.deepEqual(
    decision.grantCompilerDirective?.constraints?.requiredFollowups,
    ["record reviewer trace"],
  );
});

test("reviewer runtime rejects bridge output that tries to return an inline grant", async () => {
  const runtime = createReviewerRuntime({
    llmReviewerHook: async ({ request }) => ({
      schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
      workerKind: "reviewer",
      lane: REVIEWER_WORKER_BRIDGE_LANE,
      vote: "allow",
      reason: "trying to smuggle a grant",
      grant: {
        requestId: request.requestId,
      },
    }) as never,
  });

  await assert.rejects(
    () => runtime.submit({
      request: createRequest({
        requestedCapabilityKey: "mcp.playwright",
        requestedTier: "B1",
      }),
      profile: createProfile(),
      inventory: {
        availableCapabilityKeys: ["mcp.playwright"],
      },
    }),
    /vote-only; forbidden field grant/i,
  );
  assert.equal(runtime.listDurableStates().length, 0);
});

test("reviewer runtime records durable state after submit and can export/hydrate snapshot", async () => {
  const recorded: string[] = [];
  const runtime = createReviewerRuntime({
    durableStateHook: async (state) => {
      recorded.push(`${state.requestId}:${state.stage}`);
    },
  });
  const request = createRequest({
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B3",
    mode: "strict",
  });

  const decision = await runtime.submit({
    request,
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "escalated_to_human");
  assert.equal(runtime.getDurableState(request.requestId)?.stage, "waiting_human");
  assert.deepEqual(recorded, [`${request.requestId}:waiting_human`]);

  const hydrated = createReviewerRuntime();
  hydrated.hydrateDurableSnapshot(runtime.exportDurableSnapshot());
  assert.equal(hydrated.getDurableState(request.requestId)?.decision, "escalated_to_human");
  assert.equal(hydrated.listDurableStates().length, 1);
});

test("reviewer runtime keeps provisioning redirects resumable but still vote-only", async () => {
  const runtime = createReviewerRuntime();
  const request = createRequest({
    requestedCapabilityKey: "computer.use",
    requestedTier: "B2",
  });

  const decision = await runtime.submit({
    request,
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "redirected_to_provisioning");
  const durable = runtime.getDurableState(request.requestId);
  assert.equal(durable?.stage, "ready_to_resume");
  assert.equal(durable?.hasGrantCompilerDirective, false);
  assert.ok(decision.reviewerExplanation?.summary);
  assert.match(decision.reviewerExplanation?.nextStep ?? "", /TMA|reviewer/i);
});

test("default reviewer llm hook can drive runtime decisions through model inference", async () => {
  const runtime = createReviewerRuntime({
    llmReviewerHook: createDefaultReviewerLlmHook({
      executor: async ({ intent }) => ({
        provider: "openai",
        model: "gpt-5.4",
        layer: "api",
        raw: { text: "ok" },
        result: {
          resultId: `${intent.intentId}:result`,
          sessionId: intent.sessionId,
          runId: intent.runId,
          source: "model",
          status: "success",
          output: {
            text: JSON.stringify({
              schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
              workerKind: "reviewer",
              lane: REVIEWER_WORKER_BRIDGE_LANE,
              vote: "allow_with_constraints",
              reason: "model-backed reviewer approval",
              humanSummary: "可以继续，但要保持在当前审批边界里。",
              userFacingExplanation: "这次请求会被批准，但不会扩大到额外的危险动作。",
              contextFindings: ["Runtime inventory already carries the matching capability."],
              requiredFollowups: ["log-reviewer-model-trace"],
            }),
          },
          emittedAt: "2026-03-30T10:00:00.000Z",
        },
      }),
    }),
  });

  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.vote, "allow_with_constraints");
  assert.equal(decision.reason, "model-backed reviewer approval");
  assert.equal(decision.reviewerExplanation?.summary, "可以继续，但要保持在当前审批边界里。");
  assert.match(decision.reviewerExplanation?.nextStep ?? "", /runtime path|approved|继续/i);
  assert.deepEqual(
    decision.metadata?.requiredFollowups,
    ["log-reviewer-model-trace"],
  );
  assert.equal(
    (decision.metadata?.reviewerExplanation as { summary?: string } | undefined)?.summary,
    "可以继续，但要保持在当前审批边界里。",
  );
});
