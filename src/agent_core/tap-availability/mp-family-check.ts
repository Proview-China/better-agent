import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type { TapFamilyCheckReport, TapFamilyCheckSeverity } from "./family-check-types.js";

export const MP_FAMILY_CHECK_CAPABILITY_KEYS = [
  "mp.ingest",
  "mp.align",
  "mp.resolve",
  "mp.history.request",
  "mp.search",
  "mp.materialize",
  "mp.promote",
  "mp.archive",
  "mp.split",
  "mp.merge",
  "mp.reindex",
  "mp.compact",
] as const;

function asMpRow(
  row: TapCapabilityAvailabilityReport["rows"][number],
): row is TapCapabilityAvailabilityRow & {
  capabilityKey: (typeof MP_FAMILY_CHECK_CAPABILITY_KEYS)[number];
} {
  return row.familyKey === "mp"
    && MP_FAMILY_CHECK_CAPABILITY_KEYS.includes(
      row.capabilityKey as (typeof MP_FAMILY_CHECK_CAPABILITY_KEYS)[number],
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

export function createMpFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const rows = report.rows.filter(asMpRow);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const presentKeys = new Set(rows.map((row) => row.capabilityKey));

  if (!MP_FAMILY_CHECK_CAPABILITY_KEYS.every((key) => presentKeys.has(key))) {
    blockers.push("mp family is missing one of the workflow or atomic MP capabilities.");
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
    if (row.supportRoutes === 0) {
      warnings.push(`${row.capabilityKey} has no declared support routes.`);
    }
    if (!row.contract.health.adapterHealthCheckSupported) {
      warnings.push(`${row.capabilityKey} has no runtime health hook yet.`);
    }
  }

  const status = blockers.length > 0
    ? "blocked"
    : warnings.length > 0
      ? "review_required"
      : "ready";

  return {
    familyKey: "mp",
    status,
    productionLikeReady: status === "ready",
    summary: status === "ready"
      ? "MP family passes the current registration, activation, and execution checks."
      : "MP family still has registration, activation, or support-route gaps.",
    capabilityKeys: [...MP_FAMILY_CHECK_CAPABILITY_KEYS],
    checkedAt: now().toISOString(),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    findings: rows.map((row) => ({
      capabilityKey: row.capabilityKey,
      severity: toSeverity(status),
      code: `mp.${status}`,
      summary: `${row.capabilityKey} was evaluated against MP family workflow checks.`,
      metadata: {
        supportRoutes: row.supportRoutes,
        gate: row.gate,
      },
    })),
    rows,
    metadata: {
      expectedKeys: [...MP_FAMILY_CHECK_CAPABILITY_KEYS],
    },
  };
}
