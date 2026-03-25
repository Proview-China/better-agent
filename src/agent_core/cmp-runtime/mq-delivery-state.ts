import type {
  CmpMqDeliveryProjectionPatch,
  CmpMqDeliveryStateRecord,
  CmpMqExpiryPolicy,
  CmpMqRetryPolicy,
  CmpRedisDeliveryTruthRecord,
  CmpRedisPublishReceipt,
} from "../cmp-mq/index.js";
import {
  validateCmpMqDeliveryProjectionPatch,
  validateCmpMqDeliveryStateRecord,
  validateCmpMqExpiryPolicy,
  validateCmpMqRetryPolicy,
  validateCmpRedisDeliveryTruthRecord,
} from "../cmp-mq/index.js";

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function addMs(isoTime: string, deltaMs: number): string {
  return new Date(new Date(isoTime).getTime() + deltaMs).toISOString();
}

function resolveRetryPolicyFromMetadata(input: {
  retryPolicy?: CmpMqRetryPolicy;
  metadata?: Record<string, unknown>;
}): CmpMqRetryPolicy {
  const maxAttempts = Number(input.metadata?.maxAttempts);
  const backoffMs = Number(input.metadata?.retryBackoffMs);
  return input.retryPolicy ?? {
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3,
    backoffMs: Number.isInteger(backoffMs) && backoffMs >= 0 ? backoffMs : 30_000,
  };
}

function resolveExpiryPolicyFromMetadata(input: {
  expiryPolicy?: CmpMqExpiryPolicy;
  metadata?: Record<string, unknown>;
}): CmpMqExpiryPolicy {
  const ackTimeoutMs = Number(input.metadata?.ackTimeoutMs);
  return input.expiryPolicy ?? {
    ackTimeoutMs: Number.isInteger(ackTimeoutMs) && ackTimeoutMs > 0 ? ackTimeoutMs : 60_000,
  };
}

