import type {
  AgentCoreCmpTapReviewApertureV1,
  AgentCoreCmpWorksiteApi,
  AgentCoreCmpWorksiteState,
  AgentCoreCmpWorksiteTurnArtifactInput,
} from "../cmp-api/index.js";
import type { CoreCmpWorksitePackageV1 } from "../core-prompt/types.js";
import type { CmpFiveAgentSummary, CmpFiveAgentRuntimeSnapshot } from "../cmp-five-agent/index.js";
import type { AgentCoreCmpStateStore } from "./state-store.js";
import type { AgentCoreCmpWorksiteStateRecord } from "./state-store.js";

function makeWorksiteKey(sessionId: string, agentId: string): string {
  return `${sessionId}::${agentId}`;
}

function toDeliveryStatus(
  cmp: AgentCoreCmpWorksiteTurnArtifactInput["cmp"],
): AgentCoreCmpWorksiteState["deliveryStatus"] {
  if (cmp.syncStatus === "skipped") {
    return "skipped";
  }
  if (cmp.syncStatus === "warming" || cmp.syncStatus === "ingested" || cmp.syncStatus === "checked" || cmp.syncStatus === "materialized") {
    return "pending";
  }
  if (cmp.syncStatus === "failed") {
    return "partial";
  }
  const values = [
    cmp.packageId,
    cmp.packageRef,
    cmp.projectionId,
    cmp.snapshotId,
    cmp.intent,
    cmp.operatorGuide,
    cmp.childGuide,
    cmp.checkerReason,
    cmp.routeRationale,
    cmp.scopePolicy,
    cmp.packageStrategy,
    cmp.timelineStrategy,
  ].map((value) => value.trim().toLowerCase());
  if (values.some((value) => value === "pending")) {
    return "pending";
  }
  if (values.some((value) => value === "missing")) {
    return "partial";
  }
  return "available";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readCmpSummary(
  value: AgentCoreCmpWorksiteTurnArtifactInput["cmp"],
): CmpFiveAgentSummary | undefined {
  const summary = (value as Record<string, unknown>).summary;
  return summary && typeof summary === "object"
    ? summary as CmpFiveAgentSummary
    : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim()))];
}

function readSourceAnchorRefs(snapshot: CmpFiveAgentRuntimeSnapshot, summary: CmpFiveAgentSummary): string[] {
  const dispatcherBundle = asRecord(summary.latestRoleMetadata.dispatcher?.bundle);
  const fromDispatcher = readStringArray(dispatcherBundle?.sourceAnchorRefs);
  if (fromDispatcher.length > 0) {
    return fromDispatcher;
  }
  const icmaOutput = asRecord(summary.latestRoleMetadata.icma?.structuredOutput);
  const fromIcma = readStringArray(icmaOutput?.sourceAnchorRefs);
  if (fromIcma.length > 0) {
    return fromIcma;
  }
  return snapshot.dispatcherRecords.at(-1)?.bundle.sourceAnchorRefs ?? [];
}

function createLatestStages(summary: CmpFiveAgentSummary): string[] {
  return Object.entries(summary.latestStages)
    .filter(([, stage]) => typeof stage === "string" && stage.trim().length > 0)
    .map(([role, stage]) => `${role}:${stage}`);
}

