import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const port = Number(process.env.PORT || 4180);
const panelFile = process.env.CMP_STATUS_PANEL_FILE || "/data/status-panel.json";

function renderPanel(payload) {
  const projectId = payload?.projectId || "cmp-project";
  const summary = payload?.summary || {};
  const panel = summary.statusPanel;
  if (!panel) {
    return `CMP Status Panel: ${projectId}\nstatus panel unavailable\n`;
  }

  const lines = [
    `CMP Status Panel: ${projectId}`,
    `readback=${summary.status || "unknown"}`,
  ];

  for (const [role, entry] of Object.entries(panel.roles || {})) {
    lines.push(`[roles] ${role}: count=${entry.count ?? 0}, latest=${entry.latestStage || "none"}`);
  }
  lines.push(`[package_flow] latest_ingress=${panel.packageFlow?.latestTargetIngress || "unknown"}, latest_primary_ref=${panel.packageFlow?.latestPrimaryRef || "unknown"}`);
  lines.push(`[requests] promote=${panel.requests?.parentPromoteReviewCount ?? 0}, peer_pending=${panel.requests?.pendingPeerApprovalCount ?? 0}, peer_approved=${panel.requests?.approvedPeerApprovalCount ?? 0}`);
  lines.push(`[requests] reintervention_pending=${panel.requests?.reinterventionPendingCount ?? 0}, reintervention_served=${panel.requests?.reinterventionServedCount ?? 0}`);
  lines.push(`[health] readback=${panel.health?.readbackStatus || "unknown"}, drift=${panel.health?.deliveryDriftCount ?? 0}, expired=${panel.health?.expiredDeliveryCount ?? 0}`);
  lines.push(`[health] live_infra=${panel.health?.liveInfraReady ?? false}, recovery=${panel.health?.recoveryStatus || "unknown"}, final_acceptance=${panel.health?.finalAcceptanceStatus || "unknown"}`);
  lines.push(`[readiness] object_model=${panel.readiness?.objectModel || "unknown"}, five_agent_loop=${panel.readiness?.fiveAgentLoop || "unknown"}, bundle_schema=${panel.readiness?.bundleSchema || "unknown"}`);
  lines.push(`[readiness] tap_execution_bridge=${panel.readiness?.tapExecutionBridge || "unknown"}, live_infra=${panel.readiness?.liveInfra || "unknown"}, recovery=${panel.readiness?.recovery || "unknown"}, final_acceptance=${panel.readiness?.finalAcceptance || "unknown"}`);
  return `${lines.join("\n")}\n`;
}

async function loadPanel() {
  try {
    const raw = await readFile(panelFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  const payload = await loadPanel();
  const body = renderPanel(payload);
  res.writeHead(200, {
    "content-type": req.url === "/json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
  });
  if (req.url === "/json") {
    res.end(JSON.stringify(payload ?? { projectId: "cmp-project", summary: { status: "failed" } }, null, 2));
    return;
  }
  res.end(body);
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`cmp-status-panel listening on ${port}, file=${panelFile}\n`);
});
