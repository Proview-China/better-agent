import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RaxRoutingError } from "./errors.js";
import { SkillRuntime } from "./skill-runtime.js";
import { rax } from "./runtime.js";

async function createSkillPackage(rootDir: string, name: string, version = "1.2.3") {
  await mkdir(path.join(rootDir, "scripts"), { recursive: true });
  await mkdir(path.join(rootDir, "references"), { recursive: true });

  await writeFile(
    path.join(rootDir, "SKILL.md"),
    `---
name: "${name}"
description: >
  Handle PDF extraction and transformation
tags:
  - pdf
  - documents
triggers:
  - pdf
  - document
metadata:
  version: "${version}"
---

Use this skill when the user needs structured PDF work.
`,
    "utf8"
  );
  await writeFile(path.join(rootDir, "scripts", "extract.sh"), "#!/usr/bin/env bash\necho ok\n", "utf8");
  await writeFile(path.join(rootDir, "references", "guide.md"), "# guide\n", "utf8");

  return rootDir;
}

async function createLocalSkillFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-"));
  return createSkillPackage(rootDir, "PDF Worker");
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

test("rax.skill.discover scans a parent directory and returns multiple child skill packages", async () => {
  const hubDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-hub-"));
  await createSkillPackage(path.join(hubDir, "browser-worker"), "Browser Worker", "0.4.0");
  await createSkillPackage(path.join(hubDir, "pdf-worker"), "PDF Worker", "1.2.3");

  const descriptors = await rax.skill.discover({
    sources: [hubDir]
  });

  assert.equal(descriptors.length, 2);
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.name),
    ["Browser Worker", "PDF Worker"]
  );
});

test("rax.skill.loadLocal can resolve a parent directory when it contains exactly one skill child", async () => {
  const wrapperDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-wrapper-"));
  const childDir = path.join(wrapperDir, "only-skill");
  await createSkillPackage(childDir, "Single Worker", "2.0.0");

  const localPackage = await rax.skill.loadLocal({
    source: wrapperDir
  });

  assert.equal(localPackage.descriptor.name, "Single Worker");
  assert.equal(localPackage.source.rootDir, childDir);
});

test("rax.skill.loadLocal rejects ambiguous parent directories with multiple skill children", async () => {
  const hubDir = await mkdtemp(path.join(os.tmpdir(), "praxis-skill-ambiguous-"));
  await createSkillPackage(path.join(hubDir, "browser-worker"), "Browser Worker");
  await createSkillPackage(path.join(hubDir, "pdf-worker"), "PDF Worker");

  await assert.rejects(
    () =>
      rax.skill.loadLocal({
        source: hubDir
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "skill_source_ambiguous");
      return true;
    }
  );
});

test("SkillRuntime.containerCreateFromReference builds a virtual container for remote skill references", () => {
  const runtime = new SkillRuntime();
  const container = runtime.containerCreateFromReference({
    reference: {
      id: "pptx",
      version: "latest",
      name: "PowerPoint Skill",
      description: "Official hosted presentation skill",
      tags: ["slides"],
      triggers: ["pptx"]
    }
  });

  assert.equal(container.source.kind, "virtual");
  assert.equal(container.source.rootDir, "virtual://skill/pptx");
  assert.equal(container.descriptor.id, "pptx");
  assert.equal(container.descriptor.version, "latest");
  assert.deepEqual(container.descriptor.tags, ["slides"]);
  assert.deepEqual(container.descriptor.triggers, ["pptx"]);
  assert.match(container.entry.content, /Virtual skill reference for pptx/u);
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

test("rax.skill.activate produces an openai hosted shell carrier plan when requested", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_001",
      attach_version: "7",
      version_id: "version_hosted_007"
    }
  });

  const hostedBinding = bound.bindings.openai?.details as {
    reference: { type: string; id: string };
    version?: { type: string; id: string; skill_id: string; version: string };
    attachment: { type: string; skill_id: string; version?: string };
  };

  assert.equal(hostedBinding.reference.type, "skill");
  assert.equal(hostedBinding.reference.id, "skill_hosted_001");
  assert.equal(hostedBinding.version?.type, "skill.version");
  assert.equal(hostedBinding.version?.id, "version_hosted_007");
  assert.equal(hostedBinding.version?.skill_id, "skill_hosted_001");
  assert.equal(hostedBinding.version?.version, "7");
  assert.equal(hostedBinding.attachment.type, "skill_reference");
  assert.equal(hostedBinding.attachment.skill_id, "skill_hosted_001");
  assert.equal(hostedBinding.attachment.version, "7");

  const result = rax.skill.activate({
    container: bound,
    provider: "openai"
  });
  const payload = result.plan.payload as {
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{
          type: string;
          skill_id: string;
          version?: string;
        }>;
      };
    }>;
  };

  assert.equal(result.plan.officialCarrier, "openai-shell-environment");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.type, "skill_reference");
  assert.equal(payload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_001");
  assert.equal(payload.tools[0]?.environment.skills[0]?.version, "7");
});

