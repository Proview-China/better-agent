import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryCmpRedisMqAdapter } from "../cmp-mq/index.js";
import { executeCmpMqDispatchLowering, createCmpMqDispatchEnvelope } from "./mq-lowering.js";

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
});
