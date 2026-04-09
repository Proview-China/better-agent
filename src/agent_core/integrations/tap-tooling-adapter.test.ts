import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
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

test("code.edit adapter applies exact replacements and create-file semantics", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const filePath = path.join(workspaceRoot, "src", "sample.ts");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "const answer = 41;\nconst answer = 41;\n", "utf8");

  const adapter = createTapToolingCapabilityAdapter("code.edit", {
    workspaceRoot,
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "code.edit",
      operation: "edit_text",
      input: {
        file_path: "src/sample.ts",
        old_string: "const answer = 41;",
        new_string: "const answer = 42;",
        allow_multiple: true,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "mkdir", "code.edit"],
        },
      },
    }),
    createLease("binding.code.edit"),
  );

  const result = await adapter.execute(prepared);
  const written = await readFile(filePath, "utf8");
  assert.equal(result.status, "success");
  assert.equal((result.output as { replacedCount?: number }).replacedCount, 2);
  assert.match(written, /42/);

  const createPrepared = await adapter.prepare(
    createPlan({
      planId: "plan-code-edit-create",
      capabilityKey: "code.edit",
      operation: "edit_text",
      input: {
        path: "notes/new.txt",
        old_string: "",
        new_string: "hello from code.edit\n",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "mkdir", "code.edit"],
        },
      },
    }),
    createLease("binding.code.edit.create"),
  );
  const created = await adapter.execute(createPrepared);
  assert.equal(created.status, "success");
  assert.equal((created.output as { created?: boolean }).created, true);
  assert.equal(
    await readFile(path.join(workspaceRoot, "notes/new.txt"), "utf8"),
    "hello from code.edit\n",
  );
});

test("code.patch adapter applies codex-style add, update, and delete operations", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "obsolete"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 41;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete", "old.txt"), "remove me\n", "utf8");

  const adapter = createTapToolingCapabilityAdapter("code.patch", {
    workspaceRoot,
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "code.patch",
      operation: "apply_patch",
      input: {
        patch: [
          "*** Begin Patch",
          "*** Add File: notes/added.txt",
          "+hello",
          "*** Update File: src/sample.ts",
          "@@",
          "-export const answer = 41;",
          "+export const answer = 42;",
          "*** Delete File: obsolete/old.txt",
          "*** End Patch",
          "",
        ].join("\n"),
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "delete", "mkdir", "code.patch"],
        },
      },
    }),
    createLease("binding.code.patch"),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { operationCount?: number }).operationCount, 3);
  assert.equal(
    await readFile(path.join(workspaceRoot, "notes", "added.txt"), "utf8"),
    "hello",
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, "src", "sample.ts"), "utf8"),
    "export const answer = 42;\n",
  );
  await assert.rejects(
    () => readFile(path.join(workspaceRoot, "obsolete", "old.txt"), "utf8"),
    /ENOENT/,
  );
});

test("shell.session adapter supports start, write, poll, and terminate", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("shell.session", {
    workspaceRoot,
  });

  const started = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "shell.session",
      operation: "start",
      input: {
        action: "start",
        command: "cat",
        cwd: ".",
        yield_time_ms: 50,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.session"],
        },
      },
    }),
    createLease("binding.shell.session"),
  ));
  assert.equal(started.status, "success");
  const sessionId = (started.output as { sessionId?: string }).sessionId;
  assert.ok(sessionId);
  assert.equal((started.output as { running?: boolean }).running, true);

  const written = await adapter.execute(await adapter.prepare(
    createPlan({
      planId: "plan-shell-session-write",
      capabilityKey: "shell.session",
      operation: "write_stdin",
      input: {
        action: "write",
        sessionId,
        chars: "hello\n",
        yield_time_ms: 50,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.session"],
        },
      },
    }),
    createLease("binding.shell.session.write"),
  ));
  assert.equal(written.status, "success");
  assert.match(String((written.output as { stdout?: string }).stdout), /hello/);

  const terminated = await adapter.execute(await adapter.prepare(
    createPlan({
      planId: "plan-shell-session-terminate",
      capabilityKey: "shell.session",
      operation: "terminate",
      input: {
        action: "terminate",
        sessionId,
        yield_time_ms: 50,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.session"],
        },
      },
    }),
    createLease("binding.shell.session.terminate"),
  ));
  assert.equal(terminated.status, "success");
  assert.equal((terminated.output as { running?: boolean }).running, false);
});

