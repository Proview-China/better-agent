import type {
  TaToolReviewActionStatus,
  TaToolReviewQualityVerdict,
  ToolReviewProvisionRequestInputShell,
  ToolReviewProvisionRequestOutputShell,
  ToolReviewActivationInputShell,
  ToolReviewActivationOutputShell,
  ToolReviewActionLedgerEntry,
  ToolReviewGovernanceSignal,
  ToolReviewDeliveryInputShell,
  ToolReviewDeliveryOutputShell,
  ToolReviewGovernancePlan,
  ToolReviewGovernancePlanCounts,
  ToolReviewGovernancePlanItem,
  ToolReviewGovernanceInputShell,
  ToolReviewGovernanceOutputShell,
  ToolReviewQualityAdvisory,
  ToolReviewQualityReport,
  ToolReviewTmaWorkOrder,
  ToolReviewReplayInputShell,
  ToolReviewReplayOutputShell,
  ToolReviewHumanGateInputShell,
  ToolReviewHumanGateOutputShell,
  ToolReviewLifecycleInputShell,
  ToolReviewLifecycleOutputShell,
} from "./tool-review-contract.js";
import {
  createToolReviewActionLedgerEntry,
  createToolReviewTmaWorkOrder,
  resolveLifecycleTargetBindingState,
  summarizeToolReviewAction,
} from "./tool-review-contract.js";
import {
  appendToolReviewActionToSession,
  createToolReviewSessionSnapshot,
  createToolReviewSessionState,
  restoreToolReviewSessionSnapshot,
  type ToolReviewSessionSnapshot,
  type ToolReviewSessionState,
} from "./tool-review-session.js";
import type {
  ToolReviewerRuntimeLlmHook,
  ToolReviewerRuntimeLlmHookInput,
} from "./tool-review-model-hook.js";
import type { AgentCoreCmpTapReviewApertureV1 } from "../cmp-api/index.js";

export const TA_TOOL_REVIEW_RUNTIME_STATUSES = [
  "recorded",
  "ready_for_handoff",
  "waiting_human",
  "blocked",
] as const;
export type TaToolReviewRuntimeStatus =
  (typeof TA_TOOL_REVIEW_RUNTIME_STATUSES)[number];

export interface ToolReviewerRuntimeSubmitInput {
  governanceAction: ToolReviewGovernanceInputShell;
  sessionId?: string;
  cmpTapReviewAperture?: AgentCoreCmpTapReviewApertureV1;
}

export interface ToolReviewerRuntimeResult {
  reviewId: string;
  sessionId: string;
  placeholder: false;
  governanceKind: ToolReviewGovernanceInputShell["kind"];
  input: ToolReviewGovernanceInputShell;
  runtimeStatus: TaToolReviewRuntimeStatus;
  output: ToolReviewGovernanceOutputShell;
  recordedAt: string;
  action: ToolReviewActionLedgerEntry;
  metadata?: Record<string, unknown>;
}

export interface ToolReviewerRuntimeOptions {
  recordHook?: (result: ToolReviewerRuntimeResult) => Promise<void> | void;
  sessionIdFactory?: () => string;
  reviewIdFactory?: (actionId: string) => string;
  restoreSnapshot?: ToolReviewSessionSnapshot[];
  llmToolReviewerHook?: ToolReviewerRuntimeLlmHook;
}

function compareActions(
  left: ToolReviewActionLedgerEntry,
  right: ToolReviewActionLedgerEntry,
): number {
  const recordedDelta = left.recordedAt.localeCompare(right.recordedAt);
  if (recordedDelta !== 0) {
    return recordedDelta;
  }
  return left.reviewId.localeCompare(right.reviewId);
}

function createEmptyCounts(): ToolReviewGovernancePlanCounts {
  return {
    total: 0,
    recorded: 0,
    readyForHandoff: 0,
    waitingHuman: 0,
    blocked: 0,
    completed: 0,
  };
}

function incrementCounts(
  counts: ToolReviewGovernancePlanCounts,
  status: TaToolReviewActionStatus,
): void {
  counts.total += 1;
  switch (status) {
    case "recorded":
      counts.recorded += 1;
      return;
    case "ready_for_handoff":
      counts.readyForHandoff += 1;
      return;
    case "waiting_human":
      counts.waitingHuman += 1;
      return;
    case "blocked":
      counts.blocked += 1;
      return;
    case "completed":
      counts.completed += 1;
      return;
  }
}

