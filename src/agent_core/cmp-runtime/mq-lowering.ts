import { randomUUID } from "node:crypto";

import type {
  CmpAgentNeighborhood,
  CmpMqDeliveryProjectionPatch,
  CmpMqDeliveryStateRecord,
  CmpMqExpiryPolicy,
  CmpMqRetryPolicy,
  CmpRedisDeliveryTruthRecord,
  CmpIcmaPublishEnvelope,
  CmpRedisMqAdapter,
  CmpRedisPublishReceipt,
} from "../cmp-mq/index.js";
import { createCmpIcmaPublishEnvelope } from "../cmp-mq/index.js";
import { assertCmpValidatedNeighborhoodPublishPlan } from "../cmp-mq/integration-hooks.js";
import type { CmpContextPackageRecord } from "./materialization.js";
import {
  acknowledgeCmpMqDeliveryState,
  createCmpMqDeliveryProjectionPatch,
  createCmpMqDeliveryStateFromDeliveryTruth,
  createCmpMqDeliveryStateFromPublish,
  reconcileCmpMqDeliveryStateWithTruth,
} from "./mq-delivery-state.js";

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
  deliveryTruth: CmpRedisDeliveryTruthRecord | undefined;
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
  const deliveryTruth = input.adapter.readDeliveryTruth
    ? await input.adapter.readDeliveryTruth({
      projectId: input.envelope.projectId,
      sourceAgentId: input.envelope.sourceAgentId,
      receiptId: publishReceipt.receiptId,
    })
    : undefined;
  return {
    validatedSubscriptions,
    publishReceipt,
    deliveryTruth,
  };
}

export async function executeCmpMqDispatchStateLowering(input: {
  adapter: CmpRedisMqAdapter;
  neighborhood: CmpAgentNeighborhood;
  envelope: CmpIcmaPublishEnvelope;
  dispatchId: string;
  packageId: string;
  targetAgentId: string;
  retryPolicy?: CmpMqRetryPolicy;
  expiryPolicy?: CmpMqExpiryPolicy;
  metadata?: Record<string, unknown>;
  knownAncestorIds?: readonly string[];
  parentPeerIds?: readonly string[];
}): Promise<{
  validatedSubscriptions: ReturnType<typeof assertCmpValidatedNeighborhoodPublishPlan>;
  publishReceipt: CmpRedisPublishReceipt;
  deliveryTruth: CmpRedisDeliveryTruthRecord | undefined;
  deliveryState: CmpMqDeliveryStateRecord;
  projectionPatch: CmpMqDeliveryProjectionPatch;
}> {
  const lowered = await executeCmpMqDispatchLowering(input);
  const deliveryState = lowered.deliveryTruth
    ? createCmpMqDeliveryStateFromDeliveryTruth({
      truth: lowered.deliveryTruth,
      dispatchId: input.dispatchId,
      packageId: input.packageId,
      targetAgentId: input.targetAgentId,
      retryPolicy: input.retryPolicy,
      expiryPolicy: input.expiryPolicy,
      metadata: input.metadata,
    })
    : createCmpMqDeliveryStateFromPublish({
      receipt: lowered.publishReceipt,
      dispatchId: input.dispatchId,
      packageId: input.packageId,
      targetAgentId: input.targetAgentId,
      retryPolicy: input.retryPolicy,
      expiryPolicy: input.expiryPolicy,
      metadata: input.metadata,
    });
  return {
    ...lowered,
    deliveryState,
    projectionPatch: createCmpMqDeliveryProjectionPatch(deliveryState),
  };
}

export async function executeCmpMqAckLowering(input: {
  adapter: CmpRedisMqAdapter;
  projectId: string;
  sourceAgentId: string;
  receiptId: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<CmpRedisDeliveryTruthRecord> {
  if (!input.adapter.acknowledgeDelivery) {
    throw new Error("CMP Redis adapter does not support acknowledgeDelivery yet.");
  }
  return input.adapter.acknowledgeDelivery({
    projectId: input.projectId,
    sourceAgentId: input.sourceAgentId,
    receiptId: input.receiptId,
    acknowledgedAt: input.acknowledgedAt,
    metadata: input.metadata,
  });
}

export async function executeCmpMqAckStateLowering(input: {
  adapter: CmpRedisMqAdapter;
  projectId: string;
  sourceAgentId: string;
  receiptId: string;
  deliveryState: CmpMqDeliveryStateRecord;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  deliveryTruth: CmpRedisDeliveryTruthRecord;
  deliveryState: CmpMqDeliveryStateRecord;
  projectionPatch: CmpMqDeliveryProjectionPatch;
}> {
  const deliveryTruth = await executeCmpMqAckLowering(input);
  const acknowledgedState = input.deliveryState.status === "published"
    ? acknowledgeCmpMqDeliveryState({
      state: input.deliveryState,
      acknowledgedAt: deliveryTruth.acknowledgedAt ?? input.acknowledgedAt ?? new Date().toISOString(),
      metadata: input.metadata,
    })
    : input.deliveryState;
  const deliveryState = reconcileCmpMqDeliveryStateWithTruth({
    state: acknowledgedState,
    truth: deliveryTruth,
    metadata: input.metadata,
  });
  return {
    deliveryTruth,
    deliveryState,
    projectionPatch: createCmpMqDeliveryProjectionPatch(deliveryState),
  };
}
