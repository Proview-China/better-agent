import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import type {
  CmpCriticalEscalationEnvelope,
  CmpRedisDeliveryTruthRecord,
  CmpIcmaPublishEnvelope,
  CmpRedisEscalationReceipt,
  CmpRedisProjectBootstrap,
  CmpRedisPublishReceipt,
  CmpRedisTopicBinding,
} from "./cmp-mq-types.js";
import {
  validateCmpCriticalEscalationEnvelope,
  validateCmpIcmaPublishEnvelope,
  validateCmpRedisDeliveryTruthRecord,
  validateCmpRedisEscalationReceipt,
  validateCmpRedisProjectBootstrap,
  validateCmpRedisPublishReceipt,
} from "./cmp-mq-types.js";
import {
  type BootstrapCmpRedisProjectInput,
  type CmpRedisMqAdapter,
  type PublishCmpRedisCriticalEscalationInput,
  type PublishCmpRedisEnvelopeInput,
} from "./redis-adapter.js";
import { createCmpRedisProjectBootstrap, getCmpRedisBindingForChannel } from "./redis-bootstrap.js";
import { resolveCmpRedisLaneForChannel } from "./redis-routing.js";

const execFileAsync = promisify(execFile);

export interface RedisCliCmpRedisMqAdapterOptions {
  binaryPath?: string;
  host?: string;
  port?: number;
  url?: string;
  database?: number;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function createBootstrapKey(bootstrap: Pick<CmpRedisProjectBootstrap, "namespace" | "agentId">): string {
  return `${bootstrap.namespace.keyPrefix}:bootstrap:${bootstrap.agentId}`;
}

function createDeliveryTruthKey(input: {
  bootstrap: Pick<CmpRedisProjectBootstrap, "namespace">;
  receiptId: string;
}): string {
  return `${input.bootstrap.namespace.keyPrefix}:delivery:${input.receiptId.trim()}`;
}

function envelopeDirectionToChannel(
  direction: CmpIcmaPublishEnvelope["direction"],
): CmpRedisTopicBinding["channel"] {
  switch (direction) {
    case "parent":
      return "to_parent";
    case "peer":
      return "peer";
    case "child":
      return "to_children";
  }
}

function createPublishPayload(input: {
  envelope: CmpIcmaPublishEnvelope;
  binding: CmpRedisTopicBinding;
}): string {
  return JSON.stringify({
    envelopeId: input.envelope.envelopeId,
    projectId: input.envelope.projectId,
    sourceAgentId: input.envelope.sourceAgentId,
    direction: input.envelope.direction,
    channel: input.binding.channel,
    lane: input.binding.lane,
    targetAgentIds: input.envelope.targetAgentIds,
    granularityLabel: input.envelope.granularityLabel,
    payloadRef: input.envelope.payloadRef,
    createdAt: input.envelope.createdAt,
    metadata: input.envelope.metadata,
  });
}

function createEscalationPayload(envelope: CmpCriticalEscalationEnvelope): string {
  return JSON.stringify({
    escalationId: envelope.escalationId,
    projectId: envelope.projectId,
    sourceAgentId: envelope.sourceAgentId,
    targetAncestorId: envelope.targetAncestorId,
    severity: envelope.severity,
    reason: envelope.reason,
    evidenceRef: envelope.evidenceRef,
    createdAt: envelope.createdAt,
    deliveryMode: envelope.deliveryMode,
    redactionLevel: envelope.redactionLevel,
    metadata: envelope.metadata,
  });
}

export class RedisCliCmpRedisMqAdapter implements CmpRedisMqAdapter {
  readonly #binaryPath: string;
  readonly #host?: string;
  readonly #port?: number;
  readonly #url?: string;
  readonly #database?: number;

  constructor(options: RedisCliCmpRedisMqAdapterOptions = {}) {
    this.#binaryPath = options.binaryPath?.trim() || "redis-cli";
    this.#host = options.host;
    this.#port = options.port;
    this.#url = options.url;
    this.#database = options.database;
  }

