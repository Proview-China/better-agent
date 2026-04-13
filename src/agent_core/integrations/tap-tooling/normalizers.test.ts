import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { CapabilityInvocationPlan } from "../../capability-types/index.js";
import {
  normalizeCodeEditInput,
  normalizeCodePatchInput,
  normalizeCommandInput,
  normalizeDocWriteInput,
  normalizeSpreadsheetWriteInput,
} from "./normalizers.js";

function createPlan(
  capabilityKey: CapabilityInvocationPlan["capabilityKey"],
  input: Record<string, unknown>,
): CapabilityInvocationPlan {
  const allowedOperations = capabilityKey === "spreadsheet.write"
    ? ["write", "mkdir", "spreadsheet.write"]
    : capabilityKey === "doc.write"
      ? ["write", "mkdir", "doc.write"]
      : capabilityKey === "code.edit"
        ? ["read", "write", "mkdir", "code.edit"]
      : ["exec", "shell.restricted", "test", "test.run"];
  return {
    planId: "plan-normalizers",
    intentId: "intent-normalizers",
    sessionId: "session-normalizers",
    runId: "run-normalizers",
    capabilityKey,
    operation: capabilityKey,
    input,
    priority: "normal",
    metadata: {
      grantedScope: {
        pathPatterns: ["workspace/**"],
        allowedOperations,
      },
    },
  };
}

test("normalizeCommandInput rejects destructive shell.restricted args", () => {
  assert.throws(
    () =>
      normalizeCommandInput({
        plan: createPlan("shell.restricted", {
          command: "git",
          args: ["reset", "--hard"],
        }),
        workspaceRoot: "/tmp/workspace",
        defaultTimeoutMs: 15_000,
        capabilityKey: "shell.restricted",
        operationCandidates: ["exec", "shell.restricted"],
      }),
    /destructive arguments/i,
  );
});

test("normalizeCommandInput blocks non-test executables for test.run", () => {
  assert.throws(
    () =>
      normalizeCommandInput({
        plan: createPlan("test.run", {
          command: "bash",
          args: ["-lc", "echo nope"],
        }),
        workspaceRoot: "/tmp/workspace",
        defaultTimeoutMs: 30_000,
        capabilityKey: "test.run",
        operationCandidates: ["exec", "test", "test.run"],
      }),
    /only allows test-oriented commands/i,
  );
});

test("normalizeCodePatchInput parses add and update operations", () => {
  const normalized = normalizeCodePatchInput({
    planId: "plan-patch",
    intentId: "intent-patch",
    sessionId: "session-patch",
    runId: "run-patch",
    capabilityKey: "code.patch",
    operation: "code.patch",
    input: {
      patch: [
        "*** Begin Patch",
        "*** Add File: notes/hello.txt",
        "+hello",
        "*** Update File: src/sample.ts",
        "@@",
        "-const before = true;",
        "+const after = true;",
        "*** End Patch",
        "",
      ].join("\n"),
    },
    priority: "normal",
  });

  assert.equal(normalized.operations.length, 2);
  assert.equal(normalized.operations[0]?.type, "add");
  assert.equal(normalized.operations[1]?.type, "update");
});

test("normalizeSpreadsheetWriteInput accepts single-sheet planner payloads with a header row", () => {
  const normalized = normalizeSpreadsheetWriteInput(
    createPlan("spreadsheet.write", {
      path: "memory/generated/p2-spreadsheet-smoke.xlsx",
      format: "xlsx",
      sheets: [
        {
          name: "Sheet1",
          rows: [
            ["item", "price", "unit"],
            ["gold", 4755.44, "usd/oz"],
            ["silver", 31.2, "usd/oz"],
          ],
        },
      ],
    }),
    "/tmp/workspace",
  );

  assert.equal(normalized.format, "xlsx");
  assert.equal(normalized.sheetName, "Sheet1");
  assert.deepEqual(normalized.headers, ["item", "price", "unit"]);
  assert.deepEqual(normalized.rows, [
    ["gold", 4755.44, "usd/oz"],
    ["silver", 31.2, "usd/oz"],
  ]);
});

