import assert from "node:assert/strict";
import test from "node:test";

import type { RepoMemoryOverlaySnapshot } from "../integrations/repo-memory-overlay-source.js";
import { createMemoryOverlayIndexEntries } from "./memory-overlay-index-producer.js";

const snapshot: RepoMemoryOverlaySnapshot = {
  schemaVersion: "repo-memory-overlay-snapshot/v1",
  rootDir: "/tmp/memory",
  entries: [
    {
      id: "memory:current-context",
      label: "Current Context",
      summary: "Current repository state and active architecture facts.",
      bodyRef: "memory-body:current-context.md",
      category: "current-context",
      updatedAtMs: 500,
      effectiveDateMs: 500,
      docStatus: "fact",
      stabilityKind: "authoritative",
      sourcePath: "current-context.md",
    },
    {
      id: "memory:decisions/ADR-0001",
      label: "ADR-0001 Test Gates",
      summary: "Decision log for test gates.",
      bodyRef: "memory-body:decisions/ADR-0001.md",
      category: "decision",
      updatedAtMs: 400,
      effectiveDateMs: 400,
      docStatus: "accepted",
      stabilityKind: "accepted",
      sourcePath: "decisions/ADR-0001.md",
    },
    {
      id: "memory:worklog/2026-04-13-example",
      label: "Example Worklog",
      summary: "Recent worklog and handoff trail.",
      bodyRef: "memory-body:worklog/2026-04-13-example.md",
      category: "worklog",
      updatedAtMs: 600,
      effectiveDateMs: 600,
      docStatus: "fact",
      stabilityKind: "volatile",
      sourcePath: "worklog/2026-04-13-example.md",
    },
  ],
};

test("createMemoryOverlayIndexEntries prioritizes objective-relevant memory entries", () => {
  const entries = createMemoryOverlayIndexEntries({
    userMessage: "继续 handoff 和 worklog 对齐",
    snapshot,
  });

  assert.equal(entries[0]?.label, "Current Context");
  assert.ok(entries.some((entry) => entry.label === "Example Worklog"));
  assert.match(entries.find((entry) => entry.label === "Example Worklog")?.summary ?? "", /worklog/u);
});

test("createMemoryOverlayIndexEntries still returns bounded entries without direct matches", () => {
  const entries = createMemoryOverlayIndexEntries({
    userMessage: "继续实现",
    snapshot,
    limit: 2,
  });

  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.bodyRef?.startsWith("memory-body:")));
});

test("createMemoryOverlayIndexEntries keeps authoritative current-context ahead of volatile worklog without direct signal", () => {
  const entries = createMemoryOverlayIndexEntries({
    userMessage: "继续实现",
    snapshot,
    limit: 3,
  });

  assert.equal(entries[0]?.label, "Current Context");
});
