import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";

import {
  createCmpCriticalEscalationEnvelope,
  createCmpIcmaPublishEnvelope,
} from "./index.js";
import { createRedisCliCmpRedisMqAdapter } from "./redis-cli-adapter.js";

const execFileAsync = promisify(execFile);

async function canUseRedisCli(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("redis-cli", ["PING"], { encoding: "utf8" });
    return stdout.trim() === "PONG";
  } catch {
    return false;
  }
}

async function runRedisCli(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("redis-cli", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

test("cmp-mq redis-cli adapter can bootstrap and read project bootstrap from live redis", async (t) => {
  if (!(await canUseRedisCli())) {
    t.skip("redis-cli or local Redis is not available.");
    return;
  }

  const projectId = `cmp-live-${randomUUID()}`;
  const agentId = "agent-main";
  const adapter = createRedisCliCmpRedisMqAdapter();
  const bootstrap = await adapter.bootstrapProject({
    projectId,
    agentId,
  });

  const readback = await adapter.readProjectBootstrap({
    projectId,
    agentId,
  });

  assert.equal(readback?.projectId, projectId);
  assert.equal(readback?.agentId, agentId);
  assert.equal(readback?.topicBindings.length, bootstrap.topicBindings.length);
  await runRedisCli(["DEL", `${bootstrap.namespace.keyPrefix}:bootstrap:${agentId}`]);
});

test("cmp-mq redis-cli adapter writes stream publish and queue escalation to live redis", async (t) => {
  if (!(await canUseRedisCli())) {
    t.skip("redis-cli or local Redis is not available.");
    return;
  }

  const projectId = `cmp-live-${randomUUID()}`;
  const agentId = "agent-main";
  const adapter = createRedisCliCmpRedisMqAdapter();
  const bootstrap = await adapter.bootstrapProject({
    projectId,
    agentId,
  });

  const publishReceipt = await adapter.publishEnvelope({
    envelope: createCmpIcmaPublishEnvelope({
      envelopeId: "env-parent",
      projectId,
      sourceAgentId: agentId,
      neighborhood: {
        agentId,
        parentAgentId: "agent-parent",
        peerAgentIds: ["agent-peer"],
        childAgentIds: ["agent-child"],
      },
      direction: "parent",
      granularityLabel: "checked-delta",
      payloadRef: "git:cmp/agent-main@abc123",
      createdAt: "2026-03-24T20:00:00.000Z",
    }),
  });

  assert.equal(publishReceipt.lane, "stream");
  const streamLength = await runRedisCli(["XLEN", publishReceipt.redisKey]);
  assert.equal(streamLength, "1");

  const truth = await adapter.readDeliveryTruth({
    projectId,
    sourceAgentId: agentId,
    receiptId: publishReceipt.receiptId,
  });
  assert.equal(truth?.state, "published");

  const acknowledged = await adapter.acknowledgeDelivery({
    projectId,
    sourceAgentId: agentId,
    receiptId: publishReceipt.receiptId,
    acknowledgedAt: "2026-03-24T20:01:00.000Z",
  });
  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.acknowledgedAt, "2026-03-24T20:01:00.000Z");

  const escalationReceipt = await adapter.publishCriticalEscalation({
    envelope: createCmpCriticalEscalationEnvelope({
      escalationId: "esc-1",
      projectId,
      sourceAgentId: agentId,
      targetAncestorId: "agent-root",
      severity: "critical",
      reason: "direct parent is unavailable",
      evidenceRef: "cmp-alert:esc-1",
      createdAt: "2026-03-24T20:05:00.000Z",
    }),
  });

  assert.equal(escalationReceipt.lane, "queue");
  const queueLength = await runRedisCli(["LLEN", escalationReceipt.redisKey]);
  assert.equal(queueLength, "1");

  await runRedisCli([
    "DEL",
    publishReceipt.redisKey,
    escalationReceipt.redisKey,
    `${bootstrap.namespace.keyPrefix}:bootstrap:${agentId}`,
    `${bootstrap.namespace.keyPrefix}:delivery:${publishReceipt.receiptId}`,
  ]);
});
