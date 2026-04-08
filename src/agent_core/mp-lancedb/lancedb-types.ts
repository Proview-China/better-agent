import type { MpMemoryRecord, MpScopeLevel } from "../mp-types/index.js";

export const MP_LANCE_TABLE_KINDS = [
  "global_memories",
  "project_memories",
  "agent_memories",
] as const;
export type MpLanceTableKind = (typeof MP_LANCE_TABLE_KINDS)[number];

export const MP_LANCE_BOOTSTRAP_RECEIPT_STATUSES = [
  "bootstrapped",
  "partial",
] as const;
export type MpLanceBootstrapReceiptStatus =
  (typeof MP_LANCE_BOOTSTRAP_RECEIPT_STATUSES)[number];

export interface MpLanceTableDescriptor {
  kind: MpLanceTableKind;
  scopeLevel: MpScopeLevel;
  tableName: string;
  storagePath: string;
  ownership: "global" | "project" | "agent_local";
  projectId?: string;
  agentId?: string;
  schemaVersion: number;
  metadata?: Record<string, unknown>;
}

export interface MpLanceProjectLayout {
  projectId: string;
  rootPath: string;
  globalTable: MpLanceTableDescriptor;
  projectTable: MpLanceTableDescriptor;
  agentTables: MpLanceTableDescriptor[];
  metadata?: Record<string, unknown>;
}

export interface MpLanceBootstrapPlan {
  projectId: string;
  rootPath: string;
  agentIds: string[];
  schemaVersion: number;
  layout: MpLanceProjectLayout;
  tableDescriptors: MpLanceTableDescriptor[];
  metadata?: Record<string, unknown>;
}

export interface MpLanceBootstrapReceipt {
  projectId: string;
  schemaVersion: number;
  status: MpLanceBootstrapReceiptStatus;
  expectedTableCount: number;
  presentTableCount: number;
  createdTables: string[];
  metadata?: Record<string, unknown>;
}

export interface MpLanceSearchRequest {
  projectId: string;
  queryText: string;
  scopeLevels?: MpScopeLevel[];
  limit?: number;
  agentId?: string;
  sessionId?: string;
  tableNames?: string[];
  metadata?: Record<string, unknown>;
}

export interface MpLanceSearchHit {
  memoryId: string;
  tableName: string;
  score: number;
  record: MpMemoryRecord;
  metadata?: Record<string, unknown>;
}

export interface MpLanceSearchResult {
  projectId: string;
  queryText: string;
  hits: MpLanceSearchHit[];
  metadata?: Record<string, unknown>;
}

export interface MpLanceUpsertMemoriesInput {
  tableName: string;
  records: readonly MpMemoryRecord[];
}

export interface MpLanceGetMemoryByIdInput {
  tableName: string;
  memoryId: string;
}

export interface MpLanceArchiveMemoryInput {
  tableName: string;
  memoryId: string;
  archivedAt: string;
  metadata?: Record<string, unknown>;
}

export interface MpLanceUpdateMemoryInput {
  tableName: string;
  record: MpMemoryRecord;
}

