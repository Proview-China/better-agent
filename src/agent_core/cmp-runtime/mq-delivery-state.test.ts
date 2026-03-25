import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeCmpMqDeliveryState,
  createCmpMqDeliveryStateFromPublish,
  createCmpMqDeliveryStateFromDeliveryTruth,
  evaluateCmpMqDeliveryTimeout,
  reconcileCmpMqDeliveryStateWithTruth,
} from "./mq-delivery-state.js";

const baseReceipt = {
  receiptId: "receipt-1",
  projectId: "proj-mq-delivery",
  sourceAgentId: "main",
  channel: "to_children" as const,
  lane: "stream" as const,
  redisKey: "cmp:proj-mq-delivery:stream:to_children",
  targetCount: 1,
  publishedAt: "2026-03-25T01:00:00.000Z",
};

test("cmp mq delivery state can be created from publish receipt", () => {
  const state = createCmpMqDeliveryStateFromPublish({
    receipt: baseReceipt,
    dispatchId: "dispatch-1",
    packageId: "package-1",
    targetAgentId: "child-a",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 5_000,
    },
    expiryPolicy: {
      ackTimeoutMs: 10_000,
    },
  });

  assert.equal(state.status, "published");
  assert.equal(state.currentAttempt, 1);
  assert.equal(state.ackDeadlineAt, "2026-03-25T01:00:10.000Z");
});

test("cmp mq delivery state can acknowledge published delivery", () => {
  const state = createCmpMqDeliveryStateFromPublish({
    receipt: baseReceipt,
    dispatchId: "dispatch-2",
    packageId: "package-2",
    targetAgentId: "child-a",
  });

  const acknowledged = acknowledgeCmpMqDeliveryState({
    state,
    acknowledgedAt: "2026-03-25T01:00:30.000Z",
  });

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.acknowledgedAt, "2026-03-25T01:00:30.000Z");
});

test("cmp mq delivery timeout can schedule retry before max attempts", () => {
  const state = createCmpMqDeliveryStateFromPublish({
    receipt: baseReceipt,
    dispatchId: "dispatch-3",
    packageId: "package-3",
    targetAgentId: "child-a",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 5_000,
    },
    expiryPolicy: {
      ackTimeoutMs: 10_000,
    },
  });

  const evaluated = evaluateCmpMqDeliveryTimeout({
    state,
    now: "2026-03-25T01:00:12.000Z",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 5_000,
    },
  });

  assert.equal(evaluated.outcome, "retry_scheduled");
  assert.equal(evaluated.state.status, "retry_scheduled");
  assert.equal(evaluated.state.currentAttempt, 2);
  assert.equal(evaluated.state.nextRetryAt, "2026-03-25T01:00:17.000Z");
  assert.equal(evaluated.projectionPatch.state, "pending_delivery");
});

test("cmp mq delivery timeout expires after retry budget is exhausted", () => {
  const state = createCmpMqDeliveryStateFromPublish({
    receipt: baseReceipt,
    dispatchId: "dispatch-4",
    packageId: "package-4",
    targetAgentId: "child-a",
    retryPolicy: {
      maxAttempts: 1,
      backoffMs: 5_000,
    },
    expiryPolicy: {
      ackTimeoutMs: 10_000,
    },
  });

  const evaluated = evaluateCmpMqDeliveryTimeout({
    state,
    now: "2026-03-25T01:00:20.000Z",
    retryPolicy: {
      maxAttempts: 1,
      backoffMs: 5_000,
    },
  });

  assert.equal(evaluated.outcome, "expired");
  assert.equal(evaluated.state.status, "expired");
  assert.equal(evaluated.projectionPatch.state, "expired");
});

test("cmp mq delivery state can be reconstructed from redis truth and preserve retry policy metadata", () => {
  const state = createCmpMqDeliveryStateFromDeliveryTruth({
    truth: {
      receiptId: "receipt-truth-1",
      projectId: "proj-mq-delivery",
      sourceAgentId: "main",
      channel: "to_children",
      lane: "stream",
      redisKey: "cmp:proj-mq-delivery:stream:to_children",
      targetCount: 1,
      state: "published",
      publishedAt: "2026-03-25T01:10:00.000Z",
      expiresAt: "2026-03-25T01:10:15.000Z",
      metadata: {
        currentAttempt: 2,
        maxAttempts: 4,
        retryBackoffMs: 9_000,
        ackTimeoutMs: 15_000,
      },
    },
    dispatchId: "dispatch-truth-1",
    packageId: "package-truth-1",
    targetAgentId: "child-a",
  });

  assert.equal(state.status, "published");
  assert.equal(state.currentAttempt, 2);
  assert.equal(state.maxAttempts, 4);
  assert.equal(state.ackDeadlineAt, "2026-03-25T01:10:15.000Z");
  assert.equal(state.metadata?.retryBackoffMs, 9_000);
});

test("cmp mq delivery state can reconcile redis acknowledgement truth onto existing state", () => {
  const state = createCmpMqDeliveryStateFromPublish({
    receipt: baseReceipt,
    dispatchId: "dispatch-5",
    packageId: "package-5",
    targetAgentId: "child-a",
  });

  const reconciled = reconcileCmpMqDeliveryStateWithTruth({
    state,
    truth: {
      receiptId: "receipt-5",
      projectId: "proj-mq-delivery",
      sourceAgentId: "main",
      channel: "to_children",
      lane: "stream",
      redisKey: "cmp:proj-mq-delivery:stream:to_children",
      targetCount: 1,
      state: "acknowledged",
      publishedAt: "2026-03-25T01:00:00.000Z",
      acknowledgedAt: "2026-03-25T01:00:40.000Z",
      metadata: {
        ackSource: "redis-truth",
      },
    },
  });

  assert.equal(reconciled.status, "acknowledged");
  assert.equal(reconciled.acknowledgedAt, "2026-03-25T01:00:40.000Z");
  assert.equal(reconciled.metadata?.ackSource, "redis-truth");
});
