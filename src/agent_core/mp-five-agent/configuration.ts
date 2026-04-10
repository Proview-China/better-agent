import {
  createAgentCapabilityProfile,
  type AgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import type {
  MpFiveAgentCapabilityMatrixSummary,
  MpFiveAgentConfiguration,
  MpFiveAgentRoleSummaryCatalogEntry,
  MpFiveAgentTapProfileCatalog,
  MpFiveAgentTapProfileSummaryCatalog,
  MpRoleCapabilityContract,
  MpRoleCapabilitySurface,
  MpRoleConfiguration,
  MpRoleProfile,
  MpRolePromptPack,
  MpRoleLiveLlmMode,
} from "./types.js";
import { MP_FIVE_AGENT_ROLES, type MpFiveAgentRole } from "./shared.js";

export const MP_FIVE_AGENT_CONFIGURATION_VERSION = "mp-five-agent-role-catalog/v1";
export const MP_DEFAULT_ROLE_LIVE_LLM_MODES: Record<MpFiveAgentRole, MpRoleLiveLlmMode> = {
  icma: "llm_assisted",
  iterator: "llm_assisted",
  checker: "llm_assisted",
  dbagent: "llm_assisted",
  dispatcher: "llm_assisted",
};

function createPromptPack(input: MpRolePromptPack): MpRolePromptPack {
  return {
    ...input,
    guardrails: [...input.guardrails],
    inputContract: [...input.inputContract],
    outputContract: [...input.outputContract],
  };
}

function createProfile(input: MpRoleProfile): MpRoleProfile {
  return {
    ...input,
    responsibilities: [...input.responsibilities],
    hardBoundaries: [...input.hardBoundaries],
    defaultStageOrder: [...input.defaultStageOrder],
  };
}

function createCapabilitySurface(input: MpRoleCapabilitySurface): MpRoleCapabilitySurface {
  return {
    ...input,
    allowedOperations: [...input.allowedOperations],
    forbiddenOperations: [...input.forbiddenOperations],
  };
}

function createCapabilityContract(input: MpRoleCapabilityContract): MpRoleCapabilityContract {
  return {
    ...input,
    memory: createCapabilitySurface(input.memory),
    retrieval: createCapabilitySurface(input.retrieval),
    alignment: createCapabilitySurface(input.alignment),
  };
}

function createRoleConfiguration(input: MpRoleConfiguration): MpRoleConfiguration {
  return {
    role: input.role,
    promptPack: createPromptPack(input.promptPack),
    profile: createProfile(input.profile),
    capabilityContract: createCapabilityContract(input.capabilityContract),
  };
}

const DEFAULT_ROLE_CATALOG: Record<MpFiveAgentRole, MpRoleConfiguration> = {
  icma: createRoleConfiguration({
    role: "icma",
    promptPack: {
      role: "icma",
      promptPackId: "mp-five-agent/icma-prompt-pack/v1",
      lane: "ingress",
      systemPrompt: "Capture memory ingress without asserting final truth.",
      systemPurpose: "shape high-signal candidate memories from raw materials",
      mission: "Turn raw runtime materials into bounded memory candidates with stable source and time anchors.",
      guardrails: [
        "Never declare long-term truth.",
        "Always preserve source anchors.",
        "Always preserve observed time when available.",
      ],
      inputContract: ["stored section", "checked snapshot ref", "scope"],
      outputContract: ["candidate memory count", "source refs", "proposed memory kind"],
      handoffContract: "emit candidate memory metadata for iterator rewrite",
    },
    profile: {
      role: "icma",
      profileId: "mp-five-agent/icma-profile/v1",
      displayName: "Memory Ingress Context Agent",
      missionLabel: "memory-ingress",
      responsibilities: [
        "Capture ingress materials into candidate memories.",
        "Preserve source anchors and observed time.",
        "Bound task-relevant memory fragments.",
      ],
      hardBoundaries: [
        "Cannot write LanceDB truth.",
        "Cannot judge supersede or staleness.",
      ],
      defaultStageOrder: ["capture", "chunk_candidate", "emit_candidate"],
    },
    capabilityContract: {
      role: "icma",
      contractId: "mp-five-agent/icma-capability-contract/v1",
      memory: {
        access: "draft_only",
        allowedOperations: ["memory.capture_candidate"],
        forbiddenOperations: ["memory.write_truth", "memory.archive"],
        rationale: "ICMA only prepares candidate memories.",
      },
      retrieval: {
        access: "read",
        allowedOperations: ["memory.read_context"],
        forbiddenOperations: ["memory.route_bundle"],
        rationale: "ICMA may inspect context but not own retrieval bundles.",
      },
      alignment: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["memory.align", "memory.supersede"],
        rationale: "ICMA never judges freshness or alignment.",
      },
      tapIntegrationMode: "contract_ready",
    },
  }),
  iterator: createRoleConfiguration({
    role: "iterator",
    promptPack: {
      role: "iterator",
      promptPackId: "mp-five-agent/iterator-prompt-pack/v1",
      lane: "rewrite",
      systemPrompt: "Rewrite candidate memories into retrieval-ready drafts without asserting final truth.",
      systemPurpose: "normalize candidate memories into stable drafts",
      mission: "Rewrite raw candidates into structured memory drafts that are easier to search, compare, and align.",
      guardrails: [
        "Do not finalize truth.",
        "Do not write LanceDB records.",
        "Preserve source refs and semantic group intent.",
      ],
      inputContract: ["candidate memory metadata"],
      outputContract: ["draft memory id", "normalized tags", "source refs"],
      handoffContract: "handoff retrieval-ready drafts to checker",
    },
    profile: {
      role: "iterator",
      profileId: "mp-five-agent/iterator-profile/v1",
      displayName: "Memory Draft Iterator",
      missionLabel: "memory-rewrite",
      responsibilities: [
        "Rewrite candidates into stable drafts.",
        "Normalize tags and memory kind hints.",
      ],
      hardBoundaries: [
        "Cannot mark memories stale or superseded.",
        "Cannot write final truth.",
      ],
      defaultStageOrder: ["accept_candidate", "rewrite_draft", "handoff_checker"],
    },
    capabilityContract: {
      role: "iterator",
      contractId: "mp-five-agent/iterator-capability-contract/v1",
      memory: {
        access: "draft_only",
        allowedOperations: ["memory.rewrite_candidate"],
        forbiddenOperations: ["memory.write_truth", "memory.archive"],
        rationale: "Iterator only emits draft memories.",
      },
      retrieval: {
        access: "read",
        allowedOperations: ["memory.read_context"],
        forbiddenOperations: ["memory.route_bundle"],
        rationale: "Iterator can inspect context to improve drafts.",
      },
      alignment: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["memory.align", "memory.supersede"],
        rationale: "Iterator never judges alignment.",
      },
      tapIntegrationMode: "contract_ready",
    },
  }),
  checker: createRoleConfiguration({
    role: "checker",
    promptPack: {
      role: "checker",
      promptPackId: "mp-five-agent/checker-prompt-pack/v1",
      lane: "judgement",
      systemPrompt: "Judge freshness, staleness, dedupe, and supersede relations before memory truth changes.",
      systemPurpose: "raise signal-to-noise by memory judgement",
      mission: "Decide whether a candidate memory should be kept fresh, merged, or used to supersede older memories.",
      guardrails: [
        "Only checker may judge stale or superseded.",
        "Do not write LanceDB directly.",
        "Always emit explicit decision rationale.",
      ],
      inputContract: ["candidate memory draft", "similar memories"],
      outputContract: ["decision", "freshness status", "superseded ids", "stale ids"],
      handoffContract: "handoff explicit alignment decisions to dbagent",
    },
    profile: {
      role: "checker",
      profileId: "mp-five-agent/checker-profile/v1",
      displayName: "Memory Quality Checker",
      missionLabel: "memory-judgement",
      responsibilities: [
        "Judge freshness and alignment.",
        "Detect dedupe and supersede relations.",
        "Protect retrieval quality.",
      ],
      hardBoundaries: [
        "Cannot route final retrieval bundle.",
        "Cannot write LanceDB directly.",
      ],
      defaultStageOrder: ["inspect_candidate", "judge_alignment", "emit_decision"],
    },
    capabilityContract: {
      role: "checker",
      contractId: "mp-five-agent/checker-capability-contract/v1",
      memory: {
        access: "read",
        allowedOperations: ["memory.inspect_truth"],
        forbiddenOperations: ["memory.write_truth"],
        rationale: "Checker inspects truth but does not persist it.",
      },
      retrieval: {
        access: "read",
        allowedOperations: ["memory.inspect_retrieval"],
        forbiddenOperations: ["memory.route_bundle"],
        rationale: "Checker can inspect retrieval candidates for quality.",
      },
      alignment: {
        access: "judge_only",
        allowedOperations: ["memory.align", "memory.supersede", "memory.mark_stale"],
        forbiddenOperations: ["memory.write_truth_direct"],
        rationale: "Checker owns freshness and alignment judgement.",
      },
      tapIntegrationMode: "contract_ready",
    },
  }),
  dbagent: createRoleConfiguration({
    role: "dbagent",
    promptPack: {
      role: "dbagent",
      promptPackId: "mp-five-agent/dbagent-prompt-pack/v1",
      lane: "truth_write",
      systemPrompt: "Persist only checker-approved memory truth into LanceDB.",
      systemPurpose: "materialize memory truth changes",
      mission: "Apply approved materialize, supersede, archive, merge, split, and reindex changes to LanceDB.",
      guardrails: [
        "Never invent truth beyond checker output.",
        "Persist alignment and freshness metadata together.",
      ],
      inputContract: ["checker-approved record changes"],
      outputContract: ["materialized ids", "updated ids", "archived ids", "primary table"],
      handoffContract: "publish truth changes for retrieval surfaces",
    },
    profile: {
      role: "dbagent",
      profileId: "mp-five-agent/dbagent-profile/v1",
      displayName: "Memory DBAgent",
      missionLabel: "memory-truth-write",
      responsibilities: [
        "Write LanceDB truth.",
        "Apply supersede and alignment metadata.",
        "Maintain query-visible truth state.",
      ],
      hardBoundaries: [
        "Cannot judge freshness by itself.",
      ],
      defaultStageOrder: ["materialize", "update_lineage", "persist_truth"],
    },
    capabilityContract: {
      role: "dbagent",
      contractId: "mp-five-agent/dbagent-capability-contract/v1",
      memory: {
        access: "primary_write",
        allowedOperations: ["memory.materialize", "memory.archive", "memory.reindex", "memory.merge", "memory.split"],
        forbiddenOperations: [],
        rationale: "DBAgent is the only MP primary writer.",
      },
      retrieval: {
        access: "read",
        allowedOperations: ["memory.read_context"],
        forbiddenOperations: ["memory.route_bundle"],
        rationale: "DBAgent can inspect existing truth to apply writes safely.",
      },
      alignment: {
        access: "write",
        allowedOperations: ["memory.apply_alignment"],
        forbiddenOperations: ["memory.judge_alignment"],
        rationale: "DBAgent applies checker decisions but does not originate them.",
      },
      tapIntegrationMode: "contract_ready",
    },
  }),
  dispatcher: createRoleConfiguration({
    role: "dispatcher",
    promptPack: {
      role: "dispatcher",
      promptPackId: "mp-five-agent/dispatcher-prompt-pack/v1",
      lane: "retrieval",
      systemPrompt: "Return high-signal bundles that prefer fresh, aligned, non-superseded memory.",
      systemPurpose: "assemble final retrieval bundles",
      mission: "Search memory truth, rerank by quality and freshness, and assemble the final bundle for the caller.",
      guardrails: [
        "Never elevate superseded memory into the main bundle.",
        "Prefer fresh and aligned memory.",
      ],
      inputContract: ["query text", "scope", "search hits"],
      outputContract: ["primary ids", "supporting ids", "rerank composition"],
      handoffContract: "emit the final retrieval bundle to the caller",
    },
    profile: {
      role: "dispatcher",
      profileId: "mp-five-agent/dispatcher-profile/v1",
      displayName: "Memory Dispatcher",
      missionLabel: "memory-retrieval",
      responsibilities: [
        "Search truth.",
        "Rerank by freshness and alignment.",
        "Assemble caller-facing bundles.",
      ],
      hardBoundaries: [
        "Cannot write truth.",
        "Cannot judge freshness by itself.",
      ],
      defaultStageOrder: ["search", "rerank", "assemble_bundle"],
    },
    capabilityContract: {
      role: "dispatcher",
      contractId: "mp-five-agent/dispatcher-capability-contract/v1",
      memory: {
        access: "read",
        allowedOperations: ["memory.read_truth"],
        forbiddenOperations: ["memory.write_truth"],
        rationale: "Dispatcher only reads memory truth.",
      },
      retrieval: {
        access: "route_only",
        allowedOperations: ["memory.search", "memory.route_bundle"],
        forbiddenOperations: [],
        rationale: "Dispatcher owns retrieval bundle composition.",
      },
      alignment: {
        access: "read",
        allowedOperations: ["memory.inspect_alignment"],
        forbiddenOperations: ["memory.judge_alignment", "memory.apply_alignment"],
        rationale: "Dispatcher consumes alignment state but does not alter it.",
      },
      tapIntegrationMode: "contract_ready",
    },
  }),
};