function resolveRecommendedNextStep(
  counts: ToolReviewGovernancePlanCounts,
): string {
  if (counts.blocked > 0) {
    return "Inspect blocked governance actions first and either fix the capability package or send it back for another build iteration.";
  }
  if (counts.waitingHuman > 0) {
    return "Wait for the human gate decision before continuing the tool governance chain.";
  }
  if (counts.readyForHandoff > 0) {
    return "Continue the next activation, lifecycle, or replay handoff on the runtime mainline.";
  }
  if (counts.completed > 0 && counts.completed === counts.total) {
    return "Session is fully settled; keep the evidence bundle for future audits or resumptions.";
  }
  return "Governance actions are recorded only; keep the session available for later runtime orchestration.";
}

function readCmpTapReviewAperture(
  input: ToolReviewerRuntimeSubmitInput,
): AgentCoreCmpTapReviewApertureV1 | undefined {
  if (input.cmpTapReviewAperture) {
    return input.cmpTapReviewAperture;
  }
  const value = input.governanceAction.metadata?.cmpTapReviewAperture;
  return value && typeof value === "object"
    ? value as AgentCoreCmpTapReviewApertureV1
    : undefined;
}

function augmentGovernanceActionWithCmpAperture(
  input: ToolReviewerRuntimeSubmitInput,
  aperture: AgentCoreCmpTapReviewApertureV1 | undefined,
): ToolReviewGovernanceInputShell {
  if (!aperture) {
    return input.governanceAction;
  }
  return {
    ...input.governanceAction,
    metadata: {
      ...(input.governanceAction.metadata ?? {}),
      cmpTapReviewAperture: aperture,
    },
  };
}

function appendCmpWorksiteSummary(
  summary: string,
  aperture: AgentCoreCmpTapReviewApertureV1 | undefined,
): string {
  if (!aperture) {
    return summary;
  }
  const suffix = [
    aperture.currentObjective ? `CMP objective: ${aperture.currentObjective}.` : undefined,
    aperture.packageRef ? `CMP package: ${aperture.packageRef}.` : undefined,
    aperture.reviewStateSummary ? `CMP review state: ${aperture.reviewStateSummary}.` : undefined,
  ].filter((value): value is string => Boolean(value)).join(" ");
  return suffix.length > 0 ? `${summary} ${suffix}` : summary;
}

function resolveQualityVerdict(
  input: {
    sessionStatus: ToolReviewSessionState["status"];
    latestItem?: ToolReviewGovernancePlanItem;
    counts: ToolReviewGovernancePlanCounts;
  },
): TaToolReviewQualityVerdict {
  if (input.sessionStatus === "blocked") {
    return "blocked";
  }
  if (input.sessionStatus === "waiting_human") {
    return "waiting_human";
  }
  if (input.latestItem?.readyForHandoff || input.counts.readyForHandoff > 0) {
    return "handoff_ready";
  }
  return "recorded_only";
}

