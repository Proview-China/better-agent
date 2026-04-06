import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createCmpRoleLiveLlmModelExecutor,
} from "./cmp-five-agent/index.js";
import {
  executeModelInference,
} from "./integrations/model-inference.js";
import {
  registerFirstClassToolingBaselineCapabilities,
} from "./integrations/workspace-read-adapter.js";
import {
  createGoalSource,
} from "./goal/index.js";
import {
  createAgentCapabilityProfile,
  createProvisionRequest,
} from "./index.js";
import {
  createAgentLineage,
  createCmpBranchFamily,
} from "./cmp-types/index.js";
import { createToolReviewGovernanceTrace } from "./ta-pool-tool-review/index.js";
import { createAgentCoreRuntime } from "./runtime.js";
import { loadOpenAILiveConfig } from "../rax/live-config.js";

type ProviderTarget = "openai";
type SmokeLane = "core" | "tap" | "cmp-bridge" | "cmp-live";
type SmokeLaneTarget = SmokeLane | "all";

interface SmokeRow {
  provider: ProviderTarget;
  lane: SmokeLane;
  ok: boolean;
  model: string;
  summary: string;
  details?: Record<string, unknown>;
}

function parseProviderArg(argv: string[]): ProviderTarget {
  const entry = argv.find((item) => item.startsWith("--provider="));
  const value = entry?.slice("--provider=".length) ?? "openai";
  if (value === "openai") {
    return value;
  }
  throw new Error(`Unsupported single-agent smoke provider: ${value}`);
}

function parseLaneArg(argv: string[]): SmokeLaneTarget {
  const entry = argv.find((item) => item.startsWith("--lane="));
  const value = entry?.slice("--lane=".length) ?? "all";
  if (
    value === "all"
    || value === "core"
    || value === "tap"
    || value === "cmp-bridge"
    || value === "cmp-live"
  ) {
    return value;
  }
  throw new Error(`Unsupported single-agent smoke lane: ${value}`);
}

function parseReportPathArg(argv: string[], provider: ProviderTarget): string {
  const entry = argv.find((item) => item.startsWith("--report="));
  if (entry) {
    return entry.slice("--report=".length);
  }
  return resolve(
    process.cwd(),
    "memory/live-reports",
    `single-agent-live-smoke.${provider}.json`,
  );
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
    console.log(`[${prefix}] ${row.provider} ${row.lane}: ${row.summary}`);
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

async function smokeCoreViaTap(config: ReturnType<typeof loadOpenAILiveConfig>): Promise<SmokeRow> {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.live-smoke.single-agent.core",
      agentClass: "main-agent",
      baselineCapabilities: ["model.infer"],
      defaultMode: "permissive",
    }),
    modelInferenceExecutor: executeModelInference,
  });

  const session = runtime.createSession();
  const result = await runtime.runUntilTerminal({
    sessionId: session.sessionId,
    source: createGoalSource({
      goalId: "goal-live-smoke-single-agent-core",
      sessionId: session.sessionId,
      userInput: "请用一句中文确认 Praxis core TAP single-agent live smoke 已通过，并且包含单词 PASS。",
      metadata: {
        provider: "openai",
        model: config.model,
      },
    }),
    maxSteps: 2,
  });

  const answer = result.answer ?? "";
  const capabilityResult = result.finalEvents
    .map((entry) => entry.event)
    .find((event) => event.type === "capability.result_received");
  const capabilityResultStatus = capabilityResult?.type === "capability.result_received"
    ? capabilityResult.payload.status
    : undefined;
  const summary = answer.trim()
    || (capabilityResultStatus === "failed"
      ? "core live smoke reached model.infer through TAP, but the upstream model route returned failed."
      : "core live smoke returned an empty answer");

  return {
    provider: "openai",
    lane: "core",
    ok:
      result.outcome.run.status === "completed"
      && result.capabilityDispatch?.status === "dispatched"
      && /PASS/i.test(answer),
    model: config.model,
    summary,
    details: {
      runStatus: result.outcome.run.status,
      dispatchStatus: result.capabilityDispatch?.status,
      capabilityKey: result.capabilityDispatch?.dispatch?.prepared.capabilityKey,
      capabilityResultStatus,
    },
  };
}

