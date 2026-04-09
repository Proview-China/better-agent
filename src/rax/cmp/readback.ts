import type { CmpFiveAgentRole } from "../../agent_core/cmp-five-agent/index.js";
import { summarizeCmpRuntimeInfraProjectState } from "../../agent_core/cmp-runtime/infra-state.js";
import type { CmpRuntimeSnapshot } from "../../agent_core/cmp-runtime/runtime-snapshot.js";
import type {
  RaxCmpAcceptanceReadiness,
  RaxCmpManualControlSurface,
  RaxCmpObjectModelReadinessSummary,
  RaxCmpReadbackResult,
  RaxCmpReadbackSummary,
  RaxCmpReadinessCheck,
} from "../cmp-types.js";

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  return values.reduce<Partial<Record<T, number>>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function createReadinessCheck(
  status: RaxCmpReadinessCheck["status"],
  summary: string,
  details?: Record<string, unknown>,
): RaxCmpReadinessCheck {
  return { status, summary, details };
}

function createObjectModelSummary(
  snapshot?: CmpRuntimeSnapshot,
): RaxCmpObjectModelReadinessSummary | undefined {
  if (!snapshot) {
    return undefined;
  }

  return {
    requestCount: snapshot.requests.length,
    sectionCount: snapshot.sectionRecords.length,
    snapshotCount: snapshot.snapshotRecords.length,
    packageCount: snapshot.packageRecords.length,
    requestStatuses: countBy(snapshot.requests.map((record) => record.status)),
    sectionLifecycleCounts: countBy(snapshot.sectionRecords.map((record) => record.lifecycle)),
    snapshotStageCounts: countBy(snapshot.snapshotRecords.map((record) => record.stage)),
    packageStatusCounts: countBy(snapshot.packageRecords.map((record) => record.status)),
  };
}

