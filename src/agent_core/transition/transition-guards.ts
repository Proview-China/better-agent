import type { KernelEvent } from "../types/kernel-events.js";
import type { GoalFrameCompiled } from "../types/kernel-goal.js";
import {
  CMP_INTENT_ACTIONS,
  INTENT_PRIORITIES,
  type CapabilityCallIntent,
  type CapabilityPortRequest,
  type CmpActionInputByAction,
  type CmpActionIntent,
  type CmpActionRequest,
  type CmpIntentAction,
  type InternalStepIntent,
  type IntentPriority,
  type ModelInferenceIntent
} from "../types/kernel-intents.js";
import type { StateRecord, StateValue, AgentState } from "../types/kernel-state.js";
import type { StepTransitionAction, StepActionKind } from "../types/kernel-transition.js";
import {
  createCommitContextDeltaInput,
  createDispatchContextPackageInput,
  createIngestRuntimeContextInput,
  createMaterializeContextPackageInput,
  createRequestHistoricalContextInput,
  createResolveCheckedSnapshotInput,
} from "../cmp-types/cmp-interface.js";

export const NEXT_CAPABILITY_KEY = "nextCapabilityKey";
export const NEXT_CAPABILITY_INPUT = "nextCapabilityInput";
export const NEXT_CMP_ACTION = "nextCmpAction";
export const NEXT_CMP_INPUT = "nextCmpInput";
export const NEXT_INTERNAL_INSTRUCTION = "nextInternalInstruction";
export const NEXT_INTENT_PRIORITY = "nextIntentPriority";
export const MODEL_STATE_SUMMARY = "modelStateSummary";

