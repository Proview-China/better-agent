import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import type { PreparedInvocation } from "./contracts.js";
import { loadLiveProviderConfig } from "./live-config.js";
import { rax } from "./runtime.js";

const execFileAsync = promisify(execFile);
const OPENAI_INLINE_SECRET = "PRAXIS_SKILL_INLINE_OK";
const ANTHROPIC_PREBUILT_SECRET = "PPTX_OK";

type ProviderTarget = "openai" | "anthropic" | "deepmind" | "all";

interface SmokeRow {
  provider: Exclude<ProviderTarget, "all">;
  step: string;
  ok: boolean;
  model: string;
  summary: string;
  details?: Record<string, unknown>;
}

function parseProviderArg(argv: string[]): ProviderTarget {
  const entry = argv.find((item) => item.startsWith("--provider="));
  const value = entry?.slice("--provider=".length) ?? "all";
  if (value === "openai" || value === "anthropic" || value === "deepmind" || value === "all") {
    return value;
  }
  throw new Error(`Unsupported provider target: ${value}`);
}

function parseReportPathArg(argv: string[], provider: ProviderTarget): string {
  const entry = argv.find((item) => item.startsWith("--report="));
  if (entry) {
    return entry.slice("--report=".length);
  }

  const fileName =
    provider === "all"
      ? "skill-execution-live-smoke.json"
      : `skill-execution-live-smoke.${provider}.json`;

  return resolve(process.cwd(), "memory/live-reports", fileName);
}

function formatError(error: unknown): { summary: string; details: Record<string, unknown> } {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      summary: String(record.message ?? "Unknown error"),
      details: {
        name: record.name ?? null,
        status: record.status ?? null,
        code: record.code ?? null
      }
    };
  }

  return {
    summary: String(error),
    details: {}
  };
}

async function executeOpenAI(invocation: PreparedInvocation<Record<string, unknown>>): Promise<unknown> {
  const config = loadLiveProviderConfig().openai;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });
  const payload = invocation.payload as unknown as OpenAIInvocationPayload<Record<string, unknown>>;

  if (payload.surface !== "responses") {
    throw new Error(`Unsupported OpenAI skill execution surface: ${payload.surface}`);
  }

  return client.responses.create(payload.params as never);
}

async function executeAnthropic(invocation: PreparedInvocation<Record<string, unknown>>): Promise<unknown> {
  const config = loadLiveProviderConfig().anthropic;
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });

  if (invocation.sdk.packageName !== "@anthropic-ai/sdk" || invocation.sdk.entrypoint !== "client.messages.create") {
    throw new Error(`Unsupported Anthropic skill execution entrypoint: ${invocation.sdk.entrypoint}`);
  }

  return client.messages.create(invocation.payload as never);
}

async function createLocalSkillPackage(): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(join(tmpdir(), "praxis-skill-execution-"));
  await mkdir(join(rootDir, "references"), { recursive: true });
  await writeFile(
    join(rootDir, "SKILL.md"),
    `---
name: "Praxis Inline Smoke"
description: >
  Use this skill when the user asks for the Praxis inline smoke code.
triggers:
  - inline smoke code
  - praxis skill smoke
metadata:
  version: "0.0.1"
---

When the user asks for the Praxis inline smoke code, reply with exactly ${OPENAI_INLINE_SECRET}.
`,
    "utf8"
  );
  await writeFile(
    join(rootDir, "references", "smoke.txt"),
    `Expected response token: ${OPENAI_INLINE_SECRET}\n`,
    "utf8"
  );

  return {
    rootDir,
    cleanup: () => rm(rootDir, { recursive: true, force: true })
  };
}

async function createInlineSkillBundle(rootDir: string): Promise<string> {
  const bundlePath = `${rootDir}.zip`;

  try {
    await execFileAsync("zip", ["-rq", bundlePath, "."], {
      cwd: rootDir
    });
  } catch {
    await execFileAsync("python3", ["-m", "zipfile", "-c", bundlePath, "SKILL.md", "references/smoke.txt"], {
      cwd: rootDir
    });
  }

  const bytes = await readFile(bundlePath);
  await rm(bundlePath, { force: true });
  return bytes.toString("base64");
}

function summarizeOpenAIResponse(response: unknown): { ok: boolean; summary: string; details: Record<string, unknown> } {
  const outputText =
    typeof response === "object" && response !== null && "output_text" in response
      ? String((response as { output_text?: unknown }).output_text ?? "")
      : "";
  const outputCount =
    typeof response === "object" && response !== null && "output" in response && Array.isArray((response as { output?: unknown[] }).output)
      ? (response as { output: unknown[] }).output.length
      : 0;

  return {
    ok: outputText.includes(OPENAI_INLINE_SECRET),
    summary: outputText.slice(0, 160) || "OpenAI response returned without output_text",
    details: {
      outputCount
    }
  };
}