async function smokeTapThreeAgentWorkers(config: ReturnType<typeof loadOpenAILiveConfig>): Promise<SmokeRow> {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.live-smoke.single-agent.tap",
      agentClass: "main-agent",
      defaultMode: "permissive",
    }),
    modelInferenceExecutor: executeModelInference,
  });

  const reviewerDecision = await runtime.reviewerRuntime?.submit({
    request: {
      requestId: "req-live-smoke-tap-reviewer",
      sessionId: "session-live-smoke-tap-reviewer",
      runId: "run-live-smoke-tap-reviewer",
      agentId: "agent-live-smoke-tap-reviewer",
      requestedCapabilityKey: "docs.read",
      requestedTier: "B0",
      reason: "Need a minimal TAP reviewer live smoke.",
      mode: "permissive",
      canonicalMode: "permissive",
      createdAt: "2026-04-06T00:00:00.000Z",
    },
    profile: createAgentCapabilityProfile({
      profileId: "profile.live-smoke.single-agent.tap-reviewer",
      agentClass: "main-agent",
      defaultMode: "permissive",
      baselineCapabilities: ["docs.read"],
    }),
    inventory: {
      availableCapabilityKeys: ["docs.read"],
    },
  });

  const toolReview = await runtime.toolReviewerRuntime?.submit({
    governanceAction: {
      kind: "lifecycle",
      trace: createToolReviewGovernanceTrace({
        actionId: "tool-review-live-smoke-register-docs-read",
        actorId: "tool-reviewer",
        reason: "Need a minimal TAP tool reviewer live smoke.",
        createdAt: "2026-04-06T00:00:01.000Z",
      }),
      capabilityKey: "docs.read",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
    },
  });

  const provisionBundle = await runtime.provisionerRuntime?.submit(createProvisionRequest({
    provisionId: "provision-live-smoke-tap-docs-read",
    sourceRequestId: "req-live-smoke-tap-reviewer",
    requestedCapabilityKey: "docs.read",
    reason: "Need a minimal TAP provisioner live smoke.",
    createdAt: "2026-04-06T00:00:02.000Z",
  }));

  const reviewerReason = reviewerDecision?.reason?.trim();
  const toolReviewSummary = toolReview?.output?.summary?.trim();
  const buildSummary = typeof provisionBundle?.metadata?.buildSummary === "string"
    ? provisionBundle.metadata.buildSummary.trim()
    : undefined;

  return {
    provider: "openai",
    lane: "tap",
    ok: Boolean(reviewerReason && toolReviewSummary && buildSummary),
    model: config.model,
    summary: [
      `reviewer=${reviewerReason ?? "missing"}`,
      `toolReviewer=${toolReviewSummary ?? "missing"}`,
      `tma=${buildSummary ?? "missing"}`,
    ].join(" | "),
    details: {
      reviewerVote: reviewerDecision?.vote,
      toolReviewerLifecycleAction: toolReview?.governanceKind,
      provisionBundleStatus: provisionBundle?.status,
      replayRecommendation: provisionBundle?.metadata?.replayRecommendation,
    },
  };
}

async function smokeCmpTapBridge(config: ReturnType<typeof loadOpenAILiveConfig>): Promise<SmokeRow> {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.live-smoke.single-agent.cmp-bridge",
      agentClass: "main-agent",
      baselineCapabilities: ["docs.read"],
      defaultMode: "permissive",
    }),
    modelInferenceExecutor: executeModelInference,
  });
  registerFirstClassToolingBaselineCapabilities({
    runtime,
    workspaceRoot: process.cwd(),
  });

  const session = runtime.createSession();
  const created = await runtime.createRunFromSource({
    sessionId: session.sessionId,
    source: createGoalSource({
      goalId: "goal-live-smoke-cmp-tap-bridge",
      sessionId: session.sessionId,
      userInput: "Run CMP role capability dispatch through TAP.",
    }),
  });

  const dispatch = await runtime.dispatchCmpFiveAgentCapability({
    role: "icma",
    sessionId: session.sessionId,
    runId: created.run.runId,
    agentId: "cmp-live-smoke-icma",
    capabilityKey: "docs.read",
    reason: "Single-agent smoke should verify CMP role access can dispatch through TAP.",
    capabilityInput: {
      path: "README.md",
      operation: "read_file",
    },
    priority: "normal",
    requestedTier: "B0",
    mode: "standard",
  });

  return {
    provider: "openai",
    lane: "cmp-bridge",
    ok:
      dispatch.dispatch.status === "dispatched"
      && dispatch.dispatch.grant?.capabilityKey === "docs.read",
    model: config.model,
    summary: `dispatch=${dispatch.dispatch.status} capability=${dispatch.dispatch.grant?.capabilityKey ?? "missing"}`,
    details: {
      tapProfileId: dispatch.profile.profileId,
      bridgeMetadata: dispatch.bridgeMetadata,
      reviewDecisionId: dispatch.dispatch.reviewDecision?.decisionId,
      provisionId: dispatch.dispatch.provisionRequest?.provisionId,
    },
  };
}

