import type {
  SurfaceComposerState,
  SurfaceMessage,
  SurfacePanelSnapshot,
  SurfacePanelSnapshotMap,
  SurfaceTask,
  SurfaceTurn,
  SurfaceAppState,
  SurfaceOverlay,
} from "./types.js";
import {
  createSurfaceAppState,
  createSurfaceComposerState,
  createSurfaceMessage,
  createSurfaceOverlay,
  createSurfacePanelSnapshot,
  createSurfaceSession,
  createSurfaceTask,
  createSurfaceTurn,
} from "./types.js";
import type { SurfaceEvent } from "./events.js";

export type { SurfaceAppState as SurfaceState } from "./types.js";

function upsertById<T extends { id: string }>(items: readonly T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index < 0) {
    return [...items, nextItem];
  }
  const next = [...items];
  next[index] = nextItem;
  return next;
}

function replaceById<T extends { id: string }>(items: readonly T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index < 0) {
    return items as T[];
  }
  const next = [...items];
  next[index] = nextItem;
  return next;
}

function currentTurnFromState(state: SurfaceAppState): SurfaceTurn | undefined {
  if (state.currentTurnId) {
    return state.turns.find((turn) => turn.id === state.currentTurnId);
  }
  return state.turns.length > 0 ? state.turns[state.turns.length - 1] : undefined;
}

function latestMessageOfKinds(state: SurfaceAppState, kinds: readonly SurfaceMessage["kind"][]): SurfaceMessage | undefined {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message && kinds.includes(message.kind)) {
      return message;
    }
  }
  return undefined;
}

function sortTasks(tasks: readonly SurfaceTask[]): SurfaceTask[] {
  return [...tasks].sort((left, right) => {
    const delta = right.updatedAt.localeCompare(left.updatedAt);
    return delta !== 0 ? delta : left.id.localeCompare(right.id);
  });
}

function eventTimestamp(event: SurfaceEvent): string {
  return event.at ?? event.emittedAt ?? new Date(0).toISOString();
}

function buildRunStatusPanel(input: {
  title: string;
  updatedAt: string;
  summaryLines: string[];
  headline?: string;
  detail?: string;
  run?: SurfaceTurn["run"];
  runId?: string;
  runStatus?: string;
  dispatchStatus?: string;
  taskStatus?: string;
  capabilityKey?: string;
  eventTypes?: string[];
}) {
  return createSurfacePanelSnapshot({
    kind: "run_status",
    title: input.title,
    updatedAt: input.updatedAt,
    summaryLines: input.summaryLines,
    headline: input.headline,
    detail: input.detail,
    run: input.run,
    runId: input.runId,
    runStatus: input.runStatus,
    dispatchStatus: input.dispatchStatus,
    taskStatus: input.taskStatus,
    capabilityKey: input.capabilityKey,
    eventTypes: input.eventTypes,
  });
}

function buildHistoryPanel(state: SurfaceAppState, updatedAt: string) {
  return createSurfacePanelSnapshot({
    kind: "history",
    title: "History",
    updatedAt,
    summaryLines: [
      `messages=${state.messages.length}`,
      `turns=${state.turns.length}`,
      `tasks=${state.tasks.length}`,
    ],
    totalMessages: state.messages.length,
    unseenCount: 0,
    transcriptSize: state.messages.length,
    turnCount: state.turns.length,
    taskCount: state.tasks.length,
  });
}

function buildDebugPanel(state: SurfaceAppState, event: SurfaceEvent, updatedAt: string) {
  const eventLog = state.eventLog ?? [];
  return createSurfacePanelSnapshot({
    kind: "debug",
    title: "Debug",
    updatedAt,
    summaryLines: [
      `events=${eventLog.length}`,
      `last=${event.type}`,
    ],
    rawEventCount: eventLog.length,
    warnings: [],
    eventCount: eventLog.length,
    lastEventType: event.type,
    lastUpdatedAt: updatedAt,
  });
}

