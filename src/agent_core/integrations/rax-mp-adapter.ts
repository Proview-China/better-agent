import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import { createCapabilityManifestFromPackage, createRaxMpCapabilityPackage } from "../capability-package/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { RaxFacade } from "../../rax/facade.js";
import type {
  RaxMpAlignInput,
  RaxMpArchiveInput,
  RaxMpCompactInput,
  RaxMpIngestInput,
  RaxMpMergeInput,
  RaxMpMaterializeInput,
  RaxMpPromoteInput,
  RaxMpReindexInput,
  RaxMpRequestHistoryInput,
  RaxMpResolveInput,
  RaxMpSearchInput,
  RaxMpSplitInput,
} from "../../rax/index.js";
import { rax } from "../../rax/index.js";
import type { MpLineageNode, MpMemoryRecord, MpScopeLevel } from "../index.js";

export const RAX_MP_ADAPTER_CAPABILITY_KEYS = [
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

export type RaxMpAdapterCapabilityKey = (typeof RAX_MP_ADAPTER_CAPABILITY_KEYS)[number];

export const RAX_MP_ADAPTER_ID = "rax.mp.adapter";
export const RAX_MP_RUNTIME_KIND = "rax-mp";

export interface RaxMpRegistrationTarget {
  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ): unknown;
  registerTaActivationFactory(
    ref: string,
    factory: ActivationAdapterFactory,
  ): void;
}

export interface RegisterRaxMpCapabilityFamilyInput {
  runtime: RaxMpRegistrationTarget;
  facade?: Pick<RaxFacade, "mp">;
  capabilityKeys?: readonly RaxMpAdapterCapabilityKey[];
}

export interface RegisterRaxMpCapabilityFamilyResult {
  capabilityKeys: RaxMpAdapterCapabilityKey[];
  activationFactoryRefs: string[];
  manifests: CapabilityManifest[];
  packages: CapabilityPackage[];
  bindings: unknown[];
}

type PreparedMpExecutionState =
  | {
    action: "mp.ingest";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpIngestInput["payload"];
  }
  | {
    action: "mp.align";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpAlignInput["payload"];
  }
  | {
    action: "mp.resolve";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpResolveInput["payload"];
  }
  | {
    action: "mp.history.request";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpRequestHistoryInput["payload"];
  }
  | {
    action: "mp.search";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpSearchInput["payload"];
  }
  | {
    action: "mp.materialize";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpMaterializeInput["payload"];
  }
  | {
    action: "mp.promote";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpPromoteInput["payload"];
  }
  | {
    action: "mp.archive";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpArchiveInput["payload"];
  }
  | {
    action: "mp.split";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpSplitInput["payload"];
  }
  | {
    action: "mp.merge";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpMergeInput["payload"];
  }
  | {
    action: "mp.reindex";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpReindexInput["payload"];
  }
  | {
    action: "mp.compact";
    projectId: string;
    rootPath: string;
    agentIds: string[];
    payload: RaxMpCompactInput["payload"];
  };

interface MpFacadeLike {
  mp: Pick<RaxFacade["mp"],
    "create"
    | "bootstrap"
    | "readback"
    | "smoke"
    | "ingest"
    | "align"
    | "resolve"
    | "requestHistory"
    | "search"
    | "materialize"
    | "promote"
    | "archive"
    | "split"
    | "merge"
    | "reindex"
    | "compact"
  >;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((entry): entry is string => typeof entry === "string");
  return normalized.length > 0 ? normalized : undefined;
}

function asLineageNode(value: unknown): MpLineageNode {
  const record = asObject(value);
  if (!record) {
    throw new Error("mp lineage input must be an object.");
  }
  const projectId = asString(record.projectId);
  const agentId = asString(record.agentId);
  const depth = typeof record.depth === "number" ? record.depth : undefined;
  if (!projectId || !agentId || depth === undefined) {
    throw new Error("mp lineage input requires projectId, agentId, and depth.");
  }
  return {
    projectId,
    agentId,
    parentAgentId: asString(record.parentAgentId),
    depth,
    childAgentIds: asStringArray(record.childAgentIds),
    peerAgentIds: asStringArray(record.peerAgentIds),
    metadata: asObject(record.metadata),
  };
}