function createGovernanceSignals(input: {
  sessionId: string;
  verdict: TaToolReviewQualityVerdict;
  latestItem?: ToolReviewGovernancePlanItem;
  blockingItems: readonly ToolReviewGovernancePlanItem[];
  waitingHumanItems: readonly ToolReviewGovernancePlanItem[];
  readyItems: readonly ToolReviewGovernancePlanItem[];
  reReviewActions: readonly ToolReviewActionLedgerEntry[];
  tmaRepairCandidateActions: readonly ToolReviewActionLedgerEntry[];
}): ToolReviewGovernanceSignal[] {
  const hasHardStop = input.verdict === "blocked" || input.verdict === "waiting_human";
  const hardStopReviewIds = input.verdict === "blocked"
    ? input.blockingItems.map((item) => item.reviewId)
    : input.verdict === "waiting_human"
      ? input.waitingHumanItems.map((item) => item.reviewId)
      : [];
  const handoffReady = input.verdict === "handoff_ready";
  const reReviewReady = handoffReady && input.reReviewActions.length > 0;
  const tmaRepairCandidate = input.verdict === "blocked"
    && input.tmaRepairCandidateActions.length > 0;
  const recordedOnly = input.verdict === "recorded_only";

  return [
    {
      kind: "hard_stop",
      active: hasHardStop,
      summary: input.verdict === "blocked"
        ? "A blocked governance action is the active stop condition for this session."
        : input.verdict === "waiting_human"
          ? "A waiting human gate is the active stop condition for this session."
          : "No active hard stop is currently preventing a manual governance handoff.",
      reviewIds: hasHardStop ? hardStopReviewIds : [],
      hardStop: hasHardStop,
      metadata: {
        reason: hasHardStop ? input.verdict : "none",
        latestReviewId: input.latestItem?.reviewId,
        sessionId: input.sessionId,
      },
    },
    {
      kind: "human_decision_required",
      active: input.verdict === "waiting_human",
      summary: input.verdict === "waiting_human"
        ? "Human approval is still required before the tool governance chain may continue."
        : "No active human-decision gate is blocking this report.",
      reviewIds: input.waitingHumanItems.map((item) => item.reviewId),
      hardStop: input.verdict === "waiting_human",
      metadata: {
        pendingCount: input.waitingHumanItems.length,
      },
    },
    {
      kind: "runtime_handoff_ready",
      active: handoffReady,
      summary: handoffReady
        ? "A governance handoff is ready for the runtime mainline, but it still requires explicit pickup."
        : "No active runtime handoff is ready from this report.",
      reviewIds: handoffReady ? input.readyItems.map((item) => item.reviewId) : [],
      hardStop: false,
      metadata: {
        readyCount: input.readyItems.length,
      },
    },
    {
      kind: "re_review_required",
      active: reReviewReady,
      summary: reReviewReady
        ? "Replay governance requires a manual re-review before any future dispatch can happen."
        : "No active replay re-review follow-up is required.",
      reviewIds: reReviewReady ? input.reReviewActions.map((action) => action.reviewId) : [],
      hardStop: false,
      metadata: {
        replayReviewIds: input.reReviewActions.map((action) => action.reviewId),
      },
    },
    {
      kind: "tma_repair_candidate",
      active: tmaRepairCandidate,
      summary: tmaRepairCandidate
        ? "A blocked activation or lifecycle action points to a manual TMA/package repair follow-up."
        : "No active blocked package-repair follow-up is being requested by this report.",
      reviewIds: tmaRepairCandidate
        ? input.tmaRepairCandidateActions.map((action) => action.reviewId)
        : [],
      hardStop: false,
      metadata: {
        candidateKinds: input.tmaRepairCandidateActions.map((action) => action.governanceKind),
      },
    },
    {
      kind: "recorded_only",
      active: recordedOnly,
      summary: recordedOnly
        ? "Only governance evidence is recorded so far; no handoff or stop signal is active."
        : "This report contains an actionable or blocking state beyond recorded-only evidence.",
      reviewIds: recordedOnly && input.latestItem ? [input.latestItem.reviewId] : [],
      hardStop: false,
      metadata: {
        latestReviewId: input.latestItem?.reviewId,
      },
    },
    {
      kind: "governance_only_boundary",
      active: true,
      summary: "Tool reviewer may advise, record, and hand off governance state, but must not execute the blocked user task or override runtime controls.",
      reviewIds: input.latestItem ? [input.latestItem.reviewId] : [],
      hardStop: false,
      metadata: {
        boundaryMode: "governance_only",
        autoExecutionForbidden: true,
      },
    },
  ];
}

