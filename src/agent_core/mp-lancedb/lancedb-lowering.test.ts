import assert from "node:assert/strict";
import test from "node:test";

import { createCmpSection, createCmpStoredSectionFromSection } from "../cmp-types/cmp-section.js";
import { createMpScopeDescriptor } from "../mp-types/index.js";
import {
  createMpMemoryRecordFromStoredSection,
  createMpMemoryRecordsFromStoredSection,
  deriveMpChunkAncestry,
  deriveMpChunkTags,
  inferMpScopeFromStoredSection,
  inferMpSessionModeFromStoredSection,
} from "./lancedb-lowering.js";

test("mp lancedb lowering infers agent-local scope from local stored section", () => {
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
    persistedAt: "2026-04-08T00:00:01.000Z",
    metadata: {
      lineagePath: ["agent.root", "agent.main"],
      tags: ["semantic:hot"],
    },
  });

  assert.equal(inferMpScopeFromStoredSection(storedSection), "agent_isolated");
  assert.equal(inferMpSessionModeFromStoredSection(storedSection), "isolated");

  const memory = createMpMemoryRecordFromStoredSection({
    storedSection,
    checkedSnapshotRef: "snapshot-1",
    branchRef: "mp/main",
  });

  assert.equal(memory.scopeLevel, "agent_isolated");
  assert.equal(memory.sessionMode, "isolated");
  assert.equal(memory.visibilityState, "local_only");
  assert.equal(memory.sourceStoredSectionId, "stored-1");
  assert.equal(memory.sourceSectionId, "section-1");
  assert.equal(memory.bodyRef, "stored:postgresql:stored-1");
  assert(memory.tags.includes("mp:state:stored"));
  assert(memory.tags.includes("semantic:hot"));
});

test("mp lancedb lowering promotes project-visible stored section into project scope", () => {
  const section = createCmpSection({
    id: "section-2",
    projectId: "project.praxis",
    agentId: "agent.child",
    lineagePath: ["agent.root", "agent.parent", "agent.child"],
    source: "parent_agent",
    kind: "promotion_signal",
    fidelity: "projected",
    payloadRefs: ["payload-2"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-2",
    section,
    plane: "git",
    storageRef: "git:stored-2",
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  const memory = createMpMemoryRecordFromStoredSection({
    storedSection,
    checkedSnapshotRef: "snapshot-2",
    branchRef: "mp/child",
  });

  assert.equal(inferMpScopeFromStoredSection(storedSection), "project");
  assert.equal(inferMpSessionModeFromStoredSection(storedSection), "shared");
  assert.equal(memory.scopeLevel, "project");
  assert.equal(memory.sessionMode, "shared");
  assert.equal(memory.visibilityState, "project_shared");
  assert.equal(memory.promotionState, "promoted_to_project");
});

test("mp lancedb lowering preserves ancestry metadata and explicit scope overrides", () => {
  const section = createCmpSection({
    id: "section-3",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.main"],
    source: "system",
    kind: "task_seed",
    fidelity: "projected",
    payloadRefs: ["payload-3"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-3",
    section,
    plane: "redis",
    storageRef: "redis:stored-3",
    state: "dispatched",
    visibility: "children",
    persistedAt: "2026-04-08T00:00:01.000Z",
    metadata: {
      mpScopeLevel: "global",
      mpSessionMode: "shared",
      parentMemoryId: "memory-root",
      splitFromSectionIds: ["section-parent-a", "section-parent-b"],
      mergedFromSectionIds: ["section-peer-a"],
    },
  });

  const scope = createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "global",
    sessionMode: "shared",
  });
  const ancestry = deriveMpChunkAncestry(storedSection);
  const lowered = createMpMemoryRecordsFromStoredSection({
    storedSection,
    checkedSnapshotRef: "snapshot-3",
    branchRef: "mp/main",
    scope,
    sessionId: "session-global",
  });

  assert.equal(ancestry?.parentMemoryId, "memory-root");
  assert.deepEqual(ancestry?.splitFromIds, ["section-parent-a", "section-parent-b"]);
  assert.deepEqual(ancestry?.mergedFromIds, ["section-peer-a"]);
  assert.equal(lowered.length, 1);
  assert.equal(lowered[0]?.scopeLevel, "global");
  assert.equal(lowered[0]?.sessionMode, "shared");
  assert.equal(lowered[0]?.visibilityState, "global_shared");
});

test("mp lancedb lowering derives stable semantic tags from stored section metadata", () => {
  const section = createCmpSection({
    id: "section-4",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.main"],
    source: "dispatcher",
    kind: "historical_context",
    fidelity: "checked",
    payloadRefs: ["payload-4"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-4",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-4",
    persistedAt: "2026-04-08T00:00:01.000Z",
    metadata: {
      tags: ["semantic:history", "semantic:history"],
    },
  });

  const tags = deriveMpChunkTags(storedSection, {
    tagPrefix: "memory",
  });

  assert(tags.includes("memory:plane:postgresql"));
  assert(tags.includes("memory:section_kind:historical_context"));
  assert(tags.includes("memory:section_source:dispatcher"));
  assert(tags.includes("semantic:history"));
});
