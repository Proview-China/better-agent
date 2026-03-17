import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadLiveProviderConfig, resolveLiveConfigPath } from "./live-config.js";

async function writeEnvFile(dir: string, name: string, values: Record<string, string>): Promise<string> {
  const filePath = join(dir, name);
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

test("resolveLiveConfigPath prefers explicit path over PRAXIS_LIVE_ENV_FILE", () => {
  const previous = process.env.PRAXIS_LIVE_ENV_FILE;
  process.env.PRAXIS_LIVE_ENV_FILE = "C:\\env-from-var.env";

  try {
    assert.equal(resolveLiveConfigPath("C:\\explicit.env"), "C:\\explicit.env");
  } finally {
    if (previous === undefined) {
      delete process.env.PRAXIS_LIVE_ENV_FILE;
    } else {
      process.env.PRAXIS_LIVE_ENV_FILE = previous;
    }
  }
});

test("loadLiveProviderConfig falls back to PRAXIS_LIVE_ENV_FILE when no explicit path is provided", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "praxis-live-config-"));
  const previous = process.env.PRAXIS_LIVE_ENV_FILE;

  try {
    const envFile = await writeEnvFile(tempDir, "live.env", {
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://example.com",
      OPENAI_MODEL: "gpt-5.4",
      ANTHROPIC_API_KEY: "anthropic-key",
      ANTHROPIC_BASE_URL: "https://anthropic.example.com",
      ANTHROPIC_MODEL: "claude-sonnet-4-6",
      DEEPMIND_API_KEY: "deepmind-key",
      DEEPMIND_BASE_URL: "https://deepmind.example.com",
      DEEPMIND_MODEL: "gemini-2.5-flash"
    });
    process.env.PRAXIS_LIVE_ENV_FILE = envFile;

    const config = loadLiveProviderConfig();
    assert.equal(config.openai.baseURL, "https://example.com/v1");
    assert.equal(config.anthropic.model, "claude-sonnet-4-6");
    assert.equal(config.deepmind.model, "gemini-2.5-flash");
  } finally {
    if (previous === undefined) {
      delete process.env.PRAXIS_LIVE_ENV_FILE;
    } else {
      process.env.PRAXIS_LIVE_ENV_FILE = previous;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
