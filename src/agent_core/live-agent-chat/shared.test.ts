import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCliDefaultsToCapabilityRequest,
  buildDocReadCompletionAnswer,
  buildSpreadsheetReadCompletionAnswer,
  createCapabilityFamilyTelemetry,
  createCoreContextSnapshot,
  decodeEscapedDisplayTextMaybe,
  estimateContextTokens,
  extractReplyResponseTextFromPartialEnvelope,
  extractResponseTextMaybe,
  extractResponseTextFromPartialEnvelope,
  extractSpreadsheetReadFactSummary,
  normalizeCoreTaskStatus,
  parseCliOptions,
  parseCoreActionEnvelope,
  parseDirectInitRequestEnvelope,
  parseDirectQuestionAnswerEnvelope,
  parseDirectUserInputEnvelope,
  parseTapRequest,
  resolveContextWindowProfile,
  shouldStopCoreCapabilityLoop,
  summarizeToolOutputForCore,
  trimStructuredValue,
} from "./shared.js";
import {
  resolveCapabilityFamilyDefinition,
  resolveFamilyOutcomeKind,
} from "./family-telemetry.js";

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

test("parseDirectUserInputEnvelope accepts direct image attachments and ignores plain text", () => {
  assert.equal(parseDirectUserInputEnvelope("hello"), undefined);

  assert.deepEqual(
    parseDirectUserInputEnvelope(JSON.stringify({
      type: "direct_user_input",
      text: "请看 [Image #1]",
      attachments: [
        {
          id: "img-1",
          tokenText: "[Image #1]",
          sourceKind: "clipboard",
          localPath: "/tmp/test.png",
        },
      ],
    })),
    {
      type: "direct_user_input",
      text: "请看 [Image #1]",
      attachments: [
        {
          id: "img-1",
          tokenText: "[Image #1]",
          sourceKind: "clipboard",
          localPath: "/tmp/test.png",
        },
      ],
    },
  );

  assert.deepEqual(
    parseDirectUserInputEnvelope(JSON.stringify({
      type: "direct_user_input",
      text: "请处理 [Pasted Content #1 with 2600 characters]",
      pastedContents: [
        {
          id: "paste-1",
          tokenText: "[Pasted Content #1 with 2600 characters]",
          text: "A".repeat(2600),
          characterCount: 2600,
        },
      ],
    })),
    {
      type: "direct_user_input",
      text: "请处理 [Pasted Content #1 with 2600 characters]",
      pastedContents: [
        {
          id: "paste-1",
          tokenText: "[Pasted Content #1 with 2600 characters]",
          text: "A".repeat(2600),
          characterCount: 2600,
        },
      ],
    },
  );

  assert.deepEqual(
    parseDirectUserInputEnvelope(JSON.stringify({
      type: "direct_user_input",
      text: "请看 @src/agent_core/direct-tui.tsx",
      fileRefs: [
        {
          id: "file-1",
          tokenText: "@src/agent_core/direct-tui.tsx",
          relativePath: "src/agent_core/direct-tui.tsx",
          absolutePath: "/tmp/repo/src/agent_core/direct-tui.tsx",
        },
      ],
    })),
    {
      type: "direct_user_input",
      text: "请看 @src/agent_core/direct-tui.tsx",
      fileRefs: [
        {
          id: "file-1",
          tokenText: "@src/agent_core/direct-tui.tsx",
          relativePath: "src/agent_core/direct-tui.tsx",
          absolutePath: "/tmp/repo/src/agent_core/direct-tui.tsx",
        },
      ],
    },
  );
});

test("parseDirectInitRequestEnvelope accepts init requests and ignores plain text", () => {
  assert.equal(parseDirectInitRequestEnvelope("hello"), undefined);
  assert.deepEqual(
    parseDirectInitRequestEnvelope(JSON.stringify({
      type: "direct_init_request",
      text: "请把当前项目目标和成功标准整理成初始化上下文。",
    })),
    {
      type: "direct_init_request",
      text: "请把当前项目目标和成功标准整理成初始化上下文。",
    },
  );
});

