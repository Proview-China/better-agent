export const CMP_DB_SHARED_TABLE_KINDS = [
  "agent_registry",
  "agent_lineage",
  "branch_registry",
  "sync_event_registry",
  "promotion_registry",
  "delivery_registry",
] as const;
export type CmpDbSharedTableKind = (typeof CMP_DB_SHARED_TABLE_KINDS)[number];

export const CMP_DB_AGENT_LOCAL_TABLE_KINDS = [
  "events",
  "snapshots",
  "packages",
  "dispatch",
] as const;
export type CmpDbAgentLocalTableKind = (typeof CMP_DB_AGENT_LOCAL_TABLE_KINDS)[number];

export const CMP_PROJECTION_STATES = [
  "local_only",
  "submitted_to_parent",
  "accepted_by_parent",
  "promoted_by_parent",
  "dispatched_downward",
  "archived",
] as const;
export type CmpProjectionState = (typeof CMP_PROJECTION_STATES)[number];

export interface CmpDbIndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface CmpDbSharedTableDefinition {
  tableName: string;
  kind: CmpDbSharedTableKind;
  ownership: "project_shared";
  primaryKey: string;
  description: string;
  indexes?: CmpDbIndexDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpDbAgentLocalTableDefinition {
  tableName: string;
  agentId: string;
  kind: CmpDbAgentLocalTableKind;
  ownership: "agent_local";
  primaryKey: string;
  description: string;
  indexes?: CmpDbIndexDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpProjectDbTopology {
  projectId: string;
  databaseName: string;
  sharedTables: CmpDbSharedTableDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpAgentLocalTableSet {
  agentId: string;
  tables: CmpDbAgentLocalTableDefinition[];
}

export interface CheckedSnapshotLike {
  snapshotId: string;
  agentId: string;
  branchRef: string;
  commitRef: string;
  checkedAt: string;
  qualityLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpProjectionRecord {
  projectionId: string;
  snapshotId: string;
  agentId: string;
  branchRef: string;
  commitRef: string;
  state: CmpProjectionState;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export function assertNonEmptyString(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function sanitizeSqlIdentifier(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function validateCmpDbSharedTableDefinition(
  table: CmpDbSharedTableDefinition,
): void {
  assertNonEmptyString(table.tableName, "CMP DB shared table name");
  assertNonEmptyString(table.primaryKey, "CMP DB shared table primaryKey");
  assertNonEmptyString(table.description, "CMP DB shared table description");
}

export function validateCmpDbAgentLocalTableDefinition(
  table: CmpDbAgentLocalTableDefinition,
): void {
  assertNonEmptyString(table.tableName, "CMP DB agent-local table name");
  assertNonEmptyString(table.agentId, "CMP DB agent-local table agentId");
  assertNonEmptyString(table.primaryKey, "CMP DB agent-local table primaryKey");
  assertNonEmptyString(table.description, "CMP DB agent-local table description");
}

export function validateCmpProjectDbTopology(topology: CmpProjectDbTopology): void {
  assertNonEmptyString(topology.projectId, "CMP DB projectId");
  assertNonEmptyString(topology.databaseName, "CMP DB databaseName");
  for (const table of topology.sharedTables) {
    validateCmpDbSharedTableDefinition(table);
  }
}

export function validateCmpAgentLocalTableSet(set: CmpAgentLocalTableSet): void {
  assertNonEmptyString(set.agentId, "CMP DB local table set agentId");
  if (set.tables.length === 0) {
    throw new Error("CMP DB local table set requires at least one table.");
  }
  for (const table of set.tables) {
    validateCmpDbAgentLocalTableDefinition(table);
    if (table.agentId !== set.agentId) {
      throw new Error(
        `CMP DB local table ${table.tableName} belongs to ${table.agentId}, expected ${set.agentId}.`,
      );
    }
  }
}

export function validateCheckedSnapshotLike(snapshot: CheckedSnapshotLike): void {
  assertNonEmptyString(snapshot.snapshotId, "CheckedSnapshotLike snapshotId");
  assertNonEmptyString(snapshot.agentId, "CheckedSnapshotLike agentId");
  assertNonEmptyString(snapshot.branchRef, "CheckedSnapshotLike branchRef");
  assertNonEmptyString(snapshot.commitRef, "CheckedSnapshotLike commitRef");
  assertNonEmptyString(snapshot.checkedAt, "CheckedSnapshotLike checkedAt");
}

export function validateCmpProjectionRecord(record: CmpProjectionRecord): void {
  assertNonEmptyString(record.projectionId, "CMP projection projectionId");
  assertNonEmptyString(record.snapshotId, "CMP projection snapshotId");
  assertNonEmptyString(record.agentId, "CMP projection agentId");
  assertNonEmptyString(record.branchRef, "CMP projection branchRef");
  assertNonEmptyString(record.commitRef, "CMP projection commitRef");
  assertNonEmptyString(record.updatedAt, "CMP projection updatedAt");
}

