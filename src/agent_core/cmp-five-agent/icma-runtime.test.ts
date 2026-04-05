import assert from "node:assert/strict";
import test from "node:test";

import { createCmpBranchFamily } from "../cmp-types/index.js";
import { createCmpIcmaRuntime } from "./icma-runtime.js";

test("CmpIcmaRuntime captures by task intent and only keeps allowed fragment kinds", () => {
  const runtime = createCmpIcmaRuntime();
  const captured = runtime.capture({
    ingest: {
      agentId: "main",
      sessionId: "session-1",
      taskSummary: "整理当前任务上下文",
      materials: [
        { kind: "user_input", ref: "msg:1" },
        { kind: "tool_result", ref: "tool:1" },
      ],
      lineage: {
        agentId: "main",
        projectId: "proj-1",
        depth: 0,
        status: "active",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        }),
      },
      metadata: {
        cmpSystemFragmentKinds: ["constraint", "risk", "invalid", "flow"],
      },
    },
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "icma-loop-1",
  });

  assert.equal(captured.loop.stage, "attach_fragment");
  assert.deepEqual(captured.fragments.map((fragment) => fragment.kind), ["constraint", "risk", "flow"]);
  assert.equal(captured.intentChunks.length, 2);
  assert.equal(captured.loop.metadata?.gitWriteAccess, false);
  assert.equal(captured.loop.structuredOutput.intent, "整理当前任务上下文");
  assert.deepEqual(captured.loop.structuredOutput.sourceAnchorRefs, ["msg:1", "tool:1"]);
  assert.equal(captured.loop.structuredOutput.chunkingMode, "multi_auto");
  assert.deepEqual(captured.loop.structuredOutput.autoFragmentPolicy, {
    strategy: "llm_infer_from_materials",
    detectedKinds: ["constraint", "risk", "flow"],
  });
  assert.equal(captured.loop.structuredOutput.intentChunks?.length, 2);
  assert.equal(captured.loop.structuredOutput.boundary, "preserve_root_system_and_emit_controlled_fragments_only");
  assert.deepEqual(captured.loop.structuredOutput.explicitFragmentIds, captured.loop.fragmentIds);
  assert.equal(captured.loop.structuredOutput.guide.childGuide, "Any child seed must enter child ICMA only.");
  assert.deepEqual(captured.loop.metadata?.fragmentPolicy, {
    systemPolicy: "append_only_fragment",
    rootSystemMutationAllowed: false,
    allowedKinds: ["constraint", "risk", "flow"],
    templateIds: [
      "cmp-five-agent/icma-prompt-pack/v1:constraint",
      "cmp-five-agent/icma-prompt-pack/v1:risk",
      "cmp-five-agent/icma-prompt-pack/v1:flow",
    ],
    lifecycle: "task_phase",
  });
  assert.deepEqual(captured.loop.metadata?.seedAssembly, {
    discipline: "child_seed_enters_child_icma_only",
    target: "child_icma",
    mode: "controlled_seed",
    rootSystemMutationAllowed: false,
  });
  const chunking = captured.intentChunks[0]?.metadata?.chunking as
    | { strategy?: string; granularity?: string }
    | undefined;
  assert.equal(chunking?.strategy, "task_intent");
  assert.equal(chunking?.granularity, "medium_semantic");
  assert.equal((captured.intentChunks[0]?.metadata?.chunking as { mode?: string } | undefined)?.mode, "multi_auto");
  assert.equal(captured.fragments[0]?.metadata?.templateClass, "append_only_system_fragment");
  assert.equal(captured.fragments[0]?.metadata?.rootSystemMutationAllowed, false);

  const emitted = runtime.emit({
    recordId: captured.loop.loopId,
    eventIds: ["evt-1", "evt-2"],
    emittedAt: "2026-03-25T00:00:01.000Z",
  });
  assert.equal(emitted.stage, "emit");
  assert.equal(emitted.structuredOutput.intent, "整理当前任务上下文");
  assert.deepEqual(emitted.metadata?.seedAssembly, {
    discipline: "child_seed_enters_child_icma_only",
    target: "child_icma",
    mode: "controlled_seed",
    rootSystemMutationAllowed: false,
  });
  assert.equal(emitted.metadata?.emittedEventCount, 2);
  const emitContract = emitted.metadata?.emitContract as { target?: string } | undefined;
  assert.equal(emitContract?.target, "iterator");
  assert.equal((emitted.metadata?.emitContract as { preservesStructuredOutput?: boolean } | undefined)?.preservesStructuredOutput, true);
});

