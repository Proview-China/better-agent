import {
  createMpFiveAgentCapabilityMatrixSummary,
  createMpFiveAgentConfiguration,
  createMpFiveAgentRoleSummaryCatalog,
  createMpFiveAgentTapProfileSummaryCatalog,
} from "./configuration.js";
import type { MpFiveAgentRuntimeState, MpFiveAgentSummary } from "./types.js";
import { MP_FIVE_AGENT_ROLES } from "./shared.js";

export function createEmptyMpFiveAgentRuntimeState(): MpFiveAgentRuntimeState {
  return {
    roleCounts: {
      icma: 0,
      iterator: 0,
      checker: 0,
      dbagent: 0,
      dispatcher: 0,
    },
    latestStages: {
      icma: undefined,
      iterator: undefined,
      checker: undefined,
      dbagent: undefined,
      dispatcher: undefined,
    },
    latestRoleMetadata: {},
    pendingAlignmentCount: 0,
    pendingSupersedeCount: 0,
    passiveReturnCount: 0,
    records: new Map(),
    dedupeDecisionCount: 0,
    ingestCount: 0,
    rerankComposition: {
      fresh: 0,
      aging: 0,
      stale: 0,
      superseded: 0,
      aligned: 0,
      unreviewed: 0,
      drifted: 0,
    },
  };
}

export function createMpFiveAgentSummary(
  state: MpFiveAgentRuntimeState,
): MpFiveAgentSummary {
  const configuration = createMpFiveAgentConfiguration();
  const records = [...state.records.values()];
  const staleMemoryCount = records.filter((record) => record.freshness.status === "stale").length;
  const supersededMemoryCount = records.filter((record) => record.freshness.status === "superseded").length;
  const dedupeRate = state.ingestCount === 0
    ? 0
    : Number((state.dedupeDecisionCount / state.ingestCount).toFixed(4));

  return {
    configurationVersion: configuration.version,
    roleCounts: structuredClone(state.roleCounts),
    latestStages: structuredClone(state.latestStages),
    latestRoleMetadata: structuredClone(state.latestRoleMetadata),
    configuredRoles: createMpFiveAgentRoleSummaryCatalog(),
    capabilityMatrix: createMpFiveAgentCapabilityMatrixSummary(),
    tapProfiles: createMpFiveAgentTapProfileSummaryCatalog(),
    flow: {
      pendingAlignmentCount: state.pendingAlignmentCount,
      pendingSupersedeCount: state.pendingSupersedeCount,
      staleMemoryCandidateCount: staleMemoryCount,
      passiveReturnCount: state.passiveReturnCount,
    },
    quality: {
      dedupeRate,
      staleMemoryCount,
      supersededMemoryCount,
      rerankComposition: structuredClone(state.rerankComposition),
    },
  };
}

export function markMpRoleProgress(
  state: MpFiveAgentRuntimeState,
  role: (typeof MP_FIVE_AGENT_ROLES)[number],
  stage: string,
  metadata?: MpFiveAgentRuntimeState["latestRoleMetadata"][typeof role],
): void {
  state.roleCounts[role] += 1;
  state.latestStages[role] = stage;
  if (metadata) {
    state.latestRoleMetadata[role] = metadata as never;
  }
}
