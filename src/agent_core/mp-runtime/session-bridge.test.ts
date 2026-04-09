import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMpSessionBridgeAllowed,
  createMpSessionBridgeRecord,
  evaluateMpSessionBridgeAccess,
  resolveMpEffectiveSessionMode,
} from "./session-bridge.js";

test("mp session bridge records require two distinct sessions", () => {
  const bridge = createMpSessionBridgeRecord({
    bridgeId: "bridge-1",
    memoryId: "memory-1",
    ownerAgentId: "agent.main",
    sourceSessionId: "session-a",
    targetSessionId: "session-b",
    status: "active",
    createdAt: "2026-04-08T00:00:00.000Z",
  });

  assert.equal(bridge.status, "active");

  assert.throws(() => createMpSessionBridgeRecord({
    ...bridge,
    bridgeId: "bridge-2",
    targetSessionId: "session-a",
  }), /requires different sourceSessionId and targetSessionId/i);
});

test("mp session access blocks isolated memory and allows bridged memory with an active bridge", () => {
  const bridge = createMpSessionBridgeRecord({
    bridgeId: "bridge-1",
    memoryId: "memory-bridged",
    ownerAgentId: "agent.main",
    sourceSessionId: "session-a",
    targetSessionId: "session-b",
    status: "active",
    createdAt: "2026-04-08T00:00:00.000Z",
  });

  const isolated = evaluateMpSessionBridgeAccess({
    memory: {
      memoryId: "memory-isolated",
      sessionMode: "isolated",
      sessionId: "session-a",
    },
    requesterSessionId: "session-b",
  });
  const bridged = evaluateMpSessionBridgeAccess({
    memory: {
      memoryId: "memory-bridged",
      sessionMode: "bridged",
      sessionId: "session-a",
    },
    requesterSessionId: "session-b",
    bridgeRecords: [bridge],
  });
  const shared = evaluateMpSessionBridgeAccess({
    memory: {
      memoryId: "memory-shared",
      sessionMode: "shared",
      sessionId: "session-a",
    },
    requesterSessionId: "session-z",
  });

  assert.equal(isolated.allowed, false);
  assert.equal(bridged.allowed, true);
  assert.equal(shared.allowed, true);
  assert.doesNotThrow(() => assertMpSessionBridgeAllowed({
    memory: {
      memoryId: "memory-bridged",
      sessionMode: "bridged",
      sessionId: "session-a",
    },
    requesterSessionId: "session-b",
    bridgeRecords: [bridge],
  }));
});

test("mp effective session mode upgrades bridged memory to shared only when an active bridge exists", () => {
  const bridge = createMpSessionBridgeRecord({
    bridgeId: "bridge-1",
    memoryId: "memory-1",
    ownerAgentId: "agent.main",
    sourceSessionId: "session-a",
    targetSessionId: "session-b",
    status: "active",
    createdAt: "2026-04-08T00:00:00.000Z",
  });

  assert.equal(resolveMpEffectiveSessionMode({
    memory: {
      memoryId: "memory-1",
      sessionMode: "bridged",
      sessionId: "session-a",
    },
    requesterSessionId: "session-b",
    bridgeRecords: [bridge],
  }), "shared");

  assert.equal(resolveMpEffectiveSessionMode({
    memory: {
      memoryId: "memory-1",
      sessionMode: "bridged",
      sessionId: "session-a",
    },
    requesterSessionId: "session-c",
    bridgeRecords: [bridge],
  }), "bridged");
});