test("CmpIcmaRuntime captureWithLlm can apply live structured output and fallback safely", async () => {
  const runtime = createCmpIcmaRuntime();
  const baseInput = {
    ingest: {
      agentId: "main",
      sessionId: "session-llm",
      taskSummary: "整理当前任务上下文",
      materials: [
        { kind: "user_input" as const, ref: "msg:1" },
        { kind: "tool_result" as const, ref: "tool:1" },
      ],
      lineage: {
        agentId: "main",
        projectId: "proj-llm",
        depth: 0,
        status: "active" as const,
        branchFamily: createCmpBranchFamily({
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        }),
      },
      metadata: {
        cmpSystemFragmentKinds: ["constraint", "flow"],
      },
    },
    createdAt: "2026-03-30T00:00:00.000Z",
    loopId: "icma-loop-llm",
  };

  const liveApplied = await runtime.captureWithLlm(baseInput, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        intent: "聚焦当前主线与依赖约束",
        sourceAnchorRefs: ["tool:1"],
        candidateBodyRefs: ["msg:1", "tool:1"],
        boundary: "preserve_root_system_and_emit_controlled_fragments_only",
        chunkingMode: "multi_auto",
        autoFragmentPolicy: {
          detectedKinds: ["constraint", "flow"],
        },
        intentChunks: [
          {
            taskSummary: "主线任务上下文",
            materialRefs: ["msg:1"],
            detectedFragmentKinds: ["constraint"],
            operatorGuide: "主线块保持任务聚焦。",
          },
          {
            taskSummary: "工具结果约束上下文",
            materialRefs: ["tool:1"],
            detectedFragmentKinds: ["flow"],
            childGuide: "子任务只带工具结果的必要依赖。",
          },
        ],
        operatorGuide: "先保持主线聚焦，再把噪音留在外侧。",
        childGuide: "子任务只带必要背景，并继续进入 child ICMA。",
        llmIntentRationale: "工具结果比闲聊更接近当前任务主线。",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-icma-live",
    }),
  });
  assert.equal(liveApplied.loop.structuredOutput.intent, "聚焦当前主线与依赖约束");
  assert.deepEqual(liveApplied.loop.structuredOutput.sourceAnchorRefs, ["tool:1"]);
  assert.equal(liveApplied.loop.structuredOutput.intentChunks?.length, 2);
  assert.deepEqual(liveApplied.intentChunks.map((chunk) => chunk.materialRefs), [["msg:1"], ["tool:1"]]);
  assert.equal(liveApplied.loop.structuredOutput.guide.operatorGuide, "先保持主线聚焦，再把噪音留在外侧。");
  assert.equal(liveApplied.loop.liveTrace?.status, "live_applied");
  assert.equal((liveApplied.loop.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");

  const fallback = await runtime.captureWithLlm({
    ...baseInput,
    loopId: "icma-loop-fallback",
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("gateway failed");
    },
  });
  assert.equal(fallback.loop.structuredOutput.intent, "整理当前任务上下文");
  assert.equal(fallback.loop.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.loop.metadata?.liveLlm as { status?: string } | undefined)?.status, "fallback");

  await assert.rejects(
    () => runtime.captureWithLlm({
      ...baseInput,
      loopId: "icma-loop-required",
    }, {
      mode: "llm_required",
      executor: async () => {
        throw new Error("hard fail");
      },
    }),
    /hard fail/u,
  );
});
