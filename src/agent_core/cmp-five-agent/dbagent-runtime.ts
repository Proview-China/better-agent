import { getCmpRoleConfiguration } from "./configuration.js";
import {
  attachCmpRoleLiveAudit,
  executeCmpRoleLiveLlmStep,
  toCmpRoleLiveAuditFromTrace,
} from "./live-llm.js";
import {
  createCmpReinterventionRequestRecord,
  createCmpFiveAgentLoopRecord,
  createCmpPackageFamilyRecord,
  createCmpPromoteReviewRecord,
  createCmpRoleCheckpointRecord,
  createCmpSkillSnapshotRecord,
} from "./shared.js";
import type {
  CmpDbAgentMaterializeInput,
  CmpDbAgentMaterializeResult,
  CmpDbAgentPassiveInput,
  CmpDbAgentRecord,
  CmpDbAgentRuntimeSnapshot,
  CmpReinterventionRequestRecord,
  CmpParentPromoteReviewRecord,
  CmpRoleCheckpointRecord,
  CmpTaskSkillSnapshot,
} from "./types.js";
import type { CmpRoleLiveLlmExecutor, CmpRoleLiveLlmMode } from "./types.js";

type CmpDbAgentLiveMaterializationOutput = Partial<CmpDbAgentRecord["materializationOutput"]>;

