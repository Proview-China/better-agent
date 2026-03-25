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

export const CMP_DB_CONTEXT_PACKAGE_RECORD_STATES = [
  "materialized",
  "delivered",
  "acknowledged",
  "archived",
] as const;
export type CmpDbContextPackageRecordState =
  (typeof CMP_DB_CONTEXT_PACKAGE_RECORD_STATES)[number];

export const CMP_DB_DELIVERY_RECORD_STATES = [
  "pending_delivery",
  "delivered",
  "acknowledged",
  "rejected",
  "expired",
] as const;
export type CmpDbDeliveryRecordState =
  (typeof CMP_DB_DELIVERY_RECORD_STATES)[number];

export const CMP_DB_STORAGE_ENGINES = ["postgresql"] as const;
export type CmpDbStorageEngine = (typeof CMP_DB_STORAGE_ENGINES)[number];

export const CMP_DB_SQL_COLUMN_TYPES = [
  "uuid",
  "text",
  "jsonb",
  "timestamptz",
  "integer",
  "boolean",
] as const;
export type CmpDbSqlColumnType = (typeof CMP_DB_SQL_COLUMN_TYPES)[number];

export interface CmpDbIndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface CmpDbColumnDefinition {
  name: string;
  sqlType: CmpDbSqlColumnType;
  nullable?: boolean;
  defaultExpression?: string;
  description?: string;
}

