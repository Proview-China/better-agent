import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { hasConfiguredPrimaryModelAuth, resolveRaxodeCliCommand, resolveRaxodeLaunchPlan } from "./raxcode-cli.js";
import { ensureRaxcodeHomeScaffold } from "./raxcode-config.js";

test("resolveRaxodeCliCommand defaults bare raxode to tui", () => {
  assert.deepEqual(resolveRaxodeCliCommand([]), {
    command: "tui",
    rest: [],
  });
  assert.deepEqual(resolveRaxodeCliCommand(["--help"]), {
    command: "help",
    rest: [],
  });
  assert.deepEqual(resolveRaxodeCliCommand(["status"]), {
    command: "status",
    rest: [],
  });
});

test("resolveRaxodeLaunchPlan uses tsx and source entrypoints in dev/source mode", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxode-cli-source-"));
  const moduleDir = path.join(rootDir, "src");
  const workspaceDir = path.join(rootDir, "workspace");
  await mkdir(path.join(moduleDir, "agent_core"), { recursive: true });
  await mkdir(path.join(rootDir, "node_modules", ".bin"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(path.join(moduleDir, "agent_core", "direct-tui.tsx"), "", "utf8");
  await writeFile(path.join(moduleDir, "agent_core", "live-agent-chat.ts"), "", "utf8");

  const previousWorkspaceRoot = process.env.PRAXIS_WORKSPACE_ROOT;
  const previousInitCwd = process.env.INIT_CWD;
  delete process.env.PRAXIS_WORKSPACE_ROOT;
  delete process.env.INIT_CWD;
  try {
    const plan = resolveRaxodeLaunchPlan("tui", ["--once", "hello"], {
      cwd: workspaceDir,
      env: { TEST_ENV: "1" },
      moduleDir,
    });

    assert.equal(plan.command, path.join(rootDir, "node_modules", ".bin", "tsx"));
    assert.deepEqual(plan.args, [
      path.join(moduleDir, "agent_core", "direct-tui.tsx"),
      "--once",
      "hello",
    ]);
    assert.equal(plan.cwd, workspaceDir);
    assert.equal(plan.env.PRAXIS_APP_ROOT, rootDir);
    assert.equal(plan.env.PRAXIS_WORKSPACE_ROOT, workspaceDir);
    assert.equal(plan.env.TEST_ENV, "1");
  } finally {
    if (previousWorkspaceRoot === undefined) {
      delete process.env.PRAXIS_WORKSPACE_ROOT;
    } else {
      process.env.PRAXIS_WORKSPACE_ROOT = previousWorkspaceRoot;
    }
    if (previousInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previousInitCwd;
    }
  }
});

test("resolveRaxodeLaunchPlan uses node and dist entrypoints in compiled mode", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxode-cli-dist-"));
  const moduleDir = path.join(rootDir, "dist");
  const workspaceDir = path.join(rootDir, "workspace");
  await mkdir(path.join(moduleDir, "agent_core"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(path.join(moduleDir, "agent_core", "live-agent-chat.js"), "", "utf8");

  const previousWorkspaceRoot = process.env.PRAXIS_WORKSPACE_ROOT;
  const previousInitCwd = process.env.INIT_CWD;
  delete process.env.PRAXIS_WORKSPACE_ROOT;
  delete process.env.INIT_CWD;
  try {
    const plan = resolveRaxodeLaunchPlan("chat", ["--ui=direct"], {
      cwd: workspaceDir,
      moduleDir,
    });

    assert.equal(plan.command, process.execPath);
    assert.deepEqual(plan.args, [
      path.join(moduleDir, "agent_core", "live-agent-chat.js"),
      "--ui=direct",
    ]);
    assert.equal(plan.cwd, workspaceDir);
    assert.equal(plan.env.PRAXIS_APP_ROOT, rootDir);
    assert.equal(plan.env.PRAXIS_WORKSPACE_ROOT, workspaceDir);
  } finally {
    if (previousWorkspaceRoot === undefined) {
      delete process.env.PRAXIS_WORKSPACE_ROOT;
    } else {
      process.env.PRAXIS_WORKSPACE_ROOT = previousWorkspaceRoot;
    }
    if (previousInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previousInitCwd;
    }
  }
});

test("hasConfiguredPrimaryModelAuth is false when the primary config is incomplete but ignores missing embedding config", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxode-cli-auth-"));
  const previousHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  try {
    ensureRaxcodeHomeScaffold(rootDir);
    assert.equal(hasConfiguredPrimaryModelAuth(), false);
  } finally {
    if (previousHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = previousHome;
    }
  }
});

test("hasConfiguredPrimaryModelAuth is true when the core OpenAI route is configured", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxode-cli-auth-configured-"));
  const previousHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  try {
    ensureRaxcodeHomeScaffold(rootDir);
    const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
    const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
    const auth = JSON.parse(await readFile(authPath, "utf8")) as {
      authProfiles: Array<{ id: string; credentials: { apiKey?: string } }>;
    };
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      profiles: Array<{ id: string; route: { baseURL: string }; model: string }>;
    };
    for (const profile of auth.authProfiles) {
      if (profile.id === "auth.openai.default") {
        profile.credentials.apiKey = "sk-test-openai";
      }
    }
    const coreProfile = config.profiles.find((entry) => entry.id === "profile.core.main");
    assert.ok(coreProfile);
    coreProfile.route.baseURL = "https://api.example.com/v1";
    coreProfile.model = "gpt-5.4";
    await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    assert.equal(hasConfiguredPrimaryModelAuth(), true);
  } finally {
    if (previousHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = previousHome;
    }
  }
});
