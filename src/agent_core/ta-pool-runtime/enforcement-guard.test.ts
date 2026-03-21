import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityInvocationPlan } from "../capability-types/index.js";
import { TA_ENFORCEMENT_METADATA_KEY, validateTaPlanEnforcement } from "./enforcement-guard.js";

function createPlan(
  input: Partial<CapabilityInvocationPlan> = {},
): CapabilityInvocationPlan {
  return {
    planId: "plan-1",
    intentId: "intent-1",
    sessionId: "session-1",
    runId: "run-1",
    capabilityKey: "shell.exec",
    operation: "exec",
    input: {
      command: "echo praxis",
    },
    priority: "normal",
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
    },
  };
}

function createPlanWithEnforcement(params: {
  scope?: Record<string, unknown>;
  input?: CapabilityInvocationPlan["input"];
  operation?: string;
  metadata?: Record<string, unknown>;
}) {
  return createPlan({
    operation: params.operation ?? "exec",
    input: params.input ?? { command: "echo praxis" },
    metadata: {
      ...(params.metadata ?? {}),
      bridge: "ta-pool",
      [TA_ENFORCEMENT_METADATA_KEY]: {
        requestId: "req-1",
        executionRequestId: "plan-1",
        capabilityKey: "shell.exec",
        grantId: "grant-1",
        grantTier: "B1",
        mode: "balanced",
        tokenRequired: false,
        scope: params.scope,
      },
    },
  });
}

test("ta enforcement allows operations inside the granted scope", () => {
  const plan = createPlanWithEnforcement({
    scope: {
      allowedOperations: ["shell.exec"],
    },
  });

  assert.doesNotThrow(() => validateTaPlanEnforcement(plan));
});

test("ta enforcement blocks operations outside allowedOperations", () => {
  const plan = createPlanWithEnforcement({
    scope: {
      allowedOperations: ["read"],
    },
    operation: "exec",
  });

  assert.throws(() => validateTaPlanEnforcement(plan), /operation exec is not allowed by scope/);
});

test("ta enforcement blocks path candidates that fall outside granted pathPatterns", () => {
  const plan = createPlanWithEnforcement({
    scope: {
      allowedOperations: ["exec"],
      pathPatterns: ["workspace/src/**"],
    },
    input: {
      command: "npm test",
      cwd: "workspace\\tmp",
    },
    metadata: {
      executionGovernance: {
        family: "shell",
        operation: "exec",
        pathCandidates: ["workspace/tmp"],
      },
    },
  });

  assert.throws(() => validateTaPlanEnforcement(plan), /outside the granted scope/);
});

test("ta enforcement blocks inputs that match denyPatterns", () => {
  const plan = createPlanWithEnforcement({
    scope: {
      allowedOperations: ["exec"],
      denyPatterns: ["sudo *"],
    },
    input: {
      command: "sudo rm -rf /important",
    },
  });

  assert.throws(() => validateTaPlanEnforcement(plan), /denied .* by pattern sudo \*/);
});
