import { randomUUID } from "node:crypto";

import type {
  CmpCriticalEscalationEnvelope,
  CmpIcmaPublishEnvelope,
  CmpRedisEscalationReceipt,
  CmpRedisProjectBootstrap,
  CmpRedisPublishReceipt,
  CmpRedisTopicBinding,
} from "./cmp-mq-types.js";
import {
  validateCmpCriticalEscalationEnvelope,
  validateCmpIcmaPublishEnvelope,
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
  publishEnvelope(input: PublishCmpRedisEnvelopeInput): Promise<CmpRedisPublishReceipt> | CmpRedisPublishReceipt;
  publishCriticalEscalation(
    input: PublishCmpRedisCriticalEscalationInput,
  ): Promise<CmpRedisEscalationReceipt> | CmpRedisEscalationReceipt;
}

export class InMemoryCmpRedisMqAdapter implements CmpRedisMqAdapter {
  readonly #bootstraps = new Map<string, CmpRedisProjectBootstrap>();

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
    return receipt;
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
