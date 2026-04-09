import assert from "node:assert/strict";
import test from "node:test";

import {
  createMpMemoryRecord,
  createMpSemanticBundle,
  createMpSemanticChunk,
} from "./index.js";

test("mp memory record keeps scope, ancestry, and source references intact", () => {
  const record = createMpMemoryRecord({
    memoryId: "memory-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    sessionId: "session-1",
    scopeLevel: "agent_isolated",
    sessionMode: "bridged",
    visibilityState: "session_bridged",
    promotionState: "submitted_to_parent",
    lineagePath: ["agent.root", "agent.main", "agent.main"],
    branchRef: "mp/main",
    sourceSectionId: "section-1",
    sourceStoredSectionId: "stored-1",
    sourceCommitRef: "abc123",
    semanticGroupId: "semantic-group-1",
    bodyRef: "body:memory-1",
    payloadRefs: ["payload-1", "payload-1"],
    sourceRefs: ["source:1", "source:1", "source:2"],
    tags: ["tag-a", "tag-a", "tag-b"],
    memoryKind: "summary",
    observedAt: "2026-04-08T00:00:00.000Z",
    capturedAt: "2026-04-08T00:00:00.500Z",
    freshness: {
      status: "aging",
      reason: "awaiting alignment",
    },
    confidence: "high",
    supersedes: ["memory-legacy", "memory-legacy"],
    alignment: {
      alignmentStatus: "aligned",
      lastAlignedAt: "2026-04-08T00:00:01.000Z",
    },
    ancestry: {
      parentMemoryId: "memory-root",
      splitFromIds: ["memory-root"],
      mergedFromIds: ["memory-peer"],
    },
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });

  assert.deepEqual(record.lineagePath, ["agent.root", "agent.main"]);
  assert.deepEqual(record.payloadRefs, ["payload-1"]);
  assert.deepEqual(record.sourceRefs, ["source:1", "source:2"]);
  assert.deepEqual(record.tags, ["tag-a", "tag-b"]);
  assert.equal(record.memoryKind, "summary");
  assert.equal(record.freshness.status, "aging");
  assert.equal(record.confidence, "high");
  assert.deepEqual(record.supersedes, ["memory-legacy"]);
  assert.equal(record.alignment.alignmentStatus, "aligned");
  assert.equal(record.ancestry?.parentMemoryId, "memory-root");
  assert.deepEqual(record.ancestry?.splitFromIds, ["memory-root"]);
  assert.deepEqual(record.ancestry?.mergedFromIds, ["memory-peer"]);
});

test("mp semantic chunk enforces stable chunk bounds", () => {
  const chunk = createMpSemanticChunk({
    memoryId: "memory-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "agent_isolated",
    sessionMode: "isolated",
    visibilityState: "local_only",
    promotionState: "local_only",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    sourceRefs: ["source-1"],
    tags: [],
    memoryKind: "semantic",
    freshness: {
      status: "fresh",
    },
    confidence: "medium",
    alignment: {
      alignmentStatus: "unreviewed",
    },
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
    chunkIndex: 0,
    chunkCount: 2,
    chunkRole: "split",
  });

  assert.equal(chunk.chunkIndex, 0);
  assert.equal(chunk.chunkCount, 2);

  assert.throws(() => createMpSemanticChunk({
    ...chunk,
    memoryId: "memory-2",
    chunkIndex: 2,
  }), /chunkIndex must be smaller than chunkCount/i);
});

test("mp semantic bundle reuses the scope descriptor and normalizes member ids", () => {
  const bundle = createMpSemanticBundle({
    bundleId: "bundle-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    scope: {
      projectId: "project.praxis",
      agentId: "agent.main",
      scopeLevel: "project",
      sessionMode: "shared",
      visibilityState: "project_shared",
      promotionState: "promoted_to_project",
    },
    memberMemoryIds: ["memory-1", "memory-2", "memory-1"],
    semanticGroupId: "semantic-group-1",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });

  assert.deepEqual(bundle.memberMemoryIds, ["memory-1", "memory-2"]);
  assert.equal(bundle.scope.scopeLevel, "project");
});
