import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityInvocationPlan } from "../../capability-types/index.js";
import {
  assertBrowserUrlAllowed,
  normalizeBrowserPlaywrightInput,
  selectBrowserPlaywrightBackend,
} from "./browser-playwright.js";

function createPlan(input: Record<string, unknown>): CapabilityInvocationPlan {
  return {
    planId: "plan-browser",
    intentId: "intent-browser",
    sessionId: "session-browser",
    runId: "run-browser",
    capabilityKey: "browser.playwright",
    operation: "browser.playwright",
    input,
    priority: "normal",
  };
}

test("normalizeBrowserPlaywrightInput infers backend from route/provider hints", () => {
  const normalized = normalizeBrowserPlaywrightInput(
    createPlan({
      action: "navigate",
      url: "https://docs.example.com",
      route: {
        provider: "openai",
        model: "gpt-5",
      },
      allowedDomains: ["docs.example.com"],
    }),
  );

  assert.equal(normalized.action, "navigate");
  assert.equal(normalized.selectedBackend, "openai-codex-browser-mcp-style");
  assert.equal(normalized.toolName, "browser_navigate");
});

test("assertBrowserUrlAllowed respects wildcard domains", () => {
  assert.doesNotThrow(() => {
    assertBrowserUrlAllowed("https://api.example.com/health", ["*.example.com"]);
  });

  assert.throws(
    () => assertBrowserUrlAllowed("https://example.org", ["*.example.com"]),
    /allowedDomains/i,
  );
});

test("selectBrowserPlaywrightBackend falls back to shared runtime without route", () => {
  assert.equal(selectBrowserPlaywrightBackend(undefined), "playwright-shared-runtime");
});

test("normalizeBrowserPlaywrightInput promotes reviewed structured actions", () => {
  const hover = normalizeBrowserPlaywrightInput(createPlan({
    action: "hover",
    ref: "node-1",
  }));
  assert.equal(hover.toolName, "browser_hover");

  const press = normalizeBrowserPlaywrightInput(createPlan({
    action: "press_key",
    key: "Enter",
  }));
  assert.equal(press.toolName, "browser_press_key");

  const resize = normalizeBrowserPlaywrightInput(createPlan({
    action: "resize",
    width: 1440,
    height: 900,
  }));
  assert.equal(resize.toolName, "browser_resize");
});

test("normalizeBrowserPlaywrightInput blocks unreviewed raw tools", () => {
  assert.throws(
    () => normalizeBrowserPlaywrightInput(createPlan({
      action: "raw",
      toolName: "browser_run_code",
      arguments: {
        code: "async (page) => page.goto('https://example.com')",
      },
    })),
    /blocked unreviewed MCP tool/i,
  );
});
