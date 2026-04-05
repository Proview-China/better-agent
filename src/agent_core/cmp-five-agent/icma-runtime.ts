import { getCmpRoleConfiguration } from "./configuration.js";
import {
  attachCmpRoleLiveAudit,
  executeCmpRoleLiveLlmStep,
} from "./live-llm.js";
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
  CmpRoleLiveLlmExecutor,
  CmpRoleLiveLlmMode,
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

function normalizeStringArray(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedSet = new Set(allowed);
  return uniqueStrings(value.filter((item): item is string => typeof item === "string"))
    .filter((entry) => allowedSet.has(entry));
}

function inferAutoFragmentKinds(materialKinds: string[]): CmpSystemFragmentKind[] {
  const detected = new Set<CmpSystemFragmentKind>();
  if (materialKinds.includes("user_input")) {
    detected.add("constraint");
  }
  if (materialKinds.includes("tool_result") || materialKinds.includes("model_output")) {
    detected.add("risk");
  }
  if (materialKinds.length > 1 || materialKinds.includes("system_input")) {
    detected.add("flow");
  }
  return [...detected];
}

function normalizeIntentChunks(
  value: unknown,
  fallback: CmpIntentChunkRecord[],
  allowedRefs: readonly string[],
): Array<{
  taskSummary: string;
  materialRefs: string[];
  detectedFragmentKinds: CmpSystemFragmentKind[];
  operatorGuide?: string;
  childGuide?: string;
}> {
  if (!Array.isArray(value)) {
    return fallback.map((chunk) => ({
      taskSummary: chunk.taskSummary,
      materialRefs: chunk.materialRefs,
      detectedFragmentKinds: normalizeFragmentKinds(chunk.metadata?.detectedFragmentKinds),
      operatorGuide: typeof chunk.metadata?.operatorGuide === "string" ? chunk.metadata.operatorGuide : undefined,
      childGuide: typeof chunk.metadata?.childGuide === "string" ? chunk.metadata.childGuide : undefined,
    }));
  }

  const allowedSet = new Set(allowedRefs);
  const normalized = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      taskSummary: typeof item.taskSummary === "string" && item.taskSummary.trim().length > 0
        ? item.taskSummary.trim()
        : "",
      materialRefs: uniqueStrings(
        Array.isArray(item.materialRefs)
          ? item.materialRefs.filter((entry): entry is string => typeof entry === "string" && allowedSet.has(entry))
          : [],
      ),
      detectedFragmentKinds: normalizeFragmentKinds(item.detectedFragmentKinds),
      operatorGuide: typeof item.operatorGuide === "string" && item.operatorGuide.trim().length > 0
        ? item.operatorGuide.trim()
        : undefined,
      childGuide: typeof item.childGuide === "string" && item.childGuide.trim().length > 0
        ? item.childGuide.trim()
        : undefined,
    }))
    .filter((item) => item.taskSummary.length > 0 && item.materialRefs.length > 0);

  return normalized.length > 0
    ? normalized
    : fallback.map((chunk) => ({
      taskSummary: chunk.taskSummary,
      materialRefs: chunk.materialRefs,
      detectedFragmentKinds: normalizeFragmentKinds(chunk.metadata?.detectedFragmentKinds),
      operatorGuide: typeof chunk.metadata?.operatorGuide === "string" ? chunk.metadata.operatorGuide : undefined,
      childGuide: typeof chunk.metadata?.childGuide === "string" ? chunk.metadata.childGuide : undefined,
    }));
}

