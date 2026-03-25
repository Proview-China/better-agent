import type {
  CapabilityBinding,
  CapabilityBindingState,
  CapabilityManifest,
} from "../capability-types/index.js";
import type {
  PoolActivationSpec,
  ReviewDecision,
  AccessRequest,
} from "../ta-pool-types/index.js";
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
  "activation",
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
  "ready_for_activation_handoff",
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
  | ToolReviewActivationInputShell
  | ToolReviewLifecycleInputShell
  | ToolReviewHumanGateInputShell
  | ToolReviewReplayInputShell;

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
  | ToolReviewActivationOutputShell
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