test("parseDirectQuestionAnswerEnvelope accepts structured answers and ignores plain text", () => {
  assert.equal(parseDirectQuestionAnswerEnvelope("hello"), undefined);
  assert.deepEqual(
    parseDirectQuestionAnswerEnvelope(JSON.stringify({
      type: "direct_question_answer",
      requestId: "question-1",
      answers: [
        {
          questionId: "lang",
          selectedOptionId: "go",
          selectedOptionLabel: "Golang",
          annotation: "我想使用完全原生的 Go 技术栈。",
        },
      ],
      currentIndex: 0,
      isFinal: true,
    })),
    {
      type: "direct_question_answer",
      requestId: "question-1",
      answers: [
        {
          questionId: "lang",
          selectedOptionId: "go",
          selectedOptionLabel: "Golang",
          annotation: "我想使用完全原生的 Go 技术栈。",
        },
      ],
      currentIndex: 0,
      isFinal: true,
    },
  );
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

test("extractResponseTextFromPartialEnvelope pulls visible assistant text out of an in-flight JSON envelope", () => {
  const partial = "{\"action\":\"reply\",\"taskStatus\":\"completed\",\"responseText\":\"主域名是 platform.open";
  const extracted = extractResponseTextFromPartialEnvelope(partial);

  assert.equal(extracted, "主域名是 platform.open");
});

test("extractReplyResponseTextFromPartialEnvelope only emits body for reply envelopes", () => {
  const replyPartial = "{\"action\":\"reply\",\"taskStatus\":\"completed\",\"responseText\":\"正在逐段输出";
  const capabilityPartial = "{\"action\":\"capability_call\",\"taskStatus\":\"incomplete\",\"responseText\":\"我先调用工具";

  assert.equal(
    extractReplyResponseTextFromPartialEnvelope(replyPartial),
    "正在逐段输出",
  );
  assert.equal(
    extractReplyResponseTextFromPartialEnvelope(capabilityPartial),
    undefined,
  );
});

test("extractResponseTextMaybe falls back to partial envelope responseText when JSON is incomplete", () => {
  const partial = "{\"action\":\"capability_call\",\"taskStatus\":\"incomplete\",\"responseText\":\"先查可用 MCP 连接。\",\"capabilityRequest\":";
  assert.equal(
    extractResponseTextMaybe(partial),
    "先查可用 MCP 连接。",
  );
});

test("extractResponseTextMaybe unwraps fenced JSON envelopes", () => {
  const fenced = [
    "```json",
    "{\"action\":\"reply\",\"taskStatus\":\"completed\",\"responseText\":\"最终正文\"}",
    "```",
  ].join("\n");

  assert.equal(
    extractResponseTextMaybe(fenced),
    "最终正文",
  );
});

test("decodeEscapedDisplayTextMaybe restores escaped paragraphs and unicode text", () => {
  const escaped = "可以。\\n\\n我能直接帮你做这些代码工作：\\n- 写新功能\\n- 改 bug\\n\\u4f60\\u597d";

  assert.equal(
    decodeEscapedDisplayTextMaybe(escaped),
    "可以。\n\n我能直接帮你做这些代码工作：\n- 写新功能\n- 改 bug\n你好",
  );
});

test("decodeEscapedDisplayTextMaybe preserves Windows paths while decoding surrounding text", () => {
  const escaped = "请查看 C:\\new\\test.txt\\n\\n然后继续。";

  assert.equal(
    decodeEscapedDisplayTextMaybe(escaped),
    "请查看 C:\\new\\test.txt\n\n然后继续。",
  );
});

test("decodeEscapedDisplayTextMaybe decodes double-escaped paragraphs in two passes", () => {
  const escaped = "第一段\\\\n\\\\n第二段";

  assert.equal(
    decodeEscapedDisplayTextMaybe(escaped),
    "第一段\n\n第二段",
  );
});

test("resolveContextWindowProfile returns model-family defaults and honors overrides", () => {
  assert.deepEqual(
    resolveContextWindowProfile({
      provider: "openai",
      model: "gpt-5.4",
    }),
    {
      windowTokens: 1_050_000,
      windowSource: "model_family_default",
    },
  );
  assert.deepEqual(
    resolveContextWindowProfile({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
    }),
    {
      windowTokens: 200_000,
      windowSource: "model_family_default",
    },
  );
  assert.deepEqual(
    resolveContextWindowProfile({
      provider: "deepmind",
      model: "gemini-3.1-pro-preview",
      configuredWindowTokens: 777_777,
    }),
    {
      windowTokens: 777_777,
      windowSource: "config_override",
    },
  );
});

test("createCoreContextSnapshot reports prompt token usage from exact prompt text", () => {
  const snapshot = createCoreContextSnapshot({
    provider: "openai",
    model: "gpt-5.4",
    promptKind: "initial",
    promptText: "system\\nuser\\nassistant",
    transcriptText: "user: 你好",
    routePlanWindowTokens: 1_050_000,
  });

  assert.equal(snapshot.windowTokens, 1_050_000);
  assert.equal(snapshot.windowSource, "route_plan");
  assert.equal(snapshot.promptTokens, estimateContextTokens("system\\nuser\\nassistant"));
  assert.equal(snapshot.transcriptTokens, estimateContextTokens("user: 你好"));
});

test("createCapabilityFamilyTelemetry emits self-describing websearch telemetry", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "search.ground",
    requestInput: {
      query: "Tesla price site:finance.yahoo.com OR site:marketwatch.com",
    },
    inputSummary: "Tesla price site:finance.yahoo.com OR site:marketwatch.com",
    status: "success",
    output: {
      selectedBackend: "search.web",
      resolvedBackend: "search.web",
      fallbackApplied: false,
      sources: [
        { title: "Yahoo Finance" },
        { title: "youtube.com" },
      ],
    },
  });

  assert.equal(telemetry?.tapFamilyKey, "websearch");
  assert.equal(telemetry?.familyTitle, "WebSearch");
  assert.equal(telemetry?.familyIntentSummary, "Searching and grounding Tesla price");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Searching and grounding Tesla price succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    selectedBackend: "search.web",
    resolvedBackend: "search.web",
    sourceTitles: ["Yahoo Finance"],
    sourceCount: 2,
  });
});

