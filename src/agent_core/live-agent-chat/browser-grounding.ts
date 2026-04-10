import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type BrowserGroundingSourceRole =
  | "example"
  | "google_search"
  | "candidate_source"
  | "verified_source";

type BrowserGroundingFactStatus = "observed" | "candidate" | "verified" | "blocked";

export interface BrowserGroundingPageEvidence {
  kind: "page";
  role: BrowserGroundingSourceRole;
  url: string;
  title?: string;
  snapshotPath?: string;
  screenshotPath?: string;
}

export interface BrowserGroundingFactEvidence {
  kind: "source_fact" | "numeric_fact" | "timestamp_fact" | "obstruction";
  name: string;
  status: BrowserGroundingFactStatus;
  value?: string;
  unit?: string;
  detail?: string;
  sourceRole?: BrowserGroundingSourceRole;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface BrowserGroundingEvidenceBundle {
  pages: BrowserGroundingPageEvidence[];
  facts: BrowserGroundingFactEvidence[];
}

interface BrowserTurnObstruction {
  kind: "interstitial";
  pageUrl?: string;
  pageTitle?: string;
  detail: string;
}

export interface BrowserTurnSummary {
  examplePageUrl?: string;
  examplePageTitle?: string;
  exampleScreenshotPath?: string;
  googleSearchUrl?: string;
  googleSearchTitle?: string;
  googleSnapshotPath?: string;
  candidateSourceUrl?: string;
  candidateSourceTitle?: string;
  verifiedSourceUrl?: string;
  verifiedSourceTitle?: string;
  goldPriceUsdPerOunce?: string;
  goldPriceObservedAt?: string;
  goldPriceEvidenceSource?: "google_search" | "verified_source";
  activeObstruction?: BrowserTurnObstruction;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function extractFirstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

function extractGoldPriceUsdPerOunce(text: string): string | undefined {
  const normalized = text.replace(/,/gu, "");
  return normalized.match(/最新报\s*([0-9]{3,6}(?:\.[0-9]+)?)\s*美元\s*\/\s*盎司/u)?.[1]
    ?? normalized.match(/上涨至\s*([0-9]{3,6}(?:\.[0-9]+)?)\s*美元\s*\/\s*盎司/u)?.[1]
    ?? normalized.match(/美元[\s\S]{0,120}?盎司[\s\S]{0,40}?([0-9]{3,6}(?:\.[0-9]+)?)/u)?.[1]
    ?? normalized.match(/([0-9]{3,6}(?:\.[0-9]+)?)\s*美元\s*\/\s*盎司/u)?.[1]
    ?? undefined;
}

function readWorkspaceTextFile(pathValue: string | undefined): string | undefined {
  if (!pathValue) {
    return undefined;
  }
  try {
    return readFileSync(resolve(process.cwd(), pathValue), "utf8");
  } catch {
    return undefined;
  }
}

function extractBestGoogleResultFromSnapshot(pathValue: string | undefined): {
  url?: string;
  title?: string;
  priceUsdPerOunce?: string;
} | undefined {
  const text = readWorkspaceTextFile(pathValue);
  if (!text) {
    return undefined;
  }
  const matches = [...text.matchAll(/- \/url: (https?:\/\/[^\s]+)[\s\S]{0,220}?- heading "([^"]+)" \[level=3\][\s\S]{0,500}/gu)];
  let best:
    | {
      url?: string;
      title?: string;
      priceUsdPerOunce?: string;
      score: number;
    }
    | undefined;

  for (const match of matches) {
    const segment = match[0];
    const url = match[1];
    const title = match[2];
    const priceUsdPerOunce = extractGoldPriceUsdPerOunce(segment);
    const score = (priceUsdPerOunce ? 100 : 0)
      + (/(金价|黄金|XAU|美元|盎司)/iu.test(title) ? 10 : 0)
      + (/(美元|盎司)/iu.test(segment) ? 5 : 0);
    if (!best || score > best.score) {
      best = { url, title, priceUsdPerOunce, score };
    }
  }

  return best
    ? {
      url: best.url,
      title: best.title,
      priceUsdPerOunce: best.priceUsdPerOunce,
    }
    : undefined;
}

function extractVerifiedSourcePriceFromSnapshot(pathValue: string | undefined): {
  priceUsdPerOunce?: string;
  observedAt?: string;
} | undefined {
  const text = readWorkspaceTextFile(pathValue);
  if (!text) {
    return undefined;
  }

  const visibleSection = text.match(/heading "XAU\/USD - 黄金现货 美元"[\s\S]{0,4000}/u)?.[0] ?? text;
  const price = visibleSection.match(/generic \[ref=[^\]]+\]: ([0-9][0-9,]*(?:\.[0-9]+)?)/u)?.[1]
    ?? visibleSection.match(/当前XAU\/USD的汇率为([0-9,]+(?:\.[0-9]+)?)/u)?.[1]
    ?? visibleSection.match(/买入价为([0-9,]+(?:\.[0-9]+)?)/u)?.[1];
  const observedAt = visibleSection.match(/time \[ref=[^\]]+\]: ([0-9]{2}:[0-9]{2}:[0-9]{2})/u)?.[1];

