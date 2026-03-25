import type { CmpRuntimeSnapshot } from "./runtime-snapshot.js";
import type { CmpRuntimeInfraProjectState } from "./infra-state.js";
import { createCmpProjectInfraAccess } from "./infra-access.js";

export interface CmpRecoveryReconciliationRecord {
  projectId: string;
  snapshotRepoPresent: boolean;
  branchRuntimeCount: number;
  mqBootstrapCount: number;
  snapshotLineageCount: number;
}

export function reconcileCmpRuntimeSnapshotWithInfraProjects(input: {
  snapshot: CmpRuntimeSnapshot;
  projects: readonly CmpRuntimeInfraProjectState[];
}): CmpRecoveryReconciliationRecord[] {
  return input.projects.map((project) => {
    const access = createCmpProjectInfraAccess(project);
    return {
      projectId: project.projectId,
      snapshotRepoPresent: input.snapshot.projectRepos.some((repo) => repo.projectId === project.projectId),
      branchRuntimeCount: access.branchRuntimes.size,
      mqBootstrapCount: access.mqBootstraps.size,
      snapshotLineageCount: input.snapshot.lineages.filter((lineage) => lineage.projectId === project.projectId).length,
    };
  });
}
