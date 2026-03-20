import {
  createCmpGitCommitDeltaBinding,
  createCmpGitSnapshotCandidateFromBinding,
  type CmpGitCommitDeltaBinding,
  type CmpGitContextDeltaLike,
  type CmpGitSnapshotCandidateRecord,
} from "./cmp-git-types.js";

export interface CmpGitCommitSyncInput {
  projectId: string;
  commitSha: string;
  branchRef: CmpGitCommitDeltaBinding["branchRef"];
  delta: CmpGitContextDeltaLike;
}

export interface CmpGitCommitSyncResult {
  binding: CmpGitCommitDeltaBinding;
  candidate: CmpGitSnapshotCandidateRecord;
}

export function syncCmpGitCommitDelta(
  input: CmpGitCommitSyncInput,
): CmpGitCommitSyncResult {
  const binding = createCmpGitCommitDeltaBinding({
    projectId: input.projectId,
    agentId: input.delta.agentId,
    branchRef: input.branchRef,
    commitSha: input.commitSha,
    delta: input.delta,
  });
  const candidate = createCmpGitSnapshotCandidateFromBinding(binding);

  return {
    binding,
    candidate,
  };
}
