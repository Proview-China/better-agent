import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type RepoMemoryOverlayCategory =
  | "current-context"
  | "architecture"
  | "decision"
  | "worklog";

export interface RepoMemoryOverlaySnapshotEntry {
  id: string;
  label: string;
  summary: string;
  bodyRef: string;
  category: RepoMemoryOverlayCategory;
  updatedAtMs: number;
  effectiveDateMs: number;
  docStatus?: "accepted" | "draft" | "fact";
  stabilityKind: "authoritative" | "accepted" | "stable" | "volatile";
  sourcePath: string;
}

export interface RepoMemoryOverlaySnapshot {
  schemaVersion: "repo-memory-overlay-snapshot/v1";
  rootDir: string;
  entries: RepoMemoryOverlaySnapshotEntry[];
}

const snapshotCache = new Map<string, RepoMemoryOverlaySnapshot>();

export function loadRepoMemoryOverlaySnapshot(input: {
  rootDir?: string;
  forceReload?: boolean;
} = {}): RepoMemoryOverlaySnapshot {
  const rootDir = path.resolve(input.rootDir ?? path.join(process.cwd(), "memory"));
  if (!input.forceReload) {
    const cached = snapshotCache.get(rootDir);
    if (cached) {
      return cached;
    }
  }

  const snapshot = buildRepoMemoryOverlaySnapshot(rootDir);
  snapshotCache.set(rootDir, snapshot);
  return snapshot;
}

export function clearRepoMemoryOverlaySnapshotCacheForTest(): void {
  snapshotCache.clear();
}

function buildRepoMemoryOverlaySnapshot(rootDir: string): RepoMemoryOverlaySnapshot {
  const entries: RepoMemoryOverlaySnapshotEntry[] = [];

  const currentContextPath = path.join(rootDir, "current-context.md");
  const architectureDir = path.join(rootDir, "architecture");
  const decisionsDir = path.join(rootDir, "decisions");
  const worklogDir = path.join(rootDir, "worklog");

  if (safeExists(currentContextPath)) {
    const entry = createSnapshotEntry({
      rootDir,
      sourcePath: currentContextPath,
      category: "current-context",
    });
    if (entry) {
      entries.push(entry);
    }
  }

  for (const sourcePath of readMarkdownFiles(architectureDir)) {
    const entry = createSnapshotEntry({
      rootDir,
      sourcePath,
      category: "architecture",
    });
    if (entry) {
      entries.push(entry);
    }
  }

  for (const sourcePath of readMarkdownFiles(decisionsDir)) {
    const entry = createSnapshotEntry({
      rootDir,
      sourcePath,
      category: "decision",
    });
    if (entry) {
      entries.push(entry);
    }
  }

  for (const sourcePath of readMarkdownFiles(worklogDir)) {
    const entry = createSnapshotEntry({
      rootDir,
      sourcePath,
      category: "worklog",
    });
    if (entry) {
      entries.push(entry);
    }
  }

  return {
    schemaVersion: "repo-memory-overlay-snapshot/v1",
    rootDir,
    entries: entries.sort((left, right) => right.updatedAtMs - left.updatedAtMs),
  };
}

function createSnapshotEntry(input: {
  rootDir: string;
  sourcePath: string;
  category: RepoMemoryOverlayCategory;
}): RepoMemoryOverlaySnapshotEntry | undefined {
  const stat = safeStat(input.sourcePath);
  if (!stat?.isFile()) {
    return undefined;
  }

  const content = readFileSync(input.sourcePath, "utf8");
  if (!shouldIncludeMemoryDocument(input.sourcePath, content, input.category)) {
    return undefined;
  }
  const title = extractTitle(content) ?? path.basename(input.sourcePath, ".md");
  const summary = extractSummary(content);
  const relativePath = path.relative(input.rootDir, input.sourcePath);
  const effectiveDateMs = resolveEffectiveDateMs(input.sourcePath, content, stat.mtimeMs);
  const docStatus = resolveDocStatus(content, input.category);
  const stabilityKind = resolveStabilityKind(input.category, docStatus);

  return {
    id: `memory:${relativePath.replace(/\\/gu, "/").replace(/\.md$/u, "")}`,
    label: title,
    summary,
    bodyRef: `memory-body:${relativePath.replace(/\\/gu, "/")}`,
    category: input.category,
    updatedAtMs: stat.mtimeMs,
    effectiveDateMs,
    docStatus,
    stabilityKind,
    sourcePath: relativePath.replace(/\\/gu, "/"),
  };
}

function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/mu);
  return match?.[1]?.trim();
}

function extractSummary(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const firstParagraph = lines.slice(0, 3).join(" ");
  return clampSummary(firstParagraph || "Repository memory entry");
}

function clampSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function readMarkdownFiles(directory: string): string[] {
  if (!safeExists(directory)) {
    return [];
  }
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".md") && !entry.startsWith("README"))
    .map((entry) => path.join(directory, entry));
}

function shouldIncludeMemoryDocument(
  sourcePath: string,
  content: string,
  category: RepoMemoryOverlayCategory,
): boolean {
  const basename = path.basename(sourcePath).toLowerCase();
  if (basename === "adr-0000-template.md") {
    return false;
  }
  if (category === "decision") {
    return resolveDocStatus(content, category) === "accepted";
  }
  if (category === "worklog") {
    if (/(outline|task-pack|blueprint|roadmap|research)/iu.test(basename)) {
      return false;
    }
  }
  return true;
}

function resolveDocStatus(
  content: string,
  category: RepoMemoryOverlayCategory,
): "accepted" | "draft" | "fact" | undefined {
  if (category === "decision") {
    if (/##\s*状态[\s\S]*?已接受/u.test(content)) {
      return "accepted";
    }
    return "draft";
  }
  if (category === "current-context" || category === "architecture" || category === "worklog") {
    return "fact";
  }
  return undefined;
}

function resolveStabilityKind(
  category: RepoMemoryOverlayCategory,
  docStatus: "accepted" | "draft" | "fact" | undefined,
): "authoritative" | "accepted" | "stable" | "volatile" {
  if (category === "current-context") {
    return "authoritative";
  }
  if (docStatus === "accepted") {
    return "accepted";
  }
  if (category === "architecture") {
    return "stable";
  }
  return "volatile";
}

function resolveEffectiveDateMs(
  sourcePath: string,
  content: string,
  fallbackMs: number,
): number {
  const explicitContextDate = content.match(/更新时间：\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
  const filenameDate = path.basename(sourcePath).match(/(\d{4}-\d{2}-\d{2})/u)?.[1];
  const chosen = explicitContextDate ?? filenameDate;
  if (!chosen) {
    return fallbackMs;
  }
  const parsed = Date.parse(`${chosen}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function safeExists(target: string): boolean {
  try {
    statSync(target);
    return true;
  } catch {
    return false;
  }
}

function safeStat(target: string) {
  try {
    return statSync(target);
  } catch {
    return undefined;
  }
}
