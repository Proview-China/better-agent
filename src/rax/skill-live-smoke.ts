import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { RaxRoutingError } from "./errors.js";
import { loadLiveProviderConfig } from "./live-config.js";
import { rax } from "./runtime.js";

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

function parseReportPathArg(argv: string[]): string {
  const entry = argv.find((item) => item.startsWith("--report="));
  const provider = parseProviderArg(argv);
  if (entry) {
    return entry.slice("--report=".length);
  }

  const fileName =
    provider === "all"
      ? "skill-live-smoke.json"
      : `skill-live-smoke.${provider}.json`;
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

async function smokeOpenAI(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().openai;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });

  const listInvocation = rax.skill.list({
    provider: "openai",
    model: config.model,
    input: {}
  });
  const listPayload = listInvocation.payload as {
    args: Array<{ order?: "asc" | "desc" }>;
  };

  try {
    const result = await client.skills.list(...(listPayload.args as [] | [{ order?: "asc" | "desc" }]));
    rows.push({
      provider: "openai",
      step: "managed_list",
      ok: true,
      model: config.model,
      summary: `listed ${result.data.length} OpenAI skills`,
      details: {
        adapterId: listInvocation.adapterId,
        entrypoint: listInvocation.sdk.entrypoint,
        count: result.data.length
      }
    });

    const firstSkill = result.data[0];
    if (!firstSkill) {
      rows.push({
        provider: "openai",
        step: "managed_get",
        ok: true,
        model: config.model,
        summary: "no hosted skills available; skipped get/version checks"
      });
      return rows;
    }

    const getInvocation = rax.skill.get({
      provider: "openai",
      model: config.model,
      input: {
        skillId: firstSkill.id
      }
    });
    const getPayload = getInvocation.payload as { args: [string] };
    const fetched = await client.skills.retrieve(...getPayload.args);
    rows.push({
      provider: "openai",
      step: "managed_get",
      ok: true,
      model: config.model,
      summary: `retrieved skill ${fetched.id}`,
      details: {
        adapterId: getInvocation.adapterId,
        entrypoint: getInvocation.sdk.entrypoint,
        defaultVersion: fetched.default_version,
        latestVersion: fetched.latest_version
      }
    });

    const versionsInvocation = rax.skill.listVersions({
      provider: "openai",
      model: config.model,
      input: {
        skillId: firstSkill.id
      }
    });
    const versionsPayload = versionsInvocation.payload as {
      args: [string, { order?: "asc" | "desc" }?];
    };
    const versionList = await client.skills.versions.list(...versionsPayload.args);
    rows.push({
      provider: "openai",
      step: "managed_list_versions",
      ok: true,
      model: config.model,
      summary: `listed ${versionList.data.length} OpenAI skill versions for ${firstSkill.id}`,
      details: {
        adapterId: versionsInvocation.adapterId,
        entrypoint: versionsInvocation.sdk.entrypoint,
        count: versionList.data.length
      }
    });

    const firstVersion = versionList.data[0];
    if (!firstVersion) {
      rows.push({
        provider: "openai",
        step: "managed_get_version",
        ok: true,
        model: config.model,
        summary: "no OpenAI skill versions available; skipped getVersion check"
      });
      return rows;
    }

    const getVersionInvocation = rax.skill.getVersion({
      provider: "openai",
      model: config.model,
      input: {
        skillId: firstSkill.id,
        version: firstVersion.version
      }
    });
    const getVersionPayload = getVersionInvocation.payload as {
      args: [string, { skill_id: string }];
    };
    const fetchedVersion = await client.skills.versions.retrieve(
      getVersionPayload.args[0],
      getVersionPayload.args[1]
    );
    rows.push({
      provider: "openai",
      step: "managed_get_version",
      ok: true,
      model: config.model,
      summary: `retrieved OpenAI skill version ${fetchedVersion.version}`,
      details: {
        adapterId: getVersionInvocation.adapterId,
        entrypoint: getVersionInvocation.sdk.entrypoint,
        skillId: fetchedVersion.skill_id
      }
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "openai",
      step: "managed_registry",
      ok: false,
      model: config.model,
      summary: formatted.summary,
      details: formatted.details
    });
  }

  return rows;
}

