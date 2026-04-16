import {
  createAgentLineage,
  createCmpBranchFamily,
} from "../index.js";
import {
  truncate,
  withStopwatch,
  type CmpTurnArtifacts,
  type DialogueTurn,
  type LiveCliRuntime,
  type LiveChatLogger,
} from "./shared.js";

const LIVE_CMP_PROJECT_ID = "praxis-live-cli";
const LIVE_CMP_AGENT_ID = "cmp-live-cli-main";
const LIVE_CMP_TARGET_AGENT_ID = "core-live-cli";

function readCmpMetadataRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function readCmpMetadataString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function deriveCmpTurnArtifacts(input: {
  syncStatus: CmpTurnArtifacts["syncStatus"];
  summary: CmpTurnArtifacts["summary"];
  agentId: string;
  projectionId?: string;
  snapshotId?: string;
  packageId?: string;
  packageRef?: string;
  packageKind?: string;
  fidelityLabel?: string;
  failureReason?: string;
}): CmpTurnArtifacts {
  const icmaMetadata = readCmpMetadataRecord(input.summary.latestRoleMetadata.icma);
  const icmaStructuredOutput = readCmpMetadataRecord(icmaMetadata?.structuredOutput);
  const icmaGuide = readCmpMetadataRecord(icmaStructuredOutput?.guide);
  const checkerMetadata = readCmpMetadataRecord(input.summary.latestRoleMetadata.checker);
  const checkerReviewOutput = readCmpMetadataRecord(checkerMetadata?.reviewOutput);
  const dbagentMetadata = readCmpMetadataRecord(input.summary.latestRoleMetadata.dbagent);
  const materializationOutput = readCmpMetadataRecord(dbagentMetadata?.materializationOutput);
  const dispatcherMetadata = readCmpMetadataRecord(input.summary.latestRoleMetadata.dispatcher);
  const dispatcherBundle = readCmpMetadataRecord(dispatcherMetadata?.bundle);
  const dispatcherGovernance = readCmpMetadataRecord(dispatcherBundle?.governance);

  return {
    syncStatus: input.syncStatus,
    agentId: input.agentId,
    packageId: input.packageId ?? "pending",
    packageRef: input.packageRef ?? "pending",
    packageKind: input.packageKind ?? "active_reseed",
    packageMode: readCmpMetadataString(dispatcherBundle, "packageMode") ?? input.syncStatus,
    fidelityLabel: input.fidelityLabel ?? "checked_high_fidelity",
    projectionId: input.projectionId ?? "pending",
    snapshotId: input.snapshotId ?? "pending",
    summary: input.summary,
    intent: readCmpMetadataString(icmaStructuredOutput, "intent")
      ?? (input.syncStatus === "failed"
        ? "cmp runtime sync failed"
        : "cmp runtime sync pending"),
    operatorGuide: readCmpMetadataString(icmaGuide, "operatorGuide") ?? "missing",
    childGuide: readCmpMetadataString(icmaGuide, "childGuide") ?? "missing",
    checkerReason: readCmpMetadataString(checkerReviewOutput, "shortReason") ?? "missing",
    routeRationale: readCmpMetadataString(dispatcherGovernance, "routeRationale") ?? "missing",
    scopePolicy: readCmpMetadataString(dispatcherGovernance, "scopePolicy") ?? "missing",
    packageStrategy: readCmpMetadataString(materializationOutput, "primaryPackageStrategy") ?? "missing",
    timelineStrategy: readCmpMetadataString(materializationOutput, "timelinePackageStrategy") ?? "missing",
    failureReason: input.failureReason,
  };
}

