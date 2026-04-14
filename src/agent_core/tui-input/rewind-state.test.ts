import assert from "node:assert/strict";
import test from "node:test";

import { createSurfaceAppState, createSurfaceMessage, createSurfaceSession, createSurfaceTurn } from "../surface/index.js";
import {
  buildDirectTuiRewindModeOptions,
  buildDirectTuiRewindTurnOptions,
  rewindSurfaceStateToTurn,
} from "./rewind-state.js";

test("rewind turn options list current-session user turns in reverse order and surface checkpoint availability", () => {
  const options = buildDirectTuiRewindTurnOptions({
    messages: [
      createSurfaceMessage({
        messageId: "user:1",
        turnId: "1",
        kind: "user",
        text: "first turn",
        createdAt: "2026-04-14T00:00:01.000Z",
      }),
      createSurfaceMessage({
        messageId: "assistant:1:1",
        turnId: "1",
        kind: "assistant",
        text: "answer 1",
        createdAt: "2026-04-14T00:00:02.000Z",
      }),
      createSurfaceMessage({
        messageId: "user:2",
        turnId: "2",
        kind: "user",
        text: "second turn",
        createdAt: "2026-04-14T00:00:03.000Z",
      }),
    ],
    checkpoints: [{
      sessionId: "session-1",
      agentId: "agent.core:main",
      turnId: "1",
      turnIndex: 1,
      messageId: "user:1",
      transcriptCutMessageId: "assistant:1:1",
      createdAt: "2026-04-14T00:00:02.000Z",
      userText: "first turn",
      workspaceRoot: "/tmp/workspace",
      workspaceCheckpointRef: "refs/checkpoints/1",
      workspaceCheckpointCommit: "abc123",
    }],
  });

  assert.deepEqual(options.map((entry) => entry.turnId), ["2", "1"]);
  assert.deepEqual(options.map((entry) => entry.turnIndex), [2, 1]);
  assert.equal(options[0]?.workspaceCheckpointRef, undefined);
  assert.equal(options[1]?.workspaceCheckpointCommit, "abc123");
  assert.equal(options[1]?.transcriptCutMessageId, "assistant:1:1");
});

test("rewind mode options disable workspace modes when no workspace checkpoint exists", () => {
  const disabledModes = buildDirectTuiRewindModeOptions({
    sessionId: "session-1",
    agentId: "agent.core:main",
    turnId: "2",
    turnIndex: 2,
    messageId: "user:2",
    createdAt: "2026-04-14T00:00:03.000Z",
    userText: "second turn",
  });
  assert.equal(disabledModes[0]?.disabled, true);
  assert.equal(disabledModes[1]?.disabled, false);
  assert.equal(disabledModes[2]?.disabled, true);
});

test("rewindSurfaceStateToTurn trims transcript, turns, tasks, and session pointers", () => {
  const state = createSurfaceAppState({
    session: createSurfaceSession({
      sessionId: "session-1",
      startedAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:05.000Z",
      transcriptMessageIds: ["user:1", "assistant:1:1", "user:2", "assistant:2:1", "notice:later"],
      taskIds: ["task:1", "task:2"],
      activeTurnId: "2",
      currentRunId: "2",
    }),
    currentTurnId: "2",
    selectedTurnId: "2",
    turns: [
      createSurfaceTurn({
        turnId: "1",
        status: "completed",
        startedAt: "2026-04-14T00:00:01.000Z",
        updatedAt: "2026-04-14T00:00:02.000Z",
      }),
      createSurfaceTurn({
        turnId: "2",
        status: "completed",
        startedAt: "2026-04-14T00:00:03.000Z",
        updatedAt: "2026-04-14T00:00:04.000Z",
      }),
    ],
    tasks: [
      {
        id: "task:1",
        taskId: "task:1",
        turnId: "1",
        title: "turn one",
        kind: "core_turn",
        status: "completed",
        startedAt: "2026-04-14T00:00:01.000Z",
        updatedAt: "2026-04-14T00:00:02.000Z",
      },
      {
        id: "task:2",
        taskId: "task:2",
        turnId: "2",
        title: "turn two",
        kind: "core_turn",
        status: "completed",
        startedAt: "2026-04-14T00:00:03.000Z",
        updatedAt: "2026-04-14T00:00:04.000Z",
      },
    ],
    messages: [
      createSurfaceMessage({
        messageId: "user:1",
        turnId: "1",
        kind: "user",
        text: "first",
        createdAt: "2026-04-14T00:00:01.000Z",
      }),
      createSurfaceMessage({
        messageId: "assistant:1:1",
        turnId: "1",
        kind: "assistant",
        text: "answer 1",
        createdAt: "2026-04-14T00:00:02.000Z",
      }),
      createSurfaceMessage({
        messageId: "user:2",
        turnId: "2",
        kind: "user",
        text: "second",
        createdAt: "2026-04-14T00:00:03.000Z",
      }),
      createSurfaceMessage({
        messageId: "assistant:2:1",
        turnId: "2",
        kind: "assistant",
        text: "answer 2",
        createdAt: "2026-04-14T00:00:04.000Z",
      }),
      createSurfaceMessage({
        messageId: "notice:later",
        kind: "status",
        text: "later status",
        createdAt: "2026-04-14T00:00:05.000Z",
      }),
    ],
  });

  const rewound = rewindSurfaceStateToTurn(state, "1", "2026-04-14T00:00:06.000Z", "assistant:1:1");
  assert.deepEqual(rewound.messages.map((message) => message.messageId), ["user:1", "assistant:1:1"]);
  assert.deepEqual(rewound.turns.map((turn) => turn.turnId), ["1"]);
  assert.deepEqual(rewound.tasks.map((task) => task.taskId), ["task:1"]);
  assert.equal(rewound.session?.activeTurnId, "1");
  assert.equal(rewound.currentTurnId, "1");
  assert.equal(rewound.selectedTurnId, "1");
});

test("buildDirectTuiRewindTurnOptions parses direct-tui turn ids like turn-12", () => {
  const options = buildDirectTuiRewindTurnOptions({
    messages: [
      createSurfaceMessage({
        messageId: "user:turn-9",
        turnId: "turn-9",
        kind: "user",
        text: "ninth",
        createdAt: "2026-04-14T00:00:09.000Z",
      }),
      createSurfaceMessage({
        messageId: "user:turn-12",
        turnId: "turn-12",
        kind: "user",
        text: "twelfth",
        createdAt: "2026-04-14T00:00:12.000Z",
      }),
    ],
    checkpoints: [],
  });

  assert.deepEqual(options.map((entry) => entry.turnId), ["turn-12", "turn-9"]);
  assert.deepEqual(options.map((entry) => entry.turnIndex), [12, 9]);
  assert.deepEqual(options.map((entry) => entry.agentId), ["agent.core:main", "agent.core:main"]);
});