export function createCmpMqDeliveryStateFromPublish(input: {
  receipt: CmpRedisPublishReceipt;
  dispatchId: string;
  packageId: string;
  targetAgentId: string;
  retryPolicy?: CmpMqRetryPolicy;
  expiryPolicy?: CmpMqExpiryPolicy;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  const retryPolicy = input.retryPolicy ?? {
    maxAttempts: 3,
    backoffMs: 30_000,
  };
  const expiryPolicy = input.expiryPolicy ?? {
    ackTimeoutMs: 60_000,
  };
  validateCmpMqRetryPolicy(retryPolicy);
  validateCmpMqExpiryPolicy(expiryPolicy);

  const record: CmpMqDeliveryStateRecord = {
    deliveryId: assertNonEmpty(input.dispatchId, "CMP MQ delivery state deliveryId"),
    dispatchId: assertNonEmpty(input.dispatchId, "CMP MQ delivery state dispatchId"),
    packageId: assertNonEmpty(input.packageId, "CMP MQ delivery state packageId"),
    projectId: input.receipt.projectId,
    sourceAgentId: input.receipt.sourceAgentId,
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP MQ delivery state targetAgentId"),
    redisKey: input.receipt.redisKey,
    lane: input.receipt.lane,
    status: "published",
    currentAttempt: 1,
    maxAttempts: retryPolicy.maxAttempts,
    publishedAt: input.receipt.publishedAt,
    ackDeadlineAt: addMs(input.receipt.publishedAt, expiryPolicy.ackTimeoutMs),
    metadata: {
      receiptId: input.receipt.receiptId,
      channel: input.receipt.channel,
      targetCount: input.receipt.targetCount,
      retryBackoffMs: retryPolicy.backoffMs,
      ackTimeoutMs: expiryPolicy.ackTimeoutMs,
      ...(input.metadata ?? {}),
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function createCmpMqDeliveryStateFromDeliveryTruth(input: {
  truth: CmpRedisDeliveryTruthRecord;
  dispatchId: string;
  packageId: string;
  targetAgentId: string;
  retryPolicy?: CmpMqRetryPolicy;
  expiryPolicy?: CmpMqExpiryPolicy;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  validateCmpRedisDeliveryTruthRecord(input.truth);
  const retryPolicy = resolveRetryPolicyFromMetadata({
    retryPolicy: input.retryPolicy,
    metadata: input.truth.metadata,
  });
  const expiryPolicy = resolveExpiryPolicyFromMetadata({
    expiryPolicy: input.expiryPolicy,
    metadata: input.truth.metadata,
  });
  validateCmpMqRetryPolicy(retryPolicy);
  validateCmpMqExpiryPolicy(expiryPolicy);

  const metadata = {
    ...(input.truth.metadata ?? {}),
    ...(input.metadata ?? {}),
  };
  const record: CmpMqDeliveryStateRecord = {
    deliveryId: assertNonEmpty(input.dispatchId, "CMP MQ delivery truth deliveryId"),
    dispatchId: assertNonEmpty(input.dispatchId, "CMP MQ delivery truth dispatchId"),
    packageId: assertNonEmpty(input.packageId, "CMP MQ delivery truth packageId"),
    projectId: input.truth.projectId,
    sourceAgentId: input.truth.sourceAgentId,
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP MQ delivery truth targetAgentId"),
    redisKey: input.truth.redisKey,
    lane: input.truth.lane,
    status: input.truth.state === "published"
      ? "published"
      : input.truth.state === "acknowledged"
        ? "acknowledged"
        : "expired",
    currentAttempt: Number.isInteger(metadata.currentAttempt) && Number(metadata.currentAttempt) > 0
      ? Number(metadata.currentAttempt)
      : 1,
    maxAttempts: retryPolicy.maxAttempts,
    publishedAt: input.truth.publishedAt,
    ackDeadlineAt: input.truth.expiresAt ?? addMs(input.truth.publishedAt, expiryPolicy.ackTimeoutMs),
    acknowledgedAt: input.truth.acknowledgedAt,
    metadata: {
      receiptId: input.truth.receiptId,
      channel: input.truth.channel,
      targetCount: input.truth.targetCount,
      retryBackoffMs: retryPolicy.backoffMs,
      ackTimeoutMs: expiryPolicy.ackTimeoutMs,
      ...metadata,
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function reconcileCmpMqDeliveryStateWithTruth(input: {
  state: CmpMqDeliveryStateRecord;
  truth: CmpRedisDeliveryTruthRecord;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  validateCmpMqDeliveryStateRecord(input.state);
  validateCmpRedisDeliveryTruthRecord(input.truth);
  if (input.state.projectId !== input.truth.projectId || input.state.sourceAgentId !== input.truth.sourceAgentId) {
    throw new Error("CMP MQ delivery truth must match state project/source before reconciliation.");
  }

  const record: CmpMqDeliveryStateRecord = {
    ...input.state,
    redisKey: input.truth.redisKey,
    lane: input.truth.lane,
    status: input.truth.state === "published"
      ? "published"
      : input.truth.state === "acknowledged"
        ? "acknowledged"
        : "expired",
    acknowledgedAt: input.truth.acknowledgedAt ?? input.state.acknowledgedAt,
    ackDeadlineAt: input.truth.expiresAt ?? input.state.ackDeadlineAt,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...(input.truth.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function acknowledgeCmpMqDeliveryState(input: {
  state: CmpMqDeliveryStateRecord;
  acknowledgedAt: string;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  validateCmpMqDeliveryStateRecord(input.state);
  if (input.state.status !== "published") {
    throw new Error(`CMP MQ delivery state can only acknowledge published records, got ${input.state.status}.`);
  }

  const record: CmpMqDeliveryStateRecord = {
    ...input.state,
    status: "acknowledged",
    acknowledgedAt: assertNonEmpty(input.acknowledgedAt, "CMP MQ delivery state acknowledgedAt"),
    metadata: {
      ...(input.state.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function scheduleCmpMqDeliveryRetry(input: {
  state: CmpMqDeliveryStateRecord;
  retryPolicy?: CmpMqRetryPolicy;
  retriedAt: string;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  validateCmpMqDeliveryStateRecord(input.state);
  if (input.state.status !== "published") {
    throw new Error(`CMP MQ delivery retry can only be scheduled from published state, got ${input.state.status}.`);
  }
  const retryPolicy = input.retryPolicy ?? {
    maxAttempts: input.state.maxAttempts,
    backoffMs: Number(input.state.metadata?.retryBackoffMs ?? 30_000),
  };
  validateCmpMqRetryPolicy(retryPolicy);

  if (input.state.currentAttempt >= retryPolicy.maxAttempts) {
    throw new Error("CMP MQ delivery retry cannot exceed maxAttempts.");
  }

  const retriedAt = assertNonEmpty(input.retriedAt, "CMP MQ delivery retriedAt");
  const record: CmpMqDeliveryStateRecord = {
    ...input.state,
    status: "retry_scheduled",
    currentAttempt: input.state.currentAttempt + 1,
    nextRetryAt: addMs(retriedAt, retryPolicy.backoffMs),
    metadata: {
      ...(input.state.metadata ?? {}),
      retryBackoffMs: retryPolicy.backoffMs,
      ...(input.metadata ?? {}),
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function expireCmpMqDeliveryState(input: {
  state: CmpMqDeliveryStateRecord;
  expiredAt: string;
  metadata?: Record<string, unknown>;
}): CmpMqDeliveryStateRecord {
  validateCmpMqDeliveryStateRecord(input.state);
  if (input.state.status === "acknowledged") {
    throw new Error("CMP MQ acknowledged delivery state cannot expire.");
  }

  const record: CmpMqDeliveryStateRecord = {
    ...input.state,
    status: "expired",
    metadata: {
      ...(input.state.metadata ?? {}),
      expiredAt: assertNonEmpty(input.expiredAt, "CMP MQ delivery expiredAt"),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpMqDeliveryStateRecord(record);
  return record;
}

export function createCmpMqDeliveryProjectionPatch(
  state: CmpMqDeliveryStateRecord,
): CmpMqDeliveryProjectionPatch {
  validateCmpMqDeliveryStateRecord(state);
  const patch: CmpMqDeliveryProjectionPatch = {
    deliveryId: state.deliveryId,
    dispatchId: state.dispatchId,
    packageId: state.packageId,
    sourceAgentId: state.sourceAgentId,
    targetAgentId: state.targetAgentId,
    state: state.status === "acknowledged"
      ? "acknowledged"
      : state.status === "expired"
        ? "expired"
        : "pending_delivery",
    deliveredAt: state.publishedAt,
    acknowledgedAt: state.acknowledgedAt,
    metadata: {
      ...(state.metadata ?? {}),
      redisKey: state.redisKey,
      lane: state.lane,
      truthStatus: state.status,
      currentAttempt: state.currentAttempt,
      maxAttempts: state.maxAttempts,
      ackDeadlineAt: state.ackDeadlineAt,
      nextRetryAt: state.nextRetryAt,
    },
  };
  validateCmpMqDeliveryProjectionPatch(patch);
  return patch;
}

export function evaluateCmpMqDeliveryTimeout(input: {
  state: CmpMqDeliveryStateRecord;
  now: string;
  retryPolicy?: CmpMqRetryPolicy;
}): {
  outcome: "awaiting_ack" | "retry_scheduled" | "expired";
  state: CmpMqDeliveryStateRecord;
  projectionPatch: CmpMqDeliveryProjectionPatch;
} {
  validateCmpMqDeliveryStateRecord(input.state);
  const now = assertNonEmpty(input.now, "CMP MQ delivery timeout now");
  if (input.state.status !== "published") {
    return {
      outcome: input.state.status === "retry_scheduled" ? "retry_scheduled" : "expired",
      state: input.state,
      projectionPatch: createCmpMqDeliveryProjectionPatch(input.state),
    };
  }

  if (new Date(now).getTime() < new Date(input.state.ackDeadlineAt).getTime()) {
    return {
      outcome: "awaiting_ack",
      state: input.state,
      projectionPatch: createCmpMqDeliveryProjectionPatch(input.state),
    };
  }

  const retryPolicy = input.retryPolicy ?? {
    maxAttempts: input.state.maxAttempts,
    backoffMs: Number(input.state.metadata?.retryBackoffMs ?? 30_000),
  };
  if (input.state.currentAttempt < retryPolicy.maxAttempts) {
    const state = scheduleCmpMqDeliveryRetry({
      state: input.state,
      retryPolicy,
      retriedAt: now,
    });
    return {
      outcome: "retry_scheduled",
      state,
      projectionPatch: createCmpMqDeliveryProjectionPatch(state),
    };
  }

  const state = expireCmpMqDeliveryState({
    state: input.state,
    expiredAt: now,
  });
  return {
    outcome: "expired",
    state,
    projectionPatch: createCmpMqDeliveryProjectionPatch(state),
  };
}