  if (!price && !observedAt) {
    return undefined;
  }

  return {
    priceUsdPerOunce: price?.replace(/,/gu, ""),
    observedAt,
  };
}

function sourceMetaFromSummary(
  summary: BrowserTurnSummary,
  sourceRole: BrowserGroundingSourceRole | undefined,
): Pick<BrowserGroundingFactEvidence, "sourceRole" | "sourceUrl" | "sourceTitle"> {
  switch (sourceRole) {
    case "verified_source":
      return {
        sourceRole,
        sourceUrl: summary.verifiedSourceUrl,
        sourceTitle: summary.verifiedSourceTitle,
      };
    case "google_search":
      return {
        sourceRole,
        sourceUrl: summary.googleSearchUrl,
        sourceTitle: summary.googleSearchTitle,
      };
    case "candidate_source":
      return {
        sourceRole,
        sourceUrl: summary.candidateSourceUrl,
        sourceTitle: summary.candidateSourceTitle,
      };
    case "example":
      return {
        sourceRole,
        sourceUrl: summary.examplePageUrl,
        sourceTitle: summary.examplePageTitle,
      };
    default:
      return {};
  }
}

function upsertFact(
  facts: BrowserGroundingFactEvidence[],
  candidate: BrowserGroundingFactEvidence,
): void {
  const index = facts.findIndex((entry) =>
    entry.kind === candidate.kind
    && entry.name === candidate.name
    && entry.sourceRole === candidate.sourceRole,
  );
  if (index >= 0) {
    facts[index] = candidate;
    return;
  }
  facts.push(candidate);
}

export function buildBrowserGroundingEvidenceBundle(
  summary: BrowserTurnSummary,
): BrowserGroundingEvidenceBundle | undefined {
  const pages: BrowserGroundingPageEvidence[] = [];
  const facts: BrowserGroundingFactEvidence[] = [];

  if (summary.examplePageUrl) {
    pages.push({
      kind: "page",
      role: "example",
      url: summary.examplePageUrl,
      title: summary.examplePageTitle,
      screenshotPath: summary.exampleScreenshotPath,
    });
  }

  if (summary.googleSearchUrl) {
    pages.push({
      kind: "page",
      role: "google_search",
      url: summary.googleSearchUrl,
      title: summary.googleSearchTitle,
      snapshotPath: summary.googleSnapshotPath,
    });
  }

  if (summary.candidateSourceUrl) {
    pages.push({
      kind: "page",
      role: "candidate_source",
      url: summary.candidateSourceUrl,
      title: summary.candidateSourceTitle,
    });
    upsertFact(facts, {
      kind: "source_fact",
      name: "candidate_source",
      status: "candidate",
      value: summary.candidateSourceUrl,
      sourceRole: "candidate_source",
      sourceUrl: summary.candidateSourceUrl,
      sourceTitle: summary.candidateSourceTitle,
    });
  }

  if (summary.verifiedSourceUrl) {
    pages.push({
      kind: "page",
      role: "verified_source",
      url: summary.verifiedSourceUrl,
      title: summary.verifiedSourceTitle,
    });
    upsertFact(facts, {
      kind: "source_fact",
      name: "verified_source",
      status: "verified",
      value: summary.verifiedSourceUrl,
      sourceRole: "verified_source",
      sourceUrl: summary.verifiedSourceUrl,
      sourceTitle: summary.verifiedSourceTitle,
    });
  }

  const factSourceRole = summary.goldPriceEvidenceSource === "verified_source"
    ? "verified_source"
    : summary.goldPriceEvidenceSource === "google_search"
      ? "google_search"
      : undefined;

  if (summary.goldPriceUsdPerOunce) {
    upsertFact(facts, {
      kind: "numeric_fact",
      name: "gold_price_usd_per_ounce",
      status: factSourceRole === "verified_source" ? "verified" : "observed",
      value: summary.goldPriceUsdPerOunce,
      unit: "USD/oz",
      ...sourceMetaFromSummary(summary, factSourceRole),
    });
  }

  if (summary.goldPriceObservedAt) {
    upsertFact(facts, {
      kind: "timestamp_fact",
      name: "observed_time",
      status: factSourceRole === "verified_source" ? "verified" : "observed",
      value: summary.goldPriceObservedAt,
      ...sourceMetaFromSummary(summary, factSourceRole),
    });
  }

  if (summary.activeObstruction) {
    upsertFact(facts, {
      kind: "obstruction",
      name: "browser_interstitial",
      status: "blocked",
      detail: summary.activeObstruction.detail,
      sourceUrl: summary.activeObstruction.pageUrl,
      sourceTitle: summary.activeObstruction.pageTitle,
      sourceRole: summary.activeObstruction.pageUrl?.includes("google.")
        ? "google_search"
        : undefined,
    });
  }

  if (pages.length === 0 && facts.length === 0) {
    return undefined;
  }
  return { pages, facts };
}

