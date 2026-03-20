import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpMqTopic,
  createCmpMqTopicTopology,
  listNeighborhoodTopics,
} from "./index.js";

test("cmp-mq topic topology builds the frozen project.agent.channel topic family", () => {
  const topic = createCmpMqTopic({
    projectId: "Praxis Main",
    agentId: "agent-yahoo",
    channel: "to_parent",
  });

  assert.equal(topic.topic, "project.praxis-main.agent.agent-yahoo.to_parent");
  const topology = createCmpMqTopicTopology({
    projectId: "Praxis Main",
    agentId: "agent-yahoo",
  });
  assert.equal(topology.length, 6);
});

test("listNeighborhoodTopics exposes local parent peer child promotion and escalation channels", () => {
  const topology = listNeighborhoodTopics({
    projectId: "praxis-main",
    neighborhood: {
      agentId: "agent-yahoo",
      parentAgentId: "agent-parent",
      peerAgentIds: ["agent-peer-a", "agent-peer-b"],
      childAgentIds: ["agent-child-a"],
    },
  });

  assert.equal(topology.local.channel, "local");
  assert.equal(topology.toParent?.channel, "to_parent");
  assert.equal(topology.peer.channel, "peer");
  assert.equal(topology.toChildren.channel, "to_children");
  assert.equal(topology.promotion.channel, "promotion");
  assert.equal(topology.criticalEscalation.channel, "critical_escalation");
});

