import { randomUUID } from "node:crypto";

import { createRaxMpConfig, type RaxMpConfig } from "./mp-config.js";
import type {
  RaxMpArchiveInput,
  RaxMpBootstrapInput,
  RaxMpBootstrapResult,
  RaxMpCompactInput,
  RaxMpCreateInput,
  RaxMpFacade,
  RaxMpMaterializeBatchInput,
  RaxMpMaterializeInput,
  RaxMpMergeInput,
  RaxMpMergeResult,
  RaxMpPromoteInput,
  RaxMpReindexInput,
  RaxMpRuntimeLike,
  RaxMpSearchInput,
  RaxMpSession,
  RaxMpSplitInput,
  RaxMpSplitResult,
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

export function createRaxMpFacade(input: CreateRaxMpFacadeInput = {}): RaxMpFacade {
  const now = input.now ?? (() => new Date());
  const sessionIdFactory = input.sessionIdFactory ?? (() => `mp-session-${randomUUID()}`);

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
