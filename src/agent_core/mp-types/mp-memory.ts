import {
  createMpScopeDescriptor,
  isMpPromotionState,
  isMpScopeLevel,
  isMpSessionMode,
  isMpVisibilityState,
  type MpPromotionState,
  type MpScopeDescriptor,
  type MpScopeLevel,
  type MpSessionMode,
  type MpVisibilityState,
} from "./mp-scope.js";

export interface MpChunkAncestry {
  parentMemoryId?: string;
  derivedFromIds?: string[];
  splitFromIds?: string[];
  mergedFromIds?: string[];
}

export interface MpEmbeddingPayload {
  provider?: string;
  model?: string;
  dimensions?: number;
  values?: number[];
  vectorRef?: string;
  metadata?: Record<string, unknown>;
}

export interface MpMemoryRecord {
  memoryId: string;
  projectId: string;
  agentId: string;
  sessionId?: string;
  scopeLevel: MpScopeLevel;
  sessionMode: MpSessionMode;
  visibilityState: MpVisibilityState;
  promotionState: MpPromotionState;
  lineagePath: string[];
  branchRef?: string;
  sourceSectionId?: string;
  sourceStoredSectionId?: string;
  sourceCommitRef?: string;
  semanticGroupId?: string;
  bodyRef?: string;
  payloadRefs: string[];
  tags: string[];
  embedding?: MpEmbeddingPayload;
  ancestry?: MpChunkAncestry;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMpMemoryRecordInput extends Omit<MpMemoryRecord, "lineagePath" | "payloadRefs" | "tags"> {
  lineagePath: string[];
  payloadRefs?: string[];
  tags?: string[];
}

export interface MpSemanticChunk extends MpMemoryRecord {
  chunkIndex: number;
  chunkCount: number;
  chunkRole?: "source" | "split" | "merge";
}

export interface MpSemanticBundle {
  bundleId: string;
  projectId: string;
  agentId: string;
  scope: MpScopeDescriptor;
  memberMemoryIds: string[];
  semanticGroupId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(values: string[] | undefined, label: string, minimum = 0): string[] {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  if (normalized.length < minimum) {
    throw new Error(`${label} requires at least ${minimum} non-empty string(s).`);
  }
  return normalized;
}

export function createMpChunkAncestry(input: MpChunkAncestry = {}): MpChunkAncestry | undefined {
  const ancestry: MpChunkAncestry = {
    parentMemoryId: normalizeOptionalString(input.parentMemoryId),
    derivedFromIds: normalizeStringArray(input.derivedFromIds, "MP chunk ancestry derivedFromIds"),
    splitFromIds: normalizeStringArray(input.splitFromIds, "MP chunk ancestry splitFromIds"),
    mergedFromIds: normalizeStringArray(input.mergedFromIds, "MP chunk ancestry mergedFromIds"),
  };

  return ancestry.parentMemoryId
    || ancestry.derivedFromIds?.length
    || ancestry.splitFromIds?.length
    || ancestry.mergedFromIds?.length
    ? ancestry
    : undefined;
}

export function validateMpEmbeddingPayload(payload: MpEmbeddingPayload): void {
  if (payload.provider !== undefined) {
    assertNonEmpty(payload.provider, "MP embedding provider");
  }
  if (payload.model !== undefined) {
    assertNonEmpty(payload.model, "MP embedding model");
  }
  if (payload.vectorRef !== undefined) {
    assertNonEmpty(payload.vectorRef, "MP embedding vectorRef");
  }
  if (payload.dimensions !== undefined && (!Number.isInteger(payload.dimensions) || payload.dimensions <= 0)) {
    throw new Error("MP embedding dimensions must be an integer greater than 0.");
  }
  if (payload.values !== undefined) {
    if (payload.values.length === 0) {
      throw new Error("MP embedding values must not be empty when provided.");
    }
    if (payload.values.some((value) => !Number.isFinite(value))) {
      throw new Error("MP embedding values must be finite numbers.");
    }
  }
}

export function validateMpMemoryRecord(record: MpMemoryRecord): void {
  assertNonEmpty(record.memoryId, "MP memory memoryId");
  assertNonEmpty(record.projectId, "MP memory projectId");
  assertNonEmpty(record.agentId, "MP memory agentId");
  if (record.sessionId !== undefined) {
    assertNonEmpty(record.sessionId, "MP memory sessionId");
  }
  if (!isMpScopeLevel(record.scopeLevel)) {
    throw new Error(`Unsupported MP memory scopeLevel: ${record.scopeLevel}.`);
  }
  if (!isMpSessionMode(record.sessionMode)) {
    throw new Error(`Unsupported MP memory sessionMode: ${record.sessionMode}.`);
  }
  if (!isMpVisibilityState(record.visibilityState)) {
    throw new Error(`Unsupported MP memory visibilityState: ${record.visibilityState}.`);
  }
  if (!isMpPromotionState(record.promotionState)) {
    throw new Error(`Unsupported MP memory promotionState: ${record.promotionState}.`);
  }
  normalizeStringArray(record.lineagePath, "MP memory lineagePath", 1);
  normalizeStringArray(record.payloadRefs, "MP memory payloadRefs", 1);
  if (record.branchRef !== undefined) {
    assertNonEmpty(record.branchRef, "MP memory branchRef");
  }
  if (record.sourceSectionId !== undefined) {
    assertNonEmpty(record.sourceSectionId, "MP memory sourceSectionId");
  }
  if (record.sourceStoredSectionId !== undefined) {
    assertNonEmpty(record.sourceStoredSectionId, "MP memory sourceStoredSectionId");
  }
  if (record.sourceCommitRef !== undefined) {
    assertNonEmpty(record.sourceCommitRef, "MP memory sourceCommitRef");
  }
  if (record.semanticGroupId !== undefined) {
    assertNonEmpty(record.semanticGroupId, "MP memory semanticGroupId");
  }
  if (record.bodyRef !== undefined) {
    assertNonEmpty(record.bodyRef, "MP memory bodyRef");
  }
  if (record.embedding) {
    validateMpEmbeddingPayload(record.embedding);
  }
  createMpScopeDescriptor({
    projectId: record.projectId,
    agentId: record.agentId,
    sessionId: record.sessionId,
    scopeLevel: record.scopeLevel,
    sessionMode: record.sessionMode,
    visibilityState: record.visibilityState,
    promotionState: record.promotionState,
    lineagePath: record.lineagePath,
  });
}

export function createMpMemoryRecord(input: CreateMpMemoryRecordInput): MpMemoryRecord {
  const record: MpMemoryRecord = {
    memoryId: assertNonEmpty(input.memoryId, "MP memory memoryId"),
    projectId: assertNonEmpty(input.projectId, "MP memory projectId"),
    agentId: assertNonEmpty(input.agentId, "MP memory agentId"),
    sessionId: normalizeOptionalString(input.sessionId),
    scopeLevel: input.scopeLevel,
    sessionMode: input.sessionMode,
    visibilityState: input.visibilityState,
    promotionState: input.promotionState,
    lineagePath: normalizeStringArray(input.lineagePath, "MP memory lineagePath", 1),
    branchRef: normalizeOptionalString(input.branchRef),
    sourceSectionId: normalizeOptionalString(input.sourceSectionId),
    sourceStoredSectionId: normalizeOptionalString(input.sourceStoredSectionId),
    sourceCommitRef: normalizeOptionalString(input.sourceCommitRef),
    semanticGroupId: normalizeOptionalString(input.semanticGroupId),
    bodyRef: normalizeOptionalString(input.bodyRef),
    payloadRefs: normalizeStringArray(input.payloadRefs, "MP memory payloadRefs", 1),
    tags: normalizeStringArray(input.tags, "MP memory tags"),
    embedding: input.embedding,
    ancestry: createMpChunkAncestry(input.ancestry),
    createdAt: assertNonEmpty(input.createdAt, "MP memory createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "MP memory updatedAt"),
    metadata: input.metadata,
  };

  validateMpMemoryRecord(record);
  return record;
}

export function validateMpSemanticChunk(chunk: MpSemanticChunk): void {
  validateMpMemoryRecord(chunk);
  if (!Number.isInteger(chunk.chunkIndex) || chunk.chunkIndex < 0) {
    throw new Error("MP semantic chunk chunkIndex must be an integer >= 0.");
  }
  if (!Number.isInteger(chunk.chunkCount) || chunk.chunkCount <= 0) {
    throw new Error("MP semantic chunk chunkCount must be an integer > 0.");
  }
  if (chunk.chunkIndex >= chunk.chunkCount) {
    throw new Error("MP semantic chunk chunkIndex must be smaller than chunkCount.");
  }
}

export function createMpSemanticChunk(input: MpSemanticChunk): MpSemanticChunk {
  const chunk: MpSemanticChunk = {
    ...createMpMemoryRecord(input),
    chunkIndex: input.chunkIndex,
    chunkCount: input.chunkCount,
    chunkRole: input.chunkRole,
  };

  validateMpSemanticChunk(chunk);
  return chunk;
}

export function validateMpSemanticBundle(bundle: MpSemanticBundle): void {
  assertNonEmpty(bundle.bundleId, "MP semantic bundle bundleId");
  assertNonEmpty(bundle.projectId, "MP semantic bundle projectId");
  assertNonEmpty(bundle.agentId, "MP semantic bundle agentId");
  createMpScopeDescriptor(bundle.scope);
  normalizeStringArray(bundle.memberMemoryIds, "MP semantic bundle memberMemoryIds", 1);
  assertNonEmpty(bundle.semanticGroupId, "MP semantic bundle semanticGroupId");
  assertNonEmpty(bundle.createdAt, "MP semantic bundle createdAt");
  assertNonEmpty(bundle.updatedAt, "MP semantic bundle updatedAt");
}

export function createMpSemanticBundle(input: MpSemanticBundle): MpSemanticBundle {
  const bundle: MpSemanticBundle = {
    bundleId: assertNonEmpty(input.bundleId, "MP semantic bundle bundleId"),
    projectId: assertNonEmpty(input.projectId, "MP semantic bundle projectId"),
    agentId: assertNonEmpty(input.agentId, "MP semantic bundle agentId"),
    scope: createMpScopeDescriptor(input.scope),
    memberMemoryIds: normalizeStringArray(
      input.memberMemoryIds,
      "MP semantic bundle memberMemoryIds",
      1,
    ),
    semanticGroupId: assertNonEmpty(input.semanticGroupId, "MP semantic bundle semanticGroupId"),
    createdAt: assertNonEmpty(input.createdAt, "MP semantic bundle createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "MP semantic bundle updatedAt"),
    metadata: input.metadata,
  };

  validateMpSemanticBundle(bundle);
  return bundle;
}
