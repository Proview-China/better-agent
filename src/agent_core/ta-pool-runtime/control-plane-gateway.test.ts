import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import {
  createTaControlPlaneGateway,
  TaControlPlaneGateway,
} from "./control-plane-gateway.js";

const clock = () => new Date("2026-03-18T00:00:00.000Z");
let counter = 0;
const idFactory = () => `id-${++counter}`;

test("control-plane gateway passes baseline-approved requests into execution", () => {
  counter = 0;
  const gateway = createTaControlPlaneGateway();
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });
  const request = createAccessRequest({
    requestId: "req-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "docs.read",
    requestedTier: "B0",
    reason: "Need docs.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });

  const result = gateway.authorize({
    profile,
    request,
    idFactory,
    clock,
  });

  assert.equal(gateway.shouldEnterExecution(result), true);
  assert.equal(gateway.toExecutionGrant(result)?.capabilityKey, "docs.read");
});

test("ta control-plane gateway baseline-grants unmatched normal capability in bapr mode", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-bapr-gateway",
    agentClass: "main-agent",
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const resolved = gateway.resolveCapabilityAccess({
    sessionId: "session-bapr-1",
    runId: "run-bapr-1",
    agentId: "agent-bapr-1",
    capabilityKey: "search.fetch",
    requestedTier: "B1",
    reason: "Need to fetch a page.",
    mode: "bapr",
  });

  assert.equal(resolved.status, "baseline_granted");
  assert.equal(resolved.grant.capabilityKey, "search.fetch");
});

test("ta control-plane gateway keeps restricted normal baseline capability on the fast path", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-restricted-gateway",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const baselineResolved = gateway.resolveCapabilityAccess({
    sessionId: "session-restricted-1",
    runId: "run-restricted-1",
    agentId: "agent-restricted-1",
    capabilityKey: "docs.read",
    requestedTier: "B0",
    reason: "Need docs.",
    mode: "restricted",
  });

  const unmatchedResolved = gateway.resolveCapabilityAccess({
    sessionId: "session-restricted-2",
    runId: "run-restricted-2",
    agentId: "agent-restricted-2",
    capabilityKey: "search.fetch",
    requestedTier: "B1",
    reason: "Need to fetch a page.",
    mode: "restricted",
  });

  assert.equal(baselineResolved.status, "baseline_granted");
  assert.equal(unmatchedResolved.status, "review_required");
  assert.equal(unmatchedResolved.request.riskLevel, "normal");
});

test("control-plane gateway exposes provisioning and human-gate branches", () => {
  counter = 0;
  const gateway = createTaControlPlaneGateway();
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });

  const provisionRequest = createAccessRequest({
    requestId: "req-2",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need browser automation.",
    mode: "balanced",
    createdAt: clock().toISOString(),
  });
  const provisionResult = gateway.authorize({
    profile,
    request: provisionRequest,
    capabilityAvailable: false,
    idFactory,
    clock,
  });
  assert.equal(gateway.requiresProvisioning(provisionResult), true);
  assert.equal(gateway.shouldEnterExecution(provisionResult), false);

  const humanRequest = createAccessRequest({
    requestId: "req-3",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "system.sudo",
    requestedTier: "B3",
    reason: "Need sudo.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });
  const humanResult = gateway.authorize({
    profile,
    request: humanRequest,
    capabilityAvailable: true,
    idFactory,
    clock,
  });
  assert.equal(gateway.requiresHuman(humanResult), true);
  assert.equal(gateway.shouldEnterExecution(humanResult), false);
});

test("control-plane gateway compiles allow votes into execution grants and decision tokens", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const request = gateway.submitAccessRequest({
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    capabilityKey: "mcp.playwright",
    requestedTier: "B1",
    requestedScope: {
      allowedOperations: ["screenshot"],
    },
    reason: "Need one screenshot.",
    mode: "balanced",
  });

  const consumed = gateway.consumeReviewDecision(createReviewDecision({
    decisionId: "decision-compiled-1",
    requestId: request.requestId,
    vote: "allow_with_constraints",
    mode: request.mode,
    reason: "Allow screenshot-only access.",
    grantCompilerDirective: {
      grantedTier: "B1",
      grantedScope: {
        allowedOperations: ["screenshot"],
      },
      constraints: {
        source: "review-vote",
      },
    },
    createdAt: clock().toISOString(),
  }));

  assert.equal(consumed.status, "partially_approved");
  assert.equal(consumed.grant?.capabilityKey, "mcp.playwright");
  assert.equal(consumed.grant?.reviewVote, "allow_with_constraints");
  assert.equal(consumed.decisionToken?.decisionId, "decision-compiled-1");
  assert.equal(consumed.executionRequest?.metadata?.decisionTokenId, consumed.grant?.decisionTokenId);
});

