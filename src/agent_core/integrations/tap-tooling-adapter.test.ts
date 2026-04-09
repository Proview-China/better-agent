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

function createFakeBrowserPlaywrightRuntime() {
  const calls: Array<{ toolName: string; arguments?: Record<string, unknown> }> = [];
  const uses: unknown[] = [];
  let lastNavigateUrl = "";

  return {
    calls,
    uses,
    runtime: {
      async use(input: unknown) {
        uses.push(input);
        return {
          connectionId: "browser-playwright-test",
          async tools() {
            return {
              tools: [
                { name: "browser_navigate", description: "Navigate to a page" },
                { name: "browser_snapshot", description: "Take a textual snapshot" },
                { name: "browser_take_screenshot", description: "Capture screenshot" },
              ],
            };
          },
          async call(toolInput: { toolName: string; arguments?: Record<string, unknown> }) {
            calls.push(toolInput);
            if (toolInput.toolName === "browser_navigate" && String(toolInput.arguments?.url ?? "").includes("google.com")) {
              lastNavigateUrl = String(toolInput.arguments?.url ?? "");
              return {
                content: [
                  {
                    type: "text",
                    text: [
                      "### Page",
                      "- Page URL: https://www.google.com/sorry/index?continue=https://www.google.com/search?q=test",
                      "- Page Title: Google sorry",
                      "### Snapshot",
                      "- [Snapshot](.playwright-mcp/page-google-sorry.yml)",
                    ].join("\n"),
                  },
                ],
              };
            }
            if (toolInput.toolName === "browser_navigate") {
              lastNavigateUrl = String(toolInput.arguments?.url ?? "");
            }
            if (toolInput.toolName === "browser_snapshot") {
              if (lastNavigateUrl.includes("google.com")) {
                return {
                  content: [
                    {
                      type: "text",
                      text: [
                        "### Page",
                        "- Page URL: https://www.google.com/sorry/index?continue=https://www.google.com/search?q=test",
                        "- Page Title: Google sorry",
                        "### Snapshot",
                        "- checkbox \"I'm not a robot\"",
                      ].join("\n"),
                    },
                  ],
                };
              }
              return {
                content: [
                  {
                    type: "text",
                    text: [
                      "### Page",
                      "- Page URL: https://example.com/",
                      "- Page Title: Example Domain",
                      "### Snapshot",
                      "- heading \"Example Domain\" [level=1]",
                    ].join("\n"),
                  },
                ],
              };
            }
            if (toolInput.toolName === "browser_take_screenshot") {
              return {
                content: [
                  {
                    type: "image",
                    mimeType: "image/png",
                    data: "cG5n",
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: `tool:${toolInput.toolName}`,
                },
              ],
            };
          },
          async disconnect() {
            return;
          },
        };
      },
    },
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
        args: ["init", "-b", "main"],
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

test("git.commit adapter stages explicit paths and creates a new commit with safety guards", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-git-commit-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 41;\n", "utf8");
  const shell = createTapToolingCapabilityAdapter("shell.restricted", { workspaceRoot });
  await shell.execute(await shell.prepare(
    createPlan({
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["init", "-b", "main"],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.commit.init"),
  ));
  await shell.execute(await shell.prepare(
    createPlan({
      planId: "plan-git-commit-bootstrap",
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
    createLease("binding.git.commit.bootstrap.add"),
  ));
  await shell.execute(await shell.prepare(
    createPlan({
      planId: "plan-git-commit-bootstrap-commit",
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
    createLease("binding.git.commit.bootstrap.commit"),
  ));

  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 42;\n", "utf8");
  const adapter = createTapToolingCapabilityAdapter("git.commit", { workspaceRoot });
  const committed = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "git.commit",
      operation: "commit",
      input: {
        cwd: ".",
        paths: ["src/sample.ts"],
        message: "Update answer constant for tooling test",
        authorName: "Praxis",
        authorEmail: "praxis@example.com",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "exec", "git.commit"],
        },
      },
    }),
    createLease("binding.git.commit"),
  ));
  assert.equal(committed.status, "success");
  assert.match(String((committed.output as { commitHash?: string }).commitHash), /^[0-9a-f]{40}$/);
  assert.equal((committed.output as { committedFiles?: string[] }).committedFiles?.[0], "src/sample.ts");

  const statusAdapter = createTapToolingCapabilityAdapter("git.status", { workspaceRoot });
  const status = await statusAdapter.execute(await statusAdapter.prepare(
    createPlan({
      planId: "plan-git-commit-post-status",
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
    createLease("binding.git.commit.status"),
  ));
  assert.equal(status.status, "success");
  assert.equal((status.output as { clean?: boolean }).clean, true);
});

test("git.push adapter pushes the current branch without force semantics", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-git-push-"));
  const remoteRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-git-remote-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "sample.ts"), "export const answer = 41;\n", "utf8");
  const shell = createTapToolingCapabilityAdapter("shell.restricted", { workspaceRoot });
  await shell.execute(await shell.prepare(
    createPlan({
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["init", "-b", "main"],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.push.init"),
  ));
  await shell.execute(await shell.prepare(
    createPlan({
      planId: "plan-git-push-remote-init",
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["init", "--bare", remoteRoot],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.push.remote.init"),
  ));
  await shell.execute(await shell.prepare(
    createPlan({
      planId: "plan-git-push-remote-add",
      capabilityKey: "shell.restricted",
      operation: "exec",
      input: {
        command: "git",
        args: ["remote", "add", "origin", remoteRoot],
        cwd: ".",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["exec", "shell.restricted"],
        },
      },
    }),
    createLease("binding.git.push.remote.add"),
  ));

  const commitAdapter = createTapToolingCapabilityAdapter("git.commit", { workspaceRoot });
  await commitAdapter.execute(await commitAdapter.prepare(
    createPlan({
      capabilityKey: "git.commit",
      operation: "commit",
      input: {
        cwd: ".",
        paths: ["src/sample.ts"],
        message: "Initial pushable commit",
        authorName: "Praxis",
        authorEmail: "praxis@example.com",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "exec", "git.commit"],
        },
      },
    }),
    createLease("binding.git.push.commit"),
  ));

  const pushAdapter = createTapToolingCapabilityAdapter("git.push", { workspaceRoot });
  const pushed = await pushAdapter.execute(await pushAdapter.prepare(
    createPlan({
      capabilityKey: "git.push",
      operation: "push",
      input: {
        cwd: ".",
        remote: "origin",
        branch: "main",
        setUpstream: true,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "write", "exec", "git.push"],
        },
      },
    }),
    createLease("binding.git.push"),
  ));
  assert.equal(pushed.status, "success");
  assert.equal((pushed.output as { remote?: string }).remote, "origin");
  assert.equal((pushed.output as { branch?: string }).branch, "main");
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

test("browser.playwright adapter normalizes navigate and screenshot actions through a shared Playwright runtime", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-"));
  const fake = createFakeBrowserPlaywrightRuntime();
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: fake.runtime,
  });

  const navigated = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "navigate",
      input: {
        action: "navigate",
        url: "https://example.com",
        allowedDomains: ["example.com"],
        provider: "openai",
        model: "gpt-5",
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "browser.playwright"],
        },
      },
    }),
    createLease("binding.browser.playwright"),
  ));
  assert.equal(navigated.status, "success");
  assert.equal((navigated.output as { toolName?: string }).toolName, "browser_navigate");
  assert.equal((navigated.output as { selectedBackend?: string }).selectedBackend, "openai-codex-browser-mcp-style");
  assert.equal(fake.calls[0]?.toolName, "browser_navigate");
  assert.equal(fake.calls[1]?.toolName, "browser_snapshot");
  assert.equal((navigated.output as { snapshotCaptured?: boolean }).snapshotCaptured, true);
  assert.match(String((navigated.output as { text?: string }).text), /Post-navigation snapshot/u);

  const screenshot = await adapter.execute(await adapter.prepare(
    createPlan({
      planId: "plan-browser-playwright-screenshot",
      capabilityKey: "browser.playwright",
      operation: "screenshot",
      input: {
        action: "screenshot",
        fullPage: true,
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "browser.playwright"],
        },
      },
    }),
    createLease("binding.browser.playwright.screenshot"),
  ));
  assert.equal(screenshot.status, "success");
  assert.match(String((screenshot.output as { imageUrls?: string[] }).imageUrls?.[0]), /^data:image\/png;base64,/);
  assert.equal(fake.calls[2]?.toolName, "browser_take_screenshot");
});

