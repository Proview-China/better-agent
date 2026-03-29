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
  assert.equal(captured.loop.metadata?.gitWriteAccess, false);
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
  assert.equal(captured.fragments[0]?.metadata?.templateClass, "append_only_system_fragment");
  assert.equal(captured.fragments[0]?.metadata?.rootSystemMutationAllowed, false);

  const emitted = runtime.emit({
    recordId: captured.loop.loopId,
    eventIds: ["evt-1", "evt-2"],
    emittedAt: "2026-03-25T00:00:01.000Z",
  });
  assert.equal(emitted.stage, "emit");
  assert.deepEqual(emitted.metadata?.seedAssembly, {
    discipline: "child_seed_enters_child_icma_only",
    target: "child_icma",
    mode: "controlled_seed",
    rootSystemMutationAllowed: false,
  });
  assert.equal(emitted.metadata?.emittedEventCount, 2);
  const emitContract = emitted.metadata?.emitContract as { target?: string } | undefined;
  assert.equal(emitContract?.target, "iterator");
});
