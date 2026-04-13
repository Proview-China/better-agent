import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  clearRepoMemoryOverlaySnapshotCacheForTest,
  loadRepoMemoryOverlaySnapshot,
} from "./repo-memory-overlay-source.js";

function createMemoryFixtureRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "praxis-memory-overlay-"));
  mkdirSync(path.join(root, "architecture"), { recursive: true });
  mkdirSync(path.join(root, "decisions"), { recursive: true });
  mkdirSync(path.join(root, "worklog"), { recursive: true });

  writeFileSync(
    path.join(root, "current-context.md"),
    "# Current Context\n\nCurrent repository state and active architecture facts.\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "architecture", "platform-direction.md"),
    "# Platform Direction\n\nPrefer native-first platform choices.\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "decisions", "ADR-0001-test.md"),
    "# ADR-0001 Test\n\n## 状态\n\n已接受\n\nDecision log for test gates.\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "decisions", "ADR-0000-template.md"),
    "# ADR-0000 Template\n\n## 状态\n\n草稿\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "worklog", "2026-04-13-example.md"),
    "# Example Worklog\n\nRecent worklog and handoff trail.\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "worklog", "2026-04-13-research-outline.md"),
    "# Research Outline\n\nTemporary planning notes.\n",
    "utf8",
  );

  return root;
}

test("loadRepoMemoryOverlaySnapshot reads repo memory layers into lightweight entries", () => {
  clearRepoMemoryOverlaySnapshotCacheForTest();
  const rootDir = createMemoryFixtureRoot();

  const snapshot = loadRepoMemoryOverlaySnapshot({
    rootDir,
    forceReload: true,
  });

  assert.equal(snapshot.schemaVersion, "repo-memory-overlay-snapshot/v1");
  assert.ok(snapshot.entries.length >= 4);
  assert.match(snapshot.entries.map((entry) => entry.id).join(","), /memory:current-context/u);
  assert.match(snapshot.entries.map((entry) => entry.id).join(","), /memory:architecture\/platform-direction/u);
  assert.match(snapshot.entries.map((entry) => entry.id).join(","), /memory:decisions\/ADR-0001-test/u);
  assert.match(snapshot.entries.map((entry) => entry.id).join(","), /memory:worklog\/2026-04-13-example/u);
  assert.doesNotMatch(snapshot.entries.map((entry) => entry.id).join(","), /ADR-0000-template/u);
  assert.doesNotMatch(snapshot.entries.map((entry) => entry.id).join(","), /research-outline/u);
  const currentContext = snapshot.entries.find((entry) => entry.id === "memory:current-context");
  assert.equal(currentContext?.stabilityKind, "authoritative");
  const decision = snapshot.entries.find((entry) => entry.id === "memory:decisions/ADR-0001-test");
  assert.equal(decision?.docStatus, "accepted");
});
