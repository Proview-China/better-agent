import assert from "node:assert/strict";
import test from "node:test";

import { createCmpStatusPanelRows, renderCmpStatusPanel } from "./cmp-status-panel.js";

test("cmp status panel renderer formats existing readback status surface", () => {
  const output = renderCmpStatusPanel({
    projectId: "cmp-project-status",
    summary: {
      status: "ready",
      statusPanel: {
        roles: {
          icma: { count: 1, latestStage: "emit", liveMode: "llm_assisted", liveStatus: "succeeded", fallbackApplied: false, semanticSummary: "chunking=multi_auto, chunks=2, fragments=2" },
          iterator: { count: 1, latestStage: "update_review_ref", liveMode: "llm_assisted", liveStatus: "succeeded", fallbackApplied: false, semanticSummary: "verdict=advance_review, annotation=stable" },
          checker: { count: 1, latestStage: "checked", liveMode: "llm_assisted", liveStatus: "succeeded", fallbackApplied: false, semanticSummary: "split=1, merge=0" },
          dbagent: { count: 1, latestStage: "attach_snapshots", liveMode: "llm_assisted", liveStatus: "succeeded", fallbackApplied: false, semanticSummary: "primary=scene, timeline=attached, task=per_task, passive=historical_reply" },
          dispatcher: { count: 1, latestStage: "collect_receipt", liveMode: "llm_assisted", liveStatus: "succeeded", fallbackApplied: false, semanticSummary: "body=child_seed_full, ingress=child_icma_only, slim=0, scope=strict" },
        },
        packageFlow: {
          modeCounts: { child_seed_via_icma: 1 },
          latestTargetIngress: "child_icma_only",
          latestPrimaryRef: "cmp-package:pkg-1",
        },
        requests: {
          parentPromoteReviewCount: 0,
          pendingPeerApprovalCount: 0,
          approvedPeerApprovalCount: 1,
          reinterventionPendingCount: 0,
          reinterventionServedCount: 1,
        },
        health: {
          readbackStatus: "ready",
          deliveryDriftCount: 0,
          expiredDeliveryCount: 0,
          liveInfraReady: true,
          liveLlmReadyCount: 5,
          liveLlmFallbackCount: 0,
          liveLlmFailedCount: 0,
          recoveryStatus: "ready",
          finalAcceptanceStatus: "ready",
        },
        readiness: {
          objectModel: "ready",
          fiveAgentLoop: "ready",
          liveLlm: "ready",
          bundleSchema: "ready",
          tapExecutionBridge: "ready",
          liveInfra: "ready",
          recovery: "ready",
          finalAcceptance: "ready",
        },
      },
    },
  });

  assert.match(output, /CMP Status Panel: cmp-project-status/);
  assert.match(output, /\[roles\] dispatcher: count=1, latest=collect_receipt, live=llm_assisted\/succeeded, fallback=false, semantic=body=child_seed_full, ingress=child_icma_only, slim=0, scope=strict/);
  assert.match(output, /\[package_flow\] flow: latest_ingress=child_icma_only/);
  assert.match(output, /\[health\] readback: status=ready/);
  assert.match(output, /\[health\] live_infra: ready=true/);
  assert.match(output, /\[health\] live_llm: ready=5, fallback=0, failed=0/);
  assert.match(output, /\[health\] recovery: status=ready/);
  assert.match(output, /\[readiness\] object_model: status=ready/);
  assert.match(output, /\[readiness\] live_llm: status=ready/);
  assert.match(output, /\[readiness\] final_acceptance: status=ready/);
});

test("cmp status panel row builder degrades gracefully when panel is missing", () => {
  const rows = createCmpStatusPanelRows({
    projectId: "cmp-project-status",
  });

  assert.deepEqual(rows, [{
    section: "health",
    label: "status",
    value: "cmp-project-status: status panel unavailable",
  }]);
});
