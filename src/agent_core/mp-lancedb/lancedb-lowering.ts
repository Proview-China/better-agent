import type { CmpStoredSection } from "../cmp-types/cmp-section.js";
import {
  createMpMemoryRecord,
  createMpScopeDescriptor,
  isMpScopeLevel,
  isMpSessionMode,
  type MpChunkAncestry,
  type MpLowerStoredSectionInput,
  type MpMemoryRecord,
  type MpScopeDescriptor,
  type MpScopeLevel,
  type MpSessionMode,
} from "../mp-types/index.js";

export interface MpLoweringPolicy {
  defaultSessionId?: string;
  semanticGroupPrefix?: string;
  tagPrefix?: string;
}

export interface MpLoweredChunkDraft {
  memoryId: string;
  semanticGroupId: string;
  bodyRef: string;
  tags: string[];
  ancestry?: MpChunkAncestry;
  metadata?: Record<string, unknown>;
}

export interface CreateMpMemoryRecordFromStoredSectionInput {
  storedSection: CmpStoredSection;
  checkedSnapshotRef: string;
  branchRef: string;
  scope?: MpScopeDescriptor;
  sessionId?: string;
  policy?: MpLoweringPolicy;
  memoryId?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = uniqueStrings(value.filter((item): item is string => typeof item === "string"));
  return normalized.length > 0 ? normalized : undefined;
}

function readMetadataScopeLevel(storedSection: CmpStoredSection): MpScopeLevel | undefined {
  const raw = storedSection.metadata?.mpScopeLevel;
  return typeof raw === "string" && isMpScopeLevel(raw) ? raw : undefined;
}

function readMetadataSessionMode(storedSection: CmpStoredSection): MpSessionMode | undefined {
  const raw = storedSection.metadata?.mpSessionMode;
  return typeof raw === "string" && isMpSessionMode(raw) ? raw : undefined;
}

function createLineagePath(storedSection: CmpStoredSection): string[] {
  const lineagePath = normalizeOptionalStringArray(storedSection.metadata?.lineagePath);
  return lineagePath ?? [storedSection.agentId];
}

function createMemoryId(storedSection: CmpStoredSection): string {
  return `memory:${storedSection.id}`;
}

function inferMpMemoryKind(storedSection: CmpStoredSection): MpMemoryRecord["memoryKind"] {
  switch (storedSection.metadata?.sectionKind) {
    case "instruction":
      return "directive";
    case "summary":
      return "summary";
    case "status_snapshot":
      return "status_snapshot";
    case "runtime_context":
      return "episodic";
    default:
      return "semantic";
  }
}

export function inferMpScopeFromStoredSection(storedSection: CmpStoredSection): MpScopeLevel {
  const metadataScope = readMetadataScopeLevel(storedSection);
  if (metadataScope) {
    return metadataScope;
  }

  if (storedSection.metadata?.promoteToGlobal === true) {
    return "global";
  }

  if (
    storedSection.state === "promoted"
    || storedSection.state === "dispatched"
    || storedSection.visibility === "parent"
    || storedSection.visibility === "children"
    || storedSection.visibility === "lineage"
  ) {
    return "project";
  }

  return "agent_isolated";
}

export function inferMpSessionModeFromStoredSection(storedSection: CmpStoredSection): MpSessionMode {
  const metadataMode = readMetadataSessionMode(storedSection);
  if (metadataMode) {
    return metadataMode;
  }

  const scopeLevel = inferMpScopeFromStoredSection(storedSection);
  if (scopeLevel === "global" || scopeLevel === "project") {
    return "shared";
  }
  if (storedSection.visibility === "peer" || storedSection.visibility === "children") {
    return "bridged";
  }

  return "isolated";
}

export function deriveMpChunkTags(
  storedSection: CmpStoredSection,
  policy: MpLoweringPolicy = {},
): string[] {
  const prefix = policy.tagPrefix?.trim() || "mp";
  return uniqueStrings([
    `${prefix}:plane:${storedSection.plane}`,
    `${prefix}:state:${storedSection.state}`,
    `${prefix}:visibility:${storedSection.visibility}`,
    typeof storedSection.metadata?.sectionKind === "string"
      ? `${prefix}:section_kind:${storedSection.metadata.sectionKind}`
      : "",
    typeof storedSection.metadata?.sectionSource === "string"
      ? `${prefix}:section_source:${storedSection.metadata.sectionSource}`
      : "",
    typeof storedSection.metadata?.sectionFidelity === "string"
      ? `${prefix}:section_fidelity:${storedSection.metadata.sectionFidelity}`
      : "",
    ...(normalizeOptionalStringArray(storedSection.metadata?.tags) ?? []),
  ]);
}

export function deriveMpSemanticGroupId(
  storedSection: CmpStoredSection,
  policy: MpLoweringPolicy = {},
): string {
  const explicit = normalizeOptionalString(storedSection.metadata?.semanticGroupId);
  if (explicit) {
    return explicit;
  }

  const prefix = policy.semanticGroupPrefix?.trim() || "semantic";
  return `${prefix}:${storedSection.projectId}:${storedSection.agentId}:${storedSection.sourceSectionId}`;
}

