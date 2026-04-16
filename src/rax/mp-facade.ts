import { randomUUID } from "node:crypto";

import type { MpFiveAgentSummary, MpMemoryRecord } from "../agent_core/index.js";
import { createRaxMpConfig, type RaxMpConfig } from "./mp-config.js";
import type {
  RaxMpAcceptanceReadiness,
  RaxMpAlignInput,
  RaxMpAlignResult,
  RaxMpArchiveInput,
  RaxMpBootstrapInput,
  RaxMpBootstrapResult,
  RaxMpCompactInput,
  RaxMpCreateInput,
  RaxMpFacade,
  RaxMpIngestInput,
  RaxMpIngestResult,
  RaxMpMaterializeBatchInput,
  RaxMpMaterializeFromCmpCandidatesInput,
  RaxMpMaterializeFromCmpCandidatesResult,
  RaxMpMaterializeInput,
  RaxMpMergeInput,
  RaxMpMergeResult,
  RaxMpPromoteInput,
  RaxMpReadbackInput,
  RaxMpReadbackResult,
  RaxMpRouteForCoreInput,
  RaxMpRouteForCoreResult,
  RaxMpRoutingReadback,
  RaxMpReindexInput,
  RaxMpRequestHistoryInput,
  RaxMpRequestHistoryResult,
  RaxMpResolveInput,
  RaxMpResolveResult,
  RaxMpRuntimeLike,
  RaxMpSearchInput,
  RaxMpSession,
  RaxMpSmokeInput,
  RaxMpSmokeResult,
  RaxMpSplitInput,
  RaxMpSplitResult,
  RaxMpStatusPanel,
} from "./mp-types.js";
import { createRaxMpRuntime } from "./mp-runtime.js";

export interface CreateRaxMpFacadeInput {
  runtimeFactory?: (config: RaxMpConfig) => RaxMpRuntimeLike;
  now?: () => Date;
  sessionIdFactory?: () => string;
}

