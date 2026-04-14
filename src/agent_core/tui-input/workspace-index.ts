import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";

const MAX_INDEX_ENTRIES = 250_000;
const MAX_STDERR_BYTES = 32 * 1024;

export interface WorkspaceIndexSnapshot {
  root: string;
  files: string[];
  directories: string[];
  fileStatus: "ready" | "truncated" | "error";
  directoryStatus: "ready" | "truncated";
  fileError: string | null;
}

export interface WorkspaceIndexSearchResult {
  path: string;
  score: number;
  displayName: string;
}

function normalizeWorkspaceEntry(value: string): string {
  const trimmed = value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (!trimmed || trimmed === ".") {
    return ".";
  }
  return trimmed.replace(/\/+/gu, "/").replace(/\/$/u, "");
}

function comparePathDensity(left: string, right: string): number {
  const leftDepth = left === "." ? 0 : left.split("/").length;
  const rightDepth = right === "." ? 0 : right.split("/").length;
  if (leftDepth !== rightDepth) {
    return leftDepth - rightDepth;
  }
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left.localeCompare(right);
}

interface StreamedWorkspaceEntries {
  entries: string[];
  truncated: boolean;
}

function hasOnlyIgnorableFindErrors(command: string, stderr: string): boolean {
  if (command !== "find") {
    return false;
  }
  const normalizedLines = stderr
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (normalizedLines.length === 0) {
    return false;
  }
  return normalizedLines.every((line) =>
    line.includes("Permission denied") || line.includes("Operation not permitted"));
}

async function collectWorkspaceEntriesFromCommand(
  command: string,
  args: string[],
  root: string,
): Promise<StreamedWorkspaceEntries> {
  return await new Promise<StreamedWorkspaceEntries>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const entries = new Set<string>();
    let truncated = false;
    let stderr = "";
    let settled = false;
    const reader = createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      reader.close();
      callback();
    };

    reader.on("line", (line) => {
      const entry = normalizeWorkspaceEntry(line);
      if (!entry) {
        return;
      }
      entries.add(entry);
      if (entries.size >= MAX_INDEX_ENTRIES && !truncated) {
        truncated = true;
        child.kill("SIGTERM");
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length >= MAX_STDERR_BYTES) {
        return;
      }
      stderr += chunk.slice(0, Math.max(0, MAX_STDERR_BYTES - stderr.length));
    });

    child.once("error", (error) => {
      settle(() => reject(error));
    });

    child.once("close", (code, signal) => {
      if (truncated || code === 0 || signal === "SIGTERM" || hasOnlyIgnorableFindErrors(command, stderr)) {
        settle(() =>
          resolve({
            entries: [...entries].sort(comparePathDensity),
            truncated: truncated || hasOnlyIgnorableFindErrors(command, stderr),
          }));
        return;
      }
      const detail = stderr.trim();
      settle(() =>
        reject(new Error(detail.length > 0 ? detail : `${command} exited with code ${code ?? "unknown"}`)));
    });
  });
}

async function listWorkspaceFiles(root: string): Promise<StreamedWorkspaceEntries> {
  try {
    return await collectWorkspaceEntriesFromCommand(
      "rg",
      ["--files", "--hidden", "-g", "!.git"],
      root,
    );
  } catch {
    return await collectWorkspaceEntriesFromCommand(
      "find",
      [".", "-path", "*/.git", "-prune", "-o", "-type", "f", "-print"],
      root,
    );
  }
}

async function listWorkspaceDirectories(root: string): Promise<StreamedWorkspaceEntries> {
  return await collectWorkspaceEntriesFromCommand(
    "find",
    [".", "-path", "*/.git", "-prune", "-o", "-type", "d", "-print"],
    root,
  );
}