export function createMpFiveAgentConfiguration(): MpFiveAgentConfiguration {
  return {
    version: MP_FIVE_AGENT_CONFIGURATION_VERSION,
    roles: structuredClone(DEFAULT_ROLE_CATALOG),
  };
}

export function createMpFiveAgentCapabilityMatrixSummary(): MpFiveAgentCapabilityMatrixSummary {
  return {
    ingressOwners: ["icma"],
    rewriteOwners: ["iterator"],
    alignmentJudges: ["checker"],
    memoryWriters: ["dbagent"],
    retrievalOwners: ["dispatcher"],
  };
}

export function createMpRoleTapProfile(role: MpFiveAgentRole): AgentCapabilityProfile {
  switch (role) {
    case "icma":
      return createAgentCapabilityProfile({
        profileId: "mp-five-agent/icma-tap-profile/v1",
        agentClass: "mp-five-agent.icma",
        defaultMode: "balanced",
        baselineTier: "B0",
        baselineCapabilities: ["mp.ingest"],
        allowedCapabilityPatterns: ["mp.ingest", "mp.search"],
        deniedCapabilityPatterns: ["mp.archive", "mp.reindex", "mp.compact", "mp.merge", "mp.split"],
      });
    case "iterator":
      return createAgentCapabilityProfile({
        profileId: "mp-five-agent/iterator-tap-profile/v1",
        agentClass: "mp-five-agent.iterator",
        defaultMode: "balanced",
        baselineTier: "B0",
        baselineCapabilities: ["mp.ingest"],
        allowedCapabilityPatterns: ["mp.ingest", "mp.search"],
        deniedCapabilityPatterns: ["mp.materialize", "mp.archive"],
      });
    case "checker":
      return createAgentCapabilityProfile({
        profileId: "mp-five-agent/checker-tap-profile/v1",
        agentClass: "mp-five-agent.checker",
        defaultMode: "standard",
        baselineTier: "B1",
        baselineCapabilities: ["mp.align", "mp.resolve"],
        allowedCapabilityPatterns: ["mp.align", "mp.resolve", "mp.search"],
        deniedCapabilityPatterns: ["mp.materialize"],
      });
    case "dbagent":
      return createAgentCapabilityProfile({
        profileId: "mp-five-agent/dbagent-tap-profile/v1",
        agentClass: "mp-five-agent.dbagent",
        defaultMode: "standard",
        baselineTier: "B1",
        baselineCapabilities: ["mp.materialize", "mp.archive", "mp.reindex", "mp.compact", "mp.merge", "mp.split"],
        allowedCapabilityPatterns: ["mp.materialize", "mp.archive", "mp.reindex", "mp.compact", "mp.merge", "mp.split"],
        deniedCapabilityPatterns: ["mp.resolve"],
      });
    case "dispatcher":
      return createAgentCapabilityProfile({
        profileId: "mp-five-agent/dispatcher-tap-profile/v1",
        agentClass: "mp-five-agent.dispatcher",
        defaultMode: "balanced",
        baselineTier: "B0",
        baselineCapabilities: ["mp.resolve", "mp.history.request", "mp.search"],
        allowedCapabilityPatterns: ["mp.resolve", "mp.history.request", "mp.search"],
        deniedCapabilityPatterns: ["mp.materialize", "mp.archive"],
      });
  }
}