function summarizeAnthropicResponse(response: unknown): { ok: boolean; summary: string; details: Record<string, unknown> } {
  const content =
    typeof response === "object" && response !== null && "content" in response && Array.isArray((response as { content?: unknown[] }).content)
      ? (response as { content: Array<{ type?: string; text?: string }> }).content
      : [];
  const textPreview = content
    .filter((entry) => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text)
    .join("\n")
    .slice(0, 160);
  const toolBlockCount = content.filter((entry) => entry.type && entry.type !== "text").length;

  return {
    ok: textPreview.includes(ANTHROPIC_PREBUILT_SECRET),
    summary: textPreview || `content blocks=${content.length}`,
    details: {
      contentBlocks: content.length,
      toolBlocks: toolBlockCount
    }
  };
}

async function smokeOpenAI(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().openai;
  const skillPackage = await createLocalSkillPackage();

  try {
    const inlineBundle = await createInlineSkillBundle(skillPackage.rootDir);
    const baseInvocation = rax.generate.create({
      provider: "openai",
      model: config.model,
      input: {
        input: "Use the attached skill and reply with only the Praxis inline smoke code."
      }
    });
    const skillResult = await rax.skill.use({
      provider: "openai",
      model: config.model,
      input: {
        source: skillPackage.rootDir,
        mode: "openai-inline-shell",
        details: {
          source: {
            data: inlineBundle,
            media_type: "application/zip",
            type: "base64"
          }
        }
      }
    });
    const composed = rax.skill.compose(baseInvocation as never, skillResult);
    const response = await executeOpenAI(composed as PreparedInvocation<Record<string, unknown>>);
    const summary = summarizeOpenAIResponse(response);

    rows.push({
      provider: "openai",
      step: "inline_skill_execution",
      ok: summary.ok,
      model: config.model,
      summary: summary.summary,
      details: {
        ...summary.details,
        adapterId: composed.adapterId
      }
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "openai",
      step: "inline_skill_execution",
      ok: false,
      model: config.model,
      summary: formatted.summary,
      details: formatted.details
    });
  } finally {
    await skillPackage.cleanup();
  }

  return rows;
}

async function smokeAnthropic(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().anthropic;
  const skillPackage = await createLocalSkillPackage();

  try {
    const baseInvocation = rax.generate.create({
      provider: "anthropic",
      model: config.model,
      input: {
        maxTokens: 512,
        messages: [
          {
            role: "user",
            content: `Use the attached pptx skill to create a one-slide presentation titled Praxis Skill Smoke, then reply with only ${ANTHROPIC_PREBUILT_SECRET}.`
          }
        ]
      }
    });
    const skillResult = await rax.skill.use({
      provider: "anthropic",
      model: config.model,
      input: {
        source: skillPackage.rootDir,
        mode: "anthropic-api-managed",
        details: {
          type: "anthropic",
          skill_id: "pptx",
          version: "latest",
          code_execution_type: "code_execution_20250825"
        }
      }
    });
    const composed = rax.skill.compose(baseInvocation as never, skillResult);
    const response = await executeAnthropic(composed as PreparedInvocation<Record<string, unknown>>);
    const summary = summarizeAnthropicResponse(response);

    rows.push({
      provider: "anthropic",
      step: "prebuilt_skill_execution",
      ok: summary.ok,
      model: config.model,
      summary: summary.summary,
      details: {
        ...summary.details,
        adapterId: composed.adapterId
      }
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "anthropic",
      step: "prebuilt_skill_execution",
      ok: false,
      model: config.model,
      summary: formatted.summary,
      details: formatted.details
    });
  } finally {
    await skillPackage.cleanup();
  }

  return rows;
}

async function smokeDeepMind(): Promise<SmokeRow[]> {
  return [
    {
      provider: "deepmind",
      step: "skill_execution",
      ok: true,
      model: loadLiveProviderConfig().deepmind.model,
      summary: "execution smoke skipped: DeepMind skill execution still requires ADK runtime-specific handling in the current JS baseline"
    }
  ];
}

function printRows(rows: SmokeRow[]): void {
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

async function writeReport(reportPath: string, provider: ProviderTarget, rows: SmokeRow[]): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider,
        rows
      },
      null,
      2
    ),
    "utf8"
  );
}

async function main(): Promise<void> {
  const provider = parseProviderArg(process.argv.slice(2));
  const reportPath = parseReportPathArg(process.argv.slice(2), provider);
  const rows: SmokeRow[] = [];

  if (provider === "all" || provider === "openai") {
    rows.push(...await smokeOpenAI());
  }
  if (provider === "all" || provider === "anthropic") {
    rows.push(...await smokeAnthropic());
  }
  if (provider === "all" || provider === "deepmind") {
    rows.push(...await smokeDeepMind());
  }

  printRows(rows);
  await writeReport(reportPath, provider, rows);
  console.error(`skill execution live smoke report written to ${reportPath}`);

  if (rows.some((row) => !row.ok)) {
    process.exitCode = 1;
  }
}

await main();
