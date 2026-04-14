import stringWidth from "string-width";

export type PendingComposerSubmissionMode = "waiting" | "queue";
export type PendingComposerSummaryState = "idle" | "summarizing" | "ready" | "failed";

export interface PendingComposerSubmissionLike {
  sequence: number;
  mode: PendingComposerSubmissionMode;
  text: string;
}

export interface PendingComposerTextMetrics {
  wideCount: number;
  narrowCount: number;
}

export interface PendingComposerVisibleWindow<T> {
  visibleItems: T[];
  hiddenCount: number;
  offset: number;
  maxOffset: number;
}

export const PENDING_COMPOSER_MAX_VISIBLE = 5;
export const PENDING_COMPOSER_MAX_WIDE = 20;
export const PENDING_COMPOSER_MAX_NARROW = 34;

function countTextMetrics(text: string): PendingComposerTextMetrics {
  let wideCount = 0;
  let narrowCount = 0;
  for (const grapheme of [...text]) {
    if (stringWidth(grapheme) > 1) {
      wideCount += 1;
      continue;
    }
    narrowCount += 1;
  }
  return {
    wideCount,
    narrowCount,
  };
}

function canAppendWithinLimit(
  metrics: PendingComposerTextMetrics,
  addition: PendingComposerTextMetrics,
): boolean {
  return metrics.wideCount + addition.wideCount <= PENDING_COMPOSER_MAX_WIDE
    && metrics.narrowCount + addition.narrowCount <= PENDING_COMPOSER_MAX_NARROW;
}

export function measurePendingComposerText(text: string): PendingComposerTextMetrics {
  return countTextMetrics(text);
}

export function shouldSummarizePendingComposerText(text: string): boolean {
  const metrics = countTextMetrics(text.trim());
  return metrics.wideCount > PENDING_COMPOSER_MAX_WIDE
    || metrics.narrowCount > PENDING_COMPOSER_MAX_NARROW;
}

export function compactPendingComposerText(text: string): string {
  const trimmed = text.trim().replace(/\s+/gu, " ");
  if (!trimmed) {
    return "";
  }
  if (!shouldSummarizePendingComposerText(trimmed)) {
    return trimmed;
  }
  const ellipsis = "...";
  const ellipsisMetrics = countTextMetrics(ellipsis);
  let output = "";
  let outputMetrics: PendingComposerTextMetrics = { wideCount: 0, narrowCount: 0 };
  for (const grapheme of [...trimmed]) {
    const graphemeMetrics = countTextMetrics(grapheme);
    if (!canAppendWithinLimit(outputMetrics, {
      wideCount: graphemeMetrics.wideCount + ellipsisMetrics.wideCount,
      narrowCount: graphemeMetrics.narrowCount + ellipsisMetrics.narrowCount,
    })) {
      break;
    }
    output += grapheme;
    outputMetrics = {
      wideCount: outputMetrics.wideCount + graphemeMetrics.wideCount,
      narrowCount: outputMetrics.narrowCount + graphemeMetrics.narrowCount,
    };
  }
  return output.length > 0 ? `${output}${ellipsis}` : ellipsis;
}

export function takeNextPendingComposerDispatchBatch<T extends { mode: PendingComposerSubmissionMode }>(
  entries: readonly T[],
): T[] {
  if (entries.length === 0) {
    return [];
  }
  const batch: T[] = [entries[0]!];
  for (let index = 1; index < entries.length; index += 1) {
    const candidate = entries[index];
    if (!candidate || candidate.mode !== "waiting") {
      break;
    }
    batch.push(candidate);
  }
  return batch;
}

export function formatPendingComposerOrdinal(
  sequence: number,
  totalCount: number,
): string {
  return String(sequence).padStart(totalCount >= 100 ? 3 : 2, "0");
}

export function buildPendingComposerVisibleWindow<T>(
  entries: readonly T[],
  requestedOffset: number,
  maxVisible = PENDING_COMPOSER_MAX_VISIBLE,
): PendingComposerVisibleWindow<T> {
  if (entries.length === 0) {
    return {
      visibleItems: [],
      hiddenCount: 0,
      offset: 0,
      maxOffset: 0,
    };
  }
  const maxOffset = Math.max(0, entries.length - maxVisible);
  const offset = Math.max(0, Math.min(requestedOffset, maxOffset));
  const end = Math.max(0, entries.length - offset);
  const start = Math.max(0, end - maxVisible);
  return {
    visibleItems: [...entries.slice(start, end)].reverse(),
    hiddenCount: start,
    offset,
    maxOffset,
  };
}
