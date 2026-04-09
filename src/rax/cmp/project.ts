import type {
  RaxCmpBootstrapInput,
  RaxCmpBootstrapResult,
  RaxCmpProjectApi,
  RaxCmpReadbackInput,
  RaxCmpReadbackResult,
  RaxCmpRecoverInput,
  RaxCmpRecoverResult,
  RaxCmpSmokeCheck,
  RaxCmpSmokeInput,
  RaxCmpSmokeResult,
} from "../cmp-types.js";
import { resolveControlSurface } from "./control.js";
import { createReadbackSummary } from "./readback.js";
import { resolveBootstrapPayload } from "./session.js";

export function createRaxCmpProjectApi(): RaxCmpProjectApi {
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
    async bootstrap(bootstrapInput: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult> {
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
    },
    readback: readbackProject,
    async recover(recoverInput: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult> {
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
    },
    smoke: smokeProject,
  };
}