export function createCmpTimelinePackageRef(contextPackageRef: string): string {
  return `${contextPackageRef}:timeline`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeCurrentStateRefs(input: {
  currentPackageId?: string;
  metadata?: Record<string, unknown>;
}): string[] {
  const fromMetadata = Array.isArray(input.metadata?.currentStateRefs)
    ? input.metadata.currentStateRefs.filter((value): value is string => typeof value === "string")
    : [];
  const refs = input.currentPackageId ? [input.currentPackageId, ...fromMetadata] : fromMetadata;
  return uniqueStrings(refs);
}

export class CmpDbAgentRuntime {
  readonly #records = new Map<string, CmpDbAgentRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();
  readonly #packageFamilies = new Map<string, ReturnType<typeof createCmpPackageFamilyRecord>>();
  readonly #taskSnapshots = new Map<string, CmpTaskSkillSnapshot>();
  readonly #parentPromoteReviews = new Map<string, CmpParentPromoteReviewRecord>();
  readonly #reinterventionRequests = new Map<string, CmpReinterventionRequestRecord>();

  get reinterventionRequests(): CmpReinterventionRequestRecord[] {
    return [...this.#reinterventionRequests.values()];
  }

  materialize(input: CmpDbAgentMaterializeInput): CmpDbAgentMaterializeResult {
    const taskSnapshot: CmpTaskSkillSnapshot = createCmpSkillSnapshotRecord({
      snapshotId: `${input.contextPackage.packageId}:task-state`,
      taskRef: `${input.checkedSnapshot.agentId}:${input.checkedSnapshot.snapshotId}`,
      summaryRef: input.checkedSnapshot.snapshotId,
      createdAt: input.createdAt,
      metadata: {
        source: "cmp-five-agent-dbagent",
      },
    });
    const family = createCmpPackageFamilyRecord({
      familyId: `${input.contextPackage.packageId}:family`,
      primaryPackageId: input.contextPackage.packageId,
      primaryPackageRef: input.contextPackage.packageRef,
      timelinePackageId: `${input.contextPackage.packageId}:timeline`,
      timelinePackageRef: createCmpTimelinePackageRef(input.contextPackage.packageRef),
      taskSnapshotIds: [taskSnapshot.snapshotId],
      createdAt: input.createdAt,
      metadata: {
        packageTopology: "active_plus_timeline_plus_task_snapshots",
      },
    });
    const loop: CmpDbAgentRecord = {
      ...createCmpFiveAgentLoopRecord({
        loopId: input.loopId,
        role: "dbagent",
        agentId: input.checkedSnapshot.agentId,
        projectId: input.checkedSnapshot.metadata?.projectId as string | undefined,
        stage: "attach_snapshots",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        metadata: {
          dbWriteAuthority: "dbagent_only",
          packageAuthority: "dbagent_primary_packer",
          packageBundle: {
            topology: "active_plus_timeline_plus_task_snapshots",
            primaryPackageId: input.contextPackage.packageId,
            timelinePackageId: family.timelinePackageId,
            taskSnapshotIds: family.taskSnapshotIds,
          },
        },
      }),
      projectionId: input.projectionId,
      familyId: family.familyId,
      primaryPackageId: input.contextPackage.packageId,
      timelinePackageId: family.timelinePackageId,
      taskSnapshotIds: family.taskSnapshotIds,
      materializationOutput: {
        requestId: typeof input.metadata?.sourceRequestId === "string" ? input.metadata.sourceRequestId : undefined,
        sourceSnapshotId: input.checkedSnapshot.snapshotId,
        sourceSectionIds: Array.isArray(input.metadata?.sourceSectionIds)
          ? input.metadata.sourceSectionIds.filter((value): value is string => typeof value === "string")
          : [],
        packageTopology: "active_plus_timeline_plus_task_snapshots",
        bundleSchemaVersion: "cmp-dispatch-bundle/v1",
        primaryPackageStrategy: "materialize_active_context_as_primary_package",
        timelinePackageStrategy: "attach_timeline_as_secondary_package",
        taskSnapshotStrategy: "emit_task_snapshot_per_checked_context",
      },
    };
    this.#records.set(loop.loopId, loop);
    this.#packageFamilies.set(family.familyId, family);
    this.#taskSnapshots.set(taskSnapshot.snapshotId, taskSnapshot);
    for (const [index, stage] of ["accept_checked", "project", "materialize_package", "attach_snapshots"].entries()) {
      const checkpoint = createCmpRoleCheckpointRecord({
        checkpointId: `${input.loopId}:cp:${index}`,
        role: "dbagent",
        agentId: loop.agentId,
        stage,
        createdAt: input.createdAt,
        eventRef: input.checkedSnapshot.snapshotId,
        metadata: {
          source: "cmp-five-agent-dbagent",
        },
        loopId: input.loopId,
      });
      this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    }
    return {
      loop,
      family,
      taskSnapshots: [taskSnapshot],
    };
  }

  async materializeWithLlm(
    input: CmpDbAgentMaterializeInput,
    options: {
      mode?: CmpRoleLiveLlmMode;
      executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, CmpDbAgentLiveMaterializationOutput>;
    } = {},
  ): Promise<CmpDbAgentMaterializeResult> {
    const rulesResult = this.materialize(input);
    const configuration = getCmpRoleConfiguration("dbagent");
    const live = await executeCmpRoleLiveLlmStep<Record<string, unknown>, CmpDbAgentLiveMaterializationOutput>({
      role: "dbagent",
      agentId: rulesResult.loop.agentId,
      mode: options.mode,
      stage: "materialize_package",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "organize differentiated dbagent package materialization strategy for primary package timeline package and task snapshots",
      schemaTitle: "CmpDbAgentMaterializationOutput",
      schemaFields: [
        "requestId",
        "sourceSnapshotId",
        "sourceSectionIds",
        "packageTopology",
        "bundleSchemaVersion",
        "primaryPackageStrategy",
        "timelinePackageStrategy",
        "taskSnapshotStrategy",
        "materializationRationale",
      ],
      requestInput: {
        projectionId: input.projectionId,
        packageId: input.contextPackage.packageId,
        packageRef: input.contextPackage.packageRef,
        checkedSnapshotId: input.checkedSnapshot.snapshotId,
        materializationOutput: rulesResult.loop.materializationOutput,
      },
      fallbackOutput: {},
      executor: options.executor,
      metadata: {
        loopId: rulesResult.loop.loopId,
      },
    });

    const updatedLoop: CmpDbAgentRecord = {
      ...rulesResult.loop,
      materializationOutput: {
        ...rulesResult.loop.materializationOutput,
        ...live.output,
        bundleSchemaVersion: "cmp-dispatch-bundle/v1",
      },
      liveTrace: live.trace,
        metadata: attachCmpRoleLiveAudit({
          metadata: rulesResult.loop.metadata,
          audit: toCmpRoleLiveAuditFromTrace(live.trace),
          extras: live.output.materializationRationale
            ? {
            materializationRationale: live.output.materializationRationale,
            primaryPackageStrategy: live.output.primaryPackageStrategy,
            timelinePackageStrategy: live.output.timelinePackageStrategy,
            taskSnapshotStrategy: live.output.taskSnapshotStrategy,
          }
          : undefined,
      }),
    };
    this.#records.set(updatedLoop.loopId, updatedLoop);

    return {
      ...rulesResult,
      loop: updatedLoop,
    };
  }

  servePassive(input: CmpDbAgentPassiveInput): CmpDbAgentMaterializeResult {
    const family = createCmpPackageFamilyRecord({
      familyId: `${input.contextPackage.packageId}:family`,
      primaryPackageId: input.contextPackage.packageId,
      primaryPackageRef: input.contextPackage.packageRef,
      timelinePackageId: `${input.contextPackage.packageId}:timeline`,
      timelinePackageRef: createCmpTimelinePackageRef(input.contextPackage.packageRef),
      taskSnapshotIds: [`${input.contextPackage.packageId}:task-state`],
      createdAt: input.createdAt,
      metadata: {
        passiveDefaultPayload: "ContextPackage",
      },
    });
    const taskSnapshot: CmpTaskSkillSnapshot = createCmpSkillSnapshotRecord({
      snapshotId: `${input.contextPackage.packageId}:task-state`,
      taskRef: `${input.request.requesterAgentId}:${input.snapshot.snapshotId}`,
      summaryRef: input.snapshot.snapshotId,
      createdAt: input.createdAt,
      metadata: {
        source: "cmp-five-agent-dbagent-passive",
      },
    });
    const loop: CmpDbAgentRecord = {
      ...createCmpFiveAgentLoopRecord({
        loopId: input.loopId,
        role: "dbagent",
        agentId: input.request.requesterAgentId,
        projectId: input.request.projectId,
        stage: "serve_passive",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        metadata: {
          passiveDefaultPayload: "ContextPackage",
          packageAuthority: "dbagent_primary_packer",
          packageBundle: {
            topology: "passive_reply_plus_timeline_plus_task_snapshots",
            primaryPackageId: input.contextPackage.packageId,
            timelinePackageId: family.timelinePackageId,
            taskSnapshotIds: family.taskSnapshotIds,
            passiveReplyPackageId: input.contextPackage.packageId,
          },
        },
      }),
      projectionId: input.contextPackage.sourceProjectionId,
      familyId: family.familyId,
      primaryPackageId: input.contextPackage.packageId,
      timelinePackageId: family.timelinePackageId,
      taskSnapshotIds: family.taskSnapshotIds,
      passiveReplyPackageId: input.contextPackage.packageId,
      materializationOutput: {
        requestId: typeof input.metadata?.sourceRequestId === "string" ? input.metadata.sourceRequestId : undefined,
        sourceSnapshotId: input.snapshot.snapshotId,
        sourceSectionIds: Array.isArray(input.metadata?.sourceSectionIds)
          ? input.metadata.sourceSectionIds.filter((value): value is string => typeof value === "string")
          : [],
        packageTopology: "passive_reply_plus_timeline_plus_task_snapshots",
        bundleSchemaVersion: "cmp-dispatch-bundle/v1",
        primaryPackageStrategy: "materialize_passive_reply_as_primary_package",
        timelinePackageStrategy: "attach_timeline_for_historical_recall",
        taskSnapshotStrategy: "emit_task_snapshot_for_passive_history",
        passivePackagingStrategy: "historical_reply_clean_return",
      },
    };
    this.#records.set(loop.loopId, loop);
    this.#packageFamilies.set(family.familyId, family);
    this.#taskSnapshots.set(taskSnapshot.snapshotId, taskSnapshot);
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.loopId}:cp:passive`,
      role: "dbagent",
      agentId: loop.agentId,
      stage: "serve_passive",
      createdAt: input.createdAt,
      eventRef: input.request.requesterAgentId,
      metadata: {
        source: "cmp-five-agent-dbagent-passive",
      },
      loopId: input.loopId,
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return {
      loop,
      family,
      taskSnapshots: [taskSnapshot],
    };
  }

  async servePassiveWithLlm(
    input: CmpDbAgentPassiveInput,
    options: {
      mode?: CmpRoleLiveLlmMode;
      executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, CmpDbAgentLiveMaterializationOutput>;
    } = {},
  ): Promise<CmpDbAgentMaterializeResult> {
    const rulesResult = this.servePassive(input);
    const configuration = getCmpRoleConfiguration("dbagent");
    const live = await executeCmpRoleLiveLlmStep<Record<string, unknown>, CmpDbAgentLiveMaterializationOutput>({
      role: "dbagent",
      agentId: rulesResult.loop.agentId,
      mode: options.mode,
      stage: "serve_passive",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "organize differentiated dbagent passive reply packaging strategy",
      schemaTitle: "CmpDbAgentPassiveMaterializationOutput",
      schemaFields: [
        "requestId",
        "sourceSnapshotId",
        "sourceSectionIds",
        "packageTopology",
        "bundleSchemaVersion",
        "primaryPackageStrategy",
        "timelinePackageStrategy",
        "taskSnapshotStrategy",
        "passivePackagingStrategy",
        "materializationRationale",
      ],
      requestInput: {
        requesterAgentId: input.request.requesterAgentId,
        packageId: input.contextPackage.packageId,
        packageRef: input.contextPackage.packageRef,
        snapshotId: input.snapshot.snapshotId,
        materializationOutput: rulesResult.loop.materializationOutput,
      },
      fallbackOutput: {},
      executor: options.executor,
      metadata: {
        loopId: rulesResult.loop.loopId,
      },
    });

    const updatedLoop: CmpDbAgentRecord = {
      ...rulesResult.loop,
      materializationOutput: {
        ...rulesResult.loop.materializationOutput,
        ...live.output,
        bundleSchemaVersion: "cmp-dispatch-bundle/v1",
      },
      liveTrace: live.trace,
        metadata: attachCmpRoleLiveAudit({
          metadata: rulesResult.loop.metadata,
          audit: toCmpRoleLiveAuditFromTrace(live.trace),
          extras: live.output.materializationRationale
            ? {
            materializationRationale: live.output.materializationRationale,
            primaryPackageStrategy: live.output.primaryPackageStrategy,
            timelinePackageStrategy: live.output.timelinePackageStrategy,
            taskSnapshotStrategy: live.output.taskSnapshotStrategy,
            passivePackagingStrategy: live.output.passivePackagingStrategy,
          }
          : undefined,
      }),
    };
    this.#records.set(updatedLoop.loopId, updatedLoop);

    return {
      ...rulesResult,
      loop: updatedLoop,
    };
  }

  reviewPromote(input: {
    sourceAgentId: string;
    parentAgentId: string;
    candidateId: string;
    checkedSnapshotId: string;
    reviewId: string;
    createdAt: string;
  }): CmpParentPromoteReviewRecord {
    const review = {
      ...createCmpPromoteReviewRecord({
        reviewId: input.reviewId,
        reviewerRole: "dbagent",
        sourceAgentId: input.sourceAgentId,
        targetParentAgentId: input.parentAgentId,
        candidateId: input.candidateId,
        checkedSnapshotId: input.checkedSnapshotId,
        status: "pending_parent_dbagent_review",
        createdAt: input.createdAt,
        metadata: {
          source: "cmp-five-agent-dbagent-parent-review",
          parentPrimaryReviewer: true,
          reviewPolicy: {
            primaryReviewer: "dbagent",
            parentReviewEntry: true,
            reviewChain: "child_checker_then_parent_dbagent",
          },
        },
      }),
      reviewedAt: input.createdAt,
      stage: "ready" as const,
      reviewRole: "dbagent" as const,
      parentAgentId: input.parentAgentId,
      childAgentId: input.sourceAgentId,
      projectionId: `projection:${input.checkedSnapshotId}`,
    };
    this.#parentPromoteReviews.set(review.reviewId, review);
    return review;
  }

  requestReintervention(input: {
    requestId: string;
    childAgentId: string;
    parentAgentId: string;
    gapSummary: string;
    currentStateSummary: string;
    currentPackageId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }): CmpReinterventionRequestRecord {
    const currentStateRefs = normalizeCurrentStateRefs({
      currentPackageId: input.currentPackageId,
      metadata: input.metadata,
    });
    const request = createCmpReinterventionRequestRecord({
      requestId: input.requestId,
      parentAgentId: input.parentAgentId,
      childAgentId: input.childAgentId,
      requestedByRole: "dbagent",
      status: "pending_parent_dbagent_review",
      gapSummary: input.gapSummary,
      currentStateSummary: input.currentStateSummary,
      currentPackageId: input.currentPackageId,
      createdAt: input.createdAt,
      metadata: {
        source: "cmp-five-agent-dbagent-reintervention",
        reinterventionPayload: {
          gapSummary: input.gapSummary,
          currentStateSummary: input.currentStateSummary,
          currentPackageId: input.currentPackageId,
          currentStateRefs,
          requestStatus: "pending_parent_dbagent_review",
        },
        ...(input.metadata ?? {}),
      },
    });
    this.#reinterventionRequests.set(request.requestId, request);
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.requestId}:cp:reintervention:pending`,
      role: "dbagent",
      agentId: input.parentAgentId,
      stage: "project",
      createdAt: input.createdAt,
      eventRef: input.requestId,
      loopId: undefined,
      metadata: {
        source: "cmp-five-agent-dbagent-reintervention",
        requestStatus: request.status,
      },
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return request;
  }

  serveReintervention(input: {
    requestId: string;
    servedPackageId: string;
    resolvedAt: string;
    metadata?: Record<string, unknown>;
  }): CmpReinterventionRequestRecord {
    const current = this.#reinterventionRequests.get(input.requestId);
    if (!current) {
      throw new Error(`CMP DBAgent reintervention request ${input.requestId} was not found.`);
    }
    const next = createCmpReinterventionRequestRecord({
      ...current,
      status: "served",
      resolvedAt: input.resolvedAt,
      servedPackageId: input.servedPackageId,
      metadata: {
        ...(current.metadata ?? {}),
        reinterventionPayload: {
          gapSummary: current.gapSummary,
          currentStateSummary: current.currentStateSummary,
          currentPackageId: current.currentPackageId,
          currentStateRefs: normalizeCurrentStateRefs({
            currentPackageId: current.currentPackageId,
            metadata: current.metadata,
          }),
          requestStatus: "served",
          servedPackageId: input.servedPackageId,
          resolvedAt: input.resolvedAt,
        },
        ...(input.metadata ?? {}),
      },
    });
    this.#reinterventionRequests.set(next.requestId, next);
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.requestId}:cp:reintervention:served`,
      role: "dbagent",
      agentId: current.parentAgentId,
      stage: "materialize_package",
      createdAt: input.resolvedAt,
      eventRef: input.servedPackageId,
      loopId: undefined,
      metadata: {
        source: "cmp-five-agent-dbagent-reintervention",
        requestStatus: next.status,
      },
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return next;
  }

  createSnapshot(agentId?: string): CmpDbAgentRuntimeSnapshot {
    return {
      records: [...this.#records.values()].filter((record) => !agentId || record.agentId === agentId),
      checkpoints: [...this.#checkpoints.values()].filter((record) => !agentId || record.agentId === agentId),
      packageFamilies: [...this.#packageFamilies.values()],
      taskSnapshots: [...this.#taskSnapshots.values()],
      parentPromoteReviews: [...this.#parentPromoteReviews.values()].filter((record) => !agentId || record.sourceAgentId === agentId || record.targetParentAgentId === agentId),
      reinterventionRequests: [...this.#reinterventionRequests.values()].filter((record) => !agentId || record.childAgentId === agentId || record.parentAgentId === agentId),
    };
  }

  recover(snapshot?: CmpDbAgentRuntimeSnapshot): void {
    this.#records.clear();
    this.#checkpoints.clear();
    this.#packageFamilies.clear();
    this.#taskSnapshots.clear();
    this.#parentPromoteReviews.clear();
    this.#reinterventionRequests.clear();
    if (!snapshot) return;
    for (const record of snapshot.records) this.#records.set(record.loopId, record);
    for (const record of snapshot.checkpoints) this.#checkpoints.set(record.checkpointId, record);
    for (const record of snapshot.packageFamilies) this.#packageFamilies.set(record.familyId, record);
    for (const record of snapshot.taskSnapshots) this.#taskSnapshots.set(record.snapshotId, record);
    for (const record of snapshot.parentPromoteReviews) this.#parentPromoteReviews.set(record.reviewId, record);
    for (const record of snapshot.reinterventionRequests) this.#reinterventionRequests.set(record.requestId, record);
  }
}

export function createCmpDbAgentRuntime(): CmpDbAgentRuntime {
  return new CmpDbAgentRuntime();
}