function createAcceptanceReadiness(input: {
  objectModel?: RaxCmpObjectModelReadinessSummary;
  fiveAgentSummary?: RaxCmpReadbackSummary["fiveAgentSummary"];
  truthLayers: RaxCmpReadbackSummary["truthLayers"];
  receiptAvailable: boolean;
  infraStateAvailable: boolean;
  recoverySummary?: RaxCmpReadbackSummary["recoverySummary"];
  projectRecovery?: RaxCmpReadbackSummary["projectRecovery"];
  fallbacks: RaxCmpReadbackSummary["fallbacks"];
  roleCapabilityExecutionBridgeAvailable: boolean;
}): RaxCmpAcceptanceReadiness {
  const objectModel = (() => {
    if (!input.objectModel) {
      return createReadinessCheck(
        "degraded",
        "CMP object model summary is unavailable because runtime snapshot surface is missing.",
      );
    }

    const hasAllObjectFamilies =
      input.objectModel.requestCount > 0
      && input.objectModel.sectionCount > 0
      && input.objectModel.snapshotCount > 0
      && input.objectModel.packageCount > 0;
    const hasSectionLifecycleCoverage = ["raw", "pre", "checked", "persisted"].every((state) =>
      (input.objectModel?.sectionLifecycleCounts[state as keyof typeof input.objectModel.sectionLifecycleCounts] ?? 0) > 0,
    );
    const hasSnapshotStageCoverage = ["pre", "checked", "persisted"].every((stage) =>
      (input.objectModel?.snapshotStageCounts[stage as keyof typeof input.objectModel.snapshotStageCounts] ?? 0) > 0,
    );
    const hasPackageCoverage =
      (input.objectModel.packageStatusCounts.materialized ?? 0) > 0
      && ((input.objectModel.packageStatusCounts.dispatched ?? 0) > 0
        || (input.objectModel.packageStatusCounts.served ?? 0) > 0);
    const hasRequestCoverage =
      (input.objectModel.requestStatuses.received ?? 0) > 0
      && (
        (input.objectModel.requestStatuses.reviewed ?? 0) > 0
        || (input.objectModel.requestStatuses.accepted ?? 0) > 0
        || (input.objectModel.requestStatuses.served ?? 0) > 0
      );

    const status = !hasAllObjectFamilies
      ? (input.objectModel.requestCount === 0
        && input.objectModel.sectionCount === 0
        && input.objectModel.snapshotCount === 0
        && input.objectModel.packageCount === 0
          ? "failed"
          : "degraded")
      : hasSectionLifecycleCoverage && hasSnapshotStageCoverage && hasPackageCoverage && hasRequestCoverage
        ? "ready"
        : "degraded";

    return createReadinessCheck(
      status,
      `CMP object model has request=${input.objectModel.requestCount}, section=${input.objectModel.sectionCount}, snapshot=${input.objectModel.snapshotCount}, package=${input.objectModel.packageCount}.`,
      {
        requestStatuses: input.objectModel.requestStatuses,
        sectionLifecycleCounts: input.objectModel.sectionLifecycleCounts,
        snapshotStageCounts: input.objectModel.snapshotStageCounts,
        packageStatusCounts: input.objectModel.packageStatusCounts,
      },
    );
  })();

  const fiveAgentLoop = (() => {
    if (!input.fiveAgentSummary) {
      return createReadinessCheck(
        "degraded",
        "CMP five-agent summary is unavailable, so loop readiness cannot be fully verified.",
      );
    }

    const roleCountsReady = Object.values(input.fiveAgentSummary.roleCounts).every((count) => count > 0);
    const latestStagesReady = Object.values(input.fiveAgentSummary.latestStages).every((stage) => Boolean(stage));
    const icmaOutput = input.fiveAgentSummary.latestRoleMetadata.icma?.structuredOutput as
      | {
        intent?: string;
        sourceAnchorRefs?: string[];
        chunkingMode?: string;
        intentChunks?: Array<{ chunkId?: string }>;
      }
      | undefined;
    const iteratorOutput = input.fiveAgentSummary.latestRoleMetadata.iterator?.reviewOutput as
      | { minimumReviewUnit?: string; progressionVerdict?: string; reviewRefAnnotation?: string }
      | undefined;
    const checkerOutput = input.fiveAgentSummary.latestRoleMetadata.checker?.reviewOutput as
      | {
        trimSummary?: string;
        sourceSectionIds?: string[];
        splitExecutions?: Array<{ decisionRef?: string }>;
        mergeExecutions?: Array<{ decisionRef?: string }>;
      }
      | undefined;
    const dbagentOutput = input.fiveAgentSummary.latestRoleMetadata.dbagent?.materializationOutput as
      | {
        bundleSchemaVersion?: string;
        primaryPackageStrategy?: string;
        timelinePackageStrategy?: string;
        taskSnapshotStrategy?: string;
        passivePackagingStrategy?: string;
      }
      | undefined;
    const dispatcherBundle = input.fiveAgentSummary.latestRoleMetadata.dispatcher?.bundle as
      | {
        target?: { targetIngress?: string };
        body?: { primaryRef?: string; bodyStrategy?: string; slimExchangeFields?: string[] };
        governance?: { scopePolicy?: string };
      }
      | undefined;

    const icmaSemanticsReady = Boolean(
      icmaOutput?.intent
      && (icmaOutput.sourceAnchorRefs?.length ?? 0) > 0
      && icmaOutput.chunkingMode
      && (icmaOutput.intentChunks?.length ?? 0) > 0,
    );
    const iteratorSemanticsReady = Boolean(
      iteratorOutput?.minimumReviewUnit
      && iteratorOutput.progressionVerdict
      && iteratorOutput.reviewRefAnnotation,
    );
    const checkerSemanticsReady = Boolean(
      checkerOutput?.trimSummary
      && (checkerOutput.sourceSectionIds?.length ?? 0) > 0
      && (
        (checkerOutput.splitExecutions?.length ?? 0) > 0
        || (checkerOutput.mergeExecutions?.length ?? 0) > 0
      ),
    );
    const dbagentSemanticsReady = Boolean(
      dbagentOutput?.bundleSchemaVersion
      && dbagentOutput.primaryPackageStrategy
      && dbagentOutput.timelinePackageStrategy
      && dbagentOutput.taskSnapshotStrategy
      && dbagentOutput.passivePackagingStrategy,
    );
    const dispatcherSemanticsReady = Boolean(
      dispatcherBundle?.target?.targetIngress
      && dispatcherBundle?.body?.primaryRef
      && dispatcherBundle?.body?.bodyStrategy
      && dispatcherBundle?.governance?.scopePolicy,
    );

    const ioReady = Boolean(
      icmaSemanticsReady
      && iteratorSemanticsReady
      && checkerSemanticsReady
      && dbagentSemanticsReady
      && dispatcherSemanticsReady,
    );

    const status = roleCountsReady && latestStagesReady && ioReady
      ? "ready"
      : Object.values(input.fiveAgentSummary.roleCounts).every((count) => count === 0)
        ? "failed"
        : "degraded";

    return createReadinessCheck(
      status,
      `CMP five-agent loop role counts are ${Object.entries(input.fiveAgentSummary.roleCounts).map(([role, count]) => `${role}:${count}`).join(", ")}.`,
      {
        latestStages: input.fiveAgentSummary.latestStages,
        checkpointCoverage: input.fiveAgentSummary.recovery.checkpointCoverage,
        semanticReadiness: {
          icma: icmaSemanticsReady,
          iterator: iteratorSemanticsReady,
          checker: checkerSemanticsReady,
          dbagent: dbagentSemanticsReady,
          dispatcher: dispatcherSemanticsReady,
        },
      },
    );
  })();

  const liveLlm = (() => {
    if (!input.fiveAgentSummary) {
      return createReadinessCheck(
        "degraded",
        "CMP five-agent live LLM readiness is unavailable because five-agent summary is missing.",
      );
    }

    const liveEntries = Object.entries(input.fiveAgentSummary.live) as Array<
      [CmpFiveAgentRole, NonNullable<RaxCmpReadbackSummary["fiveAgentSummary"]>["live"][CmpFiveAgentRole]]
    >;
    const succeededRoles = liveEntries
      .filter(([, summary]) => summary.status === "succeeded")
      .map(([role]) => role);
    const rulesOnlyRoles = liveEntries
      .filter(([, summary]) => summary.status === "rules_only" || summary.mode === "rules_only")
      .map(([role]) => role);
    const fallbackRoles = liveEntries
      .filter(([, summary]) => summary.status === "fallback")
      .map(([role]) => role);
    const failedRoles = liveEntries
      .filter(([, summary]) => summary.status === "failed")
      .map(([role]) => role);
    const unknownRoles = liveEntries
      .filter(([, summary]) => summary.status === "unknown" || summary.mode === "unknown")
      .map(([role]) => role);

    const status = failedRoles.length > 0
      ? "failed"
      : rulesOnlyRoles.length === 0 && fallbackRoles.length === 0 && unknownRoles.length === 0
        ? "ready"
        : "degraded";

    return createReadinessCheck(
      status,
      `CMP five-agent live LLM status: succeeded=${succeededRoles.length}, rules_only=${rulesOnlyRoles.length}, fallback=${fallbackRoles.length}, failed=${failedRoles.length}, unknown=${unknownRoles.length}.`,
      {
        roles: Object.fromEntries(liveEntries),
        succeededRoles,
        rulesOnlyRoles,
        fallbackRoles,
        failedRoles,
        unknownRoles,
      },
    );
  })();

  const bundleSchema = (() => {
    if (!input.fiveAgentSummary) {
      return createReadinessCheck(
        "degraded",
        "CMP bundle schema readiness cannot be verified because five-agent summary is unavailable.",
      );
    }

    const dispatcherBundle = input.fiveAgentSummary.latestRoleMetadata.dispatcher?.bundle as
      | {
        target?: { targetIngress?: string };
        body?: { primaryRef?: string; bodyStrategy?: string; slimExchangeFields?: string[] };
        governance?: { scopePolicy?: string };
      }
      | undefined;
    const dbagentOutput = input.fiveAgentSummary.latestRoleMetadata.dbagent?.materializationOutput as
      | {
        bundleSchemaVersion?: string;
        primaryPackageStrategy?: string;
        timelinePackageStrategy?: string;
        taskSnapshotStrategy?: string;
        passivePackagingStrategy?: string;
      }
      | undefined;
    const status = dispatcherBundle?.target?.targetIngress
      && dispatcherBundle?.body?.primaryRef
      && dbagentOutput?.bundleSchemaVersion
      && dbagentOutput?.primaryPackageStrategy
      && dbagentOutput?.timelinePackageStrategy
      && dbagentOutput?.taskSnapshotStrategy
      && dispatcherBundle?.body?.bodyStrategy
      && dispatcherBundle?.governance?.scopePolicy
        ? "ready"
        : "degraded";

    return createReadinessCheck(
      status,
      "CMP bundle schema checks dispatcher target/body fields and DBAgent bundle schema version together.",
      {
        targetIngress: dispatcherBundle?.target?.targetIngress,
        primaryRef: dispatcherBundle?.body?.primaryRef,
        bodyStrategy: dispatcherBundle?.body?.bodyStrategy,
        slimExchangeFields: dispatcherBundle?.body?.slimExchangeFields,
        scopePolicy: dispatcherBundle?.governance?.scopePolicy,
        bundleSchemaVersion: dbagentOutput?.bundleSchemaVersion,
        primaryPackageStrategy: dbagentOutput?.primaryPackageStrategy,
        timelinePackageStrategy: dbagentOutput?.timelinePackageStrategy,
        taskSnapshotStrategy: dbagentOutput?.taskSnapshotStrategy,
        passivePackagingStrategy: dbagentOutput?.passivePackagingStrategy,
      },
    );
  })();

  const tapExecutionBridge = (() => {
    const tapProfilesReady = input.fiveAgentSummary
      ? Object.values(input.fiveAgentSummary.tapProfiles).every((entry) =>
        Boolean(entry.profileId && entry.agentClass && entry.baselineTier),
      )
      : false;
    const status = input.roleCapabilityExecutionBridgeAvailable
      ? tapProfilesReady
        ? "ready"
        : "degraded"
      : "degraded";

    return createReadinessCheck(
      status,
      input.roleCapabilityExecutionBridgeAvailable
        ? "CMP TAP execution bridge is wired and TAP profiles are available for five-agent roles."
        : "CMP TAP execution bridge is not available on the current runtime.",
      input.fiveAgentSummary
        ? {
          tapProfiles: Object.fromEntries(
            Object.entries(input.fiveAgentSummary.tapProfiles).map(([role, entry]) => [role, entry.profileId]),
          ),
        }
        : undefined,
    );
  })();

  const liveInfra = (() => {
    const status = !input.receiptAvailable
      ? "failed"
      : input.receiptAvailable && input.infraStateAvailable && input.truthLayers.every((layer) => layer.status === "ready")
        ? "ready"
        : "degraded";

    return createReadinessCheck(
      status,
      `CMP live infra uses git/db/redis truth layers with statuses ${input.truthLayers.map((layer) => `${layer.layer}:${layer.status}`).join(", ")}.`,
    );
  })();

  const recovery = (() => {
    const checkpointReady = input.fiveAgentSummary
      ? input.fiveAgentSummary.recovery.missingCheckpointRoles.length === 0
      : false;
    const status = input.projectRecovery?.status === "aligned"
      && input.recoverySummary
      && input.fallbacks.recoveryReconciliation !== "unavailable"
      && checkpointReady
        ? "ready"
        : "degraded";

    return createReadinessCheck(
      status,
      input.projectRecovery
        ? `CMP recovery reconciliation is ${input.projectRecovery.status} with action ${input.projectRecovery.recommendedAction}.`
        : "CMP recovery reconciliation has not been attached yet.",
      {
        recoverySummary: input.recoverySummary,
        projectRecovery: input.projectRecovery,
        missingCheckpointRoles: input.fiveAgentSummary?.recovery.missingCheckpointRoles ?? [],
      },
    );
  })();

  const readinessStatuses = [
    objectModel.status,
    fiveAgentLoop.status,
    liveLlm.status,
    bundleSchema.status,
    tapExecutionBridge.status,
    liveInfra.status,
    recovery.status,
  ];
  const finalAcceptance = createReadinessCheck(
    readinessStatuses.includes("failed")
      ? "failed"
      : readinessStatuses.includes("degraded")
        ? "degraded"
        : "ready",
    "CMP final acceptance gate aggregates object model, five-agent loop, bundle schema, TAP execution bridge, live infra, and recovery readiness.",
  );

  return {
    objectModel,
    fiveAgentLoop,
    liveLlm,
    bundleSchema,
    tapExecutionBridge,
    liveInfra,
    recovery,
    finalAcceptance,
  };
}

