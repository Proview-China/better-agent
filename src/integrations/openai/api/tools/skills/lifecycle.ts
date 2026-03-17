import type { SkillContainer, SkillUploadBundle } from "../../../../../rax/skill-types.js";

export interface OpenAISkillListPayload {
  args: [
    {
      after?: string;
      limit?: number;
      order?: "asc" | "desc";
    }?
  ];
}

export interface OpenAISkillRetrievePayload {
  args: [skillID: string];
}

export interface OpenAISkillContentRetrievePayload {
  args: [skillID: string];
}

export interface OpenAISkillCreatePayload {
  args: [
    {
      files: SkillUploadBundle;
    }
  ];
}

export interface OpenAISkillDeletePayload {
  args: [skillID: string];
}

export interface OpenAISkillUpdatePayload {
  args: [
    skillID: string,
    {
      default_version: string;
    }
  ];
}

export interface OpenAISkillVersionListPayload {
  args: [
    skillID: string,
    {
      after?: string;
      limit?: number;
      order?: "asc" | "desc";
    }?
  ];
}

export interface OpenAISkillVersionRetrievePayload {
  args: [
    version: string,
    {
      skill_id: string;
    }
  ];
}

export interface OpenAISkillVersionContentRetrievePayload {
  args: [
    version: string,
    {
      skill_id: string;
    }
  ];
}

export interface OpenAISkillVersionCreatePayload {
  args: [
    skillID: string,
    {
      default?: boolean;
      files: SkillUploadBundle;
    }
  ];
}

export interface OpenAISkillVersionDeletePayload {
  args: [
    version: string,
    {
      skill_id: string;
    }
  ];
}

export function buildOpenAISkillListPayload(
  input: {
    after?: string;
    limit?: number;
    order?: "asc" | "desc";
  } = {}
): OpenAISkillListPayload {
  const query = {
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.order === undefined ? {} : { order: input.order })
  };

  return {
    args: Object.keys(query).length === 0 ? [] : [query]
  };
}

export function buildOpenAISkillRetrievePayload(skillId: string): OpenAISkillRetrievePayload {
  return {
    args: [skillId]
  };
}

export function buildOpenAISkillContentRetrievePayload(skillId: string): OpenAISkillContentRetrievePayload {
  return {
    args: [skillId]
  };
}

export function buildOpenAISkillCreatePayload(bundle: SkillUploadBundle): OpenAISkillCreatePayload {
  return {
    args: [
      {
        files: bundle
      }
    ]
  };
}

export function buildOpenAISkillDeletePayload(skillId: string): OpenAISkillDeletePayload {
  return {
    args: [skillId]
  };
}

export function buildOpenAISkillUpdatePayload(
  skillId: string,
  version: string
): OpenAISkillUpdatePayload {
  return {
    args: [
      skillId,
      {
        default_version: version
      }
    ]
  };
}

export function buildOpenAISkillVersionListPayload(
  skillId: string,
  input: {
    after?: string;
    limit?: number;
    order?: "asc" | "desc";
  } = {}
): OpenAISkillVersionListPayload {
  const query = {
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.order === undefined ? {} : { order: input.order })
  };

  return {
    args: Object.keys(query).length === 0
      ? [skillId]
      : [skillId, query]
  };
}

export function buildOpenAISkillVersionRetrievePayload(
  skillId: string,
  version: string
): OpenAISkillVersionRetrievePayload {
  return {
    args: [
      version,
      {
        skill_id: skillId
      }
    ]
  };
}

export function buildOpenAISkillVersionContentRetrievePayload(
  skillId: string,
  version: string
): OpenAISkillVersionContentRetrievePayload {
  return {
    args: [
      version,
      {
        skill_id: skillId
      }
    ]
  };
}

export function buildOpenAISkillVersionCreatePayload(
  skillId: string,
  bundle: SkillUploadBundle,
  setDefault?: boolean
): OpenAISkillVersionCreatePayload {
  return {
    args: [
      skillId,
      {
        ...(setDefault === undefined ? {} : { default: setDefault }),
        files: bundle
      }
    ]
  };
}

export function buildOpenAISkillVersionDeletePayload(
  skillId: string,
  version: string
): OpenAISkillVersionDeletePayload {
  return {
    args: [
      version,
      {
        skill_id: skillId
      }
    ]
  };
}

export function buildOpenAISkillUploadBundle(container: SkillContainer): SkillUploadBundle {
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
