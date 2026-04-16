import {
  findNextInteractiveFieldIndex,
  type PraxisSlashPanelBodyLine,
  type PraxisSlashPanelField,
} from "./slash-panels.js";

const PERMISSION_MATRIX_INDENT = "    ";
const PERMISSION_MODE_COLUMN_WIDTH = 13;
const PERMISSION_RISK_COLUMN_WIDTH = 15;

function padColumn(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function buildPermissionMatrixRow(
  mode: string,
  normal: string,
  risky: string,
  dangerous: string,
): PraxisSlashPanelBodyLine {
  const prefix = `${PERMISSION_MATRIX_INDENT}${padColumn(mode, PERMISSION_MODE_COLUMN_WIDTH)}`;
  const suffix = `${padColumn(normal, PERMISSION_RISK_COLUMN_WIDTH)}${padColumn(risky, PERMISSION_RISK_COLUMN_WIDTH)}${dangerous}`;
  return {
    text: `${prefix}${suffix}`,
    fieldKey: `permissions:mode:${mode}`,
    segments: [
      { text: prefix, tone: "info" },
      { text: suffix },
    ],
  };
}

export function describePermissionMode(mode: string): string {
  switch (mode) {
    case "bapr":
      return "bapr: repo-local and external read requests stay on the fast path, and no extra reviewer or human gate is inserted.";
    case "yolo":
      return "yolo: repo-local reads continue automatically; external reads can still be governed, while dangerous work does not auto-run.";
    case "permissive":
      return "permissive: repo-local reads stay easy to use, external reads become governed reviewer work, and dangerous work escalates to human gate.";
    case "standard":
      return "standard: normal work often routes through reviewer, risky work stays governed, and dangerous work escalates to human gate.";
    case "restricted":
      return "restricted: most governed requests wait at human gate, including risky external access.";
    default:
      return `${mode}: mode description is not available yet.`;
  }
}

export function buildPermissionModeMatrixLines(
  selectedMode: string,
  options: {
    persistedAllowRuleCount?: number;
    previewRecords?: Array<{
      capabilityKey: string;
      requestedMode?: string;
      effectiveMode?: string;
      derivedRiskLevel?: string;
      routeDecision?: string;
      matchedToolPolicy?: string;
      matchedToolPolicySelector?: string;
    }>;
    lastAttempt?: {
      capabilityKey: string;
      finalStatus?: string;
      routeDecision?: string;
      derivedRiskLevel?: string;
      errorCode?: string;
    };
  } = {},
): PraxisSlashPanelBodyLine[] {
  const lines: PraxisSlashPanelBodyLine[] = [
    {
      text: `${PERMISSION_MATRIX_INDENT}${padColumn("Mode", PERMISSION_MODE_COLUMN_WIDTH)}${padColumn("Normal", PERMISSION_RISK_COLUMN_WIDTH)}${padColumn("Risky", PERMISSION_RISK_COLUMN_WIDTH)}Dangerous`,
      tone: "info",
    },
    buildPermissionMatrixRow("bapr", "allow", "allow", "allow"),
    buildPermissionMatrixRow("yolo", "allow", "allow", "deny"),
    buildPermissionMatrixRow("permissive", "allow", "review", "human_gate"),
    buildPermissionMatrixRow("standard", "review", "review", "human_gate"),
    buildPermissionMatrixRow("restricted", "human_gate*", "human_gate", "human_gate"),
    {
      text: `${PERMISSION_MATRIX_INDENT}${describePermissionMode(selectedMode)}`,
      tone: "warning",
    },
  ];
  if ((options.persistedAllowRuleCount ?? 0) > 0) {
    lines.push({
      text: `${PERMISSION_MATRIX_INDENT}persisted allows in this workspace: ${options.persistedAllowRuleCount}`,
      tone: "success",
    });
  }
  const previewRecords = (options.previewRecords ?? [])
    .filter((entry) => entry.requestedMode === selectedMode)
    .slice(0, 6);
  if (previewRecords.length > 0) {
    lines.push(
      {
        text: `${PERMISSION_MATRIX_INDENT}Common write lanes in ${selectedMode}:`,
        tone: "info",
      },
      ...previewRecords.map((entry) => ({
        text: `${PERMISSION_MATRIX_INDENT}${entry.capabilityKey.padEnd(18, " ")} ${String(entry.routeDecision ?? "unknown").padEnd(10, " ")} risk=${entry.derivedRiskLevel ?? "unknown"}${entry.matchedToolPolicy ? ` policy=${entry.matchedToolPolicy}${entry.matchedToolPolicySelector ? `(${entry.matchedToolPolicySelector})` : ""}` : ""}${entry.effectiveMode && entry.effectiveMode !== selectedMode ? ` effective=${entry.effectiveMode}` : ""}`,
        tone: entry.routeDecision === "human_gate" || entry.routeDecision === "interrupt"
          ? "warning" as const
          : entry.routeDecision === "deny"
            ? "danger" as const
            : undefined,
      })),
      {
        text: `${PERMISSION_MATRIX_INDENT}These rows show TAP governance routing; command-specific payload guards still run later.`,
        tone: "warning",
      },
    );
  }
  if (options.lastAttempt) {
    lines.push({
      text: `${PERMISSION_MATRIX_INDENT}Last write attempt: ${options.lastAttempt.capabilityKey} · ${options.lastAttempt.routeDecision ?? "unknown"} · final=${options.lastAttempt.finalStatus ?? "unknown"}${options.lastAttempt.derivedRiskLevel ? ` · risk=${options.lastAttempt.derivedRiskLevel}` : ""}${options.lastAttempt.errorCode ? ` · error=${options.lastAttempt.errorCode}` : ""}`,
      tone: options.lastAttempt.finalStatus === "failed" ? "danger" : "warning",
    });
  }
  return lines;
}

export function resolvePermissionPanelSelectedMode(
  fields: PraxisSlashPanelField[],
  focusIndex: number,
  fallbackMode: string,
): string {
  const focusedKey = fields[focusIndex]?.key;
  if (focusedKey?.startsWith("permissions:mode:")) {
    return focusedKey.replace(/^permissions:mode:/u, "");
  }
  return fallbackMode;
}

export function findPermissionPanelFocusIndex(
  fields: PraxisSlashPanelField[],
  requestedMode: string,
): number {
  const requestedFieldIndex = fields.findIndex((field) => field.key === `permissions:mode:${requestedMode}`);
  if (requestedFieldIndex >= 0) {
    return requestedFieldIndex;
  }
  return findNextInteractiveFieldIndex(fields, 0, 1);
}