async function smokeAnthropic(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().anthropic;
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });

  const listInvocation = rax.skill.list({
    provider: "anthropic",
    model: config.model,
    input: {}
  });
  const listPayload = listInvocation.payload as {
    args: [] | [{ source?: "custom" | "anthropic" | null; betas: string[] }];
  };

  try {
    const result = await client.beta.skills.list(...listPayload.args);
    const entries = "data" in result && Array.isArray(result.data) ? result.data : [];
    rows.push({
      provider: "anthropic",
      step: "managed_list",
      ok: true,
      model: config.model,
      summary: `listed ${entries.length} Anthropic skills`,
      details: {
        adapterId: listInvocation.adapterId,
        entrypoint: listInvocation.sdk.entrypoint,
        count: entries.length
      }
    });

    const firstSkill = entries[0];
    if (!firstSkill) {
      rows.push({
        provider: "anthropic",
        step: "managed_get",
        ok: true,
        model: config.model,
        summary: "no Anthropic managed skills available; skipped get/version checks"
      });
      return rows;
    }

    const getInvocation = rax.skill.get({
      provider: "anthropic",
      model: config.model,
      input: {
        skillId: firstSkill.id
      }
    });
    const getPayload = getInvocation.payload as {
      args: [string, { betas: string[] }?];
    };
    const fetched = await client.beta.skills.retrieve(...getPayload.args);
    rows.push({
      provider: "anthropic",
      step: "managed_get",
      ok: true,
      model: config.model,
      summary: `retrieved skill ${fetched.id}`,
      details: {
        adapterId: getInvocation.adapterId,
        entrypoint: getInvocation.sdk.entrypoint,
        latestVersion: fetched.latest_version
      }
    });

    const versionsInvocation = rax.skill.listVersions({
      provider: "anthropic",
      model: config.model,
      input: {
        skillId: firstSkill.id
      }
    });
    const versionsPayload = versionsInvocation.payload as {
      args: [string, { betas: string[] }?];
    };
    const versionList = await client.beta.skills.versions.list(...versionsPayload.args);
    const versionEntries = "data" in versionList && Array.isArray(versionList.data) ? versionList.data : [];
    rows.push({
      provider: "anthropic",
      step: "managed_list_versions",
      ok: true,
      model: config.model,
      summary: `listed ${versionEntries.length} Anthropic skill versions for ${firstSkill.id}`,
      details: {
        adapterId: versionsInvocation.adapterId,
        entrypoint: versionsInvocation.sdk.entrypoint,
        count: versionEntries.length
      }
    });

    const firstVersion = versionEntries[0];
    if (!firstVersion) {
      rows.push({
        provider: "anthropic",
        step: "managed_get_version",
        ok: true,
        model: config.model,
        summary: "no Anthropic skill versions available; skipped getVersion check"
      });
      return rows;
    }

    const getVersionInvocation = rax.skill.getVersion({
      provider: "anthropic",
      model: config.model,
      input: {
        skillId: firstSkill.id,
        version: firstVersion.version
      }
    });
    const getVersionPayload = getVersionInvocation.payload as {
      args: [string, { skill_id: string; betas: string[] }];
    };
    const fetchedVersion = await client.beta.skills.versions.retrieve(
      getVersionPayload.args[0],
      getVersionPayload.args[1]
    );
    rows.push({
      provider: "anthropic",
      step: "managed_get_version",
      ok: true,
      model: config.model,
      summary: `retrieved Anthropic skill version ${fetchedVersion.version}`,
      details: {
        adapterId: getVersionInvocation.adapterId,
        entrypoint: getVersionInvocation.sdk.entrypoint,
        skillId: fetchedVersion.skill_id
      }
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "anthropic",
      step: "managed_registry",
      ok: false,
      model: config.model,
      summary: formatted.summary,
      details: formatted.details
    });
  }

  return rows;
}

async function smokeDeepMind(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().deepmind;
  const managedCalls = [
    {
      step: "managed_list",
      run: () =>
        rax.skill.list({
          provider: "deepmind",
          model: config.model,
          input: {}
        })
    },
    {
      step: "managed_publish",
      run: () =>
        rax.skill.publish({
          provider: "deepmind",
          model: config.model,
          input: {
            source: process.cwd()
          }
        })
    }
  ] as const;

  for (const entry of managedCalls) {
    try {
      await Promise.resolve(entry.run());
      rows.push({
        provider: "deepmind",
        step: entry.step,
        ok: false,
        model: config.model,
        summary: "expected unsupported boundary, but call unexpectedly succeeded"
      });
    } catch (error) {
      if (error instanceof RaxRoutingError && error.code === "skill_managed_unsupported") {
        rows.push({
          provider: "deepmind",
          step: entry.step,
          ok: true,
          model: config.model,
          summary: "unsupported boundary held as expected",
          details: {
            code: error.code
          }
        });
        continue;
      }

      const formatted = formatError(error);
      rows.push({
        provider: "deepmind",
        step: entry.step,
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details
      });
    }
  }

  return rows;
}

async function main(): Promise<void> {
  const provider = parseProviderArg(process.argv.slice(2));
  const reportPath = parseReportPathArg(process.argv.slice(2));
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

  console.table(
    rows.map((row) => ({
      provider: row.provider,
      step: row.step,
      ok: row.ok,
      model: row.model,
      summary: row.summary
    }))
  );

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
  console.log(`skill live smoke report written to ${reportPath}`);

  const failed = rows.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
