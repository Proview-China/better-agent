import type { GoalFrameCompiled } from "./kernel-goal.js";
import type { RunId, SessionId } from "./kernel-session.js";
import type {
  CommitContextDeltaInput,
  DispatchContextPackageInput,
  IngestRuntimeContextInput,
  MaterializeContextPackageInput,
  RequestHistoricalContextInput,
  ResolveCheckedSnapshotInput,
} from "../cmp-types/cmp-interface.js";

export const KERNEL_INTENT_KINDS = [
  "internal_step",
  "model_inference",
  "capability_call",
  "cmp_action",
] as const;
export type KernelIntentKind = (typeof KERNEL_INTENT_KINDS)[number];

export const INTENT_PRIORITIES = [
  "low",
  "normal",
  "high",
  "critical"
] as const;
export type IntentPriority = (typeof INTENT_PRIORITIES)[number];

export interface KernelIntentBase {
  intentId: string;
  sessionId: SessionId;
  runId: RunId;
  kind: KernelIntentKind;
  createdAt: string;
  priority: IntentPriority;
  correlationId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface InternalStepIntent extends KernelIntentBase {
  kind: "internal_step";
  instruction: string;
}

export interface ModelInferenceIntent extends KernelIntentBase {
  kind: "model_inference";
  frame: GoalFrameCompiled;
  stateSummary?: Record<string, unknown>;
}

export interface CapabilityPortRequest {
  requestId: string;
  intentId: string;
  sessionId: SessionId;
  runId: RunId;
  capabilityKey: string;
  input: Record<string, unknown>;
  priority: IntentPriority;
  timeoutMs?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityCallIntent extends KernelIntentBase {
  kind: "capability_call";
  request: CapabilityPortRequest;
}

export interface CmpActionInputByAction {
  ingest_runtime_context: IngestRuntimeContextInput;
  commit_context_delta: CommitContextDeltaInput;
  resolve_checked_snapshot: ResolveCheckedSnapshotInput;
  materialize_context_package: MaterializeContextPackageInput;
  dispatch_context_package: DispatchContextPackageInput;
  request_historical_context: RequestHistoricalContextInput;
}

export const CMP_INTENT_ACTIONS = [
  "ingest_runtime_context",
  "commit_context_delta",
  "resolve_checked_snapshot",
  "materialize_context_package",
  "dispatch_context_package",
  "request_historical_context",
] as const;
export type CmpIntentAction = (typeof CMP_INTENT_ACTIONS)[number];
export type CmpActionInput = CmpActionInputByAction[CmpIntentAction];

export interface CmpActionRequest<TAction extends CmpIntentAction = CmpIntentAction> {
  requestId: string;
  intentId: string;
  sessionId: SessionId;
  runId: RunId;
  action: TAction;
  input: CmpActionInputByAction[TAction];
  priority: IntentPriority;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpActionIntent<TAction extends CmpIntentAction = CmpIntentAction> extends KernelIntentBase {
  kind: "cmp_action";
  request: CmpActionRequest<TAction>;
}

export function isCmpIntentAction(value: string): value is CmpIntentAction {
  return CMP_INTENT_ACTIONS.includes(value as CmpIntentAction);
}

export type KernelIntent =
  | InternalStepIntent
  | ModelInferenceIntent
  | CapabilityCallIntent
  | CmpActionIntent;