function createQualityAdvisories(input: {
  verdict: TaToolReviewQualityVerdict;
  blockingItems: readonly ToolReviewGovernancePlanItem[];
  waitingHumanItems: readonly ToolReviewGovernancePlanItem[];
  readyItems: readonly ToolReviewGovernancePlanItem[];
  reReviewActions: readonly ToolReviewActionLedgerEntry[];
  tmaRepairCandidateActions: readonly ToolReviewActionLedgerEntry[];
}): ToolReviewQualityAdvisory[] {
  const advisories: ToolReviewQualityAdvisory[] = [];
  const latestBlockingItem = input.blockingItems.at(-1);
  const latestWaitingHumanItem = input.waitingHumanItems.at(-1);
  const latestReadyItem = input.readyItems.at(-1);
  const nonReplayReadyItems = input.readyItems.filter((item) => {
    return !input.reReviewActions.some((action) => action.reviewId === item.reviewId);
  });

  if (input.verdict === "blocked") {
    advisories.push({
      code: "manual_blocked_resolution",
      severity: "critical",
      actor: latestBlockingItem?.governanceKind === "human_gate"
        ? "human_reviewer"
        : latestBlockingItem?.governanceKind === "activation"
          || latestBlockingItem?.governanceKind === "lifecycle"
          ? "tma"
          : "tool_reviewer",
      summary: "The latest governance state is blocked and needs a manual resolution path before anything else moves.",
      detail: latestBlockingItem
        ? `Review ${latestBlockingItem.reviewId} is blocked: ${latestBlockingItem.summary} Keep the tool reviewer in governance-only mode and do not auto-run the user task while resolving it.`
        : "A blocked governance item exists, but the latest blocking summary is unavailable. Keep the tool reviewer in governance-only mode and resolve the block manually.",
      reviewIds: latestBlockingItem ? [latestBlockingItem.reviewId] : [],
      hardStop: true,
      requiresManualAction: true,
      autoExecutionForbidden: true,
    });
  }

  if (input.tmaRepairCandidateActions.length > 0) {
    advisories.push({
      code: "manual_tma_follow_up",
      severity: "critical",
      actor: "tma",
      summary: "A blocked activation or lifecycle item should be handed to TMA as a package-repair follow-up, not auto-fixed in place.",
      detail: `Blocked review ids: ${input.tmaRepairCandidateActions.map((action) => action.reviewId).join(", ")}. Prepare a repair-oriented work order if needed, but do not let tool reviewer apply the fix or execute the blocked task directly.`,
      reviewIds: input.tmaRepairCandidateActions.map((action) => action.reviewId),
      hardStop: true,
      requiresManualAction: true,
      autoExecutionForbidden: true,
    });
  }

  if (input.verdict === "waiting_human") {
    advisories.push({
      code: "manual_human_gate_follow_up",
      severity: "critical",
      actor: "human_reviewer",
      summary: "Human approval is the active gate; tool reviewer should surface the request clearly and then stop.",
      detail: latestWaitingHumanItem
        ? `Waiting review ${latestWaitingHumanItem.reviewId} needs a human decision. Tool reviewer may package the context and risks, but must not approve, reject, or continue execution on the human's behalf.`
        : "A human decision is required before governance can continue. Tool reviewer may summarize context, but must not bypass the gate.",
      reviewIds: input.waitingHumanItems.map((item) => item.reviewId),
      hardStop: true,
      requiresManualAction: true,
      autoExecutionForbidden: true,
    });
  }

  if (input.reReviewActions.length > 0 && input.verdict === "handoff_ready") {
    advisories.push({
      code: "manual_re_review",
      severity: "warning",
      actor: "tool_reviewer",
      summary: "Replay is ready for a manual re-review pass before any later dispatch decision.",
      detail: `Replay-linked review ids: ${input.reReviewActions.map((action) => action.reviewId).join(", ")}. Tool reviewer should reopen review context and confirm the governance posture, but must not auto-dispatch the blocked intent.`,
      reviewIds: input.reReviewActions.map((action) => action.reviewId),
      hardStop: false,
      requiresManualAction: true,
      autoExecutionForbidden: true,
    });
  }

  if (nonReplayReadyItems.length > 0 && input.verdict === "handoff_ready") {
    advisories.push({
      code: "manual_runtime_handoff",
      severity: "info",
      actor: "runtime_mainline",
      summary: "A governance result is ready to hand back into the runtime mainline for explicit pickup.",
      detail: `Ready review ids: ${nonReplayReadyItems.map((item) => item.reviewId).join(", ")}. Tool reviewer may emit the handoff package proactively, but the runtime mainline still has to decide whether to pick it up.`,
      reviewIds: nonReplayReadyItems.map((item) => item.reviewId),
      hardStop: false,
      requiresManualAction: true,
      autoExecutionForbidden: true,
    });
  }

  if (input.verdict === "recorded_only") {
    advisories.push({
      code: "record_evidence_only",
      severity: "info",
      actor: "tool_reviewer",
      summary: "Only evidence is recorded right now; keep the session observable without inventing extra action.",
      detail: latestReadyItem
        ? `Latest review ${latestReadyItem.reviewId} is still recorded as non-actionable evidence. Preserve the governance trail and wait for a later runtime/mainline decision instead of auto-progressing it.`
        : "No actionable handoff is ready yet. Preserve the governance trail and wait for a later runtime/mainline decision instead of auto-progressing it.",
      reviewIds: latestReadyItem ? [latestReadyItem.reviewId] : [],
      hardStop: false,
      requiresManualAction: false,
      autoExecutionForbidden: true,
    });
  }

  return advisories;
}

