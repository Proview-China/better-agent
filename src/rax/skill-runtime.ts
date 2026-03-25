import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  type AnthropicApiSkillActivationPayload,
  type AnthropicFilesystemSkillBinding,
  type AnthropicFilesystemSkillBindingOverrides,
  type AnthropicManagedSkillBinding,
  type AnthropicManagedSkillBindingOverrides,
  buildAnthropicApiSkillActivationPayload,
  buildAnthropicFilesystemSkillBinding,
  buildAnthropicManagedSkillBinding,
  buildAnthropicSdkSkillActivationPayload,
  type AnthropicSdkSkillActivationPayload
} from "../integrations/anthropic/api/tools/skills/carrier.js";
import {
  type DeepMindCodeDefinedSkillReference,
  type DeepMindCodeDefinedSkillReferenceOverrides,
  type DeepMindLocalSkillReference,
  type DeepMindLocalSkillReferenceOverrides,
  type DeepMindSkillToolsetPayload,
  buildDeepMindCodeDefinedSkillReference,
  buildDeepMindCodeDefinedSkillToolsetPayload,
  buildDeepMindLocalSkillReference,
  buildDeepMindLocalSkillToolsetPayload
} from "../integrations/deepmind/api/tools/skills/carrier.js";
import {
  type OpenAIHostedShellSkillLifecycle,
  type OpenAIHostedShellSkillLifecycleOverrides,
  type OpenAIInlineShellSkillDefinition,
  type OpenAIInlineShellSkillOverrides,
  type OpenAILocalShellSkillReference,
  type OpenAILocalShellSkillReferenceOverrides,
  type OpenAIShellToolPayload,
  buildOpenAIHostedShellSkillReference,
  buildOpenAIInlineShellSkillDefinition,
  buildOpenAILocalShellSkillReference,
  buildOpenAIShellToolPayload
} from "../integrations/openai/api/tools/skills/carrier.js";
import { RaxRoutingError } from "./errors.js";
import type {
  SkillActivateInput,
  SkillActivationPlan,
  SkillBindInput,
  SkillBindingMode,
  SkillContainer,
  SkillContainerCreateInput,
  SkillDefineInput,
  SkillDescriptor,
  SkillDiscoverInput,
  SkillEntryDocument,
  SkillExecutionPolicy,
  SkillHelperFile,
  SkillHelperKind,
  SkillLoadingPolicy,
  SkillLocalPackage,
  SkillReferenceInput,
  SkillResourceFile,
  SkillResourceKind,
  SkillLoadLocalInput,
  SkillProviderBinding,
  SkillSourceRef
} from "./skill-types.js";
import type { ProviderId } from "./types.js";

const DEFAULT_POLICY: SkillExecutionPolicy = {
  invocationMode: "auto",
  requiresApproval: false,
  riskLevel: "low",
  sourceTrust: "local"
};

const DEFAULT_LOADING: SkillLoadingPolicy = {
  metadata: "always",
  entry: "on-activate",
  resources: "on-demand",
  helpers: "on-demand"
};

const DEFAULT_BINDING_MODE: Record<ProviderId, SkillBindingMode> = {
  openai: "openai-local-shell",
  anthropic: "anthropic-sdk-filesystem",
  deepmind: "google-adk-local"
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/u.test(trimmed)) {
    return Number(trimmed);
  }
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function countIndent(line: string): number {
  return line.match(/^ */u)?.[0].length ?? 0;
}

