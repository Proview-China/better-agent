import test from "node:test";
import assert from "node:assert/strict";

import {
  applySlashSuggestion,
  computeSlashState,
  DEFAULT_PRAXIS_SLASH_COMMANDS,
  formatSlashDisplayText,
} from "./slash-engine.js";

test("computeSlashState returns ranked suggestions for slash prefixes", () => {
  const state = computeSlashState("/st", DEFAULT_PRAXIS_SLASH_COMMANDS);
  assert.equal(state.active, true);
  assert.equal(state.suggestions[0]?.command.name, "status");
});

test("computeSlashState includes alias matches", () => {
  const state = computeSlashState("/qui", DEFAULT_PRAXIS_SLASH_COMMANDS);
  assert.equal(state.suggestions[0]?.command.name, "exit");
});

test("computeSlashState hides language from the default slash menu", () => {
  const state = computeSlashState("/", DEFAULT_PRAXIS_SLASH_COMMANDS);
  assert.equal(state.suggestions.some((suggestion) => suggestion.command.id === "language"), false);
});

test("computeSlashState only activates when first character is slash", () => {
  const state = computeSlashState(" /st", DEFAULT_PRAXIS_SLASH_COMMANDS);
  assert.equal(state.active, false);
  assert.equal(state.suggestions.length, 0);
});

test("applySlashSuggestion replaces current command token and keeps trailing content", () => {
  const suggestion = computeSlashState("/sta foo", DEFAULT_PRAXIS_SLASH_COMMANDS).suggestions[0];
  assert.ok(suggestion);
  const applied = applySlashSuggestion("/sta foo", suggestion);
  assert.equal(applied.nextInput, "/status foo");
  assert.equal(applied.nextCursorOffset, applied.nextInput.length);
});

test("default slash commands expose the planned first-wave order", () => {
  assert.deepEqual(
    DEFAULT_PRAXIS_SLASH_COMMANDS.map((command) => command.id),
    [
      "model",
      "status",
      "rush",
      "exit",
      "cmp",
      "mp",
      "capabilities",
      "init",
      "resume",
      "agents",
      "permissions",
      "workspace",
      "language",
    ],
  );
});

test("formatSlashDisplayText includes aliases inline for menu display", () => {
  const exitCommand = DEFAULT_PRAXIS_SLASH_COMMANDS.find((command) => command.id === "exit");
  assert.ok(exitCommand);
  assert.equal(formatSlashDisplayText(exitCommand), "/exit(quit)");
});
