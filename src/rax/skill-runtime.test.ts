import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { rax } from "./runtime.js";

async function createLocalSkillFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-"));
  await mkdir(path.join(rootDir, "scripts"));
  await mkdir(path.join(rootDir, "references"));

  await writeFile(
    path.join(rootDir, "SKILL.md"),
    `---
name: "PDF Worker"
description: >
  Handle PDF extraction and transformation
tags:
  - pdf
  - documents
triggers:
  - pdf
  - document
metadata:
  version: "1.2.3"
---

Use this skill when the user needs structured PDF work.
`,
    "utf8"
  );
  await writeFile(path.join(rootDir, "scripts", "extract.sh"), "#!/usr/bin/env bash\necho ok\n", "utf8");
  await writeFile(path.join(rootDir, "references", "guide.md"), "# guide\n", "utf8");

  return rootDir;
}

test("rax.skill.containerCreate loads a local skill directory into a container", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  assert.equal(container.descriptor.name, "PDF Worker");
  assert.equal(container.descriptor.version, "1.2.3");
  assert.deepEqual(container.descriptor.tags, ["pdf", "documents"]);
  assert.deepEqual(container.descriptor.triggers, ["pdf", "document"]);
  assert.equal(container.entry.content, "Use this skill when the user needs structured PDF work.");
  assert.equal(container.resources.length, 1);
  assert.equal(container.resources[0]?.kind, "reference");
  assert.equal(container.helpers.length, 1);
  assert.equal(container.helpers[0]?.kind, "script");
  assert.equal(container.loading.entry, "on-activate");
  assert.equal(container.policy.sourceTrust, "local");
});

test("rax.skill.discover returns local skill descriptors without expanding the full container", async () => {
  const rootDir = await createLocalSkillFixture();
  const descriptors = await rax.skill.discover({
    sources: [rootDir]
  });

  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0]?.name, "PDF Worker");
  assert.equal(descriptors[0]?.source.kind, "local");
});

test("rax.skill.bind maps the same container to official provider carriers", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const openAI = rax.skill.bind({
    container,
    provider: "openai"
  });
  const anthropic = rax.skill.bind({
    container,
    provider: "anthropic"
  });
  const deepMind = rax.skill.bind({
    container,
    provider: "deepmind"
  });

  assert.equal(openAI.bindings.openai?.mode, "openai-local-shell");
  assert.equal(openAI.bindings.openai?.details.path, rootDir);
  assert.equal(anthropic.bindings.anthropic?.mode, "anthropic-sdk-filesystem");
  assert.deepEqual(anthropic.bindings.anthropic?.details.allowedTools, ["Skill"]);
  assert.equal(deepMind.bindings.deepmind?.mode, "google-adk-local");
  assert.equal(deepMind.bindings.deepmind?.details.loader, "load_skill_from_dir");
});

test("rax.skill.activate produces provider-specific official carrier plans", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai"
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "openai",
    includeResources: true,
    includeHelpers: true
  });
  const payload = result.plan.payload as {
    tools: Array<{
      type: string;
      environment: {
        type: string;
      };
    }>;
  };

  assert.equal(result.plan.officialCarrier, "openai-shell-environment");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "local");
  assert.equal(result.plan.resources?.length, 1);
  assert.equal(result.plan.helpers?.length, 1);
  assert.equal(result.container.ledger.activationCount, 1);
  assert.ok(result.container.ledger.lastActivatedAt);
});

test("rax.skill.activate produces an anthropic api-managed carrier plan when requested", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_test_123"
    }
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    betas: string[];
    container: {
      skills: Array<{ skill_id: string }>;
    };
    tools: Array<{ type: string }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, ["code-execution-2025-08-25", "skills-2025-10-02"]);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_test_123");
  assert.equal(payload.tools[0]?.type, "code_execution_20250825");
});

test("rax.skill.activate produces a google adk toolset carrier plan", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "deepmind"
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "deepmind"
  });
  const payload = result.plan.payload as {
    imports: { skillLoader: string };
    toolset: {
      skills: Array<{ loader: string }>;
    };
  };

  assert.equal(result.plan.officialCarrier, "google-adk-skill-toolset");
  assert.equal(payload.imports.skillLoader, "google.adk.skills.load_skill_from_dir");
  assert.equal(payload.toolset.skills[0]?.loader, "load_skill_from_dir");
});