export interface CmpDbSharedTableDefinition {
  schemaName: string;
  tableName: string;
  kind: CmpDbSharedTableKind;
  storageEngine: CmpDbStorageEngine;
  ownership: "project_shared";
  primaryKey: string;
  columns: CmpDbColumnDefinition[];
  description: string;
  indexes?: CmpDbIndexDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpDbAgentLocalTableDefinition {
  schemaName: string;
  tableName: string;
  agentId: string;
  kind: CmpDbAgentLocalTableKind;
  storageEngine: CmpDbStorageEngine;
  ownership: "agent_local";
  primaryKey: string;
  columns: CmpDbColumnDefinition[];
  description: string;
  indexes?: CmpDbIndexDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpProjectDbTopology {
  projectId: string;
  databaseName: string;
  schemaName: string;
  sharedTables: CmpDbSharedTableDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CmpAgentLocalTableSet {
  projectId: string;
  schemaName: string;
  agentId: string;
  tables: CmpDbAgentLocalTableDefinition[];
}

export interface CmpDbSqlStatement {
  statementId: string;
  phase: "bootstrap" | "read" | "write";
  target: string;
  text: string;
  values?: readonly unknown[];
  metadata?: Record<string, unknown>;
}

export interface CmpProjectDbBootstrapContract {
  projectId: string;
  databaseName: string;
  schemaName: string;
  topology: CmpProjectDbTopology;
  localTableSets: CmpAgentLocalTableSet[];
  bootstrapStatements: CmpDbSqlStatement[];
  readbackStatements: CmpDbSqlStatement[];
  metadata?: Record<string, unknown>;
}

export const CMP_DB_BOOTSTRAP_READBACK_STATUSES = [
  "present",
  "missing",
] as const;
export type CmpDbBootstrapReadbackStatus =
  (typeof CMP_DB_BOOTSTRAP_READBACK_STATUSES)[number];

export const CMP_DB_BOOTSTRAP_RECEIPT_STATUSES = [
  "bootstrapped",
  "readback_incomplete",
] as const;
export type CmpDbBootstrapReceiptStatus =
  (typeof CMP_DB_BOOTSTRAP_RECEIPT_STATUSES)[number];

export interface CmpDbBootstrapReadbackRecord {
  target: string;
  schemaName: string;
  tableName: string;
  tableRef?: string;
  status: CmpDbBootstrapReadbackStatus;
  metadata?: Record<string, unknown>;
}

export interface CmpProjectDbBootstrapReceipt {
  projectId: string;
  databaseName: string;
  schemaName: string;
  status: CmpDbBootstrapReceiptStatus;
  expectedTargetCount: number;
  presentTargetCount: number;
  readbackRecords: CmpDbBootstrapReadbackRecord[];
  metadata?: Record<string, unknown>;
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

export interface CmpDbContextPackageRecord {
  packageId: string;
  sourceProjectionId: string;
  sourceSnapshotId: string;
  sourceAgentId: string;
  targetAgentId: string;
  packageKind: string;
  packageRef: string;
  fidelityLabel: string;
  state: CmpDbContextPackageRecordState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpDbDeliveryRegistryRecord {
  deliveryId: string;
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  state: CmpDbDeliveryRecordState;
  createdAt: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
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
  assertNonEmptyString(table.schemaName, "CMP DB shared table schemaName");
  assertNonEmptyString(table.tableName, "CMP DB shared table name");
  assertNonEmptyString(table.primaryKey, "CMP DB shared table primaryKey");
  validateCmpDbColumnDefinitions(table.columns, "CMP DB shared table columns");
  assertNonEmptyString(table.description, "CMP DB shared table description");
}

export function validateCmpDbAgentLocalTableDefinition(
  table: CmpDbAgentLocalTableDefinition,
): void {
  assertNonEmptyString(table.schemaName, "CMP DB agent-local table schemaName");
  assertNonEmptyString(table.tableName, "CMP DB agent-local table name");
  assertNonEmptyString(table.agentId, "CMP DB agent-local table agentId");
  assertNonEmptyString(table.primaryKey, "CMP DB agent-local table primaryKey");
  validateCmpDbColumnDefinitions(table.columns, "CMP DB agent-local table columns");
  assertNonEmptyString(table.description, "CMP DB agent-local table description");
}

export function validateCmpProjectDbTopology(topology: CmpProjectDbTopology): void {
  assertNonEmptyString(topology.projectId, "CMP DB projectId");
  assertNonEmptyString(topology.databaseName, "CMP DB databaseName");
  assertNonEmptyString(topology.schemaName, "CMP DB schemaName");
  for (const table of topology.sharedTables) {
    validateCmpDbSharedTableDefinition(table);
  }
}

export function validateCmpAgentLocalTableSet(set: CmpAgentLocalTableSet): void {
  assertNonEmptyString(set.projectId, "CMP DB local table set projectId");
  assertNonEmptyString(set.schemaName, "CMP DB local table set schemaName");
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

export function validateCmpDbSqlStatement(statement: CmpDbSqlStatement): void {
  assertNonEmptyString(statement.statementId, "CMP DB SQL statementId");
  assertNonEmptyString(statement.target, "CMP DB SQL target");
  assertNonEmptyString(statement.text, "CMP DB SQL text");
}

export function validateCmpProjectDbBootstrapContract(
  contract: CmpProjectDbBootstrapContract,
): void {
  assertNonEmptyString(contract.projectId, "CMP DB bootstrap projectId");
  assertNonEmptyString(contract.databaseName, "CMP DB bootstrap databaseName");
  assertNonEmptyString(contract.schemaName, "CMP DB bootstrap schemaName");
  validateCmpProjectDbTopology(contract.topology);
  for (const set of contract.localTableSets) {
    validateCmpAgentLocalTableSet(set);
  }
  for (const statement of contract.bootstrapStatements) {
    validateCmpDbSqlStatement(statement);
  }
  for (const statement of contract.readbackStatements) {
    validateCmpDbSqlStatement(statement);
  }
}

export function validateCmpDbBootstrapReadbackRecord(
  record: CmpDbBootstrapReadbackRecord,
): void {
  assertNonEmptyString(record.target, "CMP DB bootstrap readback target");
  assertNonEmptyString(record.schemaName, "CMP DB bootstrap readback schemaName");
  assertNonEmptyString(record.tableName, "CMP DB bootstrap readback tableName");
  if (!CMP_DB_BOOTSTRAP_READBACK_STATUSES.includes(record.status)) {
    throw new Error(`Unsupported CMP DB bootstrap readback status: ${record.status}.`);
  }
}

export function validateCmpProjectDbBootstrapReceipt(
  receipt: CmpProjectDbBootstrapReceipt,
): void {
  assertNonEmptyString(receipt.projectId, "CMP DB bootstrap receipt projectId");
  assertNonEmptyString(receipt.databaseName, "CMP DB bootstrap receipt databaseName");
  assertNonEmptyString(receipt.schemaName, "CMP DB bootstrap receipt schemaName");
  if (!CMP_DB_BOOTSTRAP_RECEIPT_STATUSES.includes(receipt.status)) {
    throw new Error(`Unsupported CMP DB bootstrap receipt status: ${receipt.status}.`);
  }
  if (receipt.expectedTargetCount < 0 || receipt.presentTargetCount < 0) {
    throw new Error("CMP DB bootstrap receipt target counts cannot be negative.");
  }
  if (receipt.presentTargetCount > receipt.expectedTargetCount) {
    throw new Error("CMP DB bootstrap receipt presentTargetCount cannot exceed expectedTargetCount.");
  }
  for (const record of receipt.readbackRecords) {
    validateCmpDbBootstrapReadbackRecord(record);
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

export function validateCmpDbContextPackageRecord(
  record: CmpDbContextPackageRecord,
): void {
  assertNonEmptyString(record.packageId, "CMP DB package record packageId");
  assertNonEmptyString(
    record.sourceProjectionId,
    "CMP DB package record sourceProjectionId",
  );
  assertNonEmptyString(
    record.sourceSnapshotId,
    "CMP DB package record sourceSnapshotId",
  );
  assertNonEmptyString(record.sourceAgentId, "CMP DB package record sourceAgentId");
  assertNonEmptyString(record.targetAgentId, "CMP DB package record targetAgentId");
  assertNonEmptyString(record.packageKind, "CMP DB package record packageKind");
  assertNonEmptyString(record.packageRef, "CMP DB package record packageRef");
  assertNonEmptyString(record.fidelityLabel, "CMP DB package record fidelityLabel");
  assertNonEmptyString(record.createdAt, "CMP DB package record createdAt");
  assertNonEmptyString(record.updatedAt, "CMP DB package record updatedAt");
}

export function validateCmpDbDeliveryRegistryRecord(
  record: CmpDbDeliveryRegistryRecord,
): void {
  assertNonEmptyString(record.deliveryId, "CMP DB delivery record deliveryId");
  assertNonEmptyString(record.dispatchId, "CMP DB delivery record dispatchId");
  assertNonEmptyString(record.packageId, "CMP DB delivery record packageId");
  assertNonEmptyString(record.sourceAgentId, "CMP DB delivery record sourceAgentId");
  assertNonEmptyString(record.targetAgentId, "CMP DB delivery record targetAgentId");
  assertNonEmptyString(record.createdAt, "CMP DB delivery record createdAt");
}

function validateCmpDbColumnDefinitions(
  columns: readonly CmpDbColumnDefinition[],
  label: string,
): void {
  if (columns.length === 0) {
    throw new Error(`${label} requires at least one column.`);
  }
  for (const column of columns) {
    assertNonEmptyString(column.name, `${label} column name`);
    if (!CMP_DB_SQL_COLUMN_TYPES.includes(column.sqlType)) {
      throw new Error(`${label} column ${column.name} uses unsupported SQL type ${column.sqlType}.`);
    }
  }
}