function subsequenceScore(haystack: string, needle: string): number | null {
  if (needle.length === 0) {
    return 0;
  }
  let lastIndex = -1;
  let gapPenalty = 0;
  for (const char of needle) {
    const nextIndex = haystack.indexOf(char, lastIndex + 1);
    if (nextIndex === -1) {
      return null;
    }
    if (lastIndex >= 0) {
      gapPenalty += Math.max(0, nextIndex - lastIndex - 1);
    }
    lastIndex = nextIndex;
  }
  return Math.max(0, 64 - gapPenalty);
}

function scoreWorkspacePath(candidate: string, query: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    const depth = candidate === "." ? 0 : candidate.split("/").length;
    return 200 - (depth * 4) - Math.min(candidate.length, 120) / 10;
  }

  const normalizedPath = candidate.toLowerCase();
  const baseName = (candidate === "." ? "." : path.posix.basename(candidate)).toLowerCase();

  if (baseName === normalizedQuery) {
    return 1000 - candidate.length / 100;
  }
  if (normalizedPath === normalizedQuery) {
    return 980 - candidate.length / 100;
  }
  if (baseName.startsWith(normalizedQuery)) {
    return 920 - baseName.length / 100;
  }
  if (normalizedPath.startsWith(normalizedQuery)) {
    return 880 - candidate.length / 100;
  }
  const baseSubstringIndex = baseName.indexOf(normalizedQuery);
  if (baseSubstringIndex >= 0) {
    return 820 - baseSubstringIndex - (baseName.length / 100);
  }
  const pathSubstringIndex = normalizedPath.indexOf(normalizedQuery);
  if (pathSubstringIndex >= 0) {
    return 780 - pathSubstringIndex - (candidate.length / 100);
  }

  const baseSubsequenceScore = subsequenceScore(baseName, normalizedQuery);
  if (baseSubsequenceScore !== null) {
    return 700 + baseSubsequenceScore - (baseName.length / 200);
  }
  const pathSubsequenceScore = subsequenceScore(normalizedPath, normalizedQuery);
  if (pathSubsequenceScore !== null) {
    return 620 + pathSubsequenceScore - (candidate.length / 200);
  }
  return null;
}

function searchWorkspaceEntries(
  entries: readonly string[],
  query: string,
  limit: number,
): WorkspaceIndexSearchResult[] {
  const boundedLimit = Math.max(0, limit);
  if (boundedLimit === 0) {
    return [];
  }

  return entries
    .map((entry) => {
      const score = scoreWorkspacePath(entry, query);
      return score === null
        ? undefined
        : {
          path: entry,
          score,
          displayName: entry,
        } satisfies WorkspaceIndexSearchResult;
    })
    .filter((entry): entry is WorkspaceIndexSearchResult => Boolean(entry))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return comparePathDensity(left.path, right.path);
    })
    .slice(0, boundedLimit);
}

export async function loadWorkspaceIndex(root: string): Promise<WorkspaceIndexSnapshot> {
  const directories = await listWorkspaceDirectories(root);
  try {
    const files = await listWorkspaceFiles(root);
    return {
      root,
      files: files.entries,
      directories: directories.entries,
      fileStatus: files.truncated ? "truncated" : "ready",
      directoryStatus: directories.truncated ? "truncated" : "ready",
      fileError: null,
    };
  } catch (error) {
    return {
      root,
      files: [],
      directories: directories.entries,
      fileStatus: "error",
      directoryStatus: directories.truncated ? "truncated" : "ready",
      fileError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function searchWorkspaceFiles(
  snapshot: WorkspaceIndexSnapshot,
  query: string,
  limit: number,
): WorkspaceIndexSearchResult[] {
  return searchWorkspaceEntries(
    snapshot.files.filter((entry) => entry !== "."),
    query,
    limit,
  );
}

export function searchWorkspaceDirectories(
  snapshot: WorkspaceIndexSnapshot,
  query: string,
  limit: number,
): WorkspaceIndexSearchResult[] {
  return searchWorkspaceEntries(snapshot.directories, query, limit);
}
