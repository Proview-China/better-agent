import type {
  CapabilityBinding,
  CapabilityBindingState,
  CapabilityManifest,
} from "../capability-types/index.js";
import type {
  PoolActivationSpec,
  ReviewDecision,
  AccessRequest,
  TmaExecutionLane,
} from "../ta-pool-types/index.js";
import type { TmaReadyBundleReceipt } from "../ta-pool-provision/index.js";
import type {
  TaActivationAttemptRecord,
  TaActivationFailure,
  TaActivationReceipt,
} from "../ta-pool-runtime/activation-types.js";
import type {
  TaHumanGateEvent,
  TaHumanGateState,
} from "../ta-pool-runtime/human-gate.js";
import type {
  TaPendingReplay,
  TaReplayNextAction,
} from "../ta-pool-runtime/replay-policy.js";

export const TA_TOOL_REVIEW_GOVERNANCE_KINDS = [
  "provision_request",
  "activation",
  "delivery",
  "lifecycle",
  "human_gate",
  "replay",
] as const;
export type TaToolReviewGovernanceKind =
  (typeof TA_TOOL_REVIEW_GOVERNANCE_KINDS)[number];

export const TA_TOOL_REVIEW_LIFECYCLE_ACTIONS = [
  "register",
  "replace",
  "suspend",
  "resume",
  "unregister",
] as const;
export type TaToolReviewLifecycleAction =
  (typeof TA_TOOL_REVIEW_LIFECYCLE_ACTIONS)[number];

export const TA_TOOL_REVIEW_OUTPUT_STATUSES = [
  "ready_for_tma_handoff",
  "ready_for_activation_handoff",
  "ready_for_delivery_handoff",
  "activation_failed",
  "ready_for_lifecycle_handoff",
  "lifecycle_blocked",
  "waiting_human",
  "approved",
  "rejected",
  "pending_replay",
  "ready_for_re_review",
  "replay_skipped",
] as const;
export type TaToolReviewOutputStatus =
  (typeof TA_TOOL_REVIEW_OUTPUT_STATUSES)[number];

export const TA_TOOL_REVIEW_AGENT_BOUNDARY_MODES = [
  "governance_only",
] as const;
export type TaToolReviewAgentBoundaryMode =
  (typeof TA_TOOL_REVIEW_AGENT_BOUNDARY_MODES)[number];

export const TA_TOOL_REVIEW_ACTION_STATUSES = [
  "recorded",
  "ready_for_handoff",
  "waiting_human",
  "blocked",
  "completed",
] as const;
export type TaToolReviewActionStatus =
  (typeof TA_TOOL_REVIEW_ACTION_STATUSES)[number];

export const TA_TOOL_REVIEW_QUALITY_VERDICTS = [
  "recorded_only",
  "handoff_ready",
  "waiting_human",
  "blocked",
] as const;
export type TaToolReviewQualityVerdict =
  (typeof TA_TOOL_REVIEW_QUALITY_VERDICTS)[number];

export const TA_TOOL_REVIEW_ADVISORY_CODES = [
  "manual_blocked_resolution",
  "manual_tma_follow_up",
  "manual_human_gate_follow_up",
  "manual_runtime_handoff",
  "manual_re_review",
  "record_evidence_only",
] as const;
export type TaToolReviewAdvisoryCode =
  (typeof TA_TOOL_REVIEW_ADVISORY_CODES)[number];

export const TA_TOOL_REVIEW_ADVISORY_SEVERITIES = [
  "info",
  "warning",
  "critical",
] as const;
export type TaToolReviewAdvisorySeverity =
  (typeof TA_TOOL_REVIEW_ADVISORY_SEVERITIES)[number];

export const TA_TOOL_REVIEW_ADVISORY_ACTORS = [
  "tool_reviewer",
  "runtime_mainline",
  "human_reviewer",
  "tma",
] as const;
export type TaToolReviewAdvisoryActor =
  (typeof TA_TOOL_REVIEW_ADVISORY_ACTORS)[number];

export const TA_TOOL_REVIEW_GOVERNANCE_SIGNAL_KINDS = [
  "hard_stop",
  "human_decision_required",
  "runtime_handoff_ready",
  "re_review_required",
  "tma_repair_candidate",
  "recorded_only",
  "governance_only_boundary",
] as const;
export type TaToolReviewGovernanceSignalKind =
  (typeof TA_TOOL_REVIEW_GOVERNANCE_SIGNAL_KINDS)[number];

