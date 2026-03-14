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
