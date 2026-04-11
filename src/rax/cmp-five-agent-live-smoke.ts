import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createCheckedSnapshot,
  createCmpBranchFamily,
  createContextPackage,
  createDispatchReceipt,
} from "../agent_core/cmp-types/index.js";
import {
  createCmpFiveAgentConfiguration,
  createCmpFiveAgentRuntime,
  createCmpRoleLiveLlmModelExecutor,
} from "../agent_core/cmp-five-agent/index.js";
import type {
  CmpFiveAgentPromptVariant,
  CmpRoleLiveLlmMode,
} from "../agent_core/cmp-five-agent/index.js";
import { loadOpenAILiveConfig } from "./live-config.js";

type ProviderTarget = "openai";
type CmpLiveRole = "icma" | "iterator" | "checker" | "dbagent" | "dispatcher";
type CmpLiveRoleTarget = CmpLiveRole | "all";
type CmpLiveFlowTarget = "active" | "passive" | "both";

interface SmokeRow {
  provider: ProviderTarget;
  role: CmpLiveRole;
  ok: boolean;
  model: string;
  flow?: "active" | "passive";
  mode?: string;
  status?: string;
  summary: string;
  details?: Record<string, unknown>;
}

interface SmokeCliOptions {
  roleTarget: CmpLiveRoleTarget;
  flowTarget: CmpLiveFlowTarget;
  retryFallback: boolean;
  liveMode: CmpRoleLiveLlmMode;
  promptVariant: CmpFiveAgentPromptVariant;
}

function parseProviderArg(argv: string[]): ProviderTarget {
  const entry = argv.find((item) => item.startsWith("--provider="));
  const value = entry?.slice("--provider=".length) ?? "openai";
  if (value === "openai") {
    return value;
  }
  throw new Error(`Unsupported provider target: ${value}`);
}

function parseReportPathArg(argv: string[], provider: ProviderTarget): string {
  const entry = argv.find((item) => item.startsWith("--report="));
  if (entry) {
    return entry.slice("--report=".length);
  }
  return resolve(process.cwd(), "memory/live-reports", `cmp-five-agent-live-smoke.${provider}.json`);
}

function parseRoleArg(argv: string[]): CmpLiveRoleTarget {
  const entry = argv.find((item) => item.startsWith("--role="));
  const value = entry?.slice("--role=".length) ?? "all";
  if (
    value === "all"
    || value === "icma"
    || value === "iterator"
    || value === "checker"
    || value === "dbagent"
    || value === "dispatcher"
  ) {
    return value;
  }
  throw new Error(`Unsupported cmp five-agent smoke role: ${value}`);
}

function parseFlowArg(argv: string[]): CmpLiveFlowTarget {
  const entry = argv.find((item) => item.startsWith("--flow="));
  const value = entry?.slice("--flow=".length) ?? "both";
  if (value === "active" || value === "passive" || value === "both") {
    return value;
  }
  throw new Error(`Unsupported cmp five-agent smoke flow: ${value}`);
}

function parseRetryFallbackArg(argv: string[]): boolean {
  if (argv.includes("--no-retry")) {
    return false;
  }
  return true;
}

function parseLiveModeArg(argv: string[]): CmpRoleLiveLlmMode {
  if (argv.includes("--strict-live")) {
    return "llm_required";
  }
  return "llm_assisted";
}

function parsePromptVariantArg(argv: string[]): CmpFiveAgentPromptVariant {
  const entry = argv.find((item) => item.startsWith("--prompt-variant="));
  const value = entry?.slice("--prompt-variant=".length) ?? "baseline";
  if (value === "baseline" || value === "lean_v2" || value === "workflow_v3" || value === "workmode_v4" || value === "workmode_v5" || value === "workmode_v6" || value === "workmode_v7" || value === "workmode_v8") {
    return value;
  }
  throw new Error(`Unsupported cmp five-agent prompt variant: ${value}`);
}

function formatError(error: unknown): { summary: string; details: Record<string, unknown> } {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      summary: String(record.message ?? "Unknown error"),
      details: {
        name: record.name ?? null,
        status: record.status ?? null,
        code: record.code ?? null,
      },
    };
  }

  return {
    summary: String(error),
    details: {},
  };
}