function buildDefaultPanelSnapshot(
  panel: string,
  updatedAt: string,
): SurfacePanelSnapshot {
  switch (panel) {
    case "tap":
      return createSurfacePanelSnapshot({
        kind: "tap",
        title: "TAP",
        updatedAt,
        summaryLines: ["No TAP snapshot yet."],
        summary: "No TAP snapshot yet.",
      });
    case "cmp":
      return createSurfacePanelSnapshot({
        kind: "cmp",
        title: "CMP",
        updatedAt,
        summaryLines: ["No CMP snapshot yet."],
        summary: "No CMP snapshot yet.",
        readbackStatus: "idle",
        rows: [],
      });
    case "mp":
      return createSurfacePanelSnapshot({
        kind: "mp",
        title: "MP",
        updatedAt,
        summaryLines: ["No MP snapshot yet."],
        summary: "No MP snapshot yet.",
        status: "idle",
        issues: [],
      });
    case "task":
      return createSurfacePanelSnapshot({
        kind: "task",
        title: "Tasks",
        updatedAt,
        summaryLines: ["No task snapshot yet."],
        totalCount: 0,
        runningCount: 0,
        blockedCount: 0,
        backgroundCount: 0,
      });
    case "history":
      return createSurfacePanelSnapshot({
        kind: "history",
        title: "History",
        updatedAt,
        summaryLines: ["messages=0", "turns=0", "tasks=0"],
        totalMessages: 0,
        unseenCount: 0,
        transcriptSize: 0,
        turnCount: 0,
        taskCount: 0,
      });
    case "debug":
      return createSurfacePanelSnapshot({
        kind: "debug",
        title: "Debug",
        updatedAt,
        summaryLines: ["events=0"],
        rawEventCount: 0,
        warnings: [],
        eventCount: 0,
      });
    case "core":
      return buildRunStatusPanel({
        title: "Run Status",
        updatedAt,
        summaryLines: ["run=idle"],
      });
    case "status":
      return buildRunStatusPanel({
        title: "Status",
        updatedAt,
        summaryLines: ["Ready"],
        headline: "Ready",
        detail: "Awaiting first event.",
      });
    default:
      return buildRunStatusPanel({
        title: panel,
        updatedAt,
        summaryLines: [],
      });
  }
}

function normalizeSummaryLines(
  snapshot: Partial<SurfacePanelSnapshot> & Record<string, unknown>,
  fallback: SurfacePanelSnapshot,
): string[] {
  if (Array.isArray(snapshot.summaryLines)) {
    return snapshot.summaryLines.filter((line): line is string => typeof line === "string");
  }
  if (typeof snapshot.summary === "string" && snapshot.summary.length > 0) {
    return [snapshot.summary];
  }
  return fallback.summaryLines;
}

function mergePanelSnapshot(
  panel: string,
  snapshot: Partial<SurfacePanelSnapshot> & Record<string, unknown>,
  fallback: SurfacePanelSnapshot | undefined,
  updatedAt: string,
): SurfacePanelSnapshot {
  const base = fallback ?? buildDefaultPanelSnapshot(panel, updatedAt);
  const title = typeof snapshot.title === "string" ? snapshot.title : base.title;
  const mergedAt = typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : updatedAt;
  const summaryLines = normalizeSummaryLines(snapshot, base);

  switch (base.kind) {
    case "tap":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "tap",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "cmp":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "cmp",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "mp":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "mp",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "task":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "task",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "history":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "history",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "debug":
      return createSurfacePanelSnapshot({
        ...base,
        ...snapshot,
        kind: "debug",
        title,
        updatedAt: mergedAt,
        summaryLines,
      });
    case "run_status":
      return buildRunStatusPanel({
        title,
        updatedAt: mergedAt,
        summaryLines,
        headline: typeof snapshot.headline === "string" ? snapshot.headline : base.headline,
        detail: typeof snapshot.detail === "string" ? snapshot.detail : base.detail,
        run: "run" in snapshot ? snapshot.run as SurfaceTurn["run"] : base.run,
        runId: typeof snapshot.runId === "string" ? snapshot.runId : base.runId,
        runStatus: typeof snapshot.runStatus === "string" ? snapshot.runStatus : base.runStatus,
        dispatchStatus: typeof snapshot.dispatchStatus === "string" ? snapshot.dispatchStatus : base.dispatchStatus,
        taskStatus: typeof snapshot.taskStatus === "string" ? snapshot.taskStatus : base.taskStatus,
        capabilityKey: typeof snapshot.capabilityKey === "string" ? snapshot.capabilityKey : base.capabilityKey,
        eventTypes: Array.isArray(snapshot.eventTypes)
          ? snapshot.eventTypes.filter((value): value is string => typeof value === "string")
          : base.eventTypes,
      });
  }
}

