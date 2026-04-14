import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyAnthropicEndpointLoginConfig,
  applyChatGptSubscriptionRoleRouting,
  applyEmbeddingLoginConfig,
  applyOpenAICompatibleApiLoginConfig,
  maskSecretForDisplay,
  normalizeAnthropicBaseURL,
  normalizeEmbeddingBaseURL,
  normalizeGeminiCompatibleBaseURL,
  normalizeOpenAICompatibleBaseURL,
} from "./raxode-login-wizard.js";
import {
  loadRaxcodeAuthFile,
  loadRaxcodeConfigFile,
  writeRaxcodeAuthFile,
} from "./raxcode-config.js";
import { OPENAI_OFFICIAL_AUTH_PROFILE_ID } from "./raxcode-openai-auth.js";

function withTempHome<T>(rootDir: string, fn: () => T): T {
  const previousHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = path.join(rootDir, ".raxcode");
  try {
    return fn();
  } finally {
    if (previousHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = previousHome;
    }
  }
}

test("maskSecretForDisplay keeps the first seven and last four characters", () => {
  assert.equal(maskSecretForDisplay("sk-12345678901234"), "sk-1234******1234");
  assert.equal(maskSecretForDisplay("short"), "short");
  assert.equal(maskSecretForDisplay(""), "");
});

test("normalize login base URLs trims endpoint suffixes", () => {
  assert.equal(normalizeOpenAICompatibleBaseURL("https://example.com/v1/responses"), "https://example.com/v1");
  assert.equal(normalizeOpenAICompatibleBaseURL("https://example.com"), "https://example.com/v1");
  assert.equal(normalizeGeminiCompatibleBaseURL("https://example.com/v1/chat/completions"), "https://example.com/v1");
  assert.equal(normalizeGeminiCompatibleBaseURL("https://example.com"), "https://example.com/v1");
  assert.equal(normalizeAnthropicBaseURL("https://anthropic.example/v1/messages"), "https://anthropic.example");
  assert.equal(normalizeEmbeddingBaseURL("https://embed.example/v1/embeddings"), "https://embed.example/v1");
});

test("applyOpenAICompatibleApiLoginConfig rewires every role profile to the provided upstream", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-login-openai-compatible-"));
  withTempHome(rootDir, () => {
    applyOpenAICompatibleApiLoginConfig("https://gateway.example.com", "sk-test-openai-compatible", rootDir);

    const authFile = loadRaxcodeAuthFile(rootDir);
    const configFile = loadRaxcodeConfigFile(rootDir);
    assert.equal(authFile.activeAuthProfileIdBySlot.openai, "auth.openai.default");
    assert.equal(authFile.authProfiles.find((entry) => entry.id === "auth.openai.default")?.credentials.apiKey, "sk-test-openai-compatible");
    for (const roleId of Object.keys(configFile.roleBindings)) {
      const profileId = configFile.roleBindings[roleId as keyof typeof configFile.roleBindings].profileId;
      const profile = configFile.profiles.find((entry) => entry.id === profileId);
      assert.equal(profile?.provider, "openai");
      assert.equal(profile?.authProfileId, "auth.openai.default");
      assert.equal(profile?.route.baseURL, "https://gateway.example.com/v1");
    }
  });
});

test("applyOpenAICompatibleApiLoginConfig can rewire every role profile to Gemini compatible chat completions", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-login-gemini-compatible-"));
  withTempHome(rootDir, () => {
    applyOpenAICompatibleApiLoginConfig(
      "https://viewpro.top/v1/chat/completions",
      "sk-test-gemini-compatible",
      rootDir,
      { routeKind: "gemini_compatible" },
    );

    const configFile = loadRaxcodeConfigFile(rootDir);
    for (const roleId of Object.keys(configFile.roleBindings)) {
      const profileId = configFile.roleBindings[roleId as keyof typeof configFile.roleBindings].profileId;
      const profile = configFile.profiles.find((entry) => entry.id === profileId);
      assert.equal(profile?.provider, "openai");
      assert.equal(profile?.route.baseURL, "https://viewpro.top/v1");
      assert.equal(profile?.route.apiStyle, "chat/completions");
      assert.equal(profile?.model, "gemini-3.1-pro-preview");
    }
  });
});

