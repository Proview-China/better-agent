import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRaxodeTerminalTitle,
  buildTerminalTitleSequence,
  writeTerminalTitle,
} from "./terminal-title.js";

test("buildRaxodeTerminalTitle returns plain and animated Raxode titles", () => {
  assert.equal(buildRaxodeTerminalTitle(), "Raxode");
  assert.equal(buildRaxodeTerminalTitle(0), "🌑 Raxode");
  assert.equal(buildRaxodeTerminalTitle(4), "🌕 Raxode");
  assert.equal(buildRaxodeTerminalTitle(8), "🌑 Raxode");
});

test("writeTerminalTitle writes OSC title sequences only for TTY outputs", () => {
  const chunks: string[] = [];
  writeTerminalTitle("Raxode", {
    isTTY: true,
    write(chunk) {
      chunks.push(chunk);
    },
  });
  assert.deepEqual(chunks, [buildTerminalTitleSequence("Raxode")]);

  writeTerminalTitle("Raxode", {
    isTTY: false,
    write(chunk) {
      chunks.push(chunk);
    },
  });
  assert.deepEqual(chunks, [buildTerminalTitleSequence("Raxode")]);
});
