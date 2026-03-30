import {
  createCmpFiveAgentCapabilityMatrixSummary,
  createCmpFiveAgentConfiguration,
  createCmpRoleTapProfile,
} from "./configuration.js";
import { createCmpFiveAgentTapProfileSummaryCatalog } from "./tap-profile.js";
import type {
  CmpFiveAgentConfiguration,
  CmpFiveAgentFlowSummary,
  CmpFiveAgentRecoverySummary,
  CmpFiveAgentRuntimeSnapshot,
  CmpFiveAgentSummary,
} from "./types.js";
import type { CmpFiveAgentRole } from "./shared.js";

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  return values.reduce<Partial<Record<T, number>>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function countCheckpointCoverage(snapshot: CmpFiveAgentRuntimeSnapshot): Record<CmpFiveAgentRole, number> {
  return snapshot.checkpoints.reduce<Record<CmpFiveAgentRole, number>>((accumulator, checkpoint) => {
    accumulator[checkpoint.role] += 1;
    return accumulator;
  }, {
    icma: 0,
    iterator: 0,
    checker: 0,
    dbagent: 0,
    dispatcher: 0,
  });
}

function createLatestRoleMetadata(snapshot: CmpFiveAgentRuntimeSnapshot): CmpFiveAgentSummary["latestRoleMetadata"] {
  return {
    icma: snapshot.icmaRecords.at(-1)
      ? {
        ...(snapshot.icmaRecords.at(-1)?.metadata ?? {}),
        structuredOutput: snapshot.icmaRecords.at(-1)?.structuredOutput,
      }
      : undefined,
    iterator: snapshot.iteratorRecords.at(-1)
      ? {
        ...(snapshot.iteratorRecords.at(-1)?.metadata ?? {}),
        reviewOutput: snapshot.iteratorRecords.at(-1)?.reviewOutput,
      }
      : undefined,
    checker: snapshot.checkerRecords.at(-1)
      ? {
        ...(snapshot.checkerRecords.at(-1)?.metadata ?? {}),
        reviewOutput: snapshot.checkerRecords.at(-1)?.reviewOutput,
      }
      : undefined,
    dbagent: snapshot.dbAgentRecords.at(-1)
      ? {
        ...(snapshot.dbAgentRecords.at(-1)?.metadata ?? {}),
        materializationOutput: snapshot.dbAgentRecords.at(-1)?.materializationOutput,
      }
      : undefined,
    dispatcher: snapshot.dispatcherRecords.at(-1)
      ? {
        ...(snapshot.dispatcherRecords.at(-1)?.metadata ?? {}),
        bundle: snapshot.dispatcherRecords.at(-1)?.bundle,
      }
      : undefined,
  };
}

export function createCmpFiveAgentRoleStageSummary(input: {
  snapshot: CmpFiveAgentRuntimeSnapshot;
  configuration?: CmpFiveAgentConfiguration;
}): Pick<CmpFiveAgentSummary, "roleCounts" | "latestStages" | "configuredRoles"> {
  const configuration = input.configuration ?? createCmpFiveAgentConfiguration();
  return {
    roleCounts: {
      icma: input.snapshot.icmaRecords.length,
      iterator: input.snapshot.iteratorRecords.length,
      checker: input.snapshot.checkerRecords.length,
      dbagent: input.snapshot.dbAgentRecords.length,
      dispatcher: input.snapshot.dispatcherRecords.length,
    },
    latestStages: {
      icma: input.snapshot.icmaRecords.at(-1)?.stage,
      iterator: input.snapshot.iteratorRecords.at(-1)?.stage,
      checker: input.snapshot.checkerRecords.at(-1)?.stage,
      dbagent: input.snapshot.dbAgentRecords.at(-1)?.stage,
      dispatcher: input.snapshot.dispatcherRecords.at(-1)?.stage,
    },
    configuredRoles: {
      icma: {
        promptPackId: configuration.roles.icma.promptPack.promptPackId,
        profileId: configuration.roles.icma.profile.profileId,
        capabilityContractId: configuration.roles.icma.capabilityContract.contractId,
        tapProfileId: createCmpRoleTapProfile("icma").profileId,
      },
      iterator: {
        promptPackId: configuration.roles.iterator.promptPack.promptPackId,
        profileId: configuration.roles.iterator.profile.profileId,
        capabilityContractId: configuration.roles.iterator.capabilityContract.contractId,
        tapProfileId: createCmpRoleTapProfile("iterator").profileId,
      },
      checker: {
        promptPackId: configuration.roles.checker.promptPack.promptPackId,
        profileId: configuration.roles.checker.profile.profileId,
        capabilityContractId: configuration.roles.checker.capabilityContract.contractId,
        tapProfileId: createCmpRoleTapProfile("checker").profileId,
      },
      dbagent: {
        promptPackId: configuration.roles.dbagent.promptPack.promptPackId,
        profileId: configuration.roles.dbagent.profile.profileId,
        capabilityContractId: configuration.roles.dbagent.capabilityContract.contractId,
        tapProfileId: createCmpRoleTapProfile("dbagent").profileId,
      },
      dispatcher: {
        promptPackId: configuration.roles.dispatcher.promptPack.promptPackId,
        profileId: configuration.roles.dispatcher.profile.profileId,
        capabilityContractId: configuration.roles.dispatcher.capabilityContract.contractId,
        tapProfileId: createCmpRoleTapProfile("dispatcher").profileId,
      },
    },
  };
}

