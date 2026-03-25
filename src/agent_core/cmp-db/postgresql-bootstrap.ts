import { randomUUID } from "node:crypto";

import {
  type CmpDbBootstrapReadbackRecord,
  type CmpProjectDbBootstrapReceipt,
  type CmpAgentLocalTableSet,
  type CmpDbAgentLocalTableDefinition,
  type CmpDbColumnDefinition,
  type CmpDbIndexDefinition,
  type CmpDbSharedTableDefinition,
  type CmpDbSqlStatement,
  type CmpProjectDbBootstrapContract,
  type CmpProjectDbTopology,
  sanitizeSqlIdentifier,
  validateCmpProjectDbBootstrapContract,
  validateCmpProjectDbBootstrapReceipt,
} from "./cmp-db-types.js";
import { createCmpAgentLocalTableSet } from "./agent-local-hot-tables.js";
import { createCmpProjectDbTopology } from "./project-db-topology.js";

function toQualifiedTableName(schemaName: string, tableName: string): string {
  return `"${sanitizeSqlIdentifier(schemaName)}"."${sanitizeSqlIdentifier(tableName)}"`;
}

function renderColumnSql(column: CmpDbColumnDefinition, primaryKey: string): string {
  const nullable = column.nullable ? "" : " NOT NULL";
  const primary = column.name === primaryKey ? " PRIMARY KEY" : "";
  const defaultExpression = column.defaultExpression ? ` DEFAULT ${column.defaultExpression}` : "";
  return `"${sanitizeSqlIdentifier(column.name)}" ${column.sqlType}${defaultExpression}${nullable}${primary}`;
}

function renderIndexSql(params: {
  schemaName: string;
  tableName: string;
  index: CmpDbIndexDefinition;
}): string {
  const unique = params.index.unique ? "UNIQUE " : "";
  const columns = params.index.columns
    .map((column) => `"${sanitizeSqlIdentifier(column)}"`)
    .join(", ");
  return `CREATE ${unique}INDEX IF NOT EXISTS "${sanitizeSqlIdentifier(params.index.name)}" ON ${toQualifiedTableName(params.schemaName, params.tableName)} (${columns});`;
}

function createCreateTableStatement(params: {
  phase: CmpDbSqlStatement["phase"];
  schemaName: string;
  table: Pick<CmpDbSharedTableDefinition | CmpDbAgentLocalTableDefinition, "tableName" | "primaryKey" | "columns">;
  metadata?: Record<string, unknown>;
}): CmpDbSqlStatement {
  return {
    statementId: randomUUID(),
    phase: params.phase,
    target: `${params.schemaName}.${params.table.tableName}`,
    text: `CREATE TABLE IF NOT EXISTS ${toQualifiedTableName(params.schemaName, params.table.tableName)} (${params.table.columns.map((column) => renderColumnSql(column, params.table.primaryKey)).join(", ")});`,
    metadata: params.metadata,
  };
}

function createIndexStatements(params: {
  phase: CmpDbSqlStatement["phase"];
  schemaName: string;
  table: Pick<CmpDbSharedTableDefinition | CmpDbAgentLocalTableDefinition, "tableName" | "indexes">;
  metadata?: Record<string, unknown>;
}): CmpDbSqlStatement[] {
  return (params.table.indexes ?? []).map((index) => ({
    statementId: randomUUID(),
    phase: params.phase,
    target: `${params.schemaName}.${params.table.tableName}`,
    text: renderIndexSql({
      schemaName: params.schemaName,
      tableName: params.table.tableName,
      index,
    }),
    metadata: params.metadata,
  }));
}

function createReadbackStatement(params: {
  phase: CmpDbSqlStatement["phase"];
  schemaName: string;
  tableName: string;
}): CmpDbSqlStatement {
  return {
    statementId: randomUUID(),
    phase: params.phase,
    target: `${params.schemaName}.${params.tableName}`,
    text: `SELECT to_regclass('${sanitizeSqlIdentifier(params.schemaName)}.${sanitizeSqlIdentifier(params.tableName)}') AS table_ref;`,
  };
}

