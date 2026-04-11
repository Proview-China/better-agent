import { randomUUID } from "node:crypto";

import { getCmpRoleConfiguration } from "./configuration.js";
import {
  attachCmpRoleLiveAudit,
  executeCmpRoleLiveLlmStep,
} from "./live-llm.js";
import type {
  CmpCheckerEvaluateInput,
  CmpCheckerRecord,
  CmpIteratorAdvanceInput,
  CmpIteratorRecord,
  CmpPromoteRequestRecord,
  CmpRoleConfiguration,
  CmpRoleCheckpointRecord,
  CmpIteratorCheckerRuntimeSnapshot,
  CmpRoleLiveLlmExecutor,
  CmpRoleLiveLlmMode,
} from "./types.js";
import { createCmpRoleCheckpointRecord } from "./shared.js";

export interface CmpCheckerRuntimeResult {
  checkerRecord: CmpCheckerRecord;
  promoteRequest?: CmpPromoteRequestRecord;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeProgressionVerdict(value: unknown): CmpIteratorRecord["reviewOutput"]["progressionVerdict"] {
  if (value === "hold" || value === "advance_review" || value === "advance_commit") {
    return value;
  }
  return undefined;
}

function normalizeSplitExecutions(value: unknown): NonNullable<CmpCheckerRecord["reviewOutput"]["splitExecutions"]> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      decisionRef: typeof item.decisionRef === "string" && item.decisionRef.trim().length > 0
        ? item.decisionRef.trim()
        : "",
      sourceSectionId: typeof item.sourceSectionId === "string" && item.sourceSectionId.trim().length > 0
        ? item.sourceSectionId.trim()
        : "",
      proposedSectionIds: Array.isArray(item.proposedSectionIds)
        ? item.proposedSectionIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
      rationale: typeof item.rationale === "string" && item.rationale.trim().length > 0
        ? item.rationale.trim()
        : "",
    }))
    .filter((item) =>
      item.decisionRef.length > 0
      && item.sourceSectionId.length > 0
      && item.proposedSectionIds.length > 0
      && item.rationale.length > 0
    );
}

function normalizeMergeExecutions(value: unknown): NonNullable<CmpCheckerRecord["reviewOutput"]["mergeExecutions"]> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      decisionRef: typeof item.decisionRef === "string" && item.decisionRef.trim().length > 0
        ? item.decisionRef.trim()
        : "",
      sourceSectionIds: Array.isArray(item.sourceSectionIds)
        ? item.sourceSectionIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
      targetSectionId: typeof item.targetSectionId === "string" && item.targetSectionId.trim().length > 0
        ? item.targetSectionId.trim()
        : "",
      rationale: typeof item.rationale === "string" && item.rationale.trim().length > 0
        ? item.rationale.trim()
        : "",
    }))
    .filter((item) =>
      item.decisionRef.length > 0
      && item.sourceSectionIds.length > 1
      && item.targetSectionId.length > 0
      && item.rationale.length > 0
    );
}

function toLiveAuditStatus(status: "rules_only" | "live_applied" | "fallback_rules"): "rules_only" | "llm_applied" | "fallback_applied" {
  return status === "live_applied"
    ? "llm_applied"
    : status === "fallback_rules"
      ? "fallback_applied"
      : "rules_only";
}

export class CmpIteratorCheckerRuntime {
  readonly #iteratorConfiguration: CmpRoleConfiguration;
  readonly #checkerConfiguration: CmpRoleConfiguration;
  readonly #iterator = new Map<string, CmpIteratorRecord>();
  readonly #checker = new Map<string, CmpCheckerRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();
  readonly #promoteRequests = new Map<string, CmpPromoteRequestRecord>();

  constructor(options: {
    iteratorConfiguration?: CmpRoleConfiguration;
    checkerConfiguration?: CmpRoleConfiguration;
  } = {}) {
    this.#iteratorConfiguration = options.iteratorConfiguration ?? getCmpRoleConfiguration("iterator");
    this.#checkerConfiguration = options.checkerConfiguration ?? getCmpRoleConfiguration("checker");
  }

