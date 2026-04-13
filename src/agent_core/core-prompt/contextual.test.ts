import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoreContextualBlocks,
  renderCoreCmpContextPackageV1,
  renderCoreMpRoutedPackageV1,
  renderCoreContextualUserV1,
} from "./contextual.js";

test("createCoreContextualBlocks keeps stable order and omits empty optional blocks", () => {
  const blocks = createCoreContextualBlocks({
    currentObjective: "完成 core system v1 起草",
    recentTranscript: "user: ...\nassistant: ...",
    cmpContextPackage: {
      schemaVersion: "core-cmp-context-package/v1",
      deliveryStatus: "available",
      identity: {
        packageId: "cmp-1",
        packageRef: "cmp-package:1",
      },
    },
    latestToolResult: "ok",
  });

  assert.deepEqual(
    blocks.map((block) => block.heading),
    [
      "current_objective",
      "recent_transcript",
      "cmp_context_package",
      "latest_tool_result",
    ],
  );
});

test("renderCoreContextualUserV1 wraps blocks with stable envelope", () => {
  const rendered = renderCoreContextualUserV1({
    currentObjective: "修正 prompt assembly",
    recentTranscript: "u: hi",
    workspaceContext: "/repo",
  });

  assert.match(rendered, /^<core_contextual_user>/);
  assert.match(rendered, /<current_objective>/);
  assert.match(rendered, /<recent_transcript>/);
  assert.match(rendered, /<workspace_context>/);
  assert.doesNotMatch(rendered, /<cmp_context_package>/);
  assert.doesNotMatch(rendered, /<core_overlay_index>/);
  assert.match(rendered, /<\/core_contextual_user>$/);
});

test("renderCoreContextualUserV1 renders structured cmp package blocks without duplicating overlay index", () => {
  const rendered = renderCoreContextualUserV1({
    currentObjective: "继续推进 core-cmp handoff",
    recentTranscript: "u: hi",
    cmpContextPackage: {
      schemaVersion: "core-cmp-context-package/v1",
      deliveryStatus: "available",
      identity: {
        packageId: "cmp-1",
        packageRef: "cmp-package:1",
        packageMode: "core_return",
      },
      governance: {
        operatorGuide: "focus on checked package",
        routeRationale: "core return",
      },
    },
  });

  assert.match(rendered, /<cmp_context_package>/);
  assert.match(rendered, /schema_version: core-cmp-context-package\/v1/);
  assert.match(rendered, /delivery_status: available/);
  assert.match(rendered, /package_mode: core_return/);
  assert.doesNotMatch(rendered, /<core_overlay_index>/);
});

test("renderCoreCmpContextPackageV1 supports multiple delivery states without inventing body text", () => {
  const pending = renderCoreCmpContextPackageV1({
    schemaVersion: "core-cmp-context-package/v1",
    deliveryStatus: "pending",
    objective: {
      taskSummary: "awaiting refreshed CMP package",
    },
  });
  const partial = renderCoreCmpContextPackageV1({
    schemaVersion: "core-cmp-context-package/v1",
    deliveryStatus: "partial",
    identity: {
      packageId: "cmp-2",
      packageRef: "cmp-package:2",
    },
    governance: {
      operatorGuide: "use package conservatively",
      confidenceLabel: "medium",
      freshness: "aging",
    },
  });

  assert.match(pending, /delivery_status: pending/);
  assert.match(pending, /task_summary: awaiting refreshed CMP package/);
  assert.doesNotMatch(pending, /payload:/);
  assert.match(partial, /delivery_status: partial/);
  assert.match(partial, /confidence_label: medium/);
  assert.match(partial, /freshness: aging/);
});

test("renderCoreMpRoutedPackageV1 renders mp routed package summary", () => {
  const rendered = renderCoreMpRoutedPackageV1({
    schemaVersion: "core-mp-routed-package/v1",
    deliveryStatus: "available",
    packageId: "mp-resolve:1",
    sourceClass: "mp_resolve_bundle",
    summary: "MP routed primary and supporting memories for the task.",
    relevanceLabel: "high",
    freshnessLabel: "fresh",
    confidenceLabel: "high",
    primaryMemoryRefs: ["memory-1"],
    supportingMemoryRefs: ["memory-2"],
  });

  assert.match(rendered, /schema_version: core-mp-routed-package\/v1/);
  assert.match(rendered, /source_class: mp_resolve_bundle/);
  assert.match(rendered, /primary_memory_refs: memory-1/);
});
