import {
  applyCmpMqDeliveryProjectionPatchToRecord,
  createCmpMqDeliveryStateFromDeliveryTruth,
  evaluateCmpMqDeliveryTimeout,
  executeCmpProjectInfraBootstrap,
  getCmpRuntimeRecoveryReconciliation,
  hydrateCmpRuntimeSnapshotWithReconciliation,
  type CmpInfraBackends,
  type CmpProjectInfraBootstrapPlan,
  type CmpProjectInfraBootstrapReceipt,
  type CmpRuntimeInfraProjectState,
  type CmpRuntimeSnapshot,
} from "../cmp-runtime/index.js";
import type { DispatchReceipt } from "../cmp-types/index.js";
import type { AgentCoreCmpProjectApi } from "../cmp-api/index.js";
import type {
  AdvanceCmpMqDeliveryTimeoutsInput,
  AdvanceCmpMqDeliveryTimeoutsResult,
  BootstrapCmpProjectInfraInput,
  CmpRuntimeDeliveryTruthSummary,
  CmpRuntimeProjectRecoverySummary,
  CmpRuntimeRecoverySummary,
} from "../runtime.js";

function mapCmpDeliveryRecordStateToTruthStatus(
  state: string,
): "published" | "acknowledged" | "retry_scheduled" | "expired" {
  switch (state) {
    case "pending_ack":
      return "published";
    case "retry_scheduled":
      return "retry_scheduled";
    case "acknowledged":
      return "acknowledged";
    case "expired":
      return "expired";
    default:
      return "published";
  }
}

function mapCmpMqTruthStatusToDispatchStatus(
  status: "published" | "acknowledged" | "expired",
): DispatchReceipt["status"] {
  switch (status) {
    case "acknowledged":
      return "acknowledged";
    case "expired":
      return "expired";
    default:
      return "delivered";
  }
}

export interface AgentCoreCmpProjectServiceDeps {
  readonly cmpInfraBackends: CmpInfraBackends;
  createBootstrapPlan(input: BootstrapCmpProjectInfraInput): CmpProjectInfraBootstrapPlan;
  applyBootstrapReceipt(receipt: CmpProjectInfraBootstrapReceipt): void;
  getBootstrapReceipt(projectId: string): CmpProjectInfraBootstrapReceipt | undefined;
  getInfraProjectState(projectId: string): CmpRuntimeInfraProjectState | undefined;
  createRuntimeSnapshot(): CmpRuntimeSnapshot;
  recoverSnapshot(snapshot: CmpRuntimeSnapshot): void;
  getInfraProjects(): readonly CmpRuntimeInfraProjectState[];
  listDispatchReceipts(): readonly DispatchReceipt[];
  getDispatchProjectId(sourceAgentId: string): string | undefined;
  getDeliveryRecord(dispatchId: string): {
    deliveryId: string;
    state: string;
    metadata?: Record<string, unknown>;
  } | undefined;
  applyDeliveryTimeoutMutation(input: {
    receipt: DispatchReceipt;
    projectionPatch: ReturnType<typeof evaluateCmpMqDeliveryTimeout>["projectionPatch"];
    outcome: ReturnType<typeof evaluateCmpMqDeliveryTimeout>["outcome"];
    state: ReturnType<typeof evaluateCmpMqDeliveryTimeout>["state"];
    now: string;
  }): void;
}

