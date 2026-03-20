import {
  CMP_ACTIVE_LINE_STAGES,
  type CmpActiveLineStage,
  type CmpGitUpdateRef,
  assertNonEmpty,
  createCmpGitUpdateRef,
} from "./runtime-types.js";

export interface CmpActiveLineRecord {
  lineId: string;
  agentId: string;
  deltaRef: string;
  stage: CmpActiveLineStage;
  updatedAt: string;
  gitUpdateRef?: CmpGitUpdateRef;
  snapshotCandidateRef?: string;
  checkedSnapshotRef?: string;
  metadata?: Record<string, unknown>;
}

export interface AdvanceCmpActiveLineInput {
  record: CmpActiveLineRecord;
  nextStage: CmpActiveLineStage;
  updatedAt: string;
  gitUpdateRef?: CmpGitUpdateRef;
  snapshotCandidateRef?: string;
  checkedSnapshotRef?: string;
  metadata?: Record<string, unknown>;
}

const STAGE_INDEX: Record<CmpActiveLineStage, number> = Object.fromEntries(
  CMP_ACTIVE_LINE_STAGES.map((stage, index) => [stage, index]),
) as Record<CmpActiveLineStage, number>;

export function createCmpActiveLineRecord(input: CmpActiveLineRecord): CmpActiveLineRecord {
  return {
    lineId: assertNonEmpty(input.lineId, "CMP active line lineId"),
    agentId: assertNonEmpty(input.agentId, "CMP active line agentId"),
    deltaRef: assertNonEmpty(input.deltaRef, "CMP active line deltaRef"),
    stage: input.stage,
    updatedAt: input.updatedAt,
    gitUpdateRef: input.gitUpdateRef ? createCmpGitUpdateRef(input.gitUpdateRef) : undefined,
    snapshotCandidateRef: input.snapshotCandidateRef?.trim() || undefined,
    checkedSnapshotRef: input.checkedSnapshotRef?.trim() || undefined,
    metadata: input.metadata,
  };
}

export function advanceCmpActiveLineRecord(
  input: AdvanceCmpActiveLineInput,
): CmpActiveLineRecord {
  const current = createCmpActiveLineRecord(input.record);
  if (STAGE_INDEX[input.nextStage] < STAGE_INDEX[current.stage]) {
    throw new Error(
      `CMP active line cannot move backwards from ${current.stage} to ${input.nextStage}.`,
    );
  }
  if (input.nextStage === "candidate_ready" && !input.snapshotCandidateRef?.trim()) {
    throw new Error("CMP active line candidate_ready requires a snapshotCandidateRef.");
  }
  if (input.nextStage === "checked_ready" && !input.checkedSnapshotRef?.trim()) {
    throw new Error("CMP active line checked_ready requires a checkedSnapshotRef.");
  }
  if (STAGE_INDEX[input.nextStage] >= STAGE_INDEX.written_to_git && !input.gitUpdateRef && !current.gitUpdateRef) {
    throw new Error(`CMP active line ${input.nextStage} requires a gitUpdateRef.`);
  }

  return {
    ...current,
    stage: input.nextStage,
    updatedAt: input.updatedAt,
    gitUpdateRef: input.gitUpdateRef ? createCmpGitUpdateRef(input.gitUpdateRef) : current.gitUpdateRef,
    snapshotCandidateRef: input.snapshotCandidateRef?.trim() || current.snapshotCandidateRef,
    checkedSnapshotRef: input.checkedSnapshotRef?.trim() || current.checkedSnapshotRef,
    metadata: input.metadata ?? current.metadata,
  };
}

export function isCmpPromotionPending(record: CmpActiveLineRecord): boolean {
  return record.stage === "promoted_pending";
}

