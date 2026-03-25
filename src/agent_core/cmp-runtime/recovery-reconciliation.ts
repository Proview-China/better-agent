import type { CmpRuntimeSnapshot } from "./runtime-snapshot.js";
import type { CmpRuntimeInfraProjectState } from "./infra-state.js";
import { createCmpProjectInfraAccess } from "./infra-access.js";

export const CMP_RECOVERY_RECONCILIATION_STATUSES = [
  "aligned",
  "degraded",
  "snapshot_only",
  "infra_only",
] as const;
export type CmpRecoveryReconciliationStatus =
  (typeof CMP_RECOVERY_RECONCILIATION_STATUSES)[number];

export const CMP_HISTORY_TRUTH_SOURCES = [
  "db_projection",
  "git_checked",
] as const;
export type CmpHistoryTruthSource = (typeof CMP_HISTORY_TRUTH_SOURCES)[number];

export const CMP_HISTORY_FALLBACK_REASONS = [
  "projection_missing",
  "db_readback_incomplete",
  "db_unavailable",
] as const;
export type CmpHistoryFallbackReason = (typeof CMP_HISTORY_FALLBACK_REASONS)[number];

export interface CmpHistoricalFallbackDecision {
  projectId: string;
  requesterAgentId: string;
  preferredSource: "db_projection";
  resolvedSource: CmpHistoryTruthSource;
  degraded: boolean;
  reason?: CmpHistoryFallbackReason;
  snapshotId?: string;
}

export interface CmpRecoveryReconciliationRecord {
  projectId: string;
  status: CmpRecoveryReconciliationStatus;
  snapshotProjectPresent: boolean;
  infraProjectPresent: boolean;
  snapshotRepoPresent: boolean;
  branchRuntimeCount: number;
  mqBootstrapCount: number;
  snapshotLineageCount: number;
  infraLineageCount: number;
  branchRuntimeAgentIds: string[];
  mqBootstrapAgentIds: string[];
  snapshotLineageAgentIds: string[];
  infraLineageAgentIds: string[];
  missingSnapshotRepo: boolean;
  missingBranchRuntimeAgentIds: string[];
  missingMqBootstrapAgentIds: string[];
  missingSnapshotLineageAgentIds: string[];
  orphanSnapshotLineageAgentIds: string[];
  issues: string[];
  recommendedAction:
    | "none"
    | "hydrate_from_snapshot"
    | "hydrate_from_infra"
    | "reconcile_snapshot_and_infra";
}

export interface CmpRecoveryReconciliationSummary {
  totalProjects: number;
  alignedProjectIds: string[];
  degradedProjectIds: string[];
  snapshotOnlyProjectIds: string[];
  infraOnlyProjectIds: string[];
  recommendedHydrateFromSnapshot: string[];
  recommendedHydrateFromInfra: string[];
  recommendedReconcile: string[];
}

export function planCmpHistoricalFallback(input: {
  projectId: string;
  requesterAgentId: string;
  snapshotId?: string;
  hasDbProjection: boolean;
  dbReadbackComplete: boolean;
  dbAvailable?: boolean;
  hasGitCheckedSnapshot: boolean;
}): CmpHistoricalFallbackDecision {
  if (input.hasDbProjection && input.dbReadbackComplete) {
    return {
      projectId: input.projectId,
      requesterAgentId: input.requesterAgentId,
      preferredSource: "db_projection",
      resolvedSource: "db_projection",
      degraded: false,
      snapshotId: input.snapshotId,
    };
  }

  if (!input.hasGitCheckedSnapshot) {
    throw new Error(
      `CMP historical fallback cannot rebuild project ${input.projectId} for ${input.requesterAgentId} because no git checked snapshot is available.`,
    );
  }

  const reason = input.dbAvailable === false
    ? "db_unavailable"
    : input.hasDbProjection
      ? "db_readback_incomplete"
      : "projection_missing";

  return {
    projectId: input.projectId,
    requesterAgentId: input.requesterAgentId,
    preferredSource: "db_projection",
    resolvedSource: "git_checked",
    degraded: true,
    reason,
    snapshotId: input.snapshotId,
  };
}

