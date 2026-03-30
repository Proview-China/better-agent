import type { CmpGitProjectRepo } from "../cmp-git/index.js";
import type {
  AgentLineage,
  CheckedSnapshot,
  CmpPackageRecord,
  CmpRequestRecord,
  CmpSectionRecord,
  CmpSnapshotRecord,
  ContextDelta,
  ContextEvent,
  ContextPackage,
  DispatchReceipt,
  PromotedProjection,
  SnapshotCandidate,
  SyncEvent,
} from "../cmp-types/index.js";
import type { CmpActiveLineRecord } from "./active-line.js";
import { createCmpRuntimeInfraState, type CmpRuntimeInfraState } from "./infra-state.js";

export interface CmpRuntimeSnapshot {
  projectRepos: CmpGitProjectRepo[];
  lineages: AgentLineage[];
  events: ContextEvent[];
  deltas: ContextDelta[];
  activeLines: CmpActiveLineRecord[];
  snapshotCandidates: SnapshotCandidate[];
  checkedSnapshots: CheckedSnapshot[];
  requests: CmpRequestRecord[];
  sectionRecords: CmpSectionRecord[];
  snapshotRecords: CmpSnapshotRecord[];
  promotedProjections: PromotedProjection[];
  packageRecords: CmpPackageRecord[];
  contextPackages: ContextPackage[];
  dispatchReceipts: DispatchReceipt[];
  syncEvents: SyncEvent[];
  infraState?: CmpRuntimeInfraState;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpRuntimeSnapshotInput {
  projectRepos?: readonly CmpGitProjectRepo[];
  lineages?: readonly AgentLineage[];
  events?: readonly ContextEvent[];
  deltas?: readonly ContextDelta[];
  activeLines?: readonly CmpActiveLineRecord[];
  snapshotCandidates?: readonly SnapshotCandidate[];
  checkedSnapshots?: readonly CheckedSnapshot[];
  requests?: readonly CmpRequestRecord[];
  sectionRecords?: readonly CmpSectionRecord[];
  snapshotRecords?: readonly CmpSnapshotRecord[];
  promotedProjections?: readonly PromotedProjection[];
  packageRecords?: readonly CmpPackageRecord[];
  contextPackages?: readonly ContextPackage[];
  dispatchReceipts?: readonly DispatchReceipt[];
  syncEvents?: readonly SyncEvent[];
  infraState?: CmpRuntimeInfraState;
  metadata?: Record<string, unknown>;
}

export function createCmpRuntimeSnapshot(
  input: CreateCmpRuntimeSnapshotInput = {},
): CmpRuntimeSnapshot {
  return {
    projectRepos: [...(input.projectRepos ?? [])],
    lineages: [...(input.lineages ?? [])],
    events: [...(input.events ?? [])],
    deltas: [...(input.deltas ?? [])],
    activeLines: [...(input.activeLines ?? [])],
    snapshotCandidates: [...(input.snapshotCandidates ?? [])],
    checkedSnapshots: [...(input.checkedSnapshots ?? [])],
    requests: [...(input.requests ?? [])],
    sectionRecords: [...(input.sectionRecords ?? [])],
    snapshotRecords: [...(input.snapshotRecords ?? [])],
    promotedProjections: [...(input.promotedProjections ?? [])],
    packageRecords: [...(input.packageRecords ?? [])],
    contextPackages: [...(input.contextPackages ?? [])],
    dispatchReceipts: [...(input.dispatchReceipts ?? [])],
    syncEvents: [...(input.syncEvents ?? [])],
    infraState: input.infraState ? createCmpRuntimeInfraState(input.infraState) : undefined,
    metadata: input.metadata,
  };
}
