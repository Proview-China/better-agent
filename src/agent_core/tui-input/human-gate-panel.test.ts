import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHumanGatePanelBodyLines,
  buildHumanGatePanelFields,
  resolveHumanGatePendingSignature,
  type HumanGatePanelEntry,
} from "./human-gate-panel.js";

const fixtureEntry: HumanGatePanelEntry = {
  gateId: "gate-1",
  requestId: "request-1",
  capabilityKey: "code.read",
  requestedTier: "B1",
  mode: "permissive",
  reason: "external read needs human approval",
  externalPathPrefixes: ["/home/proview/Desktop/Secrets"],
  plainLanguageRisk: {
    plainLanguageSummary: "This read will inspect a path outside the workspace.",
    requestedAction: "read /home/proview/Desktop/Secrets/notes.txt",
    riskLevel: "risky",
    whyItIsRisky: "The path is outside the current workspace boundary.",
    possibleConsequence: "Sensitive local files may be exposed to the agent.",
    whatHappensIfNotRun: "The task stays paused until a human decides.",
    availableUserActions: [
      { actionId: "gate-1:approve-once", label: "Approve once", kind: "approve" },
      { actionId: "gate-1:approve-always", label: "Approve always", kind: "approve" },
      { actionId: "gate-1:reject", label: "Reject", kind: "deny" },
      { actionId: "gate-1:reject-with-instruction", label: "Reject with note", kind: "ask_for_safer_alternative" },
      { actionId: "gate-1:view-details", label: "View details", kind: "view_details" },
    ],
  },
};

test("buildHumanGatePanelFields exposes controlled actions for the selected gate", () => {
  const fields = buildHumanGatePanelFields({
    entry: fixtureEntry,
    expanded: false,
    noteValue: "",
    hasMultipleEntries: true,
  });
  assert.deepEqual(
    fields.map((field) => field.key),
    [
      "humanGate:approveOnce",
      "humanGate:approveAlways",
      "humanGate:deny",
      "humanGate:note",
      "humanGate:denyWithInstruction",
      "humanGate:toggleDetails",
      "humanGate:prev",
      "humanGate:next",
    ],
  );
});

test("buildHumanGatePanelBodyLines includes expanded details and external path prefixes", () => {
  const lines = buildHumanGatePanelBodyLines({
    entry: fixtureEntry,
    expanded: true,
    currentIndex: 0,
    totalCount: 2,
  });
  const rendered = lines.map((line) => line.text).join("\n");
  assert.match(rendered, /Pending approval 1\/2/);
  assert.match(rendered, /Risk level\s+risky/);
  assert.match(rendered, /Path prefix\s+\/home\/proview\/Desktop\/Secrets/);
  assert.match(rendered, /Gate \/ req\s+gate-1 \/ request-1/);
});

test("resolveHumanGatePendingSignature changes when gate revision changes", () => {
  const first = resolveHumanGatePendingSignature([
    { ...fixtureEntry, updatedAt: "2026-04-14T10:00:00.000Z" },
  ]);
  const second = resolveHumanGatePendingSignature([
    { ...fixtureEntry, updatedAt: "2026-04-14T10:01:00.000Z" },
  ]);
  assert.notEqual(first, second);
});