  advanceIterator(input: CmpIteratorAdvanceInput): CmpIteratorRecord {
    const configuration = this.#iteratorConfiguration;
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
        progressionVerdict: "advance_review",
        reviewRefAnnotation: "candidate prepared as the next auditable review unit",
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

  async advanceIteratorWithLlm(input: CmpIteratorAdvanceInput, options: {
    mode?: CmpRoleLiveLlmMode;
    executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, Record<string, unknown>>;
  } = {}): Promise<CmpIteratorRecord> {
    const record = this.advanceIterator(input);
    const configuration = this.#iteratorConfiguration;
    const live = await executeCmpRoleLiveLlmStep({
      role: "iterator",
      agentId: input.agentId,
      mode: options.mode,
      stage: "update_review_ref",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "decide iterator progression verdict and annotate stable review ref for checker handoff",
      schemaTitle: "CmpIteratorReviewOutput",
      schemaFields: ["sourceSectionIds", "progressionVerdict", "reviewRefAnnotation", "commitRationale"],
      requestInput: {
        deltaId: input.deltaId,
        candidateId: input.candidateId,
        commitRef: input.commitRef,
        reviewRef: input.reviewRef,
        minimumReviewUnit: record.reviewOutput.minimumReviewUnit,
        sourceSectionIds: record.reviewOutput.sourceSectionIds,
      },
      fallbackOutput: {
        sourceSectionIds: record.reviewOutput.sourceSectionIds,
        progressionVerdict: record.reviewOutput.progressionVerdict,
        reviewRefAnnotation: record.reviewOutput.reviewRefAnnotation,
        commitRationale: undefined,
      },
      executor: options.executor,
      metadata: {
        promptId: configuration.promptPack.promptPackId,
      },
    });

    const nextRecord: CmpIteratorRecord = {
      ...record,
      reviewOutput: {
        ...record.reviewOutput,
        sourceSectionIds: normalizeStringArray(live.output.sourceSectionIds, record.reviewOutput.sourceSectionIds),
        progressionVerdict: normalizeProgressionVerdict(live.output.progressionVerdict) ?? record.reviewOutput.progressionVerdict,
        reviewRefAnnotation: typeof live.output.reviewRefAnnotation === "string" && live.output.reviewRefAnnotation.trim()
          ? live.output.reviewRefAnnotation
          : record.reviewOutput.reviewRefAnnotation,
        commitRationale: typeof live.output.commitRationale === "string" ? live.output.commitRationale : record.reviewOutput.commitRationale,
      },
      liveTrace: live.trace,
      metadata: attachCmpRoleLiveAudit({
        metadata: record.metadata,
        audit: {
          mode: live.mode,
          status: toLiveAuditStatus(live.status),
          provider: live.trace.provider,
          model: live.trace.model,
          requestId: live.trace.requestId,
          error: live.trace.errorMessage,
          fallbackApplied: live.trace.fallbackApplied,
        },
      }),
    };
    this.#iterator.set(nextRecord.loopId, nextRecord);
    return nextRecord;
  }

  evaluateChecker(input: CmpCheckerEvaluateInput): CmpCheckerRuntimeResult {
    const configuration = this.#checkerConfiguration;
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
        splitExecutions: [
          {
            decisionRef: `${input.checkedSnapshotId}:split`,
            sourceSectionId: Array.isArray(input.metadata?.sourceSectionIds)
              ? (input.metadata.sourceSectionIds.find((value): value is string => typeof value === "string") ?? `${input.checkedSnapshotId}:source`)
              : `${input.checkedSnapshotId}:source`,
            proposedSectionIds: Array.isArray(input.metadata?.checkedSectionIds)
              ? input.metadata.checkedSectionIds.filter((value): value is string => typeof value === "string")
              : [`${input.checkedSnapshotId}:split:0`],
            rationale: "split candidate sections into executable checked targets",
          },
        ],
        mergeExecutions: Array.isArray(input.metadata?.checkedSectionIds)
          && input.metadata.checkedSectionIds.filter((value): value is string => typeof value === "string").length > 1
          ? [
            {
              decisionRef: `${input.checkedSnapshotId}:merge`,
              sourceSectionIds: input.metadata.checkedSectionIds.filter((value): value is string => typeof value === "string"),
              targetSectionId: `${input.checkedSnapshotId}:merge:target`,
              rationale: "merge overlapping checked sections into one executable review target",
            },
          ]
          : [],
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

  async evaluateCheckerWithLlm(input: CmpCheckerEvaluateInput, options: {
    mode?: CmpRoleLiveLlmMode;
    executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, Record<string, unknown>>;
  } = {}): Promise<CmpCheckerRuntimeResult> {
    const evaluated = this.evaluateChecker(input);
    const configuration = this.#checkerConfiguration;
    const live = await executeCmpRoleLiveLlmStep({
      role: "checker",
      agentId: input.agentId,
      mode: options.mode,
      stage: input.suggestPromote ? "suggest_promote" : "checked",
      createdAt: input.checkedAt,
      configuration,
      taskLabel: "restructure checked evidence into high-signal review output with executable split and merge semantics",
      schemaTitle: "CmpCheckerReviewOutput",
      schemaFields: ["sourceSectionIds", "checkedSectionIds", "splitExecutions", "mergeExecutions", "trimSummary", "shortReason", "detailedReason", "promoteRationale"],
      requestInput: {
        candidateId: input.candidateId,
        checkedSnapshotId: input.checkedSnapshotId,
        suggestPromote: input.suggestPromote,
        sourceSectionIds: evaluated.checkerRecord.reviewOutput.sourceSectionIds,
        checkedSectionIds: evaluated.checkerRecord.reviewOutput.checkedSectionIds,
      },
      fallbackOutput: {
        ...evaluated.checkerRecord.reviewOutput,
      },
      executor: options.executor,
      metadata: {
        promptId: configuration.promptPack.promptPackId,
      },
    });

    const nextCheckerRecord: CmpCheckerRecord = {
      ...evaluated.checkerRecord,
      reviewOutput: {
        ...evaluated.checkerRecord.reviewOutput,
        sourceSectionIds: normalizeStringArray(live.output.sourceSectionIds, evaluated.checkerRecord.reviewOutput.sourceSectionIds),
        checkedSectionIds: normalizeStringArray(live.output.checkedSectionIds, evaluated.checkerRecord.reviewOutput.checkedSectionIds),
        splitExecutions: normalizeSplitExecutions(live.output.splitExecutions).length > 0
          ? normalizeSplitExecutions(live.output.splitExecutions)
          : evaluated.checkerRecord.reviewOutput.splitExecutions,
        mergeExecutions: normalizeMergeExecutions(live.output.mergeExecutions).length > 0
          ? normalizeMergeExecutions(live.output.mergeExecutions)
          : evaluated.checkerRecord.reviewOutput.mergeExecutions,
        trimSummary: typeof live.output.trimSummary === "string" && live.output.trimSummary.trim()
          ? live.output.trimSummary
          : evaluated.checkerRecord.reviewOutput.trimSummary,
        shortReason: typeof live.output.shortReason === "string" && live.output.shortReason.trim()
          ? live.output.shortReason
          : evaluated.checkerRecord.reviewOutput.shortReason,
        detailedReason: typeof live.output.detailedReason === "string" && live.output.detailedReason.trim()
          ? live.output.detailedReason
          : evaluated.checkerRecord.reviewOutput.detailedReason,
        promoteRationale: typeof live.output.promoteRationale === "string" ? live.output.promoteRationale : undefined,
      },
      liveTrace: live.trace,
      metadata: attachCmpRoleLiveAudit({
        metadata: evaluated.checkerRecord.metadata,
        audit: {
          mode: live.mode,
          status: toLiveAuditStatus(live.status),
          provider: live.trace.provider,
          model: live.trace.model,
          requestId: live.trace.requestId,
          error: live.trace.errorMessage,
          fallbackApplied: live.trace.fallbackApplied,
        },
      }),
    };

    this.#checker.set(nextCheckerRecord.loopId, nextCheckerRecord);

    return {
      checkerRecord: nextCheckerRecord,
      promoteRequest: evaluated.promoteRequest,
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

export function createCmpIteratorCheckerRuntime(options: {
  iteratorConfiguration?: CmpRoleConfiguration;
  checkerConfiguration?: CmpRoleConfiguration;
} = {}): CmpIteratorCheckerRuntime {
  return new CmpIteratorCheckerRuntime(options);
}