export interface MpLanceDbAdapter {
  bootstrap(plan: MpLanceBootstrapPlan): Promise<MpLanceBootstrapReceipt> | MpLanceBootstrapReceipt;
  listProjectTables(projectId: string): Promise<string[]> | string[];
  upsertMemories(input: MpLanceUpsertMemoriesInput): Promise<void> | void;
  getMemoryById(input: MpLanceGetMemoryByIdInput): Promise<MpMemoryRecord | undefined> | MpMemoryRecord | undefined;
  archiveMemory(input: MpLanceArchiveMemoryInput): Promise<MpMemoryRecord | undefined> | MpMemoryRecord | undefined;
  updateMemory(input: MpLanceUpdateMemoryInput): Promise<MpMemoryRecord> | MpMemoryRecord;
  searchMemories(input: MpLanceSearchRequest): Promise<MpLanceSearchResult> | MpLanceSearchResult;
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

export function isMpLanceTableKind(value: string): value is MpLanceTableKind {
  return MP_LANCE_TABLE_KINDS.includes(value as MpLanceTableKind);
}

export function isMpLanceBootstrapReceiptStatus(
  value: string,
): value is MpLanceBootstrapReceiptStatus {
  return MP_LANCE_BOOTSTRAP_RECEIPT_STATUSES.includes(value as MpLanceBootstrapReceiptStatus);
}

export function validateMpLanceTableDescriptor(descriptor: MpLanceTableDescriptor): void {
  if (!isMpLanceTableKind(descriptor.kind)) {
    throw new Error(`Unsupported MP Lance table kind: ${descriptor.kind}.`);
  }
  assertNonEmpty(descriptor.tableName, "MP Lance tableName");
  assertNonEmpty(descriptor.storagePath, "MP Lance storagePath");
  if (!["global", "project", "agent_local"].includes(descriptor.ownership)) {
    throw new Error(`Unsupported MP Lance ownership: ${descriptor.ownership}.`);
  }
  if (!Number.isInteger(descriptor.schemaVersion) || descriptor.schemaVersion <= 0) {
    throw new Error("MP Lance schemaVersion must be an integer greater than 0.");
  }
  if (descriptor.projectId !== undefined) {
    assertNonEmpty(descriptor.projectId, "MP Lance projectId");
  }
  if (descriptor.agentId !== undefined) {
    assertNonEmpty(descriptor.agentId, "MP Lance agentId");
  }
}

export function createMpLanceTableDescriptor(
  input: MpLanceTableDescriptor,
): MpLanceTableDescriptor {
  const descriptor: MpLanceTableDescriptor = {
    kind: input.kind,
    scopeLevel: input.scopeLevel,
    tableName: assertNonEmpty(input.tableName, "MP Lance tableName"),
    storagePath: assertNonEmpty(input.storagePath, "MP Lance storagePath"),
    ownership: input.ownership,
    projectId: input.projectId?.trim() || undefined,
    agentId: input.agentId?.trim() || undefined,
    schemaVersion: input.schemaVersion,
    metadata: input.metadata,
  };
  validateMpLanceTableDescriptor(descriptor);
  return descriptor;
}

export function validateMpLanceProjectLayout(layout: MpLanceProjectLayout): void {
  assertNonEmpty(layout.projectId, "MP Lance layout projectId");
  assertNonEmpty(layout.rootPath, "MP Lance layout rootPath");
  validateMpLanceTableDescriptor(layout.globalTable);
  validateMpLanceTableDescriptor(layout.projectTable);
  for (const table of layout.agentTables) {
    validateMpLanceTableDescriptor(table);
  }
}

export function createMpLanceProjectLayout(
  input: MpLanceProjectLayout,
): MpLanceProjectLayout {
  const layout: MpLanceProjectLayout = {
    projectId: assertNonEmpty(input.projectId, "MP Lance layout projectId"),
    rootPath: assertNonEmpty(input.rootPath, "MP Lance layout rootPath"),
    globalTable: createMpLanceTableDescriptor(input.globalTable),
    projectTable: createMpLanceTableDescriptor(input.projectTable),
    agentTables: input.agentTables.map(createMpLanceTableDescriptor),
    metadata: input.metadata,
  };
  validateMpLanceProjectLayout(layout);
  return layout;
}

export function validateMpLanceBootstrapPlan(plan: MpLanceBootstrapPlan): void {
  assertNonEmpty(plan.projectId, "MP Lance bootstrap plan projectId");
  assertNonEmpty(plan.rootPath, "MP Lance bootstrap plan rootPath");
  normalizeStringArray(plan.agentIds, "MP Lance bootstrap plan agentIds");
  if (!Number.isInteger(plan.schemaVersion) || plan.schemaVersion <= 0) {
    throw new Error("MP Lance bootstrap plan schemaVersion must be an integer greater than 0.");
  }
  validateMpLanceProjectLayout(plan.layout);
  if (plan.tableDescriptors.length < 2) {
    throw new Error("MP Lance bootstrap plan requires at least global and project tables.");
  }
  for (const descriptor of plan.tableDescriptors) {
    validateMpLanceTableDescriptor(descriptor);
  }
}

export function validateMpLanceBootstrapReceipt(receipt: MpLanceBootstrapReceipt): void {
  assertNonEmpty(receipt.projectId, "MP Lance bootstrap receipt projectId");
  if (!isMpLanceBootstrapReceiptStatus(receipt.status)) {
    throw new Error(`Unsupported MP Lance bootstrap receipt status: ${receipt.status}.`);
  }
  if (!Number.isInteger(receipt.schemaVersion) || receipt.schemaVersion <= 0) {
    throw new Error("MP Lance bootstrap receipt schemaVersion must be an integer greater than 0.");
  }
  if (!Number.isInteger(receipt.expectedTableCount) || receipt.expectedTableCount < 1) {
    throw new Error("MP Lance bootstrap receipt expectedTableCount must be >= 1.");
  }
  if (!Number.isInteger(receipt.presentTableCount) || receipt.presentTableCount < 0) {
    throw new Error("MP Lance bootstrap receipt presentTableCount must be >= 0.");
  }
  normalizeStringArray(receipt.createdTables, "MP Lance bootstrap receipt createdTables");
}
