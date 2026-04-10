import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import { createGoalSource } from "../goal/goal-source.js";
import { createAgentCoreRuntime } from "../runtime.js";
import type { CapabilityCallIntent } from "../types/index.js";
import { createAgentCapabilityProfile } from "../ta-pool-types/index.js";
import {
  createWorkspaceReadCapabilityAdapter,
  registerFirstClassToolingBaselineCapabilities,
} from "./workspace-read-adapter.js";

function createMinimalPdfBuffer(text: string): Buffer {
  const stream = `BT\n/F1 18 Tf\n72 96 Td\n(${text.replace(/[()\\]/g, "\\$&")}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]!).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1cAAAAASUVORK5CYII=";
const SIMPLE_DOCX_BASE64 =
  "UEsDBBQAAAAIAJx5iVzXeYTq8gAAALgBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2Qy07DMBBF9/0Ka7aodmCBEIrTBY8lsCgfYNmTxKo9tjxuSP8epYUiIcr6Ps6daTdzDGLCwj6RhmvZgECyyXkaNLxvn9d3ILgaciYkQg0HZNh0q3Z7yMhijoFYw1hrvleK7YjRsEwZaY6hTyWayjKVQWVjd2ZAddM0t8omqkh1XZcO6FZCtI/Ym32o4mmuSKctBQODeDh5F5wGk3Pw1lSfSE3kfoHWXxBZMBw9PPrMV3MMoC5BFvEy4yf6OmEp3qF4M6W+mIga1EcqTrlk9xGpyv+b/lib+t5bPOeXtlySRWZPQwzyrETj6fuKVh0f330CUEsDBBQAAAAIAJx5iVwgG4bqtgAAAC4BAAALAAAAX3JlbHMvLnJlbHONz7FOxDAQBNA+X7Ha/uIcBUIozjUnpGtR+ADL3iQW9q7l9UHu72koOERBOxq90YynPSf4oKpR2OKxHxCIvYTIq8W3+eXwhKDNcXBJmCzeSPE0deMrJdeisG6xKOw5sVrcWivPxqjfKDvtpRDvOS1Ss2vaS11Ncf7drWQehuHR1J8GTh3AHQuXYLFewhFhvhX6Dy/LEj2dxV8zcftj5VcDYXZ1pWbxU2ow4Tvu95zQTN1o7m5OX1BLAwQUAAAACACceYlclq40IFcBAAAxAwAAEQAAAHdvcmQvZG9jdW1lbnQueG1snZLLTsMwEEX3/QrLe5o0KlBFSRAbVjwqFRBb13Yeku2xxlMc+HqURKUFgSrYjO7xvK6sKa56a9irxtCBK/linnKmnQTVuabkT483ZyvOAgmnhAGnS/6mA7+qZkXMFcid1Y5Yb40LeSx5S+TzJAmy1VaEOXjtemtqQCsozAGbJAIqjyB1CJ1rrEmyNL1IrOgcr2aMFTHfgnob5Ai+KmKOQ6BqjaLvAlMgGWqhWN31tENdJENyiDhG/2PzRktwinmBokHhW1YDsoeHl7tbpntCIakDN/99Fm3NpCfCPUwoq2/r7oX9wdj4Ik+0PguzO9k7Ev7F0bXxrfinpWX2Fz+j3n9XEfOgJa2Pvfpm887icC+LLFumnMW8LfnifLVMefKl7k4gizmBL/liOVVi17R0wC0QgT2w0fVRttVCaSz5ZTZiDUBH2OxoxM+tg/OD24GmYxzU/tirD1BLAQIUAxQAAAAIAJx5iVzXeYTq8gAAALgBAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAnHmJXCAbhuq2AAAALgEAAAsAAAAAAAAAAAAAAIABIwEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAnHmJXJauNCBXAQAAMQMAABEAAAAAAAAAAAAAAIABAgIAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAAIgDAAAAAA==";
const SIMPLE_XLSX_BASE64 =
  "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";

async function createWorkspaceFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "praxis-workspace-read-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "notebooks"), { recursive: true });
  await writeFile(
    path.join(root, "src", "sample.ts"),
    [
      "export function answer() {",
      "  return 42;",
      "}",
      "",
      "export const meaning = answer();",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "consumer.ts"),
    [
      "import { answer } from './sample.js';",
      "",
      "export function ask() {",
      "  return answer();",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "docs", "guide.md"),
    "# Guide\n\nThis is the docs fixture.\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "docs", "multibyte.md"),
    "你好世界，reviewer baseline。\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "docs", "sample.pdf"),
    createMinimalPdfBuffer("Hello PDF from Praxis tests"),
  );
  await writeFile(
    path.join(root, "docs", "sample.docx"),
    Buffer.from(SIMPLE_DOCX_BASE64, "base64"),
  );
  await writeFile(
    path.join(root, "docs", "tiny.png"),
    Buffer.from(TINY_PNG_BASE64, "base64"),
  );
  await writeFile(
    path.join(root, "data", "sample.csv"),
    "Name,Value\nAlpha,42\nBeta,7\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "data", "sample.tsv"),
    "Name\tValue\nGamma\t8\nDelta\t9\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "data", "sample.xlsx"),
    Buffer.from(SIMPLE_XLSX_BASE64, "base64"),
  );
  await writeFile(
    path.join(root, "notebooks", "demo.ipynb"),
    JSON.stringify({
      cells: [
        {
          cell_type: "markdown",
          id: "intro",
          source: ["# Demo Notebook\n", "\n", "This is a notebook fixture.\n"],
          metadata: {},
        },
        {
          cell_type: "code",
          id: "calc",
          execution_count: 1,
          source: ["answer = 42\n", "answer\n"],
          outputs: [
            {
              output_type: "execute_result",
              data: {
                "text/plain": ["42"],
              },
              metadata: {},
              execution_count: 1,
            },
          ],
          metadata: {},
        },
      ],
      metadata: {
        language_info: {
          name: "python",
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    }, null, 2),
    "utf8",
  );
  await writeFile(path.join(root, "README.md"), "# Fixture\n", "utf8");
  return root;
}

test("workspace read adapter reads scoped code snippets with line ranges", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.read",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-read-1",
      sessionId: "session-code-read-1",
      runId: "run-code-read-1",
      capabilityKey: "code.read",
      input: {
        path: "src/sample.ts",
        operation: "read_lines",
        lineStart: 1,
        lineEnd: 2,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-read-1",
    },
  );
  const lease = createCapabilityLease(
    {
      capabilityId: "cap-code-read-1",
      bindingId: "binding-code-read-1",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease-code-read-1",
      clock: {
        now: () => new Date("2026-03-24T10:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { path: string }).path, "src/sample.ts");
  assert.match((envelope.output as { content: string }).content, /return 42/);
});

test("workspace read adapter blocks docs.read from escaping into code scope", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "docs.read",
    allowedPathPatterns: ["docs", "docs/**", "README.md", "*.md"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-docs-read-1",
      sessionId: "session-docs-read-1",
      runId: "run-docs-read-1",
      capabilityKey: "docs.read",
      input: {
        path: "src/sample.ts",
        operation: "read_file",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-docs-read-1",
    },
  );
  const lease = createCapabilityLease(
    {
      capabilityId: "cap-docs-read-1",
      bindingId: "binding-docs-read-1",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease-docs-read-1",
      clock: {
        now: () => new Date("2026-03-24T10:05:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "blocked");
  assert.equal(envelope.error?.code, "workspace_read_path_not_allowed");
});

test("workspace read adapter truncates multibyte content by byte budget and clears prepared state after execution", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "docs.read",
    allowedPathPatterns: ["docs", "docs/**", "*.md"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-docs-read-utf8-1",
      sessionId: "session-docs-read-utf8-1",
      runId: "run-docs-read-utf8-1",
      capabilityKey: "docs.read",
      input: {
        path: "docs/multibyte.md",
        operation: "read_file",
        maxBytes: 7,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-docs-read-utf8-1",
    },
  );
  const lease = createCapabilityLease(
    {
      capabilityId: "cap-docs-read-utf8-1",
      bindingId: "binding-docs-read-utf8-1",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease-docs-read-utf8-1",
      clock: {
        now: () => new Date("2026-03-24T10:07:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const firstEnvelope = await adapter.execute(prepared);
  const secondEnvelope = await adapter.execute(prepared);

  assert.equal(firstEnvelope.status, "partial");
  assert.equal(
    Buffer.byteLength(
      (firstEnvelope.output as { content: string }).content,
      "utf8",
    ) <= 7,
    true,
  );
  assert.equal(firstEnvelope.metadata?.readOnly, true);
  assert.equal(firstEnvelope.metadata?.scopeKind, "workspace-docs");
  assert.equal(secondEnvelope.status, "failed");
  assert.equal(
    secondEnvelope.error?.code,
    "workspace_read_prepared_input_missing",
  );
});

test("workspace read adapter supports code.ls for bounded directory listing", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.ls",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-ls-1",
      sessionId: "session-code-ls-1",
      runId: "run-code-ls-1",
      capabilityKey: "code.ls",
      input: {
        path: "src",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-ls-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-ls-1",
    bindingId: "binding-code-ls-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-ls-1",
    clock: { now: () => new Date("2026-04-09T00:00:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { operation?: string }).operation, "list_dir");
  assert.equal(
    (envelope.output as { entries?: Array<{ name: string }> }).entries?.some((entry) => entry.name === "sample.ts"),
    true,
  );
});

test("workspace read adapter supports code.glob pattern discovery", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.glob",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-glob-1",
      sessionId: "session-code-glob-1",
      runId: "run-code-glob-1",
      capabilityKey: "code.glob",
      input: {
        path: "src",
        pattern: "src/**/*.ts",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-glob-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-glob-1",
    bindingId: "binding-code-glob-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-glob-1",
    clock: { now: () => new Date("2026-04-09T00:01:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.deepEqual((envelope.output as { matches?: string[] }).matches, ["src/consumer.ts", "src/sample.ts"]);
});

test("workspace read adapter supports code.grep with bounded content hits", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.grep",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-grep-1",
      sessionId: "session-code-grep-1",
      runId: "run-code-grep-1",
      capabilityKey: "code.grep",
      input: {
        path: "src",
        pattern: "answer",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-grep-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-grep-1",
    bindingId: "binding-code-grep-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-grep-1",
    clock: { now: () => new Date("2026-04-09T00:02:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { matches?: Array<{ path: string }> }).matches?.some((entry) => entry.path === "src/sample.ts"),
    true,
  );
});

test("workspace read adapter supports code.read_many via include globs", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.read_many",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-read-many-1",
      sessionId: "session-code-read-many-1",
      runId: "run-code-read-many-1",
      capabilityKey: "code.read_many",
      input: {
        path: "src",
        include: ["src/**/*.ts"],
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-read-many-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-read-many-1",
    bindingId: "binding-code-read-many-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-read-many-1",
    clock: { now: () => new Date("2026-04-09T00:03:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { count?: number }).count, 2);
  assert.equal(
    (envelope.output as { documents?: Array<{ path: string }> }).documents?.some((entry) => entry.path === "src/sample.ts"),
    true,
  );
});

test("workspace read adapter supports read_pdf via bounded text extraction", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "read_pdf",
    allowedPathPatterns: ["docs", "docs/**", "*.pdf", "**/*.pdf"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-read-pdf-1",
      sessionId: "session-read-pdf-1",
      runId: "run-read-pdf-1",
      capabilityKey: "read_pdf",
      input: {
        path: "docs/sample.pdf",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-read-pdf-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-read-pdf-1",
    bindingId: "binding-read-pdf-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-read-pdf-1",
    clock: { now: () => new Date("2026-04-09T00:04:30.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.match(String((envelope.output as { content?: string }).content), /Hello PDF/);
  assert.equal((envelope.output as { pageCount?: number }).pageCount, 1);
});

test("workspace read adapter supports spreadsheet.read for csv and xlsx summaries", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "spreadsheet.read",
    allowedPathPatterns: ["data", "data/**", "*.csv", "**/*.csv", "*.tsv", "**/*.tsv", "*.xlsx", "**/*.xlsx"],
  });

  const csvPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-spreadsheet-read-csv-1",
      sessionId: "session-spreadsheet-read-csv-1",
      runId: "run-spreadsheet-read-csv-1",
      capabilityKey: "spreadsheet.read",
      input: {
        path: "data/sample.csv",
        maxEntries: 1,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-spreadsheet-read-csv-1",
    },
  );
  const csvPrepared = await adapter.prepare(csvPlan, createCapabilityLease({
    capabilityId: "cap-spreadsheet-read-csv-1",
    bindingId: "binding-spreadsheet-read-csv-1",
    generation: 1,
    plan: csvPlan,
  }, {
    idFactory: () => "lease-spreadsheet-read-csv-1",
    clock: { now: () => new Date("2026-04-09T00:04:40.000Z") },
  }));
  const csvEnvelope = await adapter.execute(csvPrepared);
  assert.equal(csvEnvelope.status, "partial");
  assert.equal((csvEnvelope.output as { format?: string }).format, "csv");
  assert.equal((csvEnvelope.output as { sheetCount?: number }).sheetCount, 1);
  assert.equal((csvEnvelope.output as { returnedSheetCount?: number }).returnedSheetCount, 1);
  assert.deepEqual((csvEnvelope.output as { sheets?: Array<{ headers?: string[] }> }).sheets?.[0]?.headers, ["Name", "Value"]);
  assert.deepEqual((csvEnvelope.output as { sheets?: Array<{ rows?: string[][] }> }).sheets?.[0]?.rows?.[0], ["Alpha", "42"]);
  assert.equal((csvEnvelope.output as { sheets?: Array<{ returnedRowCount?: number }> }).sheets?.[0]?.returnedRowCount, 1);
  assert.equal((csvEnvelope.output as { sheets?: Array<{ omittedRowCount?: number }> }).sheets?.[0]?.omittedRowCount, 1);

  const xlsxPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-spreadsheet-read-xlsx-1",
      sessionId: "session-spreadsheet-read-xlsx-1",
      runId: "run-spreadsheet-read-xlsx-1",
      capabilityKey: "spreadsheet.read",
      input: {
        path: "data/sample.xlsx",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-spreadsheet-read-xlsx-1",
    },
  );
  const xlsxPrepared = await adapter.prepare(xlsxPlan, createCapabilityLease({
    capabilityId: "cap-spreadsheet-read-xlsx-1",
    bindingId: "binding-spreadsheet-read-xlsx-1",
    generation: 1,
    plan: xlsxPlan,
  }, {
    idFactory: () => "lease-spreadsheet-read-xlsx-1",
    clock: { now: () => new Date("2026-04-09T00:04:41.000Z") },
  }));
  const xlsxEnvelope = await adapter.execute(xlsxPrepared);
  assert.equal(xlsxEnvelope.status, "success");
  assert.equal((xlsxEnvelope.output as { format?: string }).format, "xlsx");
  assert.equal((xlsxEnvelope.output as { sheetCount?: number }).sheetCount, 1);
  assert.equal((xlsxEnvelope.output as { returnedSheetCount?: number }).returnedSheetCount, 1);
  assert.equal((xlsxEnvelope.output as { sheets?: Array<{ name?: string }> }).sheets?.[0]?.name, "Sheet1");
  assert.deepEqual((xlsxEnvelope.output as { sheets?: Array<{ rows?: string[][] }> }).sheets?.[0]?.rows?.[0], ["Alpha", "42"]);
  assert.equal((xlsxEnvelope.output as { sheets?: Array<{ returnedRowCount?: number }> }).sheets?.[0]?.returnedRowCount, 2);
  assert.equal((xlsxEnvelope.output as { sheets?: Array<{ omittedRowCount?: number }> }).sheets?.[0]?.omittedRowCount, 0);
});

test("workspace read adapter hardens spreadsheet.read sheet handling", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "spreadsheet.read",
    allowedPathPatterns: ["data", "data/**", "*.csv", "**/*.csv", "*.tsv", "**/*.tsv", "*.xlsx", "**/*.xlsx"],
  });

  const csvSheetPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-spreadsheet-read-csv-sheet-1",
      sessionId: "session-spreadsheet-read-csv-sheet-1",
      runId: "run-spreadsheet-read-csv-sheet-1",
      capabilityKey: "spreadsheet.read",
      input: {
        path: "data/sample.csv",
        sheet: "Sheet1",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-spreadsheet-read-csv-sheet-1",
    },
  );

  const csvSheetPrepared = await adapter.prepare(csvSheetPlan, createCapabilityLease({
    capabilityId: "cap-spreadsheet-read-csv-sheet-1",
    bindingId: "binding-spreadsheet-read-csv-sheet-1",
    generation: 1,
    plan: csvSheetPlan,
  }, {
    idFactory: () => "lease-spreadsheet-read-csv-sheet-1",
    clock: { now: () => new Date("2026-04-09T00:04:42.500Z") },
  }));
  const csvSheetEnvelope = await adapter.execute(csvSheetPrepared);
  assert.equal(csvSheetEnvelope.status, "failed");
  assert.match(csvSheetEnvelope.error?.message ?? "", /does not support sheet selection/i);

  const missingSheetPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-spreadsheet-read-xlsx-missing-sheet-1",
      sessionId: "session-spreadsheet-read-xlsx-missing-sheet-1",
      runId: "run-spreadsheet-read-xlsx-missing-sheet-1",
      capabilityKey: "spreadsheet.read",
      input: {
        path: "data/sample.xlsx",
        sheet: "MissingSheet",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-spreadsheet-read-xlsx-missing-sheet-1",
    },
  );

  const missingSheetPrepared = await adapter.prepare(missingSheetPlan, createCapabilityLease({
    capabilityId: "cap-spreadsheet-read-xlsx-missing-sheet-1",
    bindingId: "binding-spreadsheet-read-xlsx-missing-sheet-1",
    generation: 1,
    plan: missingSheetPlan,
  }, {
    idFactory: () => "lease-spreadsheet-read-xlsx-missing-sheet-1",
    clock: { now: () => new Date("2026-04-09T00:04:42.600Z") },
  }));
  const missingSheetEnvelope = await adapter.execute(missingSheetPrepared);
  assert.equal(missingSheetEnvelope.status, "failed");
  assert.match(missingSheetEnvelope.error?.message ?? "", /Requested sheet not found/i);
});

test("workspace read adapter supports doc.read for bounded docx summaries", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "doc.read",
    allowedPathPatterns: ["docs", "docs/**", "*.docx", "**/*.docx"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-doc-read-1",
      sessionId: "session-doc-read-1",
      runId: "run-doc-read-1",
      capabilityKey: "doc.read",
      input: {
        path: "docs/sample.docx",
        maxEntries: 1,
        maxBytes: 64,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-doc-read-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-doc-read-1",
    bindingId: "binding-doc-read-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-doc-read-1",
    clock: { now: () => new Date("2026-04-09T00:04:42.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "partial");
  assert.equal((envelope.output as { format?: string }).format, "docx");
  assert.equal((envelope.output as { paragraphCount?: number }).paragraphCount, 2);
  assert.equal((envelope.output as { returnedParagraphCount?: number }).returnedParagraphCount, 1);
  assert.equal((envelope.output as { omittedParagraphCount?: number }).omittedParagraphCount, 1);
  assert.equal((envelope.output as { tableCount?: number }).tableCount, 1);
  assert.match(String((envelope.output as { content?: string }).content), /Praxis doc read fixture/);
  assert.equal((envelope.output as { paragraphs?: string[] }).paragraphs?.[0], "Praxis doc read fixture");
  assert.deepEqual((envelope.output as { tables?: Array<{ rows?: string[][] }> }).tables?.[0]?.rows?.[0], ["Name", "Value"]);
  assert.equal((envelope.output as { tables?: Array<{ returnedRowCount?: number }> }).tables?.[0]?.returnedRowCount, 1);
});

test("workspace read adapter supports read_notebook via structured cell summaries", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "read_notebook",
    allowedPathPatterns: ["notebooks", "notebooks/**", "*.ipynb", "**/*.ipynb"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-read-notebook-1",
      sessionId: "session-read-notebook-1",
      runId: "run-read-notebook-1",
      capabilityKey: "read_notebook",
      input: {
        path: "notebooks/demo.ipynb",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-read-notebook-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-read-notebook-1",
    bindingId: "binding-read-notebook-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-read-notebook-1",
    clock: { now: () => new Date("2026-04-09T00:04:45.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { cellCount?: number }).cellCount, 2);
  assert.equal((envelope.output as { cells?: Array<{ cellId: string }> }).cells?.[0]?.cellId, "intro");
  assert.equal((envelope.output as { cells?: Array<{ outputs?: string[] }> }).cells?.[1]?.outputs?.[0], "42");
});

test("workspace read adapter supports view_image via data-url output", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "view_image",
    allowedPathPatterns: ["docs", "docs/**", "*.png", "**/*.png"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-view-image-1",
      sessionId: "session-view-image-1",
      runId: "run-view-image-1",
      capabilityKey: "view_image",
      input: {
        path: "docs/tiny.png",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-view-image-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-view-image-1",
    bindingId: "binding-view-image-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-view-image-1",
    clock: { now: () => new Date("2026-04-09T00:04:50.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { mimeType?: string }).mimeType, "image/png");
  assert.match(String((envelope.output as { imageUrl?: string }).imageUrl), /^data:image\/png;base64,/);
});

test("workspace read adapter supports code.symbol_search via TypeScript workspace symbol search", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.symbol_search",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-symbol-search-1",
      sessionId: "session-code-symbol-search-1",
      runId: "run-code-symbol-search-1",
      capabilityKey: "code.symbol_search",
      input: {
        path: ".",
        query: "answer",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-symbol-search-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-symbol-search-1",
    bindingId: "binding-code-symbol-search-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-symbol-search-1",
    clock: { now: () => new Date("2026-04-09T00:04:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { backend?: string }).backend, "typescript-language-service");
  assert.equal((envelope.output as { matches?: Array<{ name: string }> }).matches?.[0]?.name, "answer");
});

test("workspace read adapter supports code.lsp document symbols", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.lsp",
    allowedPathPatterns: ["src", "src/**"],
  });
  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-lsp-doc-1",
      sessionId: "session-code-lsp-doc-1",
      runId: "run-code-lsp-doc-1",
      capabilityKey: "code.lsp",
      input: {
        path: "src/sample.ts",
        operation: "document_symbol",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-lsp-doc-1",
    },
  );
  const prepared = await adapter.prepare(plan, createCapabilityLease({
    capabilityId: "cap-code-lsp-doc-1",
    bindingId: "binding-code-lsp-doc-1",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease-code-lsp-doc-1",
    clock: { now: () => new Date("2026-04-09T00:05:00.000Z") },
  }));
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { symbols?: Array<{ name: string }> }).symbols?.[0]?.name, "answer");
});

test("workspace read adapter supports code.lsp definitions and references", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const adapter = createWorkspaceReadCapabilityAdapter({
    workspaceRoot,
    capabilityKey: "code.lsp",
    allowedPathPatterns: ["src", "src/**"],
  });

  const definitionPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-lsp-def-1",
      sessionId: "session-code-lsp-def-1",
      runId: "run-code-lsp-def-1",
      capabilityKey: "code.lsp",
      input: {
        path: "src/consumer.ts",
        operation: "definition",
        line: 4,
        character: 10,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-lsp-def-1",
    },
  );
  const definitionPrepared = await adapter.prepare(definitionPlan, createCapabilityLease({
    capabilityId: "cap-code-lsp-def-1",
    bindingId: "binding-code-lsp-def-1",
    generation: 1,
    plan: definitionPlan,
  }, {
    idFactory: () => "lease-code-lsp-def-1",
    clock: { now: () => new Date("2026-04-09T00:06:00.000Z") },
  }));
  const definitionEnvelope = await adapter.execute(definitionPrepared);
  assert.equal(definitionEnvelope.status, "success");
  assert.equal((definitionEnvelope.output as { definitions?: Array<{ path: string }> }).definitions?.[0]?.path, "src/sample.ts");

  const referencesPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent-code-lsp-refs-1",
      sessionId: "session-code-lsp-refs-1",
      runId: "run-code-lsp-refs-1",
      capabilityKey: "code.lsp",
      input: {
        path: "src/sample.ts",
        operation: "references",
        line: 1,
        character: 17,
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan-code-lsp-refs-1",
    },
  );
  const referencesPrepared = await adapter.prepare(referencesPlan, createCapabilityLease({
    capabilityId: "cap-code-lsp-refs-1",
    bindingId: "binding-code-lsp-refs-1",
    generation: 1,
    plan: referencesPlan,
  }, {
    idFactory: () => "lease-code-lsp-refs-1",
    clock: { now: () => new Date("2026-04-09T00:07:00.000Z") },
  }));
  const referencesEnvelope = await adapter.execute(referencesPrepared);
  assert.equal(referencesEnvelope.status, "success");
  assert.equal(
    (referencesEnvelope.output as { references?: Array<{ path: string }> }).references?.some((entry) => entry.path === "src/consumer.ts"),
    true,
  );
});

test("workspace read baseline registration lets TAP dispatch docs.read through the pooled baseline path", async () => {
  const workspaceRoot = await createWorkspaceFixture();
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.workspace-read-baseline",
      agentClass: "reviewer",
      baselineCapabilities: ["docs.read", "code.read"],
    }),
  });
  const registration = registerFirstClassToolingBaselineCapabilities({
    runtime,
    workspaceRoot,
  });

  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: "goal-workspace-read-baseline",
      sessionId: session.sessionId,
      userInput: "Use docs.read through the TAP baseline.",
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });
  const intent: CapabilityCallIntent = {
    intentId: "intent-workspace-read-baseline-1",
    sessionId: session.sessionId,
    runId: created.run.runId,
    kind: "capability_call",
    createdAt: "2026-03-24T10:10:00.000Z",
    priority: "normal",
    request: {
      requestId: "request-workspace-read-baseline-1",
      intentId: "intent-workspace-read-baseline-1",
      sessionId: session.sessionId,
      runId: created.run.runId,
      capabilityKey: "docs.read",
      input: {
        path: "docs/guide.md",
        operation: "read_file",
      },
      priority: "normal",
    },
  };

  const result = await runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "reviewer-agent",
    requestedTier: "B0",
    mode: "standard",
    reason:
      "Reviewer baseline should read project docs without review friction.",
  });

  assert.equal(result.status, "dispatched");
  assert.equal(result.grant?.capabilityKey, "docs.read");
  assert.deepEqual(
    registration.capabilityKeys,
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );
  assert.deepEqual(
    registration.descriptors.map((entry) => entry.capabilityKey),
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );
  assert.equal(
    registration.descriptors.find((entry) => entry.capabilityKey === "docs.read")?.scopeKind,
    "workspace-docs",
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  const resultEvent = runtime
    .readRunEvents(created.run.runId)
    .find((entry) => entry.event.type === "capability.result_received");
  assert.ok(resultEvent);
  assert.equal(resultEvent?.event.metadata?.scopeKind, "workspace-docs");
  assert.equal(resultEvent?.event.metadata?.readOnly, true);
});
