import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  composeStatusRateLimitDisplayView,
  formatStatusLimitSummary,
  renderStatusLimitProgressBar,
  readCachedStatusRateLimitRecord,
  writeCachedStatusRateLimitRecord,
  type StatusRateLimitCacheRecord,
} from "./status-rate-limits.js";

test("renderStatusLimitProgressBar formats 20 segments from remaining percent", () => {
  assert.equal(renderStatusLimitProgressBar(26), "█████░░░░░░░░░░░░░░░");
  assert.equal(formatStatusLimitSummary(53), "53% left");
});

test("composeStatusRateLimitDisplayView formats primary and secondary rows", () => {
  const record: StatusRateLimitCacheRecord = {
    scopeKey: "chatgpt_oauth:https://chatgpt.com/backend-api/codex:acct",
    capturedAt: "2026-04-14T12:00:00.000Z",
    source: "response_headers",
    snapshots: [
      {
        limitId: "codex",
        capturedAt: "2026-04-14T12:00:00.000Z",
        source: "response_headers",
        planType: "plus",
        primary: {
          usedPercent: 74,
          windowDurationMins: 300,
          resetsAt: Math.floor(new Date("2026-04-14T20:16:00+08:00").getTime() / 1000),
        },
        secondary: {
          usedPercent: 47,
          windowDurationMins: 10080,
          resetsAt: Math.floor(new Date("2026-04-17T08:27:00+08:00").getTime() / 1000),
        },
      },
    ],
  };
  const view = composeStatusRateLimitDisplayView(record, new Date("2026-04-14T12:00:00+08:00"));
  assert.equal(view.availability, "available");
  assert.equal(view.rows.length, 2);
  assert.equal(view.rows[0]?.label, "5h limit");
  assert.equal(view.rows[0]?.bar, "█████░░░░░░░░░░░░░░░");
  assert.equal(view.rows[0]?.summary, "26% left");
  assert.equal(view.rows[0]?.resetsAt, "20:16");
  assert.equal(view.rows[1]?.label, "Weekly limit");
  assert.equal(view.rows[1]?.summary, "53% left");
  assert.equal(view.rows[1]?.resetsAt, "08:27 on 17 Apr");
});

test("status rate limit cache persists records by scope", () => {
  const fallbackDir = mkdtempSync(join(tmpdir(), "praxis-status-rate-limits-"));
  try {
    const config = {
      authMode: "chatgpt_oauth" as const,
      baseURL: "https://chatgpt.com/backend-api/codex",
      accountId: "acct-1",
      defaultHeaders: {
        "chatgpt-account-id": "acct-1",
      },
    };
    writeCachedStatusRateLimitRecord(config, {
      capturedAt: "2026-04-14T00:00:00.000Z",
      source: "response_headers",
      snapshots: [
        {
          limitId: "codex",
          capturedAt: "2026-04-14T00:00:00.000Z",
          source: "response_headers",
          primary: {
            usedPercent: 10,
            windowDurationMins: 300,
          },
        },
      ],
    }, fallbackDir);
    const record = readCachedStatusRateLimitRecord(config, fallbackDir);
    assert.ok(record);
    assert.equal(record?.scopeKey, "chatgpt_oauth:https://chatgpt.com/backend-api/codex:acct-1");
    assert.equal(record?.snapshots[0]?.primary?.usedPercent, 10);
  } finally {
    rmSync(fallbackDir, { recursive: true, force: true });
  }
});
