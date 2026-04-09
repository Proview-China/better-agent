import type {
  ReplayPolicy,
  PoolActivationSpec,
  TaCapabilityTier,
} from "../ta-pool-types/index.js";
import { createPoolActivationSpec } from "../ta-pool-types/index.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  createCapabilityPackageSupportMatrix,
  type CapabilityPackage,
} from "./capability-package.js";

export const MP_FAMILY_CAPABILITY_KEYS = [
  "mp.ingest",
  "mp.align",
  "mp.resolve",
  "mp.history.request",
  "mp.search",
  "mp.materialize",
  "mp.promote",
  "mp.archive",
  "mp.split",
  "mp.merge",
  "mp.reindex",
  "mp.compact",
] as const;

export type MpFamilyCapabilityKey = (typeof MP_FAMILY_CAPABILITY_KEYS)[number];

export const RAX_MP_ACTIVATION_FACTORY_REFS: Readonly<Record<MpFamilyCapabilityKey, string>> = {
  "mp.ingest": "factory:rax.mp:ingest",
  "mp.align": "factory:rax.mp:align",
  "mp.resolve": "factory:rax.mp:resolve",
  "mp.history.request": "factory:rax.mp:history.request",
  "mp.search": "factory:rax.mp:search",
  "mp.materialize": "factory:rax.mp:materialize",
  "mp.promote": "factory:rax.mp:promote",
  "mp.archive": "factory:rax.mp:archive",
  "mp.split": "factory:rax.mp:split",
  "mp.merge": "factory:rax.mp:merge",
  "mp.reindex": "factory:rax.mp:reindex",
  "mp.compact": "factory:rax.mp:compact",
};

export interface CreateRaxMpCapabilityPackageInput {
  capabilityKey: MpFamilyCapabilityKey;
  tier?: TaCapabilityTier;
  version?: string;
  generation?: number;
  replayPolicy?: ReplayPolicy;
  activationSpec?: PoolActivationSpec;
}

interface MpCapabilityDefaults {
  description: string;
  tags: string[];
  allowedOperations: string[];
  successCriteria: string[];
  failureSignals: string[];
  evidenceOutput: string[];
  usageDocRef: string;
  exampleInput: Record<string, unknown>;
}

const MP_USAGE_DOC_REF = "docs/ability/29-cmp-context-management-pool-outline.md";

