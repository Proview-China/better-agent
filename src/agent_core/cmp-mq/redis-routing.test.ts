import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpMqTopic,
  createCmpRedisNamespace,
  createCmpRedisTopicBinding,
  resolveCmpRedisLaneForChannel,
} from "./index.js";

test("cmp-mq redis namespace bootstrap creates stable project-scoped prefixes", () => {
  const namespace = createCmpRedisNamespace({
    projectId: "Praxis Main",
  });

  assert.equal(namespace.namespaceRoot, "cmp");
  assert.equal(namespace.keyPrefix, "cmp:praxis-main");
  assert.equal(namespace.channelsPrefix, "cmp:praxis-main:channel");
  assert.equal(namespace.streamsPrefix, "cmp:praxis-main:stream");
  assert.equal(namespace.queuesPrefix, "cmp:praxis-main:queue");
  assert.equal(namespace.consumerGroupPrefix, "cmp:praxis-main:group");
});

test("cmp-mq redis lane selection keeps critical escalation as the only queue lane", () => {
  assert.equal(resolveCmpRedisLaneForChannel("local"), "stream");
  assert.equal(resolveCmpRedisLaneForChannel("to_parent"), "stream");
  assert.equal(resolveCmpRedisLaneForChannel("peer"), "pubsub");
  assert.equal(resolveCmpRedisLaneForChannel("to_children"), "pubsub");
  assert.equal(resolveCmpRedisLaneForChannel("promotion"), "stream");
  assert.equal(resolveCmpRedisLaneForChannel("critical_escalation"), "queue");
});

test("cmp-mq redis topic binding lowers topics onto lane-specific redis keys", () => {
  const namespace = createCmpRedisNamespace({
    projectId: "praxis-main",
  });
  const streamBinding = createCmpRedisTopicBinding({
    namespace,
    descriptor: createCmpMqTopic({
      projectId: "praxis-main",
      agentId: "agent-main",
      channel: "to_parent",
    }),
  });
  const pubsubBinding = createCmpRedisTopicBinding({
    namespace,
    descriptor: createCmpMqTopic({
      projectId: "praxis-main",
      agentId: "agent-main",
      channel: "peer",
    }),
  });
  const queueBinding = createCmpRedisTopicBinding({
    namespace,
    descriptor: createCmpMqTopic({
      projectId: "praxis-main",
      agentId: "agent-main",
      channel: "critical_escalation",
    }),
  });

  assert.equal(streamBinding.lane, "stream");
  assert.match(streamBinding.redisKey, /^cmp:praxis-main:stream:/);
  assert.equal(pubsubBinding.lane, "pubsub");
  assert.match(pubsubBinding.redisKey, /^cmp:praxis-main:channel:/);
  assert.equal(queueBinding.lane, "queue");
  assert.match(queueBinding.redisKey, /^cmp:praxis-main:queue:/);
});
