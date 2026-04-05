import { randomUUID } from "node:crypto";

import { getCmpRoleConfiguration } from "./configuration.js";
import type {
  CmpCheckerEvaluateInput,
  CmpCheckerRecord,
  CmpIteratorAdvanceInput,
  CmpIteratorRecord,
  CmpPromoteRequestRecord,
  CmpRoleCheckpointRecord,
  CmpIteratorCheckerRuntimeSnapshot,
} from "./types.js";
import { createCmpRoleCheckpointRecord } from "./shared.js";

export interface CmpCheckerRuntimeResult {
  checkerRecord: CmpCheckerRecord;
  promoteRequest?: CmpPromoteRequestRecord;
}

export class CmpIteratorCheckerRuntime {
  readonly #iterator = new Map<string, CmpIteratorRecord>();
  readonly #checker = new Map<string, CmpCheckerRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();
  readonly #promoteRequests = new Map<string, CmpPromoteRequestRecord>();

  advanceIterator(input: CmpIteratorAdvanceInput): CmpIteratorRecord {
    const configuration = getCmpRoleConfiguration("iterator");
    const record: CmpIteratorRecord = {
      loopId: randomUUID(),
      role: "iterator",
      agentId: input.agentId,
      stage: "update_review_ref",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      deltaId: input.deltaId,
      candidateId: input.candidateId,
      branchRef: input.branchRef,
      commitRef: input.commitRef,
      reviewRef: input.reviewRef,
      reviewOutput: {
        sourceRequestId: typeof input.metadata?.sourceRequestId === "string"
          ? input.metadata.sourceRequestId
          : undefined,
        sourceSectionIds: Array.isArray(input.metadata?.sourceSectionIds)
          ? input.metadata.sourceSectionIds.filter((value): value is string => typeof value === "string")
          : [],
        minimumReviewUnit: "commit",
        reviewRefMode: "stable_review_ref",
        handoffTarget: "checker",
      },
      metadata: {
        promptPackId: configuration.promptPack.promptPackId,
        profileId: configuration.profile.profileId,
        capabilityContractId: configuration.capabilityContract.contractId,
        reviewDiscipline: {
          minimumReviewUnit: "commit",
          reviewRefMode: "stable_review_ref",
          gitAuthority: "cmp_primary_writer",
          handoffTarget: "checker",
        },
        stageDiscipline: configuration.profile.ownsStages,
        ...(input.metadata ?? {}),
      },
    };
    this.#iterator.set(record.loopId, record);
    this.#checkpointStages({
      record,
      createdAt: input.createdAt,
      eventRef: input.candidateId,
      stages: ["accept_material", "write_candidate_commit", "update_review_ref"],
    });
    return record;
  }

  evaluateChecker(input: CmpCheckerEvaluateInput): CmpCheckerRuntimeResult {
    const configuration = getCmpRoleConfiguration("checker");
    const checkerRecord: CmpCheckerRecord = {
      loopId: randomUUID(),
      role: "checker",
      agentId: input.agentId,
      stage: input.suggestPromote ? "suggest_promote" : "checked",
      createdAt: input.checkedAt,
      updatedAt: input.checkedAt,
      candidateId: input.candidateId,
      checkedSnapshotId: input.checkedSnapshotId,
      suggestPromote: input.suggestPromote,
      reviewOutput: {
        sourceSectionIds: Array.isArray(input.metadata?.sourceSectionIds)
          ? input.metadata.sourceSectionIds.filter((value): value is string => typeof value === "string")
          : [],
        checkedSectionIds: Array.isArray(input.metadata?.checkedSectionIds)
          ? input.metadata.checkedSectionIds.filter((value): value is string => typeof value === "string")
          : [],
        splitDecisionRefs: [`${input.checkedSnapshotId}:split`],
        mergeDecisionRefs: [`${input.checkedSnapshotId}:merge`],
        trimSummary: "checker trims to section-level high-signal content",
        shortReason: "section-level review completed",
        detailedReason: input.parentAgentId
          ? "checker restructured evidence and prepared a promote-ready handoff for parent DBAgent review"
          : "checker restructured evidence and finalized a local checked snapshot",
      },
      metadata: {
        promptPackId: configuration.promptPack.promptPackId,
        profileId: configuration.profile.profileId,
        capabilityContractId: configuration.capabilityContract.contractId,
        reviewDiscipline: {
          checkedDetachedFromPromote: true,
          evidenceRestructureRequired: true,
          promoteReviewPath: input.parentAgentId
            ? "parent_checker_assist_then_parent_dbagent"
            : "local_checked_only",
        },
        parentHelperSemantics: input.parentAgentId
          ? {
            status: "available",
            mode: "assist_parent_dbagent",
            responsibilities: [
              "evidence_restructure",
              "history_check",
              "narrow_for_child_task",
            ],
          }
          : {
            status: "not_applicable",
          },
        ...(input.metadata ?? {}),
      },
    };
    this.#checker.set(checkerRecord.loopId, checkerRecord);
    this.#checkpointStages({
      record: checkerRecord,
      createdAt: input.checkedAt,
      eventRef: input.checkedSnapshotId,
      stages: input.suggestPromote
        ? ["accept_candidate", "restructure", "checked", "suggest_promote"]
        : ["accept_candidate", "restructure", "checked"],
    });

    const promoteRequest = input.suggestPromote && input.parentAgentId
      ? {
        reviewId: randomUUID(),
        reviewerRole: "dbagent" as const,
        sourceAgentId: input.agentId,
        targetParentAgentId: input.parentAgentId,
        candidateId: input.candidateId,
        checkedSnapshotId: input.checkedSnapshotId,
        status: "pending_parent_dbagent_review" as const,
        createdAt: input.checkedAt,
        requestedAt: input.checkedAt,
        reviewRole: "dbagent" as const,
        metadata: {
          reviewDiscipline: {
            checkedDetachedFromPromote: true,
            parentPrimaryReviewer: "dbagent",
            parentHelperRequired: true,
          },
          promptPackId: configuration.promptPack.promptPackId,
        },
      }
      : undefined;
    if (promoteRequest) {
      this.#promoteRequests.set(promoteRequest.reviewId, promoteRequest);
    }

    return {
      checkerRecord,
      promoteRequest,
    };
  }

  createSnapshot(agentId?: string): CmpIteratorCheckerRuntimeSnapshot {
    const filter = <T extends { agentId: string }>(items: T[]) => agentId ? items.filter((item) => item.agentId === agentId) : items;
    return {
      iteratorRecords: filter([...this.#iterator.values()]),
      checkerRecords: filter([...this.#checker.values()]),
      checkpoints: filter([...this.#checkpoints.values()]),
      promoteRequests: [...this.#promoteRequests.values()].filter((item) => !agentId || item.sourceAgentId === agentId),
    };
  }

  recover(snapshot?: CmpIteratorCheckerRuntimeSnapshot): void {
    this.#iterator.clear();
    this.#checker.clear();
    this.#checkpoints.clear();
    this.#promoteRequests.clear();
    if (!snapshot) return;
    for (const record of snapshot.iteratorRecords) this.#iterator.set(record.loopId, record);
    for (const record of snapshot.checkerRecords) this.#checker.set(record.loopId, record);
    for (const record of snapshot.checkpoints) this.#checkpoints.set(record.checkpointId, record);
    for (const record of snapshot.promoteRequests) this.#promoteRequests.set(record.reviewId, record);
  }

  #checkpointStages(input: {
    record: CmpIteratorRecord | CmpCheckerRecord;
    createdAt: string;
    eventRef: string;
    stages: string[];
  }): void {
    for (const stage of input.stages) {
      const checkpoint = createCmpRoleCheckpointRecord({
        checkpointId: randomUUID(),
        role: input.record.role,
        agentId: input.record.agentId,
        stage,
        createdAt: input.createdAt,
        eventRef: input.eventRef,
        loopId: input.record.loopId,
      });
      this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    }
  }
}

export function createCmpIteratorCheckerRuntime(): CmpIteratorCheckerRuntime {
  return new CmpIteratorCheckerRuntime();
}
