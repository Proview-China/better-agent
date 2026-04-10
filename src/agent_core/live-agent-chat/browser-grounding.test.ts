import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildBrowserGroundingEvidenceBundle,
  buildBrowserGroundingEvidenceText,
  updateBrowserTurnSummary,
  type BrowserTurnSummary,
} from "./browser-grounding.js";

test("buildBrowserGroundingEvidenceBundle emits normalized pages and facts", () => {
  const summary: BrowserTurnSummary = {
    googleSearchUrl: "https://www.google.com/search?q=%E5%9B%BD%E9%99%85%E9%87%91%E4%BB%B7",
    googleSearchTitle: "国际实时金价 - Google 搜索",
    candidateSourceUrl: "https://cn.investing.com/currencies/xau-usd",
    candidateSourceTitle: "XAU/USD 实时行情",
    verifiedSourceUrl: "https://cn.investing.com/currencies/xau-usd",
    verifiedSourceTitle: "XAU/USD - 黄金现货 美元",
    goldPriceUsdPerOunce: "4755.44",
    goldPriceObservedAt: "08:48:38",
    goldPriceEvidenceSource: "verified_source",
  };

  const bundle = buildBrowserGroundingEvidenceBundle(summary);
  assert.ok(bundle);
  assert.equal(bundle?.pages.some((entry) => entry.role === "verified_source"), true);
  assert.equal(bundle?.facts.some((entry) =>
    entry.kind === "numeric_fact"
    && entry.name === "gold_price_usd_per_ounce"
    && entry.value === "4755.44"
    && entry.status === "verified"
    && entry.unit === "USD/oz"), true);
  assert.equal(bundle?.facts.some((entry) =>
    entry.kind === "timestamp_fact"
    && entry.name === "observed_time"
    && entry.value === "08:48:38"
    && entry.status === "verified"), true);

  const text = buildBrowserGroundingEvidenceText(summary);
  assert.doesNotThrow(() => JSON.parse(text ?? "{}"));
});

test("updateBrowserTurnSummary promotes google snapshot facts into candidate source evidence", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "praxis-browser-grounding-"));
  const snapshotPath = path.join(tempDir, "google.yml");
  writeFileSync(snapshotPath, [
    '- /url: https://cn.investing.com/currencies/xau-usd',
    '- heading "国际实时金价 美元/盎司 - 英为财情" [level=3]',
    '- generic [ref=e1]: 4755.44 美元 / 盎司',
  ].join("\n"));

  const summary = updateBrowserTurnSummary({}, {
    action: "snapshot",
    pageUrl: "https://www.google.com/search?q=%E5%9B%BD%E9%99%85%E9%87%91%E4%BB%B7",
    pageTitle: "国际实时金价 - Google 搜索",
    snapshotPath,
  });

  assert.equal(summary.googleSnapshotPath, snapshotPath);
  assert.equal(summary.candidateSourceUrl, "https://cn.investing.com/currencies/xau-usd");
  assert.equal(summary.goldPriceUsdPerOunce, "4755.44");
  assert.equal(summary.goldPriceEvidenceSource, "google_search");
});

test("updateBrowserTurnSummary clears active obstruction after a normal page resumes", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "praxis-browser-grounding-"));
  const sourceSnapshotPath = path.join(tempDir, "source.yml");
  writeFileSync(sourceSnapshotPath, [
    '- heading "XAU/USD - 黄金现货 美元" [level=1]',
    '- generic [ref=e1]: 4755.44',
    '- time [ref=e2]: 08:48:38',
  ].join("\n"));

  const blocked = updateBrowserTurnSummary({}, {
    action: "navigate",
    pageUrl: "https://www.google.com/sorry/index",
    pageTitle: "Sorry",
    blockedByInterstitial: true,
  });
  assert.equal(blocked.activeObstruction?.kind, "interstitial");

  const resumed = updateBrowserTurnSummary(blocked, {
    action: "snapshot",
    pageUrl: "https://cn.investing.com/currencies/xau-usd",
    pageTitle: "XAU/USD - 黄金现货 美元",
    snapshotPath: sourceSnapshotPath,
  });

  assert.equal(resumed.activeObstruction, undefined);
  assert.equal(resumed.verifiedSourceUrl, "https://cn.investing.com/currencies/xau-usd");
  assert.equal(resumed.goldPriceUsdPerOunce, "4755.44");
  assert.equal(resumed.goldPriceObservedAt, "08:48:38");
});