function createActivationOutput(
  input: ToolReviewActivationInputShell,
): ToolReviewActivationOutputShell {
  const failure = input.latestFailure
    ?? (input.currentAttempt?.status === "failed" ? input.currentAttempt.failure : undefined);

  if (failure) {
    return {
      kind: "activation",
      actionId: input.trace.actionId,
      status: "activation_failed",
      capabilityKey: input.capabilityKey,
      provisionId: input.provisionId,
      targetPool: input.activationSpec.targetPool,
      attemptId: input.currentAttempt?.attemptId ?? failure.attemptId,
      failure,
      summary: `Activation handoff for ${input.capabilityKey} is blocked by ${failure.code}.`,
      metadata: input.metadata,
    };
  }

  return {
    kind: "activation",
    actionId: input.trace.actionId,
    status: "ready_for_activation_handoff",
    capabilityKey: input.capabilityKey,
    provisionId: input.provisionId,
    targetPool: input.activationSpec.targetPool,
    attemptId: input.currentAttempt?.attemptId,
    receipt: input.latestReceipt,
    summary: `Activation handoff is staged for ${input.capabilityKey} into ${input.activationSpec.targetPool}.`,
    metadata: input.metadata,
  };
}

function createProvisionRequestOutput(
  input: ToolReviewProvisionRequestInputShell,
): ToolReviewProvisionRequestOutputShell {
  return {
    kind: "provision_request",
    actionId: input.trace.actionId,
    status: "ready_for_tma_handoff",
    capabilityKey: input.capabilityKey,
    provisionId: input.provisionId,
    requestedLane: input.requestedLane,
    requestedTier: input.requestedTier,
    summary: `Provision request for ${input.capabilityKey} is staged for TMA lane ${input.requestedLane}.`,
    metadata: input.metadata,
  };
}

function createDeliveryOutput(
  input: ToolReviewDeliveryInputShell,
): ToolReviewDeliveryOutputShell {
  return {
    kind: "delivery",
    actionId: input.trace.actionId,
    status: "ready_for_delivery_handoff",
    capabilityKey: input.capabilityKey,
    provisionId: input.provisionId,
    lane: input.receipt.lane,
    reportId: input.receipt.reportId,
    summary: `Ready bundle delivery is staged for ${input.capabilityKey} from TMA lane ${input.receipt.lane}.`,
    metadata: input.metadata,
  };
}

function createLifecycleOutput(
  input: ToolReviewLifecycleInputShell,
): ToolReviewLifecycleOutputShell {
  if (input.failure) {
    return {
      kind: "lifecycle",
      actionId: input.trace.actionId,
      status: "lifecycle_blocked",
      capabilityKey: input.capabilityKey,
      lifecycleAction: input.lifecycleAction,
      targetPool: input.targetPool,
      bindingId: input.binding?.bindingId,
      targetBindingState: resolveLifecycleTargetBindingState(input.lifecycleAction),
      failure: input.failure,
      summary: `Lifecycle ${input.lifecycleAction} is blocked for ${input.capabilityKey} because ${input.failure.code}.`,
      metadata: input.metadata,
    };
  }

  return {
    kind: "lifecycle",
    actionId: input.trace.actionId,
    status: "ready_for_lifecycle_handoff",
    capabilityKey: input.capabilityKey,
    lifecycleAction: input.lifecycleAction,
    targetPool: input.targetPool,
    bindingId: input.binding?.bindingId,
    targetBindingState: resolveLifecycleTargetBindingState(input.lifecycleAction),
    summary: `Lifecycle ${input.lifecycleAction} is staged for ${input.capabilityKey} in ${input.targetPool}.`,
    metadata: input.metadata,
  };
}

function createHumanGateOutput(
  input: ToolReviewHumanGateInputShell,
): ToolReviewHumanGateOutputShell {
  const status = input.gate.status;
  return {
    kind: "human_gate",
    actionId: input.trace.actionId,
    status,
    capabilityKey: input.capabilityKey,
    gateId: input.gate.gateId,
    gateStatus: status,
    latestEventType: input.latestEvent?.type,
    summary: status === "waiting_human"
      ? `Human gate ${input.gate.gateId} is waiting for approval before ${input.capabilityKey} continues.`
      : status === "approved"
        ? `Human gate ${input.gate.gateId} approved ${input.capabilityKey}.`
        : `Human gate ${input.gate.gateId} rejected ${input.capabilityKey}.`,
    metadata: input.metadata,
  };
}