export function createMpChunkBodyRef(storedSection: CmpStoredSection): string {
  const explicit = normalizeOptionalString(storedSection.metadata?.bodyRef);
  return explicit ?? `stored:${storedSection.plane}:${storedSection.id}`;
}

export function deriveMpChunkAncestry(
  storedSection: CmpStoredSection,
): MpChunkAncestry | undefined {
  const ancestry: MpChunkAncestry = {
    parentMemoryId: normalizeOptionalString(storedSection.metadata?.parentMemoryId),
    derivedFromIds: normalizeOptionalStringArray(storedSection.metadata?.derivedFromIds)
      ?? normalizeOptionalStringArray(storedSection.metadata?.derivedFromSectionIds),
    splitFromIds: normalizeOptionalStringArray(storedSection.metadata?.splitFromIds)
      ?? normalizeOptionalStringArray(storedSection.metadata?.splitFromSectionIds),
    mergedFromIds: normalizeOptionalStringArray(storedSection.metadata?.mergedFromIds)
      ?? normalizeOptionalStringArray(storedSection.metadata?.mergedFromSectionIds),
  };

  return ancestry.parentMemoryId
    || ancestry.derivedFromIds?.length
    || ancestry.splitFromIds?.length
    || ancestry.mergedFromIds?.length
    ? ancestry
    : undefined;
}

export function createMpMemoryRecordFromStoredSection(
  input: CreateMpMemoryRecordFromStoredSectionInput,
): MpMemoryRecord {
  const scope = input.scope ?? createMpScopeDescriptor({
    projectId: input.storedSection.projectId,
    agentId: input.storedSection.agentId,
    sessionId: input.sessionId ?? input.policy?.defaultSessionId,
    scopeLevel: inferMpScopeFromStoredSection(input.storedSection),
    sessionMode: inferMpSessionModeFromStoredSection(input.storedSection),
    lineagePath: createLineagePath(input.storedSection),
  });

  return createMpMemoryRecord({
    memoryId: input.memoryId ?? createMemoryId(input.storedSection),
    projectId: input.storedSection.projectId,
    agentId: input.storedSection.agentId,
    sessionId: input.sessionId ?? scope.sessionId,
    scopeLevel: scope.scopeLevel,
    sessionMode: scope.sessionMode,
    visibilityState: scope.visibilityState,
    promotionState: scope.promotionState,
    lineagePath: scope.lineagePath ?? createLineagePath(input.storedSection),
    branchRef: assertNonEmpty(input.branchRef, "MP lowering branchRef"),
    sourceSectionId: input.storedSection.sourceSectionId,
    sourceStoredSectionId: input.storedSection.id,
    sourceCommitRef: assertNonEmpty(input.checkedSnapshotRef, "MP lowering checkedSnapshotRef"),
    semanticGroupId: deriveMpSemanticGroupId(input.storedSection, input.policy),
    bodyRef: createMpChunkBodyRef(input.storedSection),
    payloadRefs: [
      input.storedSection.storageRef,
      assertNonEmpty(input.checkedSnapshotRef, "MP lowering checkedSnapshotRef"),
    ],
    sourceRefs: [
      input.storedSection.storageRef,
      assertNonEmpty(input.checkedSnapshotRef, "MP lowering checkedSnapshotRef"),
    ],
    tags: deriveMpChunkTags(input.storedSection, input.policy),
    memoryKind: inferMpMemoryKind(input.storedSection),
    observedAt: input.storedSection.persistedAt,
    capturedAt: input.createdAt ?? input.storedSection.persistedAt,
    freshness: {
      status: "fresh",
      reason: "materialized from stored section",
    },
    confidence: input.storedSection.metadata?.sectionFidelity === "checked" ? "high" : "medium",
    alignment: {
      alignmentStatus: "unreviewed",
    },
    ancestry: deriveMpChunkAncestry(input.storedSection),
    createdAt: input.createdAt ?? input.storedSection.persistedAt,
    updatedAt: input.updatedAt ?? input.storedSection.updatedAt,
    metadata: {
      storedPlane: input.storedSection.plane,
      storedState: input.storedSection.state,
      storedVisibility: input.storedSection.visibility,
      checkedSnapshotRef: input.checkedSnapshotRef,
      ...(input.storedSection.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function createMpMemoryRecordsFromStoredSection(
  input: MpLowerStoredSectionInput,
): MpMemoryRecord[] {
  return [
    createMpMemoryRecordFromStoredSection({
      storedSection: input.storedSection,
      checkedSnapshotRef: input.checkedSnapshotRef,
      branchRef: input.branchRef,
      scope: input.scope,
      sessionId: input.sessionId,
      metadata: input.metadata,
    }),
  ];
}
