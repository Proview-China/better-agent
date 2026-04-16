import assert from "node:assert/strict";
import { mkdtemp, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { raxodeStartupSplashTestUtils } from "./raxode-startup-splash.js";

test("typing frame grows with a moving block cursor", () => {
  const emptyFrame = raxodeStartupSplashTestUtils.buildTypingFrame(0)[0] ?? "";
  const helloFrame = raxodeStartupSplashTestUtils.buildTypingFrame(5)[0] ?? "";
  const fullFrame = raxodeStartupSplashTestUtils.buildTypingFrame("Hello, AI World!".length)[0] ?? "";

  assert.equal(emptyFrame.startsWith(">> █"), true);
  assert.equal(helloFrame.startsWith(">> Hello█"), true);
  assert.equal(fullFrame.startsWith(">> Hello, AI World!█"), true);
  assert.equal(emptyFrame.length, helloFrame.length);
  assert.equal(helloFrame.length, fullFrame.length);
});

test("Praxis reveal and erase frames progress left-to-right and top-to-bottom", () => {
  const reveal = raxodeStartupSplashTestUtils.buildPraxisRevealFrame(1, 4);
  assert.equal(reveal[0]?.length > 0, true);
  assert.equal(reveal[1], "██╔═");
  assert.equal(reveal[2], "");

  const erased = raxodeStartupSplashTestUtils.buildPraxisEraseFrame(0, 4);
  assert.equal(erased[0], "████╗");
  assert.equal(erased[1], "██╔════██╗                            ██╗");
});

test("waitForPersistedExitSummaryLines resolves once the summary payload lands", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "raxode-summary-test-"));
  const summaryPath = path.join(tempDir, "summary.json");
  const pending = raxodeStartupSplashTestUtils.waitForPersistedExitSummaryLines(summaryPath, {
    timeoutMs: 500,
    pollMs: 20,
  });

  setTimeout(async () => {
    const tempPath = `${summaryPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify({ lines: ["┌─┐", "│x│", "└─┘"] })}\n`, "utf8");
    await rename(tempPath, summaryPath);
  }, 60);

  const lines = await pending;
  assert.deepEqual(lines, ["┌─┐", "│x│", "└─┘"]);
});

test("fallback exit summary includes a resume hint", () => {
  const lines = raxodeStartupSplashTestUtils.buildFallbackExitSummaryLines("session-123");
  assert.equal(lines.some((line) => line.includes("RAXODE EXIT SUMMARY UNAVAILABLE")), true);
  assert.equal(lines.some((line) => line.includes("raxode resume session-123")), true);
});
