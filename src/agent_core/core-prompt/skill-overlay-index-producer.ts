import type { CoreOverlayIndexEntryV1 } from "./types.js";
import type {
  ClaudeCodeSkillOverlaySnapshot,
  ClaudeCodeSkillOverlaySnapshotEntry,
} from "../integrations/claudecode-skill-overlay-source.js";

const DEFAULT_SKILL_LIMIT = 6;

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

export function createSkillOverlayIndexEntries(input: {
  userMessage: string;
  snapshot?: ClaudeCodeSkillOverlaySnapshot;
  limit?: number;
}): CoreOverlayIndexEntryV1[] {
  const entries = input.snapshot?.entries.filter((entry) => entry.modelInvocable) ?? [];
  if (entries.length === 0) {
    return [];
  }

  const rankedEntries = rankSkillSnapshotEntries(entries, input.userMessage);
  const limit = Math.max(0, input.limit ?? DEFAULT_SKILL_LIMIT);
  if (limit === 0) {
    return [];
  }

  return rankedEntries.slice(0, limit).map((entry) => ({
    id: `skill:${entry.sourceKind}:${entry.name}`,
    label: entry.name,
    summary: createSkillSummary(entry),
    bodyRef: `skill-body:${entry.sourceKind}:${entry.name}`,
  }));
}

function rankSkillSnapshotEntries(
  entries: ClaudeCodeSkillOverlaySnapshotEntry[],
  userMessage: string,
): ClaudeCodeSkillOverlaySnapshotEntry[] {
  const normalizedMessage = normalizeText(userMessage);
  const queryTokens = extractSearchTokens(userMessage);

  return [...entries].sort((left, right) => {
    const scoreDelta =
      scoreSkillSnapshotEntry(right, normalizedMessage, queryTokens)
      - scoreSkillSnapshotEntry(left, normalizedMessage, queryTokens);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const sourceDelta = sourcePriority(right) - sourcePriority(left);
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    const guidanceDelta = Number(Boolean(right.whenToUse)) - Number(Boolean(left.whenToUse));
    if (guidanceDelta !== 0) {
      return guidanceDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

function scoreSkillSnapshotEntry(
  entry: ClaudeCodeSkillOverlaySnapshotEntry,
  normalizedMessage: string,
  queryTokens: Set<string>,
): number {
  let score = 0;

  const matchTerms = [entry.name, ...entry.aliases].map((term) => normalizeText(term));
  for (const term of matchTerms) {
    if (!term) {
      continue;
    }
    if (normalizedMessage.includes(`/${term}`)) {
      score += 140;
      continue;
    }
    if (containsWholeToken(normalizedMessage, term)) {
      score += 90;
      continue;
    }
    if (normalizedMessage.includes(term)) {
      score += 45;
    }
  }

  const evidenceText = [
    entry.name,
    ...entry.aliases,
    entry.description,
    entry.whenToUse ?? "",
  ].join(" ");
  const evidenceTokens = extractSearchTokens(evidenceText);
  for (const token of queryTokens) {
    if (evidenceTokens.has(token)) {
      score += token.length >= 6 ? 18 : 9;
    }
  }

  score += sourcePriority(entry) * 2;
  if (entry.whenToUse) {
    score += 6;
  }
  if (entry.userInvocable) {
    score += 2;
  }
  return score;
}

function containsWholeToken(normalizedMessage: string, token: string): boolean {
  const pattern = new RegExp(`(^|[^\\p{Letter}\\p{Number}_-])${escapeRegExp(token)}([^\\p{Letter}\\p{Number}_-]|$)`, "u");
  return pattern.test(normalizedMessage);
}

function sourcePriority(entry: ClaudeCodeSkillOverlaySnapshotEntry): number {
  return entry.sourceKind === "bundled-skill" ? 3 : 2;
}

function createSkillSummary(entry: ClaudeCodeSkillOverlaySnapshotEntry): string {
  const sourceLabel = entry.sourceKind === "bundled-skill"
    ? "Bundled skill"
    : "Prompt command";
  const guidance = entry.whenToUse
    ? firstSentence(entry.whenToUse)
    : firstSentence(entry.description);
  return clampSummary(`${sourceLabel}. ${entry.description} ${guidance}`);
}

function clampSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function firstSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return match?.[1] ?? normalized;
}

function extractSearchTokens(value: string): Set<string> {
  const matches = value.match(/[\p{Letter}\p{Number}][\p{Letter}\p{Number}_:/.-]*/gu) ?? [];
  const tokens = matches
    .map((token) => normalizeText(token))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
