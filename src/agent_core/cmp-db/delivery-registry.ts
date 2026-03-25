import type {
  ContextPackage,
  DispatchReceipt,
} from "../cmp-types/index.js";
import {
  type CmpDbContextPackageRecord,
  type CmpDbContextPackageRecordState,
  type CmpDbDeliveryRecordState,
  type CmpDbDeliveryRegistryRecord,
  type CmpProjectionRecord,
  validateCmpDbContextPackageRecord,
  validateCmpDbDeliveryRegistryRecord,
  assertNonEmptyString,
} from "./cmp-db-types.js";

export const CMP_DB_PACKAGE_TRUTH_SOURCES = [
  "db_primary",
  "git_fallback_backfill",
] as const;
export type CmpDbPackageTruthSource = (typeof CMP_DB_PACKAGE_TRUTH_SOURCES)[number];

export function createCmpDbContextPackageRecordFromContextPackage(input: {
  contextPackage: ContextPackage;
  sourceProjection: Pick<CmpProjectionRecord, "projectionId" | "snapshotId" | "agentId">;
  state?: CmpDbContextPackageRecordState;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  truthSource?: CmpDbPackageTruthSource;
}): CmpDbContextPackageRecord {
  const record: CmpDbContextPackageRecord = {
    packageId: input.contextPackage.packageId,
    sourceProjectionId: input.sourceProjection.projectionId,
    sourceSnapshotId: input.sourceProjection.snapshotId,
    sourceAgentId: input.sourceProjection.agentId,
    targetAgentId: input.contextPackage.targetAgentId,
    packageKind: input.contextPackage.packageKind,
    packageRef: input.contextPackage.packageRef,
    fidelityLabel: input.contextPackage.fidelityLabel,
    state: input.state ?? "materialized",
    createdAt: input.contextPackage.createdAt,
    updatedAt: input.updatedAt ?? input.contextPackage.createdAt,
    metadata: {
      truthSource: input.truthSource ?? "db_primary",
      ...(input.contextPackage.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpDbContextPackageRecord(record);
  return record;
}

export function createCmpDbContextPackageBackfillRecord(input: {
  packageId: string;
  sourceProjection: Pick<CmpProjectionRecord, "projectionId" | "snapshotId" | "agentId">;
  targetAgentId: string;
  packageKind: string;
  packageRef: string;
  fidelityLabel: string;
  createdAt: string;
  state?: CmpDbContextPackageRecordState;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpDbContextPackageRecord {
  const record: CmpDbContextPackageRecord = {
    packageId: assertNonEmptyString(input.packageId, "CMP DB backfill packageId"),
    sourceProjectionId: input.sourceProjection.projectionId,
    sourceSnapshotId: input.sourceProjection.snapshotId,
    sourceAgentId: input.sourceProjection.agentId,
    targetAgentId: assertNonEmptyString(input.targetAgentId, "CMP DB backfill targetAgentId"),
    packageKind: assertNonEmptyString(input.packageKind, "CMP DB backfill packageKind"),
    packageRef: assertNonEmptyString(input.packageRef, "CMP DB backfill packageRef"),
    fidelityLabel: assertNonEmptyString(input.fidelityLabel, "CMP DB backfill fidelityLabel"),
    state: input.state ?? "materialized",
    createdAt: assertNonEmptyString(input.createdAt, "CMP DB backfill createdAt"),
    updatedAt: assertNonEmptyString(
      input.updatedAt ?? input.createdAt,
      "CMP DB backfill updatedAt",
    ),
    metadata: {
      truthSource: "git_fallback_backfill" as const,
      backfillSource: "git_checked_or_promoted",
      ...(input.metadata ?? {}),
    },
  };
  validateCmpDbContextPackageRecord(record);
  return record;
}

export function advanceCmpDbContextPackageRecord(params: {
  record: CmpDbContextPackageRecord;
  nextState: CmpDbContextPackageRecordState;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpDbContextPackageRecord {
  const allowedTransitions: Record<
    CmpDbContextPackageRecordState,
    readonly CmpDbContextPackageRecordState[]
  > = {
    materialized: ["delivered", "archived"],
    delivered: ["acknowledged", "archived"],
    acknowledged: ["archived"],
    archived: [],
  };
  validateCmpDbContextPackageRecord(params.record);
  if (!allowedTransitions[params.record.state].includes(params.nextState)) {
    throw new Error(
      `CMP DB package record cannot transition from ${params.record.state} to ${params.nextState}.`,
    );
  }
  const record: CmpDbContextPackageRecord = {
    ...params.record,
    state: params.nextState,
    updatedAt: assertNonEmptyString(params.updatedAt, "CMP DB package record updatedAt"),
    metadata: {
      ...(params.record.metadata ?? {}),
      ...(params.metadata ?? {}),
    },
  };
  validateCmpDbContextPackageRecord(record);
  return record;
}

function mapDispatchStatusToDeliveryState(status: DispatchReceipt["status"]): CmpDbDeliveryRecordState {
  switch (status) {
    case "queued":
      return "pending_delivery";
    case "delivered":
      return "delivered";
    case "acknowledged":
      return "acknowledged";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
  }
}

export function createCmpDbDeliveryRegistryRecordFromDispatchReceipt(input: {
  receipt: DispatchReceipt;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}): CmpDbDeliveryRegistryRecord {
  const record: CmpDbDeliveryRegistryRecord = {
    deliveryId: input.receipt.dispatchId,
    dispatchId: input.receipt.dispatchId,
    packageId: input.receipt.packageId,
    sourceAgentId: input.receipt.sourceAgentId,
    targetAgentId: input.receipt.targetAgentId,
    state: mapDispatchStatusToDeliveryState(input.receipt.status),
    createdAt: input.createdAt ?? input.receipt.deliveredAt ?? input.receipt.acknowledgedAt ?? new Date().toISOString(),
    deliveredAt: input.receipt.deliveredAt,
    acknowledgedAt: input.receipt.acknowledgedAt,
    metadata: {
      ...(input.receipt.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpDbDeliveryRegistryRecord(record);
  return record;
}
