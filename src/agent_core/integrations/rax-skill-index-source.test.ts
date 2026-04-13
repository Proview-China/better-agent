import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverLiveSkillOverlayEntries } from "./rax-skill-index-source.js";

async function createSkillPackage(rootDir: string, name: string, description: string, triggers: string[] = []) {
  await mkdir(rootDir, { recursive: true });
  await writeFile(
    path.join(rootDir, "SKILL.md"),
    `---
name: "${name}"
description: >
  ${description}
triggers:
${triggers.map((trigger) => `  - ${trigger}`).join("\n")}
---

Use this skill when the user needs ${description}.
`,
    "utf8",
  );
}

test("discoverLiveSkillOverlayEntries reads real skill descriptors from local skill dirs", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-home-"));
  const homeSkillsDir = path.join(homeDir, ".codex", "skills");
  const cwdDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-cwd-"));
  const cwdSkillsDir = path.join(cwdDir, ".codex", "skills");

  await createSkillPackage(
    path.join(homeSkillsDir, "browser-automation"),
    "browser-automation",
    "browser automation for visible page facts",
    ["browser", "playwright"],
  );
  await createSkillPackage(
    path.join(cwdSkillsDir, "repo-memory"),
    "repo-memory",
    "repository memory and handoff lookup",
    ["memory", "handoff"],
  );

  const previousHome = process.env.HOME;
  process.env.HOME = homeDir;
  try {
    const entries = await discoverLiveSkillOverlayEntries({
      cwd: cwdDir,
      objective: "需要 browser 自动化和 handoff 记忆",
      limit: 6,
    });

    assert.ok(entries.length >= 2);
    assert.match(entries.map((entry) => entry.id).join(","), /skill:/u);
    assert.match(entries.map((entry) => entry.bodyRef ?? "").join(","), /skill-body:/u);
  } finally {
    process.env.HOME = previousHome;
  }
});
