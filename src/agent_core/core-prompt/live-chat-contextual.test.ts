import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLiveChatCoreContextualPrompt,
  createLiveChatCoreContextualInput,
} from "./live-chat-contextual.js";

test("buildLiveChatCoreContextualPrompt injects key live-chat blocks", () => {
  const rendered = buildLiveChatCoreContextualPrompt({
    userMessage: "继续调研 core prompt engineering",
    transcript: [
      { role: "user", text: "上一轮说了什么" },
      { role: "assistant", text: "我们在看 core prompt" },
    ],
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-main",
      packageId: "pkg-1",
      packageRef: "cmp-package:1",
      packageKind: "active_reseed",
      packageMode: "core_return",
      fidelityLabel: "checked_high_fidelity",
      projectionId: "proj-1",
      snapshotId: "snap-1",
      summary: {} as never,
      intent: "keep-context-clean",
      operatorGuide: "focus on prompt layers",
      childGuide: "none",
      checkerReason: "usable",
      routeRationale: "core-return",
      scopePolicy: "current-turn-only",
      packageStrategy: "primary",
      timelineStrategy: "minimal",
    },
    mpRoutedPackage: {
      schemaVersion: "core-mp-routed-package/v1",
      deliveryStatus: "available",
      packageId: "mp-resolve:1",
      sourceClass: "mp_resolve_bundle",
      summary: "MP routed primary and supporting memories for this task.",
      relevanceLabel: "high",
      freshnessLabel: "fresh",
      confidenceLabel: "high",
      primaryMemoryRefs: ["memory-1"],
      supportingMemoryRefs: ["memory-2"],
    },
    workspaceInitContext: {
      schemaVersion: "core-workspace-init-context/v1",
      sourcePath: ".raxode/AGENTS.md",
      bodyRef: ".raxode/AGENTS.md",
      summary: "Primary direction: 先把 /init 与 core 长期上下文打通。",
      excerpt: "Primary direction: 先把 /init 与 core 长期上下文打通。 | Constraint: 中文优先。",
      updatedAt: "2026-04-15T00:00:00.000Z",
      freshness: "fresh",
    },
    availableCapabilitiesText: "Currently registered TAP capabilities: code.read, search.ground.",
    capabilityUsageIndexText: "search.ground => latest/current web facts",
    capabilityHistoryText: "Step 1 · code.read · success",
    toolResultText: "{\"path\":\"src/index.ts\"}",
    groundingEvidenceText: "{\"facts\":[{\"kind\":\"verified\"}]}",
  });

  assert.match(rendered, /^<core_contextual_user>/);
  assert.match(rendered, /<current_objective>/);
  assert.match(rendered, /继续调研 core prompt engineering/);
  assert.match(rendered, /<workspace_init_context>/);
  assert.match(rendered, /source_path: \.raxode\/AGENTS\.md/);
  assert.match(rendered, /<cmp_context_package>/);
  assert.match(rendered, /schema_version: core-cmp-context-package\/v1/);
  assert.match(rendered, /delivery_status: available/);
  assert.match(rendered, /package_kind: active_reseed/);
  assert.match(rendered, /package_mode:/);
  assert.match(rendered, /<mp_routed_package>/);
  assert.match(rendered, /schema_version: core-mp-routed-package\/v1/);
  assert.match(rendered, /source_class: mp_resolve_bundle/);
  assert.doesNotMatch(rendered, /<core_overlay_index>/);
  assert.match(rendered, /<tap_capability_window>/);
  assert.match(rendered, /Currently registered TAP capabilities:/);
  assert.match(rendered, /<latest_tool_result>/);
  assert.match(rendered, /<grounding_evidence>/);
});

test("buildLiveChatCoreContextualPrompt omits optional blocks when absent", () => {
  const rendered = buildLiveChatCoreContextualPrompt({
    userMessage: "看下当前路径",
    transcript: [{ role: "user", text: "看下当前路径" }],
    availableCapabilitiesText: "Currently registered TAP capabilities: shell.restricted.",
  });

  assert.match(rendered, /<current_objective>/);
  assert.doesNotMatch(rendered, /<latest_tool_result>/);
  assert.doesNotMatch(rendered, /<grounding_evidence>/);
});

test("createLiveChatCoreContextualInput returns structured contextual object before rendering", () => {
  const contextual = createLiveChatCoreContextualInput({
    userMessage: "继续推进",
    transcript: [{ role: "user", text: "继续推进" }],
    mpRoutedPackage: {
      schemaVersion: "core-mp-routed-package/v1",
      deliveryStatus: "available",
      packageId: "mp-resolve:1",
      sourceClass: "mp_resolve_bundle",
      summary: "MP routed primary and supporting memories for this task.",
    },
    workspaceInitContext: {
      schemaVersion: "core-workspace-init-context/v1",
      sourcePath: ".raxode/AGENTS.md",
      bodyRef: ".raxode/AGENTS.md",
      summary: "Primary direction: 继续推进。",
      excerpt: "Primary direction: 继续推进。",
      updatedAt: "2026-04-15T00:00:00.000Z",
      freshness: "fresh",
    },
    availableCapabilitiesText: "Currently registered TAP capabilities: code.read.",
    capabilityUsageIndexText: "code.read => inspect local workspace state",
    memoryEntries: [{
      id: "workspace-init:agents",
      label: "workspace/.raxode/AGENTS.md",
      summary: "workspace init context. Primary direction: 继续推进。",
      bodyRef: ".raxode/AGENTS.md",
    }],
  });

  assert.equal(contextual.currentObjective, "继续推进");
  assert.match(contextual.recentTranscript, /继续推进/);
  assert.match(contextual.tapCapabilityWindow ?? "", /Currently registered TAP capabilities:/);
  assert.equal(contextual.workspaceInitContext?.schemaVersion, "core-workspace-init-context/v1");
  assert.equal(typeof contextual.cmpContextPackage, "object");
  assert.equal(contextual.cmpContextPackage?.schemaVersion, "core-cmp-context-package/v1");
  assert.equal(contextual.mpRoutedPackage?.schemaVersion, "core-mp-routed-package/v1");
  assert.equal(contextual.overlayIndex?.schemaVersion, "core-overlay-index/v1");
  assert.equal(contextual.overlayIndex?.memories?.[0]?.id, "workspace-init:agents");
  assert.equal(contextual.overlayIndex?.memories?.[0]?.bodyRef, ".raxode/AGENTS.md");
});

