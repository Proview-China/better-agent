import type { PraxisSlashPanelBodyLine } from "./slash-panels.js";
import { buildTerminalTableBodyLines, type TerminalTableRow } from "./viewer-table-layout.js";

export interface CapabilityViewerEntryRecord {
  capabilityKey: string;
  description: string;
  bindingState: string;
}

export interface CapabilityViewerGroupRecord {
  groupKey: string;
  title: string;
  count: number;
  entries: CapabilityViewerEntryRecord[];
}

export interface CapabilityViewerSnapshotRecord {
  status?: string;
  registeredCount?: number;
  familyCount?: number;
  blockedCount?: number;
  pendingHumanGateCount?: number;
  lastAttempt?: {
    capabilityKey: string;
    requestedMode?: string;
    effectiveMode?: string;
    derivedRiskLevel?: string;
    routeDecision?: string;
    routeReason?: string;
    matchedToolPolicy?: string;
    matchedToolPolicySelector?: string;
    finalStatus?: string;
    errorCode?: string;
  };
  writeDiagnostics?: Array<{
    capabilityKey: string;
    requestedMode?: string;
    effectiveMode?: string;
    derivedRiskLevel?: string;
    routeDecision?: string;
    matchedToolPolicy?: string;
    matchedToolPolicySelector?: string;
  }>;
  groups: CapabilityViewerGroupRecord[];
}

export interface CapabilityViewerPageMeta {
  pageIndex: number;
  pageCount: number;
  totalFamilies: number;
  totalCapabilities: number;
  currentGroup: CapabilityViewerGroupRecord | null;
}

function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (!Number.isFinite(pageIndex) || pageCount <= 1) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(pageIndex), pageCount - 1));
}

function createColoredKeyValueLine(input: {
  label: string;
  labelTone?: PraxisSlashPanelBodyLine["tone"];
  value: string;
  valueTone?: PraxisSlashPanelBodyLine["tone"];
}): PraxisSlashPanelBodyLine {
  return {
    text: `    ${input.label.padEnd(10, " ")}  ${input.value}`,
    segments: [
      { text: "    " },
      { text: input.label.padEnd(10, " "), tone: input.labelTone },
      { text: "  " },
      { text: input.value, tone: input.valueTone },
    ],
  };
}

function createStatusLine(input: {
  blockedCount: number;
  pendingHumanGateCount: number;
}): PraxisSlashPanelBodyLine {
  const blockedText = `${input.blockedCount} blocked`;
  const pendingText = `${input.pendingHumanGateCount} human gate pending`;
  return {
    text: `    ${"Status".padEnd(10, " ")}  ${blockedText} · ${pendingText}`,
    segments: [
      { text: "    " },
      { text: "Status".padEnd(10, " "), tone: "pink" },
      { text: "  " },
      { text: blockedText, tone: input.blockedCount > 0 ? "danger" : undefined },
      { text: " · " },
      { text: pendingText, tone: input.pendingHumanGateCount > 0 ? "danger" : undefined },
    ],
  };
}

export function buildCapabilityViewerPageMeta(
  snapshot: CapabilityViewerSnapshotRecord | null,
  requestedPageIndex: number,
): CapabilityViewerPageMeta {
  const groups = snapshot?.groups ?? [];
  const pageCount = Math.max(1, groups.length);
  const pageIndex = clampPageIndex(requestedPageIndex, pageCount);
  return {
    pageIndex,
    pageCount,
    totalFamilies: groups.length,
    totalCapabilities: snapshot?.registeredCount ?? groups.reduce((sum, group) => sum + group.entries.length, 0),
    currentGroup: groups[pageIndex] ?? null,
  };
}

