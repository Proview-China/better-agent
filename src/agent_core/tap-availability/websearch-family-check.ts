import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type { TapFamilyCheckReport } from "./family-check-types.js";

export type WebsearchFamilyCheckStatus = "ready" | "review_required" | "blocked";

export interface WebsearchFailureTaxonomyCheck {
  status: WebsearchFamilyCheckStatus;
  declared: boolean;
  failureSignals: string[];
  coversInputValidation: boolean;
  coversRuntimeFailure: boolean;
  coversBlockedOrTimeout: boolean;
  notes: string[];
}

export interface WebsearchTruthfulnessCheck {
  status: WebsearchFamilyCheckStatus;
  hasEnvelopeEvidence: boolean;
  hasGroundingEvidence: boolean;
  successCriteria: string[];
  requiresGroundedAnswer: boolean;
  notes: string[];
}

export interface WebsearchProviderCoverageCheck {
  status: WebsearchFamilyCheckStatus;
  supportRouteCount: number;
  providers: string[];
  routeStatuses: string[];
  hasProviderDiffSignal: boolean;
  notes: string[];
}

export interface WebsearchCapabilityChecks {
  register: boolean;
  prepare: boolean;
  execute: boolean;
  health: boolean;
  smoke: boolean;
}

export interface WebsearchFamilyAvailabilityReport {
  familyKey: "websearch";
  capabilityKey: "search.ground";
  status: WebsearchFamilyCheckStatus;
  productionLikeReady: boolean;
  checks: WebsearchCapabilityChecks;
  failureTaxonomy: WebsearchFailureTaxonomyCheck;
  truthfulness: WebsearchTruthfulnessCheck;
  providerCoverage: WebsearchProviderCoverageCheck;
  blockers: string[];
  warnings: string[];
  evidenceRefs: string[];
  notes: string[];
}

function getWebsearchRow(report: TapCapabilityAvailabilityReport): TapCapabilityAvailabilityRow {
  const row = report.rows.find((entry) => entry.capabilityKey === "search.ground");
  if (!row) {
    throw new Error("search.ground is missing from the TAP availability report.");
  }
  return row;
}

function asStatus(ready: boolean, blocked: boolean): WebsearchFamilyCheckStatus {
  if (blocked) {
    return "blocked";
  }
  return ready ? "ready" : "review_required";
}

function createFailureTaxonomyCheck(row: TapCapabilityAvailabilityRow): WebsearchFailureTaxonomyCheck {
  const failureSignals = row.contract.verification.failureSignals;
  const normalized = failureSignals.map((entry) => entry.toLowerCase());
  const coversInputValidation = normalized.some((entry) =>
    entry.includes("provider") || entry.includes("model") || entry.includes("query input is missing")
  );
  const coversRuntimeFailure = normalized.some((entry) =>
    entry.includes("failed") || entry.includes("partial")
  );
  const coversBlockedOrTimeout = normalized.some((entry) =>
    entry.includes("blocked") || entry.includes("timeout")
  );
  const declared = failureSignals.length > 0;
  const ready = declared && coversInputValidation && coversRuntimeFailure && coversBlockedOrTimeout;
  const blocked = !declared;

  return {
    status: asStatus(ready, blocked),
    declared,
    failureSignals: [...failureSignals],
    coversInputValidation,
    coversRuntimeFailure,
    coversBlockedOrTimeout,
    notes: ready
      ? []
      : [
          "Websearch failure taxonomy still needs full coverage for input validation, runtime failure, and blocked/timeout lanes.",
        ],
  };
}

function createTruthfulnessCheck(row: TapCapabilityAvailabilityRow): WebsearchTruthfulnessCheck {
  const evidenceOutput = row.contract.report.evidenceOutput;
  const successCriteria = row.contract.verification.successCriteria;
  const hasEnvelopeEvidence = evidenceOutput.includes("capability-result-envelope");
  const hasGroundingEvidence = evidenceOutput.includes("websearch-evidence");
  const requiresGroundedAnswer = successCriteria.some((entry) =>
    /citation|source/i.test(entry)
  );
  const ready = hasEnvelopeEvidence && hasGroundingEvidence && requiresGroundedAnswer;
  const blocked = !hasEnvelopeEvidence && !hasGroundingEvidence;

  return {
    status: asStatus(ready, blocked),
    hasEnvelopeEvidence,
    hasGroundingEvidence,
    successCriteria: [...successCriteria],
    requiresGroundedAnswer,
    notes: ready
      ? []
      : [
          "Grounding truthfulness should explicitly keep both envelope evidence and websearch-specific evidence attached.",
        ],
  };
}

function parseSupportRouteEvidence(row: TapCapabilityAvailabilityRow) {
  const supportEntries = row.evidence.filter((entry) => entry.source === "support_matrix");
  const providers = new Set<string>();
  const routeStatuses = new Set<string>();

  for (const entry of supportEntries) {
    const parts = entry.ref.split(":");
    if (parts[0]) {
      providers.add(parts[0]);
    }
    if (parts[3]) {
      routeStatuses.add(parts[3]);
    }
  }

  return {
    providers: [...providers],
    routeStatuses: [...routeStatuses],
    supportRouteCount: supportEntries.length || row.supportRoutes || row.contract.supportRouteCount,
  };
}

