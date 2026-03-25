import assert from "node:assert/strict";
import test from "node:test";

import { LOCAL_GATEWAY_COMPATIBILITY_PROFILES } from "./compatibility.js";
import type { CapabilityAdapterDescriptor } from "./contracts.js";
import { createConfiguredRaxFacade, createRaxFacade } from "./facade.js";
import { CompatibilityBlockedError, UnsupportedCapabilityError } from "./errors.js";
import { CapabilityRouter } from "./router.js";
import type { CapabilityResult } from "./types.js";
import type { WebSearchOutput } from "./websearch-types.js";
import type { WebSearchRuntimeLike } from "./websearch-runtime.js";

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

test("createRaxFacade routes websearch.create through the injected runtime", async () => {
  const mockWebSearchGround: CapabilityAdapterDescriptor<
    { query: string },
    { endpoint: string; body: object }
  > = {
    id: "mock.openai.search.ground",
    key: "search.ground",
    namespace: "search",
    action: "ground",
    provider: "openai",
    layer: "api",
    description: "Mock OpenAI search.ground adapter.",
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
            query: request.input.query
          }
        }
      };
    }
  };

  const fakeWebSearchRuntime: WebSearchRuntimeLike = {
    async executePreparedInvocation(invocation): Promise<CapabilityResult<WebSearchOutput>> {
      return {
        status: "success",
        provider: invocation.provider,
        model: invocation.model,
        layer: invocation.layer,
        capability: "search",
        action: "ground",
        output: {
          answer: "mock answer",
          citations: [],
          sources: []
        }
      };
    },
    createErrorResult() {
      throw new Error("createErrorResult should not be called in this test.");
    }
  };

  const router = new CapabilityRouter([mockOpenAiGenerateCreate, mockDeepMindEmbedCreate, mockWebSearchGround]);
  const rax = createRaxFacade(router, undefined, undefined, fakeWebSearchRuntime);

  const result = await rax.websearch.create({
    provider: "openai",
    model: "gpt-5",
    input: { query: "route me" }
  });

  assert.equal(result.status, "success");
  assert.equal(result.output?.answer, "mock answer");
});

test("configured facade keeps official websearch routes unblocked and reports compatibility blocks clearly", async () => {
  const mockWebSearchGround: CapabilityAdapterDescriptor<
    { query: string },
    { endpoint: string; body: object }
  > = {
    id: "mock.openai.search.ground",
    key: "search.ground",
    namespace: "search",
    action: "ground",
    provider: "openai",
    layer: "api",
    description: "Mock OpenAI search.ground adapter.",
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
            query: request.input.query
          }
        }
      };
    }
  };

  const fakeWebSearchRuntime: WebSearchRuntimeLike = {
    async executePreparedInvocation(invocation): Promise<CapabilityResult<WebSearchOutput>> {
      return {
        status: "success",
        provider: invocation.provider,
        model: invocation.model,
        layer: invocation.layer,
        capability: "search",
        action: "ground",
        output: {
          answer: "official route answer",
          citations: [],
          sources: []
        }
      };
    },
    createErrorResult(params) {
      const message =
        params.error instanceof Error
          ? params.error.message
          : "Unknown websearch error.";

      return {
        status: params.error instanceof CompatibilityBlockedError ? "blocked" : "failed",
        provider: params.provider,
        model: params.model,
        layer: "api",
        capability: "search",
        action: "ground",
        error: {
          code:
            params.error instanceof CompatibilityBlockedError
              ? params.error.code
              : "websearch_failed",
          message,
          raw: params.error
        }
      };
    }
  };

  const router = new CapabilityRouter([mockWebSearchGround]);

  const official = createConfiguredRaxFacade(
    router,
    undefined,
    undefined,
    fakeWebSearchRuntime
  );
  const officialResult = await official.websearch.create({
    provider: "openai",
    model: "gpt-5",
    input: { query: "official route" }
  });
  assert.equal(officialResult.status, "success");
  assert.equal(officialResult.output?.answer, "official route answer");

  const compat = createConfiguredRaxFacade(
    router,
    LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
    undefined,
    fakeWebSearchRuntime
  );
  const compatResult = await compat.websearch.create({
    provider: "openai",
    model: "gpt-5",
    compatibilityProfileId: "openai-chat-only-gateway",
    input: { query: "compat route" }
  });

  assert.equal(compatResult.status, "blocked");
  const error = compatResult.error as {
    code: string;
    message: string;
    raw: CompatibilityBlockedError;
  };
  assert.equal(error.code, "blocked_by_compatibility_profile");
  assert.match(error.message, /compatibility profile openai-chat-only-gateway/u);
  assert.ok(error.raw instanceof CompatibilityBlockedError);
});
