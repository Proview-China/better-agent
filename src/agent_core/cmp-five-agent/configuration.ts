import {
  CMP_FIVE_AGENT_ROLES,
  type CmpFiveAgentRole,
} from "./shared.js";
import {
  createAgentCapabilityProfile,
  type AgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import type { CmpRoleLiveLlmMode } from "./live-llm.js";
import type {
  CmpFiveAgentCapabilityMatrixSummary,
  CmpFiveAgentConfiguration,
  CmpRoleCapabilityContract,
  CmpRoleCapabilitySurface,
  CmpRoleConfiguration,
  CmpRoleProfile,
  CmpRolePromptPack,
} from "./types.js";
export type { CmpFiveAgentConfiguration } from "./types.js";

export const CMP_FIVE_AGENT_CONFIGURATION_VERSION = "cmp-five-agent-role-catalog/v1";
export const CMP_DEFAULT_ROLE_LIVE_LLM_MODES: Record<CmpFiveAgentRole, CmpRoleLiveLlmMode> = {
  icma: "llm_assisted",
  iterator: "llm_assisted",
  checker: "llm_assisted",
  dbagent: "llm_assisted",
  dispatcher: "llm_assisted",
};

export type CmpCapabilityOwnership = "none" | "supporting" | "primary";

export interface CmpRoleCapabilityMatrixEntry {
  role: CmpFiveAgentRole;
  promptPackId: string;
  profileId: string;
  capabilityContractId: string;
  git: {
    accessLevel: CmpRoleCapabilitySurface["access"];
    ownership: CmpCapabilityOwnership;
  };
  db: {
    accessLevel: CmpRoleCapabilitySurface["access"];
    ownership: CmpCapabilityOwnership;
  };
  mq: {
    accessLevel: CmpRoleCapabilitySurface["access"];
    ownership: CmpCapabilityOwnership;
  };
}

export interface CmpFiveAgentRoleSummaryCatalogEntry {
  promptPackId: string;
  profileId: string;
  capabilityContractId: string;
  tapProfileId: string;
  gitAccessLevel: CmpRoleCapabilitySurface["access"];
  dbAccessLevel: CmpRoleCapabilitySurface["access"];
  mqAccessLevel: CmpRoleCapabilitySurface["access"];
}

export type CmpFiveAgentRoleSummaryCatalog = Record<
  CmpFiveAgentRole,
  CmpFiveAgentRoleSummaryCatalogEntry
>;

export type CmpFiveAgentTapProfileCatalog = Record<CmpFiveAgentRole, AgentCapabilityProfile>;
export type CmpFiveAgentTapProfileSummaryCatalog = Record<CmpFiveAgentRole, {
  role: CmpFiveAgentRole;
  profileId: string;
  agentClass: string;
  defaultMode: string;
  baselineTier: string;
  baselineCapabilities: string[];
  allowedCapabilityPatterns: string[];
  deniedCapabilityPatterns: string[];
}>;
function clone<T>(value: T): T {
  return structuredClone(value);
}

function toOwnership(params: {
  role: CmpFiveAgentRole;
  channel: "git" | "db" | "mq";
  accessLevel: CmpRoleCapabilitySurface["access"];
}): CmpCapabilityOwnership {
  if (params.accessLevel === "none") {
    return "none";
  }
  if (
    (params.role === "iterator" && params.channel === "git")
    || (params.role === "dbagent" && params.channel === "db")
    || (params.role === "dispatcher" && params.channel === "mq")
  ) {
    return "primary";
  }
  return "supporting";
}

function createPromptPack(input: {
  role: CmpFiveAgentRole;
  promptPackId: string;
  lane: CmpRolePromptPack["lane"];
  systemPrompt: string;
  systemPurpose: string;
  systemPolicy: CmpRolePromptPack["systemPolicy"];
  mission: string;
  handoffContract: string;
  guardrails: string[];
  inputContract: string[];
  outputContract: string[];
}): CmpRolePromptPack {
  return {
    ...input,
    guardrails: [...input.guardrails],
    inputContract: [...input.inputContract],
    outputContract: [...input.outputContract],
  };
}

function createProfile(input: {
  role: CmpFiveAgentRole;
  profileId: string;
  displayName: string;
  missionLabel: string;
  responsibilities: string[];
  hardBoundaries: string[];
  parentInteraction: string;
  childInteraction: string;
  peerInteraction: string;
  defaultStageOrder: string[];
  ownsStages: string[];
}): CmpRoleProfile {
  return {
    ...input,
    responsibilities: [...input.responsibilities],
    hardBoundaries: [...input.hardBoundaries],
    defaultStageOrder: [...input.defaultStageOrder],
    ownsStages: [...input.ownsStages],
  };
}

function createCapabilitySurface(input: CmpRoleCapabilitySurface): CmpRoleCapabilitySurface {
  return {
    ...input,
    allowedOperations: [...input.allowedOperations],
    forbiddenOperations: [...input.forbiddenOperations],
  };
}

function createCapabilityContract(input: {
  role: CmpFiveAgentRole;
  contractId: string;
  systemPromptMutation: CmpRoleCapabilityContract["systemPromptMutation"];
  git: CmpRoleCapabilitySurface;
  db: CmpRoleCapabilitySurface;
  mq: CmpRoleCapabilitySurface;
}): CmpRoleCapabilityContract {
  return {
    role: input.role,
    contractId: input.contractId,
    systemPromptMutation: input.systemPromptMutation,
    git: createCapabilitySurface(input.git),
    db: createCapabilitySurface(input.db),
    mq: createCapabilitySurface(input.mq),
    tapIntegrationMode: "contract_ready",
  };
}

function createRoleConfiguration(input: {
  role: CmpFiveAgentRole;
  promptPack: CmpRolePromptPack;
  profile: CmpRoleProfile;
  capabilityContract: CmpRoleCapabilityContract;
}): CmpRoleConfiguration {
  return {
    role: input.role,
    promptPack: input.promptPack,
    profile: input.profile,
    capability: input.capabilityContract,
    capabilityContract: input.capabilityContract,
  };
}

const DEFAULT_ROLE_CATALOG: Record<CmpFiveAgentRole, CmpRoleConfiguration> = {
  icma: createRoleConfiguration({
    role: "icma",
    promptPack: createPromptPack({
      role: "icma",
      promptPackId: "cmp-five-agent/icma-prompt-pack/v1",
      lane: "active_ingress",
      systemPrompt: "Never rewrite the root system prompt. Only attach controlled CMP fragments.",
      systemPurpose: "shape ingress context without mutating root system truth",
      systemPolicy: "append_only_fragment",
      mission: "Capture runtime context, split it into multiple task-intent chunks when needed, automatically infer controlled fragment kinds, and attach only controlled fragments before handoff.",
      handoffContract: "emit multiple intent chunks when needed, infer controlled fragments from materials, and ensure child seeds later enter child ICMA only",
      guardrails: [
        "Only attach constraint, risk, and flow fragments.",
        "Never rewrite the root system prompt.",
        "Infer fragment kinds from materials, but only inside the allowed three-kind boundary.",
        "Never perform cmp git progression writes.",
        "When multiple intent chunks exist, keep them separable and high-signal.",
      ],
      inputContract: [
        "raw runtime context",
        "parent-provided seed when present",
        "peer hint after parent approval when present",
      ],
      outputContract: [
        "multi-intent chunk set",
        "controlled fragment set",
        "auto fragment detection metadata",
        "ingress assembly metadata",
        "chunk-level operator/child guide set",
      ],
    }),
    profile: createProfile({
      role: "icma",
      profileId: "cmp-five-agent/icma-profile/v1",
      displayName: "Input Context Management Agent",
      missionLabel: "ingress-control",
      responsibilities: [
        "Capture runtime context at ingress.",
        "Chunk materials by task intent, including multi-intent ingress.",
        "Auto-detect controlled fragment kinds from source materials.",
        "Attach controlled fragments without mutating root system truth.",
      ],
      hardBoundaries: [
        "Cannot rewrite the root system prompt.",
        "Cannot decide checked/promote outcomes.",
        "Cannot own cmp git progression.",
      ],
      parentInteraction: "Reassembles parent seeds under local task discipline.",
      childInteraction: "Prepares child seed payloads that must enter child ICMA only.",
      peerInteraction: "Accepts peer hints only after parent-approved routing.",
      defaultStageOrder: ["capture", "chunk_by_intent", "attach_fragment", "emit"],
      ownsStages: ["capture", "chunk_by_intent", "attach_fragment", "emit"],
    }),
    capabilityContract: createCapabilityContract({
      role: "icma",
      contractId: "cmp-five-agent/icma-capability-contract/v1",
      systemPromptMutation: "fragments_only",
      git: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["write_branch", "commit", "merge", "promote_ref"],
        rationale: "ICMA must stay off cmp git writes and only shape ingress context.",
      },
      db: {
        access: "read",
        allowedOperations: ["read_projection_summary"],
        forbiddenOperations: ["write_projection", "write_package", "write_parent_review"],
        rationale: "ICMA can inspect read-only state while assembling fragments.",
      },
      mq: {
        access: "publish_only",
        allowedOperations: ["publish_ingress_hint"],
        forbiddenOperations: ["publish_delivery_receipt", "approve_peer_exchange"],
        rationale: "ICMA may emit ingress-related hints but not routing or approval decisions.",
      },
    }),
  }),
  iterator: createRoleConfiguration({
    role: "iterator",
    promptPack: createPromptPack({
      role: "iterator",
      promptPackId: "cmp-five-agent/iterator-prompt-pack/v1",
      lane: "git_progression",
      systemPrompt: "Treat commit as the minimum auditable review unit and keep review refs stable.",
      systemPurpose: "advance cmp git state to auditable candidate commits",
      systemPolicy: "routing_only",
      mission: "Advance prepared material into candidate commits, decide whether progression should hold or advance, and keep stable review refs with explicit annotations.",
      handoffContract: "handoff candidate commit metadata, progression verdict, and stable review refs to checker",
      guardrails: [
        "Commit is the minimum review unit.",
        "Emit an explicit progression verdict before advancing review state.",
        "Keep review ref annotations stable and auditable.",
        "Do not finalize checked/promote outcomes.",
        "Do not route packages downstream.",
        "Emit an explicit progression verdict for whether this candidate should advance.",
      ],
      inputContract: [
        "prepared material from ICMA",
        "git sync intent",
      ],
      outputContract: [
        "candidate commit ref",
        "stable review ref metadata",
        "progression verdict",
        "review ref annotation",
      ],
    }),
    profile: createProfile({
      role: "iterator",
      profileId: "cmp-five-agent/iterator-profile/v1",
      displayName: "Iterator Agent",
      missionLabel: "git-progression",
      responsibilities: [
        "Advance cmp git workflow with candidate commits.",
        "Maintain stable review refs.",
        "Keep commit as the minimum review unit.",
        "Emit explicit progression verdicts and review ref annotations for downstream checking.",
      ],
      hardBoundaries: [
        "Cannot finalize checked outcomes.",
        "Cannot promote to parent by itself.",
        "Cannot serve passive historical packages.",
      ],
      parentInteraction: "Produces artifacts that may later be proposed upward through review.",
      childInteraction: "Has no direct child seeding authority.",
      peerInteraction: "Has no direct peer exchange authority.",
      defaultStageOrder: ["accept_material", "write_candidate_commit", "update_review_ref"],
      ownsStages: ["accept_material", "write_candidate_commit", "update_review_ref"],
    }),
    capabilityContract: createCapabilityContract({
      role: "iterator",
      contractId: "cmp-five-agent/iterator-capability-contract/v1",
      systemPromptMutation: "forbidden",
      git: {
        access: "write",
        allowedOperations: ["write_branch", "commit", "update_review_ref"],
        forbiddenOperations: ["promote_ref_without_review"],
        rationale: "Iterator is the cmp git primary writer for candidate progression.",
      },
      db: {
        access: "read",
        allowedOperations: ["read_projection_summary"],
        forbiddenOperations: ["write_projection", "write_package"],
        rationale: "Iterator can inspect supporting state but must not own DB truth.",
      },
      mq: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["publish_seed", "publish_delivery_receipt"],
        rationale: "Iterator stays on git progression, not delivery routing.",
      },
    }),
  }),
  checker: createRoleConfiguration({
    role: "checker",
    promptPack: createPromptPack({
      role: "checker",
      promptPackId: "cmp-five-agent/checker-prompt-pack/v1",
      lane: "checked_review",
      systemPrompt: "Restructure evidence, keep checked separate from suggest-promote, and assist parent review without replacing it.",
      systemPurpose: "review candidate commits and produce checked outcomes",
      systemPolicy: "decision_separated",
      mission: "Review candidate commits, produce checked snapshots, emit executable split/merge semantics, and optionally raise suggest-promote for parent review.",
      handoffContract: "handoff checked snapshot plus executable split/merge semantics and optional suggest-promote request; parent DBAgent remains primary reviewer",
      guardrails: [
        "checked and suggest-promote remain separate states.",
        "Split/merge outputs must be executable review semantics, not prose-only advice.",
        "Parent checker assistance is auxiliary under parent DBAgent review.",
        "Do not become the primary git writer.",
        "Execution semantics are advisory for rule execution and do not directly rewrite truth.",
      ],
      inputContract: [
        "candidate commit refs",
        "review ref metadata",
      ],
      outputContract: [
        "checked decision",
        "optional suggest-promote request",
        "parent checker assistance metadata",
        "split execution semantics",
        "merge execution semantics",
      ],
    }),
    profile: createProfile({
      role: "checker",
      profileId: "cmp-five-agent/checker-profile/v1",
      displayName: "Checker Agent",
      missionLabel: "checked-review",
      responsibilities: [
        "Restructure candidate evidence.",
        "Produce checked decisions.",
        "Emit execution-grade split/merge semantics for downstream rule execution.",
        "Escalate suggest-promote separately when parent review is warranted.",
      ],
      hardBoundaries: [
        "Cannot act as the final parent promote approver.",
        "Cannot own DB package materialization.",
        "Cannot become the cmp git primary writer.",
      ],
      parentInteraction: "Parent checker may assist with restructuring and evidence trimming before parent DBAgent review.",
      childInteraction: "Child checker performs local trimming after parent coarse review.",
      peerInteraction: "Has no peer routing authority.",
      defaultStageOrder: ["accept_candidate", "restructure", "checked", "suggest_promote"],
      ownsStages: ["accept_candidate", "restructure", "checked", "suggest_promote"],
    }),
    capabilityContract: createCapabilityContract({
      role: "checker",
      contractId: "cmp-five-agent/checker-capability-contract/v1",
      systemPromptMutation: "decision_separated",
      git: {
        access: "limited_write",
        allowedOperations: ["read_candidate_ref", "annotate_review_ref"],
        forbiddenOperations: ["become_primary_git_writer", "merge_parent_branch"],
        rationale: "Checker may apply limited review-side corrections without replacing iterator progression.",
      },
      db: {
        access: "read",
        allowedOperations: ["read_projection_summary", "read_package_family"],
        forbiddenOperations: ["write_projection", "write_package", "serve_passive"],
        rationale: "Checker relies on DB readback for evidence but cannot materialize truth.",
      },
      mq: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["publish_seed", "publish_delivery_receipt"],
        rationale: "Checker is not a routing role.",
      },
    }),
  }),
  dbagent: createRoleConfiguration({
    role: "dbagent",
    promptPack: createPromptPack({
      role: "dbagent",
      promptPackId: "cmp-five-agent/dbagent-prompt-pack/v1",
      lane: "db_projection",
      systemPrompt: "Project checked truth into packages, own parent-side review entry, and preserve high-fidelity passive replies.",
      systemPurpose: "own DB/package truth and parent-side review entry",
      systemPolicy: "package_authority",
      mission: "Materialize DB-backed package families with explicit primary-package, timeline-package, task-snapshot, and passive-history strategies, review parent-side promote requests, and serve passive historical replies.",
      handoffContract: "emit primary package, timeline attachment, task snapshots, passive packaging strategy, and parent-side review records",
      guardrails: [
        "DBAgent is the only role with primary DB write authority.",
        "Parent-side promote review lands here first.",
        "Primary package, timeline package, task snapshot, and passive historical reply must stay distinguishable.",
        "Do not steal cmp git primary progression from iterator.",
        "Keep active package, timeline package, task snapshots, and passive packaging strategies explicitly separated.",
      ],
      inputContract: [
        "checked snapshots",
        "reintervention requests carrying gap and current state",
      ],
      outputContract: [
        "primary context package",
        "timeline attachment",
        "task snapshot bundle",
        "passive historical reply package",
        "parent review record",
        "package-specific strategy set",
      ],
    }),
    profile: createProfile({
      role: "dbagent",
      profileId: "cmp-five-agent/dbagent-profile/v1",
      displayName: "DB Agent",
      missionLabel: "db-projection",
      responsibilities: [
        "Materialize DB-backed package families.",
        "Own parent-side promote review entry.",
        "Serve passive historical packages and reintervention replies.",
        "Keep active package, timeline package, task snapshots, and passive packaging strategies explicitly separated.",
      ],
      hardBoundaries: [
        "Cannot replace iterator as cmp git primary writer.",
        "Cannot bypass parent approval for peer exchange.",
        "Cannot rewrite raw truth outside DB/package surfaces.",
      ],
      parentInteraction: "Receives child promote and reintervention requests first on the parent side.",
      childInteraction: "Responds to child requests with coarse packages and snapshots.",
      peerInteraction: "Prepares peer exchange payloads but does not approve them alone.",
      defaultStageOrder: ["accept_checked", "project", "materialize_package", "attach_snapshots", "serve_passive"],
      ownsStages: ["accept_checked", "project", "materialize_package", "attach_snapshots", "serve_passive"],
    }),
    capabilityContract: createCapabilityContract({
      role: "dbagent",
      contractId: "cmp-five-agent/dbagent-capability-contract/v1",
      systemPromptMutation: "package_authority",
      git: {
        access: "read",
        allowedOperations: ["read_checked_ref", "read_promoted_ref"],
        forbiddenOperations: ["primary_commit_progression", "merge_without_review"],
        rationale: "DBAgent inspects git truth but does not own primary git progression.",
      },
      db: {
        access: "write",
        allowedOperations: ["write_projection", "write_package", "write_snapshot", "write_parent_review"],
        forbiddenOperations: ["rewrite_raw_truth_without_snapshot"],
        rationale: "DBAgent is the sole primary DB writer in CMP five-agent flow.",
      },
      mq: {
        access: "read",
        allowedOperations: ["read_delivery_receipts"],
        forbiddenOperations: ["publish_delivery_receipt"],
        rationale: "DBAgent consumes delivery evidence but does not act as the delivery router.",
      },
    }),
  }),
  dispatcher: createRoleConfiguration({
    role: "dispatcher",
    promptPack: createPromptPack({
      role: "dispatcher",
      promptPackId: "cmp-five-agent/dispatcher-prompt-pack/v1",
      lane: "delivery_routing",
      systemPrompt: "Route packages with explicit scope control: child seeds go only to child ICMA, peers require parent approval, passive replies return cleanly.",
      systemPurpose: "route packages under strict lineage policy",
      systemPolicy: "routing_only",
      mission: "Route CMP packages to core, child, parent, and peer targets under explicit policy control, with differentiated child-seed, peer-slim, and passive-return strategies.",
      handoffContract: "deliver package routing state, route-specific body strategy, and approval state; do not recut package truth",
      guardrails: [
        "Child seed must enter child ICMA only.",
        "Peer exchange requires explicit once-only parent approval.",
        "Dispatcher does not recut package truth.",
        "Peer slim exchange must stay on its allowed field list and passive returns must keep their clean return path.",
      ],
      inputContract: [
        "materialized context packages",
        "dispatch target metadata",
      ],
      outputContract: [
        "delivery receipt",
        "child-seed route bundle",
        "peer slim exchange bundle",
        "passive return bundle",
        "peer approval state when needed",
        "route-specific body strategy",
      ],
    }),
    profile: createProfile({
      role: "dispatcher",
      profileId: "cmp-five-agent/dispatcher-profile/v1",
      displayName: "Dispatcher Agent",
      missionLabel: "delivery-routing",
      responsibilities: [
        "Route context packages.",
        "Return passive history to the requester.",
        "Keep package flow and approval state visible.",
        "Enforce different bundle discipline for child seed, peer slim exchange, and passive return.",
      ],
      hardBoundaries: [
        "Cannot own cmp git progression.",
        "Cannot own DB truth projection.",
        "Cannot approve peer exchange without parent approval chain.",
      ],
      parentInteraction: "Routes upward and peer-bound payloads under parent-controlled approval.",
      childInteraction: "Seeds child work by delivering packages to child ICMA only.",
      peerInteraction: "Routes slim peer exchange packages after explicit parent approval.",
      defaultStageOrder: ["route", "deliver", "collect_receipt", "timeout_handle"],
      ownsStages: ["route", "deliver", "collect_receipt", "timeout_handle"],
    }),
    capabilityContract: createCapabilityContract({
      role: "dispatcher",
      contractId: "cmp-five-agent/dispatcher-capability-contract/v1",
      systemPromptMutation: "forbidden",
      git: {
        access: "none",
        allowedOperations: [],
        forbiddenOperations: ["write_branch", "commit", "merge", "promote_ref"],
        rationale: "Dispatcher is a routing role and must not own git progression.",
      },
      db: {
        access: "read",
        allowedOperations: ["read_package_family", "read_snapshot_summary"],
        forbiddenOperations: ["write_projection", "write_package"],
        rationale: "Dispatcher reads package state but must not rewrite truth.",
      },
      mq: {
        access: "route_only",
        allowedOperations: ["publish_delivery_receipt", "publish_child_seed", "publish_peer_exchange_notice"],
        forbiddenOperations: ["approve_peer_exchange_without_parent"],
        rationale: "Dispatcher is the primary routing publisher in CMP five-agent flow.",
      },
    }),
  }),
};

