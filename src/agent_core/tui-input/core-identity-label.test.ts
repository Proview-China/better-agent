import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoreIdentityLabelPresentation,
  formatApiRouteIdentityText,
  formatChatGPTPlanLabel,
  resolveChatGPTPlanTone,
} from "./core-identity-label.js";

test("formatApiRouteIdentityText uses the new endpoint wording", () => {
  assert.equal(formatApiRouteIdentityText("openai_responses"), "GPT Endpoint (Responses API)");
  assert.equal(formatApiRouteIdentityText("openai_chat_completions"), "GPT Compatible (Completions API)");
  assert.equal(formatApiRouteIdentityText("anthropic_messages"), "Anthropic Endpoint (Messages API)");
});

test("formatChatGPTPlanLabel normalizes known subscription tiers", () => {
  assert.equal(formatChatGPTPlanLabel("pro"), "Pro");
  assert.equal(formatChatGPTPlanLabel("plus"), "Plus");
  assert.equal(formatChatGPTPlanLabel("pro20x"), "Pro20x");
  assert.equal(formatChatGPTPlanLabel("pro_5x"), "Pro5x");
  assert.equal(formatChatGPTPlanLabel("enterprise_custom"), "Enterprise Custom");
});

test("resolveChatGPTPlanTone maps subscription tiers onto display tones", () => {
  assert.equal(resolveChatGPTPlanTone("pro"), "planPro");
  assert.equal(resolveChatGPTPlanTone("pro5x"), "planPro5x");
  assert.equal(resolveChatGPTPlanTone("plus"), "planPlus");
  assert.equal(resolveChatGPTPlanTone("go"), "planGo");
  assert.equal(resolveChatGPTPlanTone("free"), "planFree");
  assert.equal(resolveChatGPTPlanTone("unknown"), undefined);
});

test("buildCoreIdentityLabelPresentation prefers subscription identity for official auth", () => {
  const presentation = buildCoreIdentityLabelPresentation({
    authMode: "chatgpt_oauth",
    planType: "plus",
    routeKind: "openai_responses",
  });

  assert.equal(presentation.kind, "subscription");
  assert.equal(presentation.text, "ChatGPT Account with Plus Subscription");
  assert.deepEqual(presentation.valueSegments, [
    { text: "ChatGPT Account with " },
    { text: "Plus", tone: "planPlus" },
    { text: " Subscription" },
  ]);
});

test("buildCoreIdentityLabelPresentation falls back to route identity for api auth", () => {
  const presentation = buildCoreIdentityLabelPresentation({
    authMode: "api_key",
    routeKind: "anthropic_messages",
  });

  assert.equal(presentation.kind, "route");
  assert.equal(presentation.text, "Anthropic Endpoint (Messages API)");
  assert.deepEqual(presentation.valueSegments, [{ text: "Anthropic Endpoint (Messages API)" }]);
});
