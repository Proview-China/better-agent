import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCmpRedisCriticalEscalationUsesQueueLane,
  createCmpCriticalEscalationEnvelope,
  createCmpIcmaPublishEnvelope,
  createInMemoryCmpRedisMqAdapter,
} from "./index.js";

const neighborhood = {
  agentId: "agent-main",
  parentAgentId: "agent-parent",
  peerAgentIds: ["agent-peer"],
  childAgentIds: ["agent-child"],
} as const;

test("cmp-mq redis adapter can bootstrap one agent and publish a neighborhood envelope", () => {
  const adapter = createInMemoryCmpRedisMqAdapter();
  adapter.bootstrapProject({
    projectId: "cmp-project",
    agentId: "agent-main",
  });

  const receipt = adapter.publishEnvelope({
    envelope: createCmpIcmaPublishEnvelope({
      envelopeId: "env-parent",
      projectId: "cmp-project",
      sourceAgentId: "agent-main",
      neighborhood,
      direction: "parent",
      granularityLabel: "checked-delta",
      payloadRef: "git:cmp/agent-main@abc123",
      createdAt: "2026-03-24T19:00:00.000Z",
    }),
  });

  assert.equal(receipt.channel, "to_parent");
  assert.equal(receipt.lane, "stream");
  assert.equal(receipt.targetCount, 1);
  assert.match(receipt.redisKey, /^cmp:cmp-project:stream:/);

  const truth = adapter.readDeliveryTruth({
    projectId: "cmp-project",
    sourceAgentId: "agent-main",
    receiptId: receipt.receiptId,
  });
  assert.equal(truth?.state, "published");

  const acknowledged = adapter.acknowledgeDelivery({
    projectId: "cmp-project",
    sourceAgentId: "agent-main",
    receiptId: receipt.receiptId,
    acknowledgedAt: "2026-03-24T19:01:00.000Z",
  });
  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.acknowledgedAt, "2026-03-24T19:01:00.000Z");
});

test("cmp-mq redis adapter keeps critical escalation on the queue lane only", () => {
  const adapter = createInMemoryCmpRedisMqAdapter();
  adapter.bootstrapProject({
    projectId: "cmp-project",
    agentId: "agent-main",
  });

  const receipt = adapter.publishCriticalEscalation({
    envelope: createCmpCriticalEscalationEnvelope({
      escalationId: "esc-1",
      projectId: "cmp-project",
      sourceAgentId: "agent-main",
      targetAncestorId: "agent-root",
      severity: "critical",
      reason: "direct parent is unavailable",
      evidenceRef: "cmp-alert:esc-1",
      createdAt: "2026-03-24T19:05:00.000Z",
    }),
  });

  assertCmpRedisCriticalEscalationUsesQueueLane(receipt);
  assert.equal(receipt.lane, "queue");
  assert.match(receipt.redisKey, /^cmp:cmp-project:queue:/);
});
