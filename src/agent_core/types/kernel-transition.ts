import type { KernelIntent } from "./kernel-intents.js";
import type { AgentPhase, AgentStateDelta, AgentStatus } from "./kernel-state.js";

export const STEP_ACTION_KINDS = [
  "none",
  "internal_step",
  "model_inference",
  "capability_call",
  "cmp_action",
  "wait",
  "pause",
  "complete",
  "fail",
  "cancel",
  "checkpoint"
] as const;
export type StepActionKind = (typeof STEP_ACTION_KINDS)[number];

export interface StepTransitionAction {
  kind: StepActionKind;
  intent?: KernelIntent;
  metadata?: Record<string, unknown>;
}

export interface StepTransitionDecision {
  fromStatus: AgentStatus;
  toStatus: AgentStatus;
  nextPhase?: AgentPhase;
  reason: string;
  stateDelta?: AgentStateDelta;
  nextAction?: StepTransitionAction;
  eventId?: string;
}
