import assert from "node:assert/strict";
import test from "node:test";

import type { PraxisSlashPanelField } from "./slash-panels.js";
import {
  buildPermissionModeMatrixLines,
  describePermissionMode,
  findPermissionPanelFocusIndex,
  resolvePermissionPanelSelectedMode,
} from "./permissions-panel.js";

test("buildPermissionModeMatrixLines appends a yellow indented description line", () => {
  const lines = buildPermissionModeMatrixLines("standard");
  const descriptionLine = lines.at(-1);

  assert.ok(descriptionLine);
  assert.equal(descriptionLine?.tone, "warning");
  assert.match(descriptionLine?.text ?? "", /^ {4}standard:/u);
  assert.match(descriptionLine?.text ?? "", /dangerous work escalates to human gate|risky work stays governed/u);
});

test("describePermissionMode reflects the frozen TAP semantics in English", () => {
  assert.match(describePermissionMode("bapr"), /external read requests stay on the fast path/u);
  assert.match(describePermissionMode("yolo"), /external reads can still be governed/u);
  assert.match(describePermissionMode("restricted"), /risky external access/u);
  assert.doesNotMatch(describePermissionMode("standard"), /[\u4e00-\u9fff]/u);
});

test("buildPermissionModeMatrixLines can show persisted allow counts", () => {
  const lines = buildPermissionModeMatrixLines("permissive", {
    persistedAllowRuleCount: 2,
  });
  const persistedLine = lines.at(-1);

  assert.ok(persistedLine);
  assert.equal(persistedLine?.tone, "success");
  assert.match(persistedLine?.text ?? "", /persisted allows in this workspace: 2/u);
});

test("buildPermissionModeMatrixLines can show common write-lane previews and the latest attempt", () => {
  const lines = buildPermissionModeMatrixLines("standard", {
    previewRecords: [
      {
        capabilityKey: "repo.write",
        requestedMode: "standard",
        derivedRiskLevel: "normal",
        routeDecision: "review",
      },
      {
        capabilityKey: "code.edit",
        requestedMode: "standard",
        effectiveMode: "restricted",
        derivedRiskLevel: "risky",
        routeDecision: "human_gate",
        matchedToolPolicy: "human_gate",
        matchedToolPolicySelector: "code.edit",
      },
    ],
    lastAttempt: {
      capabilityKey: "code.edit",
      routeDecision: "human_gate",
      finalStatus: "failed",
      derivedRiskLevel: "risky",
      errorCode: "code_edit_old_string_not_found",
    },
  });

  const joined = lines.map((line) => line.text).join("\n");
  assert.match(joined, /Common write lanes in standard/u);
  assert.match(joined, /repo\.write/u);
  assert.match(joined, /policy=human_gate\(code\.edit\)/u);
  assert.match(joined, /Last write attempt: code\.edit · human_gate · final=failed · risk=risky · error=code_edit_old_string_not_found/u);
});

test("findPermissionPanelFocusIndex selects the current requested mode row", () => {
  const fields: PraxisSlashPanelField[] = [
    { kind: "action", key: "permissions:mode:bapr", label: "bapr" },
    { kind: "action", key: "permissions:mode:yolo", label: "yolo" },
    { kind: "action", key: "permissions:mode:permissive", label: "permissive" },
    { kind: "action", key: "permissions:mode:standard", label: "standard" },
    { kind: "action", key: "permissions:mode:restricted", label: "restricted" },
  ];

  assert.equal(findPermissionPanelFocusIndex(fields, "standard"), 3);
  assert.equal(findPermissionPanelFocusIndex(fields, "restricted"), 4);
});

test("resolvePermissionPanelSelectedMode follows focused mode rows and falls back otherwise", () => {
  const fields: PraxisSlashPanelField[] = [
    { kind: "action", key: "permissions:mode:bapr", label: "bapr" },
    { kind: "action", key: "permissions:mode:yolo", label: "yolo" },
    { kind: "value", key: "status", label: "Status", value: "ready" },
  ];

  assert.equal(resolvePermissionPanelSelectedMode(fields, 1, "bapr"), "yolo");
  assert.equal(resolvePermissionPanelSelectedMode(fields, 2, "bapr"), "bapr");
});