export function createMpFiveAgentTapProfileCatalog(): MpFiveAgentTapProfileCatalog {
  return {
    icma: createMpRoleTapProfile("icma"),
    iterator: createMpRoleTapProfile("iterator"),
    checker: createMpRoleTapProfile("checker"),
    dbagent: createMpRoleTapProfile("dbagent"),
    dispatcher: createMpRoleTapProfile("dispatcher"),
  };
}

export function createMpFiveAgentTapProfileSummaryCatalog(): MpFiveAgentTapProfileSummaryCatalog {
  const catalog = createMpFiveAgentTapProfileCatalog();
  return Object.fromEntries(
    MP_FIVE_AGENT_ROLES.map((role) => {
      const profile = catalog[role];
      return [role, {
        role,
        profileId: profile.profileId,
        agentClass: profile.agentClass,
        defaultMode: profile.defaultMode,
        baselineTier: profile.baselineTier,
        baselineCapabilities: profile.baselineCapabilities ?? [],
        allowedCapabilityPatterns: profile.allowedCapabilityPatterns ?? [],
        deniedCapabilityPatterns: profile.deniedCapabilityPatterns ?? [],
      }];
    }),
  ) as MpFiveAgentTapProfileSummaryCatalog;
}

export function createMpFiveAgentRoleSummaryCatalog(): Record<MpFiveAgentRole, MpFiveAgentRoleSummaryCatalogEntry> {
  const configuration = createMpFiveAgentConfiguration();
  const profiles = createMpFiveAgentTapProfileCatalog();
  return Object.fromEntries(
    MP_FIVE_AGENT_ROLES.map((role) => [role, {
      promptPackId: configuration.roles[role].promptPack.promptPackId,
      profileId: configuration.roles[role].profile.profileId,
      capabilityContractId: configuration.roles[role].capabilityContract.contractId,
      tapProfileId: profiles[role].profileId,
    }]),
  ) as Record<MpFiveAgentRole, MpFiveAgentRoleSummaryCatalogEntry>;
}