const MP_CAPABILITY_DEFAULTS: Record<MpFamilyCapabilityKey, MpCapabilityDefaults> = {
  "mp.ingest": {
    description: "Run the MP five-agent ingest workflow and materialize aligned memory into LanceDB.",
    tags: ["mp", "workflow", "ingest", "memory", "rax"],
    allowedOperations: ["memory.capture", "memory.align", "memory.write"],
    successCriteria: [
      "produces aligned MP memory records through the five-agent workflow",
      "records freshness, confidence, and alignment metadata",
    ],
    failureSignals: [
      "storedSection or checkedSnapshotRef is missing",
      "scope is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-five-agent-summary", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      agentIds: ["main"],
      storedSection: {
        id: "stored-1",
      },
      checkedSnapshotRef: "snapshot-1",
      branchRef: "mp/main",
    },
  },
  "mp.align": {
    description: "Run the MP checker and dbagent alignment workflow for one memory record.",
    tags: ["mp", "workflow", "align", "memory", "rax"],
    allowedOperations: ["memory.align", "memory.supersede"],
    successCriteria: [
      "updates freshness and alignment metadata",
      "supersedes or stales older related memories when needed",
    ],
    failureSignals: [
      "record is missing",
      "alignedAt is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-five-agent-summary", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      record: {
        memoryId: "memory-1",
      },
      alignedAt: "2026-04-09T00:00:00.000Z",
    },
  },
  "mp.resolve": {
    description: "Run the MP dispatcher workflow to resolve a high-signal memory bundle.",
    tags: ["mp", "workflow", "resolve", "memory", "rax"],
    allowedOperations: ["memory.search", "memory.route_bundle"],
    successCriteria: [
      "returns a primary/supporting memory bundle",
      "prefers fresh and aligned memories over stale ones",
    ],
    failureSignals: [
      "queryText is missing",
      "requesterLineage is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-workflow-bundle"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      queryText: "current decision history",
      requesterLineage: {
        projectId: "project.praxis",
        agentId: "main",
        depth: 0,
      },
      sourceLineages: [
        {
          projectId: "project.praxis",
          agentId: "main",
          depth: 0,
        },
      ],
    },
  },
  "mp.history.request": {
    description: "Run the MP passive history workflow and return a bundle for context replay.",
    tags: ["mp", "workflow", "history", "memory", "rax"],
    allowedOperations: ["memory.search", "memory.route_bundle"],
    successCriteria: [
      "returns a passive history bundle",
      "tracks passive return count in MP summary",
    ],
    failureSignals: [
      "queryText is missing",
      "requesterLineage is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-workflow-bundle"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      queryText: "history replay",
      requesterLineage: {
        projectId: "project.praxis",
        agentId: "main",
        depth: 0,
      },
      sourceLineages: [
        {
          projectId: "project.praxis",
          agentId: "main",
          depth: 0,
        },
      ],
    },
  },
  "mp.search": {
    description: "Search MP memory scopes through the RAX MP runtime.",
    tags: ["mp", "memory", "search", "rax"],
    allowedOperations: ["memory.read", "memory.search"],
    successCriteria: [
      "returns ordered MP memory hits",
      "applies scope and session bridge filtering before returning results",
    ],
    failureSignals: [
      "projectId or rootPath is missing",
      "queryText or requesterLineage is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-search-result"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      queryText: "history answer",
      requesterLineage: {
        projectId: "project.praxis",
        agentId: "main",
        depth: 0,
      },
      sourceLineages: [
        {
          projectId: "project.praxis",
          agentId: "main",
          depth: 0,
        },
      ],
    },
  },
  "mp.materialize": {
    description: "Materialize a stored CMP section into MP memory through the RAX MP runtime.",
    tags: ["mp", "memory", "materialize", "rax"],
    allowedOperations: ["memory.write", "memory.materialize"],
    successCriteria: [
      "stores at least one MP memory record",
      "keeps source section and stored section refs attached",
    ],
    failureSignals: [
      "storedSection or checkedSnapshotRef is missing",
      "branchRef or scope is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      agentIds: ["main"],
      storedSection: {
        id: "stored-1",
      },
      checkedSnapshotRef: "snapshot-1",
      branchRef: "mp/main",
    },
  },
  "mp.promote": {
    description: "Promote an MP memory record to a broader scope through the RAX MP runtime.",
    tags: ["mp", "memory", "promote", "rax"],
    allowedOperations: ["memory.write", "memory.promote"],
    successCriteria: [
      "updates the MP memory scope",
      "records promoter metadata",
    ],
    failureSignals: [
      "memory, owner, promoter, or nextScopeLevel is missing",
      "promotion breaks lineage constraints",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      agentIds: ["main", "child"],
      memory: {
        memoryId: "memory-1",
      },
      nextScopeLevel: "project",
    },
  },
  "mp.archive": {
    description: "Archive an MP memory record through the RAX MP runtime.",
    tags: ["mp", "memory", "archive", "rax"],
    allowedOperations: ["memory.write", "memory.archive"],
    successCriteria: [
      "marks the target record archived",
      "preserves audit metadata for the archive event",
    ],
    failureSignals: [
      "memoryId or scopeLevel is missing",
      "table resolution fails for the requested archive operation",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      agentIds: ["main"],
      agentId: "main",
      memoryId: "memory-1",
      scopeLevel: "agent_isolated",
      archivedAt: "2026-04-08T00:00:00.000Z",
    },
  },
  "mp.split": {
    description: "Split one MP memory record into smaller chunks through the RAX MP runtime.",
    tags: ["mp", "memory", "split", "rax"],
    allowedOperations: ["memory.write", "memory.split"],
    successCriteria: [
      "creates derived MP memory chunks",
      "preserves split ancestry metadata",
    ],
    failureSignals: [
      "sourceRecord or split input is missing",
      "targetChunkCount is invalid",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      tableName: "mp_project_project_praxis_memories",
      sourceRecord: {
        memoryId: "memory-1",
      },
      split: {
        memoryId: "memory-1",
        sourceAgentId: "main",
        targetChunkCount: 2,
        splitReason: "Need smaller chunks.",
        createdAt: "2026-04-08T00:00:00.000Z",
      },
    },
  },
  "mp.merge": {
    description: "Merge sibling MP memory records into one semantic bundle through the RAX MP runtime.",
    tags: ["mp", "memory", "merge", "rax"],
    allowedOperations: ["memory.write", "memory.merge"],
    successCriteria: [
      "creates one merged MP memory record",
      "returns the semantic bundle summary",
    ],
    failureSignals: [
      "sourceRecords or merge input is missing",
      "merge input has fewer than two source ids",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record", "mp-semantic-bundle"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      tableName: "mp_project_project_praxis_memories",
      sourceRecords: [
        { memoryId: "memory-a" },
        { memoryId: "memory-b" },
      ],
      merge: {
        sourceMemoryIds: ["memory-a", "memory-b"],
        mergedMemoryId: "memory-merged",
        targetAgentId: "main",
        mergeReason: "Collapse sibling memories.",
        createdAt: "2026-04-08T00:00:00.000Z",
      },
    },
  },
  "mp.reindex": {
    description: "Reindex one MP memory record through the RAX MP runtime.",
    tags: ["mp", "memory", "reindex", "rax"],
    allowedOperations: ["memory.write", "memory.reindex"],
    successCriteria: [
      "updates the record in place",
      "records reindexedAt metadata",
    ],
    failureSignals: [
      "record is missing",
      "reindexedAt is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      tableName: "mp_project_project_praxis_memories",
      record: {
        memoryId: "memory-1",
      },
      reindexedAt: "2026-04-08T00:00:00.000Z",
    },
  },
  "mp.compact": {
    description: "Compact one semantic group by archiving superseded MP records through the RAX MP runtime.",
    tags: ["mp", "memory", "compact", "rax"],
    allowedOperations: ["memory.write", "memory.compact"],
    successCriteria: [
      "archives every non-retained record in the semantic group",
      "keeps the requested primary record visible",
    ],
    failureSignals: [
      "records or keepMemoryId is missing",
      "archivedAt is missing",
    ],
    evidenceOutput: ["capability-result-envelope", "mp-memory-record"],
    usageDocRef: MP_USAGE_DOC_REF,
    exampleInput: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      tableName: "mp_project_project_praxis_memories",
      keepMemoryId: "memory-merged",
      archivedAt: "2026-04-08T00:00:00.000Z",
      records: [
        { memoryId: "memory-a" },
        { memoryId: "memory-b" },
        { memoryId: "memory-merged" },
      ],
    },
  },
};

