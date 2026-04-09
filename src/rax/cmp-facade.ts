import { randomUUID } from "node:crypto";

import type {
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextResult,
  MaterializeContextPackageResult,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotResult,
  CommitContextDeltaResult,
} from "../agent_core/cmp-types/index.js";
import type { CmpFiveAgentRole } from "../agent_core/cmp-five-agent/index.js";
import type { CmpRuntimeSnapshot } from "../agent_core/cmp-runtime/runtime-snapshot.js";
import type { BootstrapCmpProjectInfraInput } from "../agent_core/runtime.js";
import { summarizeCmpRuntimeInfraProjectState } from "../agent_core/cmp-runtime/infra-state.js";
import { createRaxCmpConfig, type RaxCmpConfig } from "./cmp-config.js";
import type {
  RaxCmpBootstrapInput,
  RaxCmpBootstrapResult,
  RaxCmpCommitInput,
  RaxCmpCreateInput,
  RaxCmpDispatchInput,
  RaxCmpApi,
  RaxCmpAcceptanceReadiness,
  RaxCmpIngestInput,
  RaxCmpMaterializeInput,
  RaxCmpPeerApprovalInput,
  RaxCmpReadbackInput,
  RaxCmpReadbackResult,
  RaxCmpReadinessCheck,
  RaxCmpReadbackSummary,
  RaxCmpManualControlInput,
  RaxCmpManualControlSurface,
  RaxCmpObjectModelReadinessSummary,
  RaxCmpRecoverInput,
  RaxCmpRecoverResult,
  RaxCmpRoleCapabilityAccessInput,
  RaxCmpRoleCapabilityDispatchInput,
  RaxCmpRequestHistoryInput,
  RaxCmpResolveInput,
  RaxCmpPort,
  RaxCmpSession,
  RaxCmpSmokeCheck,
  RaxCmpSmokeInput,
  RaxCmpSmokeResult,
} from "./cmp-types.js";

export interface CreateRaxCmpFacadeInput {
  runtimeFactory?: (config: RaxCmpConfig) => RaxCmpPort;
  now?: () => Date;
  sessionIdFactory?: () => string;
}

function assertRuntime(runtime: RaxCmpPort | undefined): RaxCmpPort {
  if (!runtime) {
    throw new Error("RAX CMP facade requires either input.runtime or a runtimeFactory.");
  }
  return runtime;
}

