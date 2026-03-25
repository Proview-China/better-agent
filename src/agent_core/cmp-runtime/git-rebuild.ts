import type { CmpGitProjectionSourceAnchor } from "../cmp-git/index.js";
import {
  createCmpDbContextPackageBackfillRecord,
  type CmpDbContextPackageRecord,
} from "../cmp-db/index.js";
import type { CheckedSnapshot } from "../cmp-types/index.js";
import {
  createCmpProjectionRecord,
  createPassiveHistoricalPackage,
  type CmpContextPackageRecord,
  type CmpProjectionRecord,
} from "./materialization.js";

export interface RebuildCmpProjectionFromGitTruthInput {
  projectionId: string;
  snapshot: Pick<CheckedSnapshot, "snapshotId" | "agentId" | "checkedAt" | "metadata">;
  anchor: CmpGitProjectionSourceAnchor;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface RebuildCmpPassiveHistoricalPackageFromGitTruthInput {
  packageId: string;
  projection: CmpProjectionRecord;
  requesterAgentId: string;
  packageKind: string;
  fidelityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface RebuildCmpHistoricalContextFromGitTruthInput {
  projectionId: string;
  packageId: string;
  snapshot: Pick<CheckedSnapshot, "snapshotId" | "agentId" | "checkedAt" | "metadata">;
  anchor: CmpGitProjectionSourceAnchor;
  requesterAgentId: string;
  packageKind: string;
  fidelityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpGitRebuildResult {
  projection: CmpProjectionRecord;
  contextPackage: CmpContextPackageRecord;
}

export interface CmpGitRebuildWithBackfillResult extends CmpGitRebuildResult {
  dbBackfillRecord: CmpDbContextPackageRecord;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function resolveVisibilityFromGitTruth(anchor: CmpGitProjectionSourceAnchor): CmpProjectionRecord["visibility"] {
  return anchor.promotedRefName ? "promoted_by_parent" : "local_only";
}

function createGitTruthMetadata(input: {
  anchor: CmpGitProjectionSourceAnchor;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    source: "git_rebuild",
    gitCheckedRefName: input.anchor.checkedRefName,
    gitPromotedRefName: input.anchor.promotedRefName,
    gitBranchHeadRef: input.anchor.branchHeadRef,
    gitCommitSha: input.anchor.commitSha,
    ...(input.metadata ?? {}),
  };
}

export function rebuildCmpProjectionFromGitTruth(
  input: RebuildCmpProjectionFromGitTruthInput,
): CmpProjectionRecord {
  return createCmpProjectionRecord({
    projectionId: assertNonEmpty(input.projectionId, "CMP git rebuild projectionId"),
    checkedSnapshotRef: assertNonEmpty(input.snapshot.snapshotId, "CMP git rebuild snapshotId"),
    agentId: assertNonEmpty(input.snapshot.agentId, "CMP git rebuild agentId"),
    visibility: resolveVisibilityFromGitTruth(input.anchor),
    updatedAt: input.updatedAt ?? input.snapshot.checkedAt,
    metadata: createGitTruthMetadata({
      anchor: input.anchor,
      metadata: {
        checkedAt: input.snapshot.checkedAt,
        ...(input.snapshot.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    }),
  });
}

export function rebuildCmpPassiveHistoricalPackageFromGitTruth(
  input: RebuildCmpPassiveHistoricalPackageFromGitTruthInput,
): CmpContextPackageRecord {
  return createPassiveHistoricalPackage({
    packageId: assertNonEmpty(input.packageId, "CMP git rebuild packageId"),
    projection: input.projection,
    requesterAgentId: assertNonEmpty(input.requesterAgentId, "CMP git rebuild requesterAgentId"),
    packageKind: assertNonEmpty(input.packageKind, "CMP git rebuild packageKind"),
    packageRef: `cmp-git-rebuild:${input.projection.projectionId}:${input.requesterAgentId}`,
    fidelityLabel: assertNonEmpty(input.fidelityLabel, "CMP git rebuild fidelityLabel"),
    createdAt: assertNonEmpty(input.createdAt, "CMP git rebuild createdAt"),
    metadata: {
      source: "git_rebuild",
      ...(input.metadata ?? {}),
    },
  });
}

export function rebuildCmpHistoricalContextFromGitTruth(
  input: RebuildCmpHistoricalContextFromGitTruthInput,
): CmpGitRebuildResult {
  const projection = rebuildCmpProjectionFromGitTruth({
    projectionId: input.projectionId,
    snapshot: input.snapshot,
    anchor: input.anchor,
    updatedAt: input.createdAt,
    metadata: input.metadata,
  });
  const contextPackage = rebuildCmpPassiveHistoricalPackageFromGitTruth({
    packageId: input.packageId,
    projection,
    requesterAgentId: input.requesterAgentId,
    packageKind: input.packageKind,
    fidelityLabel: input.fidelityLabel,
    createdAt: input.createdAt,
    metadata: input.metadata,
  });
  return {
    projection,
    contextPackage,
  };
}

export function createCmpDbBackfillRecordFromGitRebuild(input: {
  rebuild: CmpGitRebuildResult;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpDbContextPackageRecord {
  return createCmpDbContextPackageBackfillRecord({
    packageId: input.rebuild.contextPackage.packageId,
    sourceProjection: {
      projectionId: input.rebuild.projection.projectionId,
      snapshotId: input.rebuild.projection.checkedSnapshotRef,
      agentId: input.rebuild.projection.agentId,
    },
    targetAgentId: input.rebuild.contextPackage.targetAgentId,
    packageKind: input.rebuild.contextPackage.packageKind,
    packageRef: input.rebuild.contextPackage.packageRef,
    fidelityLabel: input.rebuild.contextPackage.fidelityLabel,
    createdAt: input.rebuild.contextPackage.createdAt,
    updatedAt: input.updatedAt ?? input.rebuild.contextPackage.createdAt,
    metadata: {
      rebuiltFromSnapshotId: input.rebuild.projection.checkedSnapshotRef,
      rebuiltProjectionVisibility: input.rebuild.projection.visibility,
      ...(input.rebuild.contextPackage.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function rebuildCmpHistoricalContextWithBackfillFromGitTruth(
  input: RebuildCmpHistoricalContextFromGitTruthInput,
): CmpGitRebuildWithBackfillResult {
  const rebuild = rebuildCmpHistoricalContextFromGitTruth(input);
  return {
    ...rebuild,
    dbBackfillRecord: createCmpDbBackfillRecordFromGitRebuild({
      rebuild,
      updatedAt: input.createdAt,
      metadata: input.metadata,
    }),
  };
}
