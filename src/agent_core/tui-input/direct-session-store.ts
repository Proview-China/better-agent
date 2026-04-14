import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { resolveSessionsDir } from "../../runtime-paths.js";

export interface DirectTuiSessionMessageRecord {
  messageId: string;
  kind: string;
  text: string;
  createdAt: string;
  turnId?: string;
  status?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  capabilityKey?: string;
  title?: string;
  errorCode?: string;
}

export interface DirectTuiAgentSnapshot {
  agentId: string;
  name: string;
  kind: "core" | "task";
  status: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  sourceTaskId?: string;
  capabilityKey?: string;
}

export interface DirectTuiAgentRegistryRecord extends DirectTuiAgentSnapshot {
  workspace: string;
  lastSessionId?: string;
}

export interface DirectTuiSessionSnapshot {
  schemaVersion: 1;
  sessionId: string;
  agentId: string;
  name: string;
  workspace: string;
  route: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  selectedAgentId?: string;
  agents: DirectTuiAgentSnapshot[];
  agentLabels?: Record<string, string>;
  compiledInitPreamble?: string;
  initArtifactPath?: string;
  messages: DirectTuiSessionMessageRecord[];
}

export interface DirectTuiDialogueTurnRecord {
  role: "user" | "assistant";
  text: string;
}

export interface DirectTuiSessionIndexRecord {
  sessionId: string;
  agentId?: string;
  name: string;
  workspace: string;
  route: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  selectedAgentId?: string;
  lastAssistantText?: string;
  messageCount: number;
}

interface DirectTuiSessionIndexFile {
  schemaVersion: 1;
  sessions: DirectTuiSessionIndexRecord[];
}

interface DirectTuiAgentRegistryFile {
  schemaVersion: 1;
  agents: DirectTuiAgentRegistryRecord[];
}

function ensureSessionsDir(fallbackDir = process.cwd()): string {
  const directory = resolveSessionsDir(fallbackDir);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function indexPath(fallbackDir = process.cwd()): string {
  return join(ensureSessionsDir(fallbackDir), "direct-tui-index.json");
}

function snapshotPath(sessionId: string, fallbackDir = process.cwd()): string {
  return join(ensureSessionsDir(fallbackDir), `${encodeURIComponent(sessionId)}.json`);
}

export function resolveDirectTuiSessionSnapshotPath(
  sessionId: string,
  fallbackDir = process.cwd(),
): string {
  return snapshotPath(sessionId, fallbackDir);
}

function agentsPath(fallbackDir = process.cwd()): string {
  return join(ensureSessionsDir(fallbackDir), "direct-tui-agents.json");
}

function loadIndexFile(fallbackDir = process.cwd()): DirectTuiSessionIndexFile {
  const filePath = indexPath(fallbackDir);
  if (!existsSync(filePath)) {
    return {
      schemaVersion: 1,
      sessions: [],
    };
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DirectTuiSessionIndexFile>;
  return {
    schemaVersion: 1,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  };
}

function writeIndexFile(file: DirectTuiSessionIndexFile, fallbackDir = process.cwd()): void {
  writeFileSync(indexPath(fallbackDir), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function listDirectTuiSessions(fallbackDir = process.cwd()): DirectTuiSessionIndexRecord[] {
  return loadIndexFile(fallbackDir).sessions
    .map((record) => {
      if (record.agentId) {
        return record;
      }
      const snapshot = loadDirectTuiSessionSnapshot(record.sessionId, fallbackDir);
      return {
        ...record,
        agentId: snapshot?.agentId,
      };
    })
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function loadAgentsFile(fallbackDir = process.cwd()): DirectTuiAgentRegistryFile {
  const filePath = agentsPath(fallbackDir);
  if (!existsSync(filePath)) {
    return {
      schemaVersion: 1,
      agents: [],
    };
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DirectTuiAgentRegistryFile>;
  return {
    schemaVersion: 1,
    agents: Array.isArray(parsed.agents)
      ? parsed.agents.filter((entry): entry is DirectTuiAgentRegistryRecord =>
        Boolean(entry)
        && typeof entry === "object"
        && typeof (entry as DirectTuiAgentRegistryRecord).agentId === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).name === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).kind === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).status === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).summary === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).workspace === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).createdAt === "string"
        && typeof (entry as DirectTuiAgentRegistryRecord).updatedAt === "string")
      : [],
  };
}

