import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRaxcodeHomeScaffold, loadRaxcodeAuthFile, loadRaxcodeConfigFile } from "./raxcode-config.js";
import {
  getOpenAIAuthStatus,
  loginOpenAIWithApiKey,
  logoutOpenAIAuth,
  refreshOpenAIOAuthIfNeeded,
} from "./raxcode-openai-auth.js";

test("loginOpenAIWithApiKey persists api_key mode on the default profile", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-openai-api-key-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const status = loginOpenAIWithApiKey("sk-test-key", rootDir);
  const auth = loadRaxcodeAuthFile(rootDir);
  const profile = auth.authProfiles.find((entry) => entry.id === "auth.openai.default");

  assert.equal(status.authMode, "api_key");
  assert.ok(profile);
  assert.equal(profile?.authMode, "api_key");
  assert.equal(profile?.credentials.apiKey, "sk-test-key");

  delete process.env.RAXCODE_HOME;
});

test("refreshOpenAIOAuthIfNeeded refreshes an expiring stored official profile", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-openai-refresh-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = loadRaxcodeAuthFile(rootDir);
  auth.activeAuthProfileIdBySlot.openai = "auth.openai.official";
  auth.authProfiles.push({
    id: "auth.openai.official",
    provider: "openai",
    label: "OpenAI Official",
    authMode: "chatgpt_oauth",
    credentials: {
      accessToken: "eyJhbGciOiJub25lIn0.eyJleHAiOjEwLCJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdC0xIn19.",
      refreshToken: "refresh-token",
      idToken: "eyJhbGciOiJub25lIn0.eyJleHAiOjEwLCJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9wbGFuX3R5cGUiOiJwbHVzIiwiY2hhdGdwdF91c2VyX2lkIjoidXNlci0xIiwiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdC0xIn19.",
      accountId: "acct-1",
    },
    meta: {
      source: "oauth",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
      accessTokenExpiresAt: "2000-01-01T00:00:00.000Z",
      chatgptAccountId: "acct-1",
      chatgptPlanType: "plus",
    },
  });
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  config.providerSlots.openai = "profile.provider.openai.official";
  config.profiles.push({
    id: "profile.provider.openai.official",
    provider: "openai",
    label: "OpenAI Official",
    authProfileId: "auth.openai.official",
    route: {
      baseURL: "https://chatgpt.com/backend-api/codex",
      apiStyle: "responses",
    },
    model: "gpt-5.4",
    enabled: true,
  });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    access_token: "eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDAsImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJjaGF0Z3B0X2FjY291bnRfaWQiOiJhY2N0LTEifX0.",
    refresh_token: "refresh-token-2",
    id_token: "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InJlZnJlc2hlZEBleGFtcGxlLmNvbSIsImV4cCI6NDEwMjQ0NDgwMCwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfcGxhbl90eXBlIjoicHJvIiwiY2hhdGdwdF91c2VyX2lkIjoidXNlci0xIiwiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdC0xIn19.",
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })) as typeof fetch;

  try {
    const refreshed = await refreshOpenAIOAuthIfNeeded(rootDir);
    assert.equal(refreshed, true);
    const status = getOpenAIAuthStatus(rootDir);
    assert.equal(status.authMode, "chatgpt_oauth");
    assert.equal(status.planType, "pro");
    assert.equal(status.accountId, "acct-1");
  } finally {
    globalThis.fetch = originalFetch;
  }

  delete process.env.RAXCODE_HOME;
});

test("logoutOpenAIAuth removes the stored official profile and falls back to default routing", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-openai-logout-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = loadRaxcodeAuthFile(rootDir);
  auth.activeAuthProfileIdBySlot.openai = "auth.openai.official";
  auth.authProfiles.push({
    id: "auth.openai.official",
    provider: "openai",
    label: "OpenAI Official",
    authMode: "chatgpt_oauth",
    credentials: {
      accessToken: "token",
      refreshToken: "refresh",
      idToken: "id",
      accountId: "acct-1",
    },
    meta: {
      source: "oauth",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
    },
  });
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  config.providerSlots.openai = "profile.provider.openai.official";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const status = logoutOpenAIAuth(rootDir);
  const nextAuthRaw = JSON.parse(await readFile(authPath, "utf8")) as {
    authProfiles: Array<{ id: string }>;
    activeAuthProfileIdBySlot: Record<string, string>;
  };

  assert.equal(status.authMode, "none");
  assert.equal(nextAuthRaw.activeAuthProfileIdBySlot.openai, "auth.openai.default");
  assert.equal(nextAuthRaw.authProfiles.some((entry) => entry.id === "auth.openai.official"), false);

  delete process.env.RAXCODE_HOME;
});
