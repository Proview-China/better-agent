import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatCompletionMessagesFromPromptParts,
  buildResponsesInputFromPromptParts,
  readPromptMessagesMetadata,
} from "./prompt-message-parts.js";

test("readPromptMessagesMetadata parses layered prompt messages", () => {
  const result = readPromptMessagesMetadata([
    { role: "system", content: "system text" },
    { role: "developer", content: "developer text" },
    { role: "user", content: "user text" },
  ]);

  assert.equal(result?.length, 3);
  assert.equal(result?.[1]?.role, "developer");
});

test("buildChatCompletionMessagesFromPromptParts appends images to the last user message", () => {
  const messages = buildChatCompletionMessagesFromPromptParts({
    instructionText: "fallback",
    promptMessages: [
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ],
    inputImageUrls: ["data:image/png;base64,AAAA"],
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[1]?.role, "user");
  assert.ok(Array.isArray(messages[1]?.content));
});

test("buildResponsesInputFromPromptParts lowers layered messages for responses input", () => {
  const input = buildResponsesInputFromPromptParts({
    instructionText: "fallback",
    promptMessages: [
      { role: "system", content: "system" },
      { role: "developer", content: "developer" },
      { role: "user", content: "user" },
    ],
  });

  assert.ok(Array.isArray(input));
  assert.equal(input.length, 3);
  assert.equal(input[0]?.role, "system");
});
