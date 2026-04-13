import assert from "node:assert/strict";
import test from "node:test";

import type { ClaudeCodeSkillOverlaySnapshot } from "../integrations/claudecode-skill-overlay-source.js";
import { createLiveChatOverlayIndex } from "./live-chat-overlays.js";
import { createSkillOverlayIndexEntries } from "./skill-overlay-index-producer.js";

const skillSnapshot: ClaudeCodeSkillOverlaySnapshot = {
  schemaVersion: "claudecode-skill-overlay-snapshot/v1",
  sourceRoot: "/tmp/claudecode",
  entries: [
    {
      id: "bundled-skill:remember",
      name: "remember",
      description: "Review durable memory layers",
      whenToUse: "Use when the user wants to inspect or organize memory.",
      aliases: ["memo"],
      sourceKind: "bundled-skill",
      sourcePath: "skills/bundled/remember.ts",
      modelInvocable: true,
      userInvocable: true,
    },
    {
      id: "prompt-command:review",
      name: "review",
      description: "Review a pull request",
      whenToUse: "Use when the user asks for a code review of pending changes.",
      aliases: ["pr-review"],
      sourceKind: "prompt-command",
      sourcePath: "commands/review.ts",
      modelInvocable: true,
      userInvocable: true,
    },
  ],
};

test("createLiveChatOverlayIndex emits capability skill and memory entries", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续当前 repo 的现状对齐和交接",
    capabilityUsageIndexText: "search.ground => latest/current web facts",
    skillEntries: createSkillOverlayIndexEntries({
      userMessage: "继续当前 repo 的现状对齐和交接",
      snapshot: skillSnapshot,
    }),
  });

  assert.equal(overlay?.schemaVersion, "core-overlay-index/v1");
  assert.equal(overlay?.capabilityFamilies?.[0]?.id, "tap-capability-usage-index");
  assert.ok((overlay?.skills?.length ?? 0) > 0);
  assert.ok((overlay?.memories?.length ?? 0) >= 2);
  assert.match(overlay?.memories?.map((entry) => entry.id).join(",") ?? "", /memory:current-context/);
  assert.match(overlay?.memories?.map((entry) => entry.id).join(",") ?? "", /memory:worklog\//);
});

test("createLiveChatOverlayIndex can suppress skill or memory groups", () => {
  const noSkills = createLiveChatOverlayIndex({
    userMessage: "继续实现",
    capabilityUsageIndexText: "code.read => inspect local workspace state",
    includeSkillIndex: false,
  });
  const noMemories = createLiveChatOverlayIndex({
    userMessage: "继续实现",
    capabilityUsageIndexText: "code.read => inspect local workspace state",
    skillEntries: createSkillOverlayIndexEntries({
      userMessage: "继续实现 review",
      snapshot: skillSnapshot,
    }),
    includeMemoryIndex: false,
  });

  assert.equal(noSkills?.skills, undefined);
  assert.ok((noSkills?.memories?.length ?? 0) >= 2);
  assert.equal(noMemories?.memories, undefined);
  assert.ok((noMemories?.skills?.length ?? 0) > 0);
});

test("createLiveChatOverlayIndex merges provided skill entries with snapshot-backed fallback", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续 review 和 memory 工作",
    skillEntries: [
      {
        id: "skill:local:repo-skill",
        label: "repo-skill",
        summary: "Repo local skill",
        bodyRef: "skill-body:local:repo-skill",
      },
    ],
  });

  assert.ok((overlay?.skills?.length ?? 0) > 0);
  assert.equal(overlay?.skills?.[0]?.id, "skill:local:repo-skill");
  assert.ok((overlay?.skills?.some((entry) => entry.id !== "skill:local:repo-skill")) ?? false);
});

test("createLiveChatOverlayIndex keeps provided memory entries ahead of repo fallback", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续 review 和 memory 工作",
    memoryEntries: [
      {
        id: "memory:mp:primary",
        label: "MP primary",
        summary: "MP-native memory",
        bodyRef: "memory-body:mp-primary",
      },
    ],
  });

  assert.ok((overlay?.memories?.length ?? 0) > 0);
  assert.equal(overlay?.memories?.[0]?.id, "memory:mp:primary");
  assert.ok((overlay?.memories?.every((entry) => entry.id !== "memory:current-context")) ?? true);
});

test("createLiveChatOverlayIndex returns undefined when every overlay group is absent", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续实现",
    includeSkillIndex: false,
    includeMemoryIndex: false,
  });

  assert.equal(overlay, undefined);
});

test("createLiveChatOverlayIndex keeps skill entries bounded and stable", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续实现 overlay index",
  });

  assert.ok((overlay?.skills?.length ?? 0) > 0);
  assert.ok((overlay?.skills?.length ?? 0) <= 6);
  for (const entry of overlay?.skills ?? []) {
    assert.match(entry.id, /^skill:/u);
    assert.match(entry.bodyRef ?? "", /^skill-body:/u);
    assert.ok(entry.summary.length > 0);
  }
});

test("createLiveChatOverlayIndex raises worklog memories for history or handoff style prompts", () => {
  const normalOverlay = createLiveChatOverlayIndex({
    userMessage: "继续实现 overlay index",
  });
  const handoffOverlay = createLiveChatOverlayIndex({
    userMessage: "继续当前 repo 的交接和 handoff",
  });

  assert.match(
    handoffOverlay?.memories?.map((entry) => entry.id).join(",") ?? "",
    /memory:worklog\//u,
  );
  const handoffWorklogCount = handoffOverlay?.memories?.filter((entry) => entry.id.startsWith("memory:worklog/")).length ?? 0;
  const normalWorklogCount = normalOverlay?.memories?.filter((entry) => entry.id.startsWith("memory:worklog/")).length ?? 0;
  assert.ok(handoffWorklogCount >= normalWorklogCount);
});