export function isTerminalStatus(status: AgentState["control"]["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isHotPath(kind: StepActionKind): boolean {
  return (
    kind === "internal_step" ||
    kind === "model_inference" ||
    kind === "capability_call" ||
    kind === "cmp_action" ||
    kind === "wait"
  );
}

export function isRarePath(kind: StepActionKind): boolean {
  return kind === "pause" || kind === "complete" || kind === "fail" || kind === "cancel";
}

function getStateValue(record: StateRecord, key: string): StateValue | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function asString(value: StateValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: StateValue | undefined): Record<string, unknown> | undefined {
  if (value === null || value === undefined || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function resolvePriority(state: AgentState): IntentPriority {
  const candidate = asString(getStateValue(state.working, NEXT_INTENT_PRIORITY));
  if (candidate && INTENT_PRIORITIES.includes(candidate as IntentPriority)) {
    return candidate as IntentPriority;
  }
  return "normal";
}

export function buildModelInferenceIntent(params: {
  state: AgentState;
  event: KernelEvent;
  goalFrame: GoalFrameCompiled;
}): ModelInferenceIntent {
  const { state, event, goalFrame } = params;
  return {
    intentId: `${event.eventId}:model`,
    sessionId: event.sessionId,
    runId: event.runId,
    kind: "model_inference",
    createdAt: event.createdAt,
    priority: resolvePriority(state),
    correlationId: event.correlationId ?? event.eventId,
    idempotencyKey: `model:${goalFrame.cacheKey}:${event.eventId}`,
    frame: goalFrame,
    stateSummary:
      asRecord(getStateValue(state.derived ?? {}, MODEL_STATE_SUMMARY))
      ?? asRecord(getStateValue(state.working, MODEL_STATE_SUMMARY))
  };
}

export function buildInternalStepIntent(params: {
  state: AgentState;
  event: KernelEvent;
  instruction: string;
}): InternalStepIntent {
  const { state, event, instruction } = params;
  return {
    intentId: `${event.eventId}:internal`,
    sessionId: event.sessionId,
    runId: event.runId,
    kind: "internal_step",
    createdAt: event.createdAt,
    priority: resolvePriority(state),
    correlationId: event.correlationId ?? event.eventId,
    instruction
  };
}

export function buildCapabilityCallIntent(params: {
  state: AgentState;
  event: KernelEvent;
  capabilityKey: string;
  input: Record<string, unknown>;
}): CapabilityCallIntent {
  const { state, event, capabilityKey, input } = params;
  const intentId = `${event.eventId}:capability`;
  const request: CapabilityPortRequest = {
    requestId: `${event.eventId}:request`,
    intentId,
    sessionId: event.sessionId,
    runId: event.runId,
    capabilityKey,
    input,
    priority: resolvePriority(state),
    idempotencyKey: `${capabilityKey}:${event.eventId}`
  };

  return {
    intentId,
    sessionId: event.sessionId,
    runId: event.runId,
    kind: "capability_call",
    createdAt: event.createdAt,
    priority: request.priority,
    correlationId: event.correlationId ?? event.eventId,
    idempotencyKey: request.idempotencyKey,
    request
  };
}

function asCmpIntentAction(value: StateValue | undefined): CmpIntentAction | undefined {
  return typeof value === "string" && CMP_INTENT_ACTIONS.includes(value as CmpIntentAction)
    ? (value as CmpIntentAction)
    : undefined;
}

function normalizeCmpActionInput<TAction extends CmpIntentAction>(params: {
  action: TAction;
  input: Record<string, unknown>;
}): CmpActionInputByAction[TAction] {
  const { action, input } = params;

  switch (action) {
    case "ingest_runtime_context":
      return createIngestRuntimeContextInput(
        input as unknown as CmpActionInputByAction["ingest_runtime_context"],
      ) as CmpActionInputByAction[TAction];
    case "commit_context_delta":
      return createCommitContextDeltaInput(
        input as unknown as CmpActionInputByAction["commit_context_delta"],
      ) as CmpActionInputByAction[TAction];
    case "resolve_checked_snapshot":
      return createResolveCheckedSnapshotInput(
        input as unknown as CmpActionInputByAction["resolve_checked_snapshot"],
      ) as CmpActionInputByAction[TAction];
    case "materialize_context_package":
      return createMaterializeContextPackageInput(
        input as unknown as CmpActionInputByAction["materialize_context_package"],
      ) as CmpActionInputByAction[TAction];
    case "dispatch_context_package":
      return createDispatchContextPackageInput(
        input as unknown as CmpActionInputByAction["dispatch_context_package"],
      ) as CmpActionInputByAction[TAction];
    case "request_historical_context":
      return createRequestHistoricalContextInput(
        input as unknown as CmpActionInputByAction["request_historical_context"],
      ) as CmpActionInputByAction[TAction];
  }
}

export function buildCmpActionIntent<TAction extends CmpIntentAction>(params: {
  state: AgentState;
  event: KernelEvent;
  action: TAction;
  input: Record<string, unknown>;
}): CmpActionIntent<TAction> {
  const { state, event, action, input } = params;
  const intentId = `${event.eventId}:cmp`;
  const normalizedInput = normalizeCmpActionInput({
    action,
    input,
  });
  const request: CmpActionRequest<TAction> = {
    requestId: `${event.eventId}:cmp-request`,
    intentId,
    sessionId: event.sessionId,
    runId: event.runId,
    action,
    input: normalizedInput,
    priority: resolvePriority(state),
    idempotencyKey: `cmp:${action}:${event.eventId}`,
  };

  return {
    intentId,
    sessionId: event.sessionId,
    runId: event.runId,
    kind: "cmp_action",
    createdAt: event.createdAt,
    priority: request.priority,
    correlationId: event.correlationId ?? event.eventId,
    idempotencyKey: request.idempotencyKey,
    request,
  };
}

export function resolveNextAction(params: {
  state: AgentState;
  event: KernelEvent;
  goalFrame: GoalFrameCompiled;
}): StepTransitionAction {
  const { state, event, goalFrame } = params;

  const cmpAction = asCmpIntentAction(getStateValue(state.working, NEXT_CMP_ACTION));
  const cmpInput = asRecord(getStateValue(state.working, NEXT_CMP_INPUT));
  if (cmpAction || cmpInput) {
    if (!cmpAction || !cmpInput) {
      throw new Error("CMP next action requires both nextCmpAction and nextCmpInput.");
    }
    return {
      kind: "cmp_action",
      intent: buildCmpActionIntent({
        state,
        event,
        action: cmpAction,
        input: cmpInput,
      }),
      metadata: {
        path: "state-driven-cmp",
        cmpAction,
      }
    };
  }

  const capabilityKey = asString(getStateValue(state.working, NEXT_CAPABILITY_KEY));
  const capabilityInput = asRecord(getStateValue(state.working, NEXT_CAPABILITY_INPUT));
  if (capabilityKey && capabilityInput) {
    return {
      kind: "capability_call",
      intent: buildCapabilityCallIntent({
        state,
        event,
        capabilityKey,
        input: capabilityInput
      }),
      metadata: {
        path: "state-driven-capability"
      }
    };
  }

  const internalInstruction = asString(getStateValue(state.working, NEXT_INTERNAL_INSTRUCTION));
  if (internalInstruction) {
    return {
      kind: "internal_step",
      intent: buildInternalStepIntent({
        state,
        event,
        instruction: internalInstruction
      }),
      metadata: {
        path: "state-driven-internal"
      }
    };
  }

  return {
    kind: "model_inference",
    intent: buildModelInferenceIntent({
      state,
      event,
      goalFrame
    }),
    metadata: {
      path: "default-model-inference"
    }
  };
}
