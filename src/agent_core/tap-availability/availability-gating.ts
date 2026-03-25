import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
  TapFormalFamilyKey,
} from "./availability-types.js";
import type { TapFamilyCheckReport } from "./family-check-types.js";

export const TAP_AVAILABILITY_GATE_DECISIONS = [
  "baseline",
  "review_only",
  "blocked",
  "pending_backlog",
] as const;
export type TapAvailabilityGateDecision =
  (typeof TAP_AVAILABILITY_GATE_DECISIONS)[number];

export const TAP_BACKLOG_PRIORITY_LEVELS = [
  "p0",
  "p1",
  "p2",
  "p3",
] as const;
export type TapBacklogPriorityLevel =
  (typeof TAP_BACKLOG_PRIORITY_LEVELS)[number];

export interface TapBacklogCapabilityAuditEntry {
  capabilityKey: string;
  familyKey: "pending_closure" | "runtime_thick";
  reason: string;
  priority: TapBacklogPriorityLevel;
  recommendedAction: "implement" | "split" | "stabilize" | "defer";
}

export interface TapAvailabilityGateRecord {
  capabilityKey: string;
  familyKey: TapFormalFamilyKey | "pending_closure" | "runtime_thick";
  decision: TapAvailabilityGateDecision;
  reason: string;
  reviewRequired: boolean;
  runtimeAllowed: boolean;
  metadata?: Record<string, unknown>;
}

export interface TapAvailabilityGatingReport {
  generatedAt: string;
  decisions: TapAvailabilityGateRecord[];
  summary: {
    baseline: number;
    reviewOnly: number;
    blocked: number;
    pendingBacklog: number;
  };
  familyDecisions: Array<{
    familyKey: TapAvailabilityGateRecord["familyKey"];
    decisions: TapAvailabilityGateDecision[];
    dominantDecision: TapAvailabilityGateDecision;
  }>;
  metadata?: Record<string, unknown>;
}

export interface CreateTapAvailabilityGatingReportInput {
  availabilityReport: TapCapabilityAvailabilityReport;
  familyReports?: Partial<Record<TapFormalFamilyKey, TapFamilyCheckReport>>;
  backlogEntries?: readonly TapBacklogCapabilityAuditEntry[];
  now?: () => Date;
  metadata?: Record<string, unknown>;
}

function isBaselineCandidate(row: TapCapabilityAvailabilityRow): boolean {
  return row.familyKey === "foundation"
    && row.contract.riskLevel === "normal"
    && row.contract.reviewRequirements.every((requirement) => requirement === "allow");
}

function createFormalGateRecord(params: {
  row: TapCapabilityAvailabilityRow;
  familyReport?: TapFamilyCheckReport;
}): TapAvailabilityGateRecord {
  const { row, familyReport } = params;

  if (familyReport?.status === "blocked" || row.gate.status === "blocked") {
    return {
      capabilityKey: row.capabilityKey,
      familyKey: row.familyKey,
      decision: "blocked",
      reason: familyReport?.summary ?? "Capability availability gate is blocked.",
      reviewRequired: false,
      runtimeAllowed: false,
      metadata: {
        gateReasons: row.gate.reasons,
      },
    };
  }

  if (isBaselineCandidate(row) && row.gate.status === "ready") {
    return {
      capabilityKey: row.capabilityKey,
      familyKey: row.familyKey,
      decision: "baseline",
      reason: "Capability is production-like and matches baseline local-tooling criteria.",
      reviewRequired: false,
      runtimeAllowed: true,
    };
  }

  if (
    familyReport?.status === "review_required"
    || row.gate.status === "review_required"
  ) {
    return {
      capabilityKey: row.capabilityKey,
      familyKey: row.familyKey,
      decision: "review_only",
      reason: familyReport?.summary ?? "Capability requires review before runtime use.",
      reviewRequired: true,
      runtimeAllowed: true,
      metadata: {
        gateReasons: row.gate.reasons,
      },
    };
  }

  return {
    capabilityKey: row.capabilityKey,
    familyKey: row.familyKey,
    decision: "review_only",
    reason: "Capability is available but should stay behind review due to family or policy scope.",
    reviewRequired: true,
    runtimeAllowed: true,
  };
}

function createBacklogGateRecord(
  entry: TapBacklogCapabilityAuditEntry,
): TapAvailabilityGateRecord {
  return {
    capabilityKey: entry.capabilityKey,
    familyKey: entry.familyKey,
    decision: "pending_backlog",
    reason: entry.reason,
    reviewRequired: false,
    runtimeAllowed: false,
    metadata: {
      priority: entry.priority,
      recommendedAction: entry.recommendedAction,
    },
  };
}

function summarizeFamilyDecisions(
  decisions: readonly TapAvailabilityGateRecord[],
): TapAvailabilityGatingReport["familyDecisions"] {
  const familyKeys = [...new Set(decisions.map((decision) => decision.familyKey))];
  const order: TapAvailabilityGateDecision[] = [
    "blocked",
    "pending_backlog",
    "review_only",
    "baseline",
  ];

  return familyKeys.map((familyKey) => {
    const familyDecisions = decisions
      .filter((decision) => decision.familyKey === familyKey)
      .map((decision) => decision.decision);
    const dominantDecision =
      order.find((candidate) => familyDecisions.includes(candidate)) ?? "baseline";

    return {
      familyKey,
      decisions: familyDecisions,
      dominantDecision,
    };
  });
}

export function createTapAvailabilityGatingReport(
  input: CreateTapAvailabilityGatingReportInput,
): TapAvailabilityGatingReport {
  const formalDecisions = input.availabilityReport.rows.map((row) =>
    createFormalGateRecord({
      row,
      familyReport: input.familyReports?.[row.familyKey],
    })
  );
  const backlogDecisions = (input.backlogEntries ?? []).map(createBacklogGateRecord);
  const decisions = [...formalDecisions, ...backlogDecisions];

  return {
    generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    decisions,
    summary: {
      baseline: decisions.filter((entry) => entry.decision === "baseline").length,
      reviewOnly: decisions.filter((entry) => entry.decision === "review_only").length,
      blocked: decisions.filter((entry) => entry.decision === "blocked").length,
      pendingBacklog: decisions.filter((entry) => entry.decision === "pending_backlog").length,
    },
    familyDecisions: summarizeFamilyDecisions(decisions),
    metadata: input.metadata,
  };
}
