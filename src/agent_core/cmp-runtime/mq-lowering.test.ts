import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryCmpRedisMqAdapter } from "../cmp-mq/index.js";
import {
  createCmpMqDispatchEnvelope,
  executeCmpMqAckLowering,
  executeCmpMqAckStateLowering,
  executeCmpMqDispatchLowering,
  executeCmpMqDispatchStateLowering,
} from "./mq-lowering.js";

test("cmp mq lowering validates neighborhood subscriptions and publishes an envelope", async () => {
  const adapter = createInMemoryCmpRedisMqAdapter();
  await adapter.bootstrapProject({
    projectId: "proj-mq-lowering",
    agentId: "main",
  });

  const envelope = createCmpMqDispatchEnvelope({
    projectId: "proj-mq-lowering",
    sourceAgentId: "main",
    targetAgentId: "child-a",
    direction: "child",
    contextPackage: {
      packageId: "pkg-1",
      packageRef: "cmp-package:snapshot:1:child-a:child_seed",
      packageKind: "child_seed",
    },
    createdAt: "2026-03-25T00:00:00.000Z",
  });

  const lowered = await executeCmpMqDispatchLowering({
    adapter,
    neighborhood: {
      agentId: "main",
      peerAgentIds: [],
      childAgentIds: ["child-a"],
    },
    envelope,
  });

  assert.equal(lowered.validatedSubscriptions.length, 1);
  assert.equal(lowered.publishReceipt.channel, "to_children");
  assert.equal(lowered.publishReceipt.targetCount, 1);
  assert.equal(lowered.deliveryTruth?.state, "published");

  const acknowledged = await executeCmpMqAckLowering({
    adapter,
    projectId: "proj-mq-lowering",
    sourceAgentId: "main",
    receiptId: lowered.publishReceipt.receiptId,
    acknowledgedAt: "2026-03-25T00:01:00.000Z",
    metadata: {
      ackSource: "mq-lowering-test",
    },
  });

  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.acknowledgedAt, "2026-03-25T00:01:00.000Z");
  assert.equal(acknowledged.metadata?.ackSource, "mq-lowering-test");
});

test("cmp mq lowering can synthesize delivery state and projection patch for runtime wiring", async () => {
  const adapter = createInMemoryCmpRedisMqAdapter();
  await adapter.bootstrapProject({
    projectId: "proj-mq-state-lowering",
    agentId: "main",
  });

  const lowered = await executeCmpMqDispatchStateLowering({
    adapter,
    neighborhood: {
      agentId: "main",
      peerAgentIds: [],
      childAgentIds: ["child-a"],
    },
    envelope: createCmpMqDispatchEnvelope({
      projectId: "proj-mq-state-lowering",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      direction: "child",
      contextPackage: {
        packageId: "pkg-state-1",
        packageRef: "cmp-package:snapshot:1:child-a:child_seed",
        packageKind: "child_seed",
      },
      createdAt: "2026-03-25T00:00:00.000Z",
    }),
    dispatchId: "dispatch-state-1",
    packageId: "pkg-state-1",
    targetAgentId: "child-a",
    retryPolicy: {
      maxAttempts: 4,
      backoffMs: 8_000,
    },
    expiryPolicy: {
      ackTimeoutMs: 12_000,
    },
    metadata: {
      loweringMode: "dispatch-state-test",
    },
  });

  assert.equal(lowered.deliveryState.status, "published");
  assert.equal(lowered.deliveryState.maxAttempts, 4);
  assert.equal(lowered.projectionPatch.state, "pending_delivery");
  assert.equal(lowered.projectionPatch.metadata?.loweringMode, "dispatch-state-test");

  const acknowledged = await executeCmpMqAckStateLowering({
    adapter,
    projectId: "proj-mq-state-lowering",
    sourceAgentId: "main",
    receiptId: lowered.publishReceipt.receiptId,
    deliveryState: lowered.deliveryState,
    acknowledgedAt: "2026-03-25T00:01:00.000Z",
    metadata: {
      ackSource: "dispatch-state-test",
    },
  });

  assert.equal(acknowledged.deliveryTruth.state, "acknowledged");
  assert.equal(acknowledged.deliveryState.status, "acknowledged");
  assert.equal(acknowledged.projectionPatch.state, "acknowledged");
  assert.equal(acknowledged.projectionPatch.metadata?.ackSource, "dispatch-state-test");
});