export function getCmpRecoveryReconciliationRecord(input: {
  records: readonly CmpRecoveryReconciliationRecord[];
  projectId: string;
}): CmpRecoveryReconciliationRecord | undefined {
  return input.records.find((record) => record.projectId === input.projectId.trim());
}

export function summarizeCmpRecoveryReconciliation(
  records: readonly CmpRecoveryReconciliationRecord[],
): CmpRecoveryReconciliationSummary {
  const summary: CmpRecoveryReconciliationSummary = {
    totalProjects: records.length,
    alignedProjectIds: [],
    degradedProjectIds: [],
    snapshotOnlyProjectIds: [],
    infraOnlyProjectIds: [],
    recommendedHydrateFromSnapshot: [],
    recommendedHydrateFromInfra: [],
    recommendedReconcile: [],
  };

  for (const record of records) {
    if (record.status === "aligned") {
      summary.alignedProjectIds.push(record.projectId);
    } else if (record.status === "degraded") {
      summary.degradedProjectIds.push(record.projectId);
    } else if (record.status === "snapshot_only") {
      summary.snapshotOnlyProjectIds.push(record.projectId);
    } else if (record.status === "infra_only") {
      summary.infraOnlyProjectIds.push(record.projectId);
    }

    if (record.recommendedAction === "hydrate_from_snapshot") {
      summary.recommendedHydrateFromSnapshot.push(record.projectId);
    } else if (record.recommendedAction === "hydrate_from_infra") {
      summary.recommendedHydrateFromInfra.push(record.projectId);
    } else if (record.recommendedAction === "reconcile_snapshot_and_infra") {
      summary.recommendedReconcile.push(record.projectId);
    }
  }

  return summary;
}

