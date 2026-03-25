import {
  createCmpGitAdapterError,
  type CmpGitBackend,
  type CmpGitBackendBootstrapReceipt,
  type CmpGitRefReadback,
} from "./git-backend.js";
import type { CmpGitAgentBranchRuntime } from "./branch-runtime.js";
import type { CmpGitBranchRef } from "./cmp-git-types.js";
import type { CmpGitProjectRepoBootstrapPlan } from "./project-repo-bootstrap.js";

function createBootstrapKey(params: {
  repoId: string;
  repoRootPath: string;
}): string {
  return `${params.repoId}::${params.repoRootPath}`;
}

function createBranchKey(params: {
  repoId: string;
  branchRef: CmpGitBranchRef;
}): string {
  return `${params.repoId}::${params.branchRef.fullRef}`;
}

function createBranchReadback(runtime: CmpGitAgentBranchRuntime): CmpGitRefReadback {
  return {
    branchRef: runtime.branchFamily.cmp,
    checkedRefName: runtime.checkedRefName,
    promotedRefName: runtime.promotedRefName,
    metadata: {
      cmpWorktreePath: runtime.cmpWorktreePath,
      lineageId: runtime.lineageId,
    },
  };
}

export class InMemoryCmpGitBackend implements CmpGitBackend {
  readonly #bootstrapReceipts = new Map<string, CmpGitBackendBootstrapReceipt>();
  readonly #bootstrappedBranches = new Map<string, string[]>();
  readonly #branchReadbacks = new Map<string, CmpGitRefReadback>();

  bootstrapProjectRepo(plan: CmpGitProjectRepoBootstrapPlan): CmpGitBackendBootstrapReceipt {
    const key = createBootstrapKey({
      repoId: plan.projectRepo.repoId,
      repoRootPath: plan.repoRootPath,
    });
    const existing = this.#bootstrapReceipts.get(key);
    const createdBranchNames = plan.branchKinds.map(
      (kind) => `${kind}/${plan.projectRepo.defaultAgentId}`,
    );

    if (existing) {
      if (
        existing.defaultBranchName !== plan.defaultBranchName
        || existing.repoRootPath !== plan.repoRootPath
      ) {
        throw createCmpGitAdapterError({
          code: "branch_conflict",
          message: `CMP git bootstrap plan for repo ${plan.projectRepo.repoName} conflicts with existing in-memory bootstrap state.`,
          metadata: {
            repoId: plan.projectRepo.repoId,
            repoRootPath: plan.repoRootPath,
            defaultBranchName: plan.defaultBranchName,
          },
        });
      }
      return {
        ...existing,
        status: "already_exists",
      };
    }

    const receipt: CmpGitBackendBootstrapReceipt = {
      projectRepo: plan.projectRepo,
      repoRootPath: plan.repoRootPath,
      defaultBranchName: plan.defaultBranchName,
      createdBranchNames,
      status: "bootstrapped",
      metadata: {
        worktreeRootPath: plan.worktreeRootPath,
        branchKinds: [...plan.branchKinds],
        ...(plan.metadata ?? {}),
      },
    };
    this.#bootstrapReceipts.set(key, receipt);
    this.#bootstrappedBranches.set(plan.projectRepo.repoId, createdBranchNames);
    return receipt;
  }