export function createReadbackSummary(input: {
  projectId: string;
  control: RaxCmpManualControlSurface;
  receipt?: RaxCmpReadbackResult["receipt"];
  infraState?: RaxCmpReadbackResult["infraState"];
  snapshot?: CmpRuntimeSnapshot;
  recoverySummary?: RaxCmpReadbackSummary["recoverySummary"];
  projectRecovery?: RaxCmpReadbackSummary["projectRecovery"];
  deliverySummary?: RaxCmpReadbackSummary["deliverySummary"];
  fiveAgentSummary?: RaxCmpReadbackSummary["fiveAgentSummary"];
  roleCapabilityExecutionBridgeAvailable?: boolean;
}): RaxCmpReadbackSummary {
  const expectedLineageCount = input.receipt?.lineages.length ?? 0;
  const infraSummary = input.infraState
    ? summarizeCmpRuntimeInfraProjectState(input.infraState)
    : undefined;
  const hydratedLineageCount = infraSummary?.hydratedLineageCount ?? 0;
  const gitBranchBootstrapCount = input.receipt?.gitBranchBootstraps.length
    ?? infraSummary?.gitBranchBootstrapCount
    ?? 0;
  const mqBootstrapCount = input.receipt?.mqBootstraps.length
    ?? infraSummary?.mqBootstrapCount
    ?? 0;
  const dbReceipt = input.receipt?.dbReceipt ?? input.infraState?.dbReceipt;

  const issues: string[] = [];
  if (!input.receipt) {
    issues.push("CMP bootstrap receipt is missing.");
  }
  if (!input.infraState) {
    issues.push("CMP runtime infra state is missing.");
  }
  if (dbReceipt?.status === "readback_incomplete") {
    issues.push("CMP DB bootstrap readback is incomplete.");
  }
  if (expectedLineageCount > 0 && hydratedLineageCount < expectedLineageCount) {
    issues.push("CMP hydrated lineage coverage is incomplete.");
  }
  if (expectedLineageCount > 0 && gitBranchBootstrapCount < expectedLineageCount) {
    issues.push("CMP git branch bootstrap coverage is incomplete.");
  }
  if (expectedLineageCount > 0 && mqBootstrapCount < expectedLineageCount) {
    issues.push("CMP mq bootstrap coverage is incomplete.");
  }
  if (input.projectRecovery?.status && input.projectRecovery.status !== "aligned") {
    issues.push(...input.projectRecovery.issues);
  }
  if ((input.deliverySummary?.driftCount ?? 0) > 0) {
    issues.push(`CMP delivery drift detected on ${input.deliverySummary?.driftCount ?? 0} dispatch(es).`);
  }
  if ((input.deliverySummary?.expiredCount ?? 0) > 0) {
    issues.push(`CMP has ${input.deliverySummary?.expiredCount ?? 0} expired delivery truth record(s).`);
  }
  if (input.fiveAgentSummary && Object.values(input.fiveAgentSummary.roleCounts).some((count) => count === 0)) {
    issues.push("CMP five-agent runtime has roles without observed activity yet.");
  }
  if ((input.fiveAgentSummary?.flow.pendingPeerApprovalCount ?? 0) > 0) {
    issues.push(`CMP five-agent has ${input.fiveAgentSummary?.flow.pendingPeerApprovalCount ?? 0} pending peer exchange approval(s).`);
  }
  if ((input.fiveAgentSummary?.flow.reinterventionPendingCount ?? 0) > 0) {
    issues.push(`CMP five-agent has ${input.fiveAgentSummary?.flow.reinterventionPendingCount ?? 0} pending reintervention request(s).`);
  }
  if (input.roleCapabilityExecutionBridgeAvailable === false) {
    issues.push("CMP five-agent TAP execution bridge is not available on this runtime.");
  }
  const latestDispatcherBundle = input.fiveAgentSummary?.latestRoleMetadata.dispatcher?.bundle as
    | { target?: { targetIngress?: string }; body?: { primaryRef?: string } }
    | undefined;
  if (input.fiveAgentSummary && !latestDispatcherBundle?.target?.targetIngress) {
    issues.push("CMP five-agent dispatcher bundle is missing target ingress metadata.");
  }
  const latestDbAgentMaterialization = input.fiveAgentSummary?.latestRoleMetadata.dbagent?.materializationOutput as
    | { bundleSchemaVersion?: string }
    | undefined;
  if (input.fiveAgentSummary && !latestDbAgentMaterialization?.bundleSchemaVersion) {
    issues.push("CMP five-agent DBAgent materialization output is missing bundle schema version.");
  }

  const status = !input.receipt
    ? "failed"
    : issues.length === 0
      ? "ready"
      : issues.some((issue) => issue.includes("missing"))
        ? "failed"
        : "degraded";

  const truthLayers: RaxCmpReadbackSummary["truthLayers"] = [
    {
      layer: "git",
      status:
        (input.receipt?.git.status === "bootstrapped" || input.receipt?.git.status === "already_exists")
        && gitBranchBootstrapCount >= Math.max(1, expectedLineageCount)
        && (infraSummary?.branchRuntimeCount ?? 0) >= Math.max(1, expectedLineageCount)
          ? "ready"
          : input.receipt?.git || infraSummary?.gitStatus
            ? "degraded"
            : "failed",
      truthFor: ["history", "checked_snapshot", "promoted_snapshot"],
      readbackMode: input.receipt?.git ? "receipt" : infraSummary?.gitStatus ? "infra_state" : "reconciled",
      details: {
        bootstrapStatus: input.receipt?.git.status ?? infraSummary?.gitStatus,
        branchBootstrapCount: gitBranchBootstrapCount,
        branchRuntimeCount: infraSummary?.branchRuntimeCount ?? 0,
      },
    },
    {
      layer: "db",
      status: dbReceipt?.status === "bootstrapped"
        ? "ready"
        : dbReceipt?.status === "readback_incomplete"
          ? "degraded"
          : "failed",
      truthFor: ["projection", "context_package"],
      readbackMode: dbReceipt ? "reconciled" : "infra_state",
      details: {
        receiptStatus: dbReceipt?.status,
        expectedTargetCount: dbReceipt?.expectedTargetCount,
        presentTargetCount: dbReceipt?.presentTargetCount,
      },
    },
    {
      layer: "redis",
      status: mqBootstrapCount >= Math.max(1, expectedLineageCount) && (infraSummary?.mqTopicBindingCount ?? 0) > 0
        ? "ready"
        : mqBootstrapCount > 0
          ? "degraded"
          : "failed",
      truthFor: ["dispatch", "ack", "expiry"],
      readbackMode: mqBootstrapCount > 0 ? "infra_state" : "reconciled",
      details: {
        mqBootstrapCount,
        expectedLineageCount,
        topicBindingCount: infraSummary?.mqTopicBindingCount ?? 0,
        deliveryTruthStateCoverage: input.deliverySummary
          ? {
            published: input.deliverySummary.publishedCount,
            acknowledged: input.deliverySummary.acknowledgedCount,
            retryScheduled: input.deliverySummary.retryScheduledCount,
            expired: input.deliverySummary.expiredCount,
          }
          : undefined,
        deliveryDriftDetected: (input.deliverySummary?.driftCount ?? 0) > 0,
        ackDriftCount: input.deliverySummary?.driftCount ?? 0,
      },
    },
  ];

  const readbackPriorityOrder = input.control.truth.readbackPriority === "redis_first"
    ? ["redis", "db", "git"]
    : input.control.truth.readbackPriority === "git_first"
      ? ["git", "db", "redis"]
      : input.control.truth.readbackPriority === "db_first"
        ? ["db", "git", "redis"]
        : ["git", "db", "redis"];
  truthLayers.sort((left, right) => readbackPriorityOrder.indexOf(left.layer) - readbackPriorityOrder.indexOf(right.layer));

  const fallbacks: RaxCmpReadbackSummary["fallbacks"] = {
    gitHistoryRebuild: dbReceipt?.status === "bootstrapped" ? "not_needed" : truthLayers[0].status !== "failed" ? "available" : "unavailable",
    dbProjectionFallback: dbReceipt?.status === "bootstrapped" ? "not_needed" : truthLayers[0].status !== "failed" ? "available" : "unavailable",
    recoveryReconciliation: input.recoverySummary ? "available" : "unavailable",
    redisDeliveryRecovery: input.deliverySummary
      ? input.deliverySummary.driftCount > 0 || input.deliverySummary.expiredCount > 0
        ? "partial"
        : "available"
      : "unavailable",
  };

  const objectModel = createObjectModelSummary(input.snapshot);
  const acceptance = createAcceptanceReadiness({
    objectModel,
    fiveAgentSummary: input.fiveAgentSummary,
    truthLayers,
    receiptAvailable: Boolean(input.receipt),
    infraStateAvailable: Boolean(input.infraState),
    recoverySummary: input.recoverySummary,
    projectRecovery: input.projectRecovery,
    fallbacks,
    roleCapabilityExecutionBridgeAvailable: input.roleCapabilityExecutionBridgeAvailable !== false,
  });

  const latestIcmaStructuredForPanel = input.fiveAgentSummary?.latestRoleMetadata.icma?.structuredOutput as
    | { intentChunks?: Array<unknown>; explicitFragmentIds?: string[]; chunkingMode?: string }
    | undefined;
  const latestIteratorReviewForPanel = input.fiveAgentSummary?.latestRoleMetadata.iterator?.reviewOutput as
    | { progressionVerdict?: string; reviewRefAnnotation?: string }
    | undefined;
  const latestCheckerReviewForPanel = input.fiveAgentSummary?.latestRoleMetadata.checker?.reviewOutput as
    | { splitExecutions?: Array<unknown>; mergeExecutions?: Array<unknown> }
    | undefined;
  const latestDbAgentOutputForPanel = input.fiveAgentSummary?.latestRoleMetadata.dbagent?.materializationOutput as
    | { primaryPackageStrategy?: string; timelinePackageStrategy?: string; taskSnapshotStrategy?: string; passivePackagingStrategy?: string }
    | undefined;
  const latestDispatcherBundleForPanel = input.fiveAgentSummary?.latestRoleMetadata.dispatcher?.bundle as
    | { body?: { bodyStrategy?: string; slimExchangeFields?: string[] }; governance?: { scopePolicy?: string }; target?: { targetIngress?: string }; }
    | undefined;

  if (input.fiveAgentSummary && acceptance.liveLlm.status !== "ready") {
    if (acceptance.liveLlm.status === "failed") {
      issues.push("CMP five-agent live LLM readiness contains failed role execution.");
    } else {
      issues.push("CMP five-agent live LLM readiness is incomplete.");
    }
  }

  const statusPanel: RaxCmpReadbackSummary["statusPanel"] = {
    roles: {
      icma: {
        count: input.fiveAgentSummary?.roleCounts.icma ?? 0,
        latestStage: input.fiveAgentSummary?.latestStages.icma,
        liveMode: input.fiveAgentSummary?.live.icma.mode,
        liveStatus: input.fiveAgentSummary?.live.icma.status,
        fallbackApplied: input.fiveAgentSummary?.live.icma.fallbackApplied,
        semanticSummary: latestIcmaStructuredForPanel
          ? `chunking=${latestIcmaStructuredForPanel.chunkingMode ?? "unknown"}, chunks=${latestIcmaStructuredForPanel.intentChunks?.length ?? 0}, fragments=${latestIcmaStructuredForPanel.explicitFragmentIds?.length ?? 0}`
          : undefined,
      },
      iterator: {
        count: input.fiveAgentSummary?.roleCounts.iterator ?? 0,
        latestStage: input.fiveAgentSummary?.latestStages.iterator,
        liveMode: input.fiveAgentSummary?.live.iterator.mode,
        liveStatus: input.fiveAgentSummary?.live.iterator.status,
        fallbackApplied: input.fiveAgentSummary?.live.iterator.fallbackApplied,
        semanticSummary: latestIteratorReviewForPanel
          ? `verdict=${latestIteratorReviewForPanel.progressionVerdict ?? "unknown"}, annotation=${latestIteratorReviewForPanel.reviewRefAnnotation ?? "none"}`
          : undefined,
      },
      checker: {
        count: input.fiveAgentSummary?.roleCounts.checker ?? 0,
        latestStage: input.fiveAgentSummary?.latestStages.checker,
        liveMode: input.fiveAgentSummary?.live.checker.mode,
        liveStatus: input.fiveAgentSummary?.live.checker.status,
        fallbackApplied: input.fiveAgentSummary?.live.checker.fallbackApplied,
        semanticSummary: latestCheckerReviewForPanel
          ? `split=${latestCheckerReviewForPanel.splitExecutions?.length ?? 0}, merge=${latestCheckerReviewForPanel.mergeExecutions?.length ?? 0}`
          : undefined,
      },
      dbagent: {
        count: input.fiveAgentSummary?.roleCounts.dbagent ?? 0,
        latestStage: input.fiveAgentSummary?.latestStages.dbagent,
        liveMode: input.fiveAgentSummary?.live.dbagent.mode,
        liveStatus: input.fiveAgentSummary?.live.dbagent.status,
        fallbackApplied: input.fiveAgentSummary?.live.dbagent.fallbackApplied,
        semanticSummary: latestDbAgentOutputForPanel
          ? `primary=${latestDbAgentOutputForPanel.primaryPackageStrategy ?? "n/a"}, timeline=${latestDbAgentOutputForPanel.timelinePackageStrategy ?? "n/a"}, task=${latestDbAgentOutputForPanel.taskSnapshotStrategy ?? "n/a"}, passive=${latestDbAgentOutputForPanel.passivePackagingStrategy ?? "n/a"}`
          : undefined,
      },
      dispatcher: {
        count: input.fiveAgentSummary?.roleCounts.dispatcher ?? 0,
        latestStage: input.fiveAgentSummary?.latestStages.dispatcher,
        liveMode: input.fiveAgentSummary?.live.dispatcher.mode,
        liveStatus: input.fiveAgentSummary?.live.dispatcher.status,
        fallbackApplied: input.fiveAgentSummary?.live.dispatcher.fallbackApplied,
        semanticSummary: latestDispatcherBundleForPanel
          ? `body=${latestDispatcherBundleForPanel.body?.bodyStrategy ?? "n/a"}, ingress=${latestDispatcherBundleForPanel.target?.targetIngress ?? "n/a"}, slim=${latestDispatcherBundleForPanel.body?.slimExchangeFields?.length ?? 0}, scope=${latestDispatcherBundleForPanel.governance?.scopePolicy ?? "n/a"}`
          : undefined,
      },
    },
    packageFlow: {
      modeCounts: input.fiveAgentSummary?.flow.packageModeCounts ?? {},
      latestTargetIngress: latestDispatcherBundle?.target?.targetIngress,
      latestPrimaryRef: latestDispatcherBundle?.body?.primaryRef,
    },
    requests: {
      parentPromoteReviewCount: input.fiveAgentSummary?.parentPromoteReviewCount ?? 0,
      pendingPeerApprovalCount: input.fiveAgentSummary?.flow.pendingPeerApprovalCount ?? 0,
      approvedPeerApprovalCount: input.fiveAgentSummary?.flow.approvedPeerApprovalCount ?? 0,
      reinterventionPendingCount: input.fiveAgentSummary?.flow.reinterventionPendingCount ?? 0,
      reinterventionServedCount: input.fiveAgentSummary?.flow.reinterventionServedCount ?? 0,
    },
    health: {
      readbackStatus: acceptance.finalAcceptance.status,
      deliveryDriftCount: input.deliverySummary?.driftCount ?? 0,
      expiredDeliveryCount: input.deliverySummary?.expiredCount ?? 0,
      liveInfraReady: truthLayers.every((layer) => layer.status === "ready"),
      liveLlmReadyCount: input.fiveAgentSummary
        ? Object.values(input.fiveAgentSummary.live).filter((entry) => entry.status === "succeeded").length
        : 0,
      liveLlmFallbackCount: input.fiveAgentSummary
        ? Object.values(input.fiveAgentSummary.live).filter((entry) => entry.status === "fallback").length
        : 0,
      liveLlmFailedCount: input.fiveAgentSummary
        ? Object.values(input.fiveAgentSummary.live).filter((entry) => entry.status === "failed").length
        : 0,
      recoveryStatus: acceptance.recovery.status,
      finalAcceptanceStatus: acceptance.finalAcceptance.status,
    },
    readiness: {
      objectModel: acceptance.objectModel.status,
      fiveAgentLoop: acceptance.fiveAgentLoop.status,
      liveLlm: acceptance.liveLlm.status,
      bundleSchema: acceptance.bundleSchema.status,
      tapExecutionBridge: acceptance.tapExecutionBridge.status,
      liveInfra: acceptance.liveInfra.status,
      recovery: acceptance.recovery.status,
      finalAcceptance: acceptance.finalAcceptance.status,
    },
  };

  return {
    projectId: input.projectId,
    status: acceptance.finalAcceptance.status,
    receiptAvailable: !!input.receipt,
    infraStateAvailable: !!input.infraState,
    gitBootstrapStatus: input.receipt?.git.status ?? input.infraState?.git?.status,
    dbReceiptStatus: dbReceipt?.status,
    gitBranchBootstrapCount,
    mqBootstrapCount,
    expectedLineageCount,
    hydratedLineageCount,
    expectedDbTargetCount: dbReceipt?.expectedTargetCount,
    presentDbTargetCount: dbReceipt?.presentTargetCount,
    appliedReadbackPriority: input.control.truth.readbackPriority,
    appliedFallbackPolicy: input.control.truth.fallbackPolicy,
    appliedRecoveryPreference: input.control.truth.recoveryPreference,
    truthLayers,
    fallbacks,
    objectModel,
    recoverySummary: input.recoverySummary,
    projectRecovery: input.projectRecovery,
    deliverySummary: input.deliverySummary,
    fiveAgentSummary: input.fiveAgentSummary,
    acceptance,
    statusPanel,
    issues,
  };
}
