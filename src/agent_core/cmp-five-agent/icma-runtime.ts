import { getCmpRoleConfiguration } from "./configuration.js";
import {
  createCmpFiveAgentLoopRecord,
  createCmpRoleCheckpointRecord,
} from "./shared.js";
import type {
  CmpIcmaEmitInput,
  CmpIcmaIngestInput,
  CmpIcmaRecord,
  CmpIcmaRuntimeSnapshot,
  CmpIntentChunkRecord,
  CmpRoleCheckpointRecord,
  CmpSystemFragmentKind,
  CmpSystemFragmentRecord,
} from "./types.js";

function isFragmentKind(value: string): value is CmpSystemFragmentKind {
  return ["constraint", "risk", "flow"].includes(value);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeFragmentKinds(value: unknown): CmpSystemFragmentKind[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueStrings(value.filter((item): item is string => typeof item === "string"))
    .filter(isFragmentKind);
}

export interface CmpIcmaRuntimeResult {
  loop: CmpIcmaRecord;
  intentChunks: CmpIntentChunkRecord[];
  fragments: CmpSystemFragmentRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
}

export class CmpIcmaRuntime {
  readonly #records = new Map<string, CmpIcmaRecord>();
  readonly #intentChunks = new Map<string, CmpIntentChunkRecord>();
  readonly #fragments = new Map<string, CmpSystemFragmentRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();

  capture(input: CmpIcmaIngestInput): CmpIcmaRuntimeResult {
    const configuration = getCmpRoleConfiguration("icma");
    const fragmentKinds = normalizeFragmentKinds(input.ingest.metadata?.cmpSystemFragmentKinds);
    const chunkId = `${input.loopId}:chunk:0`;
    const fragmentIds = fragmentKinds.map((_, index) => `${input.loopId}:fragment:${index}`);
    const chunk: CmpIntentChunkRecord = {
      chunkId,
      agentId: input.ingest.agentId,
      taskSummary: input.ingest.taskSummary,
      materialRefs: input.ingest.materials.map((material) => material.ref),
      createdAt: input.createdAt,
      metadata: {
        chunking: {
          strategy: "task_intent",
          granularity: "medium_semantic",
          preserveHighSignal: true,
        },
        fragmentPolicy: {
          systemPolicy: configuration.promptPack.systemPolicy,
          rootSystemMutationAllowed: false,
          allowedKinds: fragmentKinds,
        },
        seedAssembly: {
          discipline: "child_seed_enters_child_icma_only",
          target: "child_icma",
          mode: "controlled_seed",
          rootSystemMutationAllowed: false,
        },
        promptPackId: configuration.promptPack.promptPackId,
        profileId: configuration.profile.profileId,
        capabilityContractId: configuration.capabilityContract.contractId,
        handoffContract: configuration.promptPack.handoffContract,
      },
    };
    const fragments = fragmentKinds.map((kind, index) => ({
      fragmentId: fragmentIds[index]!,
      agentId: input.ingest.agentId,
      kind,
      content: `${kind}:${input.ingest.taskSummary}`,
      lifecycle: "task_phase" as const,
      createdAt: input.createdAt,
      metadata: {
        templateId: `${configuration.promptPack.promptPackId}:${kind}`,
        templateClass: "append_only_system_fragment",
        rootSystemMutationAllowed: false,
        systemPolicy: configuration.promptPack.systemPolicy,
      },
    }));
    const loop: CmpIcmaRecord = {
      ...createCmpFiveAgentLoopRecord({
        loopId: input.loopId,
        role: "icma",
        agentId: input.ingest.agentId,
        projectId: input.ingest.lineage.projectId,
        stage: "attach_fragment",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        metadata: {
          gitWriteAccess: false,
          promptPackId: configuration.promptPack.promptPackId,
          profileId: configuration.profile.profileId,
          capabilityContractId: configuration.capabilityContract.contractId,
          fragmentPolicy: {
            systemPolicy: configuration.promptPack.systemPolicy,
            rootSystemMutationAllowed: false,
            allowedKinds: fragmentKinds,
            templateIds: fragments.map((fragment) => fragment.metadata?.templateId),
            lifecycle: "task_phase",
          },
          seedAssembly: {
            discipline: "child_seed_enters_child_icma_only",
            target: "child_icma",
            mode: "controlled_seed",
            rootSystemMutationAllowed: false,
          },
        },
      }),
      chunkIds: [chunkId],
      fragmentIds,
      structuredOutput: {
        requestId: typeof input.ingest.metadata?.cmpRequestId === "string"
          ? input.ingest.metadata.cmpRequestId
          : undefined,
        intent: input.ingest.taskSummary,
        sourceAnchorRefs: input.ingest.materials.map((material) => material.ref),
        candidateBodyRefs: input.ingest.materials.map((material) => material.ref),
        boundary: "preserve_root_system_and_emit_controlled_fragments_only",
        explicitFragmentIds: fragmentIds,
        preSectionIds: Array.isArray(input.ingest.metadata?.cmpPreSectionRecordIds)
          ? input.ingest.metadata.cmpPreSectionRecordIds.filter((value): value is string => typeof value === "string")
          : [],
        guide: {
          operatorGuide: "Preserve high-signal input and emit controlled pre-sections only.",
          childGuide: "Any child seed must enter child ICMA only.",
        },
      },
    };

    this.#records.set(loop.loopId, loop);
    this.#intentChunks.set(chunkId, chunk);
    for (const fragment of fragments) {
      this.#fragments.set(fragment.fragmentId, fragment);
    }

    const checkpoints = ["capture", "chunk_by_intent", "attach_fragment"].map((stage, index) => {
      const checkpoint = createCmpRoleCheckpointRecord({
        checkpointId: `${input.loopId}:cp:${index}`,
        role: "icma",
        agentId: loop.agentId,
        stage,
        createdAt: input.createdAt,
        eventRef: chunkId,
        metadata: {
          source: "cmp-five-agent-icma",
        },
      });
      this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
      return checkpoint;
    });

    return {
      loop,
      intentChunks: [chunk],
      fragments,
      checkpoints,
    };
  }

  emit(input: CmpIcmaEmitInput): CmpIcmaRecord {
    const current = this.#records.get(input.recordId);
    if (!current) {
      throw new Error(`CMP ICMA record ${input.recordId} was not found.`);
    }
    const next: CmpIcmaRecord = {
      ...current,
      stage: "emit",
      updatedAt: input.emittedAt,
      eventIds: uniqueStrings(input.eventIds),
      metadata: {
        ...(current.metadata ?? {}),
        emittedEventIds: uniqueStrings(input.eventIds),
        handoffContract: getCmpRoleConfiguration("icma").promptPack.handoffContract,
        emittedEventCount: uniqueStrings(input.eventIds).length,
        fragmentPolicy: current.metadata?.fragmentPolicy,
        seedAssembly: current.metadata?.seedAssembly,
        structuredOutput: current.structuredOutput,
        emitContract: {
          target: "iterator",
          preservesFragmentPolicy: true,
          preservesSeedAssembly: true,
          preservesStructuredOutput: true,
        },
      },
    };
    this.#records.set(next.loopId, next);
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.recordId}:cp:emit`,
      role: "icma",
      agentId: next.agentId,
      stage: "emit",
      createdAt: input.emittedAt,
      eventRef: input.recordId,
      metadata: {
        source: "cmp-five-agent-icma",
      },
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return next;
  }

  createSnapshot(agentId?: string): CmpIcmaRuntimeSnapshot {
    const match = (candidateAgentId: string) => !agentId || candidateAgentId === agentId;
    return {
      records: [...this.#records.values()].filter((record) => match(record.agentId)),
      intentChunks: [...this.#intentChunks.values()].filter((record) => match(record.agentId)),
      fragments: [...this.#fragments.values()].filter((record) => match(record.agentId)),
      checkpoints: [...this.#checkpoints.values()].filter((record) => match(record.agentId)),
    };
  }

  recover(snapshot?: CmpIcmaRuntimeSnapshot): void {
    this.#records.clear();
    this.#intentChunks.clear();
    this.#fragments.clear();
    this.#checkpoints.clear();
    if (!snapshot) {
      return;
    }
    for (const record of snapshot.records) this.#records.set(record.loopId, record);
    for (const record of snapshot.intentChunks) this.#intentChunks.set(record.chunkId, record);
    for (const record of snapshot.fragments) this.#fragments.set(record.fragmentId, record);
    for (const record of snapshot.checkpoints) this.#checkpoints.set(record.checkpointId, record);
  }
}

export function createCmpIcmaRuntime(): CmpIcmaRuntime {
  return new CmpIcmaRuntime();
}