test("browser.playwright adapter blocks disallowed domains and file uploads by default", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-guard-"));
  const fake = createFakeBrowserPlaywrightRuntime();
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: fake.runtime,
  });

  await assert.rejects(
    () => adapter.prepare(
      createPlan({
        capabilityKey: "browser.playwright",
        operation: "navigate",
        input: {
          action: "navigate",
          url: "https://example.com",
          allowedDomains: ["praxis.dev"],
        },
        metadata: {
          grantedScope: {
            pathPatterns: ["workspace/**"],
            allowedOperations: ["read", "exec", "browser.playwright"],
          },
        },
      }),
      createLease("binding.browser.playwright.blocked-domain"),
    ),
    /blocked navigation/i,
  );

  await assert.rejects(
    () => adapter.prepare(
      createPlan({
        capabilityKey: "browser.playwright",
        operation: "raw",
        input: {
          action: "raw",
          toolName: "browser_file_upload",
          arguments: {
            paths: ["/tmp/file.txt"],
          },
        },
        metadata: {
          grantedScope: {
            pathPatterns: ["workspace/**"],
            allowedOperations: ["read", "exec", "browser.playwright"],
          },
        },
      }),
      createLease("binding.browser.playwright.blocked-upload"),
    ),
    /blocks file uploads/i,
  );

  await assert.rejects(
    () => adapter.prepare(
      createPlan({
        capabilityKey: "browser.playwright",
        operation: "raw",
        input: {
          action: "raw",
          toolName: "browser_run_code",
          arguments: {
            code: "async (page) => page.goto('https://example.com')",
          },
        },
        metadata: {
          grantedScope: {
            pathPatterns: ["workspace/**"],
            allowedOperations: ["read", "exec", "browser.playwright"],
          },
        },
      }),
      createLease("binding.browser.playwright.blocked-raw"),
    ),
    /blocked unreviewed MCP tool/i,
  );
});