test("createCapabilityFamilyTelemetry keeps stage_end failure intent and compact metadata for search.fetch", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "search.fetch",
    requestInput: {
      url: "https://example.com",
    },
    inputSummary: "https://example.com",
    status: "failed",
    output: {
      selectedBackend: "openai-native",
      resolvedBackend: "portable-fallback",
      fallbackApplied: true,
      pages: [
        { finalUrl: "https://example.com" },
      ],
    },
    error: {
      code: "search_fetch_tls_handshake_failed",
      details: {
        code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      },
    },
  });

  assert.equal(telemetry?.familyIntentSummary, "Fetching and extracting example.com");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Fetching and extracting example.com failed",
    "Recovered via portable-fallback",
  ]);
  assert.equal(telemetry?.resultMetadata?.errorCode, "search_fetch_tls_handshake_failed");
  assert.equal(telemetry?.resultMetadata?.errorDetailCode, "UNABLE_TO_GET_ISSUER_CERT_LOCALLY");
});

test("createCapabilityFamilyTelemetry emits code family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "code.symbol_search",
    requestInput: {
      query: "LiveChatLogger",
      path: "src",
    },
    status: "success",
    output: {
      resultCount: 4,
      symbols: [{ name: "LiveChatLogger" }, { name: "LiveChatLogEvent" }],
    },
  });

  assert.equal(telemetry?.familyKey, "code");
  assert.equal(telemetry?.familyTitle, "Code");
  assert.equal(telemetry?.familyIntentSummary, "Searching symbols in the codebase");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Searching symbols in the codebase succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetPaths: ["src"],
    pathCount: 1,
    matchCount: 4,
    symbolCount: 2,
  });
});

test("createCapabilityFamilyTelemetry emits docs family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "spreadsheet.read",
    requestInput: {
      path: "data/report.xlsx",
    },
    status: "success",
    output: {
      path: "data/report.xlsx",
      sheetCount: 3,
    },
  });

  assert.equal(telemetry?.familyKey, "docs");
  assert.equal(telemetry?.familyTitle, "Docs");
  assert.equal(telemetry?.familyIntentSummary, "Reading spreadsheet data");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Reading spreadsheet data succeeded",
    "Returned 3 sheets",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetPaths: ["data/report.xlsx"],
    sheetCount: 3,
  });
});

