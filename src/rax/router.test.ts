import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityAdapterDescriptor } from "./contracts.js";
import { createRaxFacade } from "./facade.js";
import { UnsupportedCapabilityError } from "./errors.js";
import { CapabilityRouter } from "./router.js";

const mockOpenAiGenerateCreate: CapabilityAdapterDescriptor<
  { prompt: string },
  { endpoint: string; body: object }
> = {
  id: "mock.openai.generate.create",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "openai",
  layer: "api",
  description: "Mock OpenAI generate.create adapter.",
  prepare(request) {
    return {
      key: this.key,
      provider: request.provider,
      model: request.model,
      layer: this.layer,
      adapterId: this.id,
      sdk: {
        packageName: "openai",
        entrypoint: "responses.create"
      },
      payload: {
        endpoint: "responses.create",
        body: {
          model: request.model,
          input: request.input.prompt
        }
      }
    };
  }
};

const mockDeepMindEmbedCreate: CapabilityAdapterDescriptor<
  { text: string },
  { endpoint: string; body: object }
> = {
  id: "mock.deepmind.embed.create",
  key: "embed.create",
  namespace: "embed",
  action: "create",
  provider: "deepmind",
  layer: "api",
  description: "Mock Gemini embed.create adapter.",
  prepare(request) {
    return {
      key: this.key,
      provider: request.provider,
      model: request.model,
      layer: this.layer,
      adapterId: this.id,
      sdk: {
        packageName: "@google/genai",
        entrypoint: "models.embedContent"
      },
      payload: {
        endpoint: "models.embedContent",
        body: {
          model: request.model,
          content: request.input.text
        }
      }
    };
  }
};

const mockOpenAiGenerateCreateCompat: CapabilityAdapterDescriptor<
  { prompt: string },
  { endpoint: string; body: object }
> = {
  id: "mock.openai.generate.create.compat",
  variant: "chat_completions_compat",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "openai",
  layer: "api",
  description: "Mock OpenAI generate.create compat adapter.",
  prepare(request) {
    return {
      key: this.key,
      provider: request.provider,
      model: request.model,
      layer: this.layer,
      variant: this.variant,
      adapterId: this.id,
      sdk: {
        packageName: "openai",
        entrypoint: "chat.completions.create"
      },
      payload: {
        endpoint: "chat.completions.create",
        body: {
          model: request.model,
          input: request.input.prompt
        }
      }
    };
  }
};

test("CapabilityRouter resolves a supported adapter and prepares an invocation", () => {
  const router = new CapabilityRouter([mockOpenAiGenerateCreate]);

  const invocation = router.prepare<{ prompt: string }, { endpoint: string; body: object }>({
    provider: "openai",
    model: "gpt-5",
    layer: "auto",
    capability: "generate",
    action: "create",
    input: { prompt: "hello" }
  });

  assert.equal(invocation.adapterId, "mock.openai.generate.create");
  assert.equal(invocation.layer, "api");
  assert.deepEqual(invocation.payload, {
    endpoint: "responses.create",
    body: {
      model: "gpt-5",
      input: "hello"
    }
  });
});

test("CapabilityRouter rejects unsupported capabilities from the registry", () => {
  const router = new CapabilityRouter([mockDeepMindEmbedCreate]);

  assert.throws(
    () =>
      router.prepare({
        provider: "anthropic",
        model: "claude-sonnet-4",
        layer: "auto",
        capability: "embed",
        action: "create",
        input: { text: "hello" }
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedCapabilityError);
      assert.equal(error.key, "embed.create");
      assert.equal(error.provider, "anthropic");
      return true;
    }
  );
});

test("CapabilityRouter resolves a specific adapter variant when requested", () => {
  const router = new CapabilityRouter([
    mockOpenAiGenerateCreate,
    mockOpenAiGenerateCreateCompat
  ]);

  const invocation = router.prepare<{ prompt: string }, { endpoint: string; body: object }>({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    variant: "chat_completions_compat",
    capability: "generate",
    action: "create",
    input: { prompt: "hello compat" }
  });

  assert.equal(invocation.adapterId, "mock.openai.generate.create.compat");
  assert.equal(invocation.variant, "chat_completions_compat");
});

test("createRaxFacade routes top-level methods through the router", () => {
  const router = new CapabilityRouter([mockOpenAiGenerateCreate, mockDeepMindEmbedCreate]);
  const rax = createRaxFacade(router);

  const generation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: { prompt: "route me" }
  });

  const embedding = rax.embed.create({
    provider: "deepmind",
    model: "gemini-embedding-001",
    input: { text: "vectorize me" }
  });

  assert.equal(generation.key, "generate.create");
  assert.equal(embedding.key, "embed.create");
  assert.equal(embedding.sdk.entrypoint, "models.embedContent");
});