test("git.status and git.diff adapters inspect workspace git state in bounded form", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-git-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 41;\n", "utf8");
  const init = createTapToolingCapabilityAdapter("shell.restricted", {
    workspaceRoot,
  });
  await init.execute(await init.prepare(
    createPlan({
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["init"],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.init"),
  ));
  await init.execute(await init.prepare(
    createPlan({
      planId: "plan-git-add",
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["add", "."],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.add"),
  ));
  await init.execute(await init.prepare(
    createPlan({
      planId: "plan-git-commit",
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["-c", "user.name=Praxis", "-c", "user.email=praxis@example.com", "commit", "-m", "init"],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.commit"),
  ));
  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 42;\n", "utf8");

  const statusAdapter = createTapToolingCapabilityAdapter("git.status", { workspaceRoot });
  const status = await statusAdapter.execute(await statusAdapter.prepare(
    createPlan({
      capabilityKey: "git.status",
      operation: "status",
      input: { cwd: "." },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "git.status"],
        },
      },
    }),
    createLease("binding.git.status"),
  ));
  assert.equal(status.status, "success");
  assert.equal((status.output as { clean?: boolean }).clean, false);

  const diffAdapter = createTapToolingCapabilityAdapter("git.diff", { workspaceRoot });
  const diff = await diffAdapter.execute(await diffAdapter.prepare(
    createPlan({
      capabilityKey: "git.diff",
      operation: "diff",
      input: { cwd: ".", path: "src/sample.ts" },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "git.diff"],
        },
      },
    }),
    createLease("binding.git.diff"),
  ));
  assert.equal(diff.status, "success");
  assert.match(String((diff.output as { diff?: string }).diff), /answer = 42/);
});

test("code.diff adapter returns unified diff for before/after text and write_todos stores structured list", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const codeDiffAdapter = createTapToolingCapabilityAdapter("code.diff", { workspaceRoot });
  const diff = await codeDiffAdapter.execute(await codeDiffAdapter.prepare(
    createPlan({
      capabilityKey: "code.diff",
      operation: "diff",
      input: {
        before: "const answer = 41;\n",
        after: "const answer = 42;\n",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "code.diff"],
        },
      },
    }),
    createLease("binding.code.diff"),
  ));
  assert.equal(diff.status, "success");
  assert.match(String((diff.output as { diff?: string }).diff), /answer = 42/);

  const todosAdapter = createTapToolingCapabilityAdapter("write_todos", { workspaceRoot });
  const todos = await todosAdapter.execute(await todosAdapter.prepare(
    createPlan({
      capabilityKey: "write_todos",
      operation: "set_todos",
      input: {
        todos: [
          { description: "inspect git state", status: "completed" },
          { description: "wire shell session", status: "in_progress" },
        ],
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["write_todos"],
        },
      },
    }),
    createLease("binding.write_todos"),
  ));
  assert.equal(todos.status, "success");
  assert.equal((todos.output as { count?: number }).count, 2);
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
  assert.equal((result.metadata as { commandKind?: string } | undefined)?.commandKind, "test");
});

test("shell.restricted adapter returns bounded output and execution hints", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  const adapter = createTapToolingCapabilityAdapter("shell.restricted", {
    workspaceRoot,
    commandRunner: async () => ({
      exitCode: 0,
      signal: null,
      stdout: "A".repeat(80),
      stderr: "",
      timedOut: false,
    }),
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "rg",
        args: ["Praxis", "src"],
        runInBackground: true,
        tty: true,
        maxOutputChars: 30,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.shell.restricted"),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { stdoutTruncated?: boolean }).stdoutTruncated, true);
  assert.equal((result.output as { backgroundRequested?: boolean }).backgroundRequested, true);
  assert.equal((result.output as { backgroundApplied?: boolean }).backgroundApplied, false);
  assert.equal((result.output as { ttyRequested?: boolean }).ttyRequested, true);
  assert.equal((result.metadata as { commandKind?: string } | undefined)?.commandKind, "search");
  assert.match(String((result.output as { commandSummary?: string }).commandSummary), /^rg Praxis src$/);
});

test("shell.restricted adapter accepts vendor-style shell aliases and array commands", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-"));
  let captured: { cwd: string; timeoutMs: number; runInBackground: boolean; description?: string; args: string[] } | undefined;
  const adapter = createTapToolingCapabilityAdapter("shell.restricted", {
    workspaceRoot,
    commandRunner: async (input) => {
      captured = {
        cwd: input.relativeWorkspaceCwd,
        timeoutMs: input.timeoutMs,
        runInBackground: input.runInBackground,
        description: input.description,
        args: input.args,
      };
      return {
        exitCode: 0,
        signal: null,
        stdout: "done",
        stderr: "",
        timedOut: false,
      };
    },
  });

  const prepared = await adapter.prepare(
    createPlan({
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: ["rg", "Praxis", "src"],
        dir_path: ".",
        timeout_ms: 4321,
        is_background: true,
        description: "search praxis references",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.shell.restricted"),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.deepEqual(captured, {
    cwd: ".",
    timeoutMs: 4321,
    runInBackground: true,
    description: "search praxis references",
    args: ["Praxis", "src"],
  });
});

test("registerTapToolingBaseline makes B-group capabilities available to bootstrap TMA but not reviewer", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-runtime-"));
  const runtime = createAgentCoreRuntime({
    taProfile: createTapBootstrapTmaProfile(),
  });

  const result = registerTapToolingBaseline(runtime, { workspaceRoot });

  assert.deepEqual(result.capabilityKeys, [
    "repo.write",
    "code.edit",
    "code.patch",
    "shell.restricted",
    "shell.session",
    "test.run",
    "git.status",
    "git.diff",
    "code.diff",
    "skill.doc.generate",
    "write_todos",
  ]);
  assert.equal(result.packages.length, 11);
  assert.equal(result.manifests.length, 11);
  assert.equal(result.bindings.length, 11);
  assert.equal(result.activationFactoryRefs.length, 11);

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