test("rax.skill.activate produces an openai inline shell carrier plan when requested", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-inline-shell",
    details: {
      source: {
        data: "UEsDBAoAAAAAAInlineSkillBundle",
        media_type: "application/zip",
        type: "base64"
      }
    }
  });

  const inlineBinding = bound.bindings.openai?.details as {
    type: string;
    name: string;
    description: string;
    source: {
      data: string;
      media_type: string;
      type: string;
    };
  };

  assert.equal(inlineBinding.type, "inline");
  assert.equal(inlineBinding.name, container.descriptor.name);
  assert.equal(inlineBinding.description, container.descriptor.description);
  assert.equal(inlineBinding.source.data, "UEsDBAoAAAAAAInlineSkillBundle");
  assert.equal(inlineBinding.source.media_type, "application/zip");
  assert.equal(inlineBinding.source.type, "base64");

  const result = rax.skill.activate({
    container: bound,
    provider: "openai"
  });
  const payload = result.plan.payload as {
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{
          type: string;
          name: string;
          description: string;
          source: {
            data: string;
            media_type: string;
            type: string;
          };
        }>;
      };
    }>;
  };

  assert.equal(result.plan.officialCarrier, "openai-shell-environment");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.type, "inline");
  assert.equal(payload.tools[0]?.environment.skills[0]?.name, container.descriptor.name);
  assert.equal(payload.tools[0]?.environment.skills[0]?.source.data, "UEsDBAoAAAAAAInlineSkillBundle");
});

test("rax.skill.activate preserves official OpenAI hosted shell environment overrides", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_env_001",
      attach_version: 7,
      version_id: "version_hosted_007",
      environment: {
        file_ids: ["file_123"],
        memory_limit: "4g",
        network_policy: {
          type: "allowlist",
          allowed_domains: ["openai.com"]
        }
      }
    }
  });

  const hostedBinding = bound.bindings.openai?.details as {
    attachment: { type: string; skill_id: string; version?: string | number };
    environment?: {
      file_ids?: string[];
      memory_limit?: string | null;
      network_policy?: { type: string; allowed_domains?: string[] };
    };
  };

  assert.equal(hostedBinding.attachment.version, 7);
  assert.deepEqual(hostedBinding.environment?.file_ids, ["file_123"]);
  assert.equal(hostedBinding.environment?.memory_limit, "4g");
  assert.deepEqual(hostedBinding.environment?.network_policy, {
    type: "allowlist",
    allowed_domains: ["openai.com"]
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "openai"
  });
  const payload = result.plan.payload as {
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{
          type: string;
          skill_id: string;
          version?: string | number;
        }>;
        file_ids?: string[];
        memory_limit?: string | null;
        network_policy?: { type: string; allowed_domains?: string[] };
      };
    }>;
  };

  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_env_001");
  assert.equal(payload.tools[0]?.environment.skills[0]?.version, 7);
  assert.deepEqual(payload.tools[0]?.environment.file_ids, ["file_123"]);
  assert.equal(payload.tools[0]?.environment.memory_limit, "4g");
  assert.deepEqual(payload.tools[0]?.environment.network_policy, {
    type: "allowlist",
    allowed_domains: ["openai.com"]
  });
});