function toLiveAuditStatus(status: "rules_only" | "live_applied" | "fallback_rules"): "rules_only" | "llm_applied" | "fallback_applied" {
  return status === "live_applied"
    ? "llm_applied"
    : status === "fallback_rules"
      ? "fallback_applied"
      : "rules_only";
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
    const materialKinds = input.ingest.materials.map((material) => material.kind);
    const fragmentKinds = normalizeFragmentKinds(input.ingest.metadata?.cmpSystemFragmentKinds);
    const detectedFragmentKinds = fragmentKinds.length > 0 ? fragmentKinds : inferAutoFragmentKinds(materialKinds);
    const chunks: CmpIntentChunkRecord[] = input.ingest.materials.map((material, index) => ({
      chunkId: `${input.loopId}:chunk:${index}`,
      agentId: input.ingest.agentId,
      taskSummary: `${input.ingest.taskSummary} :: ${material.kind}`,
      materialRefs: [material.ref],
      createdAt: input.createdAt,
      metadata: {
        chunking: {
          strategy: "task_intent",
          granularity: "medium_semantic",
          preserveHighSignal: true,
          mode: "multi_auto",
        },
        detectedFragmentKinds,
        operatorGuide: material.kind === "tool_result"
          ? "先保留工具结果里的高信噪比状态、错误和依赖变化。"
          : "先保留和当前任务直接相关的约束与目标。",
        childGuide: "如果要给子任务播种，这一块仍然只能经由 child ICMA 进入子链。",
        fragmentPolicy: {
          systemPolicy: configuration.promptPack.systemPolicy,
          rootSystemMutationAllowed: false,
          allowedKinds: detectedFragmentKinds,
          strategy: fragmentKinds.length > 0 ? "metadata_explicit" : "material_auto_infer",
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
    }));
    const chunkId = chunks[0]?.chunkId ?? `${input.loopId}:chunk:0`;
    const fragmentIds = detectedFragmentKinds.map((_, index) => `${input.loopId}:fragment:${index}`);
    const fragments = detectedFragmentKinds.map((kind, index) => ({
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
            allowedKinds: detectedFragmentKinds,
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
      chunkIds: chunks.map((chunk) => chunk.chunkId),
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
        chunkingMode: "multi_auto",
        autoFragmentPolicy: {
          strategy: "llm_infer_from_materials",
          detectedKinds: detectedFragmentKinds,
        },
        intentChunks: chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          taskSummary: chunk.taskSummary,
          materialRefs: chunk.materialRefs,
          detectedFragmentKinds,
          operatorGuide: typeof chunk.metadata?.operatorGuide === "string" ? chunk.metadata.operatorGuide : undefined,
          childGuide: typeof chunk.metadata?.childGuide === "string" ? chunk.metadata.childGuide : undefined,
        })),
        guide: {
          operatorGuide: "Preserve high-signal input and emit controlled pre-sections only.",
          childGuide: "Any child seed must enter child ICMA only.",
        },
      },
    };

    this.#records.set(loop.loopId, loop);
    for (const chunk of chunks) {
      this.#intentChunks.set(chunk.chunkId, chunk);
    }
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
      intentChunks: chunks,
      fragments,
      checkpoints,
    };
  }

  async captureWithLlm(input: CmpIcmaIngestInput, options: {
    mode?: CmpRoleLiveLlmMode;
    executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, Record<string, unknown>>;
  } = {}): Promise<CmpIcmaRuntimeResult> {
    const captured = this.capture(input);
    const configuration = getCmpRoleConfiguration("icma");
    const liveResult = await executeCmpRoleLiveLlmStep({
      role: "icma",
      agentId: input.ingest.agentId,
      mode: options.mode,
      stage: "attach_fragment",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "shape ingress context and emit structured ICMA output",
      schemaTitle: "CmpIcmaStructuredOutput",
      schemaFields: ["intent", "sourceAnchorRefs", "candidateBodyRefs", "boundary", "chunkingMode", "intentChunks", "autoFragmentPolicy", "operatorGuide", "childGuide", "llmIntentRationale"],
      requestInput: {
        taskSummary: input.ingest.taskSummary,
        materialRefs: input.ingest.materials.map((material) => material.ref),
        fragmentKinds: captured.fragments.map((fragment) => fragment.kind),
        intentChunks: captured.intentChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          taskSummary: chunk.taskSummary,
          materialRefs: chunk.materialRefs,
          detectedFragmentKinds: normalizeFragmentKinds(chunk.metadata?.detectedFragmentKinds),
        })),
        preSectionIds: captured.loop.structuredOutput.preSectionIds,
      },
      fallbackOutput: {
        ...captured.loop.structuredOutput,
        operatorGuide: captured.loop.structuredOutput.guide.operatorGuide,
        childGuide: captured.loop.structuredOutput.guide.childGuide,
      },
      executor: options.executor,
      metadata: {
        promptId: configuration.promptPack.promptPackId,
      },
    });

    const availableRefs = input.ingest.materials.map((material) => material.ref);
    const output = liveResult.output;
    const outputAutoFragmentPolicy = (
      output.autoFragmentPolicy && typeof output.autoFragmentPolicy === "object" && !Array.isArray(output.autoFragmentPolicy)
        ? output.autoFragmentPolicy
        : undefined
    ) as { detectedKinds?: unknown } | undefined;
    const fallbackAutoFragmentPolicy = captured.loop.structuredOutput.autoFragmentPolicy as
      | { detectedKinds?: CmpSystemFragmentKind[] }
      | undefined;
    const normalizedIntentChunks = normalizeIntentChunks(output.intentChunks, captured.intentChunks, availableRefs);
    const nextIntentChunks = normalizedIntentChunks.map((chunk, index) => ({
      ...(captured.intentChunks[index] ?? {
        chunkId: `${captured.loop.loopId}:chunk:${index}`,
        agentId: input.ingest.agentId,
        createdAt: input.createdAt,
      }),
      taskSummary: chunk.taskSummary,
      materialRefs: chunk.materialRefs,
      metadata: attachCmpRoleLiveAudit({
        metadata: {
          ...((captured.intentChunks[index]?.metadata ?? {}) as Record<string, unknown>),
          detectedFragmentKinds: chunk.detectedFragmentKinds,
          operatorGuide: chunk.operatorGuide,
          childGuide: chunk.childGuide,
        },
        audit: {
          mode: liveResult.mode,
          status: toLiveAuditStatus(liveResult.status),
          provider: liveResult.trace.provider,
          model: liveResult.trace.model,
          requestId: liveResult.trace.requestId,
          error: liveResult.trace.errorMessage,
          fallbackApplied: liveResult.trace.fallbackApplied,
        },
      }),
    }));
    const nextLoop: CmpIcmaRecord = {
      ...captured.loop,
      chunkIds: nextIntentChunks.map((chunk) => chunk.chunkId),
      structuredOutput: {
        ...captured.loop.structuredOutput,
        intent: typeof output.intent === "string" && output.intent.trim()
          ? output.intent
          : captured.loop.structuredOutput.intent,
        sourceAnchorRefs: normalizeStringArray(output.sourceAnchorRefs, availableRefs).length > 0
          ? normalizeStringArray(output.sourceAnchorRefs, availableRefs)
          : captured.loop.structuredOutput.sourceAnchorRefs,
        candidateBodyRefs: normalizeStringArray(output.candidateBodyRefs, availableRefs).length > 0
          ? normalizeStringArray(output.candidateBodyRefs, availableRefs)
          : captured.loop.structuredOutput.candidateBodyRefs,
        boundary: typeof output.boundary === "string" && output.boundary.trim()
          ? output.boundary
          : captured.loop.structuredOutput.boundary,
        llmIntentRationale: typeof output.llmIntentRationale === "string" ? output.llmIntentRationale : undefined,
        chunkingMode: output.chunkingMode === "single_explicit" || output.chunkingMode === "multi_explicit" || output.chunkingMode === "multi_auto"
          ? output.chunkingMode
          : captured.loop.structuredOutput.chunkingMode,
        autoFragmentPolicy: {
          strategy: "llm_infer_from_materials",
          detectedKinds: normalizeFragmentKinds(outputAutoFragmentPolicy?.detectedKinds).length > 0
            ? normalizeFragmentKinds(outputAutoFragmentPolicy?.detectedKinds)
            : (fallbackAutoFragmentPolicy?.detectedKinds ?? []),
        },
        intentChunks: nextIntentChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          taskSummary: chunk.taskSummary,
          materialRefs: chunk.materialRefs,
          detectedFragmentKinds: normalizeFragmentKinds(chunk.metadata?.detectedFragmentKinds),
          operatorGuide: typeof chunk.metadata?.operatorGuide === "string" ? chunk.metadata.operatorGuide : undefined,
          childGuide: typeof chunk.metadata?.childGuide === "string" ? chunk.metadata.childGuide : undefined,
        })),
        guide: {
          operatorGuide: typeof output.operatorGuide === "string" && output.operatorGuide.trim()
            ? output.operatorGuide
          : captured.loop.structuredOutput.guide.operatorGuide,
          childGuide: typeof output.childGuide === "string" && output.childGuide.trim()
            ? output.childGuide
            : captured.loop.structuredOutput.guide.childGuide,
        },
      },
      liveTrace: liveResult.trace,
      metadata: attachCmpRoleLiveAudit({
        metadata: captured.loop.metadata,
        audit: {
          mode: liveResult.mode,
          status: toLiveAuditStatus(liveResult.status),
          provider: liveResult.trace.provider,
          model: liveResult.trace.model,
          requestId: liveResult.trace.requestId,
          error: liveResult.trace.errorMessage,
          fallbackApplied: liveResult.trace.fallbackApplied,
        },
        extras: {
          structuredOutput: undefined,
        },
      }),
    };

    this.#records.set(nextLoop.loopId, nextLoop);
    for (const chunk of captured.intentChunks) {
      this.#intentChunks.delete(chunk.chunkId);
    }
    for (const chunk of nextIntentChunks) {
      this.#intentChunks.set(chunk.chunkId, chunk);
    }

    return {
      loop: nextLoop,
      intentChunks: nextIntentChunks,
      fragments: captured.fragments,
      checkpoints: captured.checkpoints,
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
