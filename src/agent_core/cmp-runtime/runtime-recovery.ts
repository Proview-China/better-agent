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
import type { CmpRuntimeInfraProjectState } from "./infra-state.js";
import {
  getCmpRecoveryReconciliationRecord,
  reconcileCmpRuntimeSnapshotWithInfraProjects,
  type CmpRecoveryReconciliationRecord,
  type CmpRecoveryReconciliationSummary,
  summarizeCmpRecoveryReconciliation,
} from "./recovery-reconciliation.js";
import { hydrateCmpRuntimeInfraState, type CmpRuntimeHydratedInfraState } from "./infra-state.js";
import { createCmpRuntimeSnapshot, type CmpRuntimeSnapshot } from "./runtime-snapshot.js";

export interface CmpRuntimeHydratedState {
  projectRepos: Map<string, CmpGitProjectRepo>;
  lineages: Map<string, AgentLineage>;
  events: Map<string, ContextEvent>;
  deltas: Map<string, ContextDelta>;
  activeLines: Map<string, CmpActiveLineRecord>;
  snapshotCandidates: Map<string, SnapshotCandidate>;
  checkedSnapshots: Map<string, CheckedSnapshot>;
  requests: Map<string, CmpRequestRecord>;
  sectionRecords: Map<string, CmpSectionRecord>;
  snapshotRecords: Map<string, CmpSnapshotRecord>;
  promotedProjections: Map<string, PromotedProjection>;
  packageRecords: Map<string, CmpPackageRecord>;
  contextPackages: Map<string, ContextPackage>;
  dispatchReceipts: Map<string, DispatchReceipt>;
  syncEvents: Map<string, SyncEvent>;
  infraState: CmpRuntimeHydratedInfraState;
}

export interface CmpRuntimeHydratedRecovery {
  hydrated: CmpRuntimeHydratedState;
  reconciliation: CmpRecoveryReconciliationRecord[];
  summary: CmpRecoveryReconciliationSummary;
}

function assertUniqueKey(kind: string, key: string, seen: Set<string>): void {
  if (seen.has(key)) {
    throw new Error(`Duplicate ${kind} key detected during CMP runtime recovery: ${key}.`);
  }
  seen.add(key);
}