test("createCapabilityFamilyTelemetry emits viewing picture summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "view_image",
    requestInput: {
      sourceKind: "remote_url",
      sourceUrl: "https://example.com/chart.png",
    },
    status: "success",
    output: {
      mimeType: "image/png",
      imageUrl: "data:image/png;base64,abcd",
    },
  });

  assert.equal(telemetry?.familyKey, "viewing_picture");
  assert.equal(telemetry?.familyTitle, "ViewingPicture");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Viewing the provided image succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    sourceKind: "remote_url",
    targetUrl: "https://example.com/chart.png",
    imageCount: 1,
    mimeType: "image/png",
  });
});

test("createCapabilityFamilyTelemetry emits git family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "git.status",
    status: "success",
    output: {
      branch: "integrate/dev-master-cmp",
      changedFiles: ["src/a.ts", "src/b.ts"],
      aheadCount: 1,
      behindCount: 0,
    },
  });

  assert.equal(telemetry?.familyKey, "git");
  assert.equal(telemetry?.familyTitle, "Git");
  assert.equal(telemetry?.familyIntentSummary, "Checking repository status");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Checking repository status succeeded",
    "2 files changed",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    changedFileCount: 2,
    aheadCount: 1,
    behindCount: 0,
    branchName: "integrate/dev-master-cmp",
  });
});

test("createCapabilityFamilyTelemetry emits shell family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "test.run",
    requestInput: {
      cwd: ".",
      command: "npx",
      args: ["tsx", "--test", "src/test.ts"],
    },
    status: "success",
    output: {
      cwd: ".",
      exitCode: 0,
    },
  });

  assert.equal(telemetry?.familyKey, "shell");
  assert.equal(telemetry?.familyTitle, "Shell");
  assert.equal(telemetry?.familyIntentSummary, "Running test command");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Running test command succeeded",
    "Exit code 0",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetPaths: ["."],
  });
});

test("createCapabilityFamilyTelemetry emits browser family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "browser.playwright",
    requestInput: {
      action: "screenshot",
      url: "https://example.com",
    },
    status: "success",
    output: {
      action: "screenshot",
      screenshotPath: ".playwright-mcp/page-1.png",
      imageCount: 1,
    },
  });

  assert.equal(telemetry?.familyKey, "browser");
  assert.equal(telemetry?.familyTitle, "Browser");
  assert.equal(telemetry?.familyIntentSummary, "Running browser automation");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Running browser automation succeeded",
    "Captured 1 item",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetPaths: [".playwright-mcp/page-1.png"],
    itemCount: 1,
  });
});

test("createCapabilityFamilyTelemetry emits repo family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "repo.write",
    requestInput: {
      entries: [
        { path: "src/a.ts", content: "export const a = 1;\n" },
        { path: "src/b.ts", content: "export const b = 2;\n" },
      ],
    },
    status: "success",
    output: {
      writes: [
        { path: "src/a.ts" },
        { path: "src/b.ts" },
      ],
    },
  });

  assert.equal(telemetry?.familyKey, "repo");
  assert.equal(telemetry?.familyTitle, "Repo");
  assert.equal(telemetry?.familyIntentSummary, "Writing repository files");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Writing repository files succeeded",
    "2 files changed",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetPaths: ["src/a.ts", "src/b.ts"],
    changedFileCount: 2,
    itemCount: 2,
  });
});

test("createCapabilityFamilyTelemetry emits mp family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "mp.search",
    requestInput: {
      sourceLineages: [{ agentId: "core", projectId: "praxis", depth: 0 }],
      agentIds: ["worker-a"],
      checkedSnapshotRef: "snap-42",
    },
    status: "success",
    output: {
      hits: [{ id: "m1" }, { id: "m2" }],
      resultCount: 2,
    },
  });

  assert.equal(telemetry?.familyKey, "mp");
  assert.equal(telemetry?.familyTitle, "MemoryPool");
  assert.equal(telemetry?.familyIntentSummary, "Searching memory history");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Searching memory history succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetRefs: ["snap-42", "agent:worker-a", "agent:core"],
    resultCount: 2,
  });
});

test("createCapabilityFamilyTelemetry keeps mp targetRefs visible during stage_start", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "mp.search",
    requestInput: {
      sourceLineages: [{ agentId: "dispatcher", projectId: "praxis", depth: 1 }],
      agentIds: ["main"],
    },
  });

  assert.equal(telemetry?.familyIntentSummary, "Searching memory history");
  assert.equal(telemetry?.familyResultSummary, undefined);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetRefs: ["agent:main", "agent:dispatcher"],
  });
});

