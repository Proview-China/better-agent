import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverMpOverlayArtifacts, discoverMpOverlayEntries } from "./rax-mp-overlay-source.js";

function createMemoryRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "praxis-mp-overlay-source-"));
  const memoryRoot = path.join(root, "memory");
  mkdirSync(path.join(memoryRoot, "decisions"), { recursive: true });
  writeFileSync(
    path.join(memoryRoot, "current-context.md"),
    "# Current Context\n\nCurrent repository state and active architecture facts.\n",
    "utf8",
  );
  writeFileSync(
    path.join(memoryRoot, "decisions", "ADR-0001-test.md"),
    "# ADR-0001 Test\n\n## 状态\n\n已接受\n\nDecision log for test gates.\n",
    "utf8",
  );
  return root;
}

test("discoverMpOverlayEntries resolves MP-native memory overlay entries", async () => {
  const cwd = createMemoryRoot();
  const calls: string[] = [];
  const session = {
    runtime: {
      getMpManagedRecords() {
        return [];
      },
    },
  };
  const facade = {
    mp: {
      create() {
        calls.push("create");
        return session;
      },
      async bootstrap() {
        calls.push("bootstrap");
        return { status: "bootstrapped" };
      },
      async materializeBatch() {
        calls.push("materializeBatch");
        return [];
      },
      async resolve() {
        calls.push("resolve");
        return {
          status: "resolved",
          bundle: {
            primary: [
              {
                memoryId: "memory-1",
                semanticGroupId: "semantic:context",
                bodyRef: "body:memory-1",
                sourceStoredSectionId: "stored:memory-1",
                memoryKind: "summary",
                freshness: { status: "fresh" },
                confidence: "high",
                alignment: { alignmentStatus: "aligned" },
                tags: ["context"],
              },
            ],
            supporting: [],
            diagnostics: {
              omittedSupersededMemoryIds: [],
              rerankComposition: {
                fresh: 1,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 1,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
        };
      },
    },
  };

  const entries = await discoverMpOverlayEntries({
    cwd,
    userMessage: "继续 context 对齐",
    facade: facade as never,
  });

  assert.deepEqual(calls, ["create", "bootstrap", "materializeBatch", "resolve"]);
  assert.equal(entries[0]?.id, "memory:memory-1");
  assert.match(entries[0]?.summary ?? "", /summary \/ fresh \/ aligned \/ high/u);
});

test("discoverMpOverlayEntries falls back to managed records when resolve returns empty bundle", async () => {
  const cwd = createMemoryRoot();
  const session = {
    runtime: {
      getMpManagedRecords() {
        return [
          {
            memoryId: "memory-2",
            semanticGroupId: "semantic:fallback",
            bodyRef: "body:memory-2",
            sourceStoredSectionId: "stored:memory-2",
            memoryKind: "status_snapshot",
            freshness: { status: "aging" },
            confidence: "medium",
            alignment: { alignmentStatus: "unreviewed" },
            tags: ["fallback"],
          },
        ];
      },
    },
  };
  const facade = {
    mp: {
      create() {
        return session;
      },
      async bootstrap() {
        return { status: "bootstrapped" };
      },
      async materializeBatch() {
        return [];
      },
      async resolve() {
        return {
          status: "resolved",
          bundle: {
            primary: [],
            supporting: [],
            diagnostics: {
              omittedSupersededMemoryIds: [],
              rerankComposition: {
                fresh: 0,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 0,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
        };
      },
    },
  };

  const entries = await discoverMpOverlayEntries({
    cwd,
    userMessage: "继续 fallback",
    facade: facade as never,
  });

  assert.equal(entries[0]?.id, "memory:memory-2");
  assert.match(entries[0]?.summary ?? "", /status_snapshot \/ aging \/ unreviewed \/ medium/u);
});

test("discoverMpOverlayArtifacts returns an absent routed package when repo memory snapshot is empty", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "praxis-mp-overlay-empty-"));
  const artifacts = await discoverMpOverlayArtifacts({
    cwd,
    userMessage: "继续空目录",
    facade: {
      mp: {} as never,
    } as never,
  });

  assert.deepEqual(artifacts.entries, []);
  assert.equal(artifacts.routedPackage.deliveryStatus, "absent");
  assert.match(artifacts.routedPackage.summary, /currently unavailable/i);
});

test("discoverMpOverlayArtifacts preserves memory-body refs without double prefix", async () => {
  const cwd = createMemoryRoot();
  const session = {
    runtime: {
      getMpManagedRecords() {
        return [];
      },
    },
  };
  const facade = {
    mp: {
      create() {
        return session;
      },
      async bootstrap() {
        return { status: "bootstrapped" };
      },
      async materializeBatch() {
        return [];
      },
      async resolve() {
        return {
          status: "resolved",
          bundle: {
            primary: [
              {
                memoryId: "memory-3",
                semanticGroupId: "semantic:context",
                bodyRef: "memory-body:current-context.md",
                sourceStoredSectionId: "stored:memory-3",
                memoryKind: "summary",
                freshness: { status: "fresh" },
                confidence: "high",
                alignment: { alignmentStatus: "aligned" },
                tags: ["context"],
              },
            ],
            supporting: [],
            diagnostics: {
              omittedSupersededMemoryIds: [],
              rerankComposition: {
                fresh: 1,
                aging: 0,
                stale: 0,
                superseded: 0,
                aligned: 1,
                unreviewed: 0,
                drifted: 0,
              },
            },
          },
        };
      },
    },
  };

  const artifacts = await discoverMpOverlayArtifacts({
    cwd,
    userMessage: "继续 bodyRef 对齐",
    facade: facade as never,
  });

  assert.equal(artifacts.entries[0]?.bodyRef, "memory-body:current-context.md");
});
