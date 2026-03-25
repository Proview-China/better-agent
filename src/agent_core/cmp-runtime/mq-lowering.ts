import { randomUUID } from "node:crypto";

import type {
  CmpAgentNeighborhood,
  CmpIcmaPublishEnvelope,
  CmpRedisMqAdapter,
  CmpRedisPublishReceipt,
} from "../cmp-mq/index.js";
import { createCmpIcmaPublishEnvelope } from "../cmp-mq/index.js";
import { assertCmpValidatedNeighborhoodPublishPlan } from "../cmp-mq/integration-hooks.js";
import type { CmpContextPackageRecord } from "./materialization.js";

export interface CreateCmpMqDispatchEnvelopeInput {
  projectId: string;
  sourceAgentId: string;
  targetAgentId: string;
  direction: "parent" | "peer" | "child";
  contextPackage: Pick<CmpContextPackageRecord, "packageId" | "packageRef" | "packageKind">;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createCmpMqDispatchEnvelope(
  input: CreateCmpMqDispatchEnvelopeInput,
): CmpIcmaPublishEnvelope {
  const targetAgentId = assertNonEmpty(input.targetAgentId, "CMP MQ dispatch targetAgentId");
  return createCmpIcmaPublishEnvelope({
    envelopeId: randomUUID(),
    projectId: assertNonEmpty(input.projectId, "CMP MQ dispatch projectId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP MQ dispatch sourceAgentId"),
    neighborhood: {
      agentId: assertNonEmpty(input.sourceAgentId, "CMP MQ dispatch sourceAgentId"),
      parentAgentId: input.direction === "parent" ? targetAgentId : undefined,
      peerAgentIds: input.direction === "peer" ? [targetAgentId] : [],
      childAgentIds: input.direction === "child" ? [targetAgentId] : [],
    },
    direction: input.direction,
    granularityLabel: input.contextPackage.packageKind,
    payloadRef: input.contextPackage.packageRef,
    createdAt: assertNonEmpty(input.createdAt, "CMP MQ dispatch createdAt"),
    metadata: {
      packageId: input.contextPackage.packageId,
      ...(input.metadata ?? {}),
    },
  });
}

export async function executeCmpMqDispatchLowering(input: {
  adapter: CmpRedisMqAdapter;
  neighborhood: CmpAgentNeighborhood;
  envelope: CmpIcmaPublishEnvelope;
  knownAncestorIds?: readonly string[];
  parentPeerIds?: readonly string[];
}): Promise<{
  validatedSubscriptions: ReturnType<typeof assertCmpValidatedNeighborhoodPublishPlan>;
  publishReceipt: CmpRedisPublishReceipt;
}> {
  const validatedSubscriptions = assertCmpValidatedNeighborhoodPublishPlan({
    neighborhood: input.neighborhood,
    envelope: input.envelope,
    knownAncestorIds: input.knownAncestorIds,
    parentPeerIds: input.parentPeerIds,
  });
  const publishReceipt = await input.adapter.publishEnvelope({
    envelope: input.envelope,
  });
  return {
    validatedSubscriptions,
    publishReceipt,
  };
}