export function createAgentCoreCmpProjectService(
  deps: AgentCoreCmpProjectServiceDeps,
): AgentCoreCmpProjectApi {
  return {
    async bootstrapProjectInfra(input) {
      if (!deps.cmpInfraBackends.git) {
        throw new Error("CMP git backend is not configured on this runtime.");
      }
      if (!deps.cmpInfraBackends.mq) {
        throw new Error("CMP mq backend is not configured on this runtime.");
      }

      const receipt = await executeCmpProjectInfraBootstrap({
        plan: deps.createBootstrapPlan(input),
        gitBackend: deps.cmpInfraBackends.git,
        dbExecutor: deps.cmpInfraBackends.dbExecutor,
        mqAdapter: deps.cmpInfraBackends.mq,
      });
      deps.applyBootstrapReceipt(receipt);
      return receipt;
    },
    getBootstrapReceipt(projectId) {
      return deps.getBootstrapReceipt(projectId);
    },
    getInfraProjectState(projectId) {
      return deps.getInfraProjectState(projectId);
    },
    getRecoverySummary(): CmpRuntimeRecoverySummary {
      const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
        snapshot: deps.createRuntimeSnapshot(),
        projects: deps.getInfraProjects(),
      });
      return recovery.summary;
    },
    getProjectRecoverySummary(projectId): CmpRuntimeProjectRecoverySummary | undefined {
      const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
        snapshot: deps.createRuntimeSnapshot(),
        projects: deps.getInfraProjects(),
      });
      const projectRecovery = getCmpRuntimeRecoveryReconciliation({
        recovery,
        projectId,
      });
      if (!projectRecovery) {
        return undefined;
      }
      return {
        projectId,
        status: projectRecovery.status,
        recommendedAction: projectRecovery.recommendedAction,
        issues: [...projectRecovery.issues],
      };
    },
    getDeliveryTruthSummary(projectId): CmpRuntimeDeliveryTruthSummary {
      const receipts = deps.listDispatchReceipts().filter((receipt) =>
        deps.getDispatchProjectId(receipt.sourceAgentId) === projectId,
      );
      let publishedCount = 0;
      let acknowledgedCount = 0;
      let retryScheduledCount = 0;
      let expiredCount = 0;
      let driftCount = 0;
      let pendingAckCount = 0;
      const issues: string[] = [];

      for (const receipt of receipts) {
        const deliveryRecord = deps.getDeliveryRecord(receipt.dispatchId);
        const truthStatus: "published" | "acknowledged" | "retry_scheduled" | "expired" =
          typeof deliveryRecord?.metadata?.truthStatus === "string"
            && ["published", "acknowledged", "retry_scheduled", "expired"].includes(deliveryRecord.metadata.truthStatus)
            ? deliveryRecord.metadata.truthStatus as "published" | "acknowledged" | "retry_scheduled" | "expired"
            : mapCmpDeliveryRecordStateToTruthStatus(deliveryRecord?.state ?? "pending_delivery");

        if (truthStatus === "acknowledged") {
          acknowledgedCount += 1;
        } else if (truthStatus === "retry_scheduled") {
          retryScheduledCount += 1;
        } else if (truthStatus === "expired") {
          expiredCount += 1;
        } else {
          publishedCount += 1;
        }

        if (truthStatus === "published") {
          pendingAckCount += 1;
        }

        const expectedStatus = mapCmpMqTruthStatusToDispatchStatus(
          truthStatus === "retry_scheduled" ? "published" : truthStatus,
        );
        if (receipt.status !== expectedStatus) {
          driftCount += 1;
        }
        if (truthStatus === "retry_scheduled") {
          issues.push(`CMP delivery ${receipt.dispatchId} is waiting for retry.`);
        }
        if (truthStatus === "expired") {
          issues.push(`CMP delivery ${receipt.dispatchId} has expired.`);
        }
      }

      return {
        projectId,
        totalDispatches: receipts.length,
        publishedCount,
        acknowledgedCount,
        retryScheduledCount,
        expiredCount,
        driftCount,
        pendingAckCount,
        status: expiredCount > 0 || driftCount > 0
          ? "degraded"
          : receipts.length === 0
            ? "failed"
            : "ready",
        issues,
      };
    },
    createSnapshot() {
      return deps.createRuntimeSnapshot();
    },
    recoverSnapshot(snapshot) {
      deps.recoverSnapshot(snapshot);
    },
    advanceDeliveryTimeouts(params: AdvanceCmpMqDeliveryTimeoutsInput = {}): AdvanceCmpMqDeliveryTimeoutsResult {
      const now = params.now ?? new Date().toISOString();
      let processedCount = 0;
      let retryScheduledCount = 0;
      let expiredCount = 0;

      for (const receipt of deps.listDispatchReceipts()) {
        const projectId = deps.getDispatchProjectId(receipt.sourceAgentId);
        if (!projectId) {
          continue;
        }
        if (params.projectId && projectId !== params.projectId) {
          continue;
        }
        const mqReceiptId = typeof receipt.metadata?.mqReceiptId === "string"
          ? receipt.metadata.mqReceiptId
          : undefined;
        if (!mqReceiptId) {
          continue;
        }
        const deliveryRecord = deps.getDeliveryRecord(receipt.dispatchId);
        if (!deliveryRecord) {
          continue;
        }

        const truthState = typeof deliveryRecord.metadata?.truthStatus === "string"
          ? deliveryRecord.metadata.truthStatus
          : mapCmpDeliveryRecordStateToTruthStatus(deliveryRecord.state);
        if (truthState === "acknowledged" || truthState === "expired") {
          continue;
        }

        const deliveryState = createCmpMqDeliveryStateFromDeliveryTruth({
          truth: {
            receiptId: mqReceiptId,
            projectId,
            sourceAgentId: receipt.sourceAgentId,
            channel: (typeof deliveryRecord.metadata?.channel === "string"
              ? deliveryRecord.metadata.channel
              : "local") as "local" | "to_parent" | "peer" | "to_children" | "promotion" | "critical_escalation",
            lane: (typeof receipt.metadata?.mqLane === "string" ? receipt.metadata.mqLane : "stream") as "pubsub" | "stream" | "queue",
            redisKey: typeof receipt.metadata?.mqRedisKey === "string" ? receipt.metadata.mqRedisKey : `cmp:${projectId}:unknown`,
            targetCount: typeof receipt.metadata?.mqTargetCount === "number" ? receipt.metadata.mqTargetCount : 1,
            state: (truthState === "retry_scheduled" ? "published" : truthState) as "published" | "acknowledged" | "expired",
            publishedAt: receipt.deliveredAt ?? now,
            acknowledgedAt: receipt.acknowledgedAt,
            metadata: deliveryRecord.metadata,
          },
          dispatchId: receipt.dispatchId,
          packageId: receipt.packageId,
          targetAgentId: receipt.targetAgentId,
        });
        const evaluated = evaluateCmpMqDeliveryTimeout({
          state: deliveryState,
          now,
        });
        processedCount += 1;
        if (evaluated.outcome === "retry_scheduled") {
          retryScheduledCount += 1;
        } else if (evaluated.outcome === "expired") {
          expiredCount += 1;
        }

        deps.applyDeliveryTimeoutMutation({
          receipt,
          projectionPatch: evaluated.projectionPatch,
          outcome: evaluated.outcome,
          state: evaluated.state,
          now,
        });
      }

      return {
        projectId: params.projectId,
        processedCount,
        retryScheduledCount,
        expiredCount,
      };
    },
  };
}
