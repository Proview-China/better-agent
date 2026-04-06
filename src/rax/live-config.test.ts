import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLiveProviderConfig, loadOpenAILiveConfig } from "./live-config.js";

async function writeEnvFile(contents: string): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-"));
  const envPath = path.join(rootDir, ".env.local");
  await writeFile(envPath, contents, "utf8");
  return envPath;
}

test("loadLiveProviderConfig reads .env.local values when no process overrides are set", async () => {
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
    PRAXIS_LIVE_ENV_FILE: process.env.PRAXIS_LIVE_ENV_FILE,
    OPENAI_MODEL: process.env.OPENAI_MODEL
  };

  try {
    delete process.env.PRAXIS_LIVE_ENV_FILE;
    delete process.env.OPENAI_MODEL;

    const config = loadLiveProviderConfig(envPath);

    assert.equal(config.openai.model, "gpt-5.4");
    assert.equal(config.openai.baseURL, "https://example.com/v1");
    assert.equal(config.anthropic.model, "claude-opus-4-6-thinking");
    assert.equal(config.deepmind.model, "gemini-3.1-pro-preview");
  } finally {
    if (originalEnv.PRAXIS_LIVE_ENV_FILE === undefined) {
      delete process.env.PRAXIS_LIVE_ENV_FILE;
    } else {
      process.env.PRAXIS_LIVE_ENV_FILE = originalEnv.PRAXIS_LIVE_ENV_FILE;
    }
    if (originalEnv.OPENAI_MODEL === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
    }
  }
});

test("loadLiveProviderConfig lets process env override .env.local values", async () => {
  const envPath = await writeEnvFile(`
OPENAI_API_KEY=test-openai
OPENAI_BASE_URL=https://example.com
OPENAI_MODEL=gpt-5.4
ANTHROPIC_API_KEY=test-anthropic
ANTHROPIC_BASE_URL=https://anthropic.example.com
ANTHROPIC_MODEL=claude-opus-4.6-thinking
DEEPMIND_API_KEY=test-deepmind
DEEPMIND_BASE_URL=https://deepmind.example.com
DEEPMIND_MODEL=gemini-3-flash
  `.trim());

  const originalEnv = {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    DEEPMIND_BASE_URL: process.env.DEEPMIND_BASE_URL
  };

  try {
    process.env.OPENAI_MODEL = "gpt-5";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-6-thinking";
    process.env.DEEPMIND_BASE_URL = "https://viewpro.top/v1beta/models";

    const config = loadLiveProviderConfig(envPath);

    assert.equal(config.openai.model, "gpt-5");
    assert.equal(config.anthropic.model, "claude-opus-4-6-thinking");
    assert.equal(config.deepmind.baseURL, "https://viewpro.top/v1beta/models");
  } finally {
    if (originalEnv.OPENAI_MODEL === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
    }
    if (originalEnv.ANTHROPIC_MODEL === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalEnv.ANTHROPIC_MODEL;
    }
    if (originalEnv.DEEPMIND_BASE_URL === undefined) {
      delete process.env.DEEPMIND_BASE_URL;
    } else {
      process.env.DEEPMIND_BASE_URL = originalEnv.DEEPMIND_BASE_URL;
    }
  }
});

test("loadLiveProviderConfig can run from process env only when the env file is absent", () => {
  const originalEnv = {
    PRAXIS_LIVE_ENV_FILE: process.env.PRAXIS_LIVE_ENV_FILE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    DEEPMIND_API_KEY: process.env.DEEPMIND_API_KEY,
    DEEPMIND_BASE_URL: process.env.DEEPMIND_BASE_URL,
    DEEPMIND_MODEL: process.env.DEEPMIND_MODEL
  };

  try {
    process.env.PRAXIS_LIVE_ENV_FILE = path.join(os.tmpdir(), "praxis-missing-live-config.env");
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.OPENAI_BASE_URL = "https://openai.example.com";
    process.env.OPENAI_MODEL = "gpt-5.4";
    process.env.ANTHROPIC_API_KEY = "test-anthropic";
    process.env.ANTHROPIC_BASE_URL = "https://anthropic.example.com";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-6-thinking";
    process.env.DEEPMIND_API_KEY = "test-deepmind";
    process.env.DEEPMIND_BASE_URL = "https://deepmind.example.com";
    process.env.DEEPMIND_MODEL = "gemini-3.1-pro-preview";

    const config = loadLiveProviderConfig();

    assert.equal(config.openai.baseURL, "https://openai.example.com/v1");
    assert.equal(config.anthropic.baseURL, "https://anthropic.example.com");
    assert.equal(config.deepmind.model, "gemini-3.1-pro-preview");
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

test("loadOpenAILiveConfig only requires the OpenAI fields", async () => {
  const envPath = await writeEnvFile(`
OPENAI_API_KEY=test-openai
OPENAI_BASE_URL=https://openai.example.com
OPENAI_MODEL=gpt-5.4
  `.trim());

  const originalEnv = {
    PRAXIS_LIVE_ENV_FILE: process.env.PRAXIS_LIVE_ENV_FILE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPMIND_API_KEY: process.env.DEEPMIND_API_KEY,
  };

  try {
    process.env.PRAXIS_LIVE_ENV_FILE = envPath;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPMIND_API_KEY;

    const config = loadOpenAILiveConfig();

    assert.equal(config.apiKey, "test-openai");
    assert.equal(config.baseURL, "https://openai.example.com/v1");
    assert.equal(config.model, "gpt-5.4");
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

test("loadOpenAILiveConfig walks upward to the nearest parent .env.local", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-live-config-parent-"));
  const nestedDir = path.join(rootDir, "a", "b", "c");
  await mkdir(nestedDir, { recursive: true });
  await writeFile(path.join(rootDir, ".env.local"), [
    "OPENAI_API_KEY=test-openai-parent",
    "OPENAI_BASE_URL=https://openai.parent.example.com",
    "OPENAI_MODEL=gpt-5.4",
  ].join("\n"), "utf8");

  const originalCwd = process.cwd();
  const originalEnv = {
    PRAXIS_LIVE_ENV_FILE: process.env.PRAXIS_LIVE_ENV_FILE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };

  try {
    process.chdir(nestedDir);
    delete process.env.PRAXIS_LIVE_ENV_FILE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;

    const config = loadOpenAILiveConfig();

    assert.equal(config.apiKey, "test-openai-parent");
    assert.equal(config.baseURL, "https://openai.parent.example.com/v1");
    assert.equal(config.model, "gpt-5.4");
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