export function buildBrowserGroundingEvidenceText(summary: BrowserTurnSummary): string | undefined {
  const bundle = buildBrowserGroundingEvidenceBundle(summary);
  return bundle ? JSON.stringify(bundle, null, 2) : undefined;
}

export function updateBrowserTurnSummary(
  summary: BrowserTurnSummary,
  output: unknown,
): BrowserTurnSummary {
  const normalized = output && typeof output === "object"
    ? output as Record<string, unknown>
    : undefined;
  if (!normalized) {
    return summary;
  }

  const next = { ...summary };
  const pageUrl = readString(normalized.pageUrl);
  const pageTitle = readString(normalized.pageTitle);
  const text = readString(normalized.text) ?? "";
  const screenshotPath = readString(normalized.screenshotPath);
  const snapshotPath = readString(normalized.snapshotPath);
  const blockedByInterstitial = normalized.blockedByInterstitial === true
    || Boolean(pageUrl && /\/sorry\//iu.test(pageUrl));

  if (blockedByInterstitial) {
    next.activeObstruction = {
      kind: "interstitial",
      pageUrl,
      pageTitle,
      detail: "The current browser page is still blocked by an interstitial or anti-bot gate.",
    };
    return next;
  }

  if (pageUrl) {
    next.activeObstruction = undefined;
  }

  if (pageUrl?.startsWith("https://example.com")) {
    next.examplePageUrl = pageUrl;
    if (pageTitle) {
      next.examplePageTitle = pageTitle;
    }
    const extractedScreenshotPath = screenshotPath ?? extractFirstMatch(text, /\[Screenshot of viewport\]\((.+?)\)/u);
    if (extractedScreenshotPath) {
      next.exampleScreenshotPath = extractedScreenshotPath;
    }
  }

  if (pageUrl && /google\.com\/search/iu.test(pageUrl)) {
    next.googleSearchUrl = pageUrl;
    if (pageTitle) {
      next.googleSearchTitle = pageTitle;
    }
    if (snapshotPath) {
      next.googleSnapshotPath = snapshotPath;
    }
    const price = extractGoldPriceUsdPerOunce(text);
    if (price) {
      next.goldPriceUsdPerOunce = price;
      next.goldPriceEvidenceSource = "google_search";
    }
    const bestResult = extractBestGoogleResultFromSnapshot(snapshotPath ?? next.googleSnapshotPath);
    if (!next.goldPriceUsdPerOunce && bestResult?.priceUsdPerOunce) {
      next.goldPriceUsdPerOunce = bestResult.priceUsdPerOunce;
      next.goldPriceEvidenceSource = "google_search";
    }
    if (bestResult?.url) {
      next.candidateSourceUrl = bestResult.url;
    }
    if (bestResult?.title) {
      next.candidateSourceTitle = bestResult.title;
    }
  }

  if (pageUrl && !/google\.com\/search/iu.test(pageUrl) && !pageUrl.startsWith("https://example.com")) {
    next.verifiedSourceUrl = pageUrl;
    if (pageTitle) {
      next.verifiedSourceTitle = pageTitle;
    }
    const directPrice = extractGoldPriceUsdPerOunce(text);
    if (directPrice) {
      next.goldPriceUsdPerOunce = directPrice;
      next.goldPriceEvidenceSource = "verified_source";
    }
    const snapshotExtract = extractVerifiedSourcePriceFromSnapshot(snapshotPath);
    if (!next.goldPriceUsdPerOunce && snapshotExtract?.priceUsdPerOunce) {
      next.goldPriceUsdPerOunce = snapshotExtract.priceUsdPerOunce;
      next.goldPriceEvidenceSource = "verified_source";
    }
    if (snapshotExtract?.observedAt) {
      next.goldPriceObservedAt = snapshotExtract.observedAt;
    }
  }

  return next;
}
