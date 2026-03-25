import { randomUUID } from "node:crypto";

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
  validateCmpRedisPublishReceipt,
} from "./cmp-mq-types.js";
import { createCmpRedisProjectBootstrap, getCmpRedisBindingForChannel } from "./redis-bootstrap.js";
import { resolveCmpRedisLaneForChannel } from "./redis-routing.js";

export interface BootstrapCmpRedisProjectInput {
  projectId: string;
  agentId: string;
  namespaceRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishCmpRedisEnvelopeInput {
  envelope: CmpIcmaPublishEnvelope;
}

export interface PublishCmpRedisCriticalEscalationInput {
  envelope: CmpCriticalEscalationEnvelope;
}

export interface CmpRedisMqAdapter {
  bootstrapProject(input: BootstrapCmpRedisProjectInput): Promise<CmpRedisProjectBootstrap> | CmpRedisProjectBootstrap;
  readProjectBootstrap(params: {
    projectId: string;
    agentId: string;
  }): Promise<CmpRedisProjectBootstrap | undefined> | CmpRedisProjectBootstrap | undefined;
  readDeliveryTruth?(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
  }): Promise<CmpRedisDeliveryTruthRecord | undefined> | CmpRedisDeliveryTruthRecord | undefined;
  publishEnvelope(input: PublishCmpRedisEnvelopeInput): Promise<CmpRedisPublishReceipt> | CmpRedisPublishReceipt;
  acknowledgeDelivery?(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
    acknowledgedAt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CmpRedisDeliveryTruthRecord> | CmpRedisDeliveryTruthRecord;
  publishCriticalEscalation(
    input: PublishCmpRedisCriticalEscalationInput,
  ): Promise<CmpRedisEscalationReceipt> | CmpRedisEscalationReceipt;
}

export class InMemoryCmpRedisMqAdapter implements CmpRedisMqAdapter {
  readonly #bootstraps = new Map<string, CmpRedisProjectBootstrap>();
  readonly #deliveryTruth = new Map<string, CmpRedisDeliveryTruthRecord>();

  bootstrapProject(input: BootstrapCmpRedisProjectInput): CmpRedisProjectBootstrap {
    const bootstrap = createCmpRedisProjectBootstrap(input);
    this.#bootstraps.set(this.#toBootstrapKey(input.projectId, input.agentId), bootstrap);
    return bootstrap;
  }

  readProjectBootstrap(params: {
    projectId: string;
    agentId: string;
  }): CmpRedisProjectBootstrap | undefined {
    return this.#bootstraps.get(this.#toBootstrapKey(params.projectId, params.agentId));
  }

  readDeliveryTruth(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
  }): CmpRedisDeliveryTruthRecord | undefined {
    return this.#deliveryTruth.get(this.#toDeliveryTruthKey(
      params.projectId,
      params.sourceAgentId,
      params.receiptId,
    ));
  }

  publishEnvelope(input: PublishCmpRedisEnvelopeInput): CmpRedisPublishReceipt {
    validateCmpIcmaPublishEnvelope(input.envelope);
    const bootstrap = this.#requireBootstrap({
      projectId: input.envelope.projectId,
      agentId: input.envelope.sourceAgentId,
    });
    const binding = getCmpRedisBindingForChannel({
      bootstrap,
      channel: this.#directionToChannel(input.envelope.direction),
    });
    if (!binding) {
      throw new Error(
        `CMP Redis binding for ${input.envelope.sourceAgentId} channel ${this.#directionToChannel(input.envelope.direction)} was not found.`,
      );
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
    this.#deliveryTruth.set(
      this.#toDeliveryTruthKey(receipt.projectId, receipt.sourceAgentId, receipt.receiptId),
      truth,
    );
    return receipt;
  }

  acknowledgeDelivery(params: {
    projectId: string;
    sourceAgentId: string;
    receiptId: string;
    acknowledgedAt?: string;
    metadata?: Record<string, unknown>;
  }): CmpRedisDeliveryTruthRecord {
    const key = this.#toDeliveryTruthKey(params.projectId, params.sourceAgentId, params.receiptId);
    const existing = this.#deliveryTruth.get(key);
    if (!existing) {
      throw new Error(`CMP Redis delivery truth ${params.projectId}/${params.sourceAgentId}/${params.receiptId} was not found.`);
    }
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
    this.#deliveryTruth.set(key, next);
    return next;
  }

  publishCriticalEscalation(
    input: PublishCmpRedisCriticalEscalationInput,
  ): CmpRedisEscalationReceipt {
    validateCmpCriticalEscalationEnvelope(input.envelope);
    const bootstrap = this.#requireBootstrap({
      projectId: input.envelope.projectId,
      agentId: input.envelope.sourceAgentId,
    });
    const binding = getCmpRedisBindingForChannel({
      bootstrap,
      channel: "critical_escalation",
    });
    if (!binding) {
      throw new Error(
        `CMP Redis critical escalation binding for ${input.envelope.sourceAgentId} was not found.`,
      );
    }

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

  #toBootstrapKey(projectId: string, agentId: string): string {
    return `${projectId.trim()}::${agentId.trim()}`;
  }

  #toDeliveryTruthKey(projectId: string, sourceAgentId: string, receiptId: string): string {
    return `${projectId.trim()}::${sourceAgentId.trim()}::${receiptId.trim()}`;
  }

  #requireBootstrap(params: {
    projectId: string;
    agentId: string;
  }): CmpRedisProjectBootstrap {
    const bootstrap = this.readProjectBootstrap(params);
    if (!bootstrap) {
      throw new Error(`CMP Redis bootstrap ${params.projectId}/${params.agentId} was not found.`);
    }
    return bootstrap;
  }

  #directionToChannel(direction: CmpIcmaPublishEnvelope["direction"]): CmpRedisTopicBinding["channel"] {
    switch (direction) {
      case "parent":
        return "to_parent";
      case "peer":
        return "peer";
      case "child":
        return "to_children";
    }
  }
}

export function createInMemoryCmpRedisMqAdapter(): InMemoryCmpRedisMqAdapter {
  return new InMemoryCmpRedisMqAdapter();
}

export function assertCmpRedisCriticalEscalationUsesQueueLane(
  receipt: Pick<CmpRedisEscalationReceipt, "lane">,
): void {
  if (receipt.lane !== resolveCmpRedisLaneForChannel("critical_escalation")) {
    throw new Error("CMP Redis critical escalation must stay on queue lane.");
  }
}
