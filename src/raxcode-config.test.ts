import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureRaxcodeHomeScaffold,
  loadRaxcodeConfigFile,
  loadRaxcodeLiveChatModelPlan,
  loadRaxcodeTapOverride,
  loadResolvedEmbeddingConfig,
  loadResolvedProviderSlotConfig,
  resolveConfiguredWorkspaceRoot,
} from "./raxcode-config.js";

test("ensureRaxcodeHomeScaffold creates auth/config templates and state directories", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-home-"));
  const workspaceDir = path.join(rootDir, "workspace");
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  process.env.PRAXIS_WORKSPACE_ROOT = workspaceDir;

  const result = ensureRaxcodeHomeScaffold(workspaceDir);

  assert.ok(result.createdPaths.some((entry) => entry.endsWith("auth.json")));
  assert.ok(result.createdPaths.some((entry) => entry.endsWith("config.json")));
  const authRaw = await readFile(result.authPath, "utf8");
  const configRaw = await readFile(result.configPath, "utf8");
  const auth = JSON.parse(authRaw) as { authProfiles: unknown[] };
  const config = JSON.parse(configRaw) as { roleBindings: Record<string, unknown> };
  assert.equal(auth.authProfiles.length, 4);
  assert.equal(Object.keys(config.roleBindings).length, 15);

  delete process.env.RAXCODE_HOME;
  delete process.env.PRAXIS_WORKSPACE_ROOT;
});

test("loadRaxcodeLiveChatModelPlan resolves all 15 role plans from config", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-plan-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const config = loadRaxcodeConfigFile(rootDir);
  config.roleBindings["cmp.dispatcher"].overrides = {
    model: "gpt-5.4-mini",
    reasoning: "medium",
    maxOutputTokens: 321_000,
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const plan = loadRaxcodeLiveChatModelPlan(rootDir);

  assert.equal(plan.core.main.model, "gpt-5.4");
  assert.equal(plan.tap.toolReviewer.model, "gpt-5.4-mini");
  assert.equal(plan.mp.dispatcher.model, "gpt-5.4");
  assert.equal(plan.cmp.dispatcher.model, "gpt-5.4-mini");
  assert.equal(plan.cmp.dispatcher.maxOutputTokens, 321_000);
  assert.equal(plan.tui.main.reasoning, "low");

  delete process.env.RAXCODE_HOME;
});

test("loadResolvedProviderSlotConfig binds provider profile and auth profile through slots", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-provider-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as {
    authProfiles: Array<{ id: string; authMode?: string; credentials: { apiKey?: string } }>;
  };
  assert.equal(auth.authProfiles[0]?.authMode, "api_key");
  auth.authProfiles[0]!.credentials.apiKey = "test-openai";
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const resolved = loadResolvedProviderSlotConfig("openai", rootDir);

  assert.equal(resolved.profile.id, "profile.core.main");
  assert.equal(resolved.authProfile.id, "auth.openai.default");
  assert.equal(resolved.authProfile.credentials.apiKey, "test-openai");

  delete process.env.RAXCODE_HOME;
});

test("loadRaxcodeTapOverride reads persistent capability overrides and matrix", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-permissions-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const config = loadRaxcodeConfigFile(rootDir);
  config.permissions.capabilityOverrides = [
    {
      capabilitySelector: "git.push",
      policy: "human_gate",
      reason: "Always confirm before push",
    },
  ];
  config.permissions.requestedMode = "standard";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const override = loadRaxcodeTapOverride(rootDir);

  assert.equal(override.requestedMode, "standard");
  assert.equal(override.toolPolicyOverrides?.[0]?.capabilitySelector, "git.push");
  assert.equal(config.permissions.shared15ViewMatrix.length, 15);

  delete process.env.RAXCODE_HOME;
});

test("resolveConfiguredWorkspaceRoot prefers launch cwd over persisted default workspace", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-workspace-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const config = loadRaxcodeConfigFile(rootDir);
  config.workspace.defaultPath = "/tmp/praxis-default-workspace";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  delete process.env.PRAXIS_WORKSPACE_ROOT;
  process.env.INIT_CWD = "/tmp/launch-workspace";
  assert.equal(resolveConfiguredWorkspaceRoot(rootDir), "/tmp/launch-workspace");

  process.env.PRAXIS_WORKSPACE_ROOT = "/tmp/runtime-override";
  assert.equal(resolveConfiguredWorkspaceRoot(rootDir), "/tmp/runtime-override");

  delete process.env.PRAXIS_WORKSPACE_ROOT;
  delete process.env.INIT_CWD;
  assert.equal(resolveConfiguredWorkspaceRoot(rootDir), rootDir);

  delete process.env.RAXCODE_HOME;
});

test("loadResolvedEmbeddingConfig resolves dedicated embedding upstream config", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-raxcode-embedding-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as {
    authProfiles: Array<{ id: string; provider: string; authMode?: string; credentials: { apiKey?: string } }>;
  };
  auth.authProfiles.push({
    id: "auth.openai.embedding.default",
    provider: "openai",
    label: "Embedding Upstream",
    authMode: "api_key",
    credentials: {
      apiKey: "test-embedding-key",
    },
    meta: {
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as never);
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  config.embedding.baseURL = "https://viewpro.top/v1/embeddings";
  config.embedding.authProfileId = "auth.openai.embedding.default";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const resolved = loadResolvedEmbeddingConfig(rootDir);

  assert.equal(resolved?.model, "text-embedding-3-large");
  assert.equal(resolved?.apiKey, "test-embedding-key");
  assert.equal(resolved?.baseURL, "https://viewpro.top/v1");

  delete process.env.RAXCODE_HOME;
});