export function createDefaultCmpFiveAgentRoleCatalog(): Record<CmpFiveAgentRole, CmpRoleConfiguration> {
  return clone(DEFAULT_ROLE_CATALOG);
}

export function createCmpRoleConfigurationSnapshot(): Record<CmpFiveAgentRole, CmpRoleConfiguration> {
  return createDefaultCmpFiveAgentRoleCatalog();
}

export function createCmpFiveAgentConfiguration(): CmpFiveAgentConfiguration {
  return {
    version: CMP_FIVE_AGENT_CONFIGURATION_VERSION,
    roles: createDefaultCmpFiveAgentRoleCatalog(),
  };
}

export function getCmpRoleConfiguration(role: CmpFiveAgentRole): CmpRoleConfiguration {
  return clone(DEFAULT_ROLE_CATALOG[role]);
}

export function getCmpFiveAgentRoleDefinition(role: CmpFiveAgentRole): CmpRoleConfiguration {
  return getCmpRoleConfiguration(role);
}

export function getCmpRolePromptPack(role: CmpFiveAgentRole): CmpRolePromptPack {
  return getCmpRoleConfiguration(role).promptPack;
}

export function getCmpRoleProfile(role: CmpFiveAgentRole): CmpRoleProfile {
  return getCmpRoleConfiguration(role).profile;
}