test("rax.skill.activate preserves OpenAI hosted latest-version pointers and numeric hosted summaries", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_latest",
      attach_version: "latest",
      reference: {
        default_version: 6,
        latest_version: 8
      }
    }
  });

  const hostedBinding = bound.bindings.openai?.details as {
    reference: { id: string; default_version?: number; latest_version?: number };
    version?: { id: string; version: string | number };
    attachment: { skill_id: string; version?: string | number };
  };

  assert.equal(hostedBinding.reference.id, "skill_hosted_latest");
  assert.equal(hostedBinding.reference.default_version, 6);
  assert.equal(hostedBinding.reference.latest_version, 8);
  assert.equal(hostedBinding.version, undefined);
  assert.equal(hostedBinding.attachment.skill_id, "skill_hosted_latest");
  assert.equal(hostedBinding.attachment.version, "latest");

  const result = rax.skill.activate({
    container: bound,
    provider: "openai"
  });
  const payload = result.plan.payload as {
    tools: Array<{
      environment: {
        skills: Array<{
          skill_id: string;
          version?: string | number;
        }>;
      };
    }>;
  };

  assert.equal(payload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_latest");
  assert.equal(payload.tools[0]?.environment.skills[0]?.version, "latest");
});

test("rax.skill.activate keeps a hosted shell attachment at the skill reference when no version override is supplied", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_default"
    }
  });

  const hostedBinding = bound.bindings.openai?.details as {
    reference: { type: string; id: string };
    version?: { type: string; id: string; skill_id: string; version: string };
    attachment: { type: string; skill_id: string; version?: string };
  };

  assert.equal(hostedBinding.reference.id, "skill_hosted_default");
  assert.equal(hostedBinding.version, undefined);
  assert.equal(hostedBinding.attachment.type, "skill_reference");
  assert.equal(hostedBinding.attachment.skill_id, "skill_hosted_default");
  assert.equal(hostedBinding.attachment.version, undefined);
});

test("rax.skill.activate keeps hosted attachment version separate from hosted version resource metadata", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const numericBound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_numeric",
      attach_version: 7
    }
  });
  const numericBinding = numericBound.bindings.openai?.details as {
    version?: { id: string; version: string | number };
    attachment: { skill_id: string; version?: string | number };
  };

  assert.equal(numericBinding.version, undefined);
  assert.equal(numericBinding.attachment.skill_id, "skill_hosted_numeric");
  assert.equal(numericBinding.attachment.version, 7);

  const latestBound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_latest",
      attach_version: "latest"
    }
  });
  const latestBinding = latestBound.bindings.openai?.details as {
    version?: { id: string; version: string | number };
    attachment: { skill_id: string; version?: string | number };
  };

  assert.equal(latestBinding.version, undefined);
  assert.equal(latestBinding.attachment.skill_id, "skill_hosted_latest");
  assert.equal(latestBinding.attachment.version, "latest");
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
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, ["code-execution-2025-08-25", "skills-2025-10-02"]);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_test_123");
  assert.equal(payload.container.skills[0]?.type, "custom");
  assert.equal(payload.container.skills[0]?.version, undefined);
  assert.equal(payload.tools[0]?.type, "code_execution_20250825");
  assert.equal(payload.tools[0]?.name, "code_execution");
});