function derivePanels(state: SurfaceAppState, event: SurfaceEvent): SurfacePanelSnapshotMap {
  const currentTurn = currentTurnFromState(state);
  const latestAssistant = latestMessageOfKinds(state, ["assistant"]);
  const latestStatusMessage = latestMessageOfKinds(state, ["status", "error"]);
  const activeTasks = state.tasks.filter((task) =>
    task.status === "running" || task.status === "waiting" || task.status === "blocked");
  const updatedAt = eventTimestamp(event);
  const eventLog = state.eventLog ?? [];
  const run = currentTurn?.run;
  const primaryTask = activeTasks[0];

  return {
    ...state.panels,
    core: buildRunStatusPanel({
      title: "Run Status",
      updatedAt,
      summaryLines: [
        `run=${run?.status ?? currentTurn?.status ?? "idle"}`,
        `dispatch=${run?.lastDispatchStatus ?? (currentTurn?.assistantText ? "answered" : "idle")}`,
        `task=${primaryTask?.status ?? run?.lastTaskStatus ?? "idle"}`,
      ],
      run,
      runId: run?.runId,
      runStatus: run?.status ?? currentTurn?.status,
      dispatchStatus: run?.lastDispatchStatus ?? (currentTurn?.assistantText ? "answered" : undefined),
      taskStatus: primaryTask?.status ?? run?.lastTaskStatus,
      capabilityKey: primaryTask?.capabilityKey ?? run?.lastCapabilityKey,
      eventTypes: eventLog.slice(-8).map((entry) => entry.type),
      headline: run?.summary ?? latestAssistant?.text,
      detail: latestStatusMessage?.text ?? primaryTask?.summary,
    }),
    status: buildRunStatusPanel({
      title: "Status",
      updatedAt,
      summaryLines: [
        state.overlays.length > 0
          ? `overlay=${state.overlays[state.overlays.length - 1]?.title ?? state.overlays[state.overlays.length - 1]?.kind}`
          : activeTasks.length > 0
            ? `active_tasks=${activeTasks.length}`
            : latestAssistant
              ? "assistant=updated"
              : state.session
                ? `session=${state.session.sessionId}`
                : "ready",
      ],
      headline: state.overlays.length > 0
        ? `Overlay: ${state.overlays[state.overlays.length - 1]?.title ?? state.overlays[state.overlays.length - 1]?.kind}`
        : activeTasks.length > 0
          ? `${activeTasks.length} active task(s)`
          : latestAssistant
            ? "Assistant updated"
            : state.session
              ? `Session ${state.session.sessionId}`
              : "Ready",
      detail: latestStatusMessage?.text ?? latestAssistant?.text ?? activeTasks[0]?.summary,
    }),
    history: buildHistoryPanel(state, updatedAt),
    debug: buildDebugPanel(state, event, updatedAt),
  };
}

function normalizeComposerPatch(
  patch: Partial<SurfaceComposerState> | undefined,
): Partial<SurfaceComposerState> {
  if (!patch) {
    return {};
  }
  if (typeof patch.value === "string" && patch.buffer === undefined) {
    return {
      ...patch,
      buffer: patch.value,
    };
  }
  return patch;
}

