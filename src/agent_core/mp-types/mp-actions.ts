import type { CmpStoredSection } from "../cmp-types/cmp-section.js";
import {
  createMpScopeDescriptor,
  isMpScopeLevel,
  type MpScopeDescriptor,
  type MpScopeLevel,
} from "./mp-scope.js";

export interface MpSplitChunkInput {
  memoryId: string;
  sourceAgentId: string;
  targetChunkCount: number;
  splitReason: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpSplitChunkResult {
  sourceMemoryId: string;
  derivedMemoryIds: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpMergeChunksInput {
  sourceMemoryIds: string[];
  mergedMemoryId: string;
  targetAgentId: string;
  mergeReason: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpMergeChunksResult {
  mergedMemoryId: string;
  sourceMemoryIds: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpPromoteMemoryInput {
  memoryId: string;
  promoterAgentId: string;
  fromScopeLevel: MpScopeLevel;
  toScopeLevel: MpScopeLevel;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpPromoteMemoryResult {
  memoryId: string;
  fromScopeLevel: MpScopeLevel;
  toScopeLevel: MpScopeLevel;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpBridgeSessionInput {
  memoryId: string;
  sourceSessionId: string;
  targetSessionId: string;
  bridgeAgentId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpBridgeSessionResult {
  memoryId: string;
  sourceSessionId: string;
  targetSessionId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpLowerStoredSectionInput {
  storedSection: CmpStoredSection;
  checkedSnapshotRef: string;
  branchRef: string;
  scope: MpScopeDescriptor;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface MpLowerStoredSectionResult {
  sourceStoredSectionId: string;
  memoryIds: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeStringArray(values: string[], label: string, minimum = 1): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalized.length < minimum) {
    throw new Error(`${label} requires at least ${minimum} non-empty string(s).`);
  }
  return normalized;
}

export function validateMpSplitChunkInput(input: MpSplitChunkInput): void {
  assertNonEmpty(input.memoryId, "MP split memoryId");
  assertNonEmpty(input.sourceAgentId, "MP split sourceAgentId");
  assertNonEmpty(input.splitReason, "MP split splitReason");
  assertNonEmpty(input.createdAt, "MP split createdAt");
  if (!Number.isInteger(input.targetChunkCount) || input.targetChunkCount < 2) {
    throw new Error("MP split targetChunkCount must be an integer >= 2.");
  }
}

export function createMpSplitChunkInput(input: MpSplitChunkInput): MpSplitChunkInput {
  const normalized: MpSplitChunkInput = {
    memoryId: assertNonEmpty(input.memoryId, "MP split memoryId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "MP split sourceAgentId"),
    targetChunkCount: input.targetChunkCount,
    splitReason: assertNonEmpty(input.splitReason, "MP split splitReason"),
    createdAt: assertNonEmpty(input.createdAt, "MP split createdAt"),
    metadata: input.metadata,
  };
  validateMpSplitChunkInput(normalized);
  return normalized;
}

export function validateMpMergeChunksInput(input: MpMergeChunksInput): void {
  normalizeStringArray(input.sourceMemoryIds, "MP merge sourceMemoryIds", 2);
  assertNonEmpty(input.mergedMemoryId, "MP merge mergedMemoryId");
  assertNonEmpty(input.targetAgentId, "MP merge targetAgentId");
  assertNonEmpty(input.mergeReason, "MP merge mergeReason");
  assertNonEmpty(input.createdAt, "MP merge createdAt");
}

export function createMpMergeChunksInput(input: MpMergeChunksInput): MpMergeChunksInput {
  const normalized: MpMergeChunksInput = {
    sourceMemoryIds: normalizeStringArray(input.sourceMemoryIds, "MP merge sourceMemoryIds", 2),
    mergedMemoryId: assertNonEmpty(input.mergedMemoryId, "MP merge mergedMemoryId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "MP merge targetAgentId"),
    mergeReason: assertNonEmpty(input.mergeReason, "MP merge mergeReason"),
    createdAt: assertNonEmpty(input.createdAt, "MP merge createdAt"),
    metadata: input.metadata,
  };
  validateMpMergeChunksInput(normalized);
  return normalized;
}

export function validateMpPromoteMemoryInput(input: MpPromoteMemoryInput): void {
  assertNonEmpty(input.memoryId, "MP promote memoryId");
  assertNonEmpty(input.promoterAgentId, "MP promote promoterAgentId");
  assertNonEmpty(input.createdAt, "MP promote createdAt");
  if (!isMpScopeLevel(input.fromScopeLevel)) {
    throw new Error(`Unsupported MP promote fromScopeLevel: ${input.fromScopeLevel}.`);
  }
  if (!isMpScopeLevel(input.toScopeLevel)) {
    throw new Error(`Unsupported MP promote toScopeLevel: ${input.toScopeLevel}.`);
  }
  if (input.fromScopeLevel === input.toScopeLevel) {
    throw new Error("MP promote requires different fromScopeLevel and toScopeLevel.");
  }
}

export function createMpPromoteMemoryInput(input: MpPromoteMemoryInput): MpPromoteMemoryInput {
  const normalized: MpPromoteMemoryInput = {
    memoryId: assertNonEmpty(input.memoryId, "MP promote memoryId"),
    promoterAgentId: assertNonEmpty(input.promoterAgentId, "MP promote promoterAgentId"),
    fromScopeLevel: input.fromScopeLevel,
    toScopeLevel: input.toScopeLevel,
    createdAt: assertNonEmpty(input.createdAt, "MP promote createdAt"),
    metadata: input.metadata,
  };
  validateMpPromoteMemoryInput(normalized);
  return normalized;
}

export function validateMpBridgeSessionInput(input: MpBridgeSessionInput): void {
  assertNonEmpty(input.memoryId, "MP bridge memoryId");
  assertNonEmpty(input.sourceSessionId, "MP bridge sourceSessionId");
  assertNonEmpty(input.targetSessionId, "MP bridge targetSessionId");
  assertNonEmpty(input.bridgeAgentId, "MP bridge bridgeAgentId");
  assertNonEmpty(input.createdAt, "MP bridge createdAt");
  if (input.sourceSessionId.trim() === input.targetSessionId.trim()) {
    throw new Error("MP bridge requires different sourceSessionId and targetSessionId.");
  }
}

export function createMpBridgeSessionInput(input: MpBridgeSessionInput): MpBridgeSessionInput {
  const normalized: MpBridgeSessionInput = {
    memoryId: assertNonEmpty(input.memoryId, "MP bridge memoryId"),
    sourceSessionId: assertNonEmpty(input.sourceSessionId, "MP bridge sourceSessionId"),
    targetSessionId: assertNonEmpty(input.targetSessionId, "MP bridge targetSessionId"),
    bridgeAgentId: assertNonEmpty(input.bridgeAgentId, "MP bridge bridgeAgentId"),
    createdAt: assertNonEmpty(input.createdAt, "MP bridge createdAt"),
    metadata: input.metadata,
  };
  validateMpBridgeSessionInput(normalized);
  return normalized;
}

export function validateMpLowerStoredSectionInput(input: MpLowerStoredSectionInput): void {
  if (!input.storedSection) {
    throw new Error("MP lower storedSection is required.");
  }
  assertNonEmpty(input.checkedSnapshotRef, "MP lower checkedSnapshotRef");
  assertNonEmpty(input.branchRef, "MP lower branchRef");
  createMpScopeDescriptor(input.scope);
  if (input.sessionId !== undefined) {
    assertNonEmpty(input.sessionId, "MP lower sessionId");
  }
}

export function createMpLowerStoredSectionInput(
  input: MpLowerStoredSectionInput,
): MpLowerStoredSectionInput {
  const normalized: MpLowerStoredSectionInput = {
    storedSection: input.storedSection,
    checkedSnapshotRef: assertNonEmpty(input.checkedSnapshotRef, "MP lower checkedSnapshotRef"),
    branchRef: assertNonEmpty(input.branchRef, "MP lower branchRef"),
    scope: createMpScopeDescriptor(input.scope),
    sessionId: input.sessionId?.trim() || undefined,
    metadata: input.metadata,
  };
  validateMpLowerStoredSectionInput(normalized);
  return normalized;
}
