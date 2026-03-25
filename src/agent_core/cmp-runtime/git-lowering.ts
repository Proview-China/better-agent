import type {
  CmpGitAgentBranchRuntime,
  CmpGitBackend,
  CmpGitRefReadback,
} from "../cmp-git/index.js";

export interface ExecuteCmpGitSnapshotLoweringInput {
  backend: CmpGitBackend;
  runtime: CmpGitAgentBranchRuntime;
  commitSha: string;
  promotedCommitSha?: string;
}

export interface CmpGitSnapshotLoweringResult {
  initialReadback: CmpGitRefReadback;
  checkedReadback: CmpGitRefReadback;
  promotedReadback?: CmpGitRefReadback;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export async function executeCmpGitSnapshotLowering(
  input: ExecuteCmpGitSnapshotLoweringInput,
): Promise<CmpGitSnapshotLoweringResult> {
  const commitSha = assertNonEmpty(input.commitSha, "CMP git lowering commitSha");
  const initialReadback = await input.backend.readBranchHead(input.runtime);
  const checkedReadback = await input.backend.writeCheckedRef(input.runtime, commitSha);

  if (!input.promotedCommitSha?.trim()) {
    return {
      initialReadback,
      checkedReadback,
    };
  }

  const promotedReadback = await input.backend.writePromotedRef(
    input.runtime,
    assertNonEmpty(input.promotedCommitSha, "CMP git lowering promotedCommitSha"),
  );
  return {
    initialReadback,
    checkedReadback,
    promotedReadback,
  };
}
