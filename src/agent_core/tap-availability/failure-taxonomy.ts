import type {
  TapAvailabilityEvidenceSource,
  TapCapabilityAvailabilityGateStatus,
} from "./availability-types.js";

export const TAP_FAILURE_DECISIONS = [
  "pass",
  "degrade",
  "retry",
  "block",
  "human_gate",
] as const;
export type TapFailureDecision = (typeof TAP_FAILURE_DECISIONS)[number];

export const TAP_FAILURE_SEVERITIES = [
  "info",
  "warning",
  "blocking",
  "critical",
] as const;
export type TapFailureSeverity = (typeof TAP_FAILURE_SEVERITIES)[number];

export const TAP_FAILURE_CLASSES = [
  "registration_gap",
  "execution_gap",
  "health_gap",
  "evidence_gap",
  "truthfulness_gap",
  "boundary_gap",
  "recovery_gap",
  "backlog_gap",
  "transient_runtime",
  "governance_risk",
] as const;
export type TapFailureClass = (typeof TAP_FAILURE_CLASSES)[number];

export const TAP_FAILURE_EVIDENCE_CLASSES = [
  "inventory_declared",
  "package_declared",
  "runtime_observed",
  "support_matrix_declared",
  "governance_observed",
] as const;
export type TapFailureEvidenceClass = (typeof TAP_FAILURE_EVIDENCE_CLASSES)[number];

export interface TapFailureEvidenceRequirement {
  evidenceClass: TapFailureEvidenceClass;
  sources: TapAvailabilityEvidenceSource[];
  summary: string;
}

export interface TapFailureTaxonomyEntry {
  code: string;
  failureClass: TapFailureClass;
  severity: TapFailureSeverity;
  defaultDecision: TapFailureDecision;
  retryable: boolean;
  requiresHumanGate: boolean;
  requiredEvidence: TapFailureEvidenceRequirement[];
  notes: string[];
}

export interface TapFailureClassificationInput {
  code: string;
  gateStatus?: TapCapabilityAvailabilityGateStatus;
  retryable?: boolean;
  requiresHumanGate?: boolean;
}

export interface TapFailureClassification {
  entry: TapFailureTaxonomyEntry;
  decision: TapFailureDecision;
  rationale: string;
}

const INVENTORY_AND_RUNTIME_EVIDENCE: TapFailureEvidenceRequirement[] = [
  {
    evidenceClass: "inventory_declared",
    sources: ["inventory", "registered_manifest", "binding"],
    summary: "Need formal inventory plus registration/binding evidence to prove the capability exists in the assembly path.",
  },
];

const HEALTH_EVIDENCE: TapFailureEvidenceRequirement[] = [
  {
    evidenceClass: "runtime_observed",
    sources: ["pool_health", "registered_manifest", "binding"],
    summary: "Need runtime health observations tied to a real binding before treating the capability as healthy.",
  },
];

const SUPPORT_AND_REPORT_EVIDENCE: TapFailureEvidenceRequirement[] = [
  {
    evidenceClass: "support_matrix_declared",
    sources: ["support_matrix", "report", "package_verification"],
    summary: "Need support-matrix and report evidence to prove truthful provider/runtime boundaries.",
  },
];

const GOVERNANCE_EVIDENCE: TapFailureEvidenceRequirement[] = [
  {
    evidenceClass: "governance_observed",
    sources: ["activation_spec", "report"],
    summary: "Need governance/activation evidence before widening dangerous or destructive capability use.",
  },
];

