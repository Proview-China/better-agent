import { createTapCapabilityAvailabilityReport } from "./availability-audit.js";
import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type { TapFamilyCheckReport, TapFamilyCheckSeverity } from "./family-check-types.js";

export const FOUNDATION_FAMILY_CAPABILITY_KEYS = [
  "code.read",
  "code.ls",
  "code.glob",
  "code.grep",
  "code.read_many",
  "code.symbol_search",
  "code.lsp",
  "spreadsheet.read",
  "doc.read",
  "read_pdf",
  "read_notebook",
  "view_image",
  "docs.read",
  "repo.write",
  "spreadsheet.write",
  "doc.write",
  "code.edit",
  "code.patch",
  "shell.restricted",
  "shell.session",
  "test.run",
  "git.status",
  "git.diff",
  "git.commit",
  "git.push",
  "code.diff",
  "browser.playwright",
  "skill.doc.generate",
  "write_todos",
] as const;

export type FoundationFamilyCapabilityKey =
  (typeof FOUNDATION_FAMILY_CAPABILITY_KEYS)[number];

export type FoundationFamilyFindingStatus =
  | "ready"
  | "warning"
  | "blocked";

export interface FoundationCapabilityFinding {
  capabilityKey: FoundationFamilyCapabilityKey;
  status: FoundationFamilyFindingStatus;
  blockers: string[];
  warnings: string[];
  notes: string[];
}

export interface FoundationFamilySummary {
  familyKey: "foundation";
  capabilityCount: number;
  readyCount: number;
  warningCount: number;
  blockedCount: number;
  registeredCount: number;
  executeReadyCount: number;
}

export interface FoundationFamilyAvailabilityCheck {
  familyKey: "foundation";
  summary: FoundationFamilySummary;
  capabilityFindings: FoundationCapabilityFinding[];
  blockers: string[];
  warnings: string[];
  productionLike: boolean;
}

export interface CreateFoundationFamilyAvailabilityCheckInput {
  report?: TapCapabilityAvailabilityReport;
}

function asFoundationRow(
  row: TapCapabilityAvailabilityReport["rows"][number],
): row is TapCapabilityAvailabilityRow & { capabilityKey: FoundationFamilyCapabilityKey } {
  return row.familyKey === "foundation"
    && FOUNDATION_FAMILY_CAPABILITY_KEYS.includes(
      row.capabilityKey as FoundationFamilyCapabilityKey,
    );
}

function createCapabilityFinding(
  row: TapCapabilityAvailabilityRow & { capabilityKey: FoundationFamilyCapabilityKey },
): FoundationCapabilityFinding {
  const blockers = new Set<string>();
  const warnings = new Set<string>();
  const notes = new Set<string>();

  if (!row.observed.registered) {
    blockers.add("missing_registration");
  }
  if (!row.observed.prepareReady) {
    blockers.add("missing_prepare_readiness");
  }
  if (!row.observed.executeReady) {
    blockers.add("missing_execute_readiness");
  }
  if (!row.observed.hasActivationFactory) {
    blockers.add("missing_activation_factory");
  }

  for (const reason of row.gate.reasons) {
    if (reason === "missing_runtime_health_observation") {
      warnings.add(reason);
    } else {
      blockers.add(reason);
    }
  }

  if (!row.contract.health.adapterHealthCheckSupported) {
    warnings.add("health_hook_not_implemented");
    notes.add(
      "Foundation capability currently relies on declared verification metadata instead of runtime health hooks.",
    );
  }

  if (row.contract.smoke.source !== "test_entry") {
    warnings.add("declared_smoke_only");
    notes.add(
      "Foundation capability smoke uses declared verification entry, suitable for local tooling baseline but not a dedicated runtime smoke executor.",
    );
  }

  if (row.contract.report.evidenceOutput.length === 0) {
    blockers.add("missing_evidence_output");
  }

  const status: FoundationFamilyFindingStatus =
    blockers.size > 0
      ? "blocked"
      : warnings.size > 0
        ? "warning"
        : "ready";

  return {
    capabilityKey: row.capabilityKey,
    status,
    blockers: [...blockers],
    warnings: [...warnings],
    notes: [...notes],
  };
}

export function createFoundationFamilyAvailabilityCheck(
  input: CreateFoundationFamilyAvailabilityCheckInput = {},
): FoundationFamilyAvailabilityCheck {
  const report = input.report ?? createTapCapabilityAvailabilityReport();
  const rows = report.rows.filter(asFoundationRow);
  const capabilityFindings = rows.map(createCapabilityFinding);
  const blockers = [...new Set(capabilityFindings.flatMap((entry) => entry.blockers))];
  const warnings = [...new Set(capabilityFindings.flatMap((entry) => entry.warnings))];

  const summary: FoundationFamilySummary = {
    familyKey: "foundation",
    capabilityCount: rows.length,
    readyCount: capabilityFindings.filter((entry) => entry.status === "ready").length,
    warningCount: capabilityFindings.filter((entry) => entry.status === "warning").length,
    blockedCount: capabilityFindings.filter((entry) => entry.status === "blocked").length,
    registeredCount: rows.filter((row) => row.observed.registered).length,
    executeReadyCount: rows.filter((row) => row.observed.executeReady).length,
  };

  return {
    familyKey: "foundation",
    summary,
    capabilityFindings,
    blockers,
    warnings,
    productionLike: summary.blockedCount === 0,
  };
}

function toSeverity(
  status: FoundationFamilyFindingStatus,
): TapFamilyCheckSeverity {
  switch (status) {
    case "blocked":
      return "blocking";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

export function createFoundationFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const result = createFoundationFamilyAvailabilityCheck({ report });
  const rows = report.rows.filter(asFoundationRow);

  return {
    familyKey: "foundation",
    status: result.summary.blockedCount > 0
      ? "blocked"
      : result.summary.warningCount > 0
        ? "review_required"
        : "ready",
    productionLikeReady: result.productionLike,
    summary: result.productionLike
      ? "Foundation family is production-like for local read/write/test/doc tooling, with only non-blocking local baseline warnings."
      : "Foundation family still has blocking local tooling gaps before it can be treated as production-like.",
    capabilityKeys: [...FOUNDATION_FAMILY_CAPABILITY_KEYS],
    checkedAt: now().toISOString(),
    blockers: [...result.blockers],
    warnings: [...result.warnings],
    findings: result.capabilityFindings.flatMap((entry) => {
      const baseSeverity = toSeverity(entry.status);
      const directFinding = {
        capabilityKey: entry.capabilityKey,
        severity: baseSeverity,
        code: `foundation.${entry.status}`,
        summary: `${entry.capabilityKey} is ${entry.status} in the local tooling baseline.`,
        metadata: {
          blockers: entry.blockers,
          warnings: entry.warnings,
          notes: entry.notes,
        },
      };
      return [directFinding];
    }),
    rows,
    metadata: {
      readyCount: result.summary.readyCount,
      warningCount: result.summary.warningCount,
      blockedCount: result.summary.blockedCount,
      registeredCount: result.summary.registeredCount,
      executeReadyCount: result.summary.executeReadyCount,
    },
  };
}
