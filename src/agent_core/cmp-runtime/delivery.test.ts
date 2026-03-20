import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeCmpDispatchReceipt,
  createCmpDispatchInstruction,
  createCmpDispatchReceipt,
  markCmpDispatchDelivered,
} from "./delivery.js";

test("CMP dispatcher delivery transitions through prepared, delivered, and acknowledged", () => {
  const instruction = createCmpDispatchInstruction({
    dispatchId: "dispatch-1",
    packageId: "package-1",
    sourceAgentId: "agent-parent",
    targetAgentId: "agent-child",
    direction: "child",
    createdAt: "2026-03-20T08:30:00.000Z",
  });
  const prepared = createCmpDispatchReceipt({
    dispatchId: instruction.dispatchId,
    packageId: instruction.packageId,
    sourceAgentId: instruction.sourceAgentId,
    targetAgentId: instruction.targetAgentId,
    direction: instruction.direction,
    status: "prepared",
    createdAt: instruction.createdAt,
  });
  const delivered = markCmpDispatchDelivered({
    receipt: prepared,
    deliveredAt: "2026-03-20T08:30:01.000Z",
  });
  const acknowledged = acknowledgeCmpDispatchReceipt({
    receipt: delivered,
    acknowledgedAt: "2026-03-20T08:30:02.000Z",
  });

  assert.equal(delivered.status, "delivered");
  assert.equal(acknowledged.status, "acknowledged");
});

test("CMP dispatcher delivery rejects self-targeting instructions", () => {
  assert.throws(() => createCmpDispatchInstruction({
    dispatchId: "dispatch-2",
    packageId: "package-2",
    sourceAgentId: "agent-main",
    targetAgentId: "agent-main",
    direction: "peer",
    createdAt: "2026-03-20T08:31:00.000Z",
  }), /cannot target the source agent/i);
});

