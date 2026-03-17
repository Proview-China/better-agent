import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

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

function summarizeWebSearchResult(
  result: Awaited<ReturnType<typeof rax.websearch.create>>,
  details: Record<string, unknown> = {}
): SmokeRow["details"] {
  return {
    status: result.status,
    sources: result.output?.sources.length ?? 0,
    citations: result.output?.citations.length ?? 0,
    ...details
  };
}

async function smokeOpenAI(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().openai;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });
  const models = Array.from(new Set([config.model, "gpt-5.4", "gpt-5"]));

  for (const model of models) {
    try {
      const response = await client.responses.create({
        model,
        input: "Reply with OK only."
      });
      rows.push({
        provider: "openai",
        step: "native_plain",
        ok: true,
        model,
        summary: response.output_text?.slice(0, 120) ?? "plain responses call succeeded"
      });
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        step: "native_plain",
        ok: false,
        model,
        summary: formatted.summary,
        details: formatted.details
      });
      continue;
    }

    try {
      const response = await client.responses.create({
        model,
        input: "What is the official documentation domain for OpenAI? Return one short answer.",
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"]
      });
      rows.push({
        provider: "openai",
        step: "native_search",
        ok: true,
        model,
        summary: response.output_text?.slice(0, 160) ?? "native search succeeded",
        details: {
          outputCount: response.output?.length ?? 0
        }
      });
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        step: "native_search",
        ok: false,
        model,
        summary: formatted.summary,
        details: formatted.details
      });
      continue;
    }

    const result = await rax.websearch.create({
      provider: "openai",
      model,
      input: {
        query: "What is the official documentation domain for OpenAI?",
        goal: "Return one short grounded answer.",
        maxSources: 2,
        maxOutputTokens: 128,
        citations: "preferred"
      }
    });

    rows.push({
      provider: "openai",
      step: "rax_websearch",
      ok: result.status === "success",
      model,
      summary:
        result.output?.answer?.slice(0, 160) ??
        (result.error && typeof result.error === "object" && "message" in result.error
          ? String((result.error as Record<string, unknown>).message)
          : result.status),
      details: summarizeWebSearchResult(result)
    });

    const constrainedResult = await rax.websearch.create({
      provider: "openai",
      model,
      input: {
        query: "What is the official documentation domain for OpenAI?",
        goal: "Return one short grounded answer from official sources only.",
        allowedDomains: ["platform.openai.com"],
        freshness: "month",
        maxSources: 2,
        maxOutputTokens: 64,
        citations: "required"
      }
    });

    rows.push({
      provider: "openai",
      step: "rax_websearch_contract",
      ok: constrainedResult.status === "success",
      model,
      summary:
        constrainedResult.output?.answer?.slice(0, 160) ??
        (constrainedResult.error && typeof constrainedResult.error === "object" && "message" in constrainedResult.error
          ? String((constrainedResult.error as Record<string, unknown>).message)
          : constrainedResult.status),
      details: summarizeWebSearchResult(constrainedResult, {
        contract: ["allowedDomains", "freshness", "maxOutputTokens"]
      })
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
  const model = config.model;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with OK only." }]
    });
    rows.push({
      provider: "anthropic",
      step: "native_plain",
      ok: true,
      model,
      summary: JSON.stringify(response.content[0] ?? null).slice(0, 120)
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "anthropic",
      step: "native_plain",
      ok: false,
      model,
      summary: formatted.summary,
      details: formatted.details
    });
    return rows;
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: "What is the official documentation domain for Anthropic? Return one short answer."
        }
      ],
      tools: [
        {
          name: "web_search",
          type: "web_search_20260209"
        }
      ]
    });
    rows.push({
      provider: "anthropic",
      step: "native_search",
      ok: true,
      model,
      summary: JSON.stringify(response.content[0] ?? null).slice(0, 160)
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "anthropic",
      step: "native_search",
      ok: false,
      model,
      summary: formatted.summary,
      details: formatted.details
    });
    return rows;
  }

  const result = await rax.websearch.create({
    provider: "anthropic",
    model,
    input: {
      query: "What is the official documentation domain for Anthropic?",
      goal: "Return one short grounded answer.",
      maxSources: 2,
      maxOutputTokens: 128,
      citations: "preferred"
    }
  });

  rows.push({
    provider: "anthropic",
    step: "rax_websearch",
    ok: result.status === "success",
    model,
    summary:
      result.output?.answer?.slice(0, 160) ??
      (result.error && typeof result.error === "object" && "message" in result.error
        ? String((result.error as Record<string, unknown>).message)
        : result.status),
    details: summarizeWebSearchResult(result)
  });

  const constrainedResult = await rax.websearch.create({
    provider: "anthropic",
    model,
    input: {
      query: "What is the official documentation domain for Anthropic?",
      goal: "Return one short grounded answer from official sources only.",
      allowedDomains: ["docs.anthropic.com"],
      freshness: "month",
      maxSources: 2,
      maxOutputTokens: 64,
      citations: "required"
    }
  });

  rows.push({
    provider: "anthropic",
    step: "rax_websearch_contract",
    ok: constrainedResult.status === "success",
    model,
    summary:
      constrainedResult.output?.answer?.slice(0, 160) ??
      (constrainedResult.error && typeof constrainedResult.error === "object" && "message" in constrainedResult.error
        ? String((constrainedResult.error as Record<string, unknown>).message)
        : constrainedResult.status),
    details: summarizeWebSearchResult(constrainedResult, {
      contract: ["allowedDomains", "freshness", "maxOutputTokens"]
    })
  });

  return rows;
}

