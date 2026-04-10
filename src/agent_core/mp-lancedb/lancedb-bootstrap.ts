import {
  createMpLanceProjectLayout as createValidatedMpLanceProjectLayout,
  createMpLanceTableDescriptor,
  validateMpLanceBootstrapPlan,
  type MpLanceBootstrapPlan,
  type MpLanceBootstrapReceipt,
  type MpLanceBootstrapReceiptStatus,
  type MpLanceProjectLayout,
  type MpLanceTableDescriptor,
} from "./lancedb-types.js";

export const MP_LANCE_SCHEMA_VERSION = 1;

export interface CreateMpLanceTableNamesInput {
  projectId: string;
  agentId?: string;
}

export interface MpLanceTableNames {
  globalMemories: string;
  projectMemories: string;
  agentMemories?: string;
}

export interface CreateMpLanceBootstrapPlanInput {
  projectId: string;
  agentIds: readonly string[];
  rootPath: string;
  schemaVersion?: number;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeAgentIds(agentIds: readonly string[]): string[] {
  const normalized = [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new Error("MP Lance bootstrap plan requires at least one agentId.");
  }
  return normalized;
}

function toStoragePath(rootPath: string, tableName: string): string {
  return `${rootPath.replace(/\/+$/u, "")}/${tableName}.lance`;
}

export function createMpLanceTableNames(input: CreateMpLanceTableNamesInput): MpLanceTableNames {
  const projectSegment = sanitizePathSegment(assertNonEmpty(input.projectId, "MP Lance projectId"));
  const names: MpLanceTableNames = {
    globalMemories: "mp_global_memories",
    projectMemories: `mp_project_${projectSegment}_memories`,
  };

  const agentId = input.agentId?.trim();
  if (!agentId) {
    return names;
  }

  return {
    ...names,
    agentMemories: `mp_project_${projectSegment}_agent_${sanitizePathSegment(agentId)}_memories`,
  };
}

export function createMpGlobalTableDescriptor(input: {
  rootPath: string;
  schemaVersion?: number;
  metadata?: Record<string, unknown>;
}): MpLanceTableDescriptor {
  const tableName = createMpLanceTableNames({ projectId: "global" }).globalMemories;
  return createMpLanceTableDescriptor({
    kind: "global_memories",
    scopeLevel: "global",
    tableName,
    storagePath: toStoragePath(input.rootPath, tableName),
    ownership: "global",
    schemaVersion: input.schemaVersion ?? MP_LANCE_SCHEMA_VERSION,
    metadata: input.metadata,
  });
}

export function createMpProjectTableDescriptor(input: {
  projectId: string;
  rootPath: string;
  schemaVersion?: number;
  metadata?: Record<string, unknown>;
}): MpLanceTableDescriptor {
  const tableName = createMpLanceTableNames({
    projectId: input.projectId,
  }).projectMemories;
  return createMpLanceTableDescriptor({
    kind: "project_memories",
    scopeLevel: "project",
    tableName,
    storagePath: toStoragePath(input.rootPath, tableName),
    ownership: "project",
    projectId: input.projectId,
    schemaVersion: input.schemaVersion ?? MP_LANCE_SCHEMA_VERSION,
    metadata: input.metadata,
  });
}

export function createMpAgentTableDescriptor(input: {
  projectId: string;
  agentId: string;
  rootPath: string;
  schemaVersion?: number;
  metadata?: Record<string, unknown>;
}): MpLanceTableDescriptor {
  const names = createMpLanceTableNames({
    projectId: input.projectId,
    agentId: input.agentId,
  });
  return createMpLanceTableDescriptor({
    kind: "agent_memories",
    scopeLevel: "agent_isolated",
    tableName: names.agentMemories ?? "",
    storagePath: toStoragePath(input.rootPath, names.agentMemories ?? ""),
    ownership: "agent_local",
    projectId: input.projectId,
    agentId: input.agentId,
    schemaVersion: input.schemaVersion ?? MP_LANCE_SCHEMA_VERSION,
    metadata: input.metadata,
  });
}

export function createMpLanceProjectLayout(input: {
  projectId: string;
  agentIds: readonly string[];
  rootPath: string;
  schemaVersion?: number;
  metadata?: Record<string, unknown>;
}): MpLanceProjectLayout {
  const agentIds = normalizeAgentIds(input.agentIds);
  return createValidatedMpLanceProjectLayout({
    projectId: assertNonEmpty(input.projectId, "MP Lance projectId"),
    rootPath: assertNonEmpty(input.rootPath, "MP Lance rootPath"),
    globalTable: createMpGlobalTableDescriptor({
      rootPath: input.rootPath,
      schemaVersion: input.schemaVersion,
      metadata: input.metadata,
    }),
    projectTable: createMpProjectTableDescriptor({
      projectId: input.projectId,
      rootPath: input.rootPath,
      schemaVersion: input.schemaVersion,
      metadata: input.metadata,
    }),
    agentTables: agentIds.map((agentId) => createMpAgentTableDescriptor({
      projectId: input.projectId,
      agentId,
      rootPath: input.rootPath,
      schemaVersion: input.schemaVersion,
      metadata: input.metadata,
    })),
    metadata: input.metadata,
  });
}

export function createMpLanceBootstrapPlan(
  input: CreateMpLanceBootstrapPlanInput,
): MpLanceBootstrapPlan {
  const agentIds = normalizeAgentIds(input.agentIds);
  const rootPath = assertNonEmpty(input.rootPath, "MP Lance rootPath");
  const schemaVersion = input.schemaVersion ?? MP_LANCE_SCHEMA_VERSION;
  const layout = createMpLanceProjectLayout({
    projectId: input.projectId,
    agentIds,
    rootPath,
    schemaVersion,
    metadata: input.metadata,
  });
  const plan: MpLanceBootstrapPlan = {
    projectId: assertNonEmpty(input.projectId, "MP Lance projectId"),
    rootPath,
    agentIds,
    schemaVersion,
    layout,
    tableDescriptors: [
      layout.globalTable,
      layout.projectTable,
      ...layout.agentTables,
    ],
    metadata: input.metadata,
  };
  validateMpLanceBootstrapPlan(plan);
  return plan;
}

export function createMpLanceBootstrapReceipt(input: {
  plan: MpLanceBootstrapPlan;
  createdTables: readonly string[];
  metadata?: Record<string, unknown>;
}): MpLanceBootstrapReceipt {
  const createdTables = [...new Set(input.createdTables.map((tableName) => tableName.trim()).filter(Boolean))];
  const expectedTableCount = input.plan.tableDescriptors.length;
  const presentTableCount = createdTables.length;
  const status: MpLanceBootstrapReceiptStatus = presentTableCount === expectedTableCount
    ? "bootstrapped"
    : "partial";

  return {
    projectId: input.plan.projectId,
    schemaVersion: input.plan.schemaVersion,
    status,
    expectedTableCount,
    presentTableCount,
    createdTables,
    metadata: {
      rootPath: input.plan.rootPath,
      ...(input.metadata ?? {}),
    },
  };
}
