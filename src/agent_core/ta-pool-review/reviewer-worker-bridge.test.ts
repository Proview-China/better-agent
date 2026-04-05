import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import { createReviewContextApertureSnapshot } from "../ta-pool-context/context-aperture.js";
import { routeAccessRequest } from "./review-routing.js";
import {
  compileReviewerWorkerVote,
  createReviewerWorkerEnvelope,
  createReviewerWorkerPromptPack,
  REVIEWER_WORKER_BRIDGE_LANE,
  REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
} from "./reviewer-worker-bridge.js";

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

function createRequest() {
  return createAccessRequest({
    requestId: "req-reviewer-worker-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    requestedScope: {
      pathPatterns: ["src/**"],
      allowedOperations: ["read"],
      providerHints: ["playwright"],
    },
    reason: "Need reviewer worker decision.",
    mode: "balanced",
    createdAt: "2026-03-19T00:00:00.000Z",
  });
}

function createReviewContext() {
  return createReviewContextApertureSnapshot({
    projectSummary: {
      summary: "Praxis blank-slate runtime.",
      status: "ready",
      source: "test",
    },
    runSummary: {
      summary: "run-1",
      status: "ready",
      source: "test",
    },
    profileSnapshot: createProfile(),
    inventorySnapshot: {
      totalCapabilities: 1,
      availableCapabilityKeys: ["mcp.playwright"],
    },
    userIntentSummary: {
      summary: "Need reviewer worker decision.",
      status: "ready",
      source: "test",
    },
    riskSummary: {
      riskLevel: "normal",
      requestedAction: "request capability mcp.playwright",
      plainLanguageRisk: {
        plainLanguageSummary: "Use Playwright read-only.",
        requestedAction: "request capability mcp.playwright",
        riskLevel: "normal",
        whyItIsRisky: "It touches browser automation.",
        possibleConsequence: "It may inspect external pages.",
        whatHappensIfNotRun: "The task cannot inspect the page.",
        availableUserActions: [
          {
            actionId: "approve",
            label: "Approve",
            kind: "approve",
          },
        ],
      },
      source: "generated",
    },
    sections: [
      {
        sectionId: "review.request",
        title: "Review Request",
        summary: "mcp.playwright 已进入 reviewer worker bridge。",
        status: "ready",
      },
    ],
    modeSnapshot: "balanced",
  });
}

test("reviewer worker bridge packages bootstrap lane input and compiles vote-only output", () => {
  const profile = createProfile();
  const request = createRequest();
  const routed = routeAccessRequest({
    profile,
    request,
    capabilityAvailable: true,
    idFactory: () => "route-id",
    clock: () => new Date("2026-03-19T00:00:01.000Z"),
  });
  const promptPack = createReviewerWorkerPromptPack();
  const workerEnvelope = createReviewerWorkerEnvelope({
    request,
    profile,
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
    reviewContext: createReviewContext(),
    routed,
  });

  assert.equal(workerEnvelope.lane, REVIEWER_WORKER_BRIDGE_LANE);
  assert.equal(workerEnvelope.runtimeContract.canExecute, false);
  assert.equal(workerEnvelope.runtimeContract.canDispatchGrant, false);
  assert.equal(workerEnvelope.routed.outcome, "review_required");
  assert.equal(workerEnvelope.reviewContext.memorySummaryPlaceholder.status, "ready");
  assert.match(promptPack.outputContract.join(" "), /structured vote JSON/i);

  const decision = compileReviewerWorkerVote({
    request,
    promptPack,
    output: {
      schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
      workerKind: "reviewer",
      lane: REVIEWER_WORKER_BRIDGE_LANE,
      vote: "allow_with_constraints",
      reason: "Approve with a narrower scope.",
      humanSummary: "可以批准，但只给更窄的范围。",
      userFacingExplanation: "这次会继续，但只保留你原请求里的安全子范围。",
      contextFindings: ["Inventory already reports a matching capability family."],
      operatorNotes: ["Do not widen file access beyond src/**."],
      recommendedTier: "B1",
      recommendedScope: {
        pathPatterns: ["src/**"],
        allowedOperations: ["read"],
      },
      denyPatterns: ["src/secrets/**"],
      requiredFollowups: ["record decision trace"],
    },
  });

  assert.equal(decision.vote, "allow_with_constraints");
  assert.equal(decision.grant, undefined);
  assert.equal(decision.grantCompilerDirective?.constraints?.source, "reviewer-worker-bridge");
  assert.deepEqual(
    decision.grantCompilerDirective?.constraints?.requiredFollowups,
    ["record decision trace"],
  );
  assert.deepEqual(decision.grantCompilerDirective?.grantedScope?.denyPatterns, ["src/secrets/**"]);
  assert.equal(
    decision.reviewerExplanation?.summary,
    "可以批准，但只给更窄的范围。",
  );
  assert.equal(
    decision.reviewerExplanation?.rationale,
    "这次会继续，但只保留你原请求里的安全子范围。",
  );
  assert.equal(
    (decision.metadata?.reviewerExplanation as { summary?: string } | undefined)?.summary,
    "可以批准，但只给更窄的范围。",
  );
  assert.deepEqual(
    (decision.metadata?.reviewerExplanation as { contextFindings?: string[] } | undefined)?.contextFindings,
    ["Inventory already reports a matching capability family."],
  );
});

test("reviewer worker bridge rejects allow votes that invent a new allow-list scope", () => {
  const request = createAccessRequest({
    requestId: "req-reviewer-worker-2",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need reviewer worker decision.",
    mode: "balanced",
    createdAt: "2026-03-19T00:00:00.000Z",
  });

  assert.throws(
    () => compileReviewerWorkerVote({
      request,
      promptPack: createReviewerWorkerPromptPack(),
      output: {
        schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
        workerKind: "reviewer",
        lane: REVIEWER_WORKER_BRIDGE_LANE,
        vote: "allow",
        reason: "Trying to add scope from nowhere.",
        recommendedScope: {
          pathPatterns: ["src/**"],
        },
      },
    }),
    /cannot introduce granted scope allow-lists/i,
  );
});

test("reviewer worker bridge rejects forbidden execution-bearing fields so it stays vote-only", () => {
  const request = createRequest();

  assert.throws(
    () => compileReviewerWorkerVote({
      request,
      promptPack: createReviewerWorkerPromptPack(),
      output: {
        schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
        workerKind: "reviewer",
        lane: REVIEWER_WORKER_BRIDGE_LANE,
        vote: "allow",
        reason: "Trying to smuggle a downstream execution token.",
        decisionToken: {
          requestId: request.requestId,
          compiledGrantId: "grant-forged-1",
        },
      } as never,
    }),
    /forbidden field decisionToken/i,
  );
});

test("reviewer worker bridge rejects non-allow votes that carry compiler directives", () => {
  const request = createRequest();

  assert.throws(
    () => compileReviewerWorkerVote({
      request,
      promptPack: createReviewerWorkerPromptPack(),
      output: {
        schemaVersion: REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
        workerKind: "reviewer",
        lane: REVIEWER_WORKER_BRIDGE_LANE,
        vote: "defer",
        reason: "Deferred votes must not smuggle compiler directives.",
        recommendedTier: "B1",
        recommendedScope: {
          pathPatterns: ["src/**"],
        },
      } as never,
    }),
    /cannot carry grant compiler directives/i,
  );
});
