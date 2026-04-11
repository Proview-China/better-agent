import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCliDefaultsToCapabilityRequest,
  buildSpreadsheetReadCompletionAnswer,
  extractSpreadsheetReadFactSummary,
  normalizeCoreTaskStatus,
  parseCliOptions,
  parseCoreActionEnvelope,
  parseTapRequest,
  shouldStopCoreCapabilityLoop,
  summarizeToolOutputForCore,
  trimStructuredValue,
} from "./shared.js";

test("parseCliOptions reads once, history-turns, and direct ui mode", () => {
  const options = parseCliOptions([
    "--once",
    "hello",
    "--history-turns",
    "9",
    "--ui",
    "direct",
  ]);

  assert.deepEqual(options, {
    once: "hello",
    historyTurns: 9,
    uiMode: "direct",
  });
});

test("parseCoreActionEnvelope parses reply and capability_call envelopes", () => {
  const reply = parseCoreActionEnvelope("{\"action\":\"reply\",\"responseText\":\"ok\"}");
  assert.equal(reply.action, "reply");
  assert.equal(reply.responseText, "ok");
  assert.equal(reply.taskStatus, undefined);
  assert.equal(normalizeCoreTaskStatus(reply), "completed");

  const capability = parseCoreActionEnvelope(JSON.stringify({
    action: "capability_call",
    taskStatus: "incomplete",
    responseText: "先查一下",
    capabilityRequest: {
      capabilityKey: "code.read",
      reason: "需要看文件",
      input: {
        path: "src/index.ts",
      },
      requestedTier: "B0",
      timeoutMs: 15000,
    },
  }));
  assert.equal(capability.action, "capability_call");
  assert.equal(capability.taskStatus, "incomplete");
  assert.equal(capability.capabilityRequest?.capabilityKey, "code.read");
  assert.equal(capability.capabilityRequest?.timeoutMs, 15000);
  assert.equal(normalizeCoreTaskStatus(capability), "incomplete");
});

test("parseCoreActionEnvelope maps legacy completed envelopes onto reply completion semantics", () => {
  const reply = parseCoreActionEnvelope("{\"completed\":true,\"responseText\":\"done\"}");

  assert.equal(reply.action, "reply");
  assert.equal(reply.responseText, "done");
  assert.equal(reply.taskStatus, "completed");
  assert.equal(normalizeCoreTaskStatus(reply), "completed");
});

test("parseCoreActionEnvelope rejects invalid taskStatus values", () => {
  assert.throws(
    () => parseCoreActionEnvelope("{\"action\":\"reply\",\"responseText\":\"ok\",\"taskStatus\":\"maybe\"}"),
    /taskStatus/i,
  );
});

test("parseTapRequest parses shell restricted request blocks", () => {
  const request = parseTapRequest(`
[TAP REQUEST]
capability: shell.restricted
command: npm test
cwd: .
`);

  assert.equal(request?.capabilityKey, "shell.restricted");
  assert.deepEqual(request?.input, {
    command: "zsh",
    args: ["-lc", "npm test"],
    cwd: ".",
    timeoutMs: 20_000,
  });
});

test("shouldStopCoreCapabilityLoop stops on hard-stop statuses or loop budget", () => {
  assert.equal(shouldStopCoreCapabilityLoop({
    capabilityResultStatus: "success",
    completedLoops: 1,
    maxLoops: 4,
  }), false);
  assert.equal(shouldStopCoreCapabilityLoop({
    capabilityResultStatus: "failed",
    completedLoops: 1,
    maxLoops: 4,
  }), false);
  assert.equal(shouldStopCoreCapabilityLoop({
    capabilityResultStatus: "blocked",
    completedLoops: 1,
    maxLoops: 4,
  }), true);
  assert.equal(shouldStopCoreCapabilityLoop({
    capabilityResultStatus: "review_required",
    completedLoops: 1,
    maxLoops: 4,
  }), true);
  assert.equal(shouldStopCoreCapabilityLoop({
    capabilityResultStatus: "success",
    completedLoops: 4,
    maxLoops: 4,
  }), true);
});

test("applyCliDefaultsToCapabilityRequest rewrites legacy browser action arrays into navigate", async () => {
  const request = await applyCliDefaultsToCapabilityRequest(
    {
      capabilityKey: "browser.playwright",
      reason: "legacy browser plan",
      input: {
        url: "https://example.com",
        actions: [
          { type: "navigate", url: "https://example.com" },
          { type: "get_title" },
          { type: "screenshot", fullPage: true },
        ],
      },
    },
    { model: "gpt-5.4" } as never,
    "用浏览器打开 https://example.com 并截图",
  );

  assert.equal(request.input.action, "navigate");
  assert.equal(request.input.url, "https://example.com");
  assert.equal(request.input.headless, false);
});

