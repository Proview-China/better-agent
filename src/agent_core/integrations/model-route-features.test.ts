import assert from "node:assert/strict";
import test from "node:test";

import {
  formatProviderModelSelectionValue,
  parseProviderModelSelectionValue,
  providerRouteDisplayName,
  providerRouteReasoningLabel,
  providerRouteSupportsFast,
  providerRouteSupportsReasoning,
  resolveProviderRouteKind,
  sanitizeProviderRouteFeatureOptions,
} from "./model-route-features.js";

test("resolveProviderRouteKind distinguishes responses, chat completions, anthropic, and deepmind routes", () => {
  assert.equal(resolveProviderRouteKind({
    provider: "openai",
    baseURL: "https://gmn.example.com/v1",
    apiStyle: "responses",
  }), "openai_responses");
  assert.equal(resolveProviderRouteKind({
    provider: "openai",
    baseURL: "https://viewpro.top/v1",
    apiStyle: "chat/completions",
  }), "openai_chat_completions");
  assert.equal(resolveProviderRouteKind({
    provider: "anthropic",
    baseURL: "https://anthropic.example.com",
    apiStyle: "messages",
  }), "anthropic_messages");
  assert.equal(resolveProviderRouteKind({
    provider: "deepmind",
    baseURL: "https://deepmind.example.com",
    apiStyle: "generateContent",
  }), "deepmind_generateContent");
});

test("provider route capability helpers expose the intended UI and runtime flags", () => {
  assert.equal(providerRouteDisplayName("openai_responses"), "GPT Compatible (Responses API)");
  assert.equal(providerRouteDisplayName("openai_chat_completions"), "Gemini Compatible (Chat Completions API)");
  assert.equal(providerRouteDisplayName("anthropic_messages"), "Anthropic Compatible (Messages API)");
  assert.equal(providerRouteReasoningLabel("openai_responses"), "Reasoning");
  assert.equal(providerRouteReasoningLabel("anthropic_messages"), "Thinking");
  assert.equal(providerRouteReasoningLabel("openai_chat_completions"), null);
  assert.equal(providerRouteSupportsReasoning("openai_responses"), true);
  assert.equal(providerRouteSupportsReasoning("anthropic_messages"), true);
  assert.equal(providerRouteSupportsReasoning("openai_chat_completions"), false);
  assert.equal(providerRouteSupportsFast("openai_responses"), true);
  assert.equal(providerRouteSupportsFast("anthropic_messages"), false);
});

test("provider model selection formatting and parsing stay provider-aware", () => {
  const openaiValue = formatProviderModelSelectionValue({
    routeKind: "openai_responses",
    model: "gpt-5.4",
    reasoning: "high",
    serviceTierFastEnabled: true,
  });
  assert.equal(openaiValue, "gpt-5.4 with high effort [FAST]");
  assert.deepEqual(parseProviderModelSelectionValue("openai_responses", openaiValue), {
    model: "gpt-5.4",
    reasoning: "high",
    serviceTierFastEnabled: true,
  });

  const anthropicValue = formatProviderModelSelectionValue({
    routeKind: "anthropic_messages",
    model: "claude-sonnet-4-6",
    reasoning: "medium",
  });
  assert.equal(anthropicValue, "claude-sonnet-4-6 with medium thinking");
  assert.deepEqual(parseProviderModelSelectionValue("anthropic_messages", anthropicValue), {
    model: "claude-sonnet-4-6",
    reasoning: "medium",
    serviceTierFastEnabled: false,
  });

  const geminiValue = formatProviderModelSelectionValue({
    routeKind: "openai_chat_completions",
    model: "gemini-3.1-pro-preview",
  });
  assert.equal(geminiValue, "gemini-3.1-pro-preview");
  assert.deepEqual(parseProviderModelSelectionValue("openai_chat_completions", geminiValue), {
    model: "gemini-3.1-pro-preview",
    serviceTierFastEnabled: false,
  });
});

test("sanitizeProviderRouteFeatureOptions strips unsupported reasoning and FAST metadata", () => {
  assert.deepEqual(
    sanitizeProviderRouteFeatureOptions("openai_responses", {
      reasoningEffort: "high",
      serviceTier: "fast",
    }),
    {
      reasoningEffort: "high",
      serviceTier: "fast",
    },
  );
  assert.deepEqual(
    sanitizeProviderRouteFeatureOptions("anthropic_messages", {
      reasoningEffort: "high",
      serviceTier: "fast",
    }),
    {
      reasoningEffort: "high",
      serviceTier: undefined,
    },
  );
  assert.deepEqual(
    sanitizeProviderRouteFeatureOptions("openai_chat_completions", {
      reasoningEffort: "high",
      serviceTier: "fast",
    }),
    {
      reasoningEffort: undefined,
      serviceTier: undefined,
    },
  );
});
