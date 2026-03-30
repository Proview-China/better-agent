import { readFile } from "node:fs/promises";
import process from "node:process";

import type { RaxCmpReadbackSummary, RaxCmpStatusPanel } from "./cmp-types.js";

export type RaxCmpStatusPanelSection = CmpStatusPanelRenderRow["section"];

export interface CmpStatusPanelRenderRow {
  section: "roles" | "package_flow" | "requests" | "health" | "readiness";
  label: string;
  value: string;
}

export function createCmpStatusPanelRows(input: {
  projectId: string;
  panel?: RaxCmpStatusPanel;
}): CmpStatusPanelRenderRow[] {
  if (!input.panel) {
    return [{
      section: "health",
      label: "status",
      value: `${input.projectId}: status panel unavailable`,
    }];
  }

  const rows: CmpStatusPanelRenderRow[] = [];
  for (const [role, entry] of Object.entries(input.panel.roles)) {
    rows.push({
      section: "roles",
      label: role,
      value: `count=${entry.count}, latest=${entry.latestStage ?? "none"}`,
    });
  }

  rows.push({
    section: "package_flow",
    label: "flow",
    value: `latest_ingress=${input.panel.packageFlow.latestTargetIngress ?? "unknown"}, latest_primary_ref=${input.panel.packageFlow.latestPrimaryRef ?? "unknown"}`,
  });
  rows.push({
    section: "package_flow",
    label: "mode_counts",
    value: Object.entries(input.panel.packageFlow.modeCounts)
      .map(([mode, count]) => `${mode}:${count}`)
      .join(", ") || "none",
  });

  rows.push({
    section: "requests",
    label: "reviews",
    value: `promote=${input.panel.requests.parentPromoteReviewCount}, peer_pending=${input.panel.requests.pendingPeerApprovalCount}, peer_approved=${input.panel.requests.approvedPeerApprovalCount}`,
  });
  rows.push({
    section: "requests",
    label: "reintervention",
    value: `pending=${input.panel.requests.reinterventionPendingCount}, served=${input.panel.requests.reinterventionServedCount}`,
  });

  rows.push({
    section: "health",
    label: "readback",
    value: `status=${input.panel.health.readbackStatus}`,
  });
  rows.push({
    section: "health",
    label: "delivery",
    value: `drift=${input.panel.health.deliveryDriftCount}, expired=${input.panel.health.expiredDeliveryCount}`,
  });
  rows.push({
    section: "health",
    label: "live_infra",
    value: `ready=${input.panel.health.liveInfraReady}`,
  });
  rows.push({
    section: "health",
    label: "recovery",
    value: `status=${input.panel.health.recoveryStatus}`,
  });
  rows.push({
    section: "health",
    label: "final_acceptance",
    value: `status=${input.panel.health.finalAcceptanceStatus}`,
  });

  rows.push({
    section: "readiness",
    label: "object_model",
    value: `status=${input.panel.readiness.objectModel}`,
  });
  rows.push({
    section: "readiness",
    label: "five_agent_loop",
    value: `status=${input.panel.readiness.fiveAgentLoop}`,
  });
  rows.push({
    section: "readiness",
    label: "bundle_schema",
    value: `status=${input.panel.readiness.bundleSchema}`,
  });
  rows.push({
    section: "readiness",
    label: "tap_execution_bridge",
    value: `status=${input.panel.readiness.tapExecutionBridge}`,
  });
  rows.push({
    section: "readiness",
    label: "live_infra",
    value: `status=${input.panel.readiness.liveInfra}`,
  });
  rows.push({
    section: "readiness",
    label: "recovery",
    value: `status=${input.panel.readiness.recovery}`,
  });
  rows.push({
    section: "readiness",
    label: "final_acceptance",
    value: `status=${input.panel.readiness.finalAcceptance}`,
  });

  return rows;
}

export function renderCmpStatusPanel(input: {
  projectId: string;
  summary: Pick<RaxCmpReadbackSummary, "statusPanel" | "status">;
}): string {
  const rows = createCmpStatusPanelRows({
    projectId: input.projectId,
    panel: input.summary.statusPanel,
  });
  return [
    `CMP Status Panel: ${input.projectId}`,
    `readback=${input.summary.status}`,
    ...rows.map((row) => `[${row.section}] ${row.label}: ${row.value}`),
  ].join("\n");
}

export function createRaxCmpStatusPanel(input: {
  projectId: string;
  summary: Pick<RaxCmpReadbackSummary, "statusPanel" | "status">;
}) {
  return {
    rows: createCmpStatusPanelRows({
      projectId: input.projectId,
      panel: input.summary.statusPanel,
    }),
    rendered: renderCmpStatusPanel(input),
  };
}

async function main(argv: string[]): Promise<void> {
  const filePath = argv[2];
  if (!filePath) {
    throw new Error("Usage: tsx src/rax/cmp-status-panel.ts <summary-json-file>");
  }
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as { projectId: string; summary: Pick<RaxCmpReadbackSummary, "statusPanel" | "status"> };
  process.stdout.write(`${renderCmpStatusPanel(parsed)}\n`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === new URL(`file://${entrypoint}`).href) {
  main(process.argv).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
