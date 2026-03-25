import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpProjectDbBootstrapContract,
  createCmpDbPsqlCommandRunner,
  createCmpDbPsqlLiveExecutor,
} from "./index.js";

test("cmp postgres live executor builds psql command arguments from connection options", async () => {
  const invocations: string[][] = [];
  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: "postgres",
      host: "127.0.0.1",
      port: 5432,
      user: "postgres",
      extraArgs: ["--single-transaction"],
    },
    async commandRunner(invocation) {
      invocations.push(invocation.args);
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
    },
  });

  await executor.executeStatement({
    statementId: "stmt-1",
    phase: "bootstrap",
    target: "cmp_test.table_a",
    text: "SELECT 1;",
  });

  assert.deepEqual(invocations[0], [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-A",
    "-t",
    "-h",
    "127.0.0.1",
    "-p",
    "5432",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--single-transaction",
    "-c",
    "SELECT 1;",
  ]);
});

test("cmp postgres live executor can execute bootstrap contract and produce receipt from readback rows", async () => {
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "proj-db-live-executor",
    agentIds: ["main"],
    databaseName: "postgres",
    schemaName: "cmp_live_exec_a",
  });

  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: "postgres",
    },
    async commandRunner(invocation) {
      if (invocation.statement.phase === "read") {
        return {
          stdout: invocation.statement.target,
          stderr: "",
          exitCode: 0,
        };
      }
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
    },
  });

  const result = await executor.executeBootstrapContract(contract);

  assert.equal(result.bootstrapExecutions.length, contract.bootstrapStatements.length);
  assert.equal(result.readbackExecutions.length, contract.readbackStatements.length);
  assert.equal(result.receipt.status, "bootstrapped");
  assert.equal(result.receipt.presentTargetCount, contract.readbackStatements.length);
});

test("cmp postgres command runner can talk to local postgres when PRAXIS_CMP_DB_LIVE is enabled", async (t) => {
  if (process.env.PRAXIS_CMP_DB_LIVE !== "1") {
    t.skip("Set PRAXIS_CMP_DB_LIVE=1 to run local PostgreSQL smoke.");
    return;
  }

  const schemaName = `cmp_live_${Date.now().toString(36)}`;
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "proj-db-live-smoke",
    agentIds: ["main"],
    databaseName: process.env.PRAXIS_CMP_DB_DATABASE?.trim() || "postgres",
    schemaName,
  });

  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: process.env.PRAXIS_CMP_DB_DATABASE?.trim() || "postgres",
      host: process.env.PRAXIS_CMP_DB_HOST?.trim() || undefined,
      port: process.env.PRAXIS_CMP_DB_PORT ? Number(process.env.PRAXIS_CMP_DB_PORT) : undefined,
      user: process.env.PRAXIS_CMP_DB_USER?.trim() || undefined,
      binaryPath: process.env.PRAXIS_CMP_DB_PSQL_BINARY?.trim() || undefined,
      env: process.env,
    },
  });

  try {
    const result = await executor.executeBootstrapContract(contract);
    assert.equal(result.receipt.status, "bootstrapped");
    assert.equal(result.receipt.presentTargetCount, result.receipt.expectedTargetCount);
  } finally {
    const cleanupRunner = createCmpDbPsqlCommandRunner({
      databaseName: process.env.PRAXIS_CMP_DB_DATABASE?.trim() || "postgres",
      host: process.env.PRAXIS_CMP_DB_HOST?.trim() || undefined,
      port: process.env.PRAXIS_CMP_DB_PORT ? Number(process.env.PRAXIS_CMP_DB_PORT) : undefined,
      user: process.env.PRAXIS_CMP_DB_USER?.trim() || undefined,
      binaryPath: process.env.PRAXIS_CMP_DB_PSQL_BINARY?.trim() || undefined,
      env: process.env,
    });
    await cleanupRunner({
      sql: `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`,
      statement: {
        statementId: "cleanup-schema",
        phase: "bootstrap",
        target: `${schemaName}.__cleanup__`,
        text: `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`,
      },
      args: [
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-A",
        "-t",
        ...(process.env.PRAXIS_CMP_DB_HOST ? ["-h", process.env.PRAXIS_CMP_DB_HOST] : []),
        ...(process.env.PRAXIS_CMP_DB_PORT ? ["-p", process.env.PRAXIS_CMP_DB_PORT] : []),
        ...(process.env.PRAXIS_CMP_DB_USER ? ["-U", process.env.PRAXIS_CMP_DB_USER] : []),
        "-d",
        process.env.PRAXIS_CMP_DB_DATABASE?.trim() || "postgres",
        "-c",
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`,
      ],
    });
  }
});