function asMemoryRecord(value: unknown): MpMemoryRecord {
  const record = asObject(value);
  if (!record) {
    throw new Error("mp memory input must be an object.");
  }
  if (!asString(record.memoryId) || !asString(record.projectId) || !asString(record.agentId)) {
    throw new Error("mp memory input requires memoryId, projectId, and agentId.");
  }
  return record as unknown as MpMemoryRecord;
}

function parseCommonConfig(input: Record<string, unknown>) {
  const projectId = asString(input.projectId);
  const rootPath = asString(input.rootPath);
  const agentIds = asStringArray(input.agentIds);
  if (!projectId) {
    throw new Error("mp capability input is missing projectId.");
  }
  if (!rootPath) {
    throw new Error("mp capability input is missing rootPath.");
  }
  return {
    projectId,
    rootPath,
    agentIds: agentIds ?? [],
  };
}

function deriveAgentIds(params: {
  base: string[];
  payload?: Record<string, unknown>;
  lineageNodes?: MpLineageNode[];
  memory?: MpMemoryRecord;
}): string[] {
  return [...new Set([
    ...params.base,
    ...(params.lineageNodes?.map((lineage) => lineage.agentId) ?? []),
    params.memory?.agentId ?? "",
    asString(params.payload?.agentId) ?? "",
  ].map((value) => value.trim()).filter(Boolean))];
}

function parseSearchInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const requesterLineage = asLineageNode(input.requesterLineage);
  const sourceLineagesValue = input.sourceLineages;
  if (!Array.isArray(sourceLineagesValue) || sourceLineagesValue.length === 0) {
    throw new Error("mp.search invocation requires sourceLineages.");
  }
  const sourceLineages = sourceLineagesValue.map(asLineageNode);
  const queryText = asString(input.queryText);
  if (!queryText) {
    throw new Error("mp.search invocation is missing queryText.");
  }

  return {
    action: "mp.search",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      lineageNodes: [requesterLineage, ...sourceLineages],
    }),
    payload: {
      queryText,
      requesterLineage,
      requesterSessionId: asString(input.requesterSessionId),
      sourceLineages,
      agentTableNames: asStringArray(input.agentTableNames),
      scopeLevels: (input.scopeLevels as MpScopeLevel[] | undefined) ?? undefined,
      limit: typeof input.limit === "number" ? input.limit : undefined,
      metadata: asObject(input.metadata),
    },
  };
}

function parseIngestInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const storedSection = asObject(input.storedSection);
  const scope = asObject(input.scope);
  const checkedSnapshotRef = asString(input.checkedSnapshotRef);
  const branchRef = asString(input.branchRef);
  if (!storedSection || !scope || !checkedSnapshotRef || !branchRef) {
    throw new Error("mp.ingest invocation requires storedSection, checkedSnapshotRef, branchRef, and scope.");
  }
  return {
    action: "mp.ingest",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      payload: { agentId: asString(storedSection.agentId) },
    }),
    payload: {
      storedSection: storedSection as unknown as RaxMpIngestInput["payload"]["storedSection"],
      checkedSnapshotRef,
      branchRef,
      scope: scope as unknown as RaxMpIngestInput["payload"]["scope"],
      observedAt: asString(input.observedAt),
      capturedAt: asString(input.capturedAt),
      sourceRefs: asStringArray(input.sourceRefs),
      memoryKind: asString(input.memoryKind) as RaxMpIngestInput["payload"]["memoryKind"],
      confidence: asString(input.confidence) as RaxMpIngestInput["payload"]["confidence"],
      metadata: asObject(input.metadata),
    },
  };
}

function parseAlignInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const record = asMemoryRecord(input.record);
  const alignedAt = asString(input.alignedAt);
  if (!alignedAt) {
    throw new Error("mp.align invocation requires alignedAt.");
  }
  return {
    action: "mp.align",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      memory: record,
    }),
    payload: {
      record,
      alignedAt,
      tableName: asString(input.tableName),
      queryText: asString(input.queryText),
      metadata: asObject(input.metadata),
    },
  };
}

function parseResolveInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const search = parseSearchInput(plan);
  if (search.action !== "mp.search") {
    throw new Error("mp.resolve invocation could not be normalized from search input.");
  }
  return {
    action: "mp.resolve",
    projectId: search.projectId,
    rootPath: search.rootPath,
    agentIds: search.agentIds,
    payload: search.payload,
  };
}

function parseHistoryInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const search = parseSearchInput(plan);
  if (search.action !== "mp.search") {
    throw new Error("mp.history.request invocation could not be normalized from search input.");
  }
  return {
    action: "mp.history.request",
    projectId: search.projectId,
    rootPath: search.rootPath,
    agentIds: search.agentIds,
    payload: search.payload,
  };
}

function parseMaterializeInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const storedSection = asObject(input.storedSection);
  const checkedSnapshotRef = asString(input.checkedSnapshotRef);
  const branchRef = asString(input.branchRef);
  const scope = asObject(input.scope);
  if (!storedSection || !checkedSnapshotRef || !branchRef || !scope) {
    throw new Error("mp.materialize invocation requires storedSection, checkedSnapshotRef, branchRef, and scope.");
  }
  const agentIds = deriveAgentIds({
    base: common.agentIds,
    payload: scope,
  });

  return {
    action: "mp.materialize",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds,
    payload: {
      storedSection: storedSection as unknown as RaxMpMaterializeInput["payload"]["storedSection"],
      checkedSnapshotRef,
      branchRef,
      scope: scope as unknown as RaxMpMaterializeInput["payload"]["scope"],
      sessionId: asString(input.sessionId),
      metadata: asObject(input.metadata),
    },
  };
}

function parsePromoteInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const memory = asMemoryRecord(input.memory);
  const owner = asLineageNode(input.owner);
  const promoter = asLineageNode(input.promoter);
  const nextScopeLevel = asString(input.nextScopeLevel) as MpScopeLevel | undefined;
  const promotedAt = asString(input.promotedAt);
  if (!nextScopeLevel || !promotedAt) {
    throw new Error("mp.promote invocation requires nextScopeLevel and promotedAt.");
  }

  return {
    action: "mp.promote",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      lineageNodes: [owner, promoter],
      memory,
    }),
    payload: {
      memory,
      owner,
      promoter,
      nextScopeLevel,
      promotedAt,
      metadata: asObject(input.metadata),
    },
  };
}

function parseArchiveInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const agentId = asString(input.agentId);
  const memoryId = asString(input.memoryId);
  const archivedAt = asString(input.archivedAt);
  const scopeLevel = asString(input.scopeLevel) as MpScopeLevel | undefined;
  if (!agentId || !memoryId || !archivedAt || !scopeLevel) {
    throw new Error("mp.archive invocation requires agentId, memoryId, scopeLevel, and archivedAt.");
  }

  return {
    action: "mp.archive",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      payload: { agentId },
    }),
    payload: {
      projectId: common.projectId,
      agentId,
      scopeLevel,
      memoryId,
      archivedAt,
      metadata: asObject(input.metadata),
    },
  };
}

function parseSplitInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const tableName = asString(input.tableName);
  const sourceRecord = asMemoryRecord(input.sourceRecord);
  const split = asObject(input.split);
  if (!tableName || !split) {
    throw new Error("mp.split invocation requires tableName and split.");
  }
  return {
    action: "mp.split",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      memory: sourceRecord,
    }),
    payload: {
      tableName,
      sourceRecord,
      split: split as unknown as RaxMpSplitInput["payload"]["split"],
    },
  };
}

function parseMergeInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const tableName = asString(input.tableName);
  const sourceRecordsValue = input.sourceRecords;
  const merge = asObject(input.merge);
  if (!tableName || !Array.isArray(sourceRecordsValue) || sourceRecordsValue.length === 0 || !merge) {
    throw new Error("mp.merge invocation requires tableName, sourceRecords, and merge.");
  }
  const sourceRecords = sourceRecordsValue.map(asMemoryRecord);
  return {
    action: "mp.merge",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      memory: sourceRecords[0],
    }),
    payload: {
      tableName,
      sourceRecords,
      merge: merge as unknown as RaxMpMergeInput["payload"]["merge"],
    },
  };
}

function parseReindexInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const tableName = asString(input.tableName);
  const record = asMemoryRecord(input.record);
  const reindexedAt = asString(input.reindexedAt);
  if (!tableName || !reindexedAt) {
    throw new Error("mp.reindex invocation requires tableName and reindexedAt.");
  }
  return {
    action: "mp.reindex",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      memory: record,
    }),
    payload: {
      tableName,
      record,
      reindexedAt,
      metadata: asObject(input.metadata),
    },
  };
}

function parseCompactInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  const input = plan.input;
  const common = parseCommonConfig(input);
  const tableName = asString(input.tableName);
  const keepMemoryId = asString(input.keepMemoryId);
  const archivedAt = asString(input.archivedAt);
  const recordsValue = input.records;
  if (!tableName || !keepMemoryId || !archivedAt || !Array.isArray(recordsValue) || recordsValue.length === 0) {
    throw new Error("mp.compact invocation requires tableName, keepMemoryId, archivedAt, and records.");
  }
  const records = recordsValue.map(asMemoryRecord);
  return {
    action: "mp.compact",
    projectId: common.projectId,
    rootPath: common.rootPath,
    agentIds: deriveAgentIds({
      base: common.agentIds,
      memory: records[0],
    }),
    payload: {
      tableName,
      keepMemoryId,
      archivedAt,
      records,
    },
  };
}

function parsePreparedMpInput(plan: CapabilityInvocationPlan): PreparedMpExecutionState {
  switch (plan.capabilityKey as RaxMpAdapterCapabilityKey) {
    case "mp.ingest":
      return parseIngestInput(plan);
    case "mp.align":
      return parseAlignInput(plan);
    case "mp.resolve":
      return parseResolveInput(plan);
    case "mp.history.request":
      return parseHistoryInput(plan);
    case "mp.search":
      return parseSearchInput(plan);
    case "mp.materialize":
      return parseMaterializeInput(plan);
    case "mp.promote":
      return parsePromoteInput(plan);
    case "mp.archive":
      return parseArchiveInput(plan);
    case "mp.split":
      return parseSplitInput(plan);
    case "mp.merge":
      return parseMergeInput(plan);
    case "mp.reindex":
      return parseReindexInput(plan);
    case "mp.compact":
      return parseCompactInput(plan);
  }
  throw new Error(`Unsupported MP capability key: ${plan.capabilityKey}.`);
}

function mapStatus(status: "success" | "failed" = "success") {
  return status;
}

export class RaxMpCapabilityAdapter implements CapabilityAdapter {
  readonly id = RAX_MP_ADAPTER_ID;
  readonly runtimeKind = RAX_MP_RUNTIME_KIND;
  readonly #facade: MpFacadeLike;
  readonly #preparedInputs = new Map<string, PreparedMpExecutionState>();