test("applyChatGptSubscriptionRoleRouting rewires every role profile to the official codex route", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-login-chatgpt-routing-"));
  withTempHome(rootDir, () => {
    const authFile = loadRaxcodeAuthFile(rootDir);
    const existing = authFile.authProfiles.find((entry) => entry.id === OPENAI_OFFICIAL_AUTH_PROFILE_ID);
    authFile.authProfiles = [
      ...authFile.authProfiles.filter((entry) => entry.id !== OPENAI_OFFICIAL_AUTH_PROFILE_ID),
      {
        id: OPENAI_OFFICIAL_AUTH_PROFILE_ID,
        provider: "openai",
        label: "OpenAI Official",
        authMode: "chatgpt_oauth",
        credentials: {
          accessToken: "access",
          refreshToken: "refresh",
          idToken: "id",
          accountId: "acct",
        },
        meta: {
          source: "oauth",
          createdAt: existing?.meta.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ];
    writeRaxcodeAuthFile(authFile, rootDir);

    applyChatGptSubscriptionRoleRouting(rootDir);

    const configFile = loadRaxcodeConfigFile(rootDir);
    for (const roleId of Object.keys(configFile.roleBindings)) {
      const profileId = configFile.roleBindings[roleId as keyof typeof configFile.roleBindings].profileId;
      const profile = configFile.profiles.find((entry) => entry.id === profileId);
      assert.equal(profile?.authProfileId, OPENAI_OFFICIAL_AUTH_PROFILE_ID);
      assert.equal(profile?.route.baseURL, "https://chatgpt.com/backend-api/codex");
    }
  });
});

test("applyEmbeddingLoginConfig writes a dedicated embedding upstream profile", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-login-embedding-"));
  withTempHome(rootDir, () => {
    applyEmbeddingLoginConfig({
      baseURL: "https://embeddings.example.com/v1/embeddings",
      apiKey: "sk-test-embedding",
    }, rootDir);

    const authFile = loadRaxcodeAuthFile(rootDir);
    const configFile = loadRaxcodeConfigFile(rootDir);
    assert.equal(configFile.embedding.baseURL, "https://embeddings.example.com/v1");
    assert.equal(configFile.embedding.authProfileId, "auth.openai.embedding.default");
    assert.equal(authFile.authProfiles.find((entry) => entry.id === "auth.openai.embedding.default")?.credentials.apiKey, "sk-test-embedding");
  });
});

test("applyAnthropicEndpointLoginConfig rewires every role profile to the provided anthropic upstream", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-login-anthropic-compatible-"));
  withTempHome(rootDir, () => {
    applyAnthropicEndpointLoginConfig("https://gateway.example.com/v1/messages", "sk-test-anthropic-compatible", rootDir);

    const authFile = loadRaxcodeAuthFile(rootDir);
    const configFile = loadRaxcodeConfigFile(rootDir);
    assert.equal(authFile.activeAuthProfileIdBySlot.anthropic, "auth.anthropic.default");
    assert.equal(authFile.authProfiles.find((entry) => entry.id === "auth.anthropic.default")?.credentials.apiKey, "sk-test-anthropic-compatible");
    for (const roleId of Object.keys(configFile.roleBindings)) {
      const profileId = configFile.roleBindings[roleId as keyof typeof configFile.roleBindings].profileId;
      const profile = configFile.profiles.find((entry) => entry.id === profileId);
      assert.equal(profile?.provider, "anthropic");
      assert.equal(profile?.authProfileId, "auth.anthropic.default");
      assert.equal(profile?.route.baseURL, "https://gateway.example.com");
      assert.equal(profile?.route.apiStyle, "messages");
      assert.equal(profile?.model, "claude-sonnet-4-6");
    }
  });
});