function createReplayOutput(
  input: ToolReviewReplayInputShell,
): ToolReviewReplayOutputShell {
  const status = input.replay.status === "skipped"
    ? "replay_skipped"
    : input.replay.nextAction === "re_review_then_dispatch"
      ? "ready_for_re_review"
      : "pending_replay";

  return {
    kind: "replay",
    actionId: input.trace.actionId,
    status,
    capabilityKey: input.capabilityKey,
    replayId: input.replay.replayId,
    nextAction: input.replay.nextAction,
    summary: status === "replay_skipped"
      ? `Replay ${input.replay.replayId} is intentionally skipped for ${input.capabilityKey}.`
      : status === "ready_for_re_review"
        ? `Replay ${input.replay.replayId} is staged for re-review before dispatch.`
        : `Replay ${input.replay.replayId} remains pending for ${input.capabilityKey}.`,
    metadata: input.metadata,
  };
}

function toRuntimeStatus(
  output: ToolReviewGovernanceOutputShell,
): TaToolReviewRuntimeStatus {
  switch (output.kind) {
    case "provision_request":
      return "ready_for_handoff";
    case "activation":
      return output.status === "activation_failed" ? "blocked" : "ready_for_handoff";
    case "delivery":
      return "ready_for_handoff";
    case "lifecycle":
      return output.status === "lifecycle_blocked" ? "blocked" : "ready_for_handoff";
    case "human_gate":
      return output.status === "waiting_human"
        ? "waiting_human"
        : output.status === "approved"
          ? "recorded"
          : "blocked";
    case "replay":
      return output.status === "ready_for_re_review"
        ? "ready_for_handoff"
        : "recorded";
  }
}

function toActionStatus(
  runtimeStatus: TaToolReviewRuntimeStatus,
): TaToolReviewActionStatus {
  switch (runtimeStatus) {
    case "ready_for_handoff":
      return "ready_for_handoff";
    case "waiting_human":
      return "waiting_human";
    case "blocked":
      return "blocked";
    case "recorded":
      return "recorded";
  }
}

export class ToolReviewerRuntime {
  readonly #recordHook?: ToolReviewerRuntimeOptions["recordHook"];
  readonly #sessionIdFactory: () => string;
  readonly #reviewIdFactory: (actionId: string) => string;
  readonly #llmToolReviewerHook?: ToolReviewerRuntimeLlmHook;
  readonly #sessions = new Map<string, ToolReviewSessionState>();
  readonly #actions = new Map<string, ToolReviewActionLedgerEntry>();

  constructor(options: ToolReviewerRuntimeOptions = {}) {
    this.#recordHook = options.recordHook;
    this.#sessionIdFactory = options.sessionIdFactory ?? (() => "tool-review-session:1");
    this.#reviewIdFactory = options.reviewIdFactory ?? ((actionId) => `tool-review:${actionId}`);
    this.#llmToolReviewerHook = options.llmToolReviewerHook;

    for (const snapshot of options.restoreSnapshot ?? []) {
      const restored = restoreToolReviewSessionSnapshot(snapshot);
      this.#sessions.set(restored.session.sessionId, restored.session);
      for (const action of restored.actions) {
        this.#actions.set(action.reviewId, action);
      }
    }
  }