export function createCmpFiveAgentFlowSummary(snapshot: CmpFiveAgentRuntimeSnapshot): CmpFiveAgentFlowSummary {
  return {
    packageModeCounts: countBy(snapshot.dispatcherRecords.map((record) => record.packageMode)),
    childSeedToIcmaCount: snapshot.dispatcherRecords.filter((record) =>
      record.packageMode === "child_seed_via_icma"
      && (
        record.metadata?.targetIngress === "child_icma_only"
        || record.metadata?.childSeedsEnterIcmaOnly === true
      ),
    ).length,
    passiveReturnCount: snapshot.dispatcherRecords.filter((record) => record.packageMode === "historical_reply_return").length,
    pendingPeerApprovalCount: snapshot.peerApprovals.filter((record) =>
      record.status === "pending_parent_core_approval"
      || record.metadata?.approvalStatus === "pending",
    ).length,
    approvedPeerApprovalCount: snapshot.peerApprovals.filter((record) => record.status === "approved").length,
    rejectedPeerApprovalCount: snapshot.peerApprovals.filter((record) => record.status === "rejected").length,
    reinterventionPendingCount: snapshot.reinterventionRequests.filter((record) => record.status === "pending_parent_dbagent_review").length,
    reinterventionServedCount: snapshot.reinterventionRequests.filter((record) => record.status === "served").length,
  };
}

export function createCmpFiveAgentRecoverySummary(snapshot: CmpFiveAgentRuntimeSnapshot): CmpFiveAgentRecoverySummary {
  const checkpointCoverage = countCheckpointCoverage(snapshot);
  return {
    checkpointCoverage,
    resumableRoles: Object.entries(checkpointCoverage)
      .filter(([, count]) => count > 0)
      .map(([role]) => role as CmpFiveAgentRole),
    missingCheckpointRoles: Object.entries(checkpointCoverage)
      .filter(([, count]) => count === 0)
      .map(([role]) => role as CmpFiveAgentRole),
  };
}

export function createCmpFiveAgentSummary(input: {
  agentId?: string;
  snapshot: CmpFiveAgentRuntimeSnapshot;
  configuration?: CmpFiveAgentConfiguration;
}): CmpFiveAgentSummary {
  const configuration = input.configuration ?? createCmpFiveAgentConfiguration();
  const stageSummary = createCmpFiveAgentRoleStageSummary({
    snapshot: input.snapshot,
    configuration,
  });
  const flow = createCmpFiveAgentFlowSummary(input.snapshot);
  const recovery = createCmpFiveAgentRecoverySummary(input.snapshot);

  return {
    agentId: input.agentId,
    configurationVersion: configuration.version,
    roleCounts: stageSummary.roleCounts,
    latestStages: stageSummary.latestStages,
    latestRoleMetadata: createLatestRoleMetadata(input.snapshot),
    checkpointCount: input.snapshot.checkpoints.length,
    overrideCount: input.snapshot.overrides.length,
    peerExchangePendingApprovalCount: flow.pendingPeerApprovalCount,
    peerExchangeApprovedCount: flow.approvedPeerApprovalCount,
    parentPromoteReviewCount: input.snapshot.parentPromoteReviews.length,
    configuredRoles: stageSummary.configuredRoles,
    capabilityMatrix: createCmpFiveAgentCapabilityMatrixSummary(configuration),
    tapProfiles: createCmpFiveAgentTapProfileSummaryCatalog(),
    flow,
    recovery,
  };
}
