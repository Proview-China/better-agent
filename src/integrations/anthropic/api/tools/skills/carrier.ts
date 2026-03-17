import type { SkillContainer } from "../../../../../rax/skill-types.js";

export interface AnthropicFilesystemSkillBinding {
  skillDirectory: string;
  allowedTools: string[];
  settingSources: string[];
  cwd: string;
}

export type AnthropicFilesystemSkillBindingOverrides =
  Partial<AnthropicFilesystemSkillBinding> &
  Record<string, unknown>;

export interface AnthropicManagedSkillReference {
  type: "anthropic" | "custom";
  skill_id: string;
  version?: string;
}

export type AnthropicManagedSkillReferenceOverrides =
  Partial<AnthropicManagedSkillReference> &
  Record<string, unknown>;

export interface AnthropicManagedSkillTool {
  type: "code_execution_20250522" | "code_execution_20250825" | "code_execution_20260120";
  name: "code_execution";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
}

export interface AnthropicManagedSkillBinding {
  skill: AnthropicManagedSkillReference;
  betas: string[];
  tool: AnthropicManagedSkillTool;
}

export interface AnthropicManagedSkillBindingOverrides {
  skill_id?: string;
  type?: "anthropic" | "custom";
  version?: string;
  betas?: string[];
  code_execution_type?: "code_execution_20250522" | "code_execution_20250825" | "code_execution_20260120";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  skill?: Partial<AnthropicManagedSkillReference> & Record<string, unknown>;
  tool?: Partial<AnthropicManagedSkillTool> & Record<string, unknown>;
}

export interface AnthropicSdkSkillActivationPayload {
  options: {
    cwd: string;
    settingSources: string[];
    allowedTools: string[];
  };
}

export interface AnthropicApiSkillActivationPayload {
  betas: string[];
  container: {
    skills: AnthropicManagedSkillReference[];
  };
  tools: AnthropicManagedSkillTool[];
}

export function buildAnthropicFilesystemSkillBinding(
  container: SkillContainer,
  overrides: AnthropicFilesystemSkillBindingOverrides = {}
): AnthropicFilesystemSkillBinding & Record<string, unknown> {
  return {
    skillDirectory: container.source.rootDir,
    allowedTools: ["Skill"],
    settingSources: ["project"],
    cwd: container.source.rootDir,
    ...overrides
  };
}

function betaForCodeExecutionTool(
  toolType: AnthropicManagedSkillTool["type"]
): string {
  if (toolType === "code_execution_20250522") {
    return "code-execution-2025-05-22";
  }
  return toolType === "code_execution_20260120"
    ? "code-execution-2026-01-20"
    : "code-execution-2025-08-25";
}

export function buildAnthropicManagedSkillBinding(
  container: SkillContainer,
  overrides: AnthropicManagedSkillBindingOverrides = {}
): AnthropicManagedSkillBinding {
  const toolType = overrides.code_execution_type ?? "code_execution_20250825";
  const betas = [...new Set([
    ...(overrides.betas ?? []),
    betaForCodeExecutionTool(toolType),
    "skills-2025-10-02"
  ])];
  const skill: AnthropicManagedSkillReference & Record<string, unknown> = {
    type: overrides.type ?? "custom",
    skill_id: overrides.skill_id ?? container.descriptor.id,
    ...(typeof overrides.version === "string" ? { version: overrides.version } : {}),
    ...(overrides.skill ?? {})
  };
  const tool: AnthropicManagedSkillTool & Record<string, unknown> = {
    type: toolType,
    name: "code_execution",
    ...(overrides.allowed_callers === undefined
      ? {}
      : { allowed_callers: overrides.allowed_callers }),
    ...(overrides.tool ?? {})
  };

  return {
    skill,
    betas,
    tool
  };
}

export function buildAnthropicSdkSkillActivationPayload(
  binding: AnthropicFilesystemSkillBinding
): AnthropicSdkSkillActivationPayload {
  return {
    options: {
      cwd: binding.cwd,
      settingSources: binding.settingSources,
      allowedTools: binding.allowedTools
    }
  };
}

export function buildAnthropicApiSkillActivationPayload(
  binding: AnthropicManagedSkillBinding
): AnthropicApiSkillActivationPayload {
  return {
    betas: binding.betas,
    container: {
      skills: [binding.skill]
    },
    tools: [binding.tool]
  };
}