export function getCmpRoleCapabilityContract(role: CmpFiveAgentRole): CmpRoleCapabilityContract {
  return getCmpRoleConfiguration(role).capabilityContract;
}

export function listCmpRoleConfigurations(): CmpRoleConfiguration[] {
  return CMP_FIVE_AGENT_ROLES.map((role) => getCmpRoleConfiguration(role));
}

export function createCmpRoleCapabilityMatrix(
  configuration: CmpFiveAgentConfiguration = createCmpFiveAgentConfiguration(),
): CmpRoleCapabilityMatrixEntry[] {
  return CMP_FIVE_AGENT_ROLES.map((role) => {
    const config = configuration.roles[role];
    return {
      role,
      promptPackId: config.promptPack.promptPackId,
      profileId: config.profile.profileId,
      capabilityContractId: config.capabilityContract.contractId,
      git: {
        accessLevel: config.capabilityContract.git.access,
        ownership: toOwnership({
          role,
          channel: "git",
          accessLevel: config.capabilityContract.git.access,
        }),
      },
      db: {
        accessLevel: config.capabilityContract.db.access,
        ownership: toOwnership({
          role,
          channel: "db",
          accessLevel: config.capabilityContract.db.access,
        }),
      },
      mq: {
        accessLevel: config.capabilityContract.mq.access,
        ownership: toOwnership({
          role,
          channel: "mq",
          accessLevel: config.capabilityContract.mq.access,
        }),
      },
    };
  });
}

