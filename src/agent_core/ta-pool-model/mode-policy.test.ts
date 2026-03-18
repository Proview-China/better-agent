import assert from "node:assert/strict";
import test from "node:test";

import { getModePolicyEntry, getModePolicyMatrix } from "./mode-policy.js";

test("mode policy matrix encodes the first-wave strict balanced yolo behavior", () => {
  const matrix = getModePolicyMatrix();
  assert.equal(matrix.strict.B1, "review");
  assert.equal(matrix.strict.B3, "escalate_to_human");
  assert.equal(matrix.balanced.B3, "interrupt");
  assert.equal(matrix.yolo.B1, "allow");
});

test("mode policy entry marks yolo B3 as a safety airbag path", () => {
  const entry = getModePolicyEntry("yolo", "B3");
  assert.equal(entry.decision, "interrupt");
  assert.equal(entry.actsAsSafetyAirbag, true);
  assert.equal(entry.requiresHuman, false);
});

test("mode policy entry marks strict B3 as human escalation", () => {
  const entry = getModePolicyEntry("strict", "B3");
  assert.equal(entry.decision, "escalate_to_human");
  assert.equal(entry.requiresHuman, true);
});