function updateTurnForMessage(turn: SurfaceTurn, message: SurfaceMessage): SurfaceTurn {
  if (message.kind === "user") {
    return {
      ...turn,
      userText: message.text,
    };
  }
  if (message.kind === "assistant") {
    return {
      ...turn,
      assistantText: message.text,
    };
  }
  return turn;
}

function patchExistingMessage(
  state: SurfaceAppState,
  messageId: string,
  textDelta: string,
): SurfaceMessage[] {
  return state.messages.map((message) => (
    message.id === messageId
      ? {
        ...message,
        text: `${message.text}${textDelta}`,
      }
      : message
  ));
}

export function createInitialSurfaceState(
  seed: Partial<SurfaceAppState> = {},
): SurfaceAppState {
  const updatedAt = seed.updatedAt ?? new Date(0).toISOString();
  return {
    ...createSurfaceAppState({
      ...seed,
      composer: createSurfaceComposerState({
        mode: seed.composer?.mode ?? "prompt",
        ...seed.composer,
      }),
      eventLog: seed.eventLog ?? [],
    }),
    session: seed.session ?? undefined,
    panels: {
      core: seed.panels?.core ?? buildRunStatusPanel({
        title: "Run Status",
        updatedAt,
        summaryLines: ["run=idle"],
        eventTypes: [],
      }),
      tap: seed.panels?.tap ?? createSurfacePanelSnapshot({
        kind: "tap",
        title: "TAP",
        updatedAt,
        summaryLines: ["No TAP snapshot yet."],
        summary: "No TAP snapshot yet.",
      }),
      cmp: seed.panels?.cmp ?? createSurfacePanelSnapshot({
        kind: "cmp",
        title: "CMP",
        updatedAt,
        summaryLines: ["No CMP snapshot yet."],
        summary: "No CMP snapshot yet.",
        readbackStatus: "idle",
        rows: [],
      }),
      mp: seed.panels?.mp ?? createSurfacePanelSnapshot({
        kind: "mp",
        title: "MP",
        updatedAt,
        summaryLines: ["No MP snapshot yet."],
        summary: "No MP snapshot yet.",
        status: "idle",
        issues: [],
      }),
      status: seed.panels?.status ?? buildRunStatusPanel({
        title: "Status",
        updatedAt,
        summaryLines: ["Ready"],
        headline: "Ready",
        detail: "Awaiting first event.",
      }),
      history: seed.panels?.history ?? createSurfacePanelSnapshot({
        kind: "history",
        title: "History",
        updatedAt,
        summaryLines: ["messages=0", "turns=0", "tasks=0"],
        totalMessages: 0,
        unseenCount: 0,
        transcriptSize: 0,
        turnCount: 0,
        taskCount: 0,
      }),
      debug: seed.panels?.debug ?? createSurfacePanelSnapshot({
        kind: "debug",
        title: "Debug",
        updatedAt,
        summaryLines: ["events=0"],
        rawEventCount: 0,
        warnings: [],
        eventCount: 0,
      }),
    },
  };
}

