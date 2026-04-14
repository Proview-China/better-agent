import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { ensureWorkspaceRewindDir, type WorkspaceRaxodeGitReadback } from "./workspace-raxode-store.js";

export interface DirectTuiTurnCheckpointRecord {
  sessionId: string;
  agentId: string;
  turnId: string;
  turnIndex?: number;
  messageId: string;
  transcriptCutMessageId: string;
  createdAt: string;
  userText: string;
  workspaceRoot: string;
  git?: WorkspaceRaxodeGitReadback;
  workspaceCheckpointRef?: string;
  workspaceCheckpointCommit?: string;
  workspaceCheckpointError?: string;
}

interface DirectTuiTurnCheckpointFile {
  schemaVersion: 1;
  workspaceRoot: string;
  sessionId: string;
  checkpoints: DirectTuiTurnCheckpointRecord[];
}

function ensureCheckpointDir(workspaceRoot: string): string {
  const directory = join(ensureWorkspaceRewindDir(workspaceRoot), "turn-ledger");
  mkdirSync(directory, { recursive: true });
  return directory;
}

function checkpointFilePath(sessionId: string, workspaceRoot: string): string {
  return join(ensureCheckpointDir(workspaceRoot), `${encodeURIComponent(sessionId)}.json`);
}

function loadCheckpointFile(sessionId: string, workspaceRoot: string): DirectTuiTurnCheckpointFile {
  const filePath = checkpointFilePath(sessionId, workspaceRoot);
  if (!existsSync(filePath)) {
    return {
      schemaVersion: 1,
      workspaceRoot,
      sessionId,
      checkpoints: [],
    };
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DirectTuiTurnCheckpointFile>;
  return {
    schemaVersion: 1,
    workspaceRoot,
    sessionId,
    checkpoints: Array.isArray(parsed.checkpoints)
      ? parsed.checkpoints.filter((entry): entry is DirectTuiTurnCheckpointRecord =>
        Boolean(entry)
        && typeof entry === "object"
        && typeof (entry as DirectTuiTurnCheckpointRecord).sessionId === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).agentId === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).turnId === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).messageId === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).transcriptCutMessageId === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).createdAt === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).userText === "string"
        && typeof (entry as DirectTuiTurnCheckpointRecord).workspaceRoot === "string")
      : [],
  };
}

function writeCheckpointFile(file: DirectTuiTurnCheckpointFile): void {
  writeFileSync(checkpointFilePath(file.sessionId, file.workspaceRoot), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function listDirectTuiTurnCheckpoints(
  sessionId: string,
  workspaceRoot: string,
): DirectTuiTurnCheckpointRecord[] {
  return loadCheckpointFile(sessionId, workspaceRoot).checkpoints
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getDirectTuiTurnCheckpoint(
  sessionId: string,
  turnId: string,
  workspaceRoot: string,
): DirectTuiTurnCheckpointRecord | undefined {
  return loadCheckpointFile(sessionId, workspaceRoot).checkpoints.find((entry) => entry.turnId === turnId);
}

export function upsertDirectTuiTurnCheckpoint(
  sessionId: string,
  checkpoint: DirectTuiTurnCheckpointRecord,
  workspaceRoot: string,
): void {
  const file = loadCheckpointFile(sessionId, workspaceRoot);
  const nextCheckpoints = file.checkpoints.filter((entry) => entry.turnId !== checkpoint.turnId);
  nextCheckpoints.push(checkpoint);
  writeCheckpointFile({
    schemaVersion: 1,
    workspaceRoot,
    sessionId,
    checkpoints: nextCheckpoints,
  });
}