function parseFrontmatterBlock(lines: string[], startIndex = 0, indent = 0): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const lineIndent = countIndent(line);
    if (lineIndent < indent) {
      break;
    }
    if (lineIndent > indent) {
      index += 1;
      continue;
    }

    const trimmed = line.trim();
    const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/u.exec(trimmed);
    if (!match) {
      index += 1;
      continue;
    }

    const [, key, rawValue = ""] = match;

    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length) {
        const blockLine = lines[index];
        if (!blockLine.trim()) {
          blockLines.push("");
          index += 1;
          continue;
        }
        const blockIndent = countIndent(blockLine);
        if (blockIndent <= indent) {
          break;
        }
        blockLines.push(blockLine.slice(indent + 2));
        index += 1;
      }
      result[key] = rawValue === ">"
        ? blockLines.map((entry) => entry.trim()).filter(Boolean).join(" ")
        : blockLines.join("\n").trimEnd();
      continue;
    }

    if (!rawValue) {
      index += 1;
      const childLines: string[] = [];
      while (index < lines.length) {
        const childLine = lines[index];
        if (!childLine.trim()) {
          childLines.push("");
          index += 1;
          continue;
        }
        const childIndent = countIndent(childLine);
        if (childIndent <= indent) {
          break;
        }
        childLines.push(childLine);
        index += 1;
      }

      const meaningful = childLines.filter((entry) => entry.trim());
      if (meaningful.every((entry) => entry.trim().startsWith("- "))) {
        result[key] = meaningful.map((entry) => parseScalar(entry.trim().slice(2)));
      } else {
        const [nested] = parseFrontmatterBlock(childLines, 0, indent + 2);
        result[key] = nested;
      }
      continue;
    }

    result[key] = parseScalar(rawValue);
    index += 1;
  }

  return [result, index];
}

function parseFrontmatter(content: string): { attributes: Record<string, unknown>; body: string } {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return {
      attributes: {},
      body: normalized
    };
  }

  const endMarker = "\n---\n";
  const endIndex = normalized.indexOf(endMarker, 4);
  if (endIndex === -1) {
    return {
      attributes: {},
      body: normalized
    };
  }

  const frontmatter = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + endMarker.length);
  const [attributes] = parseFrontmatterBlock(frontmatter.split("\n"));

  return {
    attributes,
    body
  };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

async function collectFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootDir, absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function hasSkillEntry(rootDir: string): Promise<boolean> {
  try {
    const entryStat = await stat(path.join(rootDir, "SKILL.md"));
    return entryStat.isFile();
  } catch {
    return false;
  }
}

async function discoverSkillRootDirs(source: string): Promise<string[]> {
  const sourceStat = await stat(source);
  if (sourceStat.isFile()) {
    return [path.dirname(source)];
  }

  if (await hasSkillEntry(source)) {
    return [source];
  }

  const discovered = new Set<string>();

  async function walk(currentDir: string): Promise<void> {
    if (await hasSkillEntry(currentDir)) {
      discovered.add(currentDir);
      return;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      await walk(path.join(currentDir, entry.name));
    }
  }

  await walk(source);

  return [...discovered].sort();
}

function classifyResourceKind(relativePath: string): SkillResourceKind {
  const [head] = relativePath.split(path.sep);
  switch (head) {
    case "references":
      return "reference";
    case "examples":
      return "example";
    case "templates":
      return "template";
    case "assets":
      return "asset";
    default:
      return "other";
  }
}

function classifyHelperKind(relativePath: string): SkillHelperKind {
  const [head] = relativePath.split(path.sep);
  switch (head) {
    case "scripts":
      return "script";
    case "validators":
      return "validator";
    default:
      return "other";
  }
}

function isHelper(relativePath: string): boolean {
  return relativePath.startsWith(`scripts${path.sep}`) ||
    relativePath.startsWith(`validators${path.sep}`);
}

function buildDescriptor(
  rootDir: string,
  entry: SkillEntryDocument,
  attributes: Record<string, unknown>
): SkillDescriptor {
  const metadata = typeof attributes.metadata === "object" && attributes.metadata !== null
    ? attributes.metadata as Record<string, unknown>
    : undefined;
  const name = typeof attributes.name === "string"
    ? attributes.name
    : path.basename(rootDir);
  const description = typeof attributes.description === "string"
    ? attributes.description
    : `Skill package from ${rootDir}`;
  const version = typeof attributes.version === "string"
    ? attributes.version
    : typeof metadata?.version === "string"
      ? metadata.version
      : undefined;
  const tags = toStringArray(attributes.tags);
  const triggers = toStringArray(attributes.triggers);

  return {
    id: slugify(name) || slugify(path.basename(rootDir)),
    name,
    description,
    version,
    tags,
    triggers,
    source: {
      kind: "local",
      rootDir,
      entryPath: entry.path
    },
    frontmatter: attributes
  };
}

