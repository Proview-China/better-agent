import test from "node:test";
import assert from "node:assert/strict";

import { resolveNextOptimisticTurnIndex } from "./optimistic-turn-index.js";

test("resolveNextOptimisticTurnIndex uses transcript and usage data when surface turns are stale", () => {
  const nextTurnIndex = resolveNextOptimisticTurnIndex({
    existingTurns: [],
    transcriptMessages: [
      { turnId: "turn-1" },
      { turnId: "turn-2" },
    ],
    usageLedger: [
      { turnId: "turn-3" },
    ],
    pendingOutboundTurns: [],
  });

  assert.equal(nextTurnIndex, 4);
});

test("resolveNextOptimisticTurnIndex accounts for queued optimistic turns", () => {
  const nextTurnIndex = resolveNextOptimisticTurnIndex({
    existingTurns: [{ turnIndex: 2 }],
    transcriptMessages: [],
    usageLedger: [],
    pendingOutboundTurns: [
      { turnIndex: 3 },
      { turnIndex: 4 },
    ],
  });

  assert.equal(nextTurnIndex, 5);
});

test("resolveNextOptimisticTurnIndex ignores invalid turn ids", () => {
  const nextTurnIndex = resolveNextOptimisticTurnIndex({
    existingTurns: [{ turnIndex: Number.NaN }],
    transcriptMessages: [{ turnId: "" }, { turnId: "oops" }],
    usageLedger: [{ turnId: undefined }],
    pendingOutboundTurns: [],
  });

  assert.equal(nextTurnIndex, 1);
});
