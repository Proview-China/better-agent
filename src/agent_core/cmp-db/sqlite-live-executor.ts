import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  createCmpProjectDbBootstrapReceipt,
  type CmpProjectDbReadbackRowInput,
} from "./postgresql-bootstrap.js";
import type {
  CmpDbLiveExecutor,
  CmpDbStatementExecutionReceipt,
  CmpDbSqlStatement,
  CmpProjectDbBootstrapContract,
  CmpProjectDbBootstrapReceipt,
} from "./cmp-db-types.js";

export interface CmpDbSqliteConnectionOptions {
  databaseName: string;
}

export interface CmpDbSqliteStatementExecutionReceipt extends CmpDbStatementExecutionReceipt {}

export interface CmpDbSqliteLiveExecutor extends CmpDbLiveExecutor {
  readonly driver: "sqlite";
  readonly connection: CmpDbSqliteConnectionOptions;
  executeStatement(
    statement: CmpDbSqlStatement,
  ): Promise<CmpDbSqliteStatementExecutionReceipt>;
  executeBootstrapContract(
    contract: CmpProjectDbBootstrapContract,
  ): Promise<{
    receipt: CmpProjectDbBootstrapReceipt;
    bootstrapExecutions: CmpDbSqliteStatementExecutionReceipt[];
    readbackExecutions: CmpDbSqliteStatementExecutionReceipt[];
  }>;
}

export interface CreateCmpDbSqliteLiveExecutorInput {
  connection: CmpDbSqliteConnectionOptions;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function toSqliteLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/gu, "''")}'`;
  }
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function interpolateSql(text: string, values: readonly unknown[] | undefined): string {
  let output = text;
  const entries = values ?? [];
  for (let index = entries.length; index >= 1; index -= 1) {
    const pattern = new RegExp(`\\$${index}(?!\\d)`, "gu");
    output = output.replace(pattern, toSqliteLiteral(entries[index - 1]));
  }
  return output;
}

async function loadSqliteModule() {
  const mod = await import("sqlite3");
  return mod.default ?? (mod as unknown as {
    Database: new (
      filename: string,
      callback?: (error: Error | null) => void,
    ) => {
      run: (sql: string, callback?: (error: Error | null) => void) => void;
      all: (sql: string, callback: (error: Error | null, rows: unknown[]) => void) => void;
      close: (callback?: (error: Error | null) => void) => void;
      serialize: (callback: () => void) => void;
    };
  });
}

export function createCmpDbSqliteLiveExecutor(
  input: CreateCmpDbSqliteLiveExecutorInput,
): CmpDbSqliteLiveExecutor {
  const connection = {
    databaseName: assertNonEmpty(input.connection.databaseName, "CMP SQLite databaseName"),
  };

  async function withDatabase<T>(fn: (db: {
    run: (sql: string, callback?: (error: Error | null) => void) => void;
    all: (sql: string, callback: (error: Error | null, rows: unknown[]) => void) => void;
    close: (callback?: (error: Error | null) => void) => void;
    serialize: (callback: () => void) => void;
  }) => Promise<T>): Promise<T> {
    await mkdir(dirname(connection.databaseName), { recursive: true });
    const sqlite3 = await loadSqliteModule();
    const db = await new Promise<InstanceType<typeof sqlite3.Database>>((resolve, reject) => {
      const instance = new sqlite3.Database(connection.databaseName, (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(instance);
      });
    });
    try {
      return await fn(db);
    } finally {
      await new Promise<void>((resolve, reject) => {
        db.close((error: Error | null) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }

  async function executeSql(statement: CmpDbSqlStatement): Promise<CmpDbSqliteStatementExecutionReceipt> {
    const sql = interpolateSql(statement.text, statement.values);
    try {
      const stdout = await withDatabase((db) => new Promise<string>((resolve, reject) => {
        db.serialize(() => {
          if (statement.phase === "read") {
            db.all(sql, (error: Error | null, rows: unknown[]) => {
              if (error) {
                reject(error);
                return;
              }
              const row = rows[0] as Record<string, unknown> | undefined;
              if (!row) {
                resolve("");
                return;
              }
              const firstValue = Object.values(row)[0];
              resolve(firstValue === undefined || firstValue === null ? "" : String(firstValue));
            });
            return;
          }
          db.run(sql, (error: Error | null) => {
            if (error) {
              reject(error);
              return;
            }
            resolve("");
          });
        });
      }));
      return {
        statementId: statement.statementId,
        target: statement.target,
        phase: statement.phase,
        stdout,
        stderr: "",
        exitCode: 0,
      };
    } catch (error) {
      return {
        statementId: statement.statementId,
        target: statement.target,
        phase: statement.phase,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  return {
    driver: "sqlite",
    connection,
    executeStatement(statement) {
      return executeSql(statement);
    },
    async executeBootstrapContract(contract) {
      const bootstrapExecutions: CmpDbSqliteStatementExecutionReceipt[] = [];
      for (const statement of contract.bootstrapStatements) {
        const execution = await executeSql(statement);
        if (execution.exitCode !== 0) {
          throw new Error(
            `CMP SQLite bootstrap statement ${statement.statementId} failed for ${statement.target}: ${execution.stderr || execution.stdout}`,
          );
        }
        bootstrapExecutions.push(execution);
      }

      const readbackExecutions: CmpDbSqliteStatementExecutionReceipt[] = [];
      const readbackRows: CmpProjectDbReadbackRowInput[] = [];
      for (const statement of contract.readbackStatements) {
        const execution = await executeSql(statement);
        if (execution.exitCode !== 0) {
          throw new Error(
            `CMP SQLite readback statement ${statement.statementId} failed for ${statement.target}: ${execution.stderr || execution.stdout}`,
          );
        }
        readbackExecutions.push(execution);
        readbackRows.push({
          target: statement.target,
          tableRef: execution.stdout.trim() || undefined,
        });
      }

      return {
        receipt: createCmpProjectDbBootstrapReceipt({
          contract,
          readbackRows,
          metadata: {
            databaseName: connection.databaseName,
          },
        }),
        bootstrapExecutions,
        readbackExecutions,
      };
    },
  };
}