test("createCapabilityFamilyTelemetry emits mcp family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "mcp.call",
    requestInput: {
      input: {
        connectionId: "conn-1",
        toolName: "browser.search",
      },
    },
    status: "success",
    output: {
      connectionId: "conn-1",
      toolName: "browser.search",
      content: [{ type: "text" }],
    },
  });

  assert.equal(telemetry?.familyKey, "mcp");
  assert.equal(telemetry?.familyTitle, "MCP");
  assert.equal(telemetry?.familyIntentSummary, "Calling MCP tool");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Calling MCP tool succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetName: "conn-1",
    toolName: "browser.search",
    itemCount: 1,
  });
});

test("createCapabilityFamilyTelemetry keeps mcp.native.execute request identifiers on failure", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "mcp.native.execute",
    requestInput: {
      input: {
        transport: {
          kind: "stdio",
          command: "/bin/echo",
          args: ["hello-mcp"],
        },
        serverName: "echo-native",
        name: "transport-smoke",
        resourceUri: "mcp://echo-native/stdout",
      },
    },
    status: "failed",
    error: {
      code: "cli_capability_bridge_failed",
    },
  });

  assert.equal(telemetry?.familyKey, "mcp");
  assert.equal(telemetry?.familyTitle, "MCP");
  assert.equal(telemetry?.familyIntentSummary, "Executing MCP native transport");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Executing MCP native transport failed",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    targetName: "echo-native",
    toolName: "transport-smoke",
    resourceUri: "mcp://echo-native/stdout",
    errorCode: "cli_capability_bridge_failed",
  });
});

test("createCapabilityFamilyTelemetry emits skill family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "skill.mount",
    requestInput: {
      name: "context7-mcp",
    },
    status: "success",
    output: {
      container: { name: "context7-mcp" },
      activation: { mounts: [{ id: "m1" }] },
    },
  });

  assert.equal(telemetry?.familyKey, "skill");
  assert.equal(telemetry?.familyTitle, "Skill");
  assert.equal(telemetry?.familyIntentSummary, "Mounting the requested skill");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Mounting the requested skill succeeded",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    skillName: "context7-mcp",
    mountCount: 1,
  });
});

test("createCapabilityFamilyTelemetry emits useract family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "request_permissions",
    status: "blocked",
    error: {
      code: "tap_vendor_permission_request_required",
    },
  });

  assert.equal(telemetry?.familyKey, "useract");
  assert.equal(telemetry?.familyTitle, "UserAct");
  assert.equal(telemetry?.familyIntentSummary, "Requesting additional permissions");
  assert.equal(telemetry?.familyOutcomeKind, "blocked");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Requesting additional permissions failed",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    requestKind: "permissions",
    errorCode: "tap_vendor_permission_request_required",
  });
});

test("createCapabilityFamilyTelemetry emits workflow family summaries and metadata", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "tracker.create",
    status: "success",
    output: {
      trackerId: "abc12345-1111",
    },
  });

  assert.equal(telemetry?.familyKey, "workflow");
  assert.equal(telemetry?.familyTitle, "Workflow");
  assert.equal(telemetry?.familyIntentSummary, "Creating tracker item");
  assert.equal(telemetry?.familyOutcomeKind, "succeeded");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Creating tracker item succeeded",
    "Created tracker abc12345",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    trackerId: "abc12345-1111",
    itemCount: 1,
  });
});

test("family telemetry registry stays a single source for backend and tui families", () => {
  assert.deepEqual(resolveCapabilityFamilyDefinition("search.ground"), {
    tapFamilyKey: "websearch",
    tapFamilyTitle: "Websearch",
    familyKey: "websearch",
    familyTitle: "WebSearch",
  });
  assert.deepEqual(resolveCapabilityFamilyDefinition("browser.playwright"), {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "browser",
    familyTitle: "Browser",
  });
  assert.deepEqual(resolveCapabilityFamilyDefinition("mp.search"), {
    tapFamilyKey: "mp",
    tapFamilyTitle: "MP",
    familyKey: "mp",
    familyTitle: "MemoryPool",
  });
});