function buildVirtualSkillContainer(input: {
  reference: SkillReferenceInput;
  policy?: Partial<SkillExecutionPolicy>;
  loading?: Partial<SkillLoadingPolicy>;
}): SkillContainer {
  const slug = slugify(input.reference.id) || "virtual-skill";
  const rootDir = `virtual://skill/${slug}`;
  const entryPath = `${rootDir}/SKILL.md`;
  const entry: SkillEntryDocument = {
    path: entryPath,
    content: input.reference.description
      ? `Virtual skill reference for ${input.reference.id}: ${input.reference.description}`
      : `Virtual skill reference for ${input.reference.id}.`
  };
  const source: SkillSourceRef = {
    kind: "virtual",
    rootDir,
    entryPath
  };
  const descriptor: SkillDescriptor = {
    id: input.reference.id,
    name: input.reference.name ?? input.reference.id,
    description: input.reference.description ?? `Virtual skill reference for ${input.reference.id}.`,
    version: input.reference.version,
    tags: [...(input.reference.tags ?? [])],
    triggers: [...(input.reference.triggers ?? [])],
    source,
    frontmatter: input.reference.frontmatter ? { ...input.reference.frontmatter } : undefined
  };

  return {
    descriptor,
    source,
    entry,
    resources: [],
    helpers: [],
    bindings: {},
    policy: {
      ...DEFAULT_POLICY,
      ...(input.policy ?? {})
    },
    loading: {
      ...DEFAULT_LOADING,
      ...(input.loading ?? {})
    },
    ledger: {
      discoverCount: 0,
      activationCount: 0
    },
    frontmatter: input.reference.frontmatter ? { ...input.reference.frontmatter } : undefined
  };
}

function cloneContainer(container: SkillContainer): SkillContainer {
  return {
    ...container,
    descriptor: {
      ...container.descriptor,
      tags: [...container.descriptor.tags],
      triggers: [...container.descriptor.triggers]
    },
    entry: { ...container.entry },
    resources: container.resources.map((entry) => ({ ...entry })),
    helpers: container.helpers.map((entry) => ({ ...entry })),
    bindings: { ...container.bindings },
    policy: { ...container.policy },
    loading: { ...container.loading },
    ledger: { ...container.ledger },
    source: { ...container.source },
    frontmatter: container.frontmatter ? { ...container.frontmatter } : undefined
  };
}

