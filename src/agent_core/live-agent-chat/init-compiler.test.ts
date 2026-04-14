import assert from "node:assert/strict";
import test from "node:test";

import {
  createFallbackInitCompilerResult,
  parseInitArtifact,
  parseInitCompilerResult,
} from "./init-compiler.js";

test("parseInitCompilerResult accepts question payloads", () => {
  const result = parseInitCompilerResult(JSON.stringify({
    action: "ask_questions",
    summary: "Need two missing facts before finalizing init context.",
    questions: [
      {
        id: "success",
        prompt: "当前这轮最重要的成功标准是什么？",
        options: [
          {
            id: "tui",
            label: "A",
            description: "先把 TUI 做通。",
          },
          {
            id: "cmp",
            label: "B",
            description: "先把 CMP readback 做稳。",
          },
        ],
        allowAnnotation: true,
        notePrompt: "如果有特殊要求，请补充说明。",
      },
    ],
  }));
  assert.deepEqual(result, {
    kind: "questions",
    summary: "Need two missing facts before finalizing init context.",
    questions: [{
      id: "success",
      prompt: "当前这轮最重要的成功标准是什么？",
      options: [
        {
          id: "tui",
          label: "A",
          description: "先把 TUI 做通。",
        },
        {
          id: "cmp",
          label: "B",
          description: "先把 CMP readback 做稳。",
        },
      ],
      allowAnnotation: true,
      notePrompt: "如果有特殊要求，请补充说明。",
    }],
  });
});

test("parseInitCompilerResult keeps completion summary for finalized init results", () => {
  const result = parseInitCompilerResult(JSON.stringify({
    action: "finalize",
    projectSummary: "梳理当前仓库的运行主线。",
    workingDirection: "先对齐 agent_core 和 /init 的执行路径。",
    successCriteria: ["让 /init 的真实问答和总结链打通。"],
    repoFacts: ["README.md 已存在。"],
    userPreferences: ["中文优先。"],
    knownConstraints: ["先做 TUI 主线。"],
    openQuestions: [],
    compiledSessionPreamble: "Project initialization context:\n- Primary direction: 先对齐 /init 主线",
    completionSummary: "Raxode has completed initialization for this workspace.\nMain direction: 先对齐 /init 主线。",
  }));
  assert.equal(result?.kind, "ready");
  assert.match((result as { completionSummary?: string }).completionSummary ?? "", /completed initialization/u);
});

test("fallback init compiler result emits parseable artifact preamble", () => {
  const result = createFallbackInitCompilerResult({
    seedText: "把 /init 做成可追问、可持久化、可注入后续会话的初始化编译器。",
    clarifications: ["当前优先做 direct-tui 路径。"],
    repoExcerpts: [
      {
        path: "README.md",
        content: "Praxis is a rebooting repository with memory-first delivery.",
      },
    ],
  });
  assert.match(result.compiledSessionPreamble, /Project initialization context:/u);
  assert.match(result.completionSummary ?? "", /completed initialization/u);
  assert.ok(result.artifactMarkdown);
  const parsed = parseInitArtifact(result.artifactMarkdown!);
  assert.equal(parsed.compiledSessionPreamble, result.compiledSessionPreamble);
  assert.ok(parsed.summaryLines.length > 0);
});
