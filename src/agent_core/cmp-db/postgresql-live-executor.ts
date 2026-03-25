import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  createCmpProjectDbBootstrapReceipt,
  type CmpProjectDbReadbackRowInput,
} from "./postgresql-bootstrap.js";
import type {
  CmpDbSqlStatement,
  CmpProjectDbBootstrapContract,
  CmpProjectDbBootstrapReceipt,
} from "./cmp-db-types.js";

const execFileAsync = promisify(execFile);

export interface CmpDbPsqlConnectionOptions {
  databaseName: string;
  host?: string;
  port?: number;
  user?: string;
  binaryPath?: string;
  extraArgs?: readonly string[];
  env?: NodeJS.ProcessEnv;
}

export interface CmpDbPsqlInvocation {
  sql: string;
  statement: Pick<CmpDbSqlStatement, "statementId" | "phase" | "target" | "text">;
  args: string[];
}

export interface CmpDbPsqlCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CmpDbPsqlStatementExecutionReceipt {
  statementId: string;
  target: string;
  phase: CmpDbSqlStatement["phase"];
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CmpDbPsqlLiveExecutor {
  readonly connection: CmpDbPsqlConnectionOptions;
  executeStatement(
    statement: CmpDbSqlStatement,
  ): Promise<CmpDbPsqlStatementExecutionReceipt>;
  executeBootstrapContract(
    contract: CmpProjectDbBootstrapContract,
  ): Promise<{
    receipt: CmpProjectDbBootstrapReceipt;
    bootstrapExecutions: CmpDbPsqlStatementExecutionReceipt[];
    readbackExecutions: CmpDbPsqlStatementExecutionReceipt[];
  }>;
}

export type CmpDbPsqlCommandRunner = (
  invocation: CmpDbPsqlInvocation,
) => Promise<CmpDbPsqlCommandResult>;

export interface CreateCmpDbPsqlLiveExecutorInput {
  connection: CmpDbPsqlConnectionOptions;
  commandRunner?: CmpDbPsqlCommandRunner;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function buildPsqlArgs(
  connection: CmpDbPsqlConnectionOptions,
  sql: string,
): string[] {
  const args = [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-A",
    "-t",
  ];
  if (connection.host) {
    args.push("-h", connection.host);
  }
  if (typeof connection.port === "number") {
    args.push("-p", String(connection.port));
  }
  if (connection.user) {
    args.push("-U", connection.user);
  }
  args.push("-d", assertNonEmpty(connection.databaseName, "CMP DB databaseName"));
  if (connection.extraArgs) {
    args.push(...connection.extraArgs);
  }
  args.push("-c", sql);
  return args;
}

export function createCmpDbPsqlCommandRunner(
  connection: CmpDbPsqlConnectionOptions,
): CmpDbPsqlCommandRunner {
  const binaryPath = connection.binaryPath?.trim() || "psql";

  return async (invocation) => {
    try {
      const { stdout, stderr } = await execFileAsync(binaryPath, invocation.args, {
        env: {
          ...process.env,
          ...(connection.env ?? {}),
        },
      });
      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error) {
      const failed = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };
      return {
        stdout: failed.stdout ?? "",
        stderr: failed.stderr ?? failed.message,
        exitCode: typeof failed.code === "number" ? failed.code : 1,
      };
    }
  };
}

export function createCmpDbPsqlLiveExecutor(
  input: CreateCmpDbPsqlLiveExecutorInput,
): CmpDbPsqlLiveExecutor {
  const connection = {
    ...input.connection,
    databaseName: assertNonEmpty(input.connection.databaseName, "CMP DB databaseName"),
    binaryPath: input.connection.binaryPath?.trim() || "psql",
  };
  const commandRunner = input.commandRunner ?? createCmpDbPsqlCommandRunner(connection);

  return {
    connection,
    async executeStatement(statement) {
      const sql = assertNonEmpty(statement.text, "CMP DB SQL statement text");
      const args = buildPsqlArgs(connection, sql);
      const result = await commandRunner({
        sql,
        statement,
        args,
      });
      return {
        statementId: statement.statementId,
        target: statement.target,
        phase: statement.phase,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
    async executeBootstrapContract(contract) {
      const bootstrapExecutions: CmpDbPsqlStatementExecutionReceipt[] = [];
      for (const statement of contract.bootstrapStatements) {
        const execution = await this.executeStatement(statement);
        if (execution.exitCode !== 0) {
          throw new Error(
            `CMP DB bootstrap statement ${statement.statementId} failed for ${statement.target}: ${execution.stderr || execution.stdout}`,
          );
        }
        bootstrapExecutions.push(execution);
      }

      const readbackExecutions: CmpDbPsqlStatementExecutionReceipt[] = [];
      const readbackRows: CmpProjectDbReadbackRowInput[] = [];
      for (const statement of contract.readbackStatements) {
        const execution = await this.executeStatement(statement);
        if (execution.exitCode !== 0) {
          throw new Error(
            `CMP DB readback statement ${statement.statementId} failed for ${statement.target}: ${execution.stderr || execution.stdout}`,
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
