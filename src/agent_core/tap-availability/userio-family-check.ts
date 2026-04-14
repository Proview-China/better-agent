import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type { TapFamilyCheckReport, TapFamilyCheckSeverity } from "./family-check-types.js";

export const USERIO_FAMILY_CHECK_CAPABILITY_KEYS = [
  "question.ask",
  "request_user_input",
  "request_permissions",
  "audio.transcribe",
  "speech.synthesize",
  "image.generate",
] as const;

function asUserIoRow(
  row: TapCapabilityAvailabilityReport["rows"][number],
): row is TapCapabilityAvailabilityRow & {
  capabilityKey: (typeof USERIO_FAMILY_CHECK_CAPABILITY_KEYS)[number];
} {
  return row.familyKey === "userio"
    && USERIO_FAMILY_CHECK_CAPABILITY_KEYS.includes(
      row.capabilityKey as (typeof USERIO_FAMILY_CHECK_CAPABILITY_KEYS)[number],
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

export function createUserIoFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const rows = report.rows.filter(asUserIoRow);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const keys = new Set(rows.map((row) => row.capabilityKey));

  if (!USERIO_FAMILY_CHECK_CAPABILITY_KEYS.every((key) => keys.has(key))) {
    blockers.push("userio family is missing one of the structured operator or multimodal capabilities.");
  }

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

  const status = blockers.length > 0
    ? "blocked"
    : warnings.length > 0
      ? "review_required"
      : "ready";

  return {
    familyKey: "userio",
    status,
    productionLikeReady: status === "ready",
    summary: status === "ready"
      ? "Userio family passes the current registration, activation, and multimodal execution checks."
      : "Userio family still has registration, activation, or execution readiness gaps.",
    capabilityKeys: [...USERIO_FAMILY_CHECK_CAPABILITY_KEYS],
    checkedAt: now().toISOString(),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    findings: rows.map((row) => ({
      capabilityKey: row.capabilityKey,
      severity: toSeverity(status),
      code: `userio.${status}`,
      summary: `${row.capabilityKey} was evaluated against userio family readiness checks.`,
      metadata: {
        supportRoutes: row.supportRoutes,
        gate: row.gate,
      },
    })),
    rows,
    metadata: {
      expectedKeys: [...USERIO_FAMILY_CHECK_CAPABILITY_KEYS],
    },
  };
}
