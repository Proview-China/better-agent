import {
  createSurfaceAppState,
  createSurfaceSession,
  type SurfaceAppState,
  type SurfaceMessage,
  type SurfaceTask,
  type SurfaceTurn,
} from "../surface/index.js";
import type { DirectTuiTurnCheckpointRecord } from "./direct-turn-checkpoints.js";

export const DIRECT_TUI_REWIND_MODES = [
  "rewind_turn_and_workspace",
  "rewind_turn_only",
  "rewind_workspace_only",
] as const;

export type DirectTuiRewindMode = (typeof DIRECT_TUI_REWIND_MODES)[number];

export interface DirectTuiRewindTurnOption {
  sessionId: string;
  agentId: string;
  turnId: string;
  turnIndex: number;
  messageId: string;
  createdAt: string;
  userText: string;
  transcriptCutMessageId?: string;
  workspaceCheckpointRef?: string;
  workspaceCheckpointCommit?: string;
  workspaceCheckpointError?: string;
}

export interface DirectTuiRewindModeOption {
  mode: DirectTuiRewindMode;
  label: string;
  description: string;
  disabled: boolean;
  reason?: string;
}

export function parseDirectTuiTurnIndex(turnId: string): number {
  const trimmed = turnId.trim();
  if (/^\d+$/u.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  const match = trimmed.match(/(\d+)$/u);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number.parseInt(match[1] ?? "", 10);
}

export function buildDirectTuiRewindTurnOptions(params: {
  messages: SurfaceMessage[];
  checkpoints: DirectTuiTurnCheckpointRecord[];
}): DirectTuiRewindTurnOption[] {
  const checkpointMap = new Map(params.checkpoints.map((entry) => [entry.turnId, entry]));
  return params.messages
    .filter((message) => message.kind === "user" && typeof message.turnId === "string" && message.turnId.length > 0)
    .map((message) => {
      const checkpoint = checkpointMap.get(message.turnId ?? "");
      return {
        sessionId: checkpoint?.sessionId ?? "",
        agentId: checkpoint?.agentId ?? "agent.core:main",
        turnId: message.turnId ?? "",
        turnIndex: parseDirectTuiTurnIndex(message.turnId ?? ""),
        messageId: message.messageId,
        createdAt: message.createdAt,
        userText: message.text,
        transcriptCutMessageId: checkpoint?.transcriptCutMessageId,
        workspaceCheckpointRef: checkpoint?.workspaceCheckpointRef,
        workspaceCheckpointCommit: checkpoint?.workspaceCheckpointCommit,
        workspaceCheckpointError: checkpoint?.workspaceCheckpointError,
      };
    })
    .sort((left, right) => right.turnIndex - left.turnIndex);
}

export function buildDirectTuiRewindModeOptions(
  option: DirectTuiRewindTurnOption | undefined,
): DirectTuiRewindModeOption[] {
  const hasWorkspaceCheckpoint = Boolean(option?.workspaceCheckpointRef);
  const unavailableReason = option?.workspaceCheckpointError
    ? `No workspace checkpoint: ${option.workspaceCheckpointError}`
    : "No workspace checkpoint for this turn yet.";
  return [
    {
      mode: "rewind_turn_and_workspace",
      label: "Rewind turn and workspace",
      description: "回退到选中输入，并回退之后的所有改动。",
      disabled: !hasWorkspaceCheckpoint,
      reason: !hasWorkspaceCheckpoint ? unavailableReason : undefined,
    },
    {
      mode: "rewind_turn_only",
      label: "Rewind turn only",
      description: "只回退对话，不动后续工作区改动。",
      disabled: false,
    },
    {
      mode: "rewind_workspace_only",
      label: "Rewind workspace only",
      description: "只回退后续工作区改动，不回退对话。",
      disabled: !hasWorkspaceCheckpoint,
      reason: !hasWorkspaceCheckpoint ? unavailableReason : undefined,
    },
  ];
}

function trimMessagesToTurn(
  messages: SurfaceMessage[],
  targetTurnId: string,
  transcriptCutMessageId?: string,
): SurfaceMessage[] {
  const cutoffIndex = transcriptCutMessageId
    ? messages.findIndex((message) => message.messageId === transcriptCutMessageId)
    : [...messages]
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.turnId === targetTurnId)
      .map(({ index }) => index)
      .pop();
  if (cutoffIndex === undefined || cutoffIndex < 0) {
    return messages;
  }
  return messages.slice(0, cutoffIndex + 1);
}

function trimTurnsToTarget(turns: SurfaceTurn[], targetTurnId: string): SurfaceTurn[] {
  return turns.filter((turn) => parseDirectTuiTurnIndex(turn.turnId) <= parseDirectTuiTurnIndex(targetTurnId));
}

function trimTasksToTurn(tasks: SurfaceTask[], remainingTurnIds: Set<string>): SurfaceTask[] {
  return tasks.filter((task) => !task.turnId || remainingTurnIds.has(task.turnId));
}

export function rewindSurfaceStateToTurn(
  state: SurfaceAppState,
  targetTurnId: string,
  at: string,
  transcriptCutMessageId?: string,
): SurfaceAppState {
  const messages = trimMessagesToTurn(state.messages, targetTurnId, transcriptCutMessageId);
  const turns = trimTurnsToTarget(state.turns, targetTurnId);
  const remainingTurnIds = new Set(
    messages
      .map((message) => message.turnId)
      .filter((turnId): turnId is string => typeof turnId === "string" && turnId.length > 0),
  );
  const tasks = trimTasksToTurn(state.tasks, remainingTurnIds);
  const session = state.session
    ? createSurfaceSession({
      ...state.session,
      activeTurnId: targetTurnId,
      currentRunId: targetTurnId,
      updatedAt: at,
      transcriptMessageIds: messages.map((message) => message.messageId),
      taskIds: tasks.map((task) => task.taskId),
    })
    : state.session;

  return createSurfaceAppState({
    ...state,
    session,
    turns,
    messages,
    tasks,
    currentTurnId: targetTurnId,
    selectedTurnId: targetTurnId,
    updatedAt: at,
  });
}