function createBinding(input: SkillBindInput): SkillProviderBinding {
  const mode = input.mode ?? DEFAULT_BINDING_MODE[input.provider];
  const details = { ...(input.details ?? {}) };

  switch (mode) {
    case "openai-local-shell":
      {
        const binding = buildOpenAILocalShellSkillReference(
          input.container,
          details as OpenAILocalShellSkillReferenceOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "openai-inline-shell":
      {
        const binding = buildOpenAIInlineShellSkillDefinition(
          input.container,
          details as OpenAIInlineShellSkillOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "openai-hosted-shell":
      {
        const binding = buildOpenAIHostedShellSkillReference(
          input.container,
          details as OpenAIHostedShellSkillLifecycleOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "anthropic-sdk-filesystem":
      {
        const binding = buildAnthropicFilesystemSkillBinding(
          input.container,
          details as AnthropicFilesystemSkillBindingOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "anthropic-api-managed":
      {
        const binding = buildAnthropicManagedSkillBinding(
          input.container,
          details as AnthropicManagedSkillBindingOverrides
        );
        return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "api",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "google-adk-local":
      {
        const binding = buildDeepMindLocalSkillReference(
          input.container,
          details as DeepMindLocalSkillReferenceOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
    case "google-adk-code-defined":
      {
        const binding = buildDeepMindCodeDefinedSkillReference(
          input.container,
          details as DeepMindCodeDefinedSkillReferenceOverrides
        );
      return {
        provider: input.provider,
        mode,
        layer: input.layer ?? "agent",
        details: binding as unknown as Record<string, unknown>
      };
      }
  }
}

function toActivationPlan(input: SkillActivateInput, binding: SkillProviderBinding): SkillActivationPlan {
  const resources = input.includeResources ? input.container.resources.map((entry) => ({ ...entry })) : undefined;
  const helpers = input.includeHelpers ? input.container.helpers.map((entry) => ({ ...entry })) : undefined;

  switch (binding.mode) {
    case "openai-local-shell":
      {
        const details = binding.details as unknown as OpenAILocalShellSkillReference;
        const payload = buildOpenAIShellToolPayload({
          type: "local",
          skills: [details]
        });
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "openai-shell-environment",
        composeStrategy: "payload-merge",
        composeNotes: "OpenAI shell skill carriers can currently be merged into Responses generation requests.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "openai-inline-shell":
      {
        const details = binding.details as unknown as OpenAIInlineShellSkillDefinition;
        const payload = buildOpenAIShellToolPayload({
          type: "container_auto",
          skills: [details]
        });
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "openai-shell-environment",
        composeStrategy: "payload-merge",
        composeNotes: "OpenAI shell skill carriers can currently be merged into Responses generation requests.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "openai-hosted-shell":
      {
        const lifecycle = binding.details as unknown as OpenAIHostedShellSkillLifecycle;
        const payload = buildOpenAIShellToolPayload({
          type: "container_auto",
          skills: [lifecycle.attachment],
          ...(lifecycle.environment ?? {})
        });
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "openai-shell-environment",
        composeStrategy: "payload-merge",
        composeNotes: "OpenAI shell skill carriers can currently be merged into Responses generation requests.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "anthropic-sdk-filesystem":
      {
        const details = binding.details as unknown as AnthropicFilesystemSkillBinding;
        const payload = buildAnthropicSdkSkillActivationPayload(details);
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "anthropic-sdk-filesystem-skill",
        composeStrategy: "runtime-only",
        composeNotes: "Anthropic filesystem skills currently require the SDK runtime path instead of payload-merge composition.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "anthropic-api-managed":
      {
        const details = binding.details as unknown as AnthropicManagedSkillBinding;
        const payload = buildAnthropicApiSkillActivationPayload(details);
        return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "anthropic-api-container-skills",
        composeStrategy: "payload-merge",
        composeNotes: "Anthropic API-managed skills can currently be merged into Messages API requests.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "google-adk-local":
      {
        const details = binding.details as unknown as DeepMindLocalSkillReference;
        const payload = buildDeepMindLocalSkillToolsetPayload([details]);
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "google-adk-skill-toolset",
        composeStrategy: "runtime-only",
        composeNotes: "Google ADK skill carriers currently require an ADK runtime path instead of payload-merge composition.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
    case "google-adk-code-defined":
      {
        const details = binding.details as unknown as DeepMindCodeDefinedSkillReference;
        const payload = buildDeepMindCodeDefinedSkillToolsetPayload([details]);
      return {
        provider: input.provider,
        mode: binding.mode,
        layer: binding.layer,
        officialCarrier: "google-adk-skill-toolset",
        composeStrategy: "runtime-only",
        composeNotes: "Google ADK skill carriers currently require an ADK runtime path instead of payload-merge composition.",
        payload: payload as unknown as Record<string, unknown>,
        entry: { ...input.container.entry },
        resources,
        helpers
      };
      }
  }
}

export class SkillRuntime {
  async loadLocal(input: SkillLoadLocalInput): Promise<SkillLocalPackage> {
    const skillRoots = await discoverSkillRootDirs(input.source);
    if (skillRoots.length === 0) {
      throw new RaxRoutingError(
        "skill_source_not_found",
        `No skill package was found under ${input.source}.`
      );
    }
    if (skillRoots.length > 1) {
      throw new RaxRoutingError(
        "skill_source_ambiguous",
        `Multiple skill packages were found under ${input.source}; point loadLocal() at one concrete skill directory instead.`
      );
    }

    const sourceStat = await stat(input.source);
    const rootDir = skillRoots[0]!;
    const entryPath = sourceStat.isDirectory()
      ? path.join(rootDir, "SKILL.md")
      : input.source;

    const entryContent = await readFile(entryPath, "utf8");
    const { attributes, body } = parseFrontmatter(entryContent);
    const entry: SkillEntryDocument = {
      path: entryPath,
      content: body.trim()
    };

    const allFiles = await collectFiles(rootDir);
    const resources: SkillResourceFile[] = [];
    const helpers: SkillHelperFile[] = [];

    for (const file of allFiles) {
      if (path.resolve(file) === path.resolve(entryPath)) {
        continue;
      }

      const relativePath = path.relative(rootDir, file);
      if (isHelper(relativePath)) {
        helpers.push({
          path: file,
          relativePath,
          kind: classifyHelperKind(relativePath)
        });
        continue;
      }

      resources.push({
        path: file,
        relativePath,
        kind: classifyResourceKind(relativePath)
      });
    }

    const descriptor = buildDescriptor(rootDir, entry, attributes);
    const source: SkillSourceRef = {
      kind: "local",
      rootDir,
      entryPath
    };

    return {
      descriptor,
      source,
      entry,
      resources,
      helpers,
      frontmatter: attributes
    };
  }

  define(input: SkillDefineInput): SkillContainer {
    const descriptor: SkillDescriptor = {
      ...input.package.descriptor,
      id: input.descriptor?.id ?? input.package.descriptor.id,
      version: input.descriptor?.version ?? input.package.descriptor.version,
      tags: input.descriptor?.tags ?? input.package.descriptor.tags,
      triggers: input.descriptor?.triggers ?? input.package.descriptor.triggers
    };

    return {
      descriptor,
      source: { ...input.package.source },
      entry: { ...input.package.entry },
      resources: input.package.resources.map((entry) => ({ ...entry })),
      helpers: input.package.helpers.map((entry) => ({ ...entry })),
      bindings: {},
      policy: {
        ...DEFAULT_POLICY,
        ...(input.policy ?? {})
      },
      loading: {
        ...DEFAULT_LOADING,
        ...(input.loading ?? {})
      },
      ledger: {
        discoverCount: 0,
        activationCount: 0
      },
      frontmatter: input.package.frontmatter ? { ...input.package.frontmatter } : undefined
    };
  }

  async containerCreate(input: SkillContainerCreateInput): Promise<SkillContainer> {
    const localPackage = await this.loadLocal({
      source: input.source
    });
    return this.define({
      package: localPackage,
      descriptor: input.descriptor,
      policy: input.policy,
      loading: input.loading
    });
  }

  containerCreateFromReference(input: {
    reference: SkillReferenceInput;
    policy?: Partial<SkillExecutionPolicy>;
    loading?: Partial<SkillLoadingPolicy>;
  }): SkillContainer {
    return buildVirtualSkillContainer(input);
  }

  async discover(input: SkillDiscoverInput): Promise<SkillDescriptor[]> {
    const descriptors: SkillDescriptor[] = [];
    const seenRoots = new Set<string>();

    for (const source of input.sources) {
      const skillRoots = await discoverSkillRootDirs(source);
      for (const rootDir of skillRoots) {
        if (seenRoots.has(rootDir)) {
          continue;
        }

        seenRoots.add(rootDir);
        const skillPackage = await this.loadLocal({ source: rootDir });
        descriptors.push({
          ...skillPackage.descriptor,
          tags: [...skillPackage.descriptor.tags],
          triggers: [...skillPackage.descriptor.triggers],
          frontmatter: skillPackage.descriptor.frontmatter
            ? { ...skillPackage.descriptor.frontmatter }
            : undefined
        });
      }
    }

    return descriptors.sort((left, right) => left.name.localeCompare(right.name, "en"));
  }

  bind(input: SkillBindInput): SkillContainer {
    const next = cloneContainer(input.container);
    next.bindings[input.provider] = createBinding(input);
    return next;
  }

  activate(input: SkillActivateInput): { container: SkillContainer; plan: SkillActivationPlan } {
    const binding = input.container.bindings[input.provider];
    if (!binding) {
      throw new RaxRoutingError(
        "skill_not_bound",
        `Skill ${input.container.descriptor.id} is not bound for provider ${input.provider}.`
      );
    }

    const next = cloneContainer(input.container);
    next.ledger.activationCount += 1;
    next.ledger.lastActivatedAt = new Date().toISOString();

    return {
      container: next,
      plan: toActivationPlan(input, binding)
    };
  }
}