function createReviewStateSummary(summary: CmpFiveAgentSummary): string | undefined {
  const parts = [
    summary.parentPromoteReviewCount > 0 ? `parent review ${summary.parentPromoteReviewCount}` : undefined,
    summary.flow.pendingPeerApprovalCount > 0 ? `peer approval pending ${summary.flow.pendingPeerApprovalCount}` : undefined,
    summary.flow.reinterventionPendingCount > 0 ? `reintervention pending ${summary.flow.reinterventionPendingCount}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function createUnresolvedStateSummary(summary: CmpFiveAgentSummary): string | undefined {
  const parts = [
    summary.flow.pendingPeerApprovalCount > 0 ? `pending peer approvals=${summary.flow.pendingPeerApprovalCount}` : undefined,
    summary.parentPromoteReviewCount > 0 ? `parent reviews=${summary.parentPromoteReviewCount}` : undefined,
    summary.flow.reinterventionPendingCount > 0 ? `reinterventions=${summary.flow.reinterventionPendingCount}` : undefined,
    summary.recovery.missingCheckpointRoles.length > 0
      ? `missing checkpoints=${summary.recovery.missingCheckpointRoles.join("|")}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function createRouteStateSummary(summary: CmpFiveAgentSummary): string | undefined {
  const dispatcherBundle = asRecord(summary.latestRoleMetadata.dispatcher?.bundle);
  const target = asRecord(dispatcherBundle?.target);
  const body = asRecord(dispatcherBundle?.body);
  const pieces = [
    readString(target?.targetIngress),
    readString(body?.bodyStrategy),
    readString(body?.packageKind),
  ].filter((value): value is string => Boolean(value));
  return pieces.length > 0 ? pieces.join(" / ") : undefined;
}

function toConfidenceLabel(
  deliveryStatus: CoreCmpWorksitePackageV1["deliveryStatus"],
): NonNullable<CoreCmpWorksitePackageV1["governance"]>["confidenceLabel"] {
  if (deliveryStatus === "available") {
    return "high";
  }
  if (deliveryStatus === "partial") {
    return "medium";
  }
  return "low";
}

function toFreshness(
  deliveryStatus: CoreCmpWorksitePackageV1["deliveryStatus"],
): NonNullable<CoreCmpWorksitePackageV1["governance"]>["freshness"] {
  if (deliveryStatus === "available") {
    return "fresh";
  }
  if (deliveryStatus === "partial") {
    return "aging";
  }
  return "stale";
}

function toPublicState(
  record: AgentCoreCmpWorksiteStateRecord,
): AgentCoreCmpWorksiteState {
  return {
    sessionId: record.sessionId,
    agentId: record.agentId,
    activeTurnIndex: record.activeTurnIndex,
    currentObjective: record.currentObjective,
    updatedAt: record.updatedAt,
    deliveryStatus: record.deliveryStatus,
    packageId: record.latestCmp.packageId,
    packageRef: record.latestCmp.packageRef,
    packageMode: record.latestCmp.packageMode,
    snapshotId: record.latestCmp.snapshotId,
  };
}

function findCurrentRecord(
  store: AgentCoreCmpStateStore,
  input: { sessionId: string; agentId?: string },
) {
  const matched = [...store.worksiteRecords.values()]
    .filter((record) =>
      record.sessionId === input.sessionId
      && (!input.agentId || record.agentId === input.agentId))
    .sort((left, right) =>
      right.activeTurnIndex - left.activeTurnIndex
      || right.updatedAt.localeCompare(left.updatedAt));
  return matched[0];
}

function createDerivedState(input: {
  summary: CmpFiveAgentSummary;
  snapshot: CmpFiveAgentRuntimeSnapshot;
}): AgentCoreCmpWorksiteStateRecord["derived"] {
  const packageFamily = input.snapshot.packageFamilies.at(-1);
  return {
    packageFamilyId: packageFamily?.familyId,
    primaryPackageId: packageFamily?.primaryPackageId,
    primaryPackageRef: packageFamily?.primaryPackageRef,
    sourceAnchorRefs: readSourceAnchorRefs(input.snapshot, input.summary),
    reviewStateSummary: createReviewStateSummary(input.summary),
    routeStateSummary: createRouteStateSummary(input.summary),
    unresolvedStateSummary: createUnresolvedStateSummary(input.summary),
    pendingPeerApprovalCount: input.summary.flow.pendingPeerApprovalCount,
    approvedPeerApprovalCount: input.summary.flow.approvedPeerApprovalCount,
    parentPromoteReviewCount: input.summary.parentPromoteReviewCount,
    reinterventionPendingCount: input.summary.flow.reinterventionPendingCount,
    reinterventionServedCount: input.summary.flow.reinterventionServedCount,
    childSeedToIcmaCount: input.summary.flow.childSeedToIcmaCount,
    passiveReturnCount: input.summary.flow.passiveReturnCount,
    latestStages: createLatestStages(input.summary),
    recoveryStatus: input.summary.recovery.missingCheckpointRoles.length === 0 ? "healthy" : "degraded",
  };
}

export function createAgentCoreCmpWorksiteService(
  stateStore: AgentCoreCmpStateStore,
): AgentCoreCmpWorksiteApi {
  return {
    observeTurn(input) {
      const deliveryStatus = toDeliveryStatus(input.cmp);
      const updatedAt = input.observedAt ?? new Date().toISOString();
      const summary = readCmpSummary(input.cmp)
        ?? stateStore.runtime.getCmpFiveAgentRuntimeSummary(input.cmp.agentId);
      const snapshot = stateStore.runtime.getCmpFiveAgentRuntimeSnapshot(input.cmp.agentId);
      const record = {
        sessionId: input.sessionId,
        agentId: input.cmp.agentId,
        activeTurnIndex: input.turnIndex,
        currentObjective: input.currentObjective,
        updatedAt,
        deliveryStatus,
        latestCmp: {
          ...input.cmp,
        },
        derived: createDerivedState({
          summary,
          snapshot,
        }),
      };
      stateStore.worksiteRecords.set(makeWorksiteKey(input.sessionId, input.cmp.agentId), record);
      return toPublicState(record);
    },
    getCurrent(input) {
      const record = findCurrentRecord(stateStore, input);
      return record ? toPublicState(record) : undefined;
    },
    clearSession(input) {
      for (const [key, record] of stateStore.worksiteRecords.entries()) {
        if (record.sessionId !== input.sessionId) {
          continue;
        }
        if (input.agentId && record.agentId !== input.agentId) {
          continue;
        }
        stateStore.worksiteRecords.delete(key);
      }
    },
    exportCorePackage(input) {
      const record = findCurrentRecord(stateStore, input);
      if (!record) {
        return {
          schemaVersion: "core-cmp-worksite-package/v1",
          deliveryStatus: "absent",
          objective: {
            currentObjective: input.currentObjective,
            taskSummary: "no active CMP worksite is available yet",
          },
          governance: {
            operatorGuide: "proceed from the explicit current user objective and verified current evidence",
            confidenceLabel: "low",
            freshness: "stale",
            recoveryStatus: "degraded",
          },
        };
      }
      const deliveryStatus = record.deliveryStatus;

      return {
        schemaVersion: "core-cmp-worksite-package/v1",
        deliveryStatus,
        identity: {
          sessionId: record.sessionId,
          agentId: record.agentId,
          packageId: record.latestCmp.packageId,
          packageRef: record.latestCmp.packageRef,
          packageKind: record.latestCmp.packageKind,
          packageMode: record.latestCmp.packageMode,
          projectionId: record.latestCmp.projectionId,
          snapshotId: record.latestCmp.snapshotId,
          packageFamilyId: record.derived.packageFamilyId,
          primaryPackageId: record.derived.primaryPackageId,
          primaryPackageRef: record.derived.primaryPackageRef,
        },
        objective: {
          currentObjective: input.currentObjective ?? record.currentObjective,
          taskSummary: record.latestCmp.intent,
          requestedAction: record.latestCmp.operatorGuide,
          activeTurnIndex: record.activeTurnIndex,
        },
        payload: {
          primaryContext: record.derived.packageFamilyId
            ? `active package family ${record.derived.packageFamilyId} with primary ${record.derived.primaryPackageRef}`
            : `latest package ${record.latestCmp.packageRef}`,
          backgroundContext: record.latestCmp.childGuide,
          timelineSummary: record.latestCmp.timelineStrategy,
          sourceAnchorRefs: record.derived.sourceAnchorRefs,
          unresolvedStateSummary: record.derived.unresolvedStateSummary,
          reviewStateSummary: record.derived.reviewStateSummary,
          routeStateSummary: record.derived.routeStateSummary,
        },
        governance: {
          operatorGuide: record.latestCmp.operatorGuide,
          childGuide: record.latestCmp.childGuide,
          checkerReason: record.latestCmp.checkerReason,
          routeRationale: record.latestCmp.routeRationale,
          scopePolicy: record.latestCmp.scopePolicy,
          fidelityLabel: record.latestCmp.fidelityLabel,
          confidenceLabel: toConfidenceLabel(deliveryStatus),
          freshness: toFreshness(deliveryStatus),
          recoveryStatus: record.derived.recoveryStatus,
        },
        flow: {
          pendingPeerApprovalCount: record.derived.pendingPeerApprovalCount,
          approvedPeerApprovalCount: record.derived.approvedPeerApprovalCount,
          parentPromoteReviewCount: record.derived.parentPromoteReviewCount,
          reinterventionPendingCount: record.derived.reinterventionPendingCount,
          reinterventionServedCount: record.derived.reinterventionServedCount,
          childSeedToIcmaCount: record.derived.childSeedToIcmaCount,
          passiveReturnCount: record.derived.passiveReturnCount,
          latestStages: record.derived.latestStages,
        },
      };
    },
    exportTapPackage(input) {
      const record = findCurrentRecord(stateStore, input);
      if (!record) {
        return undefined;
      }
      return {
        schemaVersion: "cmp-tap-review-aperture/v1",
        sessionId: record.sessionId,
        agentId: record.agentId,
        currentObjective: input.currentObjective ?? record.currentObjective,
        requestedCapabilityKey: input.requestedCapabilityKey,
        packageRef: record.latestCmp.packageRef,
        packageFamilyId: record.derived.packageFamilyId,
        snapshotId: record.latestCmp.snapshotId,
        checkerReason: record.latestCmp.checkerReason,
        routeRationale: record.latestCmp.routeRationale,
        reviewStateSummary: record.derived.reviewStateSummary,
        sourceAnchorRefs: record.derived.sourceAnchorRefs,
        pendingPeerApprovalCount: record.derived.pendingPeerApprovalCount,
        parentPromoteReviewCount: record.derived.parentPromoteReviewCount,
        reinterventionPendingCount: record.derived.reinterventionPendingCount,
      };
    },
  };
}