function assertRuntime(runtime: RaxMpRuntimeLike | undefined): RaxMpRuntimeLike {
  if (!runtime) {
    throw new Error("RAX MP facade requires either input.runtime or a runtimeFactory.");
  }
  return runtime;
}

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  return values.reduce<Partial<Record<T, number>>>((summary, value) => {
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
}

function uniqueRouteTerms(values: Array<string | undefined>): string[] {
  return [...new Set(values
    .flatMap((value) => (typeof value === "string" ? value.split(/[\s|,.;:()\-_/]+/u) : []))
    .map((value) => value.trim())
    .filter(Boolean))];
}

function buildCoreRouteQuery(payload: RaxMpRouteForCoreInput["payload"]): string {
  const routeHints = [
    payload.routeHint === "history" ? "history" : undefined,
    payload.currentObjective,
    payload.governanceSignals?.cmpRouteRationale,
    payload.governanceSignals?.cmpScopePolicy,
    payload.governanceSignals?.freshnessHint,
    payload.governanceSignals?.confidenceHint,
    payload.queryText,
  ];
  return [...new Set(routeHints.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join(" ");
}

function freshnessScore(status: MpMemoryRecord["freshness"]["status"]): number {
  switch (status) {
    case "fresh":
      return 40;
    case "aging":
      return 24;
    case "stale":
      return 8;
    case "superseded":
      return -24;
  }
}

function confidenceScore(level: MpMemoryRecord["confidence"]): number {
  switch (level) {
    case "high":
      return 18;
    case "medium":
      return 10;
    case "low":
      return 2;
  }
}

function alignmentScore(status: MpMemoryRecord["alignment"]["alignmentStatus"]): number {
  switch (status) {
    case "aligned":
      return 10;
    case "unreviewed":
      return 3;
    case "drifted":
      return -8;
  }
}

function objectiveSignalScore(record: MpMemoryRecord, payload: RaxMpRouteForCoreInput["payload"]): number {
  const haystack = [
    record.semanticGroupId,
    record.bodyRef,
    ...(record.sourceRefs ?? []),
    ...(record.tags ?? []),
  ].join(" ").toLowerCase();
  const terms = uniqueRouteTerms([
    payload.currentObjective,
    payload.queryText,
    payload.governanceSignals?.cmpRouteRationale,
    payload.governanceSignals?.cmpScopePolicy,
  ]);
  return terms.reduce((score, term) => {
    const lowered = term.toLowerCase();
    return lowered.length > 0 && haystack.includes(lowered) ? score + 6 : score;
  }, 0);
}

function governancePreferenceScore(record: MpMemoryRecord, payload: RaxMpRouteForCoreInput["payload"]): number {
  let score = 0;
  if (payload.governanceSignals?.freshnessHint && record.freshness.status === payload.governanceSignals.freshnessHint) {
    score += 7;
  }
  if (payload.governanceSignals?.confidenceHint && record.confidence === payload.governanceSignals.confidenceHint) {
    score += 5;
  }
  return score;
}

function rerankRoutedRecords(
  records: MpMemoryRecord[],
  payload: RaxMpRouteForCoreInput["payload"],
): MpMemoryRecord[] {
  return [...records]
    .map((record, index) => ({
      record,
      index,
      score: freshnessScore(record.freshness.status)
        + confidenceScore(record.confidence)
        + alignmentScore(record.alignment.alignmentStatus)
        + objectiveSignalScore(record, payload)
        + governancePreferenceScore(record, payload),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.record);
}

function createAcceptance(input: {
  receiptAvailable: boolean;
  summaryAvailable: boolean;
  statusPanelAvailable: boolean;
  pendingAlignmentCount: number;
  pendingSupersedeCount: number;
  dispatcherSeen: boolean;
}): RaxMpAcceptanceReadiness {
  const roleConfiguration = {
    status: input.summaryAvailable ? "ready" : "failed",
    summary: input.summaryAvailable
      ? "MP five-agent configuration is attached."
      : "MP five-agent configuration is unavailable.",
  } as const;
  const tapBridge = {
    status: input.summaryAvailable ? "ready" : "degraded",
    summary: input.summaryAvailable
      ? "MP TAP profile catalog is available."
      : "MP TAP profile catalog is unavailable.",
  } as const;
  const lanceTruth = {
    status: input.receiptAvailable ? "ready" : "failed",
    summary: input.receiptAvailable
      ? "LanceDB bootstrap receipt is available."
      : "LanceDB bootstrap receipt is unavailable.",
  } as const;
  const freshnessAlignment = {
    status: input.pendingAlignmentCount === 0 && input.pendingSupersedeCount === 0 ? "ready" : "degraded",
    summary: `Pending alignment ${input.pendingAlignmentCount}, pending supersede ${input.pendingSupersedeCount}.`,
  } as const;
  const memoryQuality = {
    status: input.summaryAvailable ? "ready" : "degraded",
    summary: input.summaryAvailable
      ? "MP quality summary is available."
      : "MP quality summary is unavailable.",
  } as const;
  const retrievalBundle = {
    status: input.dispatcherSeen ? "ready" : "degraded",
    summary: input.dispatcherSeen
      ? "Dispatcher has produced retrieval bundle metadata."
      : "Dispatcher has not produced retrieval bundle metadata yet.",
  } as const;
  const finalAcceptanceStatus = [roleConfiguration, lanceTruth, freshnessAlignment, memoryQuality, retrievalBundle]
    .some((entry) => entry.status === "failed")
    ? "failed"
    : [roleConfiguration, lanceTruth, freshnessAlignment, memoryQuality, retrievalBundle]
      .some((entry) => entry.status === "degraded")
      ? "degraded"
      : "ready";

  return {
    roleConfiguration,
    tapBridge,
    lanceTruth,
    freshnessAlignment,
    memoryQuality,
    retrievalBundle,
    finalAcceptance: {
      status: finalAcceptanceStatus,
      summary: "MP final acceptance aggregates configuration, LanceDB truth, alignment, quality, and retrieval readiness.",
    },
  };
}

function createStatusPanel(input: {
  acceptance: RaxMpAcceptanceReadiness;
  summary: NonNullable<RaxMpReadbackResult["summary"]>["fiveAgentSummary"];
}): RaxMpStatusPanel {
  return {
    roles: {
      icma: { count: input.summary.roleCounts.icma, latestStage: input.summary.latestStages.icma },
      iterator: { count: input.summary.roleCounts.iterator, latestStage: input.summary.latestStages.iterator },
      checker: { count: input.summary.roleCounts.checker, latestStage: input.summary.latestStages.checker },
      dbagent: { count: input.summary.roleCounts.dbagent, latestStage: input.summary.latestStages.dbagent },
      dispatcher: { count: input.summary.roleCounts.dispatcher, latestStage: input.summary.latestStages.dispatcher },
    },
    flow: structuredClone(input.summary.flow),
    quality: {
      dedupeRate: input.summary.quality.dedupeRate,
      staleMemoryCount: input.summary.quality.staleMemoryCount,
      supersededMemoryCount: input.summary.quality.supersededMemoryCount,
    },
    readiness: {
      roleConfiguration: input.acceptance.roleConfiguration.status,
      tapBridge: input.acceptance.tapBridge.status,
      lanceTruth: input.acceptance.lanceTruth.status,
      freshnessAlignment: input.acceptance.freshnessAlignment.status,
      memoryQuality: input.acceptance.memoryQuality.status,
      retrievalBundle: input.acceptance.retrievalBundle.status,
      finalAcceptance: input.acceptance.finalAcceptance.status,
    },
  };
}

export function createRaxMpFacade(input: CreateRaxMpFacadeInput = {}): RaxMpFacade {
  const now = input.now ?? (() => new Date());
  const sessionIdFactory = input.sessionIdFactory ?? (() => `mp-session-${randomUUID()}`);
  const routingReadbacks = new WeakMap<RaxMpSession, RaxMpRoutingReadback>();

  function resolveConfig(config: RaxMpCreateInput["config"]): RaxMpConfig {
    if ("searchDefaults" in config && "profileId" in config && "defaultAgentId" in config) {
      return config as RaxMpConfig;
    }
    return createRaxMpConfig(config as RaxMpCreateInput["config"] & {
      projectId: string;
    });
  }

  return {
    create(createInput: RaxMpCreateInput): RaxMpSession {
      const config = resolveConfig(createInput.config);
      const runtime = assertRuntime(
        createInput.runtime ?? input.runtimeFactory?.(config) ?? createRaxMpRuntime({ config }),
      );
      return {
        sessionId: sessionIdFactory(),
        projectId: config.projectId,
        createdAt: now().toISOString(),
        config,
        runtime,
        metadata: createInput.metadata,
      };
    },

    async bootstrap(bootstrapInput: RaxMpBootstrapInput): Promise<RaxMpBootstrapResult> {
      const receipt = await bootstrapInput.session.runtime.bootstrapProject({
        projectId: bootstrapInput.payload.projectId ?? bootstrapInput.session.config.projectId,
        agentIds: bootstrapInput.payload.agentIds,
        rootPath: bootstrapInput.payload.rootPath ?? bootstrapInput.session.config.lance.rootPath,
        metadata: {
          sessionId: bootstrapInput.session.sessionId,
          ...(bootstrapInput.payload.metadata ?? {}),
          ...(bootstrapInput.metadata ?? {}),
        },
      });
      return {
        status: "bootstrapped",
        receipt,
        session: bootstrapInput.session,
        metadata: bootstrapInput.metadata,
      };
    },

    async readback(readbackInput: RaxMpReadbackInput): Promise<RaxMpReadbackResult> {
      const projectId = readbackInput.projectId ?? readbackInput.session.projectId;
      const receipt = readbackInput.session.runtime.getMpBootstrapReceipt?.();
      const fiveAgentSummary = readbackInput.session.runtime.getMpFiveAgentRuntimeSummary?.();
      const records = readbackInput.session.runtime.getMpManagedRecords?.() ?? [];
      if (!receipt && !fiveAgentSummary) {
        return {
          status: "not_found",
          metadata: readbackInput.metadata,
        };
      }

      const acceptance = createAcceptance({
        receiptAvailable: Boolean(receipt),
        summaryAvailable: Boolean(fiveAgentSummary),
        statusPanelAvailable: Boolean(fiveAgentSummary),
        pendingAlignmentCount: fiveAgentSummary?.flow.pendingAlignmentCount ?? 0,
        pendingSupersedeCount: fiveAgentSummary?.flow.pendingSupersedeCount ?? 0,
        dispatcherSeen: (fiveAgentSummary?.roleCounts.dispatcher ?? 0) > 0,
      });
      const statusPanel = fiveAgentSummary
        ? createStatusPanel({
          acceptance,
          summary: fiveAgentSummary,
        })
        : undefined;
      const issues: string[] = [];
      if (!receipt) {
        issues.push("MP LanceDB bootstrap receipt is missing.");
      }
      if ((fiveAgentSummary?.flow.pendingAlignmentCount ?? 0) > 0) {
        issues.push(`MP has ${fiveAgentSummary?.flow.pendingAlignmentCount ?? 0} pending alignment item(s).`);
      }
      if ((fiveAgentSummary?.flow.pendingSupersedeCount ?? 0) > 0) {
        issues.push(`MP has ${fiveAgentSummary?.flow.pendingSupersedeCount ?? 0} pending supersede item(s).`);
      }

      return {
        status: "found",
        receipt,
        summary: {
          projectId,
          status: acceptance.finalAcceptance.status,
          receiptAvailable: Boolean(receipt),
          tableCount: receipt?.presentTableCount ?? 0,
          searchDefaults: structuredClone(readbackInput.session.config.searchDefaults),
          workflowConfig: structuredClone(readbackInput.session.config.workflow),
          recordCounts: {
            total: records.length,
            byFreshness: countBy(records.map((record) => record.freshness.status)),
            byAlignment: countBy(records.map((record) => record.alignment.alignmentStatus)),
          },
          fiveAgentSummary: fiveAgentSummary ?? {
            configurationVersion: "mp-five-agent-role-catalog/v1",
            roleCounts: {
              icma: 0,
              iterator: 0,
              checker: 0,
              dbagent: 0,
              dispatcher: 0,
            },
            latestStages: {
              icma: undefined,
              iterator: undefined,
              checker: undefined,
              dbagent: undefined,
              dispatcher: undefined,
            },
            latestRoleMetadata: {},
            configuredRoles: {} as never,
            capabilityMatrix: {
              ingressOwners: ["icma"],
              rewriteOwners: ["iterator"],
              alignmentJudges: ["checker"],
              memoryWriters: ["dbagent"],
              retrievalOwners: ["dispatcher"],
            },
            tapProfiles: {} as never,
            flow: {
              pendingAlignmentCount: 0,
              pendingSupersedeCount: 0,
              staleMemoryCandidateCount: 0,
              passiveReturnCount: 0,
            },
            quality: {
              dedupeRate: 0,
              staleMemoryCount: 0,
              supersededMemoryCount: 0,
              rerankComposition: {
                fresh: 0,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 0,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
          acceptance,
          statusPanel: statusPanel ?? {
            roles: {
              icma: { count: 0 },
              iterator: { count: 0 },
              checker: { count: 0 },
              dbagent: { count: 0 },
              dispatcher: { count: 0 },
            },
            flow: {
              pendingAlignmentCount: 0,
              pendingSupersedeCount: 0,
              staleMemoryCandidateCount: 0,
              passiveReturnCount: 0,
            },
            quality: {
              dedupeRate: 0,
              staleMemoryCount: 0,
              supersededMemoryCount: 0,
            },
            readiness: {
              roleConfiguration: acceptance.roleConfiguration.status,
              tapBridge: acceptance.tapBridge.status,
              lanceTruth: acceptance.lanceTruth.status,
              freshnessAlignment: acceptance.freshnessAlignment.status,
              memoryQuality: acceptance.memoryQuality.status,
              retrievalBundle: acceptance.retrievalBundle.status,
              finalAcceptance: acceptance.finalAcceptance.status,
            },
          },
          issues,
        },
        metadata: readbackInput.metadata,
      };
    },

    async smoke(smokeInput: RaxMpSmokeInput): Promise<RaxMpSmokeResult> {
      const readback = await this.readback({
        session: smokeInput.session,
        projectId: smokeInput.projectId,
        metadata: smokeInput.metadata,
      });
      const summary = readback.summary;
      const checks: RaxMpSmokeResult["checks"] = summary
        ? [
          {
            id: "mp.role_configuration.readiness",
            gate: "configuration",
            status: summary.acceptance.roleConfiguration.status,
            summary: summary.acceptance.roleConfiguration.summary,
          },
          {
            id: "mp.tap_bridge.readiness",
            gate: "tap_bridge",
            status: summary.acceptance.tapBridge.status,
            summary: summary.acceptance.tapBridge.summary,
          },
          {
            id: "mp.lance_truth.readiness",
            gate: "truth",
            status: summary.acceptance.lanceTruth.status,
            summary: summary.acceptance.lanceTruth.summary,
          },
          {
            id: "mp.freshness_alignment.readiness",
            gate: "alignment",
            status: summary.acceptance.freshnessAlignment.status,
            summary: summary.acceptance.freshnessAlignment.summary,
          },
          {
            id: "mp.memory_quality.readiness",
            gate: "quality",
            status: summary.acceptance.memoryQuality.status,
            summary: summary.acceptance.memoryQuality.summary,
          },
          {
            id: "mp.retrieval_bundle.readiness",
            gate: "retrieval",
            status: summary.acceptance.retrievalBundle.status,
            summary: summary.acceptance.retrievalBundle.summary,
          },
          {
            id: "mp.final_acceptance",
            gate: "final_acceptance",
            status: summary.acceptance.finalAcceptance.status,
            summary: summary.acceptance.finalAcceptance.summary,
            metadata: {
              issues: summary.issues,
            },
          },
        ]
        : [
          {
            id: "mp.final_acceptance",
            gate: "final_acceptance",
            status: "failed" as const,
            summary: "MP readback summary is unavailable.",
          },
        ];

      return {
        status: summary?.acceptance.finalAcceptance.status ?? "failed",
        checks,
        metadata: smokeInput.metadata,
      };
    },

    async ingest(ingestInput: RaxMpIngestInput): Promise<RaxMpIngestResult> {
      return ingestInput.session.runtime.ingestMemoryWorkflow(ingestInput.payload);
    },

    async align(alignInput: RaxMpAlignInput): Promise<RaxMpAlignResult> {
      return alignInput.session.runtime.alignMemoryWorkflow(alignInput.payload);
    },

    async resolve(resolveInput: RaxMpResolveInput): Promise<RaxMpResolveResult> {
      return resolveInput.session.runtime.resolveMemoryWorkflow(resolveInput.payload);
    },

    async requestHistory(historyInput: RaxMpRequestHistoryInput): Promise<RaxMpRequestHistoryResult> {
      return historyInput.session.runtime.requestMemoryHistory(historyInput.payload);
    },

    async routeForCore(routeInput: RaxMpRouteForCoreInput): Promise<RaxMpRouteForCoreResult> {
      const objectiveSummary = routeInput.payload.currentObjective?.trim()
        || routeInput.payload.queryText.trim()
        || "continue current work";
      const routeKind = routeInput.payload.routeHint === "history" ? "history" : "resolve";
      const routeQueryText = buildCoreRouteQuery(routeInput.payload);
      const routed = routeKind === "history"
        ? await this.requestHistory({
          session: routeInput.session,
          payload: {
            queryText: routeQueryText,
            requesterLineage: routeInput.payload.requesterLineage,
            requesterSessionId: routeInput.payload.requesterSessionId,
            sourceLineages: routeInput.payload.sourceLineages,
            agentTableNames: routeInput.payload.agentTableNames,
            scopeLevels: routeInput.payload.scopeLevels,
            limit: routeInput.payload.limit,
            metadata: {
              ...(routeInput.payload.metadata ?? {}),
              currentObjective: routeInput.payload.currentObjective,
              governanceSignals: routeInput.payload.governanceSignals,
            },
          },
        })
        : await this.resolve({
          session: routeInput.session,
          payload: {
            queryText: routeQueryText,
            requesterLineage: routeInput.payload.requesterLineage,
            requesterSessionId: routeInput.payload.requesterSessionId,
            sourceLineages: routeInput.payload.sourceLineages,
            agentTableNames: routeInput.payload.agentTableNames,
            scopeLevels: routeInput.payload.scopeLevels,
            limit: routeInput.payload.limit,
            metadata: {
              ...(routeInput.payload.metadata ?? {}),
              currentObjective: routeInput.payload.currentObjective,
              governanceSignals: routeInput.payload.governanceSignals,
            },
          },
        });

      const rerankedRecords = rerankRoutedRecords(
        [...routed.bundle.primary, ...routed.bundle.supporting],
        routeInput.payload,
      );
      const primaryCount = routed.bundle.primary.length > 0
        ? routed.bundle.primary.length
        : Math.min(3, rerankedRecords.length);
      const primaryRecords = rerankedRecords.slice(0, primaryCount);
      const supportingRecords = rerankedRecords.slice(primaryCount);
      const omittedMemoryRefs = [...(routed.bundle.diagnostics.omittedSupersededMemoryIds ?? [])];
      if (primaryRecords.length > 0 || supportingRecords.length > 0) {
        const readback: RaxMpRoutingReadback = {
          receiptId: `mp-route:${routeKind}:${randomUUID()}`,
          routeKind,
          deliveryStatus: "available",
          objectiveSummary,
          objectiveMatchSummary: `resolved ${primaryRecords.length} primary and ${supportingRecords.length} supporting memories for "${objectiveSummary}"`,
          governanceReason: routeInput.payload.governanceSignals?.cmpRouteRationale
            ? `governed by CMP route hint: ${routeInput.payload.governanceSignals.cmpRouteRationale}`
            : `selected via MP ${routeKind} routing discipline`,
          fallbackReason: undefined,
          primaryMemoryRefs: primaryRecords.map((record) => record.memoryId),
          supportingMemoryRefs: supportingRecords.map((record) => record.memoryId),
          omittedMemoryRefs,
          candidateCount: primaryRecords.length + supportingRecords.length + omittedMemoryRefs.length,
        };
        routingReadbacks.set(routeInput.session, readback);
        return {
          status: "routed",
          routeKind,
          primaryRecords,
          supportingRecords,
          fallbackEntries: [],
          readback,
        };
      }

      const fallbackEntries = [...(routeInput.payload.fallbackEntries ?? [])];
      const readback: RaxMpRoutingReadback = {
        receiptId: `mp-route:fallback:${randomUUID()}`,
        routeKind: fallbackEntries.length > 0 ? "fallback" : routeKind,
        deliveryStatus: fallbackEntries.length > 0 ? "partial" : "absent",
        objectiveSummary,
        objectiveMatchSummary: fallbackEntries.length > 0
          ? `native routing produced no bundle, so ${fallbackEntries.length} fallback memory entries were used`
          : `native routing produced no available memory bundle for "${objectiveSummary}"`,
        governanceReason: routeInput.payload.governanceSignals?.cmpScopePolicy
          ? `scope constrained by CMP policy: ${routeInput.payload.governanceSignals.cmpScopePolicy}`
          : "native routing had no eligible memories after scope and freshness filtering",
        fallbackReason: fallbackEntries.length > 0
          ? "repo-memory bootstrap fallback"
          : "no native bundle and no fallback entries were available",
        primaryMemoryRefs: fallbackEntries.slice(0, 3).map((entry) => entry.id),
        supportingMemoryRefs: fallbackEntries.slice(3).map((entry) => entry.id),
        omittedMemoryRefs,
        candidateCount: fallbackEntries.length,
      };
      routingReadbacks.set(routeInput.session, readback);
      return {
        status: "routed",
        routeKind: fallbackEntries.length > 0 ? "fallback" : routeKind,
        primaryRecords: [],
        supportingRecords: [],
        fallbackEntries,
        readback,
      };
    },

    getRoutingReadback(session: RaxMpSession): RaxMpRoutingReadback | undefined {
      return routingReadbacks.get(session);
    },

    async materializeFromCmpCandidates(
      candidateInput: RaxMpMaterializeFromCmpCandidatesInput,
    ): Promise<RaxMpMaterializeFromCmpCandidatesResult> {
      const records = [];
      const supersededMemoryIds = new Set<string>();
      const staleMemoryIds = new Set<string>();
      let latestSummary: MpFiveAgentSummary | undefined;
      for (const candidate of candidateInput.payload.candidates) {
        const ingested = await this.ingest({
          session: candidateInput.session,
          payload: candidate,
        });
        records.push(...ingested.records);
        ingested.supersededMemoryIds.forEach((memoryId) => supersededMemoryIds.add(memoryId));
        ingested.staleMemoryIds.forEach((memoryId) => staleMemoryIds.add(memoryId));
        latestSummary = ingested.summary;
      }
      return {
        status: "materialized_from_cmp_candidates",
        records,
        supersededMemoryIds: [...supersededMemoryIds],
        staleMemoryIds: [...staleMemoryIds],
        summary: latestSummary,
      };
    },

    async materialize(materializeInput: RaxMpMaterializeInput) {
      return materializeInput.session.runtime.materializeStoredSection(materializeInput.payload);
    },

    async materializeBatch(materializeInput: RaxMpMaterializeBatchInput) {
      return materializeInput.session.runtime.materializeStoredSectionBatch(materializeInput.payload);
    },

    async search(searchInput: RaxMpSearchInput) {
      return searchInput.session.runtime.search({
        queryText: searchInput.payload.queryText,
        requesterLineage: searchInput.payload.requesterLineage,
        requesterSessionId: searchInput.payload.requesterSessionId,
        sourceLineages: new Map(
          searchInput.payload.sourceLineages.map((lineage) => [lineage.agentId, lineage]),
        ),
        agentTableNames: searchInput.payload.agentTableNames,
        scopeLevels: searchInput.payload.scopeLevels,
        limit: searchInput.payload.limit,
        metadata: searchInput.payload.metadata,
      });
    },

    async archive(archiveInput: RaxMpArchiveInput) {
      return archiveInput.session.runtime.archiveMemory(archiveInput.payload);
    },

    async promote(promoteInput: RaxMpPromoteInput) {
      return promoteInput.session.runtime.promoteMemory(promoteInput.payload);
    },

    async split(splitInput: RaxMpSplitInput): Promise<RaxMpSplitResult> {
      return {
        status: "split",
        records: await splitInput.session.runtime.splitMemory(splitInput.payload),
      };
    },

    async merge(mergeInput: RaxMpMergeInput): Promise<RaxMpMergeResult> {
      const merged = await mergeInput.session.runtime.mergeMemories(mergeInput.payload);
      return {
        status: "merged",
        ...merged,
      };
    },

    async reindex(reindexInput: RaxMpReindexInput) {
      return reindexInput.session.runtime.reindexMemory(reindexInput.payload);
    },

    async compact(compactInput: RaxMpCompactInput) {
      return compactInput.session.runtime.compactSemanticGroup(compactInput.payload);
    },
  };
}
