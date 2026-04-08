import type { MpMemoryRecord, MpSessionMode } from "../mp-types/index.js";
import { assertNonEmpty, type MpSessionAccessDecision } from "./runtime-types.js";

export const MP_SESSION_BRIDGE_STATUSES = [
  "active",
  "archived",
] as const;
export type MpSessionBridgeStatus = (typeof MP_SESSION_BRIDGE_STATUSES)[number];

export interface MpSessionBridgeRecord {
  bridgeId: string;
  memoryId: string;
  ownerAgentId: string;
  sourceSessionId: string;
  targetSessionId: string;
  status: MpSessionBridgeStatus;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function isMpSessionBridgeStatus(value: string): value is MpSessionBridgeStatus {
  return MP_SESSION_BRIDGE_STATUSES.includes(value as MpSessionBridgeStatus);
}

export function createMpSessionBridgeRecord(
  input: MpSessionBridgeRecord,
): MpSessionBridgeRecord {
  const record: MpSessionBridgeRecord = {
    bridgeId: assertNonEmpty(input.bridgeId, "MP session bridge bridgeId"),
    memoryId: assertNonEmpty(input.memoryId, "MP session bridge memoryId"),
    ownerAgentId: assertNonEmpty(input.ownerAgentId, "MP session bridge ownerAgentId"),
    sourceSessionId: assertNonEmpty(input.sourceSessionId, "MP session bridge sourceSessionId"),
    targetSessionId: assertNonEmpty(input.targetSessionId, "MP session bridge targetSessionId"),
    status: input.status,
    createdAt: assertNonEmpty(input.createdAt, "MP session bridge createdAt"),
    metadata: input.metadata,
  };
  if (!isMpSessionBridgeStatus(record.status)) {
    throw new Error(`Unsupported MP session bridge status: ${record.status}.`);
  }
  if (record.sourceSessionId === record.targetSessionId) {
    throw new Error("MP session bridge requires different sourceSessionId and targetSessionId.");
  }
  return record;
}

function findMatchingBridge(params: {
  memoryId: string;
  sourceSessionId: string;
  targetSessionId: string;
  bridgeRecords: readonly MpSessionBridgeRecord[];
}): MpSessionBridgeRecord | undefined {
  return params.bridgeRecords.find((bridge) => (
    bridge.memoryId === params.memoryId
    && bridge.status === "active"
    && (
      (bridge.sourceSessionId === params.sourceSessionId
        && bridge.targetSessionId === params.targetSessionId)
      || (bridge.sourceSessionId === params.targetSessionId
        && bridge.targetSessionId === params.sourceSessionId)
    )
  ));
}

export function resolveMpEffectiveSessionMode(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "sessionMode" | "sessionId">;
  requesterSessionId?: string;
  bridgeRecords?: readonly MpSessionBridgeRecord[];
}): MpSessionMode {
  const requesterSessionId = params.requesterSessionId?.trim() || undefined;
  if (!requesterSessionId || !params.memory.sessionId || params.memory.sessionId === requesterSessionId) {
    return params.memory.sessionMode;
  }
  if (params.memory.sessionMode !== "bridged") {
    return params.memory.sessionMode;
  }
  return findMatchingBridge({
    memoryId: params.memory.memoryId,
    sourceSessionId: params.memory.sessionId,
    targetSessionId: requesterSessionId,
    bridgeRecords: params.bridgeRecords ?? [],
  })
    ? "shared"
    : "bridged";
}

export function evaluateMpSessionBridgeAccess(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "sessionMode" | "sessionId">;
  requesterSessionId?: string;
  bridgeRecords?: readonly MpSessionBridgeRecord[];
}): MpSessionAccessDecision {
  const requesterSessionId = params.requesterSessionId?.trim() || undefined;
  if (!params.memory.sessionId || !requesterSessionId || params.memory.sessionId === requesterSessionId) {
    return {
      allowed: true,
      reason: "MP session access is local to the owning or matching session.",
    };
  }

  switch (params.memory.sessionMode) {
    case "shared":
      return {
        allowed: true,
        reason: "MP shared session mode allows cross-session access.",
      };
    case "isolated":
      return {
        allowed: false,
        reason: "MP isolated session mode blocks cross-session access.",
      };
    case "bridged": {
      const bridge = findMatchingBridge({
        memoryId: params.memory.memoryId,
        sourceSessionId: params.memory.sessionId,
        targetSessionId: requesterSessionId,
        bridgeRecords: params.bridgeRecords ?? [],
      });
      return {
        allowed: Boolean(bridge),
        reason: bridge
          ? `MP bridged session access is allowed by bridge ${bridge.bridgeId}.`
          : "MP bridged session access requires an active bridge record.",
      };
    }
  }
}

export function assertMpSessionBridgeAllowed(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "sessionMode" | "sessionId">;
  requesterSessionId?: string;
  bridgeRecords?: readonly MpSessionBridgeRecord[];
}): void {
  const decision = evaluateMpSessionBridgeAccess(params);
  if (!decision.allowed) {
    throw new Error(
      `MP memory ${params.memory.memoryId} cannot cross sessions: ${decision.reason}`,
    );
  }
}