export function createCmpFiveAgentRoleSummaryCatalog(
  configuration: CmpFiveAgentConfiguration = createCmpFiveAgentConfiguration(),
): CmpFiveAgentRoleSummaryCatalog {
  return CMP_FIVE_AGENT_ROLES.reduce<CmpFiveAgentRoleSummaryCatalog>((accumulator, role) => {
    const config = configuration.roles[role];
    const tapProfile = createCmpRoleTapProfile(role);
    accumulator[role] = {
      promptPackId: config.promptPack.promptPackId,
      profileId: config.profile.profileId,
      capabilityContractId: config.capabilityContract.contractId,
      tapProfileId: tapProfile.profileId,
      gitAccessLevel: config.capabilityContract.git.access,
      dbAccessLevel: config.capabilityContract.db.access,
      mqAccessLevel: config.capabilityContract.mq.access,
    };
    return accumulator;
  }, {
    icma: {
      promptPackId: "",
      profileId: "",
      capabilityContractId: "",
      tapProfileId: "",
      gitAccessLevel: "none",
      dbAccessLevel: "none",
      mqAccessLevel: "none",
    },
    iterator: {
      promptPackId: "",
      profileId: "",
      capabilityContractId: "",
      tapProfileId: "",
      gitAccessLevel: "none",
      dbAccessLevel: "none",
      mqAccessLevel: "none",
    },
    checker: {
      promptPackId: "",
      profileId: "",
      capabilityContractId: "",
      tapProfileId: "",
      gitAccessLevel: "none",
      dbAccessLevel: "none",
      mqAccessLevel: "none",
    },
    dbagent: {
      promptPackId: "",
      profileId: "",
      capabilityContractId: "",
      tapProfileId: "",
      gitAccessLevel: "none",
      dbAccessLevel: "none",
      mqAccessLevel: "none",
    },
    dispatcher: {
      promptPackId: "",
      profileId: "",
      capabilityContractId: "",
      tapProfileId: "",
      gitAccessLevel: "none",
      dbAccessLevel: "none",
      mqAccessLevel: "none",
    },
  });
}

