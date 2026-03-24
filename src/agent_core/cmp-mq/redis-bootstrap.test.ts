import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpRedisProjectBootstrap,
  getCmpRedisBindingForChannel,
  listCmpRedisBootstrapKeys,
} from "./index.js";

test("cmp-mq redis bootstrap builds one namespace and all six channel bindings for an agent", () => {
  const bootstrap = createCmpRedisProjectBootstrap({
    projectId: "cmp-project",
    agentId: "agent-main",
  });

  assert.equal(bootstrap.namespace.keyPrefix, "cmp:cmp-project");
  assert.equal(bootstrap.topicBindings.length, 6);
  assert.equal(getCmpRedisBindingForChannel({
    bootstrap,
    channel: "to_parent",
  })?.lane, "stream");
  assert.equal(getCmpRedisBindingForChannel({
    bootstrap,
    channel: "peer",
  })?.lane, "pubsub");
  assert.equal(getCmpRedisBindingForChannel({
    bootstrap,
    channel: "critical_escalation",
  })?.lane, "queue");
});

test("cmp-mq redis bootstrap exposes namespace keys for bootstrap readback", () => {
  const bootstrap = createCmpRedisProjectBootstrap({
    projectId: "cmp-project",
    agentId: "agent-main",
  });

  assert.deepEqual(listCmpRedisBootstrapKeys({
    namespace: bootstrap.namespace,
  }), [
    "cmp:cmp-project",
    "cmp:cmp-project:channel",
    "cmp:cmp-project:stream",
    "cmp:cmp-project:queue",
    "cmp:cmp-project:group",
  ]);
});
