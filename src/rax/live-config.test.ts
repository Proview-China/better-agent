import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRaxcodeHomeScaffold, loadRaxcodeConfigFile } from "../raxcode-config.js";
import {
  loadLiveProviderConfig,
  loadOpenAILiveConfig,
  resolveOpenAIGenerationVariant,
  prepareResponsesParamsForOpenAIAuth,
} from "./live-config.js";

async function writeEnvFile(contents: string): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-"));
  const envPath = path.join(rootDir, "explicit.env");
  await writeFile(envPath, contents, "utf8");
  return envPath;
}

test("loadLiveProviderConfig reads explicit env file values when requested", async () => {
  const envPath = await writeEnvFile(`
OPENAI_API_KEY=test-openai
OPENAI_BASE_URL=https://example.com
OPENAI_MODEL=gpt-5.4
ANTHROPIC_API_KEY=test-anthropic
ANTHROPIC_BASE_URL=https://anthropic.example.com
ANTHROPIC_MODEL=claude-opus-4-6-thinking
DEEPMIND_API_KEY=test-deepmind
DEEPMIND_BASE_URL=https://deepmind.example.com
DEEPMIND_MODEL=gemini-3.1-pro-preview
  `.trim());

  const config = loadLiveProviderConfig(envPath);

  assert.equal(config.openai.model, "gpt-5.4");
  assert.equal(config.openai.baseURL, "https://example.com/v1");
  assert.equal(config.anthropic.model, "claude-opus-4-6-thinking");
  assert.equal(config.deepmind.model, "gemini-3.1-pro-preview");
});

