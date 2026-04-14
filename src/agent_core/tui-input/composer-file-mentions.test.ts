import assert from "node:assert/strict";
import test from "node:test";

import { createTuiTextInputState } from "./text-input.js";
import {
  findActiveFileMentionToken,
  formatFileMentionToken,
  replaceFileMentionToken,
} from "./composer-file-mentions.js";

test("findActiveFileMentionToken detects the active @ token at cursor", () => {
  const value = "Please inspect @src/agent";
  const token = findActiveFileMentionToken(value, value.length);

  assert.deepEqual(token, {
    query: "src/agent",
    tokenText: "@src/agent",
    start: 15,
    end: value.length,
  });
});

test("formatFileMentionToken quotes paths with spaces", () => {
  assert.equal(formatFileMentionToken("src/direct-tui.tsx"), "@src/direct-tui.tsx");
  assert.equal(formatFileMentionToken("docs/My File.md"), '@"docs/My File.md"');
});

test("replaceFileMentionToken swaps the active token for a selected path", () => {
  const initial = createTuiTextInputState("Read @src/dir");
  const token = findActiveFileMentionToken(initial.value, initial.cursorOffset);
  assert.ok(token);

  const next = replaceFileMentionToken(initial, token, "src/agent_core/direct-tui.tsx");
  assert.equal(next.value, "Read @src/agent_core/direct-tui.tsx ");
  assert.equal(next.cursorOffset, next.value.length);
});
