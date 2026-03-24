import {
  createCmpGitBranchFamily,
  type CmpGitBranchFamily,
  type CmpGitLineageNode,
  type CmpGitProjectRepo,
} from "./cmp-git-types.js";
import { CmpGitLineageRegistry } from "./lineage-registry.js";

export interface CmpGitAgentBranchRuntime {
  projectId: string;
  repoId: string;
  repoName: string;
  repoRootPath: string;
  worktreeRootPath: string;
  agentId: string;
  lineageId: string;
  depth: number;
  parentAgentId?: string;
  branchFamily: CmpGitBranchFamily;
  checkedRefName: string;
  promotedRefName: string;
  cmpWorktreePath: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpGitAgentBranchRuntimeInput {
  projectRepo: CmpGitProjectRepo;
  lineage: CmpGitLineageNode;
  repoRootPath: string;
  worktreeRootPath?: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createCmpGitAgentBranchRuntime(
  input: CreateCmpGitAgentBranchRuntimeInput,
): CmpGitAgentBranchRuntime {
  const repoRootPath = assertNonEmpty(input.repoRootPath, "CMP git repoRootPath");
  const worktreeRootPath = input.worktreeRootPath?.trim() || `${repoRootPath}/.cmp-worktrees`;
  const branchFamily = input.lineage.branchFamily ?? createCmpGitBranchFamily(input.lineage.agentId);

  return {
    projectId: input.projectRepo.projectId,
    repoId: input.projectRepo.repoId,
    repoName: input.projectRepo.repoName,
    repoRootPath,
    worktreeRootPath,
    agentId: input.lineage.agentId,
    lineageId: input.lineage.lineageId,
    depth: input.lineage.depth,
    parentAgentId: input.lineage.parentAgentId,
    branchFamily,
    checkedRefName: `refs/praxis/cmp/checked/${input.lineage.agentId}`,
    promotedRefName: `refs/praxis/cmp/promoted/${input.lineage.agentId}`,
    cmpWorktreePath: `${worktreeRootPath}/${branchFamily.cmp.branchName.replaceAll("/", "__")}`,
    metadata: {
      status: input.lineage.status,
      ...(input.lineage.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export function resolveCmpGitAgentBranchRuntime(params: {
  registry: CmpGitLineageRegistry;
  projectRepo: CmpGitProjectRepo;
  agentId: string;
  repoRootPath: string;
  worktreeRootPath?: string;
  metadata?: Record<string, unknown>;
}): CmpGitAgentBranchRuntime {
  const lineage = params.registry.get(params.agentId);
  if (!lineage) {
    throw new Error(`CMP git lineage ${params.agentId} was not found.`);
  }
  return createCmpGitAgentBranchRuntime({
    projectRepo: params.projectRepo,
    lineage,
    repoRootPath: params.repoRootPath,
    worktreeRootPath: params.worktreeRootPath,
    metadata: params.metadata,
  });
}

export function listCmpGitBranchRuntimes(params: {
  registry: CmpGitLineageRegistry;
  projectRepo: CmpGitProjectRepo;
  repoRootPath: string;
  worktreeRootPath?: string;
}): readonly CmpGitAgentBranchRuntime[] {
  return params.registry.list().map((lineage) =>
    createCmpGitAgentBranchRuntime({
      projectRepo: params.projectRepo,
      lineage,
      repoRootPath: params.repoRootPath,
      worktreeRootPath: params.worktreeRootPath,
    }),
  );
}