test("loadLiveProviderConfig lets process env override explicit env file values", async () => {
  const envPath = await writeEnvFile(`
OPENAI_API_KEY=test-openai
OPENAI_BASE_URL=https://example.com
OPENAI_MODEL=gpt-5.4
ANTHROPIC_API_KEY=test-anthropic
ANTHROPIC_BASE_URL=https://anthropic.example.com
ANTHROPIC_MODEL=claude-opus-4-6-thinking
DEEPMIND_API_KEY=test-deepmind
DEEPMIND_BASE_URL=https://deepmind.example.com
DEEPMIND_MODEL=gemini-3.1-pro-preview
  `.trim());

  const originalEnv = {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  };

  try {
    process.env.OPENAI_MODEL = "gpt-5";
    process.env.ANTHROPIC_MODEL = "claude-override";

    const config = loadLiveProviderConfig(envPath);

    assert.equal(config.openai.model, "gpt-5");
    assert.equal(config.anthropic.model, "claude-override");
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("loadOpenAILiveConfig only requires OpenAI fields from explicit env file", async () => {
  const envPath = await writeEnvFile(`
OPENAI_API_KEY=test-openai
OPENAI_BASE_URL=https://openai.example.com
OPENAI_MODEL=gpt-5.4
OPENAI_API_STYLE=responses
  `.trim());

  const config = loadOpenAILiveConfig(envPath);

  assert.equal(config.apiKey, "test-openai");
  assert.equal(config.baseURL, "https://openai.example.com/v1");
  assert.equal(config.model, "gpt-5.4");
  assert.equal(config.apiStyle, "responses");
});

test("loadLiveProviderConfig reads auth.json/config.json as the primary runtime source", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-json-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as {
    authProfiles: Array<{ id: string; credentials: { apiKey?: string } }>;
  };
  for (const profile of auth.authProfiles) {
    if (profile.id === "auth.openai.default") {
      profile.credentials.apiKey = "json-openai-key";
    }
    if (profile.id === "auth.anthropic.default") {
      profile.credentials.apiKey = "json-anthropic-key";
    }
    if (profile.id === "auth.anthropic.alt") {
      profile.credentials.apiKey = "json-anthropic-alt-key";
    }
    if (profile.id === "auth.deepmind.default") {
      profile.credentials.apiKey = "json-deepmind-key";
    }
  }
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  config.providerSlots.openai = "profile.tap.reviewer";
  config.providerSlots.anthropicAlt = "profile.provider.anthropic.alt";
  const openaiReviewer = config.profiles.find((profile) => profile.id === "profile.tap.reviewer");
  assert.ok(openaiReviewer);
  openaiReviewer.route.baseURL = "https://json-openai.example.com";
  openaiReviewer.model = "gpt-json-reviewer";
  const deepmindDefault = config.profiles.find((profile) => profile.id === "profile.provider.deepmind.default");
  assert.ok(deepmindDefault);
  deepmindDefault.route.baseURL = "https://json-deepmind.example.com";
  deepmindDefault.model = "gemini-json";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const providerConfig = loadLiveProviderConfig();

  assert.equal(providerConfig.openai.apiKey, "json-openai-key");
  assert.equal(providerConfig.openai.baseURL, "https://json-openai.example.com/v1");
  assert.equal(providerConfig.openai.model, "gpt-5.4");
  assert.equal(providerConfig.anthropic.apiKey, "json-anthropic-key");
  assert.equal(providerConfig.anthropicAlt?.apiKey, "json-anthropic-alt-key");
  assert.equal(providerConfig.deepmind.model, "gemini-json");

  delete process.env.RAXCODE_HOME;
});

test("loadOpenAILiveConfig maps chatgpt_oauth profiles onto bearer auth plus account header", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-oauth-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as {
    activeAuthProfileIdBySlot: Record<string, string>;
    authProfiles: Array<Record<string, unknown>>;
  };
  auth.authProfiles.push({
    id: "auth.openai.official",
    provider: "openai",
    label: "OpenAI Official",
    authMode: "chatgpt_oauth",
    credentials: {
      accessToken: "eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDAsImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyIsImNoYXRncHRfYWNjb3VudF9pZCI6ImFjY3Qtb2ZmaWNpYWwifX0.",
      refreshToken: "refresh-token",
      idToken: "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjQxMDI0NDQ4MDAsImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyIsImNoYXRncHRfdXNlcl9pZCI6InVzZXItMSIsImNoYXRncHRfYWNjb3VudF9pZCI6ImFjY3Qtb2ZmaWNpYWwifX0.",
      accountId: "acct-official",
    },
    meta: {
      source: "oauth",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
      chatgptPlanType: "pro",
      chatgptAccountId: "acct-official",
      accessTokenExpiresAt: "2099-12-31T00:00:00.000Z",
    },
  });
  auth.activeAuthProfileIdBySlot.openai = "auth.openai.official";
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  const coreProfile = config.profiles.find((profile) => profile.id === "profile.core.main");
  assert.ok(coreProfile);
  coreProfile.authProfileId = "auth.openai.official";
  coreProfile.route.baseURL = "https://chatgpt.com/backend-api/codex";
  coreProfile.model = "gpt-5.4";
  coreProfile.reasoningEffort = "medium";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const openaiConfig = loadOpenAILiveConfig("core.main");

  assert.equal(openaiConfig.authMode, "chatgpt_oauth");
  assert.equal(openaiConfig.accountId, "acct-official");
  assert.equal(openaiConfig.defaultHeaders?.["chatgpt-account-id"], "acct-official");
  assert.equal(openaiConfig.planType, "pro");
  assert.equal(openaiConfig.model, "gpt-5.4");

  delete process.env.RAXCODE_HOME;
});

test("loadOpenAILiveConfig reports friendly JSON guidance when auth/config are incomplete", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-incomplete-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  let captured: unknown;
  try {
    loadOpenAILiveConfig();
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof Error);
  assert.match(captured.message, /Raxcode 全局配置未完成/u);
  assert.match(captured.message, /auth\.json/u);
  assert.match(captured.message, /config\.json/u);

  delete process.env.RAXCODE_HOME;
});

