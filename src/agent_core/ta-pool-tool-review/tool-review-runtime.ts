import type {
  TaToolReviewActionStatus,
  ToolReviewActivationInputShell,
  ToolReviewActivationOutputShell,
  ToolReviewActionLedgerEntry,
  ToolReviewGovernanceInputShell,
  ToolReviewGovernanceOutputShell,
  ToolReviewReplayInputShell,
  ToolReviewReplayOutputShell,
  ToolReviewHumanGateInputShell,
  ToolReviewHumanGateOutputShell,
  ToolReviewLifecycleInputShell,
  ToolReviewLifecycleOutputShell,
} from "./tool-review-contract.js";
import {
  createToolReviewActionLedgerEntry,
  resolveLifecycleTargetBindingState,
} from "./tool-review-contract.js";
import {
  appendToolReviewActionToSession,
  createToolReviewSessionSnapshot,
  createToolReviewSessionState,
  restoreToolReviewSessionSnapshot,
  type ToolReviewSessionSnapshot,
  type ToolReviewSessionState,
} from "./tool-review-session.js";

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
}

export interface ToolReviewerRuntimeResult {
  reviewId: string;
  sessionId: string;
  placeholder: false;
  governanceKind: ToolReviewGovernanceInputShell["kind"];
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

function createLifecycleOutput(
  input: ToolReviewLifecycleInputShell,
): ToolReviewLifecycleOutputShell {
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
    case "activation":
      return output.status === "activation_failed" ? "blocked" : "ready_for_handoff";
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
  readonly #sessions = new Map<string, ToolReviewSessionState>();
  readonly #actions = new Map<string, ToolReviewActionLedgerEntry>();

  constructor(options: ToolReviewerRuntimeOptions = {}) {
    this.#recordHook = options.recordHook;
    this.#sessionIdFactory = options.sessionIdFactory ?? (() => "tool-review-session:1");
    this.#reviewIdFactory = options.reviewIdFactory ?? ((actionId) => `tool-review:${actionId}`);

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
    const sessionId = input.sessionId
      ?? input.governanceAction.trace.request?.sessionId
      ?? this.#sessionIdFactory();
    const existingSession = this.#sessions.get(sessionId);
    const session = existingSession ?? createToolReviewSessionState({
      sessionId,
      createdAt: input.governanceAction.trace.createdAt,
      metadata: {
        actorId: input.governanceAction.trace.actorId,
      },
    });
    const output = this.createOutputShell(input.governanceAction);
    const runtimeStatus = toRuntimeStatus(output);
    const action = createToolReviewActionLedgerEntry({
      reviewId: this.#reviewIdFactory(input.governanceAction.trace.actionId),
      sessionId,
      input: input.governanceAction,
      output,
      status: toActionStatus(runtimeStatus),
      recordedAt: input.governanceAction.trace.createdAt,
      metadata: {
        actorId: input.governanceAction.trace.actorId,
        sourceDecisionId: input.governanceAction.trace.sourceDecision?.decisionId,
      },
    });
    this.#actions.set(action.reviewId, action);
    this.#sessions.set(sessionId, appendToolReviewActionToSession(session, action));
    const result: ToolReviewerRuntimeResult = {
      reviewId: action.reviewId,
      sessionId,
      placeholder: false,
      governanceKind: input.governanceAction.kind,
      runtimeStatus,
      output,
      recordedAt: input.governanceAction.trace.createdAt,
      action,
      metadata: {
        actorId: input.governanceAction.trace.actorId,
        sourceDecisionId: input.governanceAction.trace.sourceDecision?.decisionId,
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
      case "activation":
        return createActivationOutput(input);
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