export function applySurfaceEvent(
  state: SurfaceAppState,
  event: SurfaceEvent,
): SurfaceAppState {
  const at = eventTimestamp(event);
  const eventLog = state.eventLog ?? [];
  let next: SurfaceAppState = {
    ...state,
    eventLog: [...eventLog, { type: event.type, at, emittedAt: event.emittedAt }],
  };

  switch (event.type) {
    case "session.started":
      next = {
        ...next,
        session: createSurfaceSession({
          ...event.session,
          transcriptMessageIds: event.session.transcriptMessageIds ?? [],
          taskIds: event.session.taskIds ?? [],
          updatedAt: event.session.updatedAt ?? at,
        }),
      };
      break;
    case "session.updated":
      next = {
        ...next,
        session: createSurfaceSession({
          ...(next.session ?? {
            sessionId: event.session.sessionId,
            startedAt: at,
            updatedAt: at,
            uiMode: "full",
          }),
          ...event.session,
          transcriptMessageIds: event.session.transcriptMessageIds ?? next.session?.transcriptMessageIds ?? [],
          taskIds: event.session.taskIds ?? next.session?.taskIds ?? [],
          updatedAt: event.session.updatedAt ?? at,
        }),
      };
      break;
    case "turn.started":
      next = {
        ...next,
        currentTurnId: event.turn.turnId ?? event.turn.id,
        turns: upsertById(next.turns, createSurfaceTurn(event.turn)),
      };
      break;
    case "turn.updated":
    case "turn.completed": {
      const turnId = event.turn.turnId ?? event.turn.id ?? next.currentTurnId ?? `turn-${next.turns.length}`;
      const current = next.turns.find((turn) => turn.id === turnId || turn.turnId === turnId);
      const merged = createSurfaceTurn({
        ...(current ?? {
          turnId,
          id: turnId,
          turnIndex: next.turns.length,
          status: "idle",
          startedAt: at,
          updatedAt: at,
          outputMessageIds: [],
          taskIds: [],
        }),
        ...event.turn,
        turnId,
        id: event.turn.id ?? event.turn.turnId ?? turnId,
        updatedAt: event.turn.updatedAt ?? at,
      });
      next = {
        ...next,
        currentTurnId: event.type === "turn.completed"
          ? (next.currentTurnId && next.currentTurnId !== merged.turnId ? next.currentTurnId : merged.turnId)
          : merged.turnId,
        turns: upsertById(next.turns, merged),
      };
      break;
    }
    case "message.appended": {
      const message = createSurfaceMessage(event.message);
      const messages = upsertById(next.messages, message);
      const turns = event.message.turnId
        ? next.turns.map((turn) => (
          turn.id === event.message.turnId || turn.turnId === event.message.turnId
            ? createSurfaceTurn({
              ...updateTurnForMessage(turn, message),
              inputMessageId: message.kind === "user" ? message.messageId : turn.inputMessageId,
              outputMessageIds: message.kind === "assistant"
                ? (turn.outputMessageIds.includes(message.messageId)
                    ? turn.outputMessageIds
                    : [...turn.outputMessageIds, message.messageId])
                : turn.outputMessageIds,
            })
            : turn
        ))
        : next.turns;
      next = {
        ...next,
        currentTurnId: message.turnId ?? next.currentTurnId,
        messages,
        turns,
        session: next.session
          ? createSurfaceSession({
            ...next.session,
            transcriptMessageIds: next.session.transcriptMessageIds.includes(message.messageId)
              ? next.session.transcriptMessageIds
              : [...next.session.transcriptMessageIds, message.messageId],
            updatedAt: at,
          })
          : next.session,
      };
      break;
    }
    case "message.updated": {
      const message = createSurfaceMessage(event.message);
      const messages = replaceById(next.messages, message);
      const turns = event.message.turnId
        ? next.turns.map((turn) => (
          turn.id === event.message.turnId || turn.turnId === event.message.turnId
            ? createSurfaceTurn({
              ...updateTurnForMessage(turn, message),
              updatedAt: at,
              inputMessageId: message.kind === "user" ? message.messageId : turn.inputMessageId,
              outputMessageIds: message.kind === "assistant"
                ? (turn.outputMessageIds.includes(message.messageId)
                    ? turn.outputMessageIds
                    : [...turn.outputMessageIds, message.messageId])
                : turn.outputMessageIds,
            })
            : turn
        ))
        : next.turns;
      next = {
        ...next,
        messages,
        turns,
        currentTurnId: message.turnId ?? next.currentTurnId,
      };
      break;
    }
    case "message.delta": {
      const messages = patchExistingMessage(next, event.messageId, event.textDelta);
      const patched = messages.find((message) => message.id === event.messageId || message.messageId === event.messageId);
      const turns = patched?.turnId
        ? next.turns.map((turn) => (
          turn.id === patched.turnId || turn.turnId === patched.turnId
            ? createSurfaceTurn({
              ...updateTurnForMessage(turn, patched),
              updatedAt: at,
            })
            : turn
        ))
        : next.turns;
      next = {
        ...next,
        messages,
        turns,
      };
      break;
    }
    case "task.started":
    case "task.updated":
    case "task.upserted":
      next = {
        ...next,
        tasks: upsertById(next.tasks, createSurfaceTask(event.task)),
        session: next.session
          ? createSurfaceSession({
            ...next.session,
            taskIds: [...next.session.taskIds, event.task.taskId],
            updatedAt: at,
          })
          : next.session,
      };
      break;
    case "task.completed":
      next = {
        ...next,
        tasks: next.tasks.map((task) => (
          task.id === (event.taskId ?? event.task.taskId) || task.taskId === (event.taskId ?? event.task.taskId)
            ? createSurfaceTask({
              ...task,
              status: event.status ?? event.task.status,
              summary: event.summary ?? task.summary,
              updatedAt: at,
            })
            : task
        )),
      };
      break;
    case "tap.snapshot.updated":
      next = {
        ...next,
        panels: {
          ...next.panels,
          tap: event.snapshot.kind === "tap" ? event.snapshot : next.panels.tap,
        },
      };
      break;
    case "cmp.snapshot.updated":
      next = {
        ...next,
        panels: {
          ...next.panels,
          cmp: event.snapshot.kind === "cmp" ? event.snapshot : next.panels.cmp,
        },
      };
      break;
    case "mp.snapshot.updated":
      next = {
        ...next,
        panels: {
          ...next.panels,
          mp: event.snapshot.kind === "mp" ? event.snapshot : next.panels.mp,
        },
      };
      break;
    case "panel.updated":
      next = {
        ...next,
        panels: {
          ...next.panels,
          [event.panel]: mergePanelSnapshot(event.panel, event.snapshot, next.panels[event.panel as keyof SurfacePanelSnapshotMap], at),
        },
      };
      break;
    case "composer.updated":
      next = {
        ...next,
        composer: createSurfaceComposerState({
          ...next.composer,
          ...normalizeComposerPatch(event.patch),
          ...normalizeComposerPatch(event.composer),
        }),
      };
      break;
    case "overlay.opened":
      {
        const overlay = createSurfaceOverlay({
          ...event.overlay,
          openedAt: event.overlay.openedAt ?? at,
        });
      next = {
        ...next,
        overlays: upsertById(next.overlays, overlay),
        activeOverlayId: overlay.overlayId,
      };
      }
      break;
    case "overlay.closed":
      next = {
        ...next,
        overlays: next.overlays.filter((overlay) => overlay.id !== event.overlayId && overlay.overlayId !== event.overlayId),
        activeOverlayId: next.activeOverlayId === event.overlayId ? undefined : next.activeOverlayId,
      };
      break;
    case "error.reported":
      if (event.message) {
        next = {
          ...next,
          messages: upsertById(next.messages, createSurfaceMessage(event.message)),
        };
      } else {
        next = {
          ...next,
          messages: upsertById(next.messages, createSurfaceMessage({
            messageId: event.error.errorId,
            turnId: event.turnId ?? event.error.turnId,
            taskId: event.error.taskId,
            kind: "error",
            text: event.error.message,
            createdAt: event.error.createdAt,
            status: event.error.severity ?? "error",
            metadata: {
              recoverable: event.error.recoverable,
            },
          })),
        };
      }
      break;
  }

  next.panels = derivePanels(next, event);
  next.tasks = sortTasks(next.tasks);
  return next;
}

export function reduceSurfaceEvents(
  initialState: SurfaceAppState,
  events: readonly SurfaceEvent[],
): SurfaceAppState {
  return events.reduce((state, event) => applySurfaceEvent(state, event), initialState);
}