test("browser.playwright adapter surfaces anti-bot interstitials as failed business outcomes", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-interstitial-"));
  const fake = createFakeBrowserPlaywrightRuntime();
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: fake.runtime,
  });

  const result = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "navigate",
      input: {
        action: "navigate",
        url: "https://www.google.com/search?q=test",
        allowedDomains: ["google.com", "www.google.com"],
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "browser.playwright"],
        },
      },
    }),
    createLease("binding.browser.playwright.interstitial"),
  ));

  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "browser_playwright_navigation_interstitial");
  assert.match(String((result.output as { pageUrl?: string }).pageUrl), /google\.com\/sorry/);
});

test("browser.playwright adapter can recover if an interstitial clears before the follow-up snapshot", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-interstitial-recovery-"));
  let navigateHitInterstitial = false;
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: {
      async use() {
        return {
          connectionId: "browser-playwright-recovery",
          async tools() {
            return { tools: [] };
          },
          async call(toolInput) {
            if (toolInput.toolName === "browser_navigate") {
              navigateHitInterstitial = true;
              return {
                content: [
                  {
                    type: "text",
                    text: [
                      "### Page",
                      "- Page URL: https://www.google.com/sorry/index?continue=https://www.google.com/search?q=test",
                      "- Page Title: Google sorry",
                    ].join("\n"),
                  },
                ],
              };
            }
            if (toolInput.toolName === "browser_wait_for") {
              return {
                content: [{ type: "text", text: "waited" }],
              };
            }
            if (toolInput.toolName === "browser_snapshot" && navigateHitInterstitial) {
              navigateHitInterstitial = false;
              return {
                content: [
                  {
                    type: "text",
                    text: [
                      "### Page",
                      "- Page URL: https://www.google.com/search?q=test",
                      "- Page Title: 国际金价 美元/盎司 - Google 搜索",
                      "### Snapshot",
                      "- heading \"国际金价 美元/盎司\" [level=1]",
                    ].join("\n"),
                  },
                ],
              };
            }
            return {
              content: [{ type: "text", text: "ok" }],
            };
          },
          async disconnect() {
            return;
          },
        };
      },
    },
  });

  const result = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "navigate",
      input: {
        action: "navigate",
        url: "https://www.google.com/search?q=test",
        allowedDomains: ["google.com", "www.google.com"],
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "browser.playwright"],
        },
      },
    }),
    createLease("binding.browser.playwright.interstitial-recovery"),
  ));

  assert.equal(result.status, "success");
  assert.equal((result.output as { interstitialRecovered?: boolean }).interstitialRecovered, true);
  assert.match(String((result.output as { pageUrl?: string }).pageUrl), /google\.com\/search/);
});

