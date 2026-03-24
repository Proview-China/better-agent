import type {
  CmpGitBranchRef,
  CmpGitProjectRepo,
} from "./cmp-git-types.js";
import type {
  CmpGitAgentBranchRuntime,
} from "./branch-runtime.js";
import type {
  CmpGitProjectRepoBootstrapPlan,
} from "./project-repo-bootstrap.js";

export const CMP_GIT_ADAPTER_ERROR_CODES = [
  "bootstrap_failed",
  "branch_conflict",
  "ref_write_failed",
  "readback_failed",
  "lineage_wiring_invalid",
  "unsupported_operation",
] as const;
export type CmpGitAdapterErrorCode = (typeof CMP_GIT_ADAPTER_ERROR_CODES)[number];

export interface CmpGitRefReadback {
  branchRef: CmpGitBranchRef;
  headCommitSha?: string;
  checkedRefName?: string;
  promotedRefName?: string;
  checkedCommitSha?: string;
  promotedCommitSha?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpGitBackendBootstrapReceipt {
  projectRepo: CmpGitProjectRepo;
  repoRootPath: string;
  defaultBranchName: string;
  createdBranchNames: string[];
  status: "bootstrapped" | "already_exists";
  metadata?: Record<string, unknown>;
}

export interface CmpGitBackend {
  bootstrapProjectRepo(
    plan: CmpGitProjectRepoBootstrapPlan,
  ): Promise<CmpGitBackendBootstrapReceipt> | CmpGitBackendBootstrapReceipt;
  bootstrapAgentBranchRuntime(
    runtime: CmpGitAgentBranchRuntime,
  ): Promise<readonly string[]> | readonly string[];
  readBranchHead(
    runtime: CmpGitAgentBranchRuntime,
  ): Promise<CmpGitRefReadback> | CmpGitRefReadback;
  writeCheckedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback> | CmpGitRefReadback;
  writePromotedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback> | CmpGitRefReadback;
}

export class CmpGitAdapterError extends Error {
  readonly code: CmpGitAdapterErrorCode;
  readonly metadata?: Record<string, unknown>;

  constructor(code: CmpGitAdapterErrorCode, message: string, metadata?: Record<string, unknown>) {
    super(message);
    this.name = "CmpGitAdapterError";
    this.code = code;
    this.metadata = metadata;
  }
}

export function isCmpGitAdapterErrorCode(value: string): value is CmpGitAdapterErrorCode {
  return CMP_GIT_ADAPTER_ERROR_CODES.includes(value as CmpGitAdapterErrorCode);
}

export function createCmpGitAdapterError(params: {
  code: CmpGitAdapterErrorCode;
  message: string;
  metadata?: Record<string, unknown>;
}): CmpGitAdapterError {
  return new CmpGitAdapterError(params.code, params.message, params.metadata);
}
