import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPendingComposerVisibleWindow,
  compactPendingComposerText,
  formatPendingComposerOrdinal,
  PENDING_COMPOSER_MAX_NARROW,
  PENDING_COMPOSER_MAX_WIDE,
  shouldSummarizePendingComposerText,
  takeNextPendingComposerDispatchBatch,
} from "./pending-composer-submissions.js";

test("takeNextPendingComposerDispatchBatch groups leading waiting items", () => {
  const entries = [
    { mode: "waiting" as const, text: "first" },
    { mode: "waiting" as const, text: "second" },
    { mode: "queue" as const, text: "third" },
  ];
  assert.deepEqual(
    takeNextPendingComposerDispatchBatch(entries).map((entry) => entry.text),
    ["first", "second"],
  );
});

test("takeNextPendingComposerDispatchBatch lets queue lead a batch and absorb following waiting items", () => {
  const entries = [
    { mode: "queue" as const, text: "first" },
    { mode: "waiting" as const, text: "second" },
    { mode: "waiting" as const, text: "third" },
    { mode: "queue" as const, text: "fourth" },
  ];
  assert.deepEqual(
    takeNextPendingComposerDispatchBatch(entries).map((entry) => entry.text),
    ["first", "second", "third"],
  );
});

test("buildPendingComposerVisibleWindow shows the newest five items by default", () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({ sequence: index + 1 }));
  const window = buildPendingComposerVisibleWindow(entries, 0);

  assert.deepEqual(window.visibleItems.map((entry) => entry.sequence), [7, 6, 5, 4, 3]);
  assert.equal(window.hiddenCount, 2);
  assert.equal(window.maxOffset, 2);
});

test("buildPendingComposerVisibleWindow browses older items when offset increases", () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({ sequence: index + 1 }));
  const window = buildPendingComposerVisibleWindow(entries, 2);

  assert.deepEqual(window.visibleItems.map((entry) => entry.sequence), [5, 4, 3, 2, 1]);
  assert.equal(window.hiddenCount, 0);
});

test("formatPendingComposerOrdinal switches to three digits at 100+", () => {
  assert.equal(formatPendingComposerOrdinal(7, 8), "07");
  assert.equal(formatPendingComposerOrdinal(7, 108), "007");
});

test("shouldSummarizePendingComposerText respects wide and narrow caps", () => {
  assert.equal(shouldSummarizePendingComposerText("a".repeat(PENDING_COMPOSER_MAX_NARROW)), false);
  assert.equal(shouldSummarizePendingComposerText("a".repeat(PENDING_COMPOSER_MAX_NARROW + 1)), true);
  assert.equal(shouldSummarizePendingComposerText("你".repeat(PENDING_COMPOSER_MAX_WIDE)), false);
  assert.equal(shouldSummarizePendingComposerText("你".repeat(PENDING_COMPOSER_MAX_WIDE + 1)), true);
});

test("compactPendingComposerText trims long content into the display budget", () => {
  const compacted = compactPendingComposerText("请你做个详细的自我介绍详细一点我不明白啊我还想多知道一些");
  assert.match(compacted, /\.\.\.$/u);
  assert.equal(shouldSummarizePendingComposerText(compacted), false);
});