function createMpCapabilitySupportMatrix() {
  return createCapabilityPackageSupportMatrix({
    routes: [
      {
        provider: "openai",
        sdkLayer: "agent",
        lowering: "package-runtime",
        status: "documented",
        preferred: true,
        notes: [
          "MP capabilities execute through the RAX MP runtime shell instead of provider-native APIs.",
        ],
      },
      {
        provider: "anthropic",
        sdkLayer: "agent",
        lowering: "package-runtime",
        status: "documented",
      },
      {
        provider: "deepmind",
        sdkLayer: "agent",
        lowering: "package-runtime",
        status: "documented",
      },
    ],
    metadata: {
      capabilityFamily: "mp",
      executionSurface: "package-runtime",
    },
  });
}

export function createRaxMpCapabilityPackage(
  input: CreateRaxMpCapabilityPackageInput,
): CapabilityPackage {
  const defaults = MP_CAPABILITY_DEFAULTS[input.capabilityKey];
  const replayPolicy = input.replayPolicy ?? "re_review_then_dispatch";
  const activationSpec = input.activationSpec ?? createPoolActivationSpec({
    targetPool: "ta-capability-pool",
    activationMode: "activate_after_verify",
    registerOrReplace: "register_or_replace",
    generationStrategy: "create_next_generation",
    drainStrategy: "graceful",
    manifestPayload: {
      capabilityKey: input.capabilityKey,
      capabilityId: `capability:${input.capabilityKey}:${input.generation ?? 1}`,
      version: input.version ?? "1.0.0",
      generation: input.generation ?? 1,
      kind: "tool",
      description: defaults.description,
      supportsPrepare: true,
      routeHints: [
        { key: "runtime", value: "rax-mp" },
        { key: "capability_family", value: "mp" },
        { key: "mp_action", value: input.capabilityKey.replace("mp.", "") },
      ],
      tags: defaults.tags,
    },
    bindingPayload: {
      adapterId: "rax.mp.adapter",
      runtimeKind: "rax-mp",
      capabilityKey: input.capabilityKey,
    },
    adapterFactoryRef: RAX_MP_ACTIVATION_FACTORY_REFS[input.capabilityKey],
  });

  return createCapabilityPackage({
    manifest: {
      capabilityKey: input.capabilityKey,
      capabilityKind: "tool",
      tier: input.tier ?? "B1",
      version: input.version ?? "1.0.0",
      generation: input.generation ?? 1,
      description: defaults.description,
      dependencies: ["rax.mp"],
      tags: defaults.tags,
      routeHints: [
        { key: "runtime", value: "rax-mp" },
        { key: "capability_family", value: "mp" },
        { key: "mp_action", value: input.capabilityKey.replace("mp.", "") },
      ],
      supportedPlatforms: ["linux", "macos", "windows"],
    },
    supportMatrix: createMpCapabilitySupportMatrix(),
    adapter: {
      adapterId: "rax.mp.adapter",
      runtimeKind: "rax-mp",
      supports: [input.capabilityKey],
      prepare: {
        ref: "integrations/rax-mp-adapter#prepare",
      },
      execute: {
        ref: "integrations/rax-mp-adapter#execute",
      },
      resultMapping: {
        successStatuses: ["success"],
        artifactKinds: ["memory", "search_result"],
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: input.tier ?? "B1",
        mode: "standard",
        scope: {
          allowedOperations: defaults.allowedOperations,
        },
      },
      recommendedMode: "standard",
      riskLevel: "normal",
      defaultScope: {
        allowedOperations: defaults.allowedOperations,
      },
      reviewRequirements: ["allow_with_constraints"],
      safetyFlags: ["memory_scope_governance", "session_bridge_control"],
      humanGateRequirements: [],
    },
    builder: {
      builderId: `builder:${input.capabilityKey}:rax-mp`,
      buildStrategy: "mount-existing-runtime",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: ["workspace/**"],
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: replayPolicy,
    },
    verification: {
      smokeEntry: `test:agent_core:rax-mp-adapter:${input.capabilityKey}`,
      healthEntry: `health:rax:mp:${input.capabilityKey.replace("mp.", "")}`,
      successCriteria: defaults.successCriteria,
      failureSignals: defaults.failureSignals,
      evidenceOutput: defaults.evidenceOutput,
    },
    usage: {
      usageDocRef: defaults.usageDocRef,
      bestPractices: [
        "Keep projectId and rootPath explicit so the runtime resolves the right Lance workspace.",
        "Only promote or archive after lineage and scope checks are satisfied.",
      ],
      knownLimits: [
        "This first MP family only covers search, materialize, promote, and archive.",
        "split/merge/reindex/compact remain runtime shell operations for now.",
      ],
      exampleInvocations: [
        {
          exampleId: `example.${input.capabilityKey}`,
          capabilityKey: input.capabilityKey,
          operation: input.capabilityKey,
          input: defaults.exampleInput,
          notes: `Minimal ${input.capabilityKey} invocation through the RAX MP runtime.`,
        },
      ],
    },
    lifecycle: {
      installStrategy: "reuse configured RAX MP runtime without additional install",
      replaceStrategy: "register_or_replace active binding generation",
      rollbackStrategy: "restore the previous MP adapter binding",
      deprecateStrategy: "disable the MP adapter factory before draining superseded bindings",
      cleanupStrategy: "clear superseded MP binding artifacts after drain completes",
      generationPolicy: "create_next_generation",
    },
    activationSpec,
    replayPolicy,
    metadata: {
      bundleId: `bundle:${input.capabilityKey}:rax-mp`,
      provisionId: `provision:${input.capabilityKey}:rax-mp`,
    },
  });
}

export function createRaxMpCapabilityPackageCatalog(): CapabilityPackage[] {
  return MP_FAMILY_CAPABILITY_KEYS.map((capabilityKey) =>
    createRaxMpCapabilityPackage({
      capabilityKey,
    }),
  );
}
