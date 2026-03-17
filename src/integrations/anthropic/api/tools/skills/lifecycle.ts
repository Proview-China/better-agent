import type { SkillContainer, SkillUploadBundle } from "../../../../../rax/skill-types.js";

export const ANTHROPIC_SKILLS_BETA = "skills-2025-10-02" as const;
export const ANTHROPIC_FILES_API_BETA = "files-api-2025-04-14" as const;

export interface AnthropicSkillListPayload {
  args: [
    {
      limit?: number;
      page?: string | null;
      source?: "custom" | "anthropic" | null;
      betas: string[];
    }?
  ];
}

export interface AnthropicSkillRetrievePayload {
  args: [
    skillID: string,
    {
      betas: string[];
    }?
  ];
}

export interface AnthropicSkillCreatePayload {
  args: [
    {
      display_title?: string | null;
      files: SkillUploadBundle;
      betas: string[];
    }
  ];
}

export interface AnthropicSkillDeletePayload {
  args: [
    skillID: string,
    {
      betas: string[];
    }?
  ];
}

export interface AnthropicSkillVersionListPayload {
  args: [
    skillID: string,
    {
      limit?: number;
      page?: string | null;
      betas: string[];
    }?
  ];
}

export interface AnthropicSkillVersionRetrievePayload {
  args: [
    version: string,
    {
      skill_id: string;
      betas: string[];
    }
  ];
}

export interface AnthropicSkillVersionCreatePayload {
  args: [
    skillID: string,
    {
      files: SkillUploadBundle;
      betas: string[];
    }
  ];
}

export interface AnthropicSkillVersionDeletePayload {
  args: [
    version: string,
    {
      skill_id: string;
      betas: string[];
    }
  ];
}

export function withAnthropicSkillsBeta(betas?: string[]): string[] {
  const merged = [...(betas ?? []), ANTHROPIC_SKILLS_BETA];
  return [...new Set(merged)];
}

export function withAnthropicSkillUploadBetas(betas?: string[]): string[] {
  const merged = [...(betas ?? []), ANTHROPIC_FILES_API_BETA, ANTHROPIC_SKILLS_BETA];
  return [...new Set(merged)];
}

export function buildAnthropicSkillListPayload(
  input: {
    limit?: number;
    page?: string | null;
    source?: "custom" | "anthropic";
    betas?: string[];
  } = {}
): AnthropicSkillListPayload {
  const query = {
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.page === undefined ? {} : { page: input.page }),
    ...(input.source === undefined ? {} : { source: input.source }),
    betas: withAnthropicSkillsBeta(input.betas)
  };

  return {
    args: [query]
  };
}

export function buildAnthropicSkillRetrievePayload(
  skillId: string,
  betas?: string[]
): AnthropicSkillRetrievePayload {
  return {
    args: [
      skillId,
      {
        betas: withAnthropicSkillsBeta(betas)
      }
    ]
  };
}

export function buildAnthropicSkillCreatePayload(
  bundle: SkillUploadBundle,
  input: {
    displayTitle?: string | null;
    betas?: string[];
  } = {}
): AnthropicSkillCreatePayload {
  return {
    args: [
      {
        ...(input.displayTitle === undefined ? {} : { display_title: input.displayTitle }),
        files: bundle,
        betas: withAnthropicSkillUploadBetas(input.betas)
      }
    ]
  };
}

export function buildAnthropicSkillDeletePayload(
  skillId: string,
  betas?: string[]
): AnthropicSkillDeletePayload {
  return {
    args: [
      skillId,
      {
        betas: withAnthropicSkillsBeta(betas)
      }
    ]
  };
}

export function buildAnthropicSkillVersionListPayload(
  skillId: string,
  input: {
    limit?: number;
    page?: string | null;
    betas?: string[];
  } = {}
): AnthropicSkillVersionListPayload {
  return {
    args: [
      skillId,
      {
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.page === undefined ? {} : { page: input.page }),
        betas: withAnthropicSkillsBeta(input.betas)
      }
    ]
  };
}

export function buildAnthropicSkillVersionRetrievePayload(
  skillId: string,
  version: string,
  betas?: string[]
): AnthropicSkillVersionRetrievePayload {
  return {
    args: [
      version,
      {
        skill_id: skillId,
        betas: withAnthropicSkillsBeta(betas)
      }
    ]
  };
}

export function buildAnthropicSkillVersionCreatePayload(
  skillId: string,
  bundle: SkillUploadBundle,
  betas?: string[]
): AnthropicSkillVersionCreatePayload {
  return {
    args: [
      skillId,
      {
        files: bundle,
        betas: withAnthropicSkillUploadBetas(betas)
      }
    ]
  };
}

export function buildAnthropicSkillVersionDeletePayload(
  skillId: string,
  version: string,
  betas?: string[]
): AnthropicSkillVersionDeletePayload {
  return {
    args: [
      version,
      {
        skill_id: skillId,
        betas: withAnthropicSkillsBeta(betas)
      }
    ]
  };
}

export function buildAnthropicSkillUploadBundle(container: SkillContainer): SkillUploadBundle {
  return {
    rootDir: container.source.rootDir,
    files: [
      {
        path: container.entry.path,
        relativePath: "SKILL.md",
        role: "entry"
      },
      ...container.resources.map((resource) => ({
        path: resource.path,
        relativePath: resource.relativePath,
        role: "resource" as const
      })),
      ...container.helpers.map((helper) => ({
        path: helper.path,
        relativePath: helper.relativePath,
        role: "helper" as const
      }))
    ]
  };
}