test("resolveFamilyOutcomeKind normalizes stage_end outcomes for direct logs", () => {
  assert.equal(resolveFamilyOutcomeKind("success"), "succeeded");
  assert.equal(resolveFamilyOutcomeKind("failed"), "failed");
  assert.equal(resolveFamilyOutcomeKind("blocked"), "blocked");
  assert.equal(resolveFamilyOutcomeKind("timeout"), "timed_out");
  assert.equal(resolveFamilyOutcomeKind("partial"), "partial");
});

test("createCapabilityFamilyTelemetry keeps workflow todoCount stable from todo arrays", () => {
  const telemetry = createCapabilityFamilyTelemetry({
    capabilityKey: "write_todos",
    requestInput: {
      todos: [
        { description: "one", status: "pending" },
        { description: "two", status: "completed" },
      ],
    },
    status: "success",
    output: {
      todos: [
        { description: "one", status: "pending" },
        { description: "two", status: "completed" },
      ],
    },
  });

  assert.equal(telemetry?.familyKey, "workflow");
  assert.equal(telemetry?.familyIntentSummary, "Updating todo workflow");
  assert.deepEqual(telemetry?.familyResultSummary, [
    "Updating todo workflow succeeded",
    "2 todo items updated",
  ]);
  assert.deepEqual(telemetry?.resultMetadata, {
    todoCount: 2,
    itemCount: 2,
  });
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

test("applyCliDefaultsToCapabilityRequest rewrites file-looking code.ls requests into code.read when the user asked for file content", async () => {
  const request = await applyCliDefaultsToCapabilityRequest(
    {
      capabilityKey: "code.ls",
      reason: "inspect file content",
      input: {
        path: "README.md",
      },
    },
    { model: "gpt-5.4" } as never,
    "请帮我使用code.read功能看看 README.md 这个文件主要干了什么。",
  );

  assert.equal(request.capabilityKey, "code.read");
  assert.equal(request.input.path, "README.md");
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

test("buildDocReadCompletionAnswer includes returned and omitted sampling facts", () => {
  const answer = buildDocReadCompletionAnswer({
    path: "docs/sample.docx",
    format: "docx",
    paragraphCount: 5,
    returnedParagraphCount: 3,
    omittedParagraphCount: 2,
    tableCount: 1,
    paragraphs: ["P1", "P2", "P3"],
    contentExcerpt: "P1\nP2\nP3\nCurrent price: 4755.44 USD/oz",
    firstTable: {
      rowCount: 4,
      returnedRowCount: 2,
      omittedRowCount: 2,
      columnCount: 2,
      rows: [["Name", "Value"], ["Gold", "4755.44"]],
    },
  });

  assert.match(answer ?? "", /returnedParagraphCount: 3/u);
  assert.match(answer ?? "", /omittedParagraphCount: 2/u);
  assert.match(answer ?? "", /内容摘要: P1[\s\S]*Current price: 4755\.44 USD\/oz/u);
  assert.match(answer ?? "", /首表 returnedRowCount: 2/u);
  assert.match(answer ?? "", /首表 omittedRowCount: 2/u);
});

test("buildDocReadCompletionAnswer keeps zero-valued counts visible", () => {
  const answer = buildDocReadCompletionAnswer({
    path: "docs/no-table.docx",
    format: "docx",
    paragraphCount: 2,
    returnedParagraphCount: 2,
    omittedParagraphCount: 0,
    tableCount: 0,
    paragraphs: ["Only paragraph one", "Only paragraph two"],
  });

  assert.match(answer ?? "", /tableCount: 0/u);
  assert.match(answer ?? "", /returnedParagraphCount: 2/u);
  assert.match(answer ?? "", /omittedParagraphCount: 0/u);
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

test("summarizeToolOutputForCore exposes search.ground partial status and error facts", () => {
  const text = summarizeToolOutputForCore("search.ground", {
    status: "partial",
    answer: "",
    citations: [],
    sources: [],
    error: {
      code: "websearch_evidence_missing",
      message: "search.ground produced an answer without any citations or source evidence.",
    },
  });

  assert.match(text, /"status": "partial"/u);
  assert.match(text, /"sourceCount": 0/u);
  assert.match(text, /"citationCount": 0/u);
  assert.match(text, /"code": "websearch_evidence_missing"/u);
});
