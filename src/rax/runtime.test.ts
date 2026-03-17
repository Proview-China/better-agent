import assert from "node:assert/strict";
import test from "node:test";

import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import { CompatibilityBlockedError, UnsupportedCapabilityError } from "./errors.js";
import { rax, raxLocal } from "./runtime.js";
import { WebSearchRuntime } from "./websearch-runtime.js";

test("default rax runtime routes OpenAI generate.create to Responses API by default", () => {
  const invocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: {
      input: "hello from rax"
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;

  assert.equal(invocation.adapterId, "openai.responses.generate.create");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(payload.surface, "responses");
});

test("default rax runtime can route OpenAI generate.create through compat variant", () => {
  const invocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    variant: "chat_completions_compat",
    input: {
      model: "gpt-5",
      messages: [{ role: "user", content: "compat please" }]
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;

  assert.equal(invocation.adapterId, "openai.chat_completions_compat.generate.create");
  assert.equal(invocation.variant, "chat_completions_compat");
  assert.equal(payload.surface, "chat_completions");
});

test("default rax runtime routes Anthropic generate.stream to Messages API", () => {
  const invocation = rax.generate.stream({
    provider: "anthropic",
    model: "claude-sonnet-4",
    input: {
      maxTokens: 256,
      messages: [{ role: "user", content: "stream this" }]
    }
  });
  const payload = invocation.payload as { stream: boolean };

  assert.equal(invocation.adapterId, "anthropic.api.generation.messages.stream");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(payload.stream, true);
});

test("default rax runtime routes Gemini embed.create to Gemini embedContent", () => {
  const invocation = rax.embed.create({
    provider: "deepmind",
    model: "gemini-embedding-001",
    input: {
      contents: "vectorize this"
    }
  });
  const payload = invocation.payload as { method: string };

  assert.equal(invocation.adapterId, "deepmind.api.embed.create.embed-content");
  assert.equal(invocation.sdk.packageName, "@google/genai");
  assert.equal(payload.method, "ai.models.embedContent");
});

test("default rax runtime rejects unsupported Anthropic embed.create", () => {
  assert.throws(
    () =>
      rax.embed.create({
        provider: "anthropic",
        model: "claude-sonnet-4",
        input: {
          text: "unsupported"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedCapabilityError);
      assert.equal(error.key, "embed.create");
      return true;
    }
  );
});

test("default rax runtime routes file.upload and batch.submit across providers", () => {
  const openAIFileUpload = rax.file.upload({
    provider: "openai",
    model: "gpt-5",
    input: {
      file: "demo.jsonl",
      purpose: "batch"
    }
  });

  const deepMindBatch = rax.batch.submit({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    input: {
      src: { inputUri: "gs://bucket/demo.jsonl" }
    }
  });
  const openAIPayload = openAIFileUpload.payload as OpenAIInvocationPayload<Record<string, unknown>>;
  const deepMindPayload = deepMindBatch.payload as { method: string };

  assert.equal(openAIFileUpload.adapterId, "openai.files.upload");
  assert.equal(openAIPayload.sdkMethodPath, "client.files.create");
  assert.equal(openAIPayload.surface, "files");
  assert.equal(deepMindBatch.adapterId, "deepmind.api.batch.submit.batches-create");
  assert.equal(deepMindPayload.method, "ai.batches.create");
});

test("default rax runtime routes OpenAI websearch.prepare to native Responses web_search", () => {
  const invocation = rax.websearch.prepare({
    provider: "openai",
    model: "gpt-5",
    input: {
      query: "latest OpenAI SDK search docs",
      goal: "Return a grounded answer with citations",
      allowedDomains: ["platform.openai.com"],
      blockedDomains: ["example.com"],
      maxSources: 2,
      maxOutputTokens: 128,
      citations: "required",
      searchContextSize: "high",
      userLocation: {
        city: "San Francisco",
        region: "CA",
        country: "US",
        timezone: "America/Los_Angeles"
      }
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;
  const params = payload.params as {
    include: string[];
    input: string;
    max_output_tokens: number;
    tools: Array<Record<string, unknown>>;
  };
  const webSearchTool = params.tools[0] as {
    type: string;
    filters?: {
      allowed_domains?: string[];
      blocked_domains?: string[];
    };
    search_context_size?: string;
    user_location?: {
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
    };
  };

  assert.equal(invocation.adapterId, "openai.responses.search.ground");
  assert.equal(payload.surface, "responses");
  assert.deepEqual(params.include, ["web_search_call.action.sources"]);
  assert.equal(params.max_output_tokens, 128);
  assert.match(params.input, /Goal: Return a grounded answer with citations/u);
  assert.match(params.input, /Target no more than 2 distinct cited sources/u);
  assert.equal(webSearchTool.type, "web_search");
  assert.deepEqual(webSearchTool.filters, {
    allowed_domains: ["platform.openai.com"],
    blocked_domains: ["example.com"]
  });
  assert.equal(webSearchTool.search_context_size, "high");
  assert.deepEqual(webSearchTool.user_location, {
    type: "approximate",
    city: "San Francisco",
    region: "CA",
    country: "US",
    timezone: "America/Los_Angeles"
  });
});

test("default rax runtime routes Anthropic websearch.prepare to Messages API server tools", () => {
  const invocation = rax.websearch.prepare({
    provider: "anthropic",
    model: "claude-sonnet-4",
    input: {
      query: "Anthropic web search tool behavior",
      urls: ["https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool"],
      citations: "required"
    }
  });
  const payload = invocation.payload as {
    max_tokens: number;
    messages: Array<{ content: string }>;
    tools: Array<{ name?: string; type?: string }>;
  };

  assert.equal(invocation.adapterId, "anthropic.api.tools.search.ground");
  assert.equal(invocation.layer, "api");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(payload.max_tokens, 1024);
  assert.match(
    payload.messages[0]?.content ?? "",
    /Primary query: Anthropic web search tool behavior/u
  );
  assert.match(
    payload.messages[0]?.content ?? "",
    /Known URLs to inspect if relevant:/u
  );
  assert.match(
    payload.messages[0]?.content ?? "",
    /Citations are required in the final answer\./u
  );
  assert.deepEqual(
    payload.tools.map((tool) => tool.name),
    ["web_search", "web_fetch"]
  );
});

test("default rax runtime routes Gemini websearch.prepare to native generateContent search tools", () => {
  const invocation = rax.websearch.prepare({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      query: "Gemini grounding with Google Search",
      urls: ["https://ai.google.dev/gemini-api/docs/google-search"]
    }
  });
  const payload = invocation.payload as {
    method: string;
    params: {
      config: {
        tools: Array<Record<string, unknown>>;
      };
    };
  };

  assert.equal(invocation.adapterId, "deepmind.api.search.ground.generate-content");
  assert.equal(payload.method, "ai.models.generateContent");
  assert.deepEqual(
    payload.params.config.tools.map((tool) => Object.keys(tool)[0]),
    ["googleSearch", "urlContext"]
  );
});

test("explicit Anthropic agent websearch.prepare keeps the Claude Code route and carries governed task context", () => {
  const invocation = rax.websearch.prepare({
    provider: "anthropic",
    model: "claude-sonnet-4",
    layer: "agent",
    input: {
      query: "Anthropic web search tool behavior",
      goal: "Return a grounded answer with citations",
      urls: ["https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool"],
      citations: "required"
    }
  });
  const payload = invocation.payload as {
    command: string;
    args: string[];
    prompt: string;
  };

  assert.equal(invocation.adapterId, "anthropic.agent.search.ground.claude-code");
  assert.equal(invocation.layer, "agent");
  assert.equal(payload.command, "claude");
  assert.match(payload.prompt, /Primary query: Anthropic web search tool behavior/u);
  assert.match(payload.prompt, /Goal: Return a grounded answer with citations/u);
  assert.match(payload.prompt, /Known URLs to inspect if relevant:/u);
});

test("Anthropic agent websearch runtime fails fast on Windows with a route-specific error", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-specific guard");
    return;
  }

  const runtime = new WebSearchRuntime();
  const invocation = rax.websearch.prepare({
    provider: "anthropic",
    model: "claude-sonnet-4",
    layer: "agent",
    input: {
      query: "Anthropic web search tool behavior",
      goal: "Return a grounded answer with citations"
    }
  });
  const result = await runtime.executePreparedInvocation(invocation);

  assert.equal(result.status, "failed");
  const error = result.error as { code: string; message: string };
  assert.equal(error.code, "websearch_failed");
  assert.match(error.message, /use layer: "api" on Windows/u);
});

test("raxLocal uses compatibility profile to default OpenAI generation to chat_completions_compat", () => {
  const invocation = raxLocal.generate.create({
    provider: "openai",
    model: "gpt-5",
    compatibilityProfileId: "openai-chat-only-gateway",
    input: {
      model: "gpt-5",
      messages: [{ role: "user", content: "compat gateway" }]
    }
  });

  assert.equal(invocation.adapterId, "openai.chat_completions_compat.generate.create");
  assert.equal(invocation.variant, "chat_completions_compat");
});

test("raxLocal websearch.create returns a blocked result on unofficial OpenAI-compatible gateway", async () => {
  const result = await raxLocal.websearch.create({
    provider: "openai",
    model: "gpt-5",
    compatibilityProfileId: "openai-chat-only-gateway",
    input: {
      query: "compat gateway should not imply official search"
    }
  });

  assert.equal(result.status, "blocked");
  const error = result.error as {
    code: string;
    message: string;
    raw: CompatibilityBlockedError;
  };
  assert.equal(error.code, "blocked_by_compatibility_profile");
  assert.match(error.message, /openai search\.ground is disabled by compatibility profile openai-chat-only-gateway\./u);
  const raw = error.raw;
  assert.ok(raw instanceof CompatibilityBlockedError);
  assert.equal(raw.key, "search.ground");
  assert.equal(raw.profileId, "openai-chat-only-gateway");
});

test("raxLocal blocks Anthropic file.upload on messages-only compatibility profile", () => {
  assert.throws(
    () =>
      raxLocal.file.upload({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        compatibilityProfileId: "anthropic-messages-only-primary",
        input: {
          file: "demo.txt"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "file.upload");
      assert.equal(error.profileId, "anthropic-messages-only-primary");
      return true;
    }
  );
});
