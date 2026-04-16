import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCapabilityViewerBodyLines,
  buildCapabilityViewerPageMeta,
  type CapabilityViewerSnapshotRecord,
} from "./capability-viewer-panel.js";

const snapshot: CapabilityViewerSnapshotRecord = {
  status: "ready",
  registeredCount: 5,
  familyCount: 3,
  blockedCount: 0,
  pendingHumanGateCount: 0,
  groups: [
    {
      groupKey: "mcp",
      title: "mcp",
      count: 1,
      entries: [{
        capabilityKey: "mcp.readResource",
        description: "Read MCP resources.",
        bindingState: "active",
      }],
    },
    {
      groupKey: "model",
      title: "model",
      count: 1,
      entries: [{
        capabilityKey: "model.infer",
        description: "Infer with the model.",
        bindingState: "active",
      }],
    },
    {
      groupKey: "mp",
      title: "mp",
      count: 3,
      entries: [
        {
          capabilityKey: "mp.align",
          description: "Align one memory record.",
          bindingState: "active",
        },
        {
          capabilityKey: "mp.archive",
          description: "Archive one memory record.",
          bindingState: "active",
        },
        {
          capabilityKey: "mp.compact",
          description: "Compact one semantic group.",
          bindingState: "active",
        },
      ],
    },
  ],
};

test("buildCapabilityViewerPageMeta paginates by family group", () => {
  const meta = buildCapabilityViewerPageMeta(snapshot, 2);
  assert.equal(meta.pageCount, 3);
  assert.equal(meta.pageIndex, 2);
  assert.equal(meta.totalCapabilities, 5);
  assert.equal(meta.currentGroup?.title, "mp");
});

test("buildCapabilityViewerBodyLines renders one family per page with colored header lines", () => {
  const rendered = buildCapabilityViewerBodyLines({
    snapshot,
    pageIndex: 2,
    lineWidth: 100,
  });

  assert.equal(rendered.meta.pageCount, 3);
  assert.match(rendered.lines[0]?.text ?? "", /Registered capabilities · page 3\/3 · 5 total/u);
  assert.equal(rendered.lines[0]?.tone, "green");
  assert.equal(rendered.lines[1]?.segments?.[1]?.tone, "info");
  assert.equal(rendered.lines[2]?.segments?.[1]?.tone, "pink");
  assert.match(rendered.lines[3]?.text ?? "", /Family\s+mp/u);
  const joined = rendered.lines.map((line) => line.text).join("\n");
  assert.match(joined, /mp\.align/u);
  assert.match(joined, /mp\.archive/u);
  assert.match(joined, /mp\.compact/u);
  assert.doesNotMatch(joined, /mcp\.readResource/u);
  assert.doesNotMatch(joined, /model\.infer/u);
});

test("status line marks non-zero blockers in red", () => {
  const rendered = buildCapabilityViewerBodyLines({
    snapshot: {
      ...snapshot,
      blockedCount: 2,
      pendingHumanGateCount: 1,
    },
    pageIndex: 0,
    lineWidth: 100,
  });

  assert.equal(rendered.lines[2]?.segments?.[3]?.tone, "danger");
  assert.equal(rendered.lines[2]?.segments?.[5]?.tone, "danger");
});

test("buildCapabilityViewerBodyLines includes last attempt and write route preview details", () => {
  const rendered = buildCapabilityViewerBodyLines({
    snapshot: {
      ...snapshot,
      lastAttempt: {
        capabilityKey: "code.edit",
        effectiveMode: "restricted",
        derivedRiskLevel: "risky",
        routeDecision: "human_gate",
        routeReason: "Capability code.edit requires human approval in restricted mode.",
        matchedToolPolicy: "human_gate",
        matchedToolPolicySelector: "code.edit",
        finalStatus: "blocked",
        errorCode: "tap_vendor_user_input_required",
      },
      writeDiagnostics: [
        {
          capabilityKey: "repo.write",
          requestedMode: "standard",
          derivedRiskLevel: "normal",
          routeDecision: "review",
        },
        {
          capabilityKey: "code.edit",
          requestedMode: "standard",
          derivedRiskLevel: "normal",
          routeDecision: "review",
          matchedToolPolicy: "human_gate",
          matchedToolPolicySelector: "code.edit",
        },
      ],
    },
    pageIndex: 0,
    lineWidth: 100,
    currentMode: "standard",
  });

  const joined = rendered.lines.map((line) => line.text).join("\n");
  assert.match(joined, /Last attempt/u);
  assert.match(joined, /code\.edit · route=human_gate · final=blocked · risk=risky/u);
  assert.match(joined, /Write route preview · standard/u);
  assert.match(joined, /repo\.write/u);
  assert.match(joined, /policy=human_gate/u);
});
