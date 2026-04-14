import type {
  PlainLanguageRiskPayload,
  PlainLanguageRiskUserAction,
} from "../ta-pool-types/index.js";
import type {
  PraxisSlashPanelBodyLine,
  PraxisSlashPanelField,
} from "./slash-panels.js";

export interface HumanGatePanelEntry {
  gateId: string;
  requestId: string;
  capabilityKey: string;
  requestedTier: string;
  mode: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
  externalPathPrefixes: string[];
  plainLanguageRisk: PlainLanguageRiskPayload;
}

function hasAction(
  actions: readonly PlainLanguageRiskUserAction[],
  matcher: (action: PlainLanguageRiskUserAction) => boolean,
): boolean {
  return actions.some(matcher);
}

export function hasApproveOnceAction(entry: HumanGatePanelEntry): boolean {
  return hasAction(entry.plainLanguageRisk.availableUserActions, (action) =>
    action.actionId.includes("approve-once") || action.actionId === "approve-once");
}

export function hasApproveAlwaysAction(entry: HumanGatePanelEntry): boolean {
  return hasAction(entry.plainLanguageRisk.availableUserActions, (action) =>
    action.actionId.includes("approve-always") || action.actionId === "approve-always");
}

export function hasRejectAction(entry: HumanGatePanelEntry): boolean {
  return hasAction(entry.plainLanguageRisk.availableUserActions, (action) =>
    action.actionId.endsWith("reject") || action.actionId === "deny");
}

export function hasRejectWithInstructionAction(entry: HumanGatePanelEntry): boolean {
  return hasAction(entry.plainLanguageRisk.availableUserActions, (action) =>
    action.actionId.includes("reject-with-instruction") || action.actionId === "deny-with-instruction");
}

export function hasViewDetailsAction(entry: HumanGatePanelEntry): boolean {
  return hasAction(entry.plainLanguageRisk.availableUserActions, (action) =>
    action.actionId.includes("view-details") || action.kind === "view_details");
}

export function buildHumanGatePanelBodyLines(input: {
  entry: HumanGatePanelEntry;
  expanded: boolean;
  currentIndex: number;
  totalCount: number;
}): PraxisSlashPanelBodyLine[] {
  const { entry, expanded, currentIndex, totalCount } = input;
  const lines: PraxisSlashPanelBodyLine[] = [
    {
      text: `    Pending approval ${currentIndex + 1}/${Math.max(1, totalCount)}`,
      tone: "info",
    },
    {
      text: `    Capability     ${entry.capabilityKey}`,
      tone: "default",
    },
    {
      text: `    Requested act  ${entry.plainLanguageRisk.requestedAction}`,
      tone: "default",
    },
    {
      text: `    Risk level     ${entry.plainLanguageRisk.riskLevel}`,
      tone: entry.plainLanguageRisk.riskLevel === "dangerous"
        ? "danger"
        : (entry.plainLanguageRisk.riskLevel === "risky" ? "warning" : "success"),
    },
    {
      text: `    Summary        ${entry.plainLanguageRisk.plainLanguageSummary}`,
      tone: "default",
    },
  ];

  if (expanded) {
    lines.push(
      {
        text: `    Why risky      ${entry.plainLanguageRisk.whyItIsRisky}`,
        tone: "warning",
      },
      {
        text: `    Consequence    ${entry.plainLanguageRisk.possibleConsequence}`,
        tone: "warning",
      },
      {
        text: `    If not run     ${entry.plainLanguageRisk.whatHappensIfNotRun}`,
        tone: "info",
      },
      {
        text: `    Tier / mode    ${entry.requestedTier} / ${entry.mode}`,
        tone: "info",
      },
      {
        text: `    Gate / req     ${entry.gateId} / ${entry.requestId}`,
        tone: "info",
      },
    );
    for (const prefix of entry.externalPathPrefixes) {
      lines.push({
        text: `    Path prefix    ${prefix}`,
        tone: "warning",
      });
    }
    if (entry.reason.trim().length > 0) {
      lines.push({
        text: `    Reviewer note  ${entry.reason}`,
        tone: "info",
      });
    }
  }

  return lines;
}

export function buildHumanGatePanelFields(input: {
  entry: HumanGatePanelEntry | null;
  expanded: boolean;
  noteValue: string;
  hasMultipleEntries: boolean;
}): PraxisSlashPanelField[] {
  const { entry, expanded, noteValue, hasMultipleEntries } = input;
  if (!entry) {
    return [
      {
        key: "humanGate:close",
        label: "Close",
        kind: "action",
        value: "close empty panel",
        primary: true,
      },
    ];
  }

  const fields: PraxisSlashPanelField[] = [];
  if (hasApproveOnceAction(entry)) {
    fields.push({
      key: "humanGate:approveOnce",
      label: "Approve Once",
      kind: "action",
      value: "allow only this request",
      tone: "success",
      primary: true,
    });
  }
  if (hasApproveAlwaysAction(entry)) {
    fields.push({
      key: "humanGate:approveAlways",
      label: "Approve Always",
      kind: "action",
      value: "persist this read prefix",
      tone: "success",
    });
  }
  if (hasRejectAction(entry)) {
    fields.push({
      key: "humanGate:deny",
      label: "Deny",
      kind: "action",
      value: "reject without extra note",
      tone: "danger",
    });
  }
  if (hasRejectWithInstructionAction(entry)) {
    fields.push({
      key: "humanGate:note",
      label: "Instruction",
      kind: "input",
      value: noteValue,
      placeholder: "Tell Raxode what to do instead",
      submitActionKey: "humanGate:denyWithInstruction",
      tone: "warning",
    });
    fields.push({
      key: "humanGate:denyWithInstruction",
      label: "Deny + Tell Raxode",
      kind: "action",
      value: "reject and send your note",
      tone: "danger",
    });
  }
  if (hasViewDetailsAction(entry)) {
    fields.push({
      key: "humanGate:toggleDetails",
      label: expanded ? "Hide Details" : "View Details",
      kind: "action",
      value: expanded ? "collapse extra risk detail" : "expand extra risk detail",
      tone: "info",
    });
  }
  if (hasMultipleEntries) {
    fields.push(
      {
        key: "humanGate:prev",
        label: "Prev Gate",
        kind: "action",
        value: "show previous pending approval",
        tone: "info",
      },
      {
        key: "humanGate:next",
        label: "Next Gate",
        kind: "action",
        value: "show next pending approval",
        tone: "info",
      },
    );
  }
  return fields;
}

export function resolveHumanGatePendingSignature(entries: readonly HumanGatePanelEntry[]): string {
  return entries
    .map((entry) => `${entry.gateId}:${entry.updatedAt ?? entry.createdAt ?? "pending"}`)
    .join("|");
}
