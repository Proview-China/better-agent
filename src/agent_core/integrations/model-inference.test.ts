import assert from "node:assert/strict";
import test from "node:test";

import {
  omitResponsesMetadataForGatewayRetry,
  shouldRetryOpenAIResponsesOnTransientGateway,
  shouldRetryOpenAIResponsesOnRateLimit,
  shouldRetryOpenAIResponsesWithoutMetadata,
} from "./model-inference.js";

test("omitResponsesMetadataForGatewayRetry removes top-level metadata only", () => {
  const result = omitResponsesMetadataForGatewayRetry({
    model: "gpt-5.4",
    input: "hello",
    stream: false,
    metadata: {
      provider: "openai",
      variant: "responses",
    },
  });

  assert.deepEqual(result, {
    model: "gpt-5.4",
    input: "hello",
    stream: false,
  });
});

test("shouldRetryOpenAIResponsesWithoutMetadata returns true for responses metadata gateway failures", () => {
  const result = shouldRetryOpenAIResponsesWithoutMetadata({
    invocation: {
      payload: {
        surface: "responses",
        sdkMethodPath: "client.responses.create",
        params: {
          model: "gpt-5.4",
          input: "hello",
          metadata: {
            provider: "openai",
          },
        },
      },
    },
    error: {
      status: 502,
    },
  });

  assert.equal(result, true);
});

test("shouldRetryOpenAIResponsesWithoutMetadata stays false when metadata is absent or surface differs", () => {
  assert.equal(shouldRetryOpenAIResponsesWithoutMetadata({
    invocation: {
      payload: {
        surface: "responses",
        sdkMethodPath: "client.responses.create",
        params: {
          model: "gpt-5.4",
          input: "hello",
        },
      },
    },
    error: {
      status: 502,
    },
  }), false);

  assert.equal(shouldRetryOpenAIResponsesWithoutMetadata({
    invocation: {
      payload: {
        surface: "chat_completions",
        sdkMethodPath: "client.chat.completions.create",
        params: {
          model: "gpt-5.4",
          messages: [],
          metadata: {
            provider: "openai",
          },
        },
      },
    },
    error: {
      status: 403,
    },
  }), false);
});

test("shouldRetryOpenAIResponsesOnRateLimit returns true only for responses 429", () => {
  assert.equal(shouldRetryOpenAIResponsesOnRateLimit({
    invocation: {
      payload: {
        surface: "responses",
        sdkMethodPath: "client.responses.create",
        params: {
          model: "gpt-5.4",
          input: "hello",
        },
      },
    },
    error: {
      status: 429,
    },
  }), true);

  assert.equal(shouldRetryOpenAIResponsesOnRateLimit({
    invocation: {
      payload: {
        surface: "chat_completions",
        sdkMethodPath: "client.chat.completions.create",
        params: {
          model: "gpt-5.4",
          messages: [],
        },
      },
    },
    error: {
      status: 429,
    },
  }), false);
});

test("shouldRetryOpenAIResponsesOnTransientGateway returns true only for responses 503", () => {
  assert.equal(shouldRetryOpenAIResponsesOnTransientGateway({
    invocation: {
      payload: {
        surface: "responses",
        sdkMethodPath: "client.responses.create",
        params: {
          model: "gpt-5.4",
          input: "hello",
        },
      },
    },
    error: {
      status: 503,
    },
  }), true);

  assert.equal(shouldRetryOpenAIResponsesOnTransientGateway({
    invocation: {
      payload: {
        surface: "chat_completions",
        sdkMethodPath: "client.chat.completions.create",
        params: {
          model: "gpt-5.4",
          messages: [],
        },
      },
    },
    error: {
      status: 503,
    },
  }), false);
});
