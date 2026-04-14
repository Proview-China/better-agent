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