export function reconcileCmpRuntimeSnapshotWithInfraProjects(input: {
  snapshot: CmpRuntimeSnapshot;
  projects: readonly CmpRuntimeInfraProjectState[];
}): CmpRecoveryReconciliationRecord[] {
  const projectIds = new Set<string>();
  for (const repo of input.snapshot.projectRepos) {
    projectIds.add(repo.projectId);
  }
  for (const lineage of input.snapshot.lineages) {
    projectIds.add(lineage.projectId);
  }
  for (const project of input.projects) {
    projectIds.add(project.projectId);
  }

  return [...projectIds].sort().map((projectId) => {
    const project = input.projects.find((candidate) => candidate.projectId === projectId);
    const snapshotProjectPresent = input.snapshot.projectRepos.some((repo) => repo.projectId === projectId)
      || input.snapshot.lineages.some((lineage) => lineage.projectId === projectId);
    const snapshotRepoPresent = input.snapshot.projectRepos.some((repo) => repo.projectId === projectId);
    const snapshotLineageAgentIds = [
      ...new Set(
        input.snapshot.lineages
          .filter((lineage) => lineage.projectId === projectId)
          .map((lineage) => lineage.agentId),
      ),
    ].sort();

    if (!project) {
      return {
        projectId,
        status: "snapshot_only",
        snapshotProjectPresent,
        infraProjectPresent: false,
        snapshotRepoPresent,
        branchRuntimeCount: 0,
        mqBootstrapCount: 0,
        snapshotLineageCount: snapshotLineageAgentIds.length,
        infraLineageCount: 0,
        branchRuntimeAgentIds: [],
        mqBootstrapAgentIds: [],
        snapshotLineageAgentIds,
        infraLineageAgentIds: [],
        missingSnapshotRepo: !snapshotRepoPresent,
        missingBranchRuntimeAgentIds: [],
        missingMqBootstrapAgentIds: [],
        missingSnapshotLineageAgentIds: [],
        orphanSnapshotLineageAgentIds: [...snapshotLineageAgentIds],
        issues: [
          "CMP infra project state is missing; recovery can only hydrate from snapshot-side data.",
          ...(!snapshotRepoPresent ? ["CMP snapshot is missing project repo state for this project."] : []),
        ],
        recommendedAction: "hydrate_from_snapshot",
      };
    }

    const access = createCmpProjectInfraAccess(project);
    const branchRuntimeAgentIds = [...access.branchRuntimes.keys()].sort();
    const mqBootstrapAgentIds = [...access.mqBootstraps.keys()].sort();
    const infraLineageAgentIds = [...new Set(project.lineages.map((lineage) => lineage.agentId))].sort();

    const missingBranchRuntimeAgentIds = infraLineageAgentIds
      .filter((agentId) => !access.branchRuntimes.has(agentId))
      .sort();
    const missingMqBootstrapAgentIds = infraLineageAgentIds
      .filter((agentId) => !access.mqBootstraps.has(agentId))
      .sort();
    const missingSnapshotLineageAgentIds = infraLineageAgentIds
      .filter((agentId) => !snapshotLineageAgentIds.includes(agentId))
      .sort();
    const orphanSnapshotLineageAgentIds = snapshotLineageAgentIds
      .filter((agentId) => !infraLineageAgentIds.includes(agentId))
      .sort();

    const issues: string[] = [];
    if (!snapshotRepoPresent) {
      issues.push("CMP snapshot is missing project repo state for this project.");
    }
    if (missingBranchRuntimeAgentIds.length > 0) {
      issues.push(
        `CMP infra is missing branch runtime state for agents: ${missingBranchRuntimeAgentIds.join(", ")}.`,
      );
    }
    if (missingMqBootstrapAgentIds.length > 0) {
      issues.push(
        `CMP infra is missing mq bootstrap state for agents: ${missingMqBootstrapAgentIds.join(", ")}.`,
      );
    }
    if (project.dbReceipt && project.dbReceipt.status !== "bootstrapped") {
      issues.push("CMP DB bootstrap readback is incomplete for this project.");
    }
    if (missingSnapshotLineageAgentIds.length > 0) {
      issues.push(
        `CMP snapshot is missing lineage state for infra-known agents: ${missingSnapshotLineageAgentIds.join(", ")}.`,
      );
    }
    if (orphanSnapshotLineageAgentIds.length > 0) {
      issues.push(
        `CMP snapshot carries lineage state that is not present in infra state: ${orphanSnapshotLineageAgentIds.join(", ")}.`,
      );
    }

    return {
      projectId,
      status: issues.length === 0 ? "aligned" : "degraded",
      snapshotProjectPresent,
      infraProjectPresent: true,
      snapshotRepoPresent,
      branchRuntimeCount: access.branchRuntimes.size,
      mqBootstrapCount: access.mqBootstraps.size,
      snapshotLineageCount: snapshotLineageAgentIds.length,
      infraLineageCount: infraLineageAgentIds.length,
      branchRuntimeAgentIds,
      mqBootstrapAgentIds,
      snapshotLineageAgentIds,
      infraLineageAgentIds,
      missingSnapshotRepo: !snapshotRepoPresent,
      missingBranchRuntimeAgentIds,
      missingMqBootstrapAgentIds,
      missingSnapshotLineageAgentIds,
      orphanSnapshotLineageAgentIds,
      issues,
      recommendedAction: issues.length === 0
        ? "none"
        : !snapshotRepoPresent && snapshotLineageAgentIds.length > 0
          ? "hydrate_from_snapshot"
          : !!project.dbReceipt && project.dbReceipt.status !== "bootstrapped"
            ? "reconcile_snapshot_and_infra"
          : missingSnapshotLineageAgentIds.length > 0 || orphanSnapshotLineageAgentIds.length > 0
            ? "reconcile_snapshot_and_infra"
            : "hydrate_from_infra",
    };
  });
}