  bootstrapAgentBranchRuntime(runtime: CmpGitAgentBranchRuntime): readonly string[] {
    const created: string[] = [];
    const knownBranches = this.#bootstrappedBranches.get(runtime.repoId) ?? [];
    for (const branchRef of [
      runtime.branchFamily.work,
      runtime.branchFamily.cmp,
      runtime.branchFamily.mp,
      runtime.branchFamily.tap,
    ]) {
      const key = createBranchKey({
        repoId: runtime.repoId,
        branchRef,
      });
      if (!this.#branchReadbacks.has(key)) {
        this.#branchReadbacks.set(key, {
          branchRef,
          metadata: {
            lineageId: runtime.lineageId,
          },
        });
        created.push(branchRef.branchName);
      }
      if (!knownBranches.includes(branchRef.branchName)) {
        knownBranches.push(branchRef.branchName);
      }
    }
    this.#branchReadbacks.set(
      createBranchKey({
        repoId: runtime.repoId,
        branchRef: runtime.branchFamily.cmp,
      }),
      createBranchReadback(runtime),
    );
    this.#bootstrappedBranches.set(runtime.repoId, knownBranches);
    return created;
  }

  readBranchHead(runtime: CmpGitAgentBranchRuntime): CmpGitRefReadback {
    return this.#requireReadback(runtime);
  }

  writeCheckedRef(runtime: CmpGitAgentBranchRuntime, commitSha: string): CmpGitRefReadback {
    const current = this.#requireReadback(runtime);
    const next: CmpGitRefReadback = {
      ...current,
      branchRef: runtime.branchFamily.cmp,
      headCommitSha: commitSha.trim(),
      checkedRefName: runtime.checkedRefName,
      checkedCommitSha: commitSha.trim(),
      promotedRefName:
        current.promotedCommitSha === commitSha.trim() ? current.promotedRefName : undefined,
      promotedCommitSha:
        current.promotedCommitSha === commitSha.trim() ? current.promotedCommitSha : undefined,
      metadata: {
        ...(current.metadata ?? {}),
        lastWrite: "checked_ref",
      },
    };
    this.#storeReadback(runtime, next);
    return next;
  }

  writePromotedRef(runtime: CmpGitAgentBranchRuntime, commitSha: string): CmpGitRefReadback {
    const current = this.#requireReadback(runtime);
    if (!current.checkedCommitSha) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: `CMP git promoted ref for ${runtime.agentId} requires an active checked ref first.`,
        metadata: {
          repoId: runtime.repoId,
          branchName: runtime.branchFamily.cmp.branchName,
        },
      });
    }
    if (current.checkedCommitSha !== commitSha.trim()) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: `CMP git promoted ref for ${runtime.agentId} must match checked commit ${current.checkedCommitSha}.`,
        metadata: {
          repoId: runtime.repoId,
          branchName: runtime.branchFamily.cmp.branchName,
          checkedCommitSha: current.checkedCommitSha,
          requestedCommitSha: commitSha.trim(),
        },
      });
    }

    const next: CmpGitRefReadback = {
      ...current,
      branchRef: runtime.branchFamily.cmp,
      headCommitSha: commitSha.trim(),
      promotedRefName: runtime.promotedRefName,
      promotedCommitSha: commitSha.trim(),
      metadata: {
        ...(current.metadata ?? {}),
        lastWrite: "promoted_ref",
      },
    };
    this.#storeReadback(runtime, next);
    return next;
  }

  #requireReadback(runtime: CmpGitAgentBranchRuntime): CmpGitRefReadback {
    const key = createBranchKey({
      repoId: runtime.repoId,
      branchRef: runtime.branchFamily.cmp,
    });
    const readback = this.#branchReadbacks.get(key);
    if (!readback) {
      throw createCmpGitAdapterError({
        code: "readback_failed",
        message: `CMP git branch runtime for ${runtime.agentId} has not been bootstrapped yet.`,
        metadata: {
          repoId: runtime.repoId,
          branchName: runtime.branchFamily.cmp.branchName,
        },
      });
    }
    return readback;
  }

  #storeReadback(runtime: CmpGitAgentBranchRuntime, readback: CmpGitRefReadback): void {
    this.#branchReadbacks.set(
      createBranchKey({
        repoId: runtime.repoId,
        branchRef: runtime.branchFamily.cmp,
      }),
      readback,
    );
  }
}

export function createInMemoryCmpGitBackend(): InMemoryCmpGitBackend {
  return new InMemoryCmpGitBackend();
}
