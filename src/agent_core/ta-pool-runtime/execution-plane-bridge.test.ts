import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilityGrant,
  createDecisionToken,
} from "../ta-pool-types/index.js";
import { TA_ENFORCEMENT_METADATA_KEY } from "./enforcement-guard.js";
import { createExecutionRequest, createInvocationPlanFromGrant } from "./execution-plane-bridge.js";

test("execution plane bridge normalizes execution requests", () => {
  const request = createExecutionRequest({
    requestId: "request-1",
    sessionId: "session-1",
    runId: "run-1",
    intentId: "intent-1",
    capabilityKey: "shell.exec",
    operation: "",
    input: {
      command: "npm test",
      cwd: "workspace\\apps\\tap",
    },
    priority: "high",
  });

  assert.equal(request.operation, "exec");
  assert.deepEqual(request.metadata?.executionGovernance, {
    family: "shell",
    operation: "exec",
    subject: "npm test",
    pathCandidates: ["workspace/apps/tap"],
  });
});

test("execution plane bridge lowers grants into invocation plans", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-1",
    requestId: "access-1",
    capabilityKey: "mcp.playwright",
    grantedTier: "B1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
    constraints: {
      maxScreenshots: 1,
    },
    decisionTokenId: "grant-1",
  });
  const decisionToken = createDecisionToken({
    requestId: "access-1",
    decisionId: "decision-1",
    compiledGrantId: "grant-1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
    signatureOrIntegrityMarker: "tap-grant-compiler/v1:decision-1:access-1",
  });

  const plan = createInvocationPlanFromGrant({
    grant,
    decisionToken,
    request: {
      requestId: "exec-1",
      sessionId: "session-1",
      runId: "run-1",
      intentId: "intent-1",
      capabilityKey: "mcp.playwright",
      operation: "playwright",
      input: {
        action: "screenshot",
        path: "workspace/previews/home.png",
      },
      priority: "normal",
    },
  });

  assert.equal(plan.capabilityKey, "mcp.playwright");
  assert.equal(plan.metadata?.bridge, "ta-pool");
  assert.equal(plan.metadata?.grantId, "grant-1");
  assert.equal(plan.metadata?.requestId, "exec-1");
  assert.equal(
    (plan.metadata?.[TA_ENFORCEMENT_METADATA_KEY] as { decisionToken?: { decisionId?: string } })?.decisionToken?.decisionId,
    "decision-1",
  );
  assert.deepEqual(plan.metadata?.executionGovernance, {
    family: "generic",
    operation: "playwright",
    subject: "screenshot",
    pathCandidates: ["workspace/previews/home.png"],
  });
  assert.deepEqual(plan.input, {
    action: "screenshot",
    path: "workspace/previews/home.png",
  });
});

test("execution plane bridge rejects reviewed grants that are missing a compiled DecisionToken", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-reviewed-1",
    requestId: "access-reviewed-1",
    capabilityKey: "search.web",
    grantedTier: "B1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
    decisionTokenId: "grant-reviewed-1",
  });

  assert.throws(() => {
    createInvocationPlanFromGrant({
      grant,
      request: {
        requestId: "exec-reviewed-1",
        sessionId: "session-1",
        runId: "run-1",
        intentId: "intent-reviewed-1",
        capabilityKey: "search.web",
        operation: "web",
        input: {
          query: "Praxis",
        },
        priority: "normal",
      },
    });
  }, /requires a DecisionToken before it can enter execution/);
});

test("execution plane bridge rejects execution requests that target a different capability than the grant", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-2",
    requestId: "access-2",
    capabilityKey: "mcp.playwright",
    grantedTier: "B1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
  });

  assert.throws(() => {
    createInvocationPlanFromGrant({
      grant,
      request: {
        requestId: "exec-2",
        sessionId: "session-1",
        runId: "run-1",
        intentId: "intent-2",
        capabilityKey: "search.web",
        operation: "web",
        input: {
          query: "Praxis",
        },
        priority: "normal",
      },
    });
  }, /targets search\.web, but grant grant-2 only allows mcp\.playwright/);
});
