import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoSkippingNeighborhoodBroadcast,
  createCmpIcmaPublishEnvelope,
  resolveNeighborhoodAudience,
} from "./index.js";

const neighborhood = {
  agentId: "agent-yahoo",
  parentAgentId: "agent-parent",
  peerAgentIds: ["agent-peer-a", "agent-peer-b"],
  childAgentIds: ["agent-child-a", "agent-child-b"],
} as const;

test("resolveNeighborhoodAudience only returns parent peers or children within the local neighborhood", () => {
  assert.deepEqual(resolveNeighborhoodAudience({
    neighborhood,
    direction: "parent",
  }), ["agent-parent"]);
  assert.deepEqual(resolveNeighborhoodAudience({
    neighborhood,
    direction: "peer",
  }), ["agent-peer-a", "agent-peer-b"]);
  assert.deepEqual(resolveNeighborhoodAudience({
    neighborhood,
    direction: "child",
  }), ["agent-child-a", "agent-child-b"]);
});

test("createCmpIcmaPublishEnvelope preserves core-agent-selected granularity while targeting only one neighborhood", () => {
  const envelope = createCmpIcmaPublishEnvelope({
    envelopeId: "env-1",
    projectId: "praxis-main",
    sourceAgentId: "agent-yahoo",
    neighborhood,
    direction: "peer",
    granularityLabel: "checked-snapshot-delta",
    payloadRef: "git:cmp/yahoo@abc123",
    createdAt: "2026-03-20T12:00:00.000Z",
  });

  assert.equal(envelope.direction, "peer");
  assert.deepEqual(envelope.targetAgentIds, ["agent-peer-a", "agent-peer-b"]);
  assert.equal(envelope.granularityLabel, "checked-snapshot-delta");
});

test("assertNoSkippingNeighborhoodBroadcast blocks ancestor and parent-peer targets", () => {
  const envelope = createCmpIcmaPublishEnvelope({
    envelopeId: "env-2",
    projectId: "praxis-main",
    sourceAgentId: "agent-yahoo",
    neighborhood,
    direction: "child",
    granularityLabel: "context-package",
    payloadRef: "db:package-1",
    createdAt: "2026-03-20T12:00:00.000Z",
  });

  assert.doesNotThrow(() => assertNoSkippingNeighborhoodBroadcast({
    envelope,
  }));

  assert.throws(() => assertNoSkippingNeighborhoodBroadcast({
    envelope: {
      ...envelope,
      targetAgentIds: ["agent-root"],
    },
    knownAncestorIds: ["agent-root"],
  }), /ancestor/i);

  assert.throws(() => assertNoSkippingNeighborhoodBroadcast({
    envelope: {
      ...envelope,
      targetAgentIds: ["agent-parent-peer"],
    },
    parentPeerIds: ["agent-parent-peer"],
  }), /parent-peer/i);
});