test("applyCliDefaultsToCapabilityRequest inherits previous browser session settings", async () => {
  const request = await applyCliDefaultsToCapabilityRequest(
    {
      capabilityKey: "browser.playwright",
      reason: "follow-up screenshot",
      input: {
        action: "screenshot",
      },
    },
    { model: "gpt-5.4" } as never,
    "继续截图页面直到完成",
    {
      headless: true,
      browser: "chrome",
      isolated: true,
    },
  );

  assert.equal(request.input.action, "screenshot");
  assert.equal(request.input.headless, true);
  assert.equal(request.input.browser, "chrome");
  assert.equal(request.input.isolated, true);
});

test("trimStructuredValue summarizes image data URLs instead of keeping raw base64", () => {
  const trimmed = trimStructuredValue({
    imageUrls: [
      "data:image/png;base64,ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ],
  }) as { imageUrls?: Array<Record<string, unknown>> };

  assert.equal(trimmed.imageUrls?.[0]?.kind, "data_url");
  assert.equal(trimmed.imageUrls?.[0]?.mimeType, "image/png");
});

test("extractSpreadsheetReadFactSummary keeps first sheet headers and rows visible for core", () => {
  const summary = extractSpreadsheetReadFactSummary({
    capabilityKey: "spreadsheet.read",
    path: "memory/generated/p2-spreadsheet-smoke.xlsx",
    format: "xlsx",
    sheetCount: 1,
    returnedSheetCount: 1,
    sheets: [
      {
        name: "Sheet1",
        rowCount: 2,
        returnedRowCount: 2,
        omittedRowCount: 0,
        columnCount: 3,
        headers: ["item", "price", "unit"],
        rows: [
          ["gold", "4755.44", "usd/oz"],
          ["silver", "31.2", "usd/oz"],
        ],
      },
    ],
  });

  assert.equal(summary?.firstSheet?.name, "Sheet1");
  assert.deepEqual(summary?.firstSheet?.headers, ["item", "price", "unit"]);
  assert.deepEqual(summary?.firstSheet?.rows?.[0], ["gold", "4755.44", "usd/oz"]);
  assert.match(buildSpreadsheetReadCompletionAnswer(summary) ?? "", /第1行: gold, 4755\.44, usd\/oz/u);
});

test("summarizeToolOutputForCore exposes spreadsheet row facts instead of opaque truncation only", () => {
  const text = summarizeToolOutputForCore("spreadsheet.read", {
    capabilityKey: "spreadsheet.read",
    path: "memory/generated/p2-spreadsheet-smoke.xlsx",
    format: "xlsx",
    sheetCount: 1,
    returnedSheetCount: 1,
    sheets: [
      {
        name: "Sheet1",
        rowCount: 2,
        returnedRowCount: 2,
        omittedRowCount: 0,
        columnCount: 3,
        headers: ["item", "price", "unit"],
        rows: [
          ["gold", 4755.44, "usd/oz"],
          ["silver", 31.2, "usd/oz"],
        ],
      },
    ],
  });

  assert.match(text, /"firstSheet"/u);
  assert.match(text, /"headers": \[/u);
  assert.match(text, /4755\.44/u);
});

test("summarizeToolOutputForCore exposes doc.read paragraph and table facts", () => {
  const text = summarizeToolOutputForCore("doc.read", {
    capabilityKey: "doc.read",
    path: "docs/sample.docx",
    format: "docx",
    paragraphCount: 2,
    returnedParagraphCount: 1,
    omittedParagraphCount: 1,
    tableCount: 1,
    paragraphs: ["Praxis doc read fixture"],
    content: "Praxis doc read fixture\nName | Value",
    tables: [
      {
        rowCount: 2,
        returnedRowCount: 1,
        omittedRowCount: 1,
        columnCount: 2,
        rows: [["Name", "Value"]],
      },
    ],
  });

  assert.match(text, /"paragraphCount": 2/u);
  assert.match(text, /"tableCount": 1/u);
  assert.match(text, /"contentExcerpt": "Praxis doc read fixture\\nName \| Value"/u);
  assert.match(text, /"firstTable"/u);
});

test("summarizeToolOutputForCore exposes search.fetch backend and fallback facts", () => {
  const text = summarizeToolOutputForCore("search.fetch", {
    capabilityKey: "search.fetch",
    prompt: "extract current facts",
    urlCount: 1,
    selectedBackend: "anthropic-claude-code-native",
    resolvedBackend: "portable-fallback",
    fallbackApplied: true,
    fallbackReasonCode: "search_fetch_http_error",
    fallbackReasonPhase: "response",
    fallbackReasonClass: "http_error",
    pages: [
      {
        url: "https://example.com/page",
        finalUrl: "https://example.com/page",
        backend: "portable-fallback",
        transport: "jina",
        status: 200,
        content: "Portable fallback content",
      },
    ],
  });

  assert.match(text, /"selectedBackend": "anthropic-claude-code-native"/u);
  assert.match(text, /"resolvedBackend": "portable-fallback"/u);
  assert.match(text, /"fallbackApplied": true/u);
  assert.match(text, /"fallbackReasonClass": "http_error"/u);
  assert.match(text, /"transport": "jina"/u);
});
