import assert from "node:assert/strict";
import test from "node:test";

import type { ClaudeCodeSkillOverlaySnapshot } from "../integrations/claudecode-skill-overlay-source.js";
import { createSkillOverlayIndexEntries } from "./skill-overlay-index-producer.js";

const snapshot: ClaudeCodeSkillOverlaySnapshot = {
  schemaVersion: "claudecode-skill-overlay-snapshot/v1",
  sourceRoot: "/tmp/claudecode",
  entries: [
    {
      id: "bundled-skill:remember",
      name: "remember",
      description: "Review durable memory layers",
      whenToUse: "Use when the user asks to inspect or organize memory.",
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
    {
      id: "prompt-command:commit",
      name: "commit",
      description: "Create a git commit",
      aliases: [],
      sourceKind: "prompt-command",
      sourcePath: "commands/commit.ts",
      modelInvocable: true,
      userInvocable: true,
    },
    {
      id: "prompt-command:hidden",
      name: "hidden",
      description: "Should never appear",
      aliases: [],
      sourceKind: "prompt-command",
      sourcePath: "commands/hidden.ts",
      modelInvocable: false,
      userInvocable: true,
    },
  ],
};

test("createSkillOverlayIndexEntries prioritizes direct objective matches", () => {
  const entries = createSkillOverlayIndexEntries({
    userMessage: "请帮我 review 这个 PR",
    snapshot,
  });

  assert.equal(entries[0]?.label, "review");
  assert.match(entries[0]?.summary ?? "", /Prompt command/);
  assert.match(entries[0]?.bodyRef ?? "", /skill-body:prompt-command:review/);
  assert.ok(entries.every((entry) => entry.label !== "hidden"));
});

test("createSkillOverlayIndexEntries falls back to snapshot-backed defaults", () => {
  const entries = createSkillOverlayIndexEntries({
    userMessage: "继续推进",
    snapshot,
    limit: 2,
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["remember", "review"],
  );
});