test("createLiveChatCoreContextualInput degrades cleanly when cmp and capability index are absent", () => {
  const contextual = createLiveChatCoreContextualInput({
    userMessage: "继续主任务",
    transcript: [{ role: "user", text: "继续主任务" }],
    availableCapabilitiesText: "Currently registered TAP capabilities: shell.restricted.",
  });

  assert.equal(contextual.cmpContextPackage?.schemaVersion, "core-cmp-context-package/v1");
  assert.equal(contextual.cmpContextPackage?.deliveryStatus, "absent");
  assert.match(contextual.cmpContextPackage?.objective?.taskSummary ?? "", /no fresh CMP package/);
  assert.equal(contextual.overlayIndex?.schemaVersion, "core-overlay-index/v1");
  assert.equal(contextual.overlayIndex?.capabilityFamilies, undefined);
  assert.ok((contextual.overlayIndex?.skills?.length ?? 0) > 0);
  assert.ok((contextual.overlayIndex?.memories?.length ?? 0) >= 2);
});

test("createLiveChatCoreContextualInput maps pending skipped and partial cmp states into deliveryStatus", () => {
  const pending = createLiveChatCoreContextualInput({
    userMessage: "继续主任务",
    transcript: [{ role: "user", text: "继续主任务" }],
    cmp: {
      syncStatus: "warming",
      agentId: "cmp-sidecar-pending",
      packageId: "pending",
      packageRef: "pending",
      packageKind: "active_reseed",
      packageMode: "pending",
      fidelityLabel: "pending",
      projectionId: "pending",
      snapshotId: "pending",
      summary: {} as never,
      intent: "pending",
      operatorGuide: "still preparing",
      childGuide: "pending",
      checkerReason: "pending",
      routeRationale: "pending",
      scopePolicy: "pending",
      packageStrategy: "pending",
      timelineStrategy: "pending",
    },
    availableCapabilitiesText: "Currently registered TAP capabilities: shell.restricted.",
  });
  const skipped = createLiveChatCoreContextualInput({
    userMessage: "继续主任务",
    transcript: [{ role: "user", text: "继续主任务" }],
    cmp: {
      syncStatus: "skipped",
      agentId: "cmp-sidecar-skipped",
      packageId: "skipped",
      packageRef: "skipped",
      packageKind: "historical_reply",
      packageMode: "skipped",
      fidelityLabel: "skipped",
      projectionId: "skipped",
      snapshotId: "skipped",
      summary: {} as never,
      intent: "skipped in once mode",
      operatorGuide: "skipped intentionally",
      childGuide: "skipped",
      checkerReason: "skipped",
      routeRationale: "skipped",
      scopePolicy: "skipped",
      packageStrategy: "skipped",
      timelineStrategy: "skipped",
    },
    availableCapabilitiesText: "Currently registered TAP capabilities: shell.restricted.",
  });
  const partial = createLiveChatCoreContextualInput({
    userMessage: "继续主任务",
    transcript: [{ role: "user", text: "继续主任务" }],
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-main",
      packageId: "pkg-1",
      packageRef: "cmp-package:1",
      packageKind: "active_reseed",
      packageMode: "core_return",
      fidelityLabel: "checked_high_fidelity",
      projectionId: "proj-1",
      snapshotId: "snap-1",
      summary: {} as never,
      intent: "keep-context-clean",
      operatorGuide: "focus on prompt layers",
      childGuide: "none",
      checkerReason: "usable",
      routeRationale: "missing",
      scopePolicy: "missing",
      packageStrategy: "missing",
      timelineStrategy: "minimal",
    },
    availableCapabilitiesText: "Currently registered TAP capabilities: shell.restricted.",
  });

  assert.equal(pending.cmpContextPackage?.deliveryStatus, "pending");
  assert.equal(pending.cmpContextPackage?.governance?.confidenceLabel, "low");
  assert.equal(skipped.cmpContextPackage?.deliveryStatus, "skipped");
  assert.equal(skipped.cmpContextPackage?.governance?.freshness, "stale");
  assert.equal(partial.cmpContextPackage?.deliveryStatus, "partial");
  assert.equal(partial.cmpContextPackage?.governance?.confidenceLabel, "medium");
  assert.equal(partial.cmpContextPackage?.governance?.freshness, "aging");
});