test("control-plane gateway rejects widened compiler directives on the main chain", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const request = gateway.submitAccessRequest({
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    capabilityKey: "mcp.playwright",
    requestedTier: "B1",
    requestedScope: {
      allowedOperations: ["screenshot"],
    },
    reason: "Need one screenshot.",
    mode: "balanced",
  });

  assert.throws(() => {
    gateway.consumeReviewDecision(createReviewDecision({
      decisionId: "decision-bad-1",
      requestId: request.requestId,
      vote: "allow",
      mode: request.mode,
      reason: "This tries to over-grant.",
      grantCompilerDirective: {
        grantedTier: "B2",
        grantedScope: {
          allowedOperations: ["screenshot", "click"],
        },
      },
      createdAt: clock().toISOString(),
    }));
  }, /widens tier|widens allowedOperations/);
});

test("control-plane gateway lets restricted requests wait at human gate and then continue on approval", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-restricted",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const request = gateway.submitAccessRequest({
    sessionId: "session-restricted-1",
    runId: "run-restricted-1",
    agentId: "agent-restricted-1",
    capabilityKey: "mcp.playwright",
    requestedTier: "B1",
    requestedScope: {
      allowedOperations: ["screenshot"],
    },
    reason: "Need one browser screenshot after human approval.",
    mode: "restricted",
  });

  const waiting = gateway.consumeReviewDecision(createReviewDecision({
    decisionId: "decision-human-wait-1",
    requestId: request.requestId,
    decision: "escalated_to_human",
    mode: request.mode,
    reason: "Restricted mode keeps this request waiting for human review.",
    escalationTarget: "human-review",
    createdAt: clock().toISOString(),
  }));

  assert.equal(waiting.status, "escalated_to_human");
  assert.equal(waiting.grant, undefined);
  assert.equal(waiting.decisionToken, undefined);

  const approved = gateway.consumeReviewDecision(createReviewDecision({
    decisionId: "decision-human-approve-1",
    requestId: request.requestId,
    vote: "allow_with_constraints",
    mode: request.mode,
    reason: "Human approved screenshot-only access.",
    grantCompilerDirective: {
      grantedTier: "B1",
      grantedScope: {
        allowedOperations: ["screenshot"],
      },
      constraints: {
        source: "human-gate",
      },
    },
    createdAt: clock().toISOString(),
  }));

  assert.equal(approved.status, "partially_approved");
  assert.equal(approved.grant?.capabilityKey, "mcp.playwright");
  assert.equal(approved.decisionToken?.requestId, request.requestId);
  assert.equal(approved.executionRequest?.metadata?.sourceDecisionId, "decision-human-approve-1");
});

test("control-plane gateway lets restricted requests wait at human gate and then stop on rejection", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-restricted",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });
  const gateway = new TaControlPlaneGateway({
    profile,
    clock,
    idFactory,
  });

  const request = gateway.submitAccessRequest({
    sessionId: "session-restricted-2",
    runId: "run-restricted-2",
    agentId: "agent-restricted-2",
    capabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need browser access that may be rejected by human review.",
    mode: "restricted",
  });

  gateway.consumeReviewDecision(createReviewDecision({
    decisionId: "decision-human-wait-2",
    requestId: request.requestId,
    decision: "escalated_to_human",
    mode: request.mode,
    reason: "Restricted mode keeps this request waiting for human review.",
    escalationTarget: "human-review",
    createdAt: clock().toISOString(),
  }));

  const denied = gateway.consumeReviewDecision(createReviewDecision({
    decisionId: "decision-human-deny-1",
    requestId: request.requestId,
    decision: "denied",
    mode: request.mode,
    reason: "Human explicitly rejected this request.",
    createdAt: clock().toISOString(),
  }));

  assert.equal(denied.status, "denied");
  assert.equal(denied.grant, undefined);
  assert.equal(denied.decisionToken, undefined);
});
