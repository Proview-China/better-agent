import {
  CMP_PROJECTION_VISIBILITIES,
  type CmpProjectionVisibility,
  assertNonEmpty,
} from "./runtime-types.js";

export interface CmpProjectionRecord {
  projectionId: string;
  checkedSnapshotRef: string;
  agentId: string;
  visibility: CmpProjectionVisibility;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpContextPackageRecord {
  packageId: string;
  projectionId: string;
  sourceAgentId: string;
  targetAgentId: string;
  packageKind: string;
  packageRef: string;
  fidelityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePassiveHistoricalPackageInput {
  packageId: string;
  projection: CmpProjectionRecord;
  requesterAgentId: string;
  packageKind: string;
  packageRef: string;
  fidelityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function createCmpProjectionRecord(input: CmpProjectionRecord): CmpProjectionRecord {
  return {
    projectionId: assertNonEmpty(input.projectionId, "CMP projection projectionId"),
    checkedSnapshotRef: assertNonEmpty(input.checkedSnapshotRef, "CMP projection checkedSnapshotRef"),
    agentId: assertNonEmpty(input.agentId, "CMP projection agentId"),
    visibility: input.visibility,
    updatedAt: input.updatedAt,
    metadata: input.metadata,
  };
}

export function advanceCmpProjectionVisibility(params: {
  record: CmpProjectionRecord;
  nextVisibility: CmpProjectionVisibility;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpProjectionRecord {
  const record = createCmpProjectionRecord(params.record);
  const currentIndex = CMP_PROJECTION_VISIBILITIES.indexOf(record.visibility);
  const nextIndex = CMP_PROJECTION_VISIBILITIES.indexOf(params.nextVisibility);
  if (nextIndex < currentIndex) {
    throw new Error(
      `CMP projection cannot move backwards from ${record.visibility} to ${params.nextVisibility}.`,
    );
  }

  return {
    ...record,
    visibility: params.nextVisibility,
    updatedAt: params.updatedAt,
    metadata: params.metadata ?? record.metadata,
  };
}

export function createCmpContextPackageRecord(
  input: CmpContextPackageRecord,
): CmpContextPackageRecord {
  return {
    packageId: assertNonEmpty(input.packageId, "CMP package packageId"),
    projectionId: assertNonEmpty(input.projectionId, "CMP package projectionId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP package sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP package targetAgentId"),
    packageKind: assertNonEmpty(input.packageKind, "CMP package packageKind"),
    packageRef: assertNonEmpty(input.packageRef, "CMP package packageRef"),
    fidelityLabel: assertNonEmpty(input.fidelityLabel, "CMP package fidelityLabel"),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };
}

export function createPassiveHistoricalPackage(
  input: CreatePassiveHistoricalPackageInput,
): CmpContextPackageRecord {
  const projection = createCmpProjectionRecord(input.projection);
  return createCmpContextPackageRecord({
    packageId: input.packageId,
    projectionId: projection.projectionId,
    sourceAgentId: projection.agentId,
    targetAgentId: assertNonEmpty(input.requesterAgentId, "CMP passive requesterAgentId"),
    packageKind: input.packageKind,
    packageRef: input.packageRef,
    fidelityLabel: input.fidelityLabel,
    createdAt: input.createdAt,
    metadata: {
      source: "passive_request",
      projectionVisibility: projection.visibility,
      ...(input.metadata ?? {}),
    },
  });
}

