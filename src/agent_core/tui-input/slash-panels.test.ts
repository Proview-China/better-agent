import assert from "node:assert/strict";
import test from "node:test";

import {
  cycleChoiceValue,
  findNextInteractiveFieldIndex,
  findPrimaryActionField,
  type PraxisSlashPanelField,
} from "./slash-panels.js";

test("findNextInteractiveFieldIndex skips value-only rows and wraps", () => {
  const fields: PraxisSlashPanelField[] = [
    { kind: "value", key: "status", label: "Status", value: "ready" },
    { kind: "choice", key: "model", label: "Model", value: "gpt-5.4", options: ["gpt-5.4", "gpt-5.4-mini"] },
    { kind: "value", key: "route", label: "Route", value: "https://example.test" },
    { kind: "action", key: "apply", label: "Apply" },
  ];

  assert.equal(findNextInteractiveFieldIndex(fields, 1, 1), 3);
  assert.equal(findNextInteractiveFieldIndex(fields, 3, 1), 1);
  assert.equal(findNextInteractiveFieldIndex(fields, 3, -1), 1);
  assert.equal(findNextInteractiveFieldIndex(fields, 0, 1), 1);
});

test("cycleChoiceValue moves across options in both directions", () => {
  const field: PraxisSlashPanelField = {
    kind: "choice",
    key: "reasoning",
    label: "Reasoning",
    value: "medium",
    options: ["low", "medium", "high"],
  };

  if (field.kind !== "choice") {
    throw new Error("expected choice field");
  }

  assert.equal(cycleChoiceValue(field, "medium", 1), "high");
  assert.equal(cycleChoiceValue(field, "medium", -1), "low");
  assert.equal(cycleChoiceValue(field, "high", 1), "low");
});

test("findPrimaryActionField prefers explicit primary action", () => {
  const fields: PraxisSlashPanelField[] = [
    { kind: "action", key: "secondary", label: "Secondary" },
    { kind: "action", key: "primary", label: "Primary", primary: true },
  ];

  assert.equal(findPrimaryActionField(fields)?.key, "primary");
});