async function smokeDeepMind(): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  const config = loadLiveProviderConfig().deepmind;
  const client = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: {
      baseUrl: config.baseURL
    }
  });
  const model = config.model;

  try {
    const response = await client.models.generateContent({
      model,
      contents: "Reply with OK only."
    });
    rows.push({
      provider: "deepmind",
      step: "native_plain",
      ok: true,
      model,
      summary: response.text?.slice(0, 120) ?? "native plain call succeeded"
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "deepmind",
      step: "native_plain",
      ok: false,
      model,
      summary: formatted.summary,
      details: formatted.details
    });
    return rows;
  }

  try {
    const response = await client.models.generateContent({
      model,
      contents: "What is the official documentation domain for Google Gemini? Return one short answer.",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    rows.push({
      provider: "deepmind",
      step: "native_search",
      ok: true,
      model,
      summary: response.text?.slice(0, 160) ?? "native generateContent search succeeded",
      details: {
        route: "generateContent+googleSearch"
      }
    });
  } catch (error) {
    const formatted = formatError(error);
    rows.push({
      provider: "deepmind",
      step: "native_search",
      ok: false,
      model,
      summary: formatted.summary,
      details: formatted.details
    });
    return rows;
  }

  const result = await rax.websearch.create({
    provider: "deepmind",
    model,
    input: {
      query: "What is the official documentation domain for Google Gemini?",
      goal: "Return one short grounded answer.",
      maxSources: 2,
      maxOutputTokens: 128,
      citations: "preferred"
    }
  });

  rows.push({
    provider: "deepmind",
    step: "rax_websearch",
    ok: result.status === "success",
    model,
    summary:
      result.output?.answer?.slice(0, 160) ??
      (result.error && typeof result.error === "object" && "message" in result.error
        ? String((result.error as Record<string, unknown>).message)
        : result.status),
    details: summarizeWebSearchResult(result, {
      route: "generateContent+googleSearch"
    })
  });

  const constrainedResult = await rax.websearch.create({
    provider: "deepmind",
    model,
    input: {
      query: "What is the official documentation domain for Google Gemini?",
      goal: "Return one short grounded answer from official sources only.",
      allowedDomains: ["ai.google.dev"],
      freshness: "month",
      maxSources: 2,
      maxOutputTokens: 64,
      citations: "required"
    }
  });

  rows.push({
    provider: "deepmind",
    step: "rax_websearch_contract",
    ok: constrainedResult.status === "success",
    model,
    summary:
      constrainedResult.output?.answer?.slice(0, 160) ??
      (constrainedResult.error && typeof constrainedResult.error === "object" && "message" in constrainedResult.error
        ? String((constrainedResult.error as Record<string, unknown>).message)
        : constrainedResult.status),
    details: summarizeWebSearchResult(constrainedResult, {
      route: "generateContent+googleSearch",
      contract: ["allowedDomains", "freshness", "maxOutputTokens"]
    })
  });

  return rows;
}

function printRows(rows: SmokeRow[]): void {
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

async function main(): Promise<void> {
  const provider = parseProviderArg(process.argv.slice(2));
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

  if (rows.some((row) => !row.ok)) {
    process.exitCode = 1;
  }
}

await main();
