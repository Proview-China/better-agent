import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpIngressRecord,
  planCmpNeighborhoodBroadcast,
} from "./ingress-contract.js";

test("CMP ingress record preserves core_agent-granularity payload and creates neighborhood envelopes", () => {
  const ingress = createCmpIngressRecord({
    ingressId: "ingress-1",
    lineage: {
      projectId: "project-1",
      agentId: "agent-main",
      depth: 0,
      childAgentIds: ["agent-child-1"],
      peerAgentIds: ["agent-peer-1"],
    },
    sessionId: "session-1",
    runId: "run-1",
    payloadRef: {
      ref: "payload:context-event-1",
      kind: "context_event",
    },
    granularityLabel: "core-agent-selected/high-signal",
    createdAt: "2026-03-20T08:00:00.000Z",
    source: "core_agent",
  });

  const planned = planCmpNeighborhoodBroadcast({
    ingress,
    parentAgentId: "agent-parent-1",
    peerAgentIds: ["agent-peer-1"],
    childAgentIds: ["agent-child-1"],
  });

  assert.equal(planned.length, 3);
  assert.equal(planned[0]?.relation, "parent");
  assert.equal(planned[1]?.relation, "peer");
  assert.equal(planned[2]?.relation, "child");
  assert.equal(planned[0]?.granularityLabel, "core-agent-selected/high-signal");
});

test("CMP neighborhood broadcast rejects self-targeting envelopes", () => {
  assert.throws(() => planCmpNeighborhoodBroadcast({
    ingress: {
      ingressId: "ingress-2",
      lineage: {
        projectId: "project-1",
        agentId: "agent-main",
        depth: 0,
      },
      sessionId: "session-1",
      runId: "run-1",
      payloadRef: {
        ref: "payload:2",
        kind: "context_event",
      },
      granularityLabel: "minimal",
      createdAt: "2026-03-20T08:01:00.000Z",
      source: "core_agent",
    },
    peerAgentIds: ["agent-main"],
  }), /cannot target the source agent/i);
});