async function runLoggedCmpStage<T>(input: {
  logger: LiveChatLogger;
  turnIndex: number;
  uiMode: "full" | "direct";
  stage: "cmp/icma" | "cmp/iterator" | "cmp/checker" | "cmp/dbagent" | "cmp/dispatcher";
  label: string;
  run: () => Promise<T> | T;
  onSuccess?: (value: T) => Record<string, unknown>;
}): Promise<T> {
  await input.logger.log("stage_start", {
    turnIndex: input.turnIndex,
    stage: input.stage,
  });
  try {
    const value = await withStopwatch(input.label, () => Promise.resolve(input.run()), {
      quiet: input.uiMode === "direct",
    });
    await input.logger.log("stage_end", {
      turnIndex: input.turnIndex,
      stage: input.stage,
      status: "success",
      ...(input.onSuccess?.(value) ?? {}),
    });
    return value;
  } catch (error) {
    await input.logger.log("stage_end", {
      turnIndex: input.turnIndex,
      stage: input.stage,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runCmpSidecarTurn(input: {
  runtime: LiveCliRuntime;
  sessionId: string;
  transcript: DialogueTurn[];
  turnIndex: number;
  uiMode: "full" | "direct";
  logger: LiveChatLogger;
  userMessage: string;
}): Promise<CmpTurnArtifacts> {
  const turnId = `${input.turnIndex}`;
  const agentId = LIVE_CMP_AGENT_ID;
  const transcriptWindow = input.transcript.slice(-6);
  const previousAssistant = [...input.transcript].reverse().find((turn) => turn.role === "assistant")?.text;
  let latestProjectionId: string | undefined;
  let latestSnapshotId: string | undefined;
  let latestPackageId: string | undefined;
  let latestPackageRef: string | undefined;
  let latestPackageKind: string | undefined;
  let latestFidelityLabel: string | undefined;

  try {
    const ingestResult = await runLoggedCmpStage({
      logger: input.logger,
      turnIndex: input.turnIndex,
      uiMode: input.uiMode,
      stage: "cmp/icma",
      label: `[turn ${input.turnIndex}] CMP/icma elapsed`,
      run: () => input.runtime.ingestRuntimeContext({
        agentId,
        sessionId: input.sessionId,
        taskSummary: `Prepare current executable context for the latest user request: ${truncate(input.userMessage, 160)}`,
        materials: [
          { kind: "user_input", ref: `turn:${turnId}:user` },
          ...(previousAssistant
            ? [{ kind: "assistant_output" as const, ref: `turn:${turnId}:assistant-prev` }]
            : []),
          ...(transcriptWindow.length > 1
            ? [{ kind: "system_prompt" as const, ref: `session:${input.sessionId}:history` }]
            : []),
        ],
        lineage: createAgentLineage({
          agentId,
          depth: 0,
          projectId: LIVE_CMP_PROJECT_ID,
          branchFamily: createCmpBranchFamily({
            workBranch: "work/praxis-live-cli",
            cmpBranch: "cmp/praxis-live-cli",
            mpBranch: "mp/praxis-live-cli",
            tapBranch: "tap/praxis-live-cli",
          }),
        }),
        metadata: {
          latestUserMessage: input.userMessage,
          previousAssistantMessage: previousAssistant,
          transcriptWindow,
          harness: "praxis-live-cli",
          cliTurnIndex: input.turnIndex,
          cliUiMode: input.uiMode,
        },
      }),
      onSuccess: () => {
        const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
        return {
          intent: deriveCmpTurnArtifacts({
            syncStatus: "ingested",
            summary,
            agentId,
          }).intent,
        };
      },
    });
    if (ingestResult.nextAction === "noop") {
      const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
      return deriveCmpTurnArtifacts({
        syncStatus: "ingested",
        summary,
        agentId,
      });
    }

    const commitResult = await runLoggedCmpStage({
      logger: input.logger,
      turnIndex: input.turnIndex,
      uiMode: input.uiMode,
      stage: "cmp/iterator",
      label: `[turn ${input.turnIndex}] CMP/iterator elapsed`,
      run: () => input.runtime.commitContextDelta({
        agentId,
        sessionId: input.sessionId,
        eventIds: ingestResult.acceptedEventIds,
        changeSummary: `Commit checked context for the latest user request: ${truncate(input.userMessage, 160)}`,
        syncIntent: "local_record",
        metadata: {
          latestUserMessage: input.userMessage,
          transcriptWindow,
          cliTurnIndex: input.turnIndex,
          cliUiMode: input.uiMode,
        },
      }),
      onSuccess: (value) => ({
        snapshotCandidateId: value.snapshotCandidateId ?? null,
      }),
    });

    const resolveResult = await runLoggedCmpStage({
      logger: input.logger,
      turnIndex: input.turnIndex,
      uiMode: input.uiMode,
      stage: "cmp/checker",
      label: `[turn ${input.turnIndex}] CMP/checker elapsed`,
      run: () => input.runtime.resolveCheckedSnapshot({
        agentId,
        projectId: LIVE_CMP_PROJECT_ID,
        metadata: {
          latestUserMessage: input.userMessage,
          snapshotCandidateId: commitResult.snapshotCandidateId,
          cliTurnIndex: input.turnIndex,
          cliUiMode: input.uiMode,
        },
      }),
      onSuccess: () => {
        const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
        return {
          shortReason: deriveCmpTurnArtifacts({
            syncStatus: "checked",
            summary,
            agentId,
          }).checkerReason,
        };
      },
    });
    if (!resolveResult.found || !resolveResult.snapshot) {
      throw new Error("CMP resolve_checked_snapshot returned not_found after commit_context_delta.");
    }
    latestSnapshotId = resolveResult.snapshot.snapshotId;

    const materializeResult = await runLoggedCmpStage({
      logger: input.logger,
      turnIndex: input.turnIndex,
      uiMode: input.uiMode,
      stage: "cmp/dbagent",
      label: `[turn ${input.turnIndex}] CMP/dbagent elapsed`,
      run: () => input.runtime.materializeContextPackage({
        agentId,
        snapshotId: resolveResult.snapshot!.snapshotId,
        targetAgentId: LIVE_CMP_TARGET_AGENT_ID,
        packageKind: "active_reseed",
        fidelityLabel: "checked_high_fidelity",
        metadata: {
          latestUserMessage: input.userMessage,
          transcriptWindow,
          cliTurnIndex: input.turnIndex,
          cliUiMode: input.uiMode,
        },
      }),
      onSuccess: () => {
        const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
        return {
          packageStrategy: deriveCmpTurnArtifacts({
            syncStatus: "materialized",
            summary,
            agentId,
          }).packageStrategy,
        };
      },
    });
    latestProjectionId = materializeResult.contextPackage.sourceProjectionId;
    latestPackageId = materializeResult.contextPackage.packageId;
    latestPackageRef = materializeResult.contextPackage.packageRef;
    latestPackageKind = materializeResult.contextPackage.packageKind;
    latestFidelityLabel = materializeResult.contextPackage.fidelityLabel;

    await runLoggedCmpStage({
      logger: input.logger,
      turnIndex: input.turnIndex,
      uiMode: input.uiMode,
      stage: "cmp/dispatcher",
      label: `[turn ${input.turnIndex}] CMP/dispatcher elapsed`,
      run: () => input.runtime.dispatchContextPackage({
        agentId,
        packageId: materializeResult.contextPackage.packageId,
        sourceAgentId: agentId,
        targetAgentId: LIVE_CMP_TARGET_AGENT_ID,
        targetKind: "core_agent",
        metadata: {
          latestUserMessage: input.userMessage,
          sourceSnapshotId: resolveResult.snapshot!.snapshotId,
          cliTurnIndex: input.turnIndex,
          cliUiMode: input.uiMode,
        },
      }),
      onSuccess: () => {
        const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
        const artifacts = deriveCmpTurnArtifacts({
          syncStatus: "synced",
          summary,
          agentId,
        });
        return {
          routeRationale: artifacts.routeRationale,
          scopePolicy: artifacts.scopePolicy,
        };
      },
    });

    const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
    return deriveCmpTurnArtifacts({
      syncStatus: "synced",
      summary,
      agentId,
      projectionId: latestProjectionId,
      snapshotId: latestSnapshotId,
      packageId: latestPackageId,
      packageRef: latestPackageRef,
      packageKind: latestPackageKind,
      fidelityLabel: latestFidelityLabel,
    });
  } catch (error) {
    const summary = input.runtime.getCmpFiveAgentRuntimeSummary(agentId);
    return deriveCmpTurnArtifacts({
      syncStatus: "failed",
      summary,
      agentId,
      projectionId: latestProjectionId,
      snapshotId: latestSnapshotId,
      packageId: latestPackageId,
      packageRef: latestPackageRef,
      packageKind: latestPackageKind,
      fidelityLabel: latestFidelityLabel,
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }
}
