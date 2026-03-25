import { randomUUID } from "node:crypto";

import type {
  BootstrapCmpProjectInfraInput,
  CommitContextDeltaResult,
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextResult,
  MaterializeContextPackageResult,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotResult,
} from "../agent_core/index.js";
import { summarizeCmpRuntimeInfraProjectState } from "../agent_core/cmp-runtime/infra-state.js";
import { createRaxCmpConfig, type RaxCmpConfig } from "./cmp-config.js";
import type {
  RaxCmpBootstrapInput,
  RaxCmpBootstrapResult,
  RaxCmpCommitInput,
  RaxCmpCreateInput,
  RaxCmpDispatchInput,
  RaxCmpFacade,
  RaxCmpIngestInput,
  RaxCmpMaterializeInput,
  RaxCmpReadbackInput,
  RaxCmpReadbackResult,
  RaxCmpReadbackSummary,
  RaxCmpManualControlInput,
  RaxCmpManualControlSurface,
  RaxCmpRecoverInput,
  RaxCmpRecoverResult,
  RaxCmpRequestHistoryInput,
  RaxCmpResolveInput,
  RaxCmpRuntimeLike,
  RaxCmpSession,
  RaxCmpSmokeCheck,
  RaxCmpSmokeInput,
  RaxCmpSmokeResult,
} from "./cmp-types.js";

export interface CreateRaxCmpFacadeInput {
  runtimeFactory?: (config: RaxCmpConfig) => RaxCmpRuntimeLike;
  now?: () => Date;
  sessionIdFactory?: () => string;
}

function assertRuntime(runtime: RaxCmpRuntimeLike | undefined): RaxCmpRuntimeLike {
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
  recoverySummary?: RaxCmpReadbackSummary["recoverySummary"];
  projectRecovery?: RaxCmpReadbackSummary["projectRecovery"];
  deliverySummary?: RaxCmpReadbackSummary["deliverySummary"];
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

  return {
    projectId: input.projectId,
    status,
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
    recoverySummary: input.recoverySummary,
    projectRecovery: input.projectRecovery,
    deliverySummary: input.deliverySummary,
    issues,
  };
}

export function createRaxCmpFacade(input: CreateRaxCmpFacadeInput = {}): RaxCmpFacade {
  const now = input.now ?? (() => new Date());
  const sessionIdFactory = input.sessionIdFactory ?? randomUUID;

  return {
    create(createInput: RaxCmpCreateInput): RaxCmpSession {
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
    },

    async bootstrap(bootstrapInput: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult> {
      const control = resolveControlSurface({
        projectId: bootstrapInput.session.projectId,
        base: bootstrapInput.session.control,
        override: bootstrapInput.control,
      });
      const receipt = await bootstrapInput.session.runtime.bootstrapCmpProjectInfra(
        resolveBootstrapPayload(bootstrapInput),
      );
      return {
        status: "bootstrapped",
        receipt,
        session: bootstrapInput.session,
        control,
        metadata: bootstrapInput.metadata,
      };
    },

    async readback(readbackInput: RaxCmpReadbackInput): Promise<RaxCmpReadbackResult> {
      const projectId = readbackInput.projectId ?? readbackInput.session.projectId;
      const control = resolveControlSurface({
        projectId,
        base: readbackInput.session.control,
        override: readbackInput.control,
      });
      if (control.executionStyle !== "manual") {
        readbackInput.session.runtime.advanceCmpMqDeliveryTimeouts?.({
          projectId,
        });
      }
      const receipt = readbackInput.session.runtime.getCmpProjectInfraBootstrapReceipt(projectId);
      const infraState = readbackInput.session.runtime.getCmpRuntimeInfraProjectState?.(projectId);
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
        recoverySummary: readbackInput.session.runtime.getCmpRuntimeRecoverySummary?.(),
        projectRecovery: readbackInput.session.runtime.getCmpRuntimeProjectRecoverySummary?.(projectId),
        deliverySummary: readbackInput.session.runtime.getCmpRuntimeDeliveryTruthSummary?.(projectId),
      });
      return {
        status: "found",
        receipt,
        infraState,
        summary,
        control,
        metadata: readbackInput.metadata,
      };
    },

    async recover(recoverInput: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult> {
      const control = resolveControlSurface({
        projectId: recoverInput.session.projectId,
        base: recoverInput.session.control,
        override: recoverInput.control,
      });
      const dryRun = control.truth.recoveryPreference === "dry_run";
      if (!dryRun) {
        await recoverInput.session.runtime.recoverCmpRuntimeSnapshot(recoverInput.snapshot);
      }
      const readback = await this.readback({
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
    },

    async ingest(ingestInput: RaxCmpIngestInput): Promise<IngestRuntimeContextResult> {
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
      return ingestInput.session.runtime.ingestRuntimeContext(ingestInput.payload);
    },

    async commit(commitInput: RaxCmpCommitInput): Promise<CommitContextDeltaResult> {
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
      return commitInput.session.runtime.commitContextDelta(commitInput.payload);
    },

    async resolve(resolveInput: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult> {
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
      return resolveInput.session.runtime.resolveCheckedSnapshot(resolveInput.payload);
    },

    async materialize(
      materializeInput: RaxCmpMaterializeInput,
    ): Promise<MaterializeContextPackageResult> {
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
      return materializeInput.session.runtime.materializeContextPackage(materializeInput.payload);
    },

    async dispatch(dispatchInput: RaxCmpDispatchInput): Promise<DispatchContextPackageResult> {
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
      return dispatchInput.session.runtime.dispatchContextPackage(dispatchInput.payload);
    },

    async requestHistory(
      historyInput: RaxCmpRequestHistoryInput,
    ): Promise<RequestHistoricalContextResult> {
      const control = resolveControlSurface({
        projectId: historyInput.session.projectId,
        base: historyInput.session.control,
        override: historyInput.control,
      });
      const result = await historyInput.session.runtime.requestHistoricalContext({
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
    },

    async smoke(smokeInput: RaxCmpSmokeInput): Promise<RaxCmpSmokeResult> {
      const projectId = smokeInput.projectId ?? smokeInput.session.projectId;
      const control = resolveControlSurface({
        projectId,
        base: smokeInput.session.control,
        override: smokeInput.control,
      });
      const readback = await this.readback({
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

      checks.push({
        id: "cmp.non_five_agent.final_gate",
        gate: "final_acceptance",
        status: checks.some((check) => check.status === "failed")
          ? "failed"
          : checks.some((check) => check.status === "degraded")
            ? "degraded"
            : "ready",
        summary: "CMP non-five-agent final gate aggregates truth, recovery, delivery and manual-control coherence.",
      });

      const status = checks.some((check) => check.status === "failed")
        ? "failed"
        : checks.some((check) => check.status === "degraded")
          ? "degraded"
          : "ready";

      return {
        status,
        checks,
        control,
        metadata: smokeInput.metadata,
      };
    },
  };
}