function createProviderCoverageCheck(row: TapCapabilityAvailabilityRow): WebsearchProviderCoverageCheck {
  const parsed = parseSupportRouteEvidence(row);
  const hasProviderDiffSignal = parsed.providers.length > 1 || parsed.routeStatuses.length > 1;
  const blocked = parsed.supportRouteCount === 0;
  const ready = !blocked && hasProviderDiffSignal;

  return {
    status: asStatus(ready, blocked),
    supportRouteCount: parsed.supportRouteCount,
    providers: parsed.providers,
    routeStatuses: parsed.routeStatuses,
    hasProviderDiffSignal,
    notes: ready
      ? []
      : blocked
        ? [
            "Websearch provider/support-route difference is not yet modeled in the current availability evidence.",
          ]
        : [
            "Support routes exist, but provider differences are still too shallow to be considered production-like.",
          ],
  };
}

export function createWebsearchFamilyAvailabilityReport(
  report: TapCapabilityAvailabilityReport,
): WebsearchFamilyAvailabilityReport {
  const row = getWebsearchRow(report);
  const failureTaxonomy = createFailureTaxonomyCheck(row);
  const truthfulness = createTruthfulnessCheck(row);
  const providerCoverage = createProviderCoverageCheck(row);

  const checks: WebsearchCapabilityChecks = {
    register: row.observed.registered,
    prepare: row.observed.prepareReady,
    execute: row.observed.executeReady,
    health: row.observed.healthy,
    smoke: row.contract.smoke.smokeEntry.length > 0,
  };

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.register) {
    blockers.push("search.ground is not registered in the observed TAP runtime.");
  }
  if (!checks.prepare) {
    blockers.push("search.ground prepare path is not ready.");
  }
  if (!checks.execute) {
    blockers.push("search.ground execute path is not ready.");
  }
  if (!checks.smoke) {
    blockers.push("search.ground smoke entry is missing.");
  }
  if (failureTaxonomy.status === "blocked") {
    blockers.push("search.ground failure taxonomy is missing.");
  }
  if (truthfulness.status === "blocked") {
    blockers.push("search.ground truthfulness evidence is insufficient.");
  }
  if (!checks.health) {
    warnings.push("search.ground has not produced a healthy runtime observation yet.");
  }
  if (failureTaxonomy.status === "review_required") {
    warnings.push(...failureTaxonomy.notes);
  }
  if (truthfulness.status === "review_required") {
    warnings.push(...truthfulness.notes);
  }
  if (providerCoverage.status !== "ready") {
    warnings.push(...providerCoverage.notes);
  }
  if (row.gate.status === "review_required") {
    warnings.push(...row.gate.reasons);
  }
  if (row.gate.status === "blocked") {
    blockers.push(...row.gate.reasons);
  }

  const status: WebsearchFamilyCheckStatus =
    blockers.length > 0
      ? "blocked"
      : warnings.length > 0
        ? "review_required"
        : "ready";

  return {
    familyKey: "websearch",
    capabilityKey: "search.ground",
    status,
    productionLikeReady: status === "ready",
    checks,
    failureTaxonomy,
    truthfulness,
    providerCoverage,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    evidenceRefs: row.evidence.map((entry) => entry.ref),
    notes: [
      "This report is package/report-driven and does not perform live websearch execution.",
      "Provider/support-route coverage is inferred only from the current TAP availability evidence.",
    ],
  };
}

export function createWebsearchFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const familyReport = createWebsearchFamilyAvailabilityReport(report);
  const row = getWebsearchRow(report);

  return {
    familyKey: "websearch",
    status: familyReport.status,
    productionLikeReady: familyReport.productionLikeReady,
    summary: familyReport.productionLikeReady
      ? "Websearch family passes the current production-like availability checks."
      : "Websearch family still needs stronger registration, truthfulness, or provider-route evidence.",
    capabilityKeys: ["search.ground"],
    checkedAt: now().toISOString(),
    blockers: [...familyReport.blockers],
    warnings: [...familyReport.warnings],
    findings: [
      {
        capabilityKey: "search.ground",
        severity: familyReport.status === "blocked"
          ? "blocking"
          : familyReport.status === "review_required"
            ? "warning"
            : "info",
        code: `websearch.${familyReport.status}`,
        summary: "search.ground was checked against websearch family production-like criteria.",
        metadata: {
          checks: familyReport.checks,
          failureTaxonomy: familyReport.failureTaxonomy,
          truthfulness: familyReport.truthfulness,
          providerCoverage: familyReport.providerCoverage,
          evidenceRefs: familyReport.evidenceRefs,
        },
      },
    ],
    rows: [row],
    metadata: {
      notes: familyReport.notes,
    },
  };
}