  async bootstrapProject(input: BootstrapCmpRedisProjectInput): Promise<CmpRedisProjectBootstrap> {
    const bootstrap = createCmpRedisProjectBootstrap(input);
    await this.#runRedisCommand([
      "SET",
      createBootstrapKey(bootstrap),
      JSON.stringify(bootstrap),
    ]);
    return bootstrap;
  }

  async readProjectBootstrap(params: {
    projectId: string;
    agentId: string;
  }): Promise<CmpRedisProjectBootstrap | undefined> {
    const bootstrap = createCmpRedisProjectBootstrap({
      projectId: params.projectId,
      agentId: params.agentId,
    });
    const raw = await this.#runRedisCommand([
      "--raw",
      "GET",
      createBootstrapKey(bootstrap),
    ], {
      allowEmptyStdout: true,
    });
    if (!raw.stdout.trim()) {
      return undefined;
    }
    const parsed = JSON.parse(raw.stdout) as CmpRedisProjectBootstrap;
    validateCmpRedisProjectBootstrap(parsed);
    return parsed;
  }

  async readDeliveryTruth(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
  }): Promise<CmpRedisDeliveryTruthRecord | undefined> {
    const bootstrap = createCmpRedisProjectBootstrap({
      projectId: params.projectId,
      agentId: params.sourceAgentId,
    });
    const raw = await this.#runRedisCommand([
      "--raw",
      "GET",
      createDeliveryTruthKey({
        bootstrap,
        receiptId: params.receiptId,
      }),
    ], {
      allowEmptyStdout: true,
    });
    if (!raw.stdout.trim()) {
      return undefined;
    }
    const parsed = JSON.parse(raw.stdout) as CmpRedisDeliveryTruthRecord;
    validateCmpRedisDeliveryTruthRecord(parsed);
    return parsed;
  }

  async publishEnvelope(input: PublishCmpRedisEnvelopeInput): Promise<CmpRedisPublishReceipt> {
    validateCmpIcmaPublishEnvelope(input.envelope);
    const bootstrap = await this.#requireBootstrap({
      projectId: input.envelope.projectId,
      agentId: input.envelope.sourceAgentId,
    });
    const channel = envelopeDirectionToChannel(input.envelope.direction);
    const binding = getCmpRedisBindingForChannel({
      bootstrap,
      channel,
    });
    if (!binding) {
      throw new Error(`CMP Redis binding for ${input.envelope.sourceAgentId} channel ${channel} was not found.`);
    }

    const payload = createPublishPayload({
      envelope: input.envelope,
      binding,
    });

    if (binding.lane === "stream") {
      await this.#runRedisCommand([
        "XADD",
        binding.redisKey,
        "*",
        "payload",
        payload,
      ]);
    } else if (binding.lane === "pubsub") {
      await this.#runRedisCommand([
        "PUBLISH",
        binding.redisKey,
        payload,
      ]);
    } else {
      await this.#runRedisCommand([
        "RPUSH",
        binding.redisKey,
        payload,
      ]);
    }

    const receipt: CmpRedisPublishReceipt = {
      receiptId: randomUUID(),
      projectId: input.envelope.projectId,
      sourceAgentId: input.envelope.sourceAgentId,
      channel: binding.channel,
      lane: binding.lane,
      redisKey: binding.redisKey,
      targetCount: input.envelope.targetAgentIds.length,
      publishedAt: input.envelope.createdAt,
      metadata: {
        envelopeId: input.envelope.envelopeId,
        granularityLabel: input.envelope.granularityLabel,
        payloadRef: input.envelope.payloadRef,
        ...(input.envelope.metadata ?? {}),
      },
    };
    validateCmpRedisPublishReceipt(receipt);
    const truth: CmpRedisDeliveryTruthRecord = {
      receiptId: receipt.receiptId,
      projectId: receipt.projectId,
      sourceAgentId: receipt.sourceAgentId,
      channel: receipt.channel,
      lane: receipt.lane,
      redisKey: receipt.redisKey,
      targetCount: receipt.targetCount,
      state: "published",
      publishedAt: receipt.publishedAt,
      metadata: {
        ...(receipt.metadata ?? {}),
      },
    };
    validateCmpRedisDeliveryTruthRecord(truth);
    await this.#runRedisCommand([
      "SET",
      createDeliveryTruthKey({
        bootstrap,
        receiptId: receipt.receiptId,
      }),
      JSON.stringify(truth),
    ]);
    return receipt;
  }

  async acknowledgeDelivery(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
    acknowledgedAt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CmpRedisDeliveryTruthRecord> {
    const existing = await this.readDeliveryTruth(params);
    if (!existing) {
      throw new Error(`CMP Redis delivery truth ${params.projectId}/${params.sourceAgentId}/${params.receiptId} was not found.`);
    }
    const bootstrap = createCmpRedisProjectBootstrap({
      projectId: params.projectId,
      agentId: params.sourceAgentId,
    });
    const next: CmpRedisDeliveryTruthRecord = {
      ...existing,
      state: "acknowledged",
      acknowledgedAt: params.acknowledgedAt ?? new Date().toISOString(),
      metadata: {
        ...(existing.metadata ?? {}),
        ...(params.metadata ?? {}),
      },
    };
    validateCmpRedisDeliveryTruthRecord(next);
    await this.#runRedisCommand([
      "SET",
      createDeliveryTruthKey({
        bootstrap,
        receiptId: params.receiptId,
      }),
      JSON.stringify(next),
    ]);
    return next;
  }

  async publishCriticalEscalation(
    input: PublishCmpRedisCriticalEscalationInput,
  ): Promise<CmpRedisEscalationReceipt> {
    validateCmpCriticalEscalationEnvelope(input.envelope);
    const bootstrap = await this.#requireBootstrap({
      projectId: input.envelope.projectId,
      agentId: input.envelope.sourceAgentId,
    });
    const binding = getCmpRedisBindingForChannel({
      bootstrap,
      channel: "critical_escalation",
    });
    if (!binding) {
      throw new Error(`CMP Redis critical escalation binding for ${input.envelope.sourceAgentId} was not found.`);
    }

    await this.#runRedisCommand([
      "RPUSH",
      binding.redisKey,
      createEscalationPayload(input.envelope),
    ]);

    const receipt: CmpRedisEscalationReceipt = {
      receiptId: randomUUID(),
      projectId: input.envelope.projectId,
      sourceAgentId: input.envelope.sourceAgentId,
      targetAncestorId: input.envelope.targetAncestorId,
      lane: "queue",
      redisKey: binding.redisKey,
      publishedAt: input.envelope.createdAt,
      metadata: {
        escalationId: input.envelope.escalationId,
        severity: input.envelope.severity,
        reason: input.envelope.reason,
        evidenceRef: input.envelope.evidenceRef,
        ...(input.envelope.metadata ?? {}),
      },
    };
    validateCmpRedisEscalationReceipt(receipt);
    return receipt;
  }

  async ping(): Promise<"PONG"> {
    const result = await this.#runRedisCommand(["PING"]);
    return assertNonEmpty(result.stdout, "CMP Redis PING stdout") as "PONG";
  }

  async #requireBootstrap(params: {
    projectId: string;
    agentId: string;
  }): Promise<CmpRedisProjectBootstrap> {
    const bootstrap = await this.readProjectBootstrap(params);
    if (!bootstrap) {
      throw new Error(`CMP Redis bootstrap ${params.projectId}/${params.agentId} was not found.`);
    }
    return bootstrap;
  }

  async #runRedisCommand(
    args: string[],
    options: { allowEmptyStdout?: boolean } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const cliArgs = [
      ...this.#baseArgs(),
      ...args,
    ];
    const { stdout, stderr } = await execFileAsync(this.#binaryPath, cliArgs, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (!options.allowEmptyStdout && !stdout.trim()) {
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    }
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  }

  #baseArgs(): string[] {
    const args: string[] = [];
    if (this.#url) {
      args.push("-u", this.#url);
    } else {
      if (this.#host) {
        args.push("-h", this.#host);
      }
      if (this.#port !== undefined) {
        args.push("-p", String(this.#port));
      }
    }
    if (this.#database !== undefined) {
      args.push("-n", String(this.#database));
    }
    return args;
  }
}

export function createRedisCliCmpRedisMqAdapter(
  options: RedisCliCmpRedisMqAdapterOptions = {},
): RedisCliCmpRedisMqAdapter {
  return new RedisCliCmpRedisMqAdapter(options);
}