  constructor(facade: MpFacadeLike = rax) {
    this.#facade = facade;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return RAX_MP_ADAPTER_CAPABILITY_KEYS.includes(plan.capabilityKey as RaxMpAdapterCapabilityKey);
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const preparedInput = parsePreparedMpInput(plan);
    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `rax-mp:${plan.capabilityKey}:${lease.leaseId}`,
      metadata: {
        projectId: preparedInput.projectId,
      },
    });
    this.#preparedInputs.set(prepared.preparedId, preparedInput);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const input = this.#preparedInputs.get(prepared.preparedId);
    if (!input) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "rax_mp_prepared_input_missing",
          message: "MP prepared input is missing.",
        },
      });
    }

    try {
      const session = this.#facade.mp.create({
        config: {
          projectId: input.projectId,
          lance: {
            rootPath: input.rootPath,
            liveExecutionPreferred: false,
          },
        },
      });
      await this.#facade.mp.bootstrap({
        session,
        payload: {
          projectId: input.projectId,
          rootPath: input.rootPath,
          agentIds: input.agentIds.length > 0 ? input.agentIds : [session.config.defaultAgentId],
        },
      });

      let output: unknown;
      switch (input.action) {
        case "mp.ingest":
          output = await this.#facade.mp.ingest({
            session,
            payload: input.payload,
          });
          break;
        case "mp.align":
          output = await this.#facade.mp.align({
            session,
            payload: input.payload,
          });
          break;
        case "mp.resolve":
          output = await this.#facade.mp.resolve({
            session,
            payload: input.payload,
          });
          break;
        case "mp.history.request":
          output = await this.#facade.mp.requestHistory({
            session,
            payload: input.payload,
          });
          break;
        case "mp.search":
          output = await this.#facade.mp.search({
            session,
            payload: input.payload,
          });
          break;
        case "mp.materialize":
          output = await this.#facade.mp.materialize({
            session,
            payload: input.payload,
          });
          break;
        case "mp.promote":
          output = await this.#facade.mp.promote({
            session,
            payload: input.payload,
          });
          break;
        case "mp.archive":
          output = await this.#facade.mp.archive({
            session,
            payload: input.payload,
          });
          break;
        case "mp.split":
          output = await this.#facade.mp.split({
            session,
            payload: input.payload,
          });
          break;
        case "mp.merge":
          output = await this.#facade.mp.merge({
            session,
            payload: input.payload,
          });
          break;
        case "mp.reindex":
          output = await this.#facade.mp.reindex({
            session,
            payload: input.payload,
          });
          break;
        case "mp.compact":
          output = await this.#facade.mp.compact({
            session,
            payload: input.payload,
          });
          break;
      }

      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: mapStatus(),
        output,
        metadata: {
          projectId: input.projectId,
          action: input.action,
        },
      });
    } catch (error) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "rax_mp_execution_failed",
          message: error instanceof Error ? error.message : "Unknown MP execution failure.",
          details: error && typeof error === "object" ? error as Record<string, unknown> : undefined,
        },
      });
    }
  }

  async healthCheck() {
    return {
      status: "ready" as const,
      details: {
        runtimeKind: this.runtimeKind,
      },
    };
  }
}

export function createRaxMpCapabilityAdapter(
  facade: MpFacadeLike = rax,
): RaxMpCapabilityAdapter {
  return new RaxMpCapabilityAdapter(facade);
}

export function createRaxMpActivationFactory(
  options: {
    facade?: MpFacadeLike;
  } = {},
): ActivationAdapterFactory {
  return () => createRaxMpCapabilityAdapter(options.facade ?? rax);
}

export function registerRaxMpCapabilityFamily(
  input: RegisterRaxMpCapabilityFamilyInput,
): RegisterRaxMpCapabilityFamilyResult {
  const capabilityKeys = [...(input.capabilityKeys ?? RAX_MP_ADAPTER_CAPABILITY_KEYS)];
  const packages = capabilityKeys.map((capabilityKey) =>
    createRaxMpCapabilityPackage({ capabilityKey }),
  );
  const manifests = packages.map((capabilityPackage) =>
    createCapabilityManifestFromPackage(capabilityPackage),
  );
  const factory = createRaxMpActivationFactory({
    facade: input.facade,
  });
  const activationFactoryRefs = packages.map((capabilityPackage) => {
    const activationRef = capabilityPackage.activationSpec?.adapterFactoryRef;
    if (!activationRef) {
      throw new Error(`Capability package ${capabilityPackage.manifest.capabilityKey} is missing adapterFactoryRef.`);
    }
    return activationRef;
  });

  const bindings = packages.map((capabilityPackage, index) => {
    const activationSpec = capabilityPackage.activationSpec;
    const activationRef = activationFactoryRefs[index]!;
    input.runtime.registerTaActivationFactory(activationRef, factory);

    const adapter = factory({
      capabilityPackage,
      activationSpec,
      bindingPayload: activationSpec?.bindingPayload,
      manifest: manifests[index],
      manifestPayload: activationSpec?.manifestPayload,
    });

    return input.runtime.registerCapabilityAdapter(manifests[index]!, adapter);
  });

  return {
    capabilityKeys,
    activationFactoryRefs,
    manifests,
    packages,
    bindings,
  };
}
