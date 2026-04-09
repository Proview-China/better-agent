import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCliOptions,
  parseCoreActionEnvelope,
  parseTapRequest,
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

  const capability = parseCoreActionEnvelope(JSON.stringify({
    action: "capability_call",
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
  assert.equal(capability.capabilityRequest?.capabilityKey, "code.read");
  assert.equal(capability.capabilityRequest?.timeoutMs, 15000);
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
