import type { TaActivationAttemptRecord } from "./activation-types.js";
import type { TaHumanGateEvent, TaHumanGateState } from "./human-gate.js";
import type { TaPendingReplay } from "./replay-policy.js";
import type { ReviewerDurableSnapshot } from "../ta-pool-review/index.js";
import type { ToolReviewSessionSnapshot } from "../ta-pool-tool-review/index.js";
import type {
  ProvisionerDurableSnapshot,
  TmaSessionState,
} from "../ta-pool-provision/index.js";
import {
  createPoolRuntimeSnapshots,
  createTapPoolRuntimeSnapshot,
  type PoolRuntimeSnapshots,
  type TapPoolRuntimeSnapshot,
  type TaHumanGateContextSnapshot,
  type TaResumeEnvelope,
} from "./runtime-snapshot.js";

export interface TapRuntimeHydratedState {
  humanGates: Map<string, TaHumanGateState>;
  humanGateContexts: Map<string, TaHumanGateContextSnapshot>;
  humanGateEvents: Map<string, TaHumanGateEvent[]>;
  pendingReplays: Map<string, TaPendingReplay>;
  activationAttempts: Map<string, TaActivationAttemptRecord>;
  resumeEnvelopes: Map<string, TaResumeEnvelope>;
  reviewerDurableSnapshot?: ReviewerDurableSnapshot;
  toolReviewerSessions: ToolReviewSessionSnapshot[];
  provisionerDurableSnapshot?: ProvisionerDurableSnapshot;
  tmaSessions: Map<string, TmaSessionState>;
}

function assertUniqueKey(kind: string, key: string, seen: Set<string>): void {
  if (seen.has(key)) {
    throw new Error(`Duplicate ${kind} key detected during TAP runtime recovery: ${key}.`);
  }
  seen.add(key);
}

function cloneTapSnapshot(snapshot?: Partial<TapPoolRuntimeSnapshot>): TapPoolRuntimeSnapshot {
  return createTapPoolRuntimeSnapshot(snapshot);
}

export function serializeTapRuntimeSnapshot(
  input: Partial<TapPoolRuntimeSnapshot> = {},
): TapPoolRuntimeSnapshot {
  return cloneTapSnapshot(input);
}

export function serializePoolRuntimeSnapshots(
  input: Partial<PoolRuntimeSnapshots> = {},
): PoolRuntimeSnapshots {
  return createPoolRuntimeSnapshots(input);
}

export function hydrateTapRuntimeSnapshot(
  snapshot?: TapPoolRuntimeSnapshot,
): TapRuntimeHydratedState {
  const normalized = cloneTapSnapshot(snapshot);
  const humanGates = new Map<string, TaHumanGateState>();
  const humanGateContexts = new Map<string, TaHumanGateContextSnapshot>();
  const humanGateEvents = new Map<string, TaHumanGateEvent[]>();
  const pendingReplays = new Map<string, TaPendingReplay>();
  const activationAttempts = new Map<string, TaActivationAttemptRecord>();
  const resumeEnvelopes = new Map<string, TaResumeEnvelope>();
  const tmaSessions = new Map<string, TmaSessionState>();

  const seenGateIds = new Set<string>();
  for (const gate of normalized.humanGates) {
    assertUniqueKey("human gate", gate.gateId, seenGateIds);
    humanGates.set(gate.gateId, gate);
  }

  const seenGateContextIds = new Set<string>();
  for (const context of normalized.humanGateContexts ?? []) {
    assertUniqueKey("human gate context", context.gateId, seenGateContextIds);
    humanGateContexts.set(context.gateId, context);
  }

  for (const event of normalized.humanGateEvents) {
    const history = humanGateEvents.get(event.gateId) ?? [];
    history.push(event);
    humanGateEvents.set(event.gateId, history);
  }
  for (const [gateId, history] of humanGateEvents) {
    history.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    humanGateEvents.set(gateId, history);
  }

  const seenReplayIds = new Set<string>();
  for (const replay of normalized.pendingReplays) {
    assertUniqueKey("pending replay", replay.replayId, seenReplayIds);
    pendingReplays.set(replay.replayId, replay);
  }

  const seenAttemptIds = new Set<string>();
  for (const attempt of normalized.activationAttempts) {
    assertUniqueKey("activation attempt", attempt.attemptId, seenAttemptIds);
    activationAttempts.set(attempt.attemptId, attempt);
  }

  const seenResumeEnvelopeIds = new Set<string>();
  for (const envelope of normalized.resumeEnvelopes) {
    assertUniqueKey("resume envelope", envelope.envelopeId, seenResumeEnvelopeIds);
    resumeEnvelopes.set(envelope.envelopeId, envelope);
  }

  const seenTmaSessionIds = new Set<string>();
  for (const session of normalized.tmaSessions ?? []) {
    assertUniqueKey("tma session", session.sessionId, seenTmaSessionIds);
    tmaSessions.set(session.sessionId, session);
  }

  return {
    humanGates,
    humanGateContexts,
    humanGateEvents,
    pendingReplays,
    activationAttempts,
    resumeEnvelopes,
    reviewerDurableSnapshot: normalized.reviewerDurableSnapshot,
    toolReviewerSessions: [...(normalized.toolReviewerSessions ?? [])],
    provisionerDurableSnapshot: normalized.provisionerDurableSnapshot,
    tmaSessions,
  };
}

export function hydratePoolRuntimeSnapshots(
  snapshots?: PoolRuntimeSnapshots,
): { tap: TapRuntimeHydratedState } {
  const normalized = createPoolRuntimeSnapshots(snapshots);
  return {
    tap: hydrateTapRuntimeSnapshot(normalized.tap),
  };
}
