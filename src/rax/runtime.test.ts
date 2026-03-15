import assert from "node:assert/strict";
import test from "node:test";

import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import { CompatibilityBlockedError, UnsupportedCapabilityError } from "./errors.js";
import { rax, raxLocal } from "./runtime.js";

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
      citations: "required",
      searchContextSize: "high"
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;
  const params = payload.params as {
    include: string[];
    tools: Array<Record<string, unknown>>;
  };

  assert.equal(invocation.adapterId, "openai.responses.search.ground");
  assert.equal(payload.surface, "responses");
  assert.deepEqual(params.include, ["web_search_call.action.sources"]);
  assert.equal(params.tools[0]?.type, "web_search");
});

test("default rax runtime routes Anthropic websearch.prepare to Claude Code agent search path", () => {
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
    command: string;
    args: string[];
    prompt: string;
  };

  assert.equal(invocation.adapterId, "anthropic.agent.search.ground.claude-code");
  assert.equal(invocation.layer, "agent");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/claude-agent-sdk");
  assert.equal(payload.command, "claude");
  assert.deepEqual(payload.args, ["-p", "--model", "claude-sonnet-4", "--output-format", "json"]);
  assert.equal(payload.prompt, "Anthropic web search tool behavior");
});

test("default rax runtime routes Gemini websearch.prepare to native interactions search tools", () => {
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
      tools: Array<{ type: string }>;
    };
  };

  assert.equal(invocation.adapterId, "deepmind.api.search.ground.interactions-create");
  assert.equal(payload.method, "ai.interactions.create");
  assert.deepEqual(
    payload.params.tools.map((tool) => tool.type),
    ["google_search", "url_context"]
  );
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