test("loadOpenAILiveConfig resolves OpenAI auth and baseURL from the requested role profile", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-role-routes-"));
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  ensureRaxcodeHomeScaffold(rootDir);

  const authPath = path.join(process.env.RAXCODE_HOME!, "auth.json");
  const configPath = path.join(process.env.RAXCODE_HOME!, "config.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as {
    authProfiles: Array<Record<string, unknown>>;
  };
  const defaultAuth = auth.authProfiles.find((entry) => entry.id === "auth.openai.default") as {
    credentials: { apiKey?: string };
  } | undefined;
  assert.ok(defaultAuth);
  defaultAuth.credentials.apiKey = "gmn-openai-key";
  auth.authProfiles.push({
    id: "auth.openai.official",
    provider: "openai",
    label: "OpenAI Official",
    authMode: "chatgpt_oauth",
    credentials: {
      accessToken: "official-access-token",
      refreshToken: "official-refresh-token",
      accountId: "acct-role-test",
    },
    meta: {
      source: "oauth",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      chatgptPlanType: "plus",
      chatgptAccountId: "acct-role-test",
    },
  });
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  const config = loadRaxcodeConfigFile(rootDir);
  const coreProfile = config.profiles.find((profile) => profile.id === "profile.core.main");
  const mpIcmaProfile = config.profiles.find((profile) => profile.id === "profile.mp.icma");
  assert.ok(coreProfile);
  assert.ok(mpIcmaProfile);
  coreProfile.authProfileId = "auth.openai.official";
  coreProfile.route.baseURL = "https://chatgpt.com/backend-api/codex";
  coreProfile.model = "gpt-5.4";
  coreProfile.reasoningEffort = "high";
  mpIcmaProfile.authProfileId = "auth.openai.default";
  mpIcmaProfile.route.baseURL = "https://gmn.chuangzuoli.com";
  mpIcmaProfile.model = "gpt-5.4-mini";
  mpIcmaProfile.reasoningEffort = "none";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const coreConfig = loadOpenAILiveConfig("core.main");
  const mpConfig = loadOpenAILiveConfig("mp.icma");

  assert.equal(coreConfig.authMode, "chatgpt_oauth");
  assert.equal(coreConfig.baseURL, "https://chatgpt.com/backend-api/codex");
  assert.equal(coreConfig.model, "gpt-5.4");
  assert.equal(coreConfig.reasoningEffort, "high");
  assert.equal(coreConfig.defaultHeaders?.["chatgpt-account-id"], "acct-role-test");

  assert.equal(mpConfig.authMode, "api_key");
  assert.equal(mpConfig.apiKey, "gmn-openai-key");
  assert.equal(mpConfig.baseURL, "https://gmn.chuangzuoli.com/v1");
  assert.equal(mpConfig.model, "gpt-5.4-mini");
  assert.equal(mpConfig.reasoningEffort, "none");

  delete process.env.RAXCODE_HOME;
});

test("prepareResponsesParamsForOpenAIAuth maps ChatGPT subscription fast tier onto priority", () => {
  const params = prepareResponsesParamsForOpenAIAuth(
    {
      authMode: "chatgpt_oauth",
      baseURL: "https://chatgpt.com/backend-api/codex",
    },
    {
      model: "gpt-5.4",
      input: "Reply with exactly OK.",
      service_tier: "fast",
      stream: false,
    },
    "Reply with exactly OK.",
  );

  assert.equal(params.service_tier, "priority");
  assert.equal(params.stream, true);
});

test("prepareResponsesParamsForOpenAIAuth maps gmn fast tier onto priority without forcing official-only normalization", () => {
  const params = prepareResponsesParamsForOpenAIAuth(
    {
      authMode: "api_key",
      baseURL: "https://gmn.chuangzuoli.com/v1",
    },
    {
      model: "gpt-5.4",
      input: "Reply with OK only.",
      service_tier: "fast",
      stream: false,
      max_output_tokens: 32,
    },
    "Reply with OK only.",
  );

  assert.equal(params.service_tier, "priority");
  assert.equal(params.stream, false);
  assert.equal(params.max_output_tokens, 32);
});

test("resolveOpenAIGenerationVariant follows apiStyle and route defaults", () => {
  assert.equal(
    resolveOpenAIGenerationVariant({
      baseURL: "https://chatgpt.com/backend-api/codex",
      apiStyle: undefined,
    }),
    "responses",
  );
  assert.equal(
    resolveOpenAIGenerationVariant({
      baseURL: "https://viewpro.top/v1",
      apiStyle: "chat/completions",
    }),
    "chat_completions_compat",
  );
  assert.equal(
    resolveOpenAIGenerationVariant({
      baseURL: "https://gmn.chuangzuoli.com/v1",
      apiStyle: "responses",
    }),
    "responses",
  );
});
