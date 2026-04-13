import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  clearClaudeCodeSkillOverlaySnapshotCacheForTest,
  loadClaudeCodeSkillOverlaySnapshot,
} from "./claudecode-skill-overlay-source.js";

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "praxis-skill-overlay-"));
  mkdirSync(join(root, "skills", "bundled"), { recursive: true });
  mkdirSync(join(root, "commands"), { recursive: true });

  writeFileSync(
    join(root, "skills", "bundled", "remember.ts"),
    `
import { registerBundledSkill } from "../bundledSkills.js";

export function registerRememberSkill(): void {
  registerBundledSkill({
    name: "remember",
    description: "Review memory layers",
    aliases: ["memo"],
    whenToUse: "Use when the user wants to inspect or organize durable memory.",
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: "text", text: "ok" }];
    },
  });
}
`,
    "utf8",
  );

  writeFileSync(
    join(root, "commands", "review.ts"),
    `
const command = {
  type: "prompt",
  name: "review",
  description: "Review a pull request",
  aliases: ["pr-review"],
  progressMessage: "reviewing",
  source: "builtin",
  async getPromptForCommand() {
    return [{ type: "text", text: "ok" }];
  },
};

export default command;
`,
    "utf8",
  );

  writeFileSync(
    join(root, "commands", "batch.ts"),
    `
import { createMovedToPluginCommand } from "./createMovedToPluginCommand.js";

export default createMovedToPluginCommand({
  name: "batch",
  description: "Run parallel batch work",
  progressMessage: "running batch",
  pluginName: "batch",
  pluginCommand: "batch",
  async getPromptWhileMarketplaceIsPrivate() {
    return [{ type: "text", text: "ok" }];
  },
});
`,
    "utf8",
  );

  writeFileSync(
    join(root, "commands", "hidden.ts"),
    `
const command = {
  type: "prompt",
  name: "hidden",
  description: "Hidden command",
  disableModelInvocation: true,
  progressMessage: "hidden",
  source: "builtin",
  async getPromptForCommand() {
    return [{ type: "text", text: "ok" }];
  },
};

export default command;
`,
    "utf8",
  );

  return root;
}

test("loadClaudeCodeSkillOverlaySnapshot extracts bundled skills and prompt commands", () => {
  clearClaudeCodeSkillOverlaySnapshotCacheForTest();
  const sourceRoot = createFixtureRoot();

  const snapshot = loadClaudeCodeSkillOverlaySnapshot({
    sourceRoot,
    forceReload: true,
  });

  assert.equal(snapshot.schemaVersion, "claudecode-skill-overlay-snapshot/v1");
  assert.equal(snapshot.entries.length, 4);

  const remember = snapshot.entries.find((entry) => entry.name === "remember");
  assert.equal(remember?.sourceKind, "bundled-skill");
  assert.deepEqual(remember?.aliases, ["memo"]);
  assert.match(remember?.whenToUse ?? "", /organize durable memory/);

  const review = snapshot.entries.find((entry) => entry.name === "review");
  assert.equal(review?.sourceKind, "prompt-command");
  assert.deepEqual(review?.aliases, ["pr-review"]);

  const batch = snapshot.entries.find((entry) => entry.name === "batch");
  assert.equal(batch?.sourceKind, "prompt-command");
  assert.equal(batch?.modelInvocable, true);

  const hidden = snapshot.entries.find((entry) => entry.name === "hidden");
  assert.equal(hidden?.modelInvocable, false);
});
