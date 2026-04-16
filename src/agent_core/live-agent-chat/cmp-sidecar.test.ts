import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createCmpDbSqliteLiveExecutor } from "../cmp-db/index.js";
import { createInMemoryCmpGitBackend } from "../cmp-git/index.js";
import { createInMemoryCmpRedisMqAdapter } from "../cmp-mq/index.js";
import { createAgentCoreRuntime } from "../runtime.js";
import { runCmpSidecarTurn } from "./cmp-sidecar.js";
import { LiveChatLogger } from "./shared.js";

async function readCmpSqliteCounts(databasePath: string): Promise<{
  snapshotCount: number;
  packageCount: number;
  deliveryCount: number;
}> {
  const database = new DatabaseSync(databasePath, {
    open: true,
    readOnly: true,
    timeout: 1_000,
  });
  try {
    const snapshotCount = Number(database.prepare([
      "SELECT",
      "  (SELECT COUNT(*) FROM cmp_praxis_live_cli_cmp_live_cli_main_snapshots) +",
      "  (SELECT COUNT(*) FROM cmp_praxis_live_cli_core_live_cli_snapshots) AS n",
    ].join(" ")).get().n ?? 0);
    const packageCount = Number(database.prepare([
      "SELECT",
      "  (SELECT COUNT(*) FROM cmp_praxis_live_cli_cmp_live_cli_main_packages) +",
      "  (SELECT COUNT(*) FROM cmp_praxis_live_cli_core_live_cli_packages) AS n",
    ].join(" ")).get().n ?? 0);
    const deliveryCount = Number(database.prepare(
      "SELECT COUNT(*) AS n FROM cmp_praxis_live_cli_delivery_registry",
    ).get().n ?? 0);
    return {
      snapshotCount,
      packageCount,
      deliveryCount,
    };
  } finally {
    database.close();
  }
}

async function waitForCmpSqliteCounts(databasePath: string): Promise<{
  snapshotCount: number;
  packageCount: number;
  deliveryCount: number;
}> {
  const startedAt = Date.now();
  let latest = await readCmpSqliteCounts(databasePath);
  while ((latest.snapshotCount === 0 || latest.packageCount === 0 || latest.deliveryCount === 0) && Date.now() - startedAt < 2_000) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    latest = await readCmpSqliteCounts(databasePath);
  }
  return latest;
}

test("runCmpTurn drives the real CMP runtime flow and lowers sqlite-backed records", async () => {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), "praxis-live-cmp-sidecar-"));
  const dbPath = resolve(workspaceRoot, "memory", "generated", "cmp-db", "cmp.sqlite");
  await mkdir(dirname(dbPath), { recursive: true });
  await mkdir(resolve(workspaceRoot, ".cmp-worktrees"), { recursive: true });

  const runtime = createAgentCoreRuntime({
    cmpInfraBackends: {
      git: createInMemoryCmpGitBackend(),
      dbExecutor: createCmpDbSqliteLiveExecutor({
        connection: {
          databaseName: dbPath,
        },
      }),
      mq: createInMemoryCmpRedisMqAdapter(),
    },
  });

  await runtime.bootstrapCmpProjectInfra({
    projectId: "praxis-live-cli",
    repoName: "praxis-live-cli-test",
    repoRootPath: workspaceRoot,
    agents: [
      { agentId: "cmp-live-cli-main", depth: 0 },
      { agentId: "core-live-cli", parentAgentId: "cmp-live-cli-main", depth: 1 },
    ],
    defaultAgentId: "cmp-live-cli-main",
    defaultBranchName: "main",
    worktreeRootPath: resolve(workspaceRoot, ".cmp-worktrees"),
    storageEngine: "sqlite",
    databaseName: dbPath,
    dbSchemaName: "main",
    redisNamespaceRoot: "praxis",
    metadata: {
      source: "cmp-sidecar-test",
      dbEngine: "sqlite",
    },
  });

  const logPath = resolve(workspaceRoot, "memory", "live-reports", "cmp-sidecar.test.jsonl");
  await mkdir(dirname(logPath), { recursive: true });
  const logger = new LiveChatLogger(logPath);

  const cmp = await runCmpSidecarTurn({
    runtime,
    sessionId: "session-cmp-sidecar-test",
    transcript: [
      { role: "user", text: "上一轮用户消息" },
      { role: "assistant", text: "上一轮 assistant 回复" },
    ],
    turnIndex: 1,
    uiMode: "direct",
    logger,
    userMessage: "请把这一轮上下文真正走进 CMP runtime。",
  });

  assert.equal(cmp.syncStatus, "synced");
  assert.equal(cmp.failureReason, undefined);
  assert.notEqual(cmp.snapshotId, "pending");
  assert.notEqual(cmp.packageId, "pending");
  assert.notEqual(cmp.packageRef, "pending");
  assert.equal(cmp.packageKind, "active_reseed");
  assert.ok(runtime.listCmpSectionRecords().some((record) =>
    record.lifecycle === "pre" || record.lifecycle === "checked" || record.lifecycle === "persisted"));

  const counts = await waitForCmpSqliteCounts(dbPath);
  assert.ok(counts.snapshotCount > 0, "expected sqlite snapshot tables to receive lowered rows");
  assert.ok(counts.packageCount > 0, "expected sqlite package tables to receive lowered rows");
  assert.ok(counts.deliveryCount > 0, "expected sqlite delivery registry to receive lowered rows");
});
