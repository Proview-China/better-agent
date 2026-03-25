import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createGoalSource } from "../goal/goal-source.js";
import { createAgentCoreRuntime } from "../runtime.js";
import {
  createTapBootstrapTmaProfile,
  createTapReviewerProfile,
} from "../ta-pool-model/index.js";
import type {
  CapabilityInvocationPlan,
  CapabilityLease,
} from "../capability-types/index.js";
import type { CapabilityCallIntent } from "../types/index.js";
import {
  createTapToolingCapabilityAdapter,
  registerTapToolingBaseline,
} from "./tap-tooling-adapter.js";

function createLease(bindingId: string): CapabilityLease {
  return {
    leaseId: `${bindingId}:lease`,
    capabilityId: `capability:${bindingId}`,
    bindingId,
    generation: 1,
    grantedAt: "2026-03-24T00:00:00.000Z",
    priority: "normal",
  };
}

function createPlan(overrides: Partial<CapabilityInvocationPlan>): CapabilityInvocationPlan {
  return {
    planId: overrides.planId ?? "plan-1",
    intentId: overrides.intentId ?? "intent-1",
    sessionId: overrides.sessionId ?? "session-1",
    runId: overrides.runId ?? "run-1",
    capabilityKey: overrides.capabilityKey ?? "repo.write",
    operation: overrides.operation ?? "repo.write",
    input: overrides.input ?? {},
    priority: overrides.priority ?? "normal",
    metadata: overrides.metadata,
    timeoutMs: overrides.timeoutMs,
    traceContext: overrides.traceContext,
    idempotencyKey: overrides.idempotencyKey,
  };
}

test("repo.write adapter writes inside the configured workspace root", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("repo.write", {
    workspaceRoot,
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "repo.write",
      operation: "write_text",
      input: {
        path: "notes/output.txt",
        content: "hello from repo.write",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["write", "repo.write"],
        },
      },
    }),
    createLease("binding.repo.write"),
  );

  const result = await adapter.execute(prepared);
  const written = await readFile(path.join(workspaceRoot, "notes/output.txt"), "utf8");

  assert.equal(result.status, "success");
  assert.equal(written, "hello from repo.write");
});

test("shell.restricted adapter rejects destructive commands before execution", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("shell.restricted", {
    workspaceRoot,
  });

  await assert.rejects(
    () =>
      adapter.prepare(
        createPlan({
          capabilityKey: "shell.restricted",
          operation: "exec",
          input: {
            command: "sudo",
            args: ["true"],
          },
          metadata: {
            grantedScope: {
              pathPatterns: ["workspace/**"],
              allowedOperations: ["exec", "shell.restricted"],
            },
          },
        }),
        createLease("binding.shell.restricted"),
      ),
    /rejects command sudo/i,
  );
});

test("skill.doc.generate adapter writes repo-local markdown content", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("skill.doc.generate", {
    workspaceRoot,
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "skill.doc.generate",
      operation: "generate_markdown",
      input: {
        path: "docs/ability/bootstrap-outline.md",
        title: "Bootstrap Tooling Outline",
        summary: "Wave 1 bootstrap baseline.",
        sections: [
          {
            heading: "Capabilities",
            body: ["repo.write", "shell.restricted", "test.run", "skill.doc.generate"],
          },
        ],
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["write", "mkdir", "skill.doc.generate"],
        },
      },
    }),
    createLease("binding.skill.doc.generate"),
  );

  const result = await adapter.execute(prepared);
  const written = await readFile(path.join(workspaceRoot, "docs/ability/bootstrap-outline.md"), "utf8");

  assert.equal(result.status, "success");
  assert.match(written, /^# Bootstrap Tooling Outline/m);
  assert.match(written, /## Capabilities/m);
});

test("test.run adapter executes an allowed test-oriented command", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("test.run", {
    workspaceRoot,
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "test.run",
      operation: "run",
      input: {
        command: "node",
        args: ["--version"],
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "test", "test.run"],
        },
      },
    }),
    createLease("binding.test.run"),
  );
  const result = await adapter.execute(prepared);

  assert.equal(result.status, "success");
  assert.match(String(result.output && (result.output as { stdout?: string }).stdout), /^v\d+/);
});

test("registerTapToolingBaseline makes B-group capabilities available to bootstrap TMA but not reviewer", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-runtime-"));
  const runtime = createAgentCoreRuntime({
    taProfile: createTapBootstrapTmaProfile(),
  });

  registerTapToolingBaseline(runtime, { workspaceRoot });

  const reviewer = createTapReviewerProfile();
  assert.equal(reviewer.baselineCapabilities?.includes("repo.write"), false);
  assert.equal(reviewer.baselineCapabilities?.includes("skill.doc.generate"), false);

  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-tap-tooling-runtime",
      sessionId: session.sessionId,
      userInput: "Use bootstrap tooling baseline.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  const intent: CapabilityCallIntent = {
    intentId: "intent-repo-write-runtime",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-24T00:00:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-repo-write-runtime",
      intentId: "intent-repo-write-runtime",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "repo.write",
      input: {
        path: "baseline/runtime.txt",
        content: "registered baseline write",
      },
      priority: "normal",
    },
  };

  const dispatched = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "bootstrap-tma",
    requestedTier: "B0",
    mode: "balanced",
    requestedScope: {
      pathPatterns: ["workspace/**"],
      allowedOperations: ["write", "repo.write"],
    },
    reason: "Bootstrap TMA should use repo.write directly from the baseline.",
  });

  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.dispatch?.prepared.capabilityKey, "repo.write");
  const written = await readFile(path.join(workspaceRoot, "baseline/runtime.txt"), "utf8");
  assert.equal(written, "registered baseline write");
});