export interface ToolReviewSourceDecisionRef {
  decisionId: ReviewDecision["decisionId"];
  decision: ReviewDecision["decision"];
  vote: ReviewDecision["vote"];
  reason: ReviewDecision["reason"];
  escalationTarget?: ReviewDecision["escalationTarget"];
  createdAt: ReviewDecision["createdAt"];
}

export interface ToolReviewRequestRef {
  requestId: AccessRequest["requestId"];
  sessionId: AccessRequest["sessionId"];
  runId: AccessRequest["runId"];
  requestedCapabilityKey: AccessRequest["requestedCapabilityKey"];
  requestedTier: AccessRequest["requestedTier"];
  mode: AccessRequest["mode"];
  canonicalMode: AccessRequest["canonicalMode"];
  riskLevel?: AccessRequest["riskLevel"];
}

export interface ToolReviewGovernanceTrace {
  actionId: string;
  actorId: string;
  reason: string;
  createdAt: string;
  request?: ToolReviewRequestRef;
  sourceDecision?: ToolReviewSourceDecisionRef;
  metadata?: Record<string, unknown>;
}

export interface CreateToolReviewGovernanceTraceInput {
  actionId: string;
  actorId: string;
  reason: string;
  createdAt: string;
  request?: ToolReviewRequestRef;
  sourceDecision?: ToolReviewSourceDecisionRef;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewProvisionRequestInputShell {
  kind: "provision_request";
  trace: ToolReviewGovernanceTrace;
  provisionId: string;
  capabilityKey: string;
  requestedLane: TmaExecutionLane;
  requestedTier?: AccessRequest["requestedTier"];
  metadata?: Record<string, unknown>;
}

export interface ToolReviewActivationInputShell {
  kind: "activation";
  trace: ToolReviewGovernanceTrace;
  provisionId: string;
  capabilityKey: string;
  activationSpec: Pick<
    PoolActivationSpec,
    | "targetPool"
    | "activationMode"
    | "registerOrReplace"
    | "generationStrategy"
    | "drainStrategy"
    | "adapterFactoryRef"
  >;
  currentAttempt?: TaActivationAttemptRecord;
  latestReceipt?: TaActivationReceipt;
  latestFailure?: TaActivationFailure;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewDeliveryInputShell {
  kind: "delivery";
  trace: ToolReviewGovernanceTrace;
  provisionId: string;
  capabilityKey: string;
  receipt: TmaReadyBundleReceipt;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewLifecycleInputShell {
  kind: "lifecycle";
  trace: ToolReviewGovernanceTrace;
  capabilityKey: string;
  lifecycleAction: TaToolReviewLifecycleAction;
  manifest?: Pick<
    CapabilityManifest,
    "capabilityId" | "capabilityKey" | "version" | "generation"
  >;
  binding?: Pick<
    CapabilityBinding,
    "bindingId" | "capabilityId" | "generation" | "state" | "adapterId"
  >;
  targetPool: string;
  failure?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ToolReviewHumanGateInputShell {
  kind: "human_gate";
  trace: ToolReviewGovernanceTrace;
  capabilityKey: string;
  gate: TaHumanGateState;
  latestEvent?: TaHumanGateEvent;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewReplayInputShell {
  kind: "replay";
  trace: ToolReviewGovernanceTrace;
  capabilityKey: string;
  replay: TaPendingReplay;
  metadata?: Record<string, unknown>;
}

export type ToolReviewGovernanceInputShell =
  | ToolReviewProvisionRequestInputShell
  | ToolReviewActivationInputShell
  | ToolReviewDeliveryInputShell
  | ToolReviewLifecycleInputShell
  | ToolReviewHumanGateInputShell
  | ToolReviewReplayInputShell;

export interface ToolReviewProvisionRequestOutputShell {
  kind: "provision_request";
  actionId: string;
  status: "ready_for_tma_handoff";
  capabilityKey: string;
  provisionId: string;
  requestedLane: TmaExecutionLane;
  requestedTier?: AccessRequest["requestedTier"];
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewActivationOutputShell {
  kind: "activation";
  actionId: string;
  status: "ready_for_activation_handoff" | "activation_failed";
  capabilityKey: string;
  provisionId: string;
  targetPool: string;
  attemptId?: string;
  receipt?: TaActivationReceipt;
  failure?: TaActivationFailure;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewDeliveryOutputShell {
  kind: "delivery";
  actionId: string;
  status: "ready_for_delivery_handoff";
  capabilityKey: string;
  provisionId: string;
  lane: string;
  reportId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewLifecycleOutputShell {
  kind: "lifecycle";
  actionId: string;
  status: "ready_for_lifecycle_handoff" | "lifecycle_blocked";
  capabilityKey: string;
  lifecycleAction: TaToolReviewLifecycleAction;
  targetPool: string;
  bindingId?: string;
  targetBindingState?: CapabilityBindingState;
  failure?: {
    code: string;
    message: string;
  };
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewHumanGateOutputShell {
  kind: "human_gate";
  actionId: string;
  status: "waiting_human" | "approved" | "rejected";
  capabilityKey: string;
  gateId: string;
  gateStatus: TaHumanGateState["status"];
  latestEventType?: TaHumanGateEvent["type"];
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewReplayOutputShell {
  kind: "replay";
  actionId: string;
  status: "pending_replay" | "ready_for_re_review" | "replay_skipped";
  capabilityKey: string;
  replayId: string;
  nextAction: TaReplayNextAction;
  summary: string;
  metadata?: Record<string, unknown>;
}

export type ToolReviewGovernanceOutputShell =
  | ToolReviewProvisionRequestOutputShell
  | ToolReviewActivationOutputShell
  | ToolReviewDeliveryOutputShell
  | ToolReviewLifecycleOutputShell
  | ToolReviewHumanGateOutputShell
  | ToolReviewReplayOutputShell;

export interface ToolReviewActionLedgerEntry {
  reviewId: string;
  sessionId: string;
  actionId: string;
  governanceKind: ToolReviewGovernanceInputShell["kind"];
  capabilityKey: string;
  status: TaToolReviewActionStatus;
  boundaryMode: TaToolReviewAgentBoundaryMode;
  output: ToolReviewGovernanceOutputShell;
  recordedAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewGovernancePlanItem {
  reviewId: string;
  actionId: string;
  governanceKind: ToolReviewGovernanceInputShell["kind"];
  capabilityKey: string;
  status: TaToolReviewActionStatus;
  boundaryMode: TaToolReviewAgentBoundaryMode;
  summary: string;
  recordedAt: string;
  updatedAt: string;
  requiresHuman: boolean;
  readyForHandoff: boolean;
  blocked: boolean;
}

export interface ToolReviewGovernancePlanCounts {
  total: number;
  recorded: number;
  readyForHandoff: number;
  waitingHuman: number;
  blocked: number;
  completed: number;
}

export interface ToolReviewGovernancePlan {
  sessionId: string;
  status: "open" | "waiting_human" | "blocked" | "completed";
  capabilityKeys: string[];
  latestActionId?: string;
  latestReviewId?: string;
  counts: ToolReviewGovernancePlanCounts;
  items: ToolReviewGovernancePlanItem[];
  recommendedNextStep: string;
  generatedAt: string;
}

export interface ToolReviewQualityReport {
  sessionId: string;
  verdict: TaToolReviewQualityVerdict;
  summary: string;
  recommendedNextStep: string;
  generatedAt: string;
  counts: ToolReviewGovernancePlanCounts;
  latestActionId?: string;
  latestReviewId?: string;
  blockingReviewIds: string[];
  waitingHumanReviewIds: string[];
  readyForHandoffReviewIds: string[];
  advisories: ToolReviewQualityAdvisory[];
  governanceSignals: ToolReviewGovernanceSignal[];
}

export interface ToolReviewQualityAdvisory {
  code: TaToolReviewAdvisoryCode;
  severity: TaToolReviewAdvisorySeverity;
  actor: TaToolReviewAdvisoryActor;
  summary: string;
  detail: string;
  reviewIds: string[];
  hardStop: boolean;
  requiresManualAction: boolean;
  autoExecutionForbidden: true;
}

export interface ToolReviewGovernanceSignal {
  kind: TaToolReviewGovernanceSignalKind;
  active: boolean;
  summary: string;
  reviewIds: string[];
  hardStop: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewTmaWorkOrder {
  workOrderId: string;
  sessionId: string;
  capabilityKey: string;
  sourceReviewId: string;
  sourceActionId: string;
  sourceGovernanceKind: ToolReviewGovernanceInputShell["kind"];
  requestedLane: TmaExecutionLane;
  priority: "normal" | "high";
  objective: string;
  rationale: string;
  implementationHints: string[];
  acceptanceChecklist: string[];
  generatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateToolReviewActionLedgerEntryInput {
  reviewId: string;
  sessionId: string;
  input: ToolReviewGovernanceInputShell;
  output: ToolReviewGovernanceOutputShell;
  status: TaToolReviewActionStatus;
  recordedAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createToolReviewGovernanceTrace(
  input: CreateToolReviewGovernanceTraceInput,
): ToolReviewGovernanceTrace {
  return {
    actionId: assertNonEmpty(input.actionId, "Tool review trace actionId"),
    actorId: assertNonEmpty(input.actorId, "Tool review trace actorId"),
    reason: assertNonEmpty(input.reason, "Tool review trace reason"),
    createdAt: assertNonEmpty(input.createdAt, "Tool review trace createdAt"),
    request: input.request,
    sourceDecision: input.sourceDecision,
    metadata: input.metadata,
  };
}

export function resolveLifecycleTargetBindingState(
  action: TaToolReviewLifecycleAction,
): CapabilityBindingState | undefined {
  switch (action) {
    case "register":
    case "replace":
    case "resume":
      return "active";
    case "suspend":
      return "disabled";
    case "unregister":
      return undefined;
  }
}

export function extractToolReviewCapabilityKey(
  input: ToolReviewGovernanceInputShell | ToolReviewGovernanceOutputShell,
): string {
  return input.capabilityKey;
}

export function createToolReviewActionLedgerEntry(
  input: CreateToolReviewActionLedgerEntryInput,
): ToolReviewActionLedgerEntry {
  return {
    reviewId: assertNonEmpty(input.reviewId, "Tool review action reviewId"),
    sessionId: assertNonEmpty(input.sessionId, "Tool review action sessionId"),
    actionId: assertNonEmpty(input.input.trace.actionId, "Tool review action actionId"),
    governanceKind: input.input.kind,
    capabilityKey: extractToolReviewCapabilityKey(input.input),
    status: input.status,
    boundaryMode: "governance_only",
    output: input.output,
    recordedAt: assertNonEmpty(input.recordedAt, "Tool review action recordedAt"),
    updatedAt: assertNonEmpty(input.updatedAt ?? input.recordedAt, "Tool review action updatedAt"),
    metadata: input.metadata,
  };
}

export function summarizeToolReviewAction(
  action: ToolReviewActionLedgerEntry,
): ToolReviewGovernancePlanItem {
  return {
    reviewId: action.reviewId,
    actionId: action.actionId,
    governanceKind: action.governanceKind,
    capabilityKey: action.capabilityKey,
    status: action.status,
    boundaryMode: action.boundaryMode,
    summary: action.output.summary,
    recordedAt: action.recordedAt,
    updatedAt: action.updatedAt,
    requiresHuman: action.status === "waiting_human",
    readyForHandoff: action.status === "ready_for_handoff",
    blocked: action.status === "blocked",
  };
}

export function createToolReviewTmaWorkOrder(input: {
  sessionId: string;
  capabilityKey: string;
  sourceAction: ToolReviewActionLedgerEntry;
  qualityReport: ToolReviewQualityReport;
}): ToolReviewTmaWorkOrder {
  const isBlocked = input.sourceAction.status === "blocked";
  const isActivationLike = input.sourceAction.governanceKind === "activation";
  const requestedLane: TmaExecutionLane = input.sourceAction.output.kind === "provision_request"
    ? input.sourceAction.output.requestedLane
    : isBlocked && isActivationLike
      ? "extended"
      : "bootstrap";

  return {
    workOrderId: `tma-work-order:${input.sourceAction.reviewId}`,
    sessionId: input.sessionId,
    capabilityKey: input.capabilityKey,
    sourceReviewId: input.sourceAction.reviewId,
    sourceActionId: input.sourceAction.actionId,
    sourceGovernanceKind: input.sourceAction.governanceKind,
    requestedLane,
    priority: isBlocked ? "high" : "normal",
    objective: isBlocked
      ? `Repair the capability package for ${input.capabilityKey} so the blocked governance item can move forward.`
      : `Prepare the next build-ready capability package iteration for ${input.capabilityKey}.`,
    rationale: input.qualityReport.summary,
    implementationHints: [
      `Respect the current governance boundary: ${input.sourceAction.boundaryMode}.`,
      `Review the latest tool-review summary: ${input.sourceAction.output.summary}`,
      requestedLane === "extended"
        ? "Extended lane is recommended because the failure likely needs deeper runtime or integration work."
        : "Bootstrap lane is enough for the current build/package iteration unless a later reviewer explicitly widens scope.",
    ],
    acceptanceChecklist: [
      "Produce a ready bundle candidate with tool, binding, verification, and usage artifacts.",
      "Preserve replay and activation guidance for the outer TAP runtime.",
      "Do not execute the blocked user task directly from the TMA lane.",
    ],
    generatedAt: input.qualityReport.generatedAt,
    metadata: {
      verdict: input.qualityReport.verdict,
      sourceStatus: input.sourceAction.status,
    },
  };
}