test("rax.skill.activate preserves official Anthropic managed carrier overrides", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_official_456",
      type: "anthropic",
      version: "2026.03",
      betas: ["files-api-2025-04-14", "code-execution-2026-01-20", "skills-2025-10-02"],
      code_execution_type: "code_execution_20260120",
      allowed_callers: ["direct", "code_execution_20260120"]
    }
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    betas: string[];
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{
      type: string;
      name: string;
      allowed_callers?: string[];
    }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, [
    "files-api-2025-04-14",
    "code-execution-2026-01-20",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_official_456");
  assert.equal(payload.container.skills[0]?.type, "anthropic");
  assert.equal(payload.container.skills[0]?.version, "2026.03");
  assert.equal(payload.tools[0]?.type, "code_execution_20260120");
  assert.equal(payload.tools[0]?.name, "code_execution");
  assert.deepEqual(payload.tools[0]?.allowed_callers, ["direct", "code_execution_20260120"]);
});

test("rax.skill.activate preserves Anthropic legacy official code execution carrier type", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_legacy_50522",
      code_execution_type: "code_execution_20250522",
      betas: ["skills-2025-10-02", "code-execution-2025-05-22"]
    }
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    betas: string[];
    tools: Array<{
      type: string;
      name: string;
    }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, ["skills-2025-10-02", "code-execution-2025-05-22"]);
  assert.equal(payload.tools[0]?.type, "code_execution_20250522");
  assert.equal(payload.tools[0]?.name, "code_execution");
});

test("rax.skill.activate auto-merges the official Anthropic code execution beta even when custom betas are provided", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_auto_merge_beta",
      code_execution_type: "code_execution_20260120",
      betas: ["files-api-2025-04-14"]
    }
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    betas: string[];
    tools: Array<{
      type: string;
      name: string;
    }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, [
    "files-api-2025-04-14",
    "code-execution-2026-01-20",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.tools[0]?.type, "code_execution_20260120");
  assert.equal(payload.tools[0]?.name, "code_execution");
});

test("rax.skill.activate preserves Anthropic prebuilt skill references with latest version pointers", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "pptx",
      type: "anthropic",
      version: "latest"
    }
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    betas: string[];
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };

  assert.equal(result.plan.officialCarrier, "anthropic-api-container-skills");
  assert.deepEqual(payload.betas, ["code-execution-2025-08-25", "skills-2025-10-02"]);
  assert.equal(payload.container.skills[0]?.skill_id, "pptx");
  assert.equal(payload.container.skills[0]?.type, "anthropic");
  assert.equal(payload.container.skills[0]?.version, "latest");
  assert.equal(payload.tools[0]?.type, "code_execution_20250825");
});

test("rax.skill.activate produces an anthropic sdk filesystem carrier plan by default", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic"
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "anthropic"
  });
  const payload = result.plan.payload as {
    options: {
      cwd: string;
      settingSources: string[];
      allowedTools: string[];
    };
  };

  assert.equal(result.plan.officialCarrier, "anthropic-sdk-filesystem-skill");
  assert.equal(payload.options.cwd, rootDir);
  assert.deepEqual(payload.options.settingSources, ["project"]);
  assert.deepEqual(payload.options.allowedTools, ["Skill"]);
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

test("rax.skill.activate produces a google adk code-defined carrier plan when requested", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "deepmind",
    mode: "google-adk-code-defined"
  });

  const result = rax.skill.activate({
    container: bound,
    provider: "deepmind"
  });
  const payload = result.plan.payload as {
    imports: { skillModel: string; toolsetFactory: string };
    toolset: {
      skills: Array<{
        name: string;
        description: string;
        tags: string[];
        instructions: string;
      }>;
    };
  };

  assert.equal(result.plan.officialCarrier, "google-adk-skill-toolset");
  assert.equal(payload.imports.skillModel, "google.adk.skills.Skill");
  assert.equal(payload.imports.toolsetFactory, "google.adk.tools.skill_toolset.SkillToolset");
  assert.equal(payload.toolset.skills[0]?.name, "PDF Worker");
  assert.deepEqual(payload.toolset.skills[0]?.tags, ["pdf", "documents"]);
  assert.equal(
    payload.toolset.skills[0]?.instructions,
    "Use this skill when the user needs structured PDF work."
  );
});
