import assert from "node:assert/strict";
import test from "node:test";

import { rewindDialogueTranscript } from "./rewind.js";

test("rewindDialogueTranscript trims transcript to the selected turn boundary", () => {
  const rewound = rewindDialogueTranscript([
    { role: "user", text: "u1" },
    { role: "assistant", text: "a1" },
    { role: "user", text: "u2" },
    { role: "assistant", text: "a2" },
    { role: "user", text: "u3" },
    { role: "assistant", text: "a3" },
  ], 3, 2);

  assert.equal(rewound.nextTurnIndex, 2);
  assert.equal(rewound.removedTurns, 1);
  assert.deepEqual(rewound.transcript, [
    { role: "user", text: "u1" },
    { role: "assistant", text: "a1" },
    { role: "user", text: "u2" },
    { role: "assistant", text: "a2" },
  ]);
});

test("rewindDialogueTranscript rejects invalid targets", () => {
  assert.throws(() => rewindDialogueTranscript([], 3, 0), /positive turn index/u);
  assert.throws(() => rewindDialogueTranscript([], 3, 4), /current turn is 3/u);
});
