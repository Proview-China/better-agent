import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoreContextualBlocks,
  renderCoreCmpContextPackageV1,
  renderCoreCmpWorksitePackageV1,
  renderCoreMpRoutedPackageV1,
  renderCoreContextualUserV1,
} from "./contextual.js";

test("createCoreContextualBlocks keeps stable order and omits empty optional blocks", () => {
  const blocks = createCoreContextualBlocks({
    currentObjective: "完成 core system v1 起草",
    recentTranscript: "user: ...\nassistant: ...",
    cmpWorksitePackage: {
      schemaVersion: "core-cmp-worksite-package/v1",
      deliveryStatus: "available",
      identity: {
        sessionId: "session-1",
        agentId: "cmp-main",
      },
    },
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
      "cmp_worksite_package",
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
    cmpWorksitePackage: {
      schemaVersion: "core-cmp-worksite-package/v1",
      deliveryStatus: "available",
      identity: {
        sessionId: "session-1",
        agentId: "cmp-main",
        packageRef: "cmp-worksite:1",
      },
    },
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

  assert.match(rendered, /<cmp_worksite_package>/);
  assert.match(rendered, /schema_version: core-cmp-worksite-package\/v1/);
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

test("renderCoreCmpWorksitePackageV1 renders worksite-specific fields", () => {
  const rendered = renderCoreCmpWorksitePackageV1({
    schemaVersion: "core-cmp-worksite-package/v1",
    deliveryStatus: "available",
    identity: {
      sessionId: "session-1",
      agentId: "cmp-main",
      packageRef: "cmp-worksite:1",
      packageFamilyId: "family-1",
    },
    objective: {
      currentObjective: "继续推进 worksite control plane",
      activeTurnIndex: 6,
    },
    payload: {
      unresolvedStateSummary: "parent review 1, peer approval pending 1",
    },
    governance: {
      recoveryStatus: "degraded",
    },
    flow: {
      pendingPeerApprovalCount: 1,
      latestStages: ["checker:checked", "dispatcher:route"],
    },
  });

  assert.match(rendered, /schema_version: core-cmp-worksite-package\/v1/);
  assert.match(rendered, /package_family_id: family-1/);
  assert.match(rendered, /active_turn_index: 6/);
  assert.match(rendered, /unresolved_state_summary: parent review 1, peer approval pending 1/);
  assert.match(rendered, /recovery_status: degraded/);
  assert.match(rendered, /latest_stages: checker:checked \| dispatcher:route/);
});

test("renderCoreMpRoutedPackageV1 renders mp routed package summary", () => {
  const rendered = renderCoreMpRoutedPackageV1({
    schemaVersion: "core-mp-routed-package/v2",
    deliveryStatus: "available",
    packageId: "mp-resolve:1",
    packageRef: "receipt-1",
    sourceClass: "mp_native_resolve",
    summary: "MP routed primary and supporting memories for the task.",
    relevanceLabel: "high",
    freshnessLabel: "fresh",
    confidenceLabel: "high",
    primaryMemoryRefs: ["memory-1"],
    supportingMemoryRefs: ["memory-2"],
    objective: {
      currentObjective: "继续推进 MP native routing",
      retrievalMode: "resolve",
      objectiveMatchSummary: "matched native route",
    },
    governance: {
      routeLabel: "mp_native_resolve",
      governanceReason: "selected via MP resolve routing discipline",
    },
    retrieval: {
      receiptId: "receipt-1",
      primaryCount: 1,
      supportingCount: 1,
      omittedCount: 0,
    },
  });

  assert.match(rendered, /schema_version: core-mp-routed-package\/v2/);
  assert.match(rendered, /package_ref: receipt-1/);
  assert.match(rendered, /source_class: mp_native_resolve/);
  assert.match(rendered, /primary_memory_refs: memory-1/);
  assert.match(rendered, /current_objective: 继续推进 MP native routing/);
  assert.match(rendered, /governance_reason: selected via MP resolve routing discipline/);
  assert.match(rendered, /receipt_id: receipt-1/);
});