export function hydrateCmpRuntimeSnapshot(
  snapshot?: CmpRuntimeSnapshot,
): CmpRuntimeHydratedState {
  const normalized = createCmpRuntimeSnapshot(snapshot);
  const projectRepos = new Map<string, CmpGitProjectRepo>();
  const lineages = new Map<string, AgentLineage>();
  const events = new Map<string, ContextEvent>();
  const deltas = new Map<string, ContextDelta>();
  const activeLines = new Map<string, CmpActiveLineRecord>();
  const snapshotCandidates = new Map<string, SnapshotCandidate>();
  const checkedSnapshots = new Map<string, CheckedSnapshot>();
  const requests = new Map<string, CmpRequestRecord>();
  const sectionRecords = new Map<string, CmpSectionRecord>();
  const snapshotRecords = new Map<string, CmpSnapshotRecord>();
  const promotedProjections = new Map<string, PromotedProjection>();
  const packageRecords = new Map<string, CmpPackageRecord>();
  const contextPackages = new Map<string, ContextPackage>();
  const dispatchReceipts = new Map<string, DispatchReceipt>();
  const syncEvents = new Map<string, SyncEvent>();

  const seenProjectRepos = new Set<string>();
  for (const repo of normalized.projectRepos) {
    assertUniqueKey("cmp project repo", repo.projectId, seenProjectRepos);
    projectRepos.set(repo.projectId, repo);
  }

  const seenLineages = new Set<string>();
  for (const lineage of normalized.lineages) {
    assertUniqueKey("cmp lineage", lineage.agentId, seenLineages);
    lineages.set(lineage.agentId, lineage);
  }

  const seenEvents = new Set<string>();
  for (const event of normalized.events) {
    assertUniqueKey("cmp event", event.eventId, seenEvents);
    events.set(event.eventId, event);
  }

  const seenDeltas = new Set<string>();
  for (const delta of normalized.deltas) {
    assertUniqueKey("cmp delta", delta.deltaId, seenDeltas);
    deltas.set(delta.deltaId, delta);
  }

  const seenActiveLines = new Set<string>();
  for (const activeLine of normalized.activeLines) {
    assertUniqueKey("cmp active line", activeLine.lineId, seenActiveLines);
    activeLines.set(activeLine.lineId, activeLine);
  }

  const seenCandidates = new Set<string>();
  for (const candidate of normalized.snapshotCandidates) {
    assertUniqueKey("cmp snapshot candidate", candidate.candidateId, seenCandidates);
    snapshotCandidates.set(candidate.candidateId, candidate);
  }

  const seenCheckedSnapshots = new Set<string>();
  for (const snapshotRecord of normalized.checkedSnapshots) {
    assertUniqueKey("cmp checked snapshot", snapshotRecord.snapshotId, seenCheckedSnapshots);
    checkedSnapshots.set(snapshotRecord.snapshotId, snapshotRecord);
  }

  const seenRequests = new Set<string>();
  for (const request of normalized.requests) {
    assertUniqueKey("cmp request", request.requestId, seenRequests);
    requests.set(request.requestId, request);
  }

  const seenSectionRecords = new Set<string>();
  for (const sectionRecord of normalized.sectionRecords) {
    assertUniqueKey("cmp section record", sectionRecord.sectionId, seenSectionRecords);
    sectionRecords.set(sectionRecord.sectionId, sectionRecord);
  }

  const seenSnapshotRecords = new Set<string>();
  for (const snapshotRecord of normalized.snapshotRecords) {
    assertUniqueKey("cmp object snapshot", snapshotRecord.snapshotId, seenSnapshotRecords);
    snapshotRecords.set(snapshotRecord.snapshotId, snapshotRecord);
  }

  const seenProjections = new Set<string>();
  for (const projection of normalized.promotedProjections) {
    assertUniqueKey("cmp promoted projection", projection.projectionId, seenProjections);
    promotedProjections.set(projection.projectionId, projection);
  }

  const seenPackages = new Set<string>();
  for (const contextPackage of normalized.contextPackages) {
    assertUniqueKey("cmp context package", contextPackage.packageId, seenPackages);
    contextPackages.set(contextPackage.packageId, contextPackage);
  }

  const seenPackageRecords = new Set<string>();
  for (const packageRecord of normalized.packageRecords) {
    assertUniqueKey("cmp package record", packageRecord.packageId, seenPackageRecords);
    packageRecords.set(packageRecord.packageId, packageRecord);
  }

  const seenReceipts = new Set<string>();
  for (const receipt of normalized.dispatchReceipts) {
    assertUniqueKey("cmp dispatch receipt", receipt.dispatchId, seenReceipts);
    dispatchReceipts.set(receipt.dispatchId, receipt);
  }

  const seenSyncEvents = new Set<string>();
  for (const syncEvent of normalized.syncEvents) {
    assertUniqueKey("cmp sync event", syncEvent.syncEventId, seenSyncEvents);
    syncEvents.set(syncEvent.syncEventId, syncEvent);
  }

  return {
    projectRepos,
    lineages,
    events,
    deltas,
    activeLines,
    snapshotCandidates,
    checkedSnapshots,
    requests,
    sectionRecords,
    snapshotRecords,
    promotedProjections,
    packageRecords,
    contextPackages,
    dispatchReceipts,
    syncEvents,
    infraState: hydrateCmpRuntimeInfraState(normalized.infraState),
  };
}

export function hydrateCmpRuntimeSnapshotWithReconciliation(input: {
  snapshot?: CmpRuntimeSnapshot;
  projects?: readonly CmpRuntimeInfraProjectState[];
}): CmpRuntimeHydratedRecovery {
  const normalized = createCmpRuntimeSnapshot(input.snapshot);
  const hydrated = hydrateCmpRuntimeSnapshot(normalized);
  const projects = input.projects
    ?? normalized.infraState?.projects
    ?? [];
  const reconciliation = reconcileCmpRuntimeSnapshotWithInfraProjects({
    snapshot: normalized,
    projects,
  });

  return {
    hydrated,
    reconciliation,
    summary: summarizeCmpRecoveryReconciliation(reconciliation),
  };
}

export function getCmpRuntimeRecoveryReconciliation(input: {
  recovery: CmpRuntimeHydratedRecovery;
  projectId: string;
}): CmpRecoveryReconciliationRecord | undefined {
  return getCmpRecoveryReconciliationRecord({
    records: input.recovery.reconciliation,
    projectId: input.projectId,
  });
}
