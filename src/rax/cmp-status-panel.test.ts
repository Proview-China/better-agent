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
          icma: { count: 1, latestStage: "emit" },
          iterator: { count: 1, latestStage: "update_review_ref" },
          checker: { count: 1, latestStage: "checked" },
          dbagent: { count: 1, latestStage: "attach_snapshots" },
          dispatcher: { count: 1, latestStage: "collect_receipt" },
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
          recoveryStatus: "ready",
          finalAcceptanceStatus: "ready",
        },
        readiness: {
          objectModel: "ready",
          fiveAgentLoop: "ready",
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
  assert.match(output, /\[roles\] dispatcher: count=1, latest=collect_receipt/);
  assert.match(output, /\[package_flow\] flow: latest_ingress=child_icma_only/);
  assert.match(output, /\[health\] readback: status=ready/);
  assert.match(output, /\[health\] live_infra: ready=true/);
  assert.match(output, /\[health\] recovery: status=ready/);
  assert.match(output, /\[readiness\] object_model: status=ready/);
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
