import { randomUUID } from "node:crypto";

import type {
  BootstrapCmpProjectInfraInput,
  CommitContextDeltaResult,
  DispatchContextPackageResult,
  IngestRuntimeContextResult,
  MaterializeContextPackageResult,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotResult,
} from "../agent_core/index.js";
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

function createReadbackSummary(input: {
  projectId: string;
  receipt?: RaxCmpReadbackResult["receipt"];
  infraState?: RaxCmpReadbackResult["infraState"];
}): RaxCmpReadbackSummary {
  const expectedLineageCount = input.receipt?.lineages.length ?? 0;
  const hydratedLineageCount = input.infraState?.lineages.length ?? 0;
  const gitBranchBootstrapCount = input.receipt?.gitBranchBootstraps.length
    ?? input.infraState?.gitBranchBootstraps.length
    ?? 0;
  const mqBootstrapCount = input.receipt?.mqBootstraps.length
    ?? input.infraState?.mqBootstraps.length
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

  const status = !input.receipt
    ? "failed"
    : issues.length === 0
      ? "ready"
      : issues.some((issue) => issue.includes("missing"))
        ? "failed"
        : "degraded";

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
      return {
        sessionId: sessionIdFactory(),
        projectId: config.projectId,
        createdAt: now().toISOString(),
        config,
        runtime,
        metadata: createInput.metadata,
      };
    },

    async bootstrap(bootstrapInput: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult> {
      const receipt = await bootstrapInput.session.runtime.bootstrapCmpProjectInfra(
        resolveBootstrapPayload(bootstrapInput),
      );
      return {
        status: "bootstrapped",
        receipt,
        session: bootstrapInput.session,
        metadata: bootstrapInput.metadata,
      };
    },

    async readback(readbackInput: RaxCmpReadbackInput): Promise<RaxCmpReadbackResult> {
      const projectId = readbackInput.projectId ?? readbackInput.session.projectId;
      const receipt = readbackInput.session.runtime.getCmpProjectInfraBootstrapReceipt(projectId);
      const infraState = readbackInput.session.runtime.getCmpRuntimeInfraProjectState?.(projectId);
      if (!receipt && !infraState) {
        return {
          status: "not_found",
          metadata: readbackInput.metadata,
        };
      }
      const summary = createReadbackSummary({
        projectId,
        receipt,
        infraState,
      });
      return {
        status: "found",
        receipt,
        infraState,
        summary,
        metadata: readbackInput.metadata,
      };
    },

    async recover(recoverInput: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult> {
      await recoverInput.session.runtime.recoverCmpRuntimeSnapshot(recoverInput.snapshot);
      return {
        status: "recovered",
        session: recoverInput.session,
        snapshot: recoverInput.snapshot,
        metadata: recoverInput.metadata,
      };
    },

    async ingest(ingestInput: RaxCmpIngestInput): Promise<IngestRuntimeContextResult> {
      return ingestInput.session.runtime.ingestRuntimeContext(ingestInput.payload);
    },

    async commit(commitInput: RaxCmpCommitInput): Promise<CommitContextDeltaResult> {
      return commitInput.session.runtime.commitContextDelta(commitInput.payload);
    },

    async resolve(resolveInput: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult> {
      return resolveInput.session.runtime.resolveCheckedSnapshot(resolveInput.payload);
    },

    async materialize(
      materializeInput: RaxCmpMaterializeInput,
    ): Promise<MaterializeContextPackageResult> {
      return materializeInput.session.runtime.materializeContextPackage(materializeInput.payload);
    },

    async dispatch(dispatchInput: RaxCmpDispatchInput): Promise<DispatchContextPackageResult> {
      return dispatchInput.session.runtime.dispatchContextPackage(dispatchInput.payload);
    },

    async requestHistory(
      historyInput: RaxCmpRequestHistoryInput,
    ): Promise<RequestHistoricalContextResult> {
      return historyInput.session.runtime.requestHistoricalContext(historyInput.payload);
    },

    async smoke(smokeInput: RaxCmpSmokeInput): Promise<RaxCmpSmokeResult> {
      const projectId = smokeInput.projectId ?? smokeInput.session.projectId;
      const readback = await this.readback({
        session: smokeInput.session,
        projectId,
        metadata: smokeInput.metadata,
      });

      const checks: RaxCmpSmokeCheck[] = [
        {
          id: "cmp.bootstrap.receipt",
          status: readback.receipt ? "ready" : "failed",
          summary: readback.receipt ? "CMP bootstrap receipt is available." : "CMP bootstrap receipt is missing.",
        },
        {
          id: "cmp.infra.state",
          status: readback.infraState ? "ready" : "degraded",
          summary: readback.infraState ? "CMP runtime infra state is available." : "CMP runtime infra state has not been read back yet.",
        },
        {
          id: "cmp.git.bootstrap",
          status: readback.summary?.gitBootstrapStatus ? "ready" : "failed",
          summary: readback.summary?.gitBootstrapStatus
            ? `CMP git bootstrap is ${readback.summary.gitBootstrapStatus}.`
            : "CMP git bootstrap status is not available.",
        },
        {
          id: "cmp.db.readback",
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
          id: "cmp.mq.bootstrap.coverage",
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
      ];

      const status = checks.some((check) => check.status === "failed")
        ? "failed"
        : checks.some((check) => check.status === "degraded")
          ? "degraded"
          : "ready";

      return {
        status,
        checks,
        metadata: smokeInput.metadata,
      };
    },
  };
}
