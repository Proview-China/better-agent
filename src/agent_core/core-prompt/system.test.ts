import assert from "node:assert/strict";
import test from "node:test";

import { CORE_SYSTEM_PROMPT_V1_TEXT, createCoreSystemPromptPack } from "./system.js";

test("createCoreSystemPromptPack returns stable pack id and text", () => {
  const pack = createCoreSystemPromptPack();

  assert.equal(pack.promptPackId, "core-system/v1");
  assert.equal(pack.text, CORE_SYSTEM_PROMPT_V1_TEXT);
});

test("core system prompt keeps long-term identity and avoids runtime schema clutter", () => {
  assert.match(CORE_SYSTEM_PROMPT_V1_TEXT, /You are Praxis Core\./);
  assert.match(CORE_SYSTEM_PROMPT_V1_TEXT, /CMP is the context-management surface\./);
  assert.doesNotMatch(CORE_SYSTEM_PROMPT_V1_TEXT, /shell\.restricted/);
  assert.doesNotMatch(CORE_SYSTEM_PROMPT_V1_TEXT, /Exact JSON schema/);
});