export interface CreateCmpProjectDbBootstrapContractInput {
  projectId: string;
  agentIds: readonly string[];
  databaseName?: string;
  schemaName?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpProjectDbReadbackRowInput {
  target: string;
  tableRef?: string | null;
  metadata?: Record<string, unknown>;
}

export function createCmpProjectDbBootstrapContract(
  input: CreateCmpProjectDbBootstrapContractInput,
): CmpProjectDbBootstrapContract {
  const topology = createCmpProjectDbTopology({
    projectId: input.projectId,
    databaseName: input.databaseName,
    schemaName: input.schemaName,
    metadata: input.metadata,
  });
  const localTableSets = [...new Set(input.agentIds.map((agentId) => agentId.trim()).filter(Boolean))]
    .map((agentId) => createCmpAgentLocalTableSet({
      projectId: input.projectId,
      schemaName: topology.schemaName,
      agentId,
    }));

  const bootstrapStatements: CmpDbSqlStatement[] = [
    {
      statementId: randomUUID(),
      phase: "bootstrap",
      target: topology.databaseName,
      text: `CREATE SCHEMA IF NOT EXISTS "${sanitizeSqlIdentifier(topology.schemaName)}";`,
      metadata: input.metadata,
    },
  ];

  for (const table of topology.sharedTables) {
    bootstrapStatements.push(createCreateTableStatement({
      phase: "bootstrap",
      schemaName: topology.schemaName,
      table,
      metadata: {
        ownership: table.ownership,
        kind: table.kind,
      },
    }));
    bootstrapStatements.push(...createIndexStatements({
      phase: "bootstrap",
      schemaName: topology.schemaName,
      table,
      metadata: {
        ownership: table.ownership,
        kind: table.kind,
      },
    }));
  }

  for (const set of localTableSets) {
    for (const table of set.tables) {
      bootstrapStatements.push(createCreateTableStatement({
        phase: "bootstrap",
        schemaName: topology.schemaName,
        table,
        metadata: {
          ownership: table.ownership,
          kind: table.kind,
          agentId: set.agentId,
        },
      }));
      bootstrapStatements.push(...createIndexStatements({
        phase: "bootstrap",
        schemaName: topology.schemaName,
        table,
        metadata: {
          ownership: table.ownership,
          kind: table.kind,
          agentId: set.agentId,
        },
      }));
    }
  }

  const readbackStatements = [
    ...topology.sharedTables.map((table) => createReadbackStatement({
      phase: "read",
      schemaName: topology.schemaName,
      tableName: table.tableName,
    })),
    ...localTableSets.flatMap((set) => set.tables.map((table) => createReadbackStatement({
      phase: "read",
      schemaName: topology.schemaName,
      tableName: table.tableName,
    }))),
  ];

  const contract: CmpProjectDbBootstrapContract = {
    projectId: topology.projectId,
    databaseName: topology.databaseName,
    schemaName: topology.schemaName,
    topology,
    localTableSets,
    bootstrapStatements,
    readbackStatements,
    metadata: input.metadata,
  };

  validateCmpProjectDbBootstrapContract(contract);
  return contract;
}

function splitTarget(target: string): { schemaName: string; tableName: string } {
  const normalized = target.trim();
  const [schemaName, ...rest] = normalized.split(".");
  if (!schemaName || rest.length === 0) {
    throw new Error(`CMP DB bootstrap target ${target} must use schema.table form.`);
  }
  return {
    schemaName,
    tableName: rest.join("."),
  };
}

export function createCmpProjectDbBootstrapReadbackRecord(input: {
  statement: Pick<CmpDbSqlStatement, "target" | "metadata">;
  tableRef?: string | null;
  metadata?: Record<string, unknown>;
}): CmpDbBootstrapReadbackRecord {
  const target = input.statement.target.trim();
  const { schemaName, tableName } = splitTarget(target);
  const tableRef = input.tableRef?.trim() || undefined;
  return {
    target,
    schemaName,
    tableName,
    tableRef,
    status: tableRef ? "present" : "missing",
    metadata: {
      ...(input.statement.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export function listCmpProjectDbReadbackTargets(
  contract: Pick<CmpProjectDbBootstrapContract, "readbackStatements">,
): string[] {
  return [...new Set(contract.readbackStatements.map((statement) => statement.target))];
}

export function createCmpProjectDbBootstrapReceipt(input: {
  contract: CmpProjectDbBootstrapContract;
  readbackRows?: readonly CmpProjectDbReadbackRowInput[];
  metadata?: Record<string, unknown>;
}): CmpProjectDbBootstrapReceipt {
  const readbackByTarget = new Map(
    (input.readbackRows ?? []).map((row) => [row.target.trim(), row]),
  );
  const readbackRecords = input.contract.readbackStatements.map((statement) => {
    const row = readbackByTarget.get(statement.target);
    return createCmpProjectDbBootstrapReadbackRecord({
      statement,
      tableRef: row?.tableRef,
      metadata: row?.metadata,
    });
  });
  const expectedTargetCount = readbackRecords.length;
  const presentTargetCount = readbackRecords.filter((record) => record.status === "present").length;
  const receipt: CmpProjectDbBootstrapReceipt = {
    projectId: input.contract.projectId,
    databaseName: input.contract.databaseName,
    schemaName: input.contract.schemaName,
    status: presentTargetCount === expectedTargetCount ? "bootstrapped" : "readback_incomplete",
    expectedTargetCount,
    presentTargetCount,
    readbackRecords,
    metadata: {
      ...(input.contract.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpProjectDbBootstrapReceipt(receipt);
  return receipt;
}