function printRows(rows: SmokeRow[]): void {
  for (const row of rows) {
    const prefix = row.ok ? "OK" : "FAIL";
    console.log(`[${prefix}] ${row.provider} ${row.role}: ${row.summary}`);
  }
}

async function writeReport(reportPath: string, provider: ProviderTarget, rows: SmokeRow[], baseURL: string): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider,
        baseURL,
        rows,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function retryFallbackRow(fn: () => Promise<SmokeRow>): Promise<SmokeRow> {
  let latest = await fn();
  let firstStatus = latest.status;

  for (let attempt = 1; attempt < 4; attempt += 1) {
    if (latest.ok || latest.status !== "fallback_rules") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    latest = await fn();
  }

  return {
    ...latest,
    details: {
      ...(latest.details ?? {}),
      retriedAfterFallback: firstStatus === "fallback_rules",
      firstAttemptStatus: firstStatus,
    },
  };
}

async function maybeRetryFallbackRow(
  fn: () => Promise<SmokeRow>,
  options: { retryFallback: boolean },
): Promise<SmokeRow> {
  if (!options.retryFallback) {
    return fn();
  }
  return retryFallbackRow(fn);
}

async function withElapsed<T extends SmokeRow>(
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const row = await fn();
    return {
      ...row,
      details: {
        ...(row.details ?? {}),
        elapsedMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    throw error;
  }
}

async function smokeOpenAI(cli: SmokeCliOptions): Promise<{ rows: SmokeRow[]; baseURL: string }> {
  const rows: SmokeRow[] = [];
  const config = loadOpenAILiveConfig();
  const runtime = createCmpFiveAgentRuntime({
    configuration: createCmpFiveAgentConfiguration({
      promptVariant: cli.promptVariant,
    }),
  });
  const executor = createCmpRoleLiveLlmModelExecutor({
    provider: "openai",
    model: config.model,
    layer: "api",
    variant: "responses",
  });
  const { roleTarget, flowTarget, retryFallback, liveMode } = cli;

  if (roleTarget === "all" || roleTarget === "icma") {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.captureIcmaWithLlm({
        ingest: {
          agentId: "cmp-live-main",
          sessionId: "cmp-live-session",
          taskSummary: "请保留当前任务最有用的上下文，并生成 operator guide 与 child guide。",
          materials: [
            { kind: "user_input", ref: "payload:cmp-live:user:1" },
            { kind: "tool_result", ref: "payload:cmp-live:tool:1" },
          ],
          lineage: {
            agentId: "cmp-live-main",
            projectId: "cmp-live-project",
            depth: 0,
            status: "active",
            branchFamily: createCmpBranchFamily({
              workBranch: "work/cmp-live-main",
              cmpBranch: "cmp/cmp-live-main",
              mpBranch: "mp/cmp-live-main",
              tapBranch: "tap/cmp-live-main",
            }),
          },
        },
        createdAt: "2026-03-31T00:00:00.000Z",
        loopId: "cmp-live-icma-1",
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "icma",
        ok: result.loop.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.loop.liveTrace?.mode,
        status: result.loop.liveTrace?.status,
        summary: result.loop.structuredOutput.intent,
        details: {
          sourceAnchorRefs: result.loop.structuredOutput.sourceAnchorRefs,
          chunkingMode: result.loop.structuredOutput.chunkingMode,
          autoFragmentPolicy: result.loop.structuredOutput.autoFragmentPolicy,
          intentChunks: result.loop.structuredOutput.intentChunks,
          operatorGuide: result.loop.structuredOutput.guide.operatorGuide,
          childGuide: result.loop.structuredOutput.guide.childGuide,
          errorMessage: result.loop.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "icma",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if (roleTarget === "all" || roleTarget === "iterator") {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.advanceIteratorWithLlm({
        agentId: "cmp-live-main",
        deltaId: "delta-cmp-live-1",
        candidateId: "candidate-cmp-live-1",
        branchRef: "refs/heads/cmp/cmp-live-main",
        commitRef: "commit-cmp-live-1",
        reviewRef: "refs/cmp/review/candidate-cmp-live-1",
        createdAt: "2026-03-31T00:00:01.000Z",
        metadata: {
          sourceSectionIds: ["section-pre-live-1", "section-pre-live-2"],
        },
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "iterator",
        ok: result.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.liveTrace?.mode,
        status: result.liveTrace?.status,
        summary: result.reviewOutput.commitRationale ?? "iterator live rationale missing",
        details: {
          sourceSectionIds: result.reviewOutput.sourceSectionIds,
          progressionVerdict: result.reviewOutput.progressionVerdict,
          reviewRefAnnotation: result.reviewOutput.reviewRefAnnotation,
          reviewRef: result.reviewRef,
          errorMessage: result.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "iterator",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if (roleTarget === "all" || roleTarget === "checker") {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.evaluateCheckerWithLlm({
        agentId: "cmp-live-main",
        candidateId: "candidate-cmp-live-1",
        checkedSnapshotId: "snapshot-cmp-live-1",
        checkedAt: "2026-03-31T00:00:02.000Z",
        suggestPromote: true,
        parentAgentId: "cmp-live-parent",
        metadata: {
          sourceSectionIds: ["section-pre-live-1", "section-pre-live-2"],
          checkedSectionIds: ["section-checked-live-1"],
        },
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "checker",
        ok: result.checkerRecord.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.checkerRecord.liveTrace?.mode,
        status: result.checkerRecord.liveTrace?.status,
        summary: result.checkerRecord.reviewOutput.trimSummary,
        details: {
          shortReason: result.checkerRecord.reviewOutput.shortReason,
          splitExecutions: result.checkerRecord.reviewOutput.splitExecutions,
          mergeExecutions: result.checkerRecord.reviewOutput.mergeExecutions,
          promoteRationale: result.checkerRecord.reviewOutput.promoteRationale,
          errorMessage: result.checkerRecord.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "checker",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if ((roleTarget === "all" || roleTarget === "dbagent") && (flowTarget === "active" || flowTarget === "both")) {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.materializeDbAgentWithLlm({
        checkedSnapshot: createCheckedSnapshot({
          snapshotId: "snapshot-cmp-live-1",
          agentId: "cmp-live-main",
          lineageRef: "cmp-live-project:cmp-live-main",
          branchRef: "refs/heads/cmp/cmp-live-main",
          commitRef: "commit-cmp-live-1",
          checkedAt: "2026-03-31T00:00:03.000Z",
        }),
        projectionId: "projection-cmp-live-1",
        contextPackage: createContextPackage({
          packageId: "package-cmp-live-1",
          sourceProjectionId: "projection-cmp-live-1",
          targetAgentId: "cmp-live-main",
          packageKind: "active_reseed",
          packageRef: "cmp-package:snapshot-cmp-live-1:main:active",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:00:03.000Z",
        }),
        createdAt: "2026-03-31T00:00:03.000Z",
        loopId: "dbagent-cmp-live-1",
        metadata: {
          sourceRequestId: "request-cmp-live-1",
          sourceSectionIds: ["section-checked-live-1"],
        },
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "dbagent",
        flow: "active",
        ok: result.loop.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.loop.liveTrace?.mode,
        status: result.loop.liveTrace?.status,
        summary: result.loop.materializationOutput.materializationRationale ?? "dbagent rationale missing",
        details: {
          packageTopology: result.loop.materializationOutput.packageTopology,
          bundleSchemaVersion: result.loop.materializationOutput.bundleSchemaVersion,
          primaryPackageStrategy: result.loop.materializationOutput.primaryPackageStrategy,
          timelinePackageStrategy: result.loop.materializationOutput.timelinePackageStrategy,
          taskSnapshotStrategy: result.loop.materializationOutput.taskSnapshotStrategy,
          errorMessage: result.loop.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "dbagent",
        flow: "active",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if ((roleTarget === "all" || roleTarget === "dispatcher") && (flowTarget === "active" || flowTarget === "both")) {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.dispatchDispatcherWithLlm({
        contextPackage: createContextPackage({
          packageId: "package-cmp-live-dispatch",
          sourceProjectionId: "projection-cmp-live-1",
          targetAgentId: "cmp-live-child",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-cmp-live-1:child:seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:00:04.000Z",
        }),
        dispatch: {
          agentId: "cmp-live-main",
          packageId: "package-cmp-live-dispatch",
          sourceAgentId: "cmp-live-main",
          targetAgentId: "cmp-live-child",
          targetKind: "child",
          metadata: {
            sourceRequestId: "request-cmp-live-dispatch",
            sourceSnapshotId: "snapshot-cmp-live-1",
          },
        },
        receipt: createDispatchReceipt({
          dispatchId: "dispatch-cmp-live-1",
          packageId: "package-cmp-live-dispatch",
          sourceAgentId: "cmp-live-main",
          targetAgentId: "cmp-live-child",
          status: "delivered",
          deliveredAt: "2026-03-31T00:00:04.000Z",
        }),
        createdAt: "2026-03-31T00:00:04.000Z",
        loopId: "dispatcher-cmp-live-1",
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "dispatcher",
        flow: "active",
        ok: result.loop.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.loop.liveTrace?.mode,
        status: result.loop.liveTrace?.status,
        summary: result.loop.bundle.governance.routeRationale ?? "dispatcher rationale missing",
        details: {
          targetIngress: result.loop.bundle.target.targetIngress,
          packageMode: result.loop.packageMode,
          bodyStrategy: result.loop.bundle.body.bodyStrategy,
          scopePolicy: result.loop.bundle.governance.scopePolicy,
          errorMessage: result.loop.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "dispatcher",
        flow: "active",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }

    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.dispatchDispatcherWithLlm({
        contextPackage: createContextPackage({
          packageId: "package-cmp-live-peer",
          sourceProjectionId: "projection-cmp-live-1",
          targetAgentId: "cmp-live-peer-b",
          packageKind: "peer_exchange",
          packageRef: "cmp-package:snapshot-cmp-live-1:peer:exchange",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:00:04.500Z",
        }),
        dispatch: {
          agentId: "cmp-live-peer-a",
          packageId: "package-cmp-live-peer",
          sourceAgentId: "cmp-live-peer-a",
          targetAgentId: "cmp-live-peer-b",
          targetKind: "peer",
          metadata: {
            parentAgentId: "cmp-live-parent",
            currentStateSummary: "peer exchange awaits explicit parent approval",
            sourceRequestId: "request-cmp-live-peer",
            sourceSnapshotId: "snapshot-cmp-live-1",
          },
        },
        receipt: createDispatchReceipt({
          dispatchId: "dispatch-cmp-live-peer-1",
          packageId: "package-cmp-live-peer",
          sourceAgentId: "cmp-live-peer-a",
          targetAgentId: "cmp-live-peer-b",
          status: "delivered",
          deliveredAt: "2026-03-31T00:00:04.500Z",
        }),
        createdAt: "2026-03-31T00:00:04.500Z",
        loopId: "dispatcher-cmp-live-peer-1",
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "dispatcher",
        flow: "active",
        ok: result.loop.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.loop.liveTrace?.mode,
        status: result.loop.liveTrace?.status,
        summary: `peer: ${result.loop.bundle.governance.routeRationale ?? "dispatcher peer rationale missing"}`,
        details: {
          targetIngress: result.loop.bundle.target.targetIngress,
          packageMode: result.loop.packageMode,
          bodyStrategy: result.loop.bundle.body.bodyStrategy,
          scopePolicy: result.loop.bundle.governance.scopePolicy,
          approvalStatus: result.peerApproval?.status,
          approvalChain: result.peerApproval?.approvalChain,
          errorMessage: result.loop.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "dispatcher",
        flow: "active",
        ok: false,
        model: config.model,
        summary: `peer: ${formatted.summary}`,
        details: formatted.details,
      });
    }
  }

  if ((roleTarget === "all" || roleTarget === "dbagent") && (flowTarget === "passive" || flowTarget === "both")) {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.servePassiveDbAgentWithLlm({
        request: {
          requesterAgentId: "cmp-live-main",
          projectId: "cmp-live-project",
          reason: "need historical context",
          query: {
            snapshotId: "snapshot-cmp-live-passive-1",
          },
        },
        snapshot: createCheckedSnapshot({
          snapshotId: "snapshot-cmp-live-passive-1",
          agentId: "cmp-live-main",
          lineageRef: "cmp-live-project:cmp-live-main",
          branchRef: "refs/heads/cmp/cmp-live-main",
          commitRef: "commit-cmp-live-passive-1",
          checkedAt: "2026-03-31T00:00:05.000Z",
        }),
        contextPackage: createContextPackage({
          packageId: "package-cmp-live-passive",
          sourceProjectionId: "projection-cmp-live-passive-1",
          targetAgentId: "cmp-live-main",
          packageKind: "historical_reply",
          packageRef: "cmp-package:snapshot-cmp-live-passive-1:main:historical_reply",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:00:05.000Z",
        }),
        createdAt: "2026-03-31T00:00:05.000Z",
        loopId: "dbagent-cmp-live-passive-1",
        metadata: {
          sourceRequestId: "request-cmp-live-passive-1",
          sourceSectionIds: ["section-passive-live-1"],
        },
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "dbagent",
        flow: "passive",
        ok: result.loop.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.loop.liveTrace?.mode,
        status: result.loop.liveTrace?.status,
        summary: `passive: ${result.loop.materializationOutput.materializationRationale ?? "dbagent passive rationale missing"}`,
        details: {
          flow: "passive",
          packageTopology: result.loop.materializationOutput.packageTopology,
          bundleSchemaVersion: result.loop.materializationOutput.bundleSchemaVersion,
          passivePackagingStrategy: result.loop.materializationOutput.passivePackagingStrategy,
          errorMessage: result.loop.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "dbagent",
        flow: "passive",
        ok: false,
        model: config.model,
        summary: `passive: ${formatted.summary}`,
        details: {
          flow: "passive",
          ...formatted.details,
        },
      });
    }
  }

  if ((roleTarget === "all" || roleTarget === "dispatcher") && (flowTarget === "passive" || flowTarget === "both")) {
    try {
      rows.push(await maybeRetryFallbackRow(() => withElapsed(async () => {
      const result = await runtime.deliverDispatcherPassiveReturnWithLlm({
        request: {
          requesterAgentId: "cmp-live-main",
          projectId: "cmp-live-project",
          reason: "need historical context",
          query: {
            snapshotId: "snapshot-cmp-live-passive-1",
          },
        },
        contextPackage: createContextPackage({
          packageId: "package-cmp-live-passive",
          sourceProjectionId: "projection-cmp-live-passive-1",
          targetAgentId: "cmp-live-main",
          packageKind: "historical_reply",
          packageRef: "cmp-package:snapshot-cmp-live-passive-1:main:historical_reply",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-31T00:00:06.000Z",
        }),
        createdAt: "2026-03-31T00:00:06.000Z",
        loopId: "dispatcher-cmp-live-passive-1",
      }, {
        mode: liveMode,
        executor,
      });
      return {
        provider: "openai",
        role: "dispatcher",
        flow: "passive",
        ok: result.liveTrace?.status === "live_applied",
        model: config.model,
        mode: result.liveTrace?.mode,
        status: result.liveTrace?.status,
        summary: `passive: ${result.bundle.governance.routeRationale ?? "dispatcher passive rationale missing"}`,
        details: {
          flow: "passive",
          targetIngress: result.bundle.target.targetIngress,
          packageMode: result.packageMode,
          bodyStrategy: result.bundle.body.bodyStrategy,
          scopePolicy: result.bundle.governance.scopePolicy,
          errorMessage: result.liveTrace?.errorMessage,
        },
      };
      }), { retryFallback }));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider: "openai",
        role: "dispatcher",
        flow: "passive",
        ok: false,
        model: config.model,
        summary: `passive: ${formatted.summary}`,
        details: {
          flow: "passive",
          ...formatted.details,
        },
      });
    }
  }

  return {
    rows,
    baseURL: config.baseURL,
  };
}

async function main(argv: string[]): Promise<void> {
  const provider = parseProviderArg(argv);
  const cli: SmokeCliOptions = {
    roleTarget: parseRoleArg(argv),
    flowTarget: parseFlowArg(argv),
    retryFallback: parseRetryFallbackArg(argv),
    liveMode: parseLiveModeArg(argv),
    promptVariant: parsePromptVariantArg(argv),
  };
  const reportPath = parseReportPathArg(argv, provider);
  const { rows, baseURL } = await smokeOpenAI(cli);
  printRows(rows);
  await writeReport(reportPath, provider, rows, baseURL);
  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    provider,
    roleTarget: cli.roleTarget,
    flowTarget: cli.flowTarget,
    retryFallback: cli.retryFallback,
    liveMode: cli.liveMode,
    promptVariant: cli.promptVariant,
    baseURL,
    model: rows[0]?.model ?? "unknown",
    rows,
  }, null, 2)}\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const formatted = formatError(error);
  process.stderr.write(`${formatted.summary}\n`);
  process.exitCode = 1;
});
