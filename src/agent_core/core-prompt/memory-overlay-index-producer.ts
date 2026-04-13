import type {
  RepoMemoryOverlaySnapshot,
  RepoMemoryOverlaySnapshotEntry,
} from "../integrations/repo-memory-overlay-source.js";
import type { CoreOverlayIndexEntryV1 } from "./types.js";

const DEFAULT_MEMORY_LIMIT = 6;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "use",
  "when",
  "with",
  "当前",
  "继续",
  "实现",
  "我们",
  "一下",
]);

export function createMemoryOverlayIndexEntries(input: {
  userMessage: string;
  snapshot?: RepoMemoryOverlaySnapshot;
  limit?: number;
}): CoreOverlayIndexEntryV1[] {
  const entries = input.snapshot?.entries ?? [];
  if (entries.length === 0) {
    return [];
  }

  const limit = Math.max(0, input.limit ?? DEFAULT_MEMORY_LIMIT);
  if (limit === 0) {
    return [];
  }

  return rankMemoryEntries(entries, input.userMessage)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      summary: createMemorySummary(entry),
      bodyRef: entry.bodyRef,
    }));
}

function rankMemoryEntries(
  entries: RepoMemoryOverlaySnapshotEntry[],
  userMessage: string,
): RepoMemoryOverlaySnapshotEntry[] {
  const queryTokens = extractSearchTokens(userMessage);

  return [...entries].sort((left, right) => {
    const scoreDelta = scoreMemoryEntry(right, queryTokens) - scoreMemoryEntry(left, queryTokens);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return right.updatedAtMs - left.updatedAtMs;
  });
}

function scoreMemoryEntry(
  entry: RepoMemoryOverlaySnapshotEntry,
  queryTokens: Set<string>,
): number {
  let score = categoryPriority(entry.category) * 20;
  score += stabilityPriority(entry.stabilityKind) * 18;
  if (entry.docStatus === "accepted") {
    score += 12;
  }

  const haystack = `${entry.label} ${entry.summary} ${entry.sourcePath}`.toLowerCase();
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 16 : 8;
    }
  }

  // Favor explicit effective date over raw mtime; keep it secondary to relevance and stability.
  score += Math.floor(entry.effectiveDateMs / 1_000_000_000_000);
  return score;
}

function categoryPriority(category: RepoMemoryOverlaySnapshotEntry["category"]): number {
  switch (category) {
    case "current-context":
      return 6;
    case "decision":
      return 5;
    case "architecture":
      return 4;
    case "worklog":
      return 3;
  }
}

function stabilityPriority(
  stabilityKind: RepoMemoryOverlaySnapshotEntry["stabilityKind"],
): number {
  switch (stabilityKind) {
    case "authoritative":
      return 6;
    case "accepted":
      return 5;
    case "stable":
      return 4;
    case "volatile":
      return 2;
  }
}

function createMemorySummary(entry: RepoMemoryOverlaySnapshotEntry): string {
  const category = entry.category.replace(/-/gu, " ");
  return clampSummary(`${category}. ${entry.summary}`);
}

function clampSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function extractSearchTokens(value: string): Set<string> {
  const matches = value.match(/[\p{Letter}\p{Number}][\p{Letter}\p{Number}_:/.-]*/gu) ?? [];
  const tokens = matches
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}
