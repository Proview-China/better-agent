import assert from "node:assert/strict";
import test from "node:test";

import {
  createMpBridgeSessionInput,
  createMpLowerStoredSectionInput,
  createMpMergeChunksInput,
  createMpPromoteMemoryInput,
  createMpSplitChunkInput,
} from "./index.js";
import { createCmpSection, createCmpStoredSectionFromSection } from "../cmp-types/cmp-section.js";

test("mp action contracts normalize split merge promote and bridge inputs", () => {
  const split = createMpSplitChunkInput({
    memoryId: "memory-1",
    sourceAgentId: "agent.main",
    targetChunkCount: 3,
    splitReason: "Need smaller semantic chunks for agent-local recall.",
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const merge = createMpMergeChunksInput({
    sourceMemoryIds: ["memory-1", "memory-2", "memory-1"],
    mergedMemoryId: "memory-merged",
    targetAgentId: "agent.main",
    mergeReason: "Collapse sibling chunks into one promoted bundle.",
    createdAt: "2026-04-08T00:00:01.000Z",
  });
  const promote = createMpPromoteMemoryInput({
    memoryId: "memory-1",
    promoterAgentId: "agent.parent",
    fromScopeLevel: "agent_isolated",
    toScopeLevel: "project",
    createdAt: "2026-04-08T00:00:02.000Z",
  });
  const bridge = createMpBridgeSessionInput({
    memoryId: "memory-1",
    sourceSessionId: "session-a",
    targetSessionId: "session-b",
    bridgeAgentId: "agent.parent",
    createdAt: "2026-04-08T00:00:03.000Z",
  });

  assert.equal(split.targetChunkCount, 3);
  assert.deepEqual(merge.sourceMemoryIds, ["memory-1", "memory-2"]);
  assert.equal(promote.toScopeLevel, "project");
  assert.equal(bridge.targetSessionId, "session-b");
});

test("mp action contracts reject invalid transitions and malformed bridge requests", () => {
  assert.throws(() => createMpSplitChunkInput({
    memoryId: "memory-1",
    sourceAgentId: "agent.main",
    targetChunkCount: 1,
    splitReason: "too-small",
    createdAt: "2026-04-08T00:00:00.000Z",
  }), /targetChunkCount/i);

  assert.throws(() => createMpMergeChunksInput({
    sourceMemoryIds: ["memory-1"],
    mergedMemoryId: "memory-merged",
    targetAgentId: "agent.main",
    mergeReason: "not enough sources",
    createdAt: "2026-04-08T00:00:01.000Z",
  }), /at least 2 non-empty string/i);

  assert.throws(() => createMpPromoteMemoryInput({
    memoryId: "memory-1",
    promoterAgentId: "agent.parent",
    fromScopeLevel: "project",
    toScopeLevel: "project",
    createdAt: "2026-04-08T00:00:02.000Z",
  }), /requires different fromScopeLevel and toScopeLevel/i);

  assert.throws(() => createMpBridgeSessionInput({
    memoryId: "memory-1",
    sourceSessionId: "session-a",
    targetSessionId: "session-a",
    bridgeAgentId: "agent.parent",
    createdAt: "2026-04-08T00:00:03.000Z",
  }), /requires different sourceSessionId and targetSessionId/i);
});

test("mp lower stored section input accepts a cmp stored section with explicit scope", () => {
  const section = createCmpSection({
    id: "section-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.root", "agent.main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-1"],
    tags: ["tag-a"],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-1",
    section,
    plane: "postgresql",
    storageRef: "postgresql:section:stored-1",
    state: "promoted",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  const lowered = createMpLowerStoredSectionInput({
    storedSection,
    checkedSnapshotRef: "snapshot-1",
    branchRef: "mp/main",
    scope: {
      projectId: "project.praxis",
      agentId: "agent.main",
      scopeLevel: "project",
      sessionMode: "shared",
      visibilityState: "project_shared",
      promotionState: "promoted_to_project",
    },
    sessionId: "session-a",
  });

  assert.equal(lowered.storedSection.id, "stored-1");
  assert.equal(lowered.scope.scopeLevel, "project");
  assert.equal(lowered.branchRef, "mp/main");
});