test("normalizeDocWriteInput accepts docx planner payloads with section paragraphs", () => {
  const normalized = normalizeDocWriteInput(
    createPlan("doc.write", {
      path: "memory/generated/p2-doc-smoke.docx",
      format: "docx",
      title: "P2 Doc Smoke",
      sections: [
        {
          heading: "Summary",
          paragraphs: ["验证 doc.write 和 doc.read 主链"],
        },
        {
          heading: "Observation",
          paragraphs: ["Current price: 4755.44 USD/oz", "Observed at: 08:48:38"],
        },
      ],
    }),
    "/tmp/workspace",
  );

  assert.equal(normalized.format, "docx");
  assert.match(normalized.textContent, /P2 Doc Smoke/u);
  assert.match(normalized.textContent, /Current price: 4755\.44 USD\/oz/u);
  assert.equal(normalized.sectionCount, 2);
});

test("normalizeDocWriteInput accepts markdown and text aliases as doc content", () => {
  const markdownNormalized = normalizeDocWriteInput(
    createPlan("doc.write", {
      path: "memory/generated/p2-doc-smoke.docx",
      format: "docx",
      title: "P2 Doc Smoke",
      markdown: "# Summary\n\n验证 doc.write 主链",
    }),
    "/tmp/workspace",
  );

  const textNormalized = normalizeDocWriteInput(
    createPlan("doc.write", {
      path: "memory/generated/p2-doc-smoke.docx",
      text: "Observed at: 08:48:38",
    }),
    "/tmp/workspace",
  );

  assert.match(markdownNormalized.textContent, /验证 doc\.write 主链/u);
  assert.match(textNormalized.textContent, /Observed at: 08:48:38/u);
});

test("normalizeDocWriteInput accepts nested document wrapper and blocks payloads", () => {
  const normalized = normalizeDocWriteInput(
    createPlan("doc.write", {
      path: "artifacts/wrapped.docx",
      document: {
        title: "Wrapped Doc",
        blocks: [
          { heading: "Observation", text: "Current price: 4755.44 USD/oz" },
          { text: "Observed at: 08:48:38" },
        ],
      },
    }),
    "/tmp/workspace",
  );

  assert.equal(normalized.relativeWorkspacePath, "artifacts/wrapped.docx");
  assert.match(normalized.textContent, /Wrapped Doc/u);
  assert.match(normalized.textContent, /Observation/u);
  assert.match(normalized.textContent, /Observed at: 08:48:38/u);
});

test("normalizeDocWriteInput accepts bodyLines as document content", () => {
  const normalized = normalizeDocWriteInput(
    createPlan("doc.write", {
      path: "artifacts/body-lines.docx",
      title: "Body Lines Doc",
      bodyLines: [
        "Current price: 4755.44 USD/oz",
        "Observed at: 08:48:38",
      ],
    }),
    "/tmp/workspace",
  );

  assert.match(normalized.textContent, /Body Lines Doc/u);
  assert.match(normalized.textContent, /Current price: 4755\.44 USD\/oz/u);
  assert.match(normalized.textContent, /Observed at: 08:48:38/u);
});

test("normalizeCodeEditInput accepts planner edit arrays with find/replace", () => {
  const normalized = normalizeCodeEditInput(
    createPlan("code.edit", {
      path: "src/sample.ts",
      edits: [
        {
          find: "const answer = 41;",
          replace: "const answer = 42;",
        },
      ],
    }),
    "/tmp/workspace",
  );

  assert.equal(normalized.relativeWorkspacePath, "src/sample.ts");
  assert.equal(normalized.oldString, "const answer = 41;");
  assert.equal(normalized.newString, "const answer = 42;");
});

test("normalizeCodeEditInput also accepts planner edit arrays with oldText/newText", () => {
  const normalized = normalizeCodeEditInput(
    createPlan("code.edit", {
      path: "src/sample.ts",
      edits: [
        {
          oldText: "const answer = 41;",
          newText: "const answer = 42;",
        },
      ],
    }),
    "/tmp/workspace",
  );

  assert.equal(normalized.oldString, "const answer = 41;");
  assert.equal(normalized.newString, "const answer = 42;");
});
