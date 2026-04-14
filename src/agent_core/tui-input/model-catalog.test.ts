import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  applyFastServiceTierCacheSupport,
  EMBEDDING_MODEL_CATALOG,
  buildChatModelAvailabilityScopeKey,
  getCachedFastServiceTierAvailability,
  getCachedModelAvailability,
  listAvailableAnthropicModels,
  listAvailableChatModels,
  setCachedFastServiceTierAvailability,
  setCachedModelAvailability,
} from "./model-catalog.js";

test("embedding model catalog exposes the two supported API-backed models", () => {
  assert.deepEqual(
    EMBEDDING_MODEL_CATALOG.map((entry) => entry.id),
    ["text-embedding-3-large", "text-embedding-3-small"],
  );
});

test("listAvailableChatModels normalizes official codex backend payloads", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      models: [
        {
          slug: "gpt-5.2-codex",
          display_name: "gpt-5.2-codex",
          supported_reasoning_levels: [{ effort: "medium" }],
          supported_in_api: true,
        },
        {
          slug: "gpt-5.4-mini",
          display_name: "gpt-5.4-mini",
          supported_reasoning_levels: [{ effort: "low", description: "Fast responses with lighter reasoning" }],
          supported_in_api: true,
        },
        {
          slug: "gpt-5.3-codex",
          display_name: "gpt-5.3-codex",
          supported_reasoning_levels: [
            { effort: "low", description: "Fast responses with lighter reasoning" },
            { effort: "high", description: "Greater reasoning depth for complex problems" },
          ],
          supported_in_api: true,
        },
        {
          slug: "gpt-5.4",
          display_name: "gpt-5.4",
          supported_reasoning_levels: [
            { effort: "low", description: "Fast responses with lighter reasoning" },
            { effort: "medium", description: "Balances speed and reasoning depth for everyday tasks" },
            { effort: "high", description: "Greater reasoning depth for complex problems" },
            { effort: "xhigh", description: "Extra high reasoning depth for complex problems" },
          ],
          default_reasoning_level: "medium",
          additional_speed_tiers: ["fast"],
          supported_in_api: true,
        },
      ],
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const models = await listAvailableChatModels({
      authMode: "chatgpt_oauth",
      apiKey: "token",
      baseURL: "https://chatgpt.com/backend-api/codex",
      model: "gpt-5.4",
      defaultHeaders: {
        "chatgpt-account-id": "acct",
      },
    });
    assert.match(requestedUrl, /client_version=0\.118\.0/);
    assert.deepEqual(
      models.map((entry) => entry.id),
      ["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2-codex"],
    );
  assert.deepEqual(models[0]?.reasoningLevels, ["none", "low", "medium", "high", "xhigh"]);
  assert.equal(models[0]?.supportsFastServiceTier, true);
  assert.match(models[0]?.reasoningLevelDescriptions.low ?? "", /fast/i);
  assert.equal(models[1]?.supportsFastServiceTier, false);
  assert.deepEqual(models[1]?.reasoningLevels, ["none", "low"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listAvailableChatModels marks tested gmn GPT models as FAST-capable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({
      data: [
        { id: "gpt-5.4" },
        { id: "gpt-5.4-mini" },
        { id: "gpt-5.3-codex" },
        { id: "gpt-5.2" },
      ],
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const models = await listAvailableChatModels({
      authMode: "api_key",
      apiKey: "token",
      baseURL: "https://gmn.chuangzuoli.com/v1",
      model: "gpt-5.4",
    });

    assert.equal(models.find((entry) => entry.id === "gpt-5.4")?.supportsFastServiceTier, true);
    assert.equal(models.find((entry) => entry.id === "gpt-5.4-mini")?.supportsFastServiceTier, true);
    assert.equal(models.find((entry) => entry.id === "gpt-5.3-codex")?.supportsFastServiceTier, true);
    assert.equal(models.find((entry) => entry.id === "gpt-5.2")?.supportsFastServiceTier, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listAvailableAnthropicModels normalizes anthropic /v1/models payloads", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      data: [
        { id: "claude-sonnet-4-6" },
        { id: "claude-opus-4-6-thinking" },
      ],
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const models = await listAvailableAnthropicModels({
      apiKey: "sk-ant-test",
      baseURL: "https://anthropic.example.com",
    });
    assert.equal(requestedUrl, "https://anthropic.example.com/v1/models");
    assert.deepEqual(
      models.map((entry) => entry.id),
      ["claude-sonnet-4-6", "claude-opus-4-6-thinking"],
    );
    assert.deepEqual(models[0]?.reasoningLevels, ["none", "low", "medium", "high", "xhigh"]);
    assert.equal(models[0]?.defaultReasoningLevel, "medium");
    assert.equal(models[0]?.supportsFastServiceTier, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("model availability cache persists records per scope key", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "praxis-model-cache-"));
  const scopeKey = buildChatModelAvailabilityScopeKey({
    authMode: "chatgpt_oauth",
    apiKey: "unused",
    baseURL: "https://chatgpt.com/backend-api/codex",
    accountId: "acct-1",
    defaultHeaders: {
      "chatgpt-account-id": "acct-1",
    },
  });

  setCachedModelAvailability(scopeKey, "gpt-5.4", {
    status: "available",
    checkedAt: "2026-04-14T00:00:00.000Z",
  }, sandbox);

  assert.deepEqual(
    getCachedModelAvailability(scopeKey, "gpt-5.4", sandbox),
    {
      status: "available",
      checkedAt: "2026-04-14T00:00:00.000Z",
    },
  );
});

test("fast service tier cache is stored separately but official fast-capable models stay visible without cache gating", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "praxis-fast-tier-cache-"));
  const scopeConfig = {
    authMode: "chatgpt_oauth" as const,
    apiKey: "unused",
    baseURL: "https://chatgpt.com/backend-api/codex",
    accountId: "acct-fast",
    defaultHeaders: {
      "chatgpt-account-id": "acct-fast",
    },
  };
  const scopeKey = buildChatModelAvailabilityScopeKey(scopeConfig);
  setCachedFastServiceTierAvailability(scopeKey, "gpt-5.4", {
    status: "available",
    checkedAt: "2026-04-14T00:00:00.000Z",
  }, sandbox);

  assert.deepEqual(
    getCachedFastServiceTierAvailability(scopeKey, "gpt-5.4", sandbox),
    {
      status: "available",
      checkedAt: "2026-04-14T00:00:00.000Z",
    },
  );

  const models = applyFastServiceTierCacheSupport([
    {
      id: "gpt-5.4",
      label: "gpt-5.4",
      reasoningLevels: ["low", "medium", "high"],
      reasoningLevelDescriptions: {},
      source: "chat",
      supportsFastServiceTier: true,
    },
    {
      id: "gpt-5.4-mini",
      label: "gpt-5.4-mini",
      reasoningLevels: ["low"],
      reasoningLevelDescriptions: {},
      source: "chat",
      supportsFastServiceTier: false,
    },
  ], scopeConfig, sandbox);

  assert.equal(models[0]?.supportsFastServiceTier, true);
  assert.equal(models[1]?.supportsFastServiceTier, false);
});

test("gmn fast-capable models stay visible without cache gating", () => {
  const models = applyFastServiceTierCacheSupport([
    {
      id: "gpt-5.4-mini",
      label: "gpt-5.4-mini",
      reasoningLevels: ["low", "medium", "high"],
      reasoningLevelDescriptions: {},
      source: "chat",
      supportsFastServiceTier: false,
    },
    {
      id: "gpt-5.2",
      label: "gpt-5.2",
      reasoningLevels: ["low", "medium", "high"],
      reasoningLevelDescriptions: {},
      source: "chat",
      supportsFastServiceTier: false,
    },
  ], {
    authMode: "api_key",
    apiKey: "gmn-key",
    baseURL: "https://gmn.chuangzuoli.com/v1",
  });

  assert.equal(models[0]?.supportsFastServiceTier, true);
  assert.equal(models[1]?.supportsFastServiceTier, false);
});
