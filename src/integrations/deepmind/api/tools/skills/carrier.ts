import type { SkillContainer } from "../../../../../rax/skill-types.js";

export interface DeepMindLocalSkillReference {
  loader: "load_skill_from_dir";
  path: string;
}

export type DeepMindLocalSkillReferenceOverrides =
  Partial<DeepMindLocalSkillReference> &
  Record<string, unknown>;

export interface DeepMindCodeDefinedSkillReference {
  name: string;
  description: string;
  tags: string[];
  instructions: string;
}

export type DeepMindCodeDefinedSkillReferenceOverrides =
  Partial<DeepMindCodeDefinedSkillReference> &
  Record<string, unknown>;

export interface DeepMindLocalSkillToolsetPayload {
  imports: {
    skillLoader: "google.adk.skills.load_skill_from_dir";
    toolsetFactory: "google.adk.tools.skill_toolset.SkillToolset";
  };
  toolset: {
    skills: DeepMindLocalSkillReference[];
  };
}

export interface DeepMindCodeDefinedSkillToolsetPayload {
  imports: {
    skillModel: "google.adk.skills.Skill";
    toolsetFactory: "google.adk.tools.skill_toolset.SkillToolset";
  };
  toolset: {
    skills: DeepMindCodeDefinedSkillReference[];
  };
}

export type DeepMindSkillToolsetPayload =
  | DeepMindLocalSkillToolsetPayload
  | DeepMindCodeDefinedSkillToolsetPayload;

export function buildDeepMindLocalSkillReference(
  container: SkillContainer,
  overrides: DeepMindLocalSkillReferenceOverrides = {}
): DeepMindLocalSkillReference & Record<string, unknown> {
  return {
    loader: "load_skill_from_dir",
    path: container.source.rootDir,
    ...overrides
  };
}

export function buildDeepMindCodeDefinedSkillReference(
  container: SkillContainer,
  overrides: DeepMindCodeDefinedSkillReferenceOverrides = {}
): DeepMindCodeDefinedSkillReference & Record<string, unknown> {
  return {
    name: container.descriptor.name,
    description: container.descriptor.description,
    tags: container.descriptor.tags,
    instructions: container.entry.content,
    ...overrides
  };
}

export function buildDeepMindLocalSkillToolsetPayload(
  skills: DeepMindLocalSkillReference[]
): DeepMindLocalSkillToolsetPayload {
  return {
    imports: {
      skillLoader: "google.adk.skills.load_skill_from_dir",
      toolsetFactory: "google.adk.tools.skill_toolset.SkillToolset"
    },
    toolset: {
      skills
    }
  };
}

export function buildDeepMindCodeDefinedSkillToolsetPayload(
  skills: DeepMindCodeDefinedSkillReference[]
): DeepMindCodeDefinedSkillToolsetPayload {
  return {
    imports: {
      skillModel: "google.adk.skills.Skill",
      toolsetFactory: "google.adk.tools.skill_toolset.SkillToolset"
    },
    toolset: {
      skills
    }
  };
}
