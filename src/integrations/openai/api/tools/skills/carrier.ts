import type { SkillContainer } from "../../../../../rax/skill-types.js";

export interface OpenAILocalShellSkillReference {
  name: string;
  description: string;
  path: string;
}

export type OpenAILocalShellSkillReferenceOverrides =
  Partial<OpenAILocalShellSkillReference> &
  Record<string, unknown>;

export interface OpenAIInlineShellSkillSource {
  data: string;
  media_type: "application/zip";
  type: "base64";
}

export interface OpenAIInlineShellSkillDefinition {
  type: "inline";
  name: string;
  description: string;
  source: OpenAIInlineShellSkillSource;
}

export interface OpenAIInlineShellSkillOverrides {
  name?: string;
  description?: string;
  source?: Partial<OpenAIInlineShellSkillSource> & Record<string, unknown>;
}

export interface OpenAIHostedShellSkillReference {
  type: "skill_reference";
  skill_id: string;
  version?: string | number;
}

export interface OpenAIHostedSkillSummary {
  type: "skill";
  id: string;
  default_version?: number;
  latest_version?: number;
}

export interface OpenAIHostedShellSkillVersion {
  type: "skill.version";
  id: string;
  skill_id: string;
  version: string | number;
}

export interface OpenAIHostedShellEnvironmentOverrides {
  file_ids?: string[];
  memory_limit?: "1g" | "4g" | "16g" | "64g" | null;
  network_policy?: OpenAIHostedShellNetworkPolicy;
}

export interface OpenAIHostedShellSkillLifecycle {
  reference: OpenAIHostedSkillSummary;
  version?: OpenAIHostedShellSkillVersion;
  attachment: OpenAIHostedShellSkillReference;
  environment?: OpenAIHostedShellEnvironmentOverrides & Record<string, unknown>;
}

export interface OpenAIHostedShellSkillLifecycleOverrides {
  skill_id?: string;
  attach_version?: string | number;
  version_id?: string;
  reference?: Partial<OpenAIHostedSkillSummary> & Record<string, unknown>;
  version_record?: Partial<OpenAIHostedShellSkillVersion> & Record<string, unknown>;
  attachment?: Partial<OpenAIHostedShellSkillReference> & Record<string, unknown>;
  environment?: OpenAIHostedShellEnvironmentOverrides & Record<string, unknown>;
}

export interface OpenAIHostedShellEnvironment {
  type: "container_auto";
  skills: Array<OpenAIHostedShellSkillReference | OpenAIInlineShellSkillDefinition>;
  file_ids?: string[];
  memory_limit?: "1g" | "4g" | "16g" | "64g" | null;
  network_policy?: OpenAIHostedShellNetworkPolicy;
}

export interface OpenAILocalShellEnvironment {
  type: "local";
  skills: OpenAILocalShellSkillReference[];
}

export interface OpenAIHostedShellNetworkPolicyAllowlist {
  type: "allowlist";
  allowed_domains: string[];
  domain_secrets?: Array<{
    domain: string;
    name: string;
    value: string;
  }>;
}

export interface OpenAIHostedShellNetworkPolicyDisabled {
  type: "disabled";
}

export type OpenAIHostedShellNetworkPolicy =
  | OpenAIHostedShellNetworkPolicyAllowlist
  | OpenAIHostedShellNetworkPolicyDisabled;

export type OpenAIShellEnvironment =
  | OpenAILocalShellEnvironment
  | OpenAIHostedShellEnvironment;

export interface OpenAIShellToolDefinition {
  type: "shell";
  environment: OpenAIShellEnvironment;
}

export interface OpenAIShellToolPayload {
  tools: OpenAIShellToolDefinition[];
}

export function buildOpenAILocalShellSkillReference(
  container: SkillContainer,
  overrides: OpenAILocalShellSkillReferenceOverrides = {}
): OpenAILocalShellSkillReference & Record<string, unknown> {
  return {
    name: container.descriptor.name,
    description: container.descriptor.description,
    path: container.source.rootDir,
    ...overrides
  };
}

export function buildOpenAIInlineShellSkillDefinition(
  container: SkillContainer,
  overrides: OpenAIInlineShellSkillOverrides = {}
): OpenAIInlineShellSkillDefinition & Record<string, unknown> {
  const source = overrides.source ?? {};
  if (typeof source.data !== "string" || source.data.length === 0) {
    throw new Error("OpenAI inline shell skill requires source.data as a base64-encoded zip bundle.");
  }

  return {
    type: "inline",
    name: overrides.name ?? container.descriptor.name,
    description: overrides.description ?? container.descriptor.description,
    source: {
      data: source.data,
      media_type: "application/zip",
      type: "base64",
      ...source
    }
  };
}

export function buildOpenAIHostedShellSkillReference(
  container: SkillContainer,
  overrides: OpenAIHostedShellSkillLifecycleOverrides = {}
): OpenAIHostedShellSkillLifecycle {
  const skillId = overrides.skill_id ?? container.descriptor.id;
  const requestedVersion =
    typeof overrides.attach_version === "string" || typeof overrides.attach_version === "number"
    ? overrides.attach_version
    : undefined;

  const reference: OpenAIHostedSkillSummary & Record<string, unknown> = {
    type: "skill",
    id: skillId,
    ...(overrides.reference ?? {})
  };

  const version: OpenAIHostedShellSkillVersion | undefined =
    overrides.version_id !== undefined ||
    overrides.version_record !== undefined
      ? {
          type: "skill.version",
          id: overrides.version_id ?? `${skillId}:version`,
          skill_id: skillId,
          version: requestedVersion ?? overrides.version_record?.version ?? "latest",
          ...(overrides.version_record ?? {})
        }
      : undefined;

  const attachment: OpenAIHostedShellSkillReference & Record<string, unknown> = {
    type: "skill_reference",
    skill_id: skillId,
    ...(requestedVersion === undefined ? {} : { version: requestedVersion }),
    ...(overrides.attachment ?? {})
  };

  return {
    reference,
    version,
    attachment,
    environment: overrides.environment
  };
}

export function buildOpenAIShellToolPayload(
  environment: OpenAIShellEnvironment
): OpenAIShellToolPayload {
  return {
    tools: [
      {
        type: "shell",
        environment
      }
    ]
  };
}
