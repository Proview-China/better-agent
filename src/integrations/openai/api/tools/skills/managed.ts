import type {
  SkillCreateParams,
  SkillListParams,
  SkillUpdateParams,
} from "openai/resources/skills/skills.js";
import type {
  VersionCreateParams,
  VersionDeleteParams,
  VersionListParams,
  VersionRetrieveParams,
} from "openai/resources/skills/versions/versions.js";

import { omitUndefined } from "../../types.js";

export type OpenAISkillBundleSource =
  | {
      kind: "local-directory";
      path: string;
    }
  | {
      kind: "local-file";
      path: string;
    }
  | {
      kind: "local-files";
      paths: string[];
    };

export interface OpenAISkillBundlePlan {
  source: OpenAISkillBundleSource;
  notes: string[];
}

export type OpenAISkillCreatePreparedParams = Omit<SkillCreateParams, "files">;
export type OpenAISkillVersionCreatePreparedParams = Omit<VersionCreateParams, "files">;

export interface OpenAISDKCallPlan<TArgs extends unknown[]> {
  sdkMethodPath: string;
  args: TArgs;
  notes?: string[];
}

export interface OpenAISkillListPlan extends OpenAISDKCallPlan<[] | [SkillListParams]> {
  operation: "skills.list";
}

export interface OpenAISkillGetPlan extends OpenAISDKCallPlan<[skillID: string]> {
  operation: "skills.retrieve";
}

export interface OpenAISkillCreatePlan extends OpenAISDKCallPlan<[] | [OpenAISkillCreatePreparedParams]> {
  operation: "skills.create";
  bundle: OpenAISkillBundlePlan;
}

export interface OpenAISkillDeletePlan extends OpenAISDKCallPlan<[skillID: string]> {
  operation: "skills.delete";
}

export interface OpenAISkillUpdateDefaultVersionPlan
  extends OpenAISDKCallPlan<[skillID: string, body: SkillUpdateParams]> {
  operation: "skills.update";
}

export interface OpenAISkillVersionListPlan
  extends OpenAISDKCallPlan<[skillID: string] | [skillID: string, query: VersionListParams]> {
  operation: "skills.versions.list";
}

export interface OpenAISkillVersionGetPlan
  extends OpenAISDKCallPlan<[versionID: string, params: VersionRetrieveParams]> {
  operation: "skills.versions.retrieve";
}

export interface OpenAISkillVersionCreatePlan
  extends OpenAISDKCallPlan<[skillID: string] | [skillID: string, body: OpenAISkillVersionCreatePreparedParams]> {
  operation: "skills.versions.create";
  bundle: OpenAISkillBundlePlan;
}

export interface OpenAISkillVersionDeletePlan
  extends OpenAISDKCallPlan<[versionID: string, params: VersionDeleteParams]> {
  operation: "skills.versions.delete";
}

export type OpenAISkillManagedLifecyclePlan =
  | OpenAISkillListPlan
  | OpenAISkillGetPlan
  | OpenAISkillCreatePlan
  | OpenAISkillDeletePlan
  | OpenAISkillUpdateDefaultVersionPlan
  | OpenAISkillVersionListPlan
  | OpenAISkillVersionGetPlan
  | OpenAISkillVersionCreatePlan
  | OpenAISkillVersionDeletePlan;

function hasOwnKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

export function buildOpenAISkillLocalDirectoryBundle(path: string): OpenAISkillBundlePlan {
  return {
    source: {
      kind: "local-directory",
      path,
    },
    notes: [
      "Translate the local directory into SDK Uploadable files at execution time.",
      "Do not serialize directory contents into this prepared plan.",
    ],
  };
}

export function buildOpenAISkillLocalFileBundle(path: string): OpenAISkillBundlePlan {
  return {
    source: {
      kind: "local-file",
      path,
    },
    notes: [
      "Translate the local file into an SDK Uploadable at execution time.",
      "This plan intentionally preserves only the file path.",
    ],
  };
}

export function buildOpenAISkillLocalFilesBundle(paths: string[]): OpenAISkillBundlePlan {
  return {
    source: {
      kind: "local-files",
      paths: [...paths],
    },
    notes: [
      "Translate the local file set into SDK Uploadables at execution time.",
      "The prepared plan preserves file paths instead of faking Uploadable objects.",
    ],
  };
}

export function buildOpenAISkillListPlan(
  query?: SkillListParams | null,
): OpenAISkillListPlan {
  const normalized = omitUndefined({ ...(query ?? {}) });
  return {
    operation: "skills.list",
    sdkMethodPath: "client.skills.list",
    args: hasOwnKeys(normalized) ? [normalized] : [],
  };
}

export function buildOpenAISkillGetPlan(skillID: string): OpenAISkillGetPlan {
  return {
    operation: "skills.retrieve",
    sdkMethodPath: "client.skills.retrieve",
    args: [skillID],
  };
}

export function buildOpenAISkillCreatePlan(
  bundle: OpenAISkillBundlePlan,
  body?: OpenAISkillCreatePreparedParams | null,
): OpenAISkillCreatePlan {
  const normalized = omitUndefined({ ...(body ?? {}) });
  return {
    operation: "skills.create",
    sdkMethodPath: "client.skills.create",
    args: hasOwnKeys(normalized) ? [normalized] : [],
    bundle,
  };
}

export function buildOpenAISkillDeletePlan(skillID: string): OpenAISkillDeletePlan {
  return {
    operation: "skills.delete",
    sdkMethodPath: "client.skills.delete",
    args: [skillID],
  };
}

export function buildOpenAISkillUpdateDefaultVersionPlan(
  skillID: string,
  defaultVersion: string,
): OpenAISkillUpdateDefaultVersionPlan {
  return {
    operation: "skills.update",
    sdkMethodPath: "client.skills.update",
    args: [skillID, { default_version: defaultVersion }],
  };
}

export function buildOpenAISkillVersionListPlan(
  skillID: string,
  query?: VersionListParams | null,
): OpenAISkillVersionListPlan {
  const normalized = omitUndefined({ ...(query ?? {}) });
  return {
    operation: "skills.versions.list",
    sdkMethodPath: "client.skills.versions.list",
    args: hasOwnKeys(normalized) ? [skillID, normalized] : [skillID],
  };
}

export function buildOpenAISkillVersionGetPlan(
  skillID: string,
  versionID: string,
): OpenAISkillVersionGetPlan {
  return {
    operation: "skills.versions.retrieve",
    sdkMethodPath: "client.skills.versions.retrieve",
    args: [versionID, { skill_id: skillID }],
  };
}

export function buildOpenAISkillVersionCreatePlan(
  skillID: string,
  bundle: OpenAISkillBundlePlan,
  body?: OpenAISkillVersionCreatePreparedParams | null,
): OpenAISkillVersionCreatePlan {
  const normalized = omitUndefined({ ...(body ?? {}) });
  return {
    operation: "skills.versions.create",
    sdkMethodPath: "client.skills.versions.create",
    args: hasOwnKeys(normalized) ? [skillID, normalized] : [skillID],
    bundle,
  };
}

export function buildOpenAISkillVersionDeletePlan(
  skillID: string,
  versionID: string,
): OpenAISkillVersionDeletePlan {
  return {
    operation: "skills.versions.delete",
    sdkMethodPath: "client.skills.versions.delete",
    args: [versionID, { skill_id: skillID }],
  };
}