export function createCmpFiveAgentCapabilityMatrixSummary(
  configuration: CmpFiveAgentConfiguration = createCmpFiveAgentConfiguration(),
): CmpFiveAgentCapabilityMatrixSummary {
  const matrix = createCmpRoleCapabilityMatrix(configuration);
  return {
    gitWriters: matrix
      .filter((entry) => entry.git.ownership === "primary" || entry.git.accessLevel === "limited_write")
      .map((entry) => entry.role),
    dbWriters: matrix
      .filter((entry) => entry.db.ownership === "primary")
      .map((entry) => entry.role),
    mqPublishers: matrix
      .filter((entry) => entry.mq.ownership === "primary" || entry.mq.accessLevel === "publish_only")
      .map((entry) => entry.role),
  };
}

export function createCmpRoleTapProfile(role: CmpFiveAgentRole): AgentCapabilityProfile {
  switch (role) {
    case "icma":
      return createAgentCapabilityProfile({
        profileId: "cmp-five-agent/icma-tap-profile/v1",
        agentClass: "cmp-five-agent.icma",
        defaultMode: "standard",
        baselineTier: "B1",
        baselineCapabilities: ["docs.read", "code.read", "cmp.db.read"],
        allowedCapabilityPatterns: ["cmp.mq.publish.input"],
        deniedCapabilityPatterns: ["cmp.git.*", "cmp.db.write*", "cmp.mq.publish.delivery", "cmp.mq.publish.peer*"],
        notes: "ICMA can read supporting state and publish ingress hints, but cannot write git.",
        metadata: {
          role,
          primaryChannel: "ingress",
        },
      });
    case "iterator":
      return createAgentCapabilityProfile({
        profileId: "cmp-five-agent/iterator-tap-profile/v1",
        agentClass: "cmp-five-agent.iterator",
        defaultMode: "restricted",
        baselineTier: "B2",
        baselineCapabilities: ["docs.read", "code.read", "cmp.git.read"],
        allowedCapabilityPatterns: ["cmp.git.write", "cmp.git.review_ref.*", "cmp.db.read"],
        deniedCapabilityPatterns: ["cmp.db.write*", "cmp.mq.*"],
        notes: "Iterator is the primary git writer for CMP candidate progression.",
        metadata: {
          role,
          primaryChannel: "git",
        },
      });
    case "checker":
      return createAgentCapabilityProfile({
        profileId: "cmp-five-agent/checker-tap-profile/v1",
        agentClass: "cmp-five-agent.checker",
        defaultMode: "standard",
        baselineTier: "B1",
        baselineCapabilities: ["docs.read", "code.read", "cmp.git.read", "cmp.db.read"],
        allowedCapabilityPatterns: ["cmp.git.review_fix", "cmp.db.read"],
        deniedCapabilityPatterns: ["cmp.git.write", "cmp.db.write*", "cmp.mq.*"],
        notes: "Checker can apply limited review-side corrections but not primary progression.",
        metadata: {
          role,
          primaryChannel: "checked_review",
        },
      });
    case "dbagent":
      return createAgentCapabilityProfile({
        profileId: "cmp-five-agent/dbagent-tap-profile/v1",
        agentClass: "cmp-five-agent.dbagent",
        defaultMode: "restricted",
        baselineTier: "B2",
        baselineCapabilities: ["docs.read", "code.read", "cmp.git.read", "cmp.db.read"],
        allowedCapabilityPatterns: ["cmp.db.write", "cmp.db.parent_review", "cmp.db.snapshot.*", "cmp.mq.read"],
        deniedCapabilityPatterns: ["cmp.git.write*", "cmp.mq.publish.*"],
        notes: "DBAgent owns DB projection, parent review entry, and passive package serving.",
        metadata: {
          role,
          primaryChannel: "db",
        },
      });
    case "dispatcher":
      return createAgentCapabilityProfile({
        profileId: "cmp-five-agent/dispatcher-tap-profile/v1",
        agentClass: "cmp-five-agent.dispatcher",
        defaultMode: "standard",
        baselineTier: "B1",
        baselineCapabilities: ["docs.read", "code.read", "cmp.db.read"],
        allowedCapabilityPatterns: ["cmp.mq.publish.delivery", "cmp.mq.publish.child_seed", "cmp.mq.publish.peer*"],
        deniedCapabilityPatterns: ["cmp.git.*", "cmp.db.write*"],
        notes: "Dispatcher is the routing publisher and must stay off git and DB writes.",
        metadata: {
          role,
          primaryChannel: "mq",
        },
      });
  }
}

export function createCmpFiveAgentTapProfileCatalog(): CmpFiveAgentTapProfileCatalog {
  return {
    icma: createCmpRoleTapProfile("icma"),
    iterator: createCmpRoleTapProfile("iterator"),
    checker: createCmpRoleTapProfile("checker"),
    dbagent: createCmpRoleTapProfile("dbagent"),
    dispatcher: createCmpRoleTapProfile("dispatcher"),
  };
}

export function getCmpDefaultRoleLiveLlmMode(role: CmpFiveAgentRole): CmpRoleLiveLlmMode {
  return CMP_DEFAULT_ROLE_LIVE_LLM_MODES[role];
}

export function createCmpRoleLiveLlmModeCatalog(): Record<CmpFiveAgentRole, CmpRoleLiveLlmMode> {
  return {
    ...CMP_DEFAULT_ROLE_LIVE_LLM_MODES,
  };
}