  async submit(
    input: ToolReviewerRuntimeSubmitInput,
  ): Promise<ToolReviewerRuntimeResult> {
    const cmpTapReviewAperture = readCmpTapReviewAperture(input);
    const governanceAction = augmentGovernanceActionWithCmpAperture(input, cmpTapReviewAperture);
    const sessionId = input.sessionId
      ?? governanceAction.trace.request?.sessionId
      ?? this.#sessionIdFactory();
    const existingSession = this.#sessions.get(sessionId);
    const session = existingSession ?? createToolReviewSessionState({
      sessionId,
      createdAt: governanceAction.trace.createdAt,
      metadata: {
        actorId: governanceAction.trace.actorId,
      },
    });
    let output = this.createOutputShell(governanceAction);
    output = {
      ...output,
      summary: appendCmpWorksiteSummary(output.summary, cmpTapReviewAperture),
      metadata: {
        ...(output.metadata ?? {}),
        ...(cmpTapReviewAperture
          ? {
            cmpTapReviewAperture,
          }
          : {}),
      },
    };
    if (this.#llmToolReviewerHook) {
      const advice = await this.#llmToolReviewerHook({
        sessionId,
        governanceAction,
        defaultOutput: output,
      } satisfies ToolReviewerRuntimeLlmHookInput);
      if (advice) {
        output = {
          ...output,
          summary: advice.summary,
          metadata: {
            ...(output.metadata ?? {}),
            ...(advice.metadata ? { toolReviewerModelMetadata: advice.metadata } : {}),
            modelBacked: true,
          },
        };
      }
    }
    const runtimeStatus = toRuntimeStatus(output);
    const action = createToolReviewActionLedgerEntry({
      reviewId: this.#reviewIdFactory(governanceAction.trace.actionId),
      sessionId,
      input: governanceAction,
      output,
      status: toActionStatus(runtimeStatus),
      recordedAt: governanceAction.trace.createdAt,
      metadata: {
        actorId: governanceAction.trace.actorId,
        sourceDecisionId: governanceAction.trace.sourceDecision?.decisionId,
      },
    });
    this.#actions.set(action.reviewId, action);
    this.#sessions.set(sessionId, appendToolReviewActionToSession(session, action));
    const result: ToolReviewerRuntimeResult = {
      reviewId: action.reviewId,
      sessionId,
      placeholder: false,
      governanceKind: governanceAction.kind,
      input: governanceAction,
      runtimeStatus,
      output,
      recordedAt: governanceAction.trace.createdAt,
      action,
      metadata: {
        actorId: governanceAction.trace.actorId,
        sourceDecisionId: governanceAction.trace.sourceDecision?.decisionId,
        boundaryMode: action.boundaryMode,
      },
    };

    await this.#recordHook?.(result);
    return result;
  }

  createOutputShell(
    input: ToolReviewGovernanceInputShell,
  ): ToolReviewGovernanceOutputShell {
    switch (input.kind) {
      case "provision_request":
        return createProvisionRequestOutput(input);
      case "activation":
        return createActivationOutput(input);
      case "delivery":
        return createDeliveryOutput(input);
      case "lifecycle":
        return createLifecycleOutput(input);
      case "human_gate":
        return createHumanGateOutput(input);
      case "replay":
        return createReplayOutput(input);
    }
  }

  getSession(sessionId: string): ToolReviewSessionState | undefined {
    return this.#sessions.get(sessionId);
  }

  listSessions(): readonly ToolReviewSessionState[] {
    return [...this.#sessions.values()];
  }

  getAction(reviewId: string): ToolReviewActionLedgerEntry | undefined {
    return this.#actions.get(reviewId);
  }

  listActions(sessionId?: string): readonly ToolReviewActionLedgerEntry[] {
    const actions = [...this.#actions.values()];
    return sessionId
      ? actions.filter((action) => action.sessionId === sessionId)
      : actions;
  }

  createGovernancePlan(sessionId: string): ToolReviewGovernancePlan | undefined {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const items: ToolReviewGovernancePlanItem[] = [...this.listActions(sessionId)]
      .slice()
      .sort(compareActions)
      .map(summarizeToolReviewAction);
    const counts = createEmptyCounts();
    for (const item of items) {
      incrementCounts(counts, item.status);
    }
    const latestItem = items.at(-1);

    return {
      sessionId,
      status: session.status,
      capabilityKeys: [...new Set(items.map((item) => item.capabilityKey))],
      latestActionId: latestItem?.actionId ?? session.latestActionId,
      latestReviewId: latestItem?.reviewId,
      counts,
      items,
      recommendedNextStep: resolveRecommendedNextStep(counts),
      generatedAt: session.updatedAt,
    };
  }

  listGovernancePlans(): readonly ToolReviewGovernancePlan[] {
    return this.listSessions()
      .map((session) => this.createGovernancePlan(session.sessionId))
      .filter((plan): plan is ToolReviewGovernancePlan => plan !== undefined);
  }

  createQualityReport(sessionId: string): ToolReviewQualityReport | undefined {
    const plan = this.createGovernancePlan(sessionId);
    if (!plan) {
      return undefined;
    }

    const actions = [...this.listActions(sessionId)]
      .slice()
      .sort(compareActions);
    const latestItem = plan.items.at(-1);
    const verdict = resolveQualityVerdict({
      sessionStatus: plan.status,
      latestItem,
      counts: plan.counts,
    });
    const blockingItems = plan.items.filter((item) => item.blocked);
    const waitingHumanItems = plan.items.filter((item) => item.requiresHuman);
    const readyItems = plan.items.filter((item) => item.readyForHandoff);

    let summary = "Tool governance has only recorded evidence so far.";
    if (verdict === "blocked") {
      summary = `Tool governance is blocked by ${blockingItems.length} action(s); latest block is ${blockingItems.at(-1)?.summary ?? "unknown"}.`;
    } else if (verdict === "waiting_human") {
      summary = `Tool governance is waiting for ${waitingHumanItems.length} human decision(s) before the chain can continue.`;
    } else if (verdict === "handoff_ready") {
      summary = `Tool governance has ${readyItems.length} action(s) ready to hand back into the runtime mainline.`;
    }

    const reReviewActions = actions.filter((action) => {
      return action.status === "ready_for_handoff"
        && action.output.kind === "replay"
        && action.output.status === "ready_for_re_review";
    });
    const tmaRepairCandidateActions = actions.filter((action) => {
      return action.status === "blocked"
        && (action.governanceKind === "activation" || action.governanceKind === "lifecycle");
    });
    const governanceSignals = createGovernanceSignals({
      sessionId,
      verdict,
      latestItem,
      blockingItems,
      waitingHumanItems,
      readyItems,
      reReviewActions,
      tmaRepairCandidateActions,
    });
    const advisories = createQualityAdvisories({
      verdict,
      blockingItems,
      waitingHumanItems,
      readyItems,
      reReviewActions,
      tmaRepairCandidateActions,
    });

    return {
      sessionId,
      verdict,
      summary,
      recommendedNextStep: plan.recommendedNextStep,
      generatedAt: plan.generatedAt,
      counts: plan.counts,
      latestActionId: plan.latestActionId,
      latestReviewId: latestItem?.reviewId,
      blockingReviewIds: blockingItems.map((item) => item.reviewId),
      waitingHumanReviewIds: waitingHumanItems.map((item) => item.reviewId),
      readyForHandoffReviewIds: readyItems.map((item) => item.reviewId),
      advisories,
      governanceSignals,
    };
  }

  listQualityReports(): readonly ToolReviewQualityReport[] {
    return this.listSessions()
      .map((session) => this.createQualityReport(session.sessionId))
      .filter((report): report is ToolReviewQualityReport => report !== undefined);
  }

  createTmaWorkOrder(sessionId: string): ToolReviewTmaWorkOrder | undefined {
    const plan = this.createGovernancePlan(sessionId);
    const qualityReport = this.createQualityReport(sessionId);
    if (!plan || !qualityReport) {
      return undefined;
    }

    const sourceItem = [...plan.items]
      .reverse()
      .find((item) => item.blocked || item.readyForHandoff);
    if (!sourceItem) {
      return undefined;
    }

    const sourceAction = this.getAction(sourceItem.reviewId);
    if (!sourceAction) {
      return undefined;
    }

    return createToolReviewTmaWorkOrder({
      sessionId,
      capabilityKey: sourceItem.capabilityKey,
      sourceAction,
      qualityReport,
    });
  }

  listTmaWorkOrders(): readonly ToolReviewTmaWorkOrder[] {
    return this.listSessions()
      .map((session) => this.createTmaWorkOrder(session.sessionId))
      .filter((workOrder): workOrder is ToolReviewTmaWorkOrder => workOrder !== undefined);
  }

  createSnapshots(): ToolReviewSessionSnapshot[] {
    return [...this.#sessions.values()].map((session) =>
      createToolReviewSessionSnapshot(
        session,
        this.listActions(session.sessionId),
      ));
  }

  hydrateSnapshots(snapshots: readonly ToolReviewSessionSnapshot[]): void {
    this.#sessions.clear();
    this.#actions.clear();
    for (const snapshot of snapshots) {
      const restored = restoreToolReviewSessionSnapshot(snapshot);
      this.#sessions.set(restored.session.sessionId, restored.session);
      for (const action of restored.actions) {
        this.#actions.set(action.reviewId, action);
      }
    }
  }
}

export function createToolReviewerRuntime(
  options: ToolReviewerRuntimeOptions = {},
): ToolReviewerRuntime {
  return new ToolReviewerRuntime(options);
}
