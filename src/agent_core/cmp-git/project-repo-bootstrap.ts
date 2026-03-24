import {
  createCmpGitProjectRepo,
  type CmpGitBranchKind,
  type CmpGitProjectRepo,
} from "./cmp-git-types.js";

export const CMP_GIT_BOOTSTRAP_STATUSES = [
  "pending",
  "bootstrapped",
  "already_exists",
] as const;
export type CmpGitBootstrapStatus = (typeof CMP_GIT_BOOTSTRAP_STATUSES)[number];

export interface CmpGitProjectRepoBootstrapInput {
  projectId: string;
  repoName: string;
  repoRootPath: string;
  defaultAgentId?: string;
  defaultBranchName?: string;
  worktreeRootPath?: string;
  branchKinds?: readonly CmpGitBranchKind[];
  metadata?: Record<string, unknown>;
}

export interface CmpGitProjectRepoBootstrapPlan {
  projectRepo: CmpGitProjectRepo;
  repoRootPath: string;
  defaultBranchName: string;
  worktreeRootPath: string;
  branchKinds: readonly CmpGitBranchKind[];
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function isCmpGitBootstrapStatus(value: string): value is CmpGitBootstrapStatus {
  return CMP_GIT_BOOTSTRAP_STATUSES.includes(value as CmpGitBootstrapStatus);
}

export function createCmpGitProjectRepoBootstrapPlan(
  input: CmpGitProjectRepoBootstrapInput,
): CmpGitProjectRepoBootstrapPlan {
  const repoRootPath = assertNonEmpty(input.repoRootPath, "CMP git repoRootPath");
  const projectRepo = createCmpGitProjectRepo({
    projectId: input.projectId,
    repoName: input.repoName,
    defaultAgentId: input.defaultAgentId,
    metadata: input.metadata,
  });

  return {
    projectRepo,
    repoRootPath,
    defaultBranchName: assertNonEmpty(
      input.defaultBranchName?.trim() || "main",
      "CMP git defaultBranchName",
    ),
    worktreeRootPath:
      input.worktreeRootPath?.trim() || `${repoRootPath}/.cmp-worktrees`,
    branchKinds: input.branchKinds ?? ["work", "cmp", "mp", "tap"],
    metadata: input.metadata,
  };
}