function writeAgentsFile(file: DirectTuiAgentRegistryFile, fallbackDir = process.cwd()): void {
  writeFileSync(agentsPath(fallbackDir), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function listDirectTuiAgents(fallbackDir = process.cwd()): DirectTuiAgentRegistryRecord[] {
  return loadAgentsFile(fallbackDir).agents
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveDirectTuiAgent(
  agent: DirectTuiAgentRegistryRecord,
  fallbackDir = process.cwd(),
): void {
  const file = loadAgentsFile(fallbackDir);
  const nextAgents = file.agents.filter((entry) => entry.agentId !== agent.agentId);
  nextAgents.push(agent);
  writeAgentsFile({
    schemaVersion: 1,
    agents: nextAgents,
  }, fallbackDir);
}

export function renameDirectTuiAgent(
  agentId: string,
  name: string,
  fallbackDir = process.cwd(),
): void {
  const file = loadAgentsFile(fallbackDir);
  const nextAgents = file.agents.map((agent) => agent.agentId === agentId
    ? {
      ...agent,
      name,
      updatedAt: new Date().toISOString(),
    }
    : agent);
  writeAgentsFile({
    schemaVersion: 1,
    agents: nextAgents,
  }, fallbackDir);
}

export function loadDirectTuiSessionSnapshot(
  sessionId: string,
  fallbackDir = process.cwd(),
): DirectTuiSessionSnapshot | null {
  const filePath = snapshotPath(sessionId, fallbackDir);
  if (!existsSync(filePath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DirectTuiSessionSnapshot>;
  return {
    schemaVersion: 1,
    sessionId,
    agentId: typeof parsed.agentId === "string" && parsed.agentId.trim()
      ? parsed.agentId
      : (typeof parsed.selectedAgentId === "string" && parsed.selectedAgentId.trim()
        ? parsed.selectedAgentId
        : `agent.core:main`),
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : sessionId,
    workspace: typeof parsed.workspace === "string" ? parsed.workspace : fallbackDir,
    route: typeof parsed.route === "string" ? parsed.route : "",
    model: typeof parsed.model === "string" ? parsed.model : "",
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    selectedAgentId: typeof parsed.selectedAgentId === "string" ? parsed.selectedAgentId : undefined,
    agents: Array.isArray(parsed.agents)
      ? parsed.agents.filter((entry): entry is DirectTuiAgentSnapshot =>
        Boolean(entry)
        && typeof entry === "object"
        && typeof (entry as DirectTuiAgentSnapshot).agentId === "string"
        && typeof (entry as DirectTuiAgentSnapshot).name === "string"
        && typeof (entry as DirectTuiAgentSnapshot).kind === "string"
        && typeof (entry as DirectTuiAgentSnapshot).status === "string"
        && typeof (entry as DirectTuiAgentSnapshot).summary === "string"
        && typeof (entry as DirectTuiAgentSnapshot).createdAt === "string"
        && typeof (entry as DirectTuiAgentSnapshot).updatedAt === "string")
      : [],
    agentLabels: parsed.agentLabels && typeof parsed.agentLabels === "object" ? parsed.agentLabels as Record<string, string> : undefined,
    compiledInitPreamble: typeof parsed.compiledInitPreamble === "string" ? parsed.compiledInitPreamble : undefined,
    initArtifactPath: typeof parsed.initArtifactPath === "string" ? parsed.initArtifactPath : undefined,
    messages: Array.isArray(parsed.messages)
      ? parsed.messages.flatMap((entry) => {
        if (
          !entry
          || typeof entry !== "object"
          || typeof (entry as DirectTuiSessionMessageRecord).messageId !== "string"
          || typeof (entry as DirectTuiSessionMessageRecord).kind !== "string"
          || typeof (entry as DirectTuiSessionMessageRecord).text !== "string"
          || typeof (entry as DirectTuiSessionMessageRecord).createdAt !== "string"
        ) {
          return [];
        }
        const record = entry as DirectTuiSessionMessageRecord;
        return [{
          messageId: record.messageId,
          kind: record.kind,
          text: record.text,
          createdAt: record.createdAt,
          turnId: typeof record.turnId === "string" ? record.turnId : undefined,
          status: typeof record.status === "string" ? record.status : undefined,
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
          metadata: record.metadata && typeof record.metadata === "object"
            ? { ...record.metadata }
            : undefined,
          capabilityKey: typeof record.capabilityKey === "string" ? record.capabilityKey : undefined,
          title: typeof record.title === "string" ? record.title : undefined,
          errorCode: typeof record.errorCode === "string" ? record.errorCode : undefined,
        }];
      })
      : [],
  };
}

export function restoreDirectTuiDialogueTurnsFromSnapshot(
  snapshot: DirectTuiSessionSnapshot,
): DirectTuiDialogueTurnRecord[] {
  return snapshot.messages.flatMap((message): DirectTuiDialogueTurnRecord[] => {
    if ((message.kind !== "user" && message.kind !== "assistant") || message.text.trim().length === 0) {
      return [];
    }
    return [{
      role: message.kind,
      text: message.text,
    }];
  });
}

export function resolveDirectTuiSnapshotTurnIndex(
  snapshot: DirectTuiSessionSnapshot,
): number {
  const turnIndices = snapshot.messages.flatMap((message) => {
    if (typeof message.turnId !== "string") {
      return [];
    }
    const match = message.turnId.match(/^turn-(\d+)$/u);
    if (!match) {
      return [];
    }
    const value = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(value) ? [value] : [];
  });
  if (turnIndices.length > 0) {
    return Math.max(...turnIndices);
  }
  return snapshot.messages.filter((message) => message.kind === "user").length;
}

export function saveDirectTuiSessionSnapshot(
  snapshot: DirectTuiSessionSnapshot,
  fallbackDir = process.cwd(),
): void {
  const normalizedSnapshot: DirectTuiSessionSnapshot = {
    ...snapshot,
    agents: snapshot.agents.slice(),
  };
  if (normalizedSnapshot.agentLabels && Object.keys(normalizedSnapshot.agentLabels).length === 0) {
    delete normalizedSnapshot.agentLabels;
  }
  writeFileSync(snapshotPath(snapshot.sessionId, fallbackDir), `${JSON.stringify(normalizedSnapshot, null, 2)}\n`, "utf8");
  const index = loadIndexFile(fallbackDir);
  const record: DirectTuiSessionIndexRecord = {
    sessionId: snapshot.sessionId,
    agentId: snapshot.agentId,
    name: snapshot.name,
    workspace: snapshot.workspace,
    route: snapshot.route,
    model: snapshot.model,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    selectedAgentId: snapshot.selectedAgentId,
    lastAssistantText: [...snapshot.messages].reverse().find((message) => message.kind === "assistant")?.text,
    messageCount: snapshot.messages.length,
  };
  const nextSessions = index.sessions.filter((entry) => entry.sessionId !== snapshot.sessionId);
  nextSessions.push(record);
  writeIndexFile({
    schemaVersion: 1,
    sessions: nextSessions,
  }, fallbackDir);
}

export function renameDirectTuiSession(
  sessionId: string,
  name: string,
  fallbackDir = process.cwd(),
): void {
  const snapshot = loadDirectTuiSessionSnapshot(sessionId, fallbackDir);
  if (!snapshot) {
    return;
  }
  saveDirectTuiSessionSnapshot({
    ...snapshot,
    name,
    updatedAt: new Date().toISOString(),
  }, fallbackDir);
}
