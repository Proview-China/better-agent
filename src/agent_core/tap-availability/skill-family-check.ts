import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type { TapFamilyCheckReport, TapFamilyCheckSeverity } from "./family-check-types.js";

export const SKILL_FAMILY_CAPABILITY_KEYS = [
  "skill.use",
  "skill.mount",
  "skill.prepare",
] as const;

function asSkillRow(
  row: TapCapabilityAvailabilityReport["rows"][number],
): row is TapCapabilityAvailabilityRow & { capabilityKey: (typeof SKILL_FAMILY_CAPABILITY_KEYS)[number] } {
  return row.familyKey === "skill"
    && SKILL_FAMILY_CAPABILITY_KEYS.includes(
      row.capabilityKey as (typeof SKILL_FAMILY_CAPABILITY_KEYS)[number],
    );
}

function toSeverity(status: TapFamilyCheckReport["status"]): TapFamilyCheckSeverity {
  if (status === "blocked") {
    return "blocking";
  }
  if (status === "review_required") {
    return "warning";
  }
  return "info";
}

function buildBoundaryNotes(
  rows: Array<TapCapabilityAvailabilityRow & { capabilityKey: (typeof SKILL_FAMILY_CAPABILITY_KEYS)[number] }>,
): { status: TapFamilyCheckReport["status"]; notes: string[] } {
  const notes: string[] = [];
  const keys = new Set(rows.map((row) => row.capabilityKey));
  if (!SKILL_FAMILY_CAPABILITY_KEYS.every((key) => keys.has(key))) {
    notes.push("progressive loading is incomplete because one of skill.use / skill.mount / skill.prepare is missing.");
  }
  if (!rows.every((row) => row.supportRoutes > 0)) {
    notes.push("carrier coverage is incomplete because some skill capability has no declared support routes.");
  }
  if (!rows.every((row) => row.observed.hasActivationFactory)) {
    notes.push("activation coverage is incomplete because some skill capability has no observed activation factory.");
  }
  if (!rows.every((row) => row.contract.supportsRecovery)) {
    notes.push("replay coverage is incomplete because some skill capability has no declared recovery contract.");
  }
  const hasManagedLifecycleLeak = rows.some((row) =>
    row.evidence.some((entry) =>
      entry.source === "package_usage" && /listversions|getversion|publish|remove/i.test(entry.ref)
    )
  );
  if (hasManagedLifecycleLeak) {
    notes.push("managed lifecycle leaked into the skill family boundary and needs review.");
  }

  const status = notes.length === 0
    ? "ready"
    : keys.size === SKILL_FAMILY_CAPABILITY_KEYS.length
      ? "review_required"
      : "blocked";

  return {
    status,
    notes,
  };
}

export function createSkillFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const rows = report.rows.filter(asSkillRow);
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    if (!row.observed.registered) {
      blockers.push(`${row.capabilityKey} is not registered.`);
    }
    if (!row.observed.prepareReady) {
      blockers.push(`${row.capabilityKey} prepare path is not ready.`);
    }
    if (!row.observed.executeReady) {
      blockers.push(`${row.capabilityKey} execute path is not ready.`);
    }
    if (!row.observed.hasActivationFactory) {
      blockers.push(`${row.capabilityKey} is missing an activation factory.`);
    }
    if (!row.contract.health.adapterHealthCheckSupported) {
      warnings.push(`${row.capabilityKey} has no runtime health hook yet.`);
    }
    if (row.gate.status === "review_required") {
      warnings.push(...row.gate.reasons.map((reason) => `${row.capabilityKey}:${reason}`));
    }
    if (row.gate.status === "blocked") {
      blockers.push(...row.gate.reasons.map((reason) => `${row.capabilityKey}:${reason}`));
    }
  }

  const boundary = buildBoundaryNotes(rows);
  if (boundary.status === "blocked") {
    blockers.push(...boundary.notes);
  } else if (boundary.status === "review_required") {
    warnings.push(...boundary.notes);
  }

  const status = blockers.length > 0
    ? "blocked"
    : warnings.length > 0
      ? "review_required"
      : "ready";

  return {
    familyKey: "skill",
    status,
    productionLikeReady: status === "ready",
    summary: status === "ready"
      ? "Skill family passes the current progressive-loading and boundary checks."
      : "Skill family still has progressive-loading, carrier, activation, or replay gaps.",
    capabilityKeys: [...SKILL_FAMILY_CAPABILITY_KEYS],
    checkedAt: now().toISOString(),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    findings: rows.map((row) => ({
      capabilityKey: row.capabilityKey,
      severity: toSeverity(status),
      code: `skill.${status}`,
      summary: `${row.capabilityKey} was evaluated against skill family progressive-loading and boundary checks.`,
      metadata: {
        supportRoutes: row.supportRoutes,
        supportsRecovery: row.contract.supportsRecovery,
        gate: row.gate,
      },
    })),
    rows,
    metadata: {
      boundary,
    },
  };
}