function resolveBootstrapPayload(input: RaxCmpBootstrapInput): BootstrapCmpProjectInfraInput {
  return {
    projectId: input.payload.projectId ?? input.session.config.projectId,
    repoName: input.payload.repoName ?? input.session.config.git.repoName,
    repoRootPath: input.payload.repoRootPath ?? input.session.config.git.repoRootPath,
    agents: input.payload.agents,
    defaultAgentId: input.payload.defaultAgentId ?? input.session.config.defaultAgentId,
    defaultBranchName: input.payload.defaultBranchName ?? input.session.config.git.defaultBranchName,
    worktreeRootPath: input.payload.worktreeRootPath ?? input.session.config.git.worktreeRootPath,
    databaseName: input.payload.databaseName ?? input.session.config.db.databaseName,
    dbSchemaName: input.payload.dbSchemaName ?? input.session.config.db.schemaName,
    redisNamespaceRoot: input.payload.redisNamespaceRoot ?? input.session.config.mq.namespaceRoot,
    metadata: {
      sessionId: input.session.sessionId,
      ...(input.payload.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

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
        sourceRequestId?: string;
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
        sourceRequestId?: string;
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

function createDefaultControlSurface(projectId: string): RaxCmpManualControlSurface {
  return {
    executionStyle: "automatic",
    mode: "active_preferred",
    scope: {
      lineage: {
        projectIds: [projectId],
        agentIds: [],
        lineageRoots: [],
        branchFamilies: ["cmp"],
        targetAgentIds: [],
      },
      dispatch: "lineage_only",
    },
    truth: {
      readbackPriority: "git_first",
      fallbackPolicy: "git_rebuild",
      recoveryPreference: "reconcile",
    },
    automation: {
      autoIngest: true,
      autoCommit: true,
      autoResolve: true,
      autoMaterialize: true,
      autoDispatch: true,
      autoReturnToCoreAgent: true,
      autoSeedChildren: true,
    },
  };
}

function applyExecutionStyleDefaults(
  base: RaxCmpManualControlSurface,
  executionStyle: RaxCmpManualControlSurface["executionStyle"],
): RaxCmpManualControlSurface {
  if (executionStyle === "manual") {
    return {
      ...base,
      executionStyle,
      automation: {
        autoIngest: false,
        autoCommit: false,
        autoResolve: false,
        autoMaterialize: false,
        autoDispatch: false,
        autoReturnToCoreAgent: false,
        autoSeedChildren: false,
      },
    };
  }

  if (executionStyle === "guided") {
    return {
      ...base,
      executionStyle,
      automation: {
        ...base.automation,
        autoReturnToCoreAgent: false,
        autoSeedChildren: false,
      },
    };
  }

  return {
    ...base,
    executionStyle,
  };
}

function resolveControlSurface(input: {
  projectId: string;
  base?: RaxCmpManualControlSurface;
  override?: RaxCmpManualControlInput;
}): RaxCmpManualControlSurface {
  const starting = structuredClone(input.base ?? createDefaultControlSurface(input.projectId));
  const executionStyle = input.override?.executionStyle ?? starting.executionStyle;
  const withStyleDefaults = applyExecutionStyleDefaults(starting, executionStyle);

  return {
    ...withStyleDefaults,
    mode: input.override?.mode ?? withStyleDefaults.mode,
    scope: {
      lineage: {
        projectIds: uniqueStrings(input.override?.scope?.lineage?.projectIds ?? withStyleDefaults.scope.lineage.projectIds),
        agentIds: uniqueStrings(input.override?.scope?.lineage?.agentIds ?? withStyleDefaults.scope.lineage.agentIds),
        lineageRoots: uniqueStrings(input.override?.scope?.lineage?.lineageRoots ?? withStyleDefaults.scope.lineage.lineageRoots),
        branchFamilies: input.override?.scope?.lineage?.branchFamilies
          ? [...new Set(input.override.scope.lineage.branchFamilies)]
          : [...withStyleDefaults.scope.lineage.branchFamilies],
        targetAgentIds: uniqueStrings(input.override?.scope?.lineage?.targetAgentIds ?? withStyleDefaults.scope.lineage.targetAgentIds),
      },
      dispatch: input.override?.scope?.dispatch ?? withStyleDefaults.scope.dispatch,
    },
    truth: {
      readbackPriority: input.override?.truth?.readbackPriority ?? withStyleDefaults.truth.readbackPriority,
      fallbackPolicy: input.override?.truth?.fallbackPolicy ?? withStyleDefaults.truth.fallbackPolicy,
      recoveryPreference: input.override?.truth?.recoveryPreference ?? withStyleDefaults.truth.recoveryPreference,
    },
    automation: {
      autoIngest: input.override?.automation?.autoIngest ?? withStyleDefaults.automation.autoIngest,
      autoCommit: input.override?.automation?.autoCommit ?? withStyleDefaults.automation.autoCommit,
      autoResolve: input.override?.automation?.autoResolve ?? withStyleDefaults.automation.autoResolve,
      autoMaterialize: input.override?.automation?.autoMaterialize ?? withStyleDefaults.automation.autoMaterialize,
      autoDispatch: input.override?.automation?.autoDispatch ?? withStyleDefaults.automation.autoDispatch,
      autoReturnToCoreAgent: input.override?.automation?.autoReturnToCoreAgent ?? withStyleDefaults.automation.autoReturnToCoreAgent,
      autoSeedChildren: input.override?.automation?.autoSeedChildren ?? withStyleDefaults.automation.autoSeedChildren,
    },
    metadata: {
      ...(withStyleDefaults.metadata ?? {}),
      ...(input.override?.metadata ?? {}),
    },
  };
}

function hasManualOverride(input: {
  control: RaxCmpManualControlSurface;
  payloadMetadata?: Record<string, unknown>;
}): boolean {
  return input.control.executionStyle === "manual"
    || input.control.metadata?.manualOverride === true
    || input.payloadMetadata?.manualOverride === true;
}

function assertAutomationAllowed(input: {
  control: RaxCmpManualControlSurface;
  gate:
    | "autoIngest"
    | "autoCommit"
    | "autoResolve"
    | "autoMaterialize"
    | "autoDispatch"
    | "autoReturnToCoreAgent"
    | "autoSeedChildren";
  label: string;
  payloadMetadata?: Record<string, unknown>;
}): void {
  if (input.control.automation[input.gate]) {
    return;
  }
  if (hasManualOverride({
    control: input.control,
    payloadMetadata: input.payloadMetadata,
  })) {
    return;
  }
  throw new Error(`${input.label} is disabled by the CMP manual control surface.`);
}

function assertDispatchAllowed(input: {
  control: RaxCmpManualControlSurface;
  targetKind: DispatchContextPackageInput["targetKind"];
  payloadMetadata?: Record<string, unknown>;
}): void {
  assertAutomationAllowed({
    control: input.control,
    gate: "autoDispatch",
    label: "CMP automatic dispatch",
    payloadMetadata: input.payloadMetadata,
  });

  const manualOverride = hasManualOverride({
    control: input.control,
    payloadMetadata: input.payloadMetadata,
  });
  if (input.control.scope.dispatch === "disabled" && !manualOverride) {
    throw new Error("CMP dispatch is disabled by the manual control surface.");
  }
  if (input.control.scope.dispatch === "core_agent_only" && input.targetKind !== "core_agent" && !manualOverride) {
    throw new Error("CMP dispatch scope is restricted to core_agent only.");
  }
  if (input.control.scope.dispatch === "manual_targets" && !manualOverride) {
    throw new Error("CMP dispatch requires a manual override for manual_targets scope.");
  }

  if (input.targetKind === "core_agent") {
    assertAutomationAllowed({
      control: input.control,
      gate: "autoReturnToCoreAgent",
      label: "CMP auto-return to core agent",
      payloadMetadata: input.payloadMetadata,
    });
  }
  if (input.targetKind === "child") {
    assertAutomationAllowed({
      control: input.control,
      gate: "autoSeedChildren",
      label: "CMP auto-seed to child agents",
      payloadMetadata: input.payloadMetadata,
    });
  }
}

function createReadbackSummary(input: {
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

export function createRaxCmpFacade(input: CreateRaxCmpFacadeInput = {}): RaxCmpApi {
  const now = input.now ?? (() => new Date());
  const sessionIdFactory = input.sessionIdFactory ?? randomUUID;

  const openSession = (createInput: RaxCmpCreateInput): RaxCmpSession => {
    const config = createRaxCmpConfig(createInput.config);
    const runtime = assertRuntime(
      createInput.runtime ?? input.runtimeFactory?.(config),
    );
    const control = resolveControlSurface({
      projectId: config.projectId,
      override: createInput.control,
    });
    return {
      sessionId: sessionIdFactory(),
      projectId: config.projectId,
      createdAt: now().toISOString(),
      config,
      control,
      runtime,
      metadata: createInput.metadata,
    };
  };

  const bootstrapProject = async (bootstrapInput: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult> => {
    const control = resolveControlSurface({
      projectId: bootstrapInput.session.projectId,
      base: bootstrapInput.session.control,
      override: bootstrapInput.control,
    });
    const receipt = await bootstrapInput.session.runtime.project.bootstrapProjectInfra(
      resolveBootstrapPayload(bootstrapInput),
    );
    return {
      status: "bootstrapped",
      receipt,
      session: bootstrapInput.session,
      control,
      metadata: bootstrapInput.metadata,
    };
  };

  const readbackProject = async (readbackInput: RaxCmpReadbackInput): Promise<RaxCmpReadbackResult> => {
    const projectId = readbackInput.projectId ?? readbackInput.session.projectId;
    const control = resolveControlSurface({
      projectId,
      base: readbackInput.session.control,
      override: readbackInput.control,
    });
    if (control.executionStyle !== "manual") {
      readbackInput.session.runtime.project.advanceDeliveryTimeouts?.({
        projectId,
      });
    }
    const receipt = readbackInput.session.runtime.project.getBootstrapReceipt(projectId);
    const infraState = readbackInput.session.runtime.project.getInfraProjectState?.(projectId);
    if (!receipt && !infraState) {
      return {
        status: "not_found",
        control,
        metadata: readbackInput.metadata,
      };
    }
    const summary = createReadbackSummary({
      projectId,
      control,
      receipt,
      infraState,
      snapshot: readbackInput.session.runtime.project.createSnapshot?.(),
      recoverySummary: readbackInput.session.runtime.project.getRecoverySummary?.(),
      projectRecovery: readbackInput.session.runtime.project.getProjectRecoverySummary?.(projectId),
      deliverySummary: readbackInput.session.runtime.project.getDeliveryTruthSummary?.(projectId),
      fiveAgentSummary: readbackInput.session.runtime.fiveAgent.getSummary?.(control.scope.lineage.agentIds[0]),
      roleCapabilityExecutionBridgeAvailable: Boolean(readbackInput.session.runtime.roles.dispatchCapability),
    });
    return {
      status: "found",
      receipt,
      infraState,
      summary,
      control,
      metadata: readbackInput.metadata,
    };
  };

  const recoverProject = async (recoverInput: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult> => {
    const control = resolveControlSurface({
      projectId: recoverInput.session.projectId,
      base: recoverInput.session.control,
      override: recoverInput.control,
    });
    const dryRun = control.truth.recoveryPreference === "dry_run";
    if (!dryRun) {
      await recoverInput.session.runtime.project.recoverSnapshot(recoverInput.snapshot);
    }
    const readback = await readbackProject({
      session: recoverInput.session,
      projectId: recoverInput.session.projectId,
      control: recoverInput.control,
      metadata: recoverInput.metadata,
    });
    return {
      status: "recovered",
      session: recoverInput.session,
      snapshot: recoverInput.snapshot,
      control,
      readback: readback.summary,
      recovery: {
        status: readback.summary?.projectRecovery?.status === "aligned" || !readback.summary?.projectRecovery
          ? "aligned"
          : "degraded",
        projectRecovery: readback.summary?.projectRecovery,
        appliedPreference: control.truth.recoveryPreference,
        dryRun,
      },
      metadata: recoverInput.metadata,
    };
  };

  const ingestFlow = async (ingestInput: RaxCmpIngestInput): Promise<IngestRuntimeContextResult> => {
    const control = resolveControlSurface({
      projectId: ingestInput.session.projectId,
      base: ingestInput.session.control,
      override: ingestInput.control,
    });
    assertAutomationAllowed({
      control,
      gate: "autoIngest",
      label: "CMP automatic ingest",
      payloadMetadata: ingestInput.payload.metadata,
    });
    return ingestInput.session.runtime.flow.ingest(ingestInput.payload);
  };

  const commitFlow = async (commitInput: RaxCmpCommitInput): Promise<CommitContextDeltaResult> => {
    const control = resolveControlSurface({
      projectId: commitInput.session.projectId,
      base: commitInput.session.control,
      override: commitInput.control,
    });
    assertAutomationAllowed({
      control,
      gate: "autoCommit",
      label: "CMP automatic commit",
      payloadMetadata: commitInput.payload.metadata,
    });
    return commitInput.session.runtime.flow.commit(commitInput.payload);
  };

  const resolveFlow = async (resolveInput: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult> => {
    const control = resolveControlSurface({
      projectId: resolveInput.session.projectId,
      base: resolveInput.session.control,
      override: resolveInput.control,
    });
    assertAutomationAllowed({
      control,
      gate: "autoResolve",
      label: "CMP automatic resolve",
      payloadMetadata: resolveInput.payload.metadata,
    });
    return resolveInput.session.runtime.flow.resolve(resolveInput.payload);
  };

  const materializeFlow = async (
    materializeInput: RaxCmpMaterializeInput,
  ): Promise<MaterializeContextPackageResult> => {
    const control = resolveControlSurface({
      projectId: materializeInput.session.projectId,
      base: materializeInput.session.control,
      override: materializeInput.control,
    });
    assertAutomationAllowed({
      control,
      gate: "autoMaterialize",
      label: "CMP automatic materialization",
      payloadMetadata: materializeInput.payload.metadata,
    });
    return materializeInput.session.runtime.flow.materialize(materializeInput.payload);
  };

  const dispatchFlow = async (dispatchInput: RaxCmpDispatchInput): Promise<DispatchContextPackageResult> => {
    const control = resolveControlSurface({
      projectId: dispatchInput.session.projectId,
      base: dispatchInput.session.control,
      override: dispatchInput.control,
    });
    assertDispatchAllowed({
      control,
      targetKind: dispatchInput.payload.targetKind,
      payloadMetadata: dispatchInput.payload.metadata,
    });
    return dispatchInput.session.runtime.flow.dispatch(dispatchInput.payload);
  };

  const requestHistoryFlow = async (
    historyInput: RaxCmpRequestHistoryInput,
  ): Promise<RequestHistoricalContextResult> => {
    const control = resolveControlSurface({
      projectId: historyInput.session.projectId,
      base: historyInput.session.control,
      override: historyInput.control,
    });
    const result = await historyInput.session.runtime.flow.requestHistory({
      ...historyInput.payload,
      metadata: {
        ...(historyInput.payload.metadata ?? {}),
        readbackPriority: control.truth.readbackPriority,
        fallbackPolicy: control.truth.fallbackPolicy,
        recoveryPreference: control.truth.recoveryPreference,
      },
    });
    if (control.truth.fallbackPolicy === "strict_not_found" && result.metadata?.degraded === true) {
      return {
        status: "not_found",
        found: false,
        metadata: {
          blockedByFallbackPolicy: "strict_not_found",
          originalResult: result.metadata,
        },
      };
    }
    return result;
  };

  const resolveRoleCapabilityAccess = async (roleInput: RaxCmpRoleCapabilityAccessInput) => {
    const rolesPort = roleInput.session.runtime.roles;
    if (!rolesPort.resolveCapabilityAccess) {
      throw new Error("CMP five-agent TAP capability resolution is not available on this runtime.");
    }
    return rolesPort.resolveCapabilityAccess({
      role: roleInput.role,
      sessionId: roleInput.session.sessionId,
      runId: roleInput.payload.metadata?.runId as string ?? `${roleInput.session.sessionId}:cmp-five-agent`,
      agentId: roleInput.payload.agentId,
      capabilityKey: roleInput.payload.capabilityKey,
      reason: roleInput.payload.reason,
      requestedTier: roleInput.payload.requestedTier,
      mode: roleInput.payload.mode,
      taskContext: roleInput.payload.taskContext,
      requestedScope: roleInput.payload.requestedScope,
      requestedDurationMs: roleInput.payload.requestedDurationMs,
      metadata: roleInput.payload.metadata,
    });
  };

  const dispatchRoleCapability = async (roleInput: RaxCmpRoleCapabilityDispatchInput) => {
    const rolesPort = roleInput.session.runtime.roles;
    if (!rolesPort.dispatchCapability) {
      throw new Error("CMP five-agent TAP execution bridge is not available on this runtime.");
    }
    return rolesPort.dispatchCapability({
      role: roleInput.role,
      sessionId: roleInput.session.sessionId,
      runId: roleInput.payload.metadata?.runId as string ?? `${roleInput.session.sessionId}:cmp-five-agent`,
      agentId: roleInput.payload.agentId,
      capabilityKey: roleInput.payload.capabilityKey,
      reason: roleInput.payload.reason,
      capabilityInput: roleInput.payload.capabilityInput,
      priority: roleInput.payload.priority,
      timeoutMs: roleInput.payload.timeoutMs,
      requestedTier: roleInput.payload.requestedTier,
      mode: roleInput.payload.mode,
      taskContext: roleInput.payload.taskContext,
      requestedScope: roleInput.payload.requestedScope,
      requestedDurationMs: roleInput.payload.requestedDurationMs,
      cmpContext: roleInput.payload.cmpContext,
      metadata: roleInput.payload.metadata,
    });
  };

  const approvePeerExchange = async (approvalInput: RaxCmpPeerApprovalInput) => {
    const rolesPort = approvalInput.session.runtime.roles;
    if (!rolesPort.approvePeerExchange) {
      throw new Error("CMP peer exchange approval is not available on this runtime.");
    }
    return rolesPort.approvePeerExchange({
      approvalId: approvalInput.approvalId,
      actorAgentId: approvalInput.actorAgentId,
      decision: approvalInput.decision,
      note: approvalInput.note,
    });
  };

  const smokeProject = async (smokeInput: RaxCmpSmokeInput): Promise<RaxCmpSmokeResult> => {
    const projectId = smokeInput.projectId ?? smokeInput.session.projectId;
    const control = resolveControlSurface({
      projectId,
      base: smokeInput.session.control,
      override: smokeInput.control,
    });
    const readback = await readbackProject({
      session: smokeInput.session,
      projectId,
      control: smokeInput.control,
      metadata: smokeInput.metadata,
    });

    const checks: RaxCmpSmokeCheck[] = [
      {
        id: "cmp.bootstrap.receipt",
        gate: "truth",
        status: readback.receipt ? "ready" : "failed",
        summary: readback.receipt ? "CMP bootstrap receipt is available." : "CMP bootstrap receipt is missing.",
      },
      {
        id: "cmp.infra.state",
        gate: "truth",
        status: readback.infraState ? "ready" : "degraded",
        summary: readback.infraState ? "CMP runtime infra state is available." : "CMP runtime infra state has not been read back yet.",
      },
      {
        id: "cmp.truth.git",
        gate: "truth",
        status: readback.summary?.truthLayers.find((layer) => layer.layer === "git")?.status ?? "failed",
        summary: readback.summary
          ? `CMP git truth is ${readback.summary.truthLayers.find((layer) => layer.layer === "git")?.status ?? "failed"}.`
          : "CMP git truth summary is not available.",
      },
      {
        id: "cmp.git.bootstrap",
        gate: "truth",
        status: readback.summary?.gitBootstrapStatus ? "ready" : "failed",
        summary: readback.summary?.gitBootstrapStatus
          ? `CMP git bootstrap is ${readback.summary.gitBootstrapStatus}.`
          : "CMP git bootstrap status is not available.",
      },
      {
        id: "cmp.truth.db",
        gate: "truth",
        status: readback.summary?.truthLayers.find((layer) => layer.layer === "db")?.status ?? "failed",
        summary: readback.summary
          ? `CMP DB truth is ${readback.summary.truthLayers.find((layer) => layer.layer === "db")?.status ?? "failed"}.`
          : "CMP DB truth summary is not available.",
      },
      {
        id: "cmp.db.readback",
        gate: "truth",
        status: readback.summary?.dbReceiptStatus === "bootstrapped"
          ? "ready"
          : readback.summary?.dbReceiptStatus === "readback_incomplete"
            ? "degraded"
            : "failed",
        summary: readback.summary?.dbReceiptStatus
          ? `CMP DB receipt is ${readback.summary.dbReceiptStatus}.`
          : "CMP DB receipt status is not available.",
      },
      {
        id: "cmp.truth.redis",
        gate: "truth",
        status: readback.summary?.truthLayers.find((layer) => layer.layer === "redis")?.status ?? "failed",
        summary: readback.summary
          ? `CMP Redis truth is ${readback.summary.truthLayers.find((layer) => layer.layer === "redis")?.status ?? "failed"}.`
          : "CMP Redis truth summary is not available.",
      },
      {
        id: "cmp.mq.bootstrap.coverage",
        gate: "delivery",
        status: readback.summary
          ? readback.summary.mqBootstrapCount >= Math.max(1, readback.summary.expectedLineageCount)
            ? "ready"
            : readback.summary.mqBootstrapCount > 0
              ? "degraded"
              : "failed"
          : "failed",
        summary: readback.summary
          ? `CMP mq bootstrap count is ${readback.summary.mqBootstrapCount} for ${readback.summary.expectedLineageCount} expected lineages.`
          : "CMP mq bootstrap coverage is not available.",
      },
      {
        id: "cmp.lineage.coverage",
        gate: "lineage",
        status: readback.summary
          ? readback.summary.expectedLineageCount === 0
            ? "degraded"
            : readback.summary.hydratedLineageCount >= readback.summary.expectedLineageCount
              ? "ready"
              : readback.summary.hydratedLineageCount > 0
                ? "degraded"
                : "failed"
          : "failed",
        summary: readback.summary
          ? `CMP hydrated lineages ${readback.summary.hydratedLineageCount}/${readback.summary.expectedLineageCount}.`
          : "CMP lineage coverage is not available.",
      },
      {
        id: "cmp.recovery.reconciliation",
        gate: "recovery",
        status: !readback.summary?.projectRecovery
          ? "degraded"
          : readback.summary.projectRecovery.status === "aligned"
            ? "ready"
            : readback.summary.projectRecovery.status === "degraded"
              ? "degraded"
              : "failed",
        summary: readback.summary?.projectRecovery
          ? `CMP recovery reconciliation is ${readback.summary.projectRecovery.status} with action ${readback.summary.projectRecovery.recommendedAction}.`
          : "CMP recovery reconciliation summary is not available.",
      },
      {
        id: "cmp.delivery.truth.drift",
        gate: "delivery",
        status: !readback.summary?.deliverySummary
          ? "degraded"
          : readback.summary.deliverySummary.driftCount === 0 && readback.summary.deliverySummary.expiredCount === 0
            ? "ready"
            : readback.summary.deliverySummary.expiredCount > 0
              ? "failed"
              : "degraded",
        summary: readback.summary?.deliverySummary
          ? `CMP delivery truth has ${readback.summary.deliverySummary.driftCount} drifted and ${readback.summary.deliverySummary.expiredCount} expired dispatches.`
          : "CMP delivery truth summary is not available.",
      },
      {
        id: "cmp.manual.control.coherence",
        gate: "manual_control",
        status:
          control.truth.readbackPriority === "reconcile" && !readback.summary?.projectRecovery
            ? "degraded"
            : control.truth.readbackPriority === "redis_first" && !readback.summary?.deliverySummary
              ? "degraded"
              : "ready",
        summary: `CMP control surface uses ${control.truth.readbackPriority}/${control.truth.fallbackPolicy}/${control.truth.recoveryPreference}.`,
      },
    ];
    if (readback.summary?.acceptance) {
      const roleSemanticReadiness = (
        readback.summary.acceptance.fiveAgentLoop.details as
          | { semanticReadiness?: { icma?: boolean; checker?: boolean } }
          | undefined
      )?.semanticReadiness;
      checks.push({
        id: "cmp.object_model.readiness",
        gate: "object_model",
        status: readback.summary.acceptance.objectModel.status,
        summary: readback.summary.acceptance.objectModel.summary,
        metadata: readback.summary.acceptance.objectModel.details,
      });
      checks.push({
        id: "cmp.five_agent.loop",
        gate: "five_agent",
        status: readback.summary.acceptance.fiveAgentLoop.status,
        summary: readback.summary.acceptance.fiveAgentLoop.summary,
        metadata: readback.summary.acceptance.fiveAgentLoop.details,
      });
      checks.push({
        id: "cmp.icma.multi_intent_chunking",
        gate: "five_agent",
        status: roleSemanticReadiness?.icma
          ? "ready"
          : "degraded",
        summary: "CMP ICMA semantic readiness checks multi-intent chunking and auto fragment inference visibility.",
        metadata: readback.summary.acceptance.fiveAgentLoop.details,
      });
      checks.push({
        id: "cmp.checker.execution_semantics",
        gate: "five_agent",
        status: roleSemanticReadiness?.checker
          ? "ready"
          : "degraded",
        summary: "CMP checker semantic readiness checks execution-grade split/merge semantics.",
        metadata: readback.summary.acceptance.fiveAgentLoop.details,
      });
      checks.push({
        id: "cmp.five_agent.live_llm",
        gate: "role_live",
        status: readback.summary.acceptance.liveLlm.status,
        summary: readback.summary.acceptance.liveLlm.summary,
        metadata: readback.summary.acceptance.liveLlm.details,
      });
      checks.push({
        id: "cmp.bundle_schema.readiness",
        gate: "bundle_schema",
        status: readback.summary.acceptance.bundleSchema.status,
        summary: readback.summary.acceptance.bundleSchema.summary,
        metadata: readback.summary.acceptance.bundleSchema.details,
      });
      checks.push({
        id: "cmp.package_strategy.readiness",
        gate: "bundle_schema",
        status: readback.summary.acceptance.bundleSchema.details?.primaryPackageStrategy
          && readback.summary.acceptance.bundleSchema.details?.timelinePackageStrategy
          && readback.summary.acceptance.bundleSchema.details?.taskSnapshotStrategy
          ? "ready"
          : "degraded",
        summary: "CMP DBAgent package strategy surface checks primary/timeline/task snapshot separation.",
        metadata: readback.summary.acceptance.bundleSchema.details,
      });
      checks.push({
        id: "cmp.dispatcher.route_strategy",
        gate: "delivery",
        status: readback.summary.acceptance.bundleSchema.details?.bodyStrategy
          && readback.summary.acceptance.bundleSchema.details?.scopePolicy
          ? "ready"
          : "degraded",
        summary: "CMP dispatcher route strategy checks child/peer/passive body discipline visibility.",
        metadata: readback.summary.acceptance.bundleSchema.details,
      });
      checks.push({
        id: "cmp.tap_execution_bridge.readiness",
        gate: "tap_bridge",
        status: readback.summary.acceptance.tapExecutionBridge.status,
        summary: readback.summary.acceptance.tapExecutionBridge.summary,
        metadata: readback.summary.acceptance.tapExecutionBridge.details,
      });
      checks.push({
        id: "cmp.live_infra.readiness",
        gate: "live_infra",
        status: readback.summary.acceptance.liveInfra.status,
        summary: readback.summary.acceptance.liveInfra.summary,
        metadata: readback.summary.acceptance.liveInfra.details,
      });
      checks.push({
        id: "cmp.recovery.readiness",
        gate: "recovery",
        status: readback.summary.acceptance.recovery.status,
        summary: readback.summary.acceptance.recovery.summary,
        metadata: readback.summary.acceptance.recovery.details,
      });
    }
    if (readback.summary?.fiveAgentSummary) {
      checks.push({
        id: "cmp.five_agent.summary",
        gate: "lineage",
        status: Object.values(readback.summary.fiveAgentSummary.roleCounts).every((count) => count > 0)
          ? "ready"
          : "degraded",
        summary: `CMP five-agent roles observed counts: ${Object.entries(readback.summary.fiveAgentSummary.roleCounts).map(([role, count]) => `${role}:${count}`).join(", ")}.`,
      });
      checks.push({
        id: "cmp.five_agent.configuration",
        gate: "lineage",
        status: Object.values(readback.summary.fiveAgentSummary.configuredRoles).every((entry) =>
          Boolean(entry.promptPackId && entry.profileId && entry.capabilityContractId),
        )
          ? "ready"
          : "failed",
        summary: `CMP five-agent configuration version ${readback.summary.fiveAgentSummary.configurationVersion} is attached to all roles.`,
      });
      checks.push({
        id: "cmp.five_agent.tap_profiles",
        gate: "lineage",
        status: Object.values(readback.summary.fiveAgentSummary.tapProfiles).every((entry) =>
          Boolean(entry.profileId && entry.agentClass && entry.baselineTier),
        )
          ? "ready"
          : "degraded",
        summary: `CMP five-agent TAP profiles attached: ${Object.values(readback.summary.fiveAgentSummary.tapProfiles).map((entry) => `${entry.role}:${entry.profileId}`).join(", ")}.`,
      });
      checks.push({
        id: "cmp.status.panel.surface",
        gate: "final_acceptance",
        status: readback.summary?.statusPanel ? "ready" : "degraded",
        summary: readback.summary?.statusPanel
          ? "CMP status panel surface is available from readback summary."
          : "CMP status panel surface is not attached to readback summary yet.",
      });
      checks.push({
        id: "cmp.five_agent.flow",
        gate: "delivery",
        status: readback.summary.fiveAgentSummary.flow.pendingPeerApprovalCount === 0
          && readback.summary.fiveAgentSummary.flow.reinterventionPendingCount === 0
          ? "ready"
          : "degraded",
        summary: `CMP five-agent flow summary: peer pending ${readback.summary.fiveAgentSummary.flow.pendingPeerApprovalCount}, reintervention pending ${readback.summary.fiveAgentSummary.flow.reinterventionPendingCount}, passive returns ${readback.summary.fiveAgentSummary.flow.passiveReturnCount}.`,
      });
    }

    checks.push({
      id: "cmp.final_acceptance",
      gate: "final_acceptance",
      status: readback.summary?.acceptance.finalAcceptance.status ?? "failed",
      summary: readback.summary?.acceptance.finalAcceptance.summary
        ?? "CMP final acceptance gate is unavailable because readback summary is missing.",
      metadata: {
        issues: readback.summary?.issues ?? [],
      },
    });

    const status = readback.summary?.acceptance.finalAcceptance.status
      ?? (checks.some((check) => check.status === "failed")
        ? "failed"
        : checks.some((check) => check.status === "degraded")
          ? "degraded"
          : "ready");

    return {
      status,
      checks,
      control,
      metadata: smokeInput.metadata,
    };
  };

  return {
    session: {
      open: openSession,
    },
    project: {
      bootstrap: bootstrapProject,
      readback: readbackProject,
      recover: recoverProject,
      smoke: smokeProject,
    },
    flow: {
      ingest: ingestFlow,
      commit: commitFlow,
      resolve: resolveFlow,
      materialize: materializeFlow,
      dispatch: dispatchFlow,
      requestHistory: requestHistoryFlow,
    },
    roles: {
      resolveCapabilityAccess: resolveRoleCapabilityAccess,
      dispatchCapability: dispatchRoleCapability,
      approvePeerExchange,
    },
  };
}
