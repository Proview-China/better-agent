import {
  archiveMpMemoryRecord,
  buildMpSourceLineages,
  compactMpSemanticGroup,
  createMpFiveAgentRuntime,
  createLanceDbMpLanceDbAdapter,
  createInMemoryMpLanceDbAdapter,
  createMpSearchPlan,
  executeMpSearchPlan,
  materializeMpStoredSection,
  materializeMpStoredSectionBatch,
  mergeMpMemoryRecords,
  promoteMpMemoryRecord,
  reindexMpMemoryRecord,
  splitMpMemoryRecord,
  type MpLanceDbAdapter,
} from "../agent_core/index.js";
import { createMpSharedInfraConnectors, type MpSharedInfraConnectors } from "./mp-connectors.js";
import type { RaxMpConfig } from "./mp-config.js";
import type { RaxMpRuntimeLike } from "./mp-types.js";

export interface CreateRaxMpRuntimeInput {
  config: RaxMpConfig;
  connectors?: MpSharedInfraConnectors;
  adapter?: MpLanceDbAdapter;
}

export interface RaxMpRuntime extends RaxMpRuntimeLike {
  readonly config: RaxMpConfig;
  readonly connectors: MpSharedInfraConnectors;
}

export function createRaxMpRuntime(input: CreateRaxMpRuntimeInput): RaxMpRuntime {
  const connectors = input.connectors ?? createMpSharedInfraConnectors({
    adapter: input.adapter ?? (
      input.config.lance.liveExecutionPreferred
        ? createLanceDbMpLanceDbAdapter()
        : createInMemoryMpLanceDbAdapter()
    ),
  });
  const workflowRuntime = createMpFiveAgentRuntime({
    adapter: connectors.lance.adapter,
  });
  let bootstrapReceipt: Awaited<ReturnType<typeof connectors.lance.bootstrapProject>> | undefined;

  return {
    config: input.config,
    connectors,

    async bootstrapProject(params) {
      const plan = connectors.lance.createBootstrapPlan({
        projectId: params.projectId ?? input.config.projectId,
        agentIds: params.agentIds,
        rootPath: params.rootPath ?? input.config.lance.rootPath,
        schemaVersion: input.config.lance.schemaVersion,
        metadata: params.metadata,
      });
      bootstrapReceipt = await connectors.lance.bootstrapProject(plan);
      return bootstrapReceipt;
    },

    async materializeStoredSection(payload) {
      return materializeMpStoredSection({
        input: payload,
        adapter: connectors.lance.adapter,
      });
    },

    async materializeStoredSectionBatch(payloads) {
      return materializeMpStoredSectionBatch({
        inputs: payloads,
        adapter: connectors.lance.adapter,
      });
    },

    async search(params) {
      const plan = createMpSearchPlan({
        projectId: params.requesterLineage.projectId,
        queryText: params.queryText,
        requesterLineage: params.requesterLineage,
        requesterSessionId: params.requesterSessionId,
        agentTableName: connectors.lance.resolveTableName({
          projectId: params.requesterLineage.projectId,
          agentId: params.requesterLineage.agentId,
          scopeLevel: "agent_isolated",
        }),
        agentTableNames: params.agentTableNames,
        projectTableName: connectors.lance.resolveTableName({
          projectId: params.requesterLineage.projectId,
          agentId: params.requesterLineage.agentId,
          scopeLevel: "project",
        }),
        globalTableName: connectors.lance.resolveTableName({
          projectId: params.requesterLineage.projectId,
          agentId: params.requesterLineage.agentId,
          scopeLevel: "global",
        }),
        scopeLevels: params.scopeLevels ?? input.config.searchDefaults.scopeLevels,
        limit: params.limit ?? input.config.searchDefaults.limit,
        metadata: params.metadata,
      });

      return executeMpSearchPlan({
        adapter: connectors.lance.adapter,
        plan,
        requesterLineage: params.requesterLineage,
        sourceLineages: params.sourceLineages instanceof Map
          ? params.sourceLineages
          : buildMpSourceLineages([...params.sourceLineages.values()]),
        bridgeRecords: params.bridgeRecords,
      });
    },

    async archiveMemory(payload) {
      return archiveMpMemoryRecord({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async promoteMemory(payload) {
      return promoteMpMemoryRecord({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async splitMemory(payload) {
      return splitMpMemoryRecord({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async mergeMemories(payload) {
      return mergeMpMemoryRecords({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async reindexMemory(payload) {
      return reindexMpMemoryRecord({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async compactSemanticGroup(payload) {
      return compactMpSemanticGroup({
        ...payload,
        adapter: connectors.lance.adapter,
      });
    },

    async ingestMemoryWorkflow(payload) {
      const result = await workflowRuntime.ingest({
        projectId: payload.scope.projectId,
        storedSection: payload.storedSection,
        checkedSnapshotRef: payload.checkedSnapshotRef,
        branchRef: payload.branchRef,
        scope: payload.scope,
        observedAt: payload.observedAt,
        capturedAt: payload.capturedAt,
        sourceRefs: payload.sourceRefs,
        memoryKind: payload.memoryKind,
        confidence: payload.confidence,
        metadata: payload.metadata,
      });
      return {
        status: "ingested",
        records: result.records,
        supersededMemoryIds: result.alignment.supersededMemoryIds,
        staleMemoryIds: result.alignment.staleMemoryIds,
        summary: workflowRuntime.getSummary(),
      };
    },

    async alignMemoryWorkflow(payload) {
      const result = await workflowRuntime.align(payload);
      return {
        ...result,
        summary: workflowRuntime.getSummary(),
      };
    },

    async resolveMemoryWorkflow(payload) {
      const result = await workflowRuntime.resolve({
        projectId: payload.requesterLineage.projectId,
        queryText: payload.queryText,
        requesterLineage: payload.requesterLineage,
        requesterSessionId: payload.requesterSessionId,
        sourceLineages: payload.sourceLineages instanceof Map
          ? payload.sourceLineages
          : buildMpSourceLineages([...payload.sourceLineages.values()]),
        agentTableNames: payload.agentTableNames,
        scopeLevels: payload.scopeLevels ?? input.config.searchDefaults.scopeLevels,
        limit: payload.limit ?? input.config.workflow.retrievalPolicy.primaryBundleLimit
          + input.config.workflow.retrievalPolicy.supportingBundleLimit,
        metadata: payload.metadata,
      });
      return {
        ...result,
        summary: workflowRuntime.getSummary(),
      };
    },

    async requestMemoryHistory(payload) {
      const result = await workflowRuntime.requestHistory({
        projectId: payload.requesterLineage.projectId,
        queryText: payload.queryText,
        requesterLineage: payload.requesterLineage,
        requesterSessionId: payload.requesterSessionId,
        sourceLineages: payload.sourceLineages instanceof Map
          ? payload.sourceLineages
          : buildMpSourceLineages([...payload.sourceLineages.values()]),
        agentTableNames: payload.agentTableNames,
        scopeLevels: payload.scopeLevels ?? input.config.searchDefaults.scopeLevels,
        limit: payload.limit ?? input.config.workflow.retrievalPolicy.primaryBundleLimit
          + input.config.workflow.retrievalPolicy.supportingBundleLimit,
        metadata: payload.metadata,
      });
      return {
        ...result,
        summary: workflowRuntime.getSummary(),
      };
    },

    getMpFiveAgentRuntimeSummary() {
      return workflowRuntime.getSummary();
    },

    getMpBootstrapReceipt() {
      return bootstrapReceipt;
    },

    getMpManagedRecords() {
      return [...workflowRuntime.getState().records.values()].map((record) => structuredClone(record));
    },
  };
}