async function smokeCmpLiveLoop(config: ReturnType<typeof loadOpenAILiveConfig>): Promise<SmokeRow> {
  const runtime = createAgentCoreRuntime();
  const executor = createCmpRoleLiveLlmModelExecutor({
    provider: "openai",
    model: config.model,
    layer: "api",
    variant: "responses",
  });

  const result = await runtime.runCmpFiveAgentActiveLiveLoop({
    icma: {
      input: {
        ingest: {
          agentId: "cmp-single-live-main",
          sessionId: "cmp-single-live-session",
          taskSummary: "请保留当前任务的高价值上下文，并生成 operator guide 与 child guide。",
          materials: [{ kind: "user_input", ref: "payload:cmp-single-live:user" }],
          lineage: createAgentLineage({
            agentId: "cmp-single-live-main",
            depth: 0,
            projectId: "cmp-single-live-project",
            branchFamily: createCmpBranchFamily({
              workBranch: "work/cmp-single-live-main",
              cmpBranch: "cmp/cmp-single-live-main",
              mpBranch: "mp/cmp-single-live-main",
              tapBranch: "tap/cmp-single-live-main",
            }),
          }),
        },
        createdAt: "2026-04-06T00:10:00.000Z",
        loopId: "cmp-single-live-icma",
      },
      options: {
        mode: "llm_assisted",
        executor,
      },
    },
    iterator: {
      input: {
        agentId: "cmp-single-live-main",
        deltaId: "cmp-single-live-delta",
        candidateId: "cmp-single-live-candidate",
        branchRef: "refs/heads/cmp/cmp-single-live-main",
        commitRef: "cmp-single-live-commit",
        reviewRef: "refs/cmp/review/cmp-single-live-candidate",
        createdAt: "2026-04-06T00:10:01.000Z",
        metadata: {
          sourceSectionIds: ["section-pre-cmp-single-live"],
        },
      },
      options: {
        mode: "llm_assisted",
        executor,
      },
    },
    checker: {
      input: {
        agentId: "cmp-single-live-main",
        candidateId: "cmp-single-live-candidate",
        checkedSnapshotId: "cmp-single-live-snapshot",
        checkedAt: "2026-04-06T00:10:02.000Z",
        suggestPromote: false,
        metadata: {
          sourceSectionIds: ["section-pre-cmp-single-live"],
          checkedSectionIds: ["section-checked-cmp-single-live"],
        },
      },
      options: {
        mode: "llm_assisted",
        executor,
      },
    },
    dbagent: {
      input: {
        checkedSnapshot: {
          snapshotId: "cmp-single-live-snapshot",
          agentId: "cmp-single-live-main",
          lineageRef: "lineage:cmp-single-live-main",
          branchRef: "refs/heads/cmp/cmp-single-live-main",
          commitRef: "cmp-single-live-commit",
          checkedAt: "2026-04-06T00:10:03.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
        projectionId: "cmp-single-live-projection",
        contextPackage: {
          packageId: "cmp-single-live-package",
          sourceProjectionId: "cmp-single-live-projection",
          targetAgentId: "child-cmp-single-live",
          packageKind: "child_seed",
          packageRef: "cmp-package:cmp-single-live-snapshot:child-cmp-single-live:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-04-06T00:10:03.000Z",
        },
        createdAt: "2026-04-06T00:10:03.000Z",
        loopId: "cmp-single-live-dbagent",
        metadata: {
          sourceRequestId: "cmp-single-live-request",
          sourceSectionIds: ["section-checked-cmp-single-live"],
        },
      },
      options: {
        mode: "llm_assisted",
        executor,
      },
    },
    dispatcher: {
      input: {
        contextPackage: {
          packageId: "cmp-single-live-package",
          sourceProjectionId: "cmp-single-live-projection",
          targetAgentId: "child-cmp-single-live",
          packageKind: "child_seed",
          packageRef: "cmp-package:cmp-single-live-snapshot:child-cmp-single-live:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-04-06T00:10:04.000Z",
        },
        dispatch: {
          agentId: "cmp-single-live-main",
          packageId: "cmp-single-live-package",
          sourceAgentId: "cmp-single-live-main",
          targetAgentId: "child-cmp-single-live",
          targetKind: "child",
          metadata: {
            sourceRequestId: "cmp-single-live-request",
            sourceSnapshotId: "cmp-single-live-snapshot",
          },
        },
        receipt: {
          dispatchId: "cmp-single-live-dispatch",
          packageId: "cmp-single-live-package",
          sourceAgentId: "cmp-single-live-main",
          targetAgentId: "child-cmp-single-live",
          status: "delivered",
          deliveredAt: "2026-04-06T00:10:04.000Z",
        },
        createdAt: "2026-04-06T00:10:04.000Z",
        loopId: "cmp-single-live-dispatcher",
      },
      options: {
        mode: "llm_assisted",
        executor,
      },
    },
  });

  return {
    provider: "openai",
    lane: "cmp-live",
    ok:
      result.icma.loop.liveTrace?.status === "live_applied"
      && result.iterator.liveTrace?.status === "live_applied"
      && result.checker.checkerRecord.liveTrace?.status === "live_applied"
      && result.dbagent.loop.liveTrace?.status === "live_applied"
      && result.dispatcher.loop.liveTrace?.status === "live_applied",
    model: config.model,
    summary:
      result.summary.live.icma.status === "succeeded"
      && result.summary.live.dispatcher.status === "succeeded"
        ? result.icma.loop.structuredOutput.intent
        : `cmp live loop fell back before full live application: icma=${result.summary.live.icma.status}, dispatcher=${result.summary.live.dispatcher.status}`,
    details: {
      icmaLiveStatus: result.summary.live.icma.status,
      iteratorLiveStatus: result.summary.live.iterator.status,
      checkerLiveStatus: result.summary.live.checker.status,
      dbagentLiveStatus: result.summary.live.dbagent.status,
      dispatcherLiveStatus: result.summary.live.dispatcher.status,
      operatorGuide: result.icma.loop.structuredOutput.guide.operatorGuide,
      checkerReason: result.checker.checkerRecord.reviewOutput.shortReason,
      dispatcherRouteRationale: result.dispatcher.loop.bundle.governance.routeRationale,
    },
  };
}

async function main(): Promise<void> {
  const provider = parseProviderArg(process.argv.slice(2));
  const laneTarget = parseLaneArg(process.argv.slice(2));
  const reportPath = parseReportPathArg(process.argv.slice(2), provider);
  const config = loadOpenAILiveConfig();
  const rows: SmokeRow[] = [];

  if (laneTarget === "all" || laneTarget === "core") {
    try {
      rows.push(await smokeCoreViaTap(config));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider,
        lane: "core",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if (laneTarget === "all" || laneTarget === "tap") {
    try {
      rows.push(await smokeTapThreeAgentWorkers(config));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider,
        lane: "tap",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if (laneTarget === "all" || laneTarget === "cmp-bridge") {
    try {
      rows.push(await smokeCmpTapBridge(config));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider,
        lane: "cmp-bridge",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  if (laneTarget === "all" || laneTarget === "cmp-live") {
    try {
      rows.push(await smokeCmpLiveLoop(config));
    } catch (error) {
      const formatted = formatError(error);
      rows.push({
        provider,
        lane: "cmp-live",
        ok: false,
        model: config.model,
        summary: formatted.summary,
        details: formatted.details,
      });
    }
  }

  printRows(rows);
  await writeReport(reportPath, provider, rows, config.baseURL);
  console.error(`single-agent live smoke report written to ${reportPath}`);

  if (rows.some((row) => !row.ok)) {
    process.exitCode = 1;
  }
}

await main();