test("browser.playwright raw still allows reviewed MCP tools", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-raw-"));
  const fake = createFakeBrowserPlaywrightRuntime();
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: fake.runtime,
  });

  const hovered = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "raw",
      input: {
        action: "raw",
        toolName: "browser_hover",
        arguments: {
          ref: "node-1",
        },
      },
      metadata: {
        grantedScope: {
          pathPatterns: ["workspace/**"],
          allowedOperations: ["read", "exec", "browser.playwright"],
        },
      },
    }),
    createLease("binding.browser.playwright.raw-hover"),
  ));

  assert.equal(hovered.status, "success");
  assert.equal(fake.calls[0]?.toolName, "browser_hover");
});

test("browser.playwright adapter promotes reviewed actions out of raw mode", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-tap-tooling-browser-actions-"));
  const fake = createFakeBrowserPlaywrightRuntime();
  const adapter = createTapToolingCapabilityAdapter("browser.playwright", {
    workspaceRoot,
    browserPlaywrightRuntime: fake.runtime,
  });

  const scope = {
    pathPatterns: ["workspace/**"],
    allowedOperations: ["read", "exec", "browser.playwright"],
  };

  const press = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "press_key",
      input: {
        action: "press_key",
        key: "Enter",
      },
      metadata: { grantedScope: scope },
    }),
    createLease("binding.browser.playwright.press"),
  ));
  assert.equal(press.status, "success");
  assert.equal(fake.calls[0]?.toolName, "browser_press_key");

  const resize = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "resize",
      input: {
        action: "resize",
        width: 1440,
        height: 900,
      },
      metadata: { grantedScope: scope },
    }),
    createLease("binding.browser.playwright.resize"),
  ));
  assert.equal(resize.status, "success");
  assert.equal(fake.calls[1]?.toolName, "browser_resize");

  const select = await adapter.execute(await adapter.prepare(
    createPlan({
      capabilityKey: "browser.playwright",
      operation: "select_option",
      input: {
        action: "select_option",
        ref: "select-1",
        values: ["openai"],
      },
      metadata: { grantedScope: scope },
    }),
    createLease("binding.browser.playwright.select"),
  ));
  assert.equal(select.status, "success");
  assert.equal(fake.calls[2]?.toolName, "browser_select_option");
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
    "git.commit",
    "git.push",
    "code.diff",
    "browser.playwright",
    "skill.doc.generate",
    "write_todos",
  ]);
  assert.equal(result.packages.length, 14);
  assert.equal(result.manifests.length, 14);
  assert.equal(result.bindings.length, 14);
  assert.equal(result.activationFactoryRefs.length, 14);

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