const TAP_FAILURE_TAXONOMY: readonly TapFailureTaxonomyEntry[] = [
  {
    code: "missing_registration",
    failureClass: "registration_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: INVENTORY_AND_RUNTIME_EVIDENCE,
    notes: ["Formal capability is not registered into the active pool, so production-like execution must stop."],
  },
  {
    code: "missing_prepare_readiness",
    failureClass: "execution_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: INVENTORY_AND_RUNTIME_EVIDENCE,
    notes: ["Prepare path is missing or not observed, so runtime assembly cannot safely continue."],
  },
  {
    code: "missing_execute_readiness",
    failureClass: "execution_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: INVENTORY_AND_RUNTIME_EVIDENCE,
    notes: ["Execute path is missing or not observed, so the capability is not production-like."],
  },
  {
    code: "missing_runtime_health_observation",
    failureClass: "health_gap",
    severity: "warning",
    defaultDecision: "degrade",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: HEALTH_EVIDENCE,
    notes: ["Health hooks exist but there is no observed healthy runtime signal yet."],
  },
  {
    code: "missing_evidence_output",
    failureClass: "evidence_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: SUPPORT_AND_REPORT_EVIDENCE,
    notes: ["Evidence output is missing, so downstream audit and recovery cannot trust the capability."],
  },
  {
    code: "missing_truthfulness_marker",
    failureClass: "truthfulness_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: SUPPORT_AND_REPORT_EVIDENCE,
    notes: ["Truthfulness marker is missing, so provider/runtime boundary claims cannot be trusted."],
  },
  {
    code: "missing_provider_native_route",
    failureClass: "boundary_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: SUPPORT_AND_REPORT_EVIDENCE,
    notes: ["Native-execute capability lost its provider-native boundary declaration."],
  },
  {
    code: "missing_recovery_contract",
    failureClass: "recovery_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: GOVERNANCE_EVIDENCE,
    notes: ["Activation/replay/recovery contract is missing, so crash-safe continuation is not possible."],
  },
  {
    code: "pending_closure_capability",
    failureClass: "backlog_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: INVENTORY_AND_RUNTIME_EVIDENCE,
    notes: ["Capability is intentionally tracked as pending closure and must not be treated as formal-ready."],
  },
  {
    code: "runtime_timeout",
    failureClass: "transient_runtime",
    severity: "warning",
    defaultDecision: "retry",
    retryable: true,
    requiresHumanGate: false,
    requiredEvidence: HEALTH_EVIDENCE,
    notes: ["Observed timeout looks transient; retry is preferred before escalation."],
  },
  {
    code: "destructive_capability_request",
    failureClass: "governance_risk",
    severity: "critical",
    defaultDecision: "human_gate",
    retryable: false,
    requiresHumanGate: true,
    requiredEvidence: GOVERNANCE_EVIDENCE,
    notes: ["Dangerous or destructive requests must stop at human gate even in permissive modes."],
  },
];

const TAXONOMY_BY_CODE = new Map(
  TAP_FAILURE_TAXONOMY.map((entry) => [entry.code, entry] as const),
);

const DECISION_PRIORITY: Record<TapFailureDecision, number> = {
  pass: 0,
  degrade: 1,
  retry: 2,
  block: 3,
  human_gate: 4,
};

function createFallbackTaxonomyEntry(code: string): TapFailureTaxonomyEntry {
  return {
    code,
    failureClass: "execution_gap",
    severity: "blocking",
    defaultDecision: "block",
    retryable: false,
    requiresHumanGate: false,
    requiredEvidence: INVENTORY_AND_RUNTIME_EVIDENCE,
    notes: ["Unknown failure code falls back to blocking until a formal taxonomy entry exists."],
  };
}

export function listTapFailureTaxonomy(): readonly TapFailureTaxonomyEntry[] {
  return TAP_FAILURE_TAXONOMY;
}

export function getTapFailureTaxonomyEntry(code: string): TapFailureTaxonomyEntry {
  return TAXONOMY_BY_CODE.get(code) ?? createFallbackTaxonomyEntry(code);
}

export function classifyTapFailure(
  input: TapFailureClassificationInput,
): TapFailureClassification {
  const entry = getTapFailureTaxonomyEntry(input.code);

  let decision = entry.defaultDecision;
  if (input.requiresHumanGate || entry.requiresHumanGate) {
    decision = "human_gate";
  } else if (input.retryable && entry.retryable) {
    decision = "retry";
  } else if (input.gateStatus === "review_required" && decision === "block") {
    decision = "degrade";
  } else if (input.gateStatus === "ready" && decision === "degrade") {
    decision = "pass";
  }

  return {
    entry,
    decision,
    rationale: `Failure ${entry.code} maps to ${decision} because it is classified as ${entry.failureClass}.`,
  };
}

export function resolveTapFailureDecision(
  failures: readonly TapFailureClassificationInput[],
): TapFailureDecision {
  let decision: TapFailureDecision = "pass";
  for (const failure of failures) {
    const classification = classifyTapFailure(failure);
    if (DECISION_PRIORITY[classification.decision] > DECISION_PRIORITY[decision]) {
      decision = classification.decision;
    }
  }
  return decision;
}
