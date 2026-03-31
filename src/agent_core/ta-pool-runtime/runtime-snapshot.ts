import type {
  AccessRequest,
  ReviewDecision,
  TaCapabilityTier,
  TaPoolMode,
} from "../ta-pool-types/index.js";
import type { CapabilityCallIntent } from "../types/index.js";
import type { TaHumanGateEvent, TaHumanGateState } from "./human-gate.js";
import type { TaActivationAttemptRecord } from "./activation-types.js";
import type { TaPendingReplay } from "./replay-policy.js";
import type { ReviewerDurableSnapshot } from "../ta-pool-review/index.js";
import type { ToolReviewSessionSnapshot } from "../ta-pool-tool-review/index.js";
import type {
  ProvisionerDurableSnapshot,
  TmaSessionState,
} from "../ta-pool-provision/index.js";
import type { TapAgentRecord } from "./three-agent-record.js";

export interface TaResumeEnvelope {
  envelopeId: string;
  source: "human_gate" | "replay" | "activation";
  requestId: string;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  requestedTier: TaCapabilityTier;
  mode: TaPoolMode;
  reason: string;
  requestedScope?: AccessRequest["requestedScope"];
  reviewDecisionId?: ReviewDecision["decisionId"];
  intentRequest?: {
    requestId: string;
    intentId: string;
    capabilityKey: string;
    input: Record<string, unknown>;
    priority?: string;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateTaResumeEnvelopeInput {
  envelopeId: string;
  source: TaResumeEnvelope["source"];
  requestId: string;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  requestedTier: TaCapabilityTier;
  mode: TaPoolMode;
  reason: string;
  requestedScope?: AccessRequest["requestedScope"];
  reviewDecisionId?: ReviewDecision["decisionId"];
  intentRequest?: TaResumeEnvelope["intentRequest"];
  metadata?: Record<string, unknown>;
}

export interface TaHumanGateContextSnapshot {
  gateId: string;
  intent: CapabilityCallIntent;
  accessRequest: AccessRequest;
  reviewDecision: ReviewDecision;
  options: {
    agentId: string;
    reason?: string;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    requestedScope?: AccessRequest["requestedScope"];
    requestedDurationMs?: number;
    taskContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

export interface TapPoolRuntimeSnapshot {
  humanGates: TaHumanGateState[];
  humanGateContexts?: TaHumanGateContextSnapshot[];
  humanGateEvents: TaHumanGateEvent[];
  pendingReplays: TaPendingReplay[];
  activationAttempts: TaActivationAttemptRecord[];
  resumeEnvelopes: TaResumeEnvelope[];
  reviewerDurableSnapshot?: ReviewerDurableSnapshot;
  toolReviewerSessions?: ToolReviewSessionSnapshot[];
  provisionerDurableSnapshot?: ProvisionerDurableSnapshot;
  tmaSessions?: TmaSessionState[];
  agentRecords?: TapAgentRecord[];
  metadata?: Record<string, unknown>;
}

export interface PoolRuntimeSnapshots {
  tap?: TapPoolRuntimeSnapshot;
  metadata?: Record<string, unknown>;
}

export interface TapPoolRuntimeSnapshotInput {
  humanGates?: readonly TaHumanGateState[];
  humanGateContexts?: readonly TaHumanGateContextSnapshot[];
  humanGateEvents?: readonly TaHumanGateEvent[];
  pendingReplays?: readonly TaPendingReplay[];
  activationAttempts?: readonly TaActivationAttemptRecord[];
  resumeEnvelopes?: readonly TaResumeEnvelope[];
  reviewerDurableSnapshot?: ReviewerDurableSnapshot;
  toolReviewerSessions?: readonly ToolReviewSessionSnapshot[];
  provisionerDurableSnapshot?: ProvisionerDurableSnapshot;
  tmaSessions?: readonly TmaSessionState[];
  agentRecords?: readonly TapAgentRecord[];
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createTaResumeEnvelope(
  input: CreateTaResumeEnvelopeInput,
): TaResumeEnvelope {
  return {
    envelopeId: assertNonEmpty(input.envelopeId, "Resume envelope envelopeId"),
    source: input.source,
    requestId: assertNonEmpty(input.requestId, "Resume envelope requestId"),
    sessionId: assertNonEmpty(input.sessionId, "Resume envelope sessionId"),
    runId: assertNonEmpty(input.runId, "Resume envelope runId"),
    capabilityKey: assertNonEmpty(input.capabilityKey, "Resume envelope capabilityKey"),
    requestedTier: input.requestedTier,
    mode: input.mode,
    reason: assertNonEmpty(input.reason, "Resume envelope reason"),
    requestedScope: input.requestedScope,
    reviewDecisionId: input.reviewDecisionId?.trim() || undefined,
    intentRequest: input.intentRequest,
    metadata: input.metadata,
  };
}

export function createTapPoolRuntimeSnapshot(
  input: TapPoolRuntimeSnapshotInput = {},
): TapPoolRuntimeSnapshot {
  return {
    humanGates: [...(input.humanGates ?? [])],
    humanGateContexts: [...(input.humanGateContexts ?? [])],
    humanGateEvents: [...(input.humanGateEvents ?? [])],
    pendingReplays: [...(input.pendingReplays ?? [])],
    activationAttempts: [...(input.activationAttempts ?? [])],
    resumeEnvelopes: [...(input.resumeEnvelopes ?? [])],
    reviewerDurableSnapshot: input.reviewerDurableSnapshot
      ? {
        states: input.reviewerDurableSnapshot.states.map((state) => ({
          ...state,
          metadata: state.metadata ? { ...state.metadata } : undefined,
        })),
        metadata: input.reviewerDurableSnapshot.metadata
          ? { ...input.reviewerDurableSnapshot.metadata }
          : undefined,
      }
      : undefined,
    toolReviewerSessions: input.toolReviewerSessions?.map((snapshot) => ({
      session: {
        ...snapshot.session,
        actionIds: [...snapshot.session.actionIds],
        metadata: snapshot.session.metadata ? { ...snapshot.session.metadata } : undefined,
      },
      actions: snapshot.actions.map((action) => ({
        ...action,
        metadata: action.metadata ? { ...action.metadata } : undefined,
      })),
    })),
    provisionerDurableSnapshot: input.provisionerDurableSnapshot
      ? {
        ...input.provisionerDurableSnapshot,
        registry: {
          records: input.provisionerDurableSnapshot.registry.records.map((record) => ({
            ...record,
            request: {
              ...record.request,
              requiredVerification: record.request.requiredVerification
                ? [...record.request.requiredVerification]
                : undefined,
              expectedArtifacts: record.request.expectedArtifacts
                ? [...record.request.expectedArtifacts]
                : undefined,
              metadata: record.request.metadata ? { ...record.request.metadata } : undefined,
            },
            bundle: record.bundle ? { ...record.bundle } : undefined,
            bundleHistory: record.bundleHistory.map((bundle) => ({ ...bundle })),
          })),
        },
        assetIndex: {
          assets: input.provisionerDurableSnapshot.assetIndex.assets.map((asset) => ({ ...asset })),
          currentAssetIds: input.provisionerDurableSnapshot.assetIndex.currentAssetIds.map((entry) => ({ ...entry })),
        },
        bundleHistory: input.provisionerDurableSnapshot.bundleHistory.map((entry) => ({
          provisionId: entry.provisionId,
          bundles: entry.bundles.map((bundle) => ({ ...bundle })),
        })),
        tmaSessions: input.provisionerDurableSnapshot.tmaSessions?.map((session) => ({
          ...session,
          boundary: { ...session.boundary },
          metadata: session.metadata ? { ...session.metadata } : undefined,
        })),
      }
      : undefined,
    tmaSessions: input.tmaSessions?.map((session) => ({
      ...session,
      boundary: { ...session.boundary },
      metadata: session.metadata ? { ...session.metadata } : undefined,
    })),
    agentRecords: input.agentRecords?.map((record) => ({
      ...record,
      metadata: record.metadata ? { ...record.metadata } : undefined,
    })),
    metadata: input.metadata,
  };
}

export function createPoolRuntimeSnapshots(
  input: Partial<PoolRuntimeSnapshots> = {},
): PoolRuntimeSnapshots {
  return {
    tap: input.tap ? createTapPoolRuntimeSnapshot(input.tap) : undefined,
    metadata: input.metadata,
  };
}
