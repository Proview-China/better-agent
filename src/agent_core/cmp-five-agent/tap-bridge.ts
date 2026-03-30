import { randomUUID } from "node:crypto";

import type {
  AccessRequestScope,
  AgentCapabilityProfile,
  TaCapabilityTier,
  TaPoolMode,
} from "../ta-pool-types/index.js";
import { TaControlPlaneGateway } from "../ta-pool-runtime/index.js";
import type { CapabilityCallIntent, IntentPriority } from "../types/index.js";
import { createCmpRoleTapProfile } from "./configuration.js";
import type { CmpFiveAgentRole } from "./shared.js";
import type { CmpFiveAgentRuntimeSnapshot } from "./types.js";

export interface CmpFiveAgentTapBridgeContext {
  requestId?: string;
  packageId?: string;
  sourceSnapshotId?: string;
  sourceSectionIds?: string[];
  bundleRef?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpFiveAgentTapBridgeCompiledInput {
  role: CmpFiveAgentRole;
  sessionId: string;
  runId: string;
  agentId: string;
  capabilityKey: string;
  reason: string;
  capabilityInput: Record<string, unknown>;
  priority?: IntentPriority;
  timeoutMs?: number;
  requestedTier?: TaCapabilityTier;
  mode?: TaPoolMode;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  cmpContext?: CmpFiveAgentTapBridgeContext;
  snapshot?: CmpFiveAgentRuntimeSnapshot;
  metadata?: Record<string, unknown>;
}

export interface CmpFiveAgentTapBridgeCompiled {
  profile: AgentCapabilityProfile;
  intent: CapabilityCallIntent;
  bridgeMetadata: Record<string, unknown>;
  dispatchOptions: {
    agentId: string;
    reason: string;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    requestedScope?: AccessRequestScope;
    requestedDurationMs?: number;
    taskContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    controlPlaneGatewayOverride?: TaControlPlaneGateway;
    profileOverride?: AgentCapabilityProfile;
  };
}

function latestForRole(snapshot: CmpFiveAgentRuntimeSnapshot | undefined, role: CmpFiveAgentRole): Record<string, unknown> | undefined {
  if (!snapshot) {
    return undefined;
  }
  switch (role) {
    case "icma":
      return snapshot.icmaRecords.at(-1)
        ? {
          loopId: snapshot.icmaRecords.at(-1)?.loopId,
          stage: snapshot.icmaRecords.at(-1)?.stage,
          structuredOutput: snapshot.icmaRecords.at(-1)?.structuredOutput,
        }
        : undefined;
    case "iterator":
      return snapshot.iteratorRecords.at(-1)
        ? {
          loopId: snapshot.iteratorRecords.at(-1)?.loopId,
          stage: snapshot.iteratorRecords.at(-1)?.stage,
          reviewOutput: snapshot.iteratorRecords.at(-1)?.reviewOutput,
        }
        : undefined;
    case "checker":
      return snapshot.checkerRecords.at(-1)
        ? {
          loopId: snapshot.checkerRecords.at(-1)?.loopId,
          stage: snapshot.checkerRecords.at(-1)?.stage,
          reviewOutput: snapshot.checkerRecords.at(-1)?.reviewOutput,
        }
        : undefined;
    case "dbagent":
      return snapshot.dbAgentRecords.at(-1)
        ? {
          loopId: snapshot.dbAgentRecords.at(-1)?.loopId,
          stage: snapshot.dbAgentRecords.at(-1)?.stage,
          materializationOutput: snapshot.dbAgentRecords.at(-1)?.materializationOutput,
        }
        : undefined;
    case "dispatcher":
      return snapshot.dispatcherRecords.at(-1)
        ? {
          loopId: snapshot.dispatcherRecords.at(-1)?.loopId,
          stage: snapshot.dispatcherRecords.at(-1)?.stage,
          bundle: snapshot.dispatcherRecords.at(-1)?.bundle,
        }
        : undefined;
  }
}

export function createCmpFiveAgentTapBridgeMetadata(input: {
  role: CmpFiveAgentRole;
  agentId: string;
  capabilityKey: string;
  reason: string;
  snapshot?: CmpFiveAgentRuntimeSnapshot;
  cmpContext?: CmpFiveAgentTapBridgeContext;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    cmpRole: input.role,
    cmpAgentId: input.agentId,
    cmpCapabilityKey: input.capabilityKey,
    cmpCapabilityReason: input.reason,
    cmpTapBridge: {
      ...(input.cmpContext ?? {}),
    },
    cmpFiveAgentContext: input.snapshot ? latestForRole(input.snapshot, input.role) : undefined,
    ...(input.metadata ?? {}),
  };
}

export function createCmpFiveAgentTapBridgeCompiled(
  input: CreateCmpFiveAgentTapBridgeCompiledInput,
): CmpFiveAgentTapBridgeCompiled {
  const profile = createCmpRoleTapProfile(input.role);
  const gateway = new TaControlPlaneGateway({ profile });
  const createdAt = new Date().toISOString();
  const intentId = `${input.agentId}:${input.role}:tap:${input.runId}:${randomUUID()}`;
  const bridgeMetadata = createCmpFiveAgentTapBridgeMetadata({
    role: input.role,
    agentId: input.agentId,
    capabilityKey: input.capabilityKey,
    reason: input.reason,
    cmpContext: input.cmpContext,
    snapshot: input.snapshot,
    metadata: input.metadata,
  });

  return {
    profile,
    intent: {
      intentId,
      sessionId: input.sessionId,
      runId: input.runId,
      kind: "capability_call",
      createdAt,
      priority: input.priority ?? "high",
      correlationId: input.cmpContext?.requestId,
      metadata: bridgeMetadata,
      request: {
        requestId: `${intentId}:request`,
        intentId,
        sessionId: input.sessionId,
        runId: input.runId,
        capabilityKey: input.capabilityKey,
        input: input.capabilityInput,
        priority: input.priority ?? "high",
        timeoutMs: input.timeoutMs,
        metadata: bridgeMetadata,
      },
    },
    bridgeMetadata,
    dispatchOptions: {
      agentId: input.agentId,
      reason: input.reason,
      requestedTier: input.requestedTier,
      mode: input.mode,
      requestedScope: input.requestedScope,
      requestedDurationMs: input.requestedDurationMs,
      taskContext: input.taskContext,
      metadata: bridgeMetadata,
      controlPlaneGatewayOverride: gateway,
      profileOverride: profile,
    },
  };
}
