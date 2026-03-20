import {
  CMP_DELIVERY_STATUSES,
  type CmpDeliveryStatus,
  type CmpNeighborRelation,
  assertNonEmpty,
} from "./runtime-types.js";

export type CmpDeliveryDirection = CmpNeighborRelation | "core_agent";

export interface CmpDispatchInstruction {
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  direction: CmpDeliveryDirection;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpDispatchReceipt {
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  direction: CmpDeliveryDirection;
  status: CmpDeliveryStatus;
  createdAt: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export function createCmpDispatchInstruction(
  input: CmpDispatchInstruction,
): CmpDispatchInstruction {
  if (!["parent", "peer", "child", "core_agent"].includes(input.direction)) {
    throw new Error(`Unsupported CMP delivery direction: ${input.direction}.`);
  }
  if (input.sourceAgentId === input.targetAgentId) {
    throw new Error("CMP dispatch instruction cannot target the source agent.");
  }

  return {
    dispatchId: assertNonEmpty(input.dispatchId, "CMP dispatch dispatchId"),
    packageId: assertNonEmpty(input.packageId, "CMP dispatch packageId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP dispatch sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP dispatch targetAgentId"),
    direction: input.direction,
    createdAt: input.createdAt,
    metadata: input.metadata,
  };
}

export function createCmpDispatchReceipt(
  input: CmpDispatchReceipt,
): CmpDispatchReceipt {
  if (!CMP_DELIVERY_STATUSES.includes(input.status)) {
    throw new Error(`Unsupported CMP delivery status: ${input.status}.`);
  }

  return {
    dispatchId: assertNonEmpty(input.dispatchId, "CMP dispatch receipt dispatchId"),
    packageId: assertNonEmpty(input.packageId, "CMP dispatch receipt packageId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP dispatch receipt sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP dispatch receipt targetAgentId"),
    direction: input.direction,
    status: input.status,
    createdAt: input.createdAt,
    deliveredAt: input.deliveredAt,
    acknowledgedAt: input.acknowledgedAt,
    metadata: input.metadata,
  };
}

export function markCmpDispatchDelivered(params: {
  receipt: CmpDispatchReceipt;
  deliveredAt: string;
  metadata?: Record<string, unknown>;
}): CmpDispatchReceipt {
  const receipt = createCmpDispatchReceipt(params.receipt);
  if (receipt.status !== "prepared") {
    throw new Error(`Only prepared CMP dispatch receipts can move to delivered, got ${receipt.status}.`);
  }
  return {
    ...receipt,
    status: "delivered",
    deliveredAt: params.deliveredAt,
    metadata: params.metadata ?? receipt.metadata,
  };
}

export function acknowledgeCmpDispatchReceipt(params: {
  receipt: CmpDispatchReceipt;
  acknowledgedAt: string;
  metadata?: Record<string, unknown>;
}): CmpDispatchReceipt {
  const receipt = createCmpDispatchReceipt(params.receipt);
  if (receipt.status !== "delivered") {
    throw new Error(`Only delivered CMP dispatch receipts can be acknowledged, got ${receipt.status}.`);
  }
  return {
    ...receipt,
    status: "acknowledged",
    acknowledgedAt: params.acknowledgedAt,
    metadata: params.metadata ?? receipt.metadata,
  };
}