export function buildCapabilityViewerBodyLines(params: {
  snapshot: CapabilityViewerSnapshotRecord | null;
  pageIndex: number;
  lineWidth: number;
  currentMode?: string;
}): { lines: PraxisSlashPanelBodyLine[]; meta: CapabilityViewerPageMeta } {
  const meta = buildCapabilityViewerPageMeta(params.snapshot, params.pageIndex);
  const snapshot = params.snapshot;
  const currentGroup = meta.currentGroup;
  const familyValue = currentGroup?.title ?? "No family available";
  const lines: PraxisSlashPanelBodyLine[] = [
    {
      text: `    Registered capabilities · page ${meta.pageIndex + 1}/${meta.pageCount} · ${meta.totalCapabilities} total`,
      tone: "green",
    },
    createColoredKeyValueLine({
      label: "Counts",
      labelTone: "info",
      value: `${snapshot?.registeredCount ?? 0} registered · ${snapshot?.familyCount ?? 0} families`,
    }),
    createStatusLine({
      blockedCount: snapshot?.blockedCount ?? 0,
      pendingHumanGateCount: snapshot?.pendingHumanGateCount ?? 0,
    }),
    createColoredKeyValueLine({
      label: "Family",
      value: familyValue,
    }),
  ];

  const lastAttempt = snapshot?.lastAttempt;
  if (lastAttempt) {
    const routeLine = [
      `${lastAttempt.capabilityKey}`,
      lastAttempt.routeDecision ? `route=${lastAttempt.routeDecision}` : undefined,
      lastAttempt.finalStatus ? `final=${lastAttempt.finalStatus}` : undefined,
      lastAttempt.derivedRiskLevel ? `risk=${lastAttempt.derivedRiskLevel}` : undefined,
    ].filter((part): part is string => Boolean(part)).join(" · ");
    const policyLine = [
      lastAttempt.effectiveMode ? `mode=${lastAttempt.effectiveMode}` : undefined,
      lastAttempt.matchedToolPolicy
        ? `policy=${lastAttempt.matchedToolPolicy}${lastAttempt.matchedToolPolicySelector ? `(${lastAttempt.matchedToolPolicySelector})` : ""}`
        : undefined,
      lastAttempt.errorCode ? `error=${lastAttempt.errorCode}` : undefined,
    ].filter((part): part is string => Boolean(part)).join(" · ");
    lines.push(
      { text: "    Last attempt", tone: "info" },
      { text: `      ${routeLine}`, tone: lastAttempt.finalStatus === "failed" ? "danger" : "warning" },
    );
    if (policyLine) {
      lines.push({ text: `      ${policyLine}`, tone: "warning" });
    }
    if (lastAttempt.routeReason) {
      lines.push({ text: `      ${lastAttempt.routeReason}`, tone: "info" });
    }
  }

  const visibleMode = params.currentMode ?? snapshot?.lastAttempt?.effectiveMode;
  const writeDiagnostics = (snapshot?.writeDiagnostics ?? [])
    .filter((entry) => !visibleMode || entry.requestedMode === visibleMode)
    .slice(0, 6);
  if (writeDiagnostics.length > 0) {
    lines.push(
      {
        text: `    Write route preview${visibleMode ? ` · ${visibleMode}` : ""}`,
        tone: "info",
      },
      ...writeDiagnostics.map((entry) => ({
        text: `      ${entry.capabilityKey.padEnd(18, " ")} ${String(entry.routeDecision ?? "unknown").padEnd(10, " ")} risk=${entry.derivedRiskLevel ?? "unknown"}${entry.matchedToolPolicy ? ` policy=${entry.matchedToolPolicy}` : ""}`,
        tone: entry.routeDecision === "human_gate" || entry.routeDecision === "interrupt"
          ? "warning" as const
          : entry.routeDecision === "deny"
            ? "danger" as const
            : undefined,
      })),
      {
        text: "      route preview shows TAP governance path only; adapter payload guards can still reject invalid writes.",
        tone: "warning",
      },
    );
  }

  if (!currentGroup || currentGroup.entries.length === 0) {
    lines.push({
      text: "    No registered capabilities for this family yet.",
      tone: snapshot?.status === "degraded" ? "warning" : undefined,
    });
    return { lines, meta };
  }

  lines.push(...buildTerminalTableBodyLines({
    columns: [
      {
        key: "capability",
        title: "Capability Key",
        minWidth: 20,
        maxWidth: 34,
        shrinkPriority: 2,
        growPriority: 2,
        value: (entry: CapabilityViewerEntryRecord) => entry.capabilityKey,
      },
      {
        key: "binding",
        title: "Binding",
        minWidth: 8,
        maxWidth: 14,
        shrinkPriority: 4,
        growPriority: 4,
        value: (entry: CapabilityViewerEntryRecord) => entry.bindingState,
      },
      {
        key: "description",
        title: "Description",
        minWidth: 22,
        shrinkPriority: 1,
        growPriority: 1,
        value: (entry: CapabilityViewerEntryRecord) => entry.description.replace(/\s+/gu, " ").trim(),
      },
    ],
    rows: currentGroup.entries.map<TerminalTableRow<CapabilityViewerEntryRecord>>((entry) => ({
      key: `${currentGroup.title}:${entry.capabilityKey}`,
      data: entry,
      tone: /unbound/u.test(entry.bindingState) ? "warning" : undefined,
    })),
    lineWidth: params.lineWidth,
    emptyText: "No registered capabilities for this family yet.",
    emptyTone: snapshot?.status === "degraded" ? "warning" : undefined,
  }));

  return { lines, meta };
}
