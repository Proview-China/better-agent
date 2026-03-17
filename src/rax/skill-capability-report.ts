import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  DEFAULT_COMPATIBILITY_PROFILES,
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
  supportsCapabilityInProfile,
  type CompatibilityProfile
} from "./compatibility.js";
import type { PreparedInvocation } from "./contracts.js";
import { RaxRoutingError } from "./errors.js";
import { getCapabilityDefinition } from "./registry.js";
import { rax } from "./runtime.js";
import type { SkillContainer } from "./skill-types.js";
import type { ProviderId } from "./types.js";

type ReportProvider = ProviderId;

export interface SkillSmokeRow {
  provider: ReportProvider;
  step: string;
  ok: boolean;
  model: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface SkillCapabilityProviderReport {
  provider: ReportProvider;
  actions: SkillCapabilityActionReport[];
  official: {
    supportsManagedSkills: boolean;
    profileId: string;
  };
  localGateway: {
    supportsManagedSkills: boolean;
    profileId: string;
    unsupportedMode?: "blocked" | "skip";
  } | null;
  liveSmoke: {
    status: "supported" | "unsupported" | "route-failed" | "unknown";
    summary: string;
    rows: SkillSmokeRow[];
  };
}

export interface SkillCapabilityReport {
  generatedAt: string;
  smokeGeneratedAt?: string;
  providers: SkillCapabilityProviderReport[];
}

export interface SkillCapabilityActionReport {
  action:
    | "list"
    | "get"
    | "publish"
    | "remove"
    | "listVersions"
    | "getVersion"
    | "publishVersion"
    | "removeVersion"
    | "setDefaultVersion"
    | "getContent"
    | "getVersionContent";
  capabilityKey: "skill.list" | "skill.read" | "skill.create" | "skill.update" | "skill.remove";
  officialStatus: "documented" | "inferred" | "unconfirmed" | "unsupported";
  officialNotes?: string;
  officialDocs: string[];
  localGatewayStatus: "supported" | "blocked" | "unsupported" | "unknown";
  liveStatus: "supported" | "unsupported" | "route-failed" | "unknown";
  sdkEntrypoints: string[];
  preparedPayload: SkillPreparedPayloadSummary;
  routeEvidence: SkillRouteEvidence;
  routeSummary: string;
}

export interface SkillRouteEvidence {
  status: "supported" | "unsupported" | "route-failed" | "unknown";
  summary: string;
  steps: string[];
  rows: SkillSmokeRow[];
  failure?: {
    step: string;
    summary: string;
    details?: Record<string, unknown>;
  };
}

export interface SkillPreparedPayloadSummary {
  available: boolean;
  kind:
    | "query"
    | "id_lookup"
    | "version_lookup"
    | "bundle_upload"
    | "delete"
    | "default_pointer_update"
    | "content_download"
    | "unsupported";
  entrypoint?: string;
  argShape:
    | "none"
    | "single-id"
    | "version-and-skill-id"
    | "query-object"
    | "bundle-create"
    | "bundle-version-create"
    | "delete-with-id"
    | "delete-version"
    | "default-version-update"
    | "content-id"
    | "version-content";
  ids?: {
    usesSkillId: boolean;
    usesVersion: boolean;
  };
  query?: {
    supportsAfter: boolean;
    supportsLimit: boolean;
    supportsOrder: boolean;
    supportsPage: boolean;
    supportsSource: boolean;
  };
  upload?: {
    usesBundle: boolean;
    bundleRootDir: boolean;
    bundleRoles?: Array<"entry" | "resource" | "helper">;
    supportsDisplayTitle: boolean;
    supportsSetDefault: boolean;
    requiresUploadableLowering: boolean;
  };
  providerSpecific?: Record<string, unknown>;
  unsupportedReason?: string;
}

interface SkillSmokeReportFile {
  generatedAt?: string;
  provider?: string;
  rows: SkillSmokeRow[];
}

type SkillAction = SkillCapabilityActionReport["action"];

const REPORT_SAMPLE_CONTAINER: SkillContainer = {
  descriptor: {
    id: "skill_report_demo",
    name: "Report Demo Skill",
    description: "Synthetic skill container used for capability report payload summaries.",
    version: "0.0.1",
    tags: ["demo"],
    triggers: ["report"],
    source: {
      kind: "local",
      rootDir: "/virtual/skill-report-demo",
      entryPath: "/virtual/skill-report-demo/SKILL.md"
    }
  },
  source: {
    kind: "local",
    rootDir: "/virtual/skill-report-demo",
    entryPath: "/virtual/skill-report-demo/SKILL.md"
  },
  entry: {
    path: "/virtual/skill-report-demo/SKILL.md",
    content: "# Report Demo Skill"
  },
  resources: [
    {
      path: "/virtual/skill-report-demo/examples/example.json",
      relativePath: "examples/example.json",
      kind: "example"
    }
  ],
  helpers: [
    {
      path: "/virtual/skill-report-demo/scripts/run.js",
      relativePath: "scripts/run.js",
      kind: "script"
    }
  ],
  bindings: {},
  policy: {
    invocationMode: "auto",
    requiresApproval: false,
    riskLevel: "low",
    sourceTrust: "local"
  },
  loading: {
    metadata: "always",
    entry: "on-activate",
    resources: "on-demand",
    helpers: "on-demand"
  },
  ledger: {
    discoverCount: 0,
    activationCount: 0
  }
};

const REPORT_SAMPLE_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5.4",
  anthropic: "claude-opus-4-6-thinking",
  deepmind: "gemini-3-flash"
};

const REPORT_ANTHROPIC_BETAS = ["files-api-2025-04-14"];

function getProfile(
  provider: ProviderId,
  profiles: readonly CompatibilityProfile[]
): CompatibilityProfile | undefined {
  return profiles.find((profile) => profile.provider === provider);
}

function supportsManagedSkills(profile: CompatibilityProfile | undefined): boolean {
  if (!profile) {
    return false;
  }

  if ("supportsManagedSkills" in profile) {
    return profile.supportsManagedSkills ?? false;
  }

  return false;
}

function inferLiveSmokeStatus(rows: SkillSmokeRow[]): SkillCapabilityProviderReport["liveSmoke"] {
  if (rows.length === 0) {
    return {
      status: "unknown",
      summary: "no live smoke rows recorded",
      rows
    };
  }

  const allOk = rows.every((row) => row.ok);
  const anyFailure = rows.some((row) => !row.ok);
  const unsupportedOnly = allOk &&
    rows.every((row) => row.summary.includes("unsupported boundary held as expected"));

  if (unsupportedOnly) {
    return {
      status: "unsupported",
      summary: "live smoke confirms unsupported boundary",
      rows
    };
  }

  if (allOk) {
    return {
      status: "supported",
      summary: "live smoke succeeded on current route",
      rows
    };
  }

  if (anyFailure) {
    const firstFailure = rows.find((row) => !row.ok);
    return {
      status: "route-failed",
      summary: firstFailure?.summary ?? "live smoke failed on current route",
      rows
    };
  }

  return {
    status: "unknown",
    summary: "live smoke status could not be classified",
    rows
  };
}

const SKILL_ACTION_MATRIX = [
  { action: "list", capabilityKey: "skill.list", liveSteps: ["managed_list", "managed_registry"] },
  { action: "get", capabilityKey: "skill.read", liveSteps: ["managed_get", "managed_registry"] },
  { action: "publish", capabilityKey: "skill.create", liveSteps: ["managed_publish"] },
  { action: "remove", capabilityKey: "skill.remove", liveSteps: [] },
  { action: "listVersions", capabilityKey: "skill.list", liveSteps: ["managed_list_versions", "managed_registry"] },
  { action: "getVersion", capabilityKey: "skill.read", liveSteps: ["managed_get_version", "managed_registry"] },
  { action: "publishVersion", capabilityKey: "skill.create", liveSteps: [] },
  { action: "removeVersion", capabilityKey: "skill.remove", liveSteps: [] },
  { action: "setDefaultVersion", capabilityKey: "skill.update", liveSteps: [] },
  { action: "getContent", capabilityKey: "skill.read", liveSteps: [] },
  { action: "getVersionContent", capabilityKey: "skill.read", liveSteps: [] }
] as const;

function getActionKind(action: SkillAction): SkillPreparedPayloadSummary["kind"] {
  switch (action) {
    case "list":
    case "listVersions":
      return "query";
    case "get":
      return "id_lookup";
    case "getVersion":
      return "version_lookup";
    case "publish":
    case "publishVersion":
      return "bundle_upload";
    case "remove":
    case "removeVersion":
      return "delete";
    case "setDefaultVersion":
      return "default_pointer_update";
    case "getContent":
    case "getVersionContent":
      return "content_download";
  }
}

function getArgShape(action: SkillAction): SkillPreparedPayloadSummary["argShape"] {
  switch (action) {
    case "list":
    case "listVersions":
      return "query-object";
    case "get":
      return "single-id";
    case "getVersion":
      return "version-and-skill-id";
    case "publish":
      return "bundle-create";
    case "publishVersion":
      return "bundle-version-create";
    case "remove":
      return "delete-with-id";
    case "removeVersion":
      return "delete-version";
    case "setDefaultVersion":
      return "default-version-update";
    case "getContent":
      return "content-id";
    case "getVersionContent":
      return "version-content";
  }
}

function getSdkEntrypoints(
  provider: ProviderId,
  action: SkillCapabilityActionReport["action"]
): string[] {
  switch (provider) {
    case "openai":
      switch (action) {
        case "list":
          return ["client.skills.list"];
        case "get":
          return ["client.skills.retrieve"];
        case "publish":
          return ["client.skills.create"];
        case "remove":
          return ["client.skills.delete"];
        case "listVersions":
          return ["client.skills.versions.list"];
        case "getVersion":
          return ["client.skills.versions.retrieve"];
        case "publishVersion":
          return ["client.skills.versions.create"];
        case "removeVersion":
          return ["client.skills.versions.delete"];
        case "setDefaultVersion":
          return ["client.skills.update"];
        case "getContent":
          return ["client.skills.content.retrieve"];
        case "getVersionContent":
          return ["client.skills.versions.content.retrieve"];
      }
    case "anthropic":
      switch (action) {
        case "list":
          return ["client.beta.skills.list"];
        case "get":
          return ["client.beta.skills.retrieve"];
        case "publish":
          return ["client.beta.skills.create"];
        case "remove":
          return ["client.beta.skills.delete"];
        case "listVersions":
          return ["client.beta.skills.versions.list"];
        case "getVersion":
          return ["client.beta.skills.versions.retrieve"];
        case "publishVersion":
          return ["client.beta.skills.versions.create"];
        case "removeVersion":
          return ["client.beta.skills.versions.delete"];
        case "setDefaultVersion":
        case "getContent":
        case "getVersionContent":
          return [];
      }
    case "deepmind":
      return [];
  }
}

function computeOfficialStatus(
  provider: ProviderId,
  capabilityKey: SkillCapabilityActionReport["capabilityKey"],
  action: SkillCapabilityActionReport["action"]
): SkillCapabilityActionReport["officialStatus"] {
  if (action === "getContent" || action === "getVersionContent") {
    return provider === "openai" ? "documented" : "unsupported";
  }

  const definition = getCapabilityDefinition(capabilityKey);
  return definition?.providerSupport[provider].status ?? "unknown" as never;
}

function computeOfficialNotes(
  provider: ProviderId,
  capabilityKey: SkillCapabilityActionReport["capabilityKey"],
  action: SkillCapabilityActionReport["action"]
): string | undefined {
  if (action === "getContent" || action === "getVersionContent") {
    return provider === "openai"
      ? "OpenAI documents skill bundle download surfaces under hosted skills content resources."
      : "No equivalent official content download surface is currently documented for this provider in the present baseline.";
  }

  return getCapabilityDefinition(capabilityKey)?.providerSupport[provider].notes;
}

function getOfficialDocs(
  provider: ProviderId,
  action: SkillCapabilityActionReport["action"]
): string[] {
  switch (provider) {
    case "openai":
      return [
        "https://developers.openai.com/api/docs/guides/tools-skills"
      ];
    case "anthropic":
      return action === "publish" || action === "list" || action === "get" || action === "listVersions" || action === "getVersion" || action === "publishVersion" || action === "removeVersion" || action === "remove" || action === "setDefaultVersion"
        ? [
            "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart",
            "https://platform.claude.com/docs/en/agent-sdk/skills"
          ]
        : [
            "https://platform.claude.com/docs/en/agent-sdk/skills"
          ];
    case "deepmind":
      return [
        "https://google.github.io/adk-docs/skills/"
      ];
  }
}

function computeLocalGatewayStatus(
  provider: ProviderId,
  localProfile: CompatibilityProfile | undefined,
  capabilityKey: SkillCapabilityActionReport["capabilityKey"],
  action: SkillCapabilityActionReport["action"]
): SkillCapabilityActionReport["localGatewayStatus"] {
  if (!localProfile) {
    return "unknown";
  }

  if (action === "getContent" || action === "getVersionContent") {
    if (provider !== "openai") {
      return "unsupported";
    }
    return supportsManagedSkills(localProfile) ? "supported" : "blocked";
  }

  const supported = supportsCapabilityInProfile(localProfile, capabilityKey);
  if (supported === true) {
    return "supported";
  }
  if (supported === false) {
    return localProfile.unsupportedMode === "blocked" ? "blocked" : "unsupported";
  }
  return "unknown";
}

function computeLiveStatus(
  rows: SkillSmokeRow[],
  action: SkillCapabilityActionReport["action"],
  liveSteps: readonly string[]
): SkillCapabilityActionReport["liveStatus"] {
  return computeRouteEvidence(rows, action, liveSteps).status;
}

function computeRouteSummary(
  rows: SkillSmokeRow[],
  action: SkillCapabilityActionReport["action"],
  liveSteps: readonly string[]
): string {
  return computeRouteEvidence(rows, action, liveSteps).summary;
}

function computeRouteEvidence(
  rows: SkillSmokeRow[],
  action: SkillCapabilityActionReport["action"],
  liveSteps: readonly string[]
): SkillRouteEvidence {
  if (action === "publishVersion" || action === "remove" || action === "removeVersion" || action === "setDefaultVersion" || action === "getContent" || action === "getVersionContent") {
    return {
      status: "unknown",
      summary: "no action-specific live evidence yet",
      steps: [],
      rows: []
    };
  }

  const relevant = rows.filter((row) => liveSteps.includes(row.step));
  if (relevant.length === 0) {
    return {
      status: "unknown",
      summary: "no action-specific live evidence yet",
      steps: [],
      rows: []
    };
  }

  if (relevant.some((row) => !row.ok)) {
    const firstFailure = relevant.find((row) => !row.ok);
    return {
      status: "route-failed",
      summary: firstFailure?.summary ?? "live route failed",
      steps: relevant.map((row) => row.step),
      rows: relevant,
      failure: firstFailure
        ? {
            step: firstFailure.step,
            summary: firstFailure.summary,
            details: firstFailure.details
          }
        : undefined
    };
  }

  if (relevant.every((row) => row.summary.includes("unsupported boundary held as expected"))) {
    return {
      status: "unsupported",
      summary: "unsupported boundary held as expected",
      steps: relevant.map((row) => row.step),
      rows: relevant
    };
  }

  return {
    status: "supported",
    summary: relevant.map((row) => row.summary).join("; "),
    steps: relevant.map((row) => row.step),
    rows: relevant
  };
}

function summarizePreparedPayloadInvocation(
  action: SkillAction,
  invocation: PreparedInvocation<Record<string, unknown>>
): SkillPreparedPayloadSummary {
  const payload = invocation.payload as { args?: unknown[] };
  const args = Array.isArray(payload.args) ? payload.args : [];
  const firstObjectArg = args.find(
    (arg): arg is Record<string, unknown> => Boolean(arg && typeof arg === "object" && !Array.isArray(arg))
  );
  const lastObjectArg = [...args].reverse().find(
    (arg): arg is Record<string, unknown> => Boolean(arg && typeof arg === "object" && !Array.isArray(arg))
  );
  const ids = {
    usesSkillId: ["get", "remove", "listVersions", "getVersion", "publishVersion", "removeVersion", "setDefaultVersion", "getContent", "getVersionContent"].includes(action),
    usesVersion: ["getVersion", "removeVersion", "setDefaultVersion", "getVersionContent"].includes(action)
  };
  const summary: SkillPreparedPayloadSummary = {
    available: true,
    kind: getActionKind(action),
    entrypoint: invocation.sdk.entrypoint,
    argShape: getArgShape(action)
  };

  const uploadTarget = lastObjectArg && "files" in lastObjectArg && lastObjectArg.files && typeof lastObjectArg.files === "object"
    ? lastObjectArg.files as { rootDir?: string; files?: Array<{ role?: "entry" | "resource" | "helper" }> }
    : null;
  const managedBundle = "bundle" in invocation.payload && invocation.payload.bundle && typeof invocation.payload.bundle === "object"
    ? invocation.payload.bundle as {
        source?: {
          kind?: string;
          path?: string;
          paths?: string[];
        };
        notes?: string[];
      }
    : null;

  switch (action) {
    case "list":
    case "listVersions":
      summary.ids = ids;
      summary.query = {
        supportsAfter: Boolean(lastObjectArg && "after" in lastObjectArg),
        supportsLimit: Boolean(lastObjectArg && "limit" in lastObjectArg),
        supportsOrder: Boolean(lastObjectArg && "order" in lastObjectArg),
        supportsPage: Boolean(lastObjectArg && "page" in lastObjectArg),
        supportsSource: Boolean(lastObjectArg && "source" in lastObjectArg)
      };
      break;
    case "get":
    case "remove":
    case "getContent":
      summary.ids = ids;
      break;
    case "getVersion":
    case "removeVersion":
    case "setDefaultVersion":
    case "getVersionContent":
      summary.ids = ids;
      break;
    case "publish":
    case "publishVersion": {
      const uploadArg = lastObjectArg;
      const files = Array.isArray(uploadTarget?.files)
        ? uploadTarget.files
        : [];
      summary.ids = ids;
      summary.upload = {
        usesBundle: Boolean((uploadArg && "files" in uploadArg) || managedBundle),
        bundleRootDir: Boolean(
          (uploadTarget && "rootDir" in uploadTarget) ||
          managedBundle?.source?.kind === "local-directory"
        ),
        bundleRoles: [...new Set(files.map((file) => file.role).filter((role): role is "entry" | "resource" | "helper" => Boolean(role)))],
        supportsDisplayTitle: Boolean(uploadArg && "display_title" in uploadArg),
        supportsSetDefault: Boolean(uploadArg && "default" in uploadArg),
        requiresUploadableLowering: (invocation.sdk.notes?.includes("Uploadable") ?? false) || Array.isArray(managedBundle?.notes)
      };
      break;
    }
  }

  if (firstObjectArg && Array.isArray(firstObjectArg.betas)) {
    summary.providerSpecific = {
      betasInjected: true,
      betas: firstObjectArg.betas
    };
  } else if (lastObjectArg && Array.isArray(lastObjectArg.betas)) {
    summary.providerSpecific = {
      betasInjected: true,
      betas: lastObjectArg.betas
    };
  }

  return summary;
}

async function prepareReportInvocation(
  provider: ProviderId,
  action: SkillAction
): Promise<PreparedInvocation<Record<string, unknown>>> {
  const model = REPORT_SAMPLE_MODELS[provider];

  switch (action) {
    case "list":
      if (provider === "openai") {
        return rax.skill.list({
          provider,
          model,
          providerOptions: {
            openai: {
              after: "skill_after_demo",
              limit: 10
            }
          },
          input: {
            order: "desc"
          }
        });
      }
      if (provider === "anthropic") {
        return rax.skill.list({
          provider,
          model,
          providerOptions: {
            anthropic: {
              betas: REPORT_ANTHROPIC_BETAS,
              page: "cursor_demo",
              limit: 20
            }
          },
          input: {
            source: "custom"
          }
        });
      }
      return rax.skill.list({
        provider,
        model,
        input: {}
      });
    case "get":
      return rax.skill.get({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          skillId: "skill_demo_001"
        }
      });
    case "publish":
      return rax.skill.publish({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          source: REPORT_SAMPLE_CONTAINER.source.rootDir,
          container: REPORT_SAMPLE_CONTAINER,
          ...(provider === "anthropic" ? { displayTitle: "Report Demo Skill" } : {})
        }
      });
    case "remove":
      return rax.skill.remove({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          skillId: "skill_demo_001"
        }
      });
    case "listVersions":
      if (provider === "openai") {
        return rax.skill.listVersions({
          provider,
          model,
          providerOptions: {
            openai: {
              after: "version_after_demo",
              limit: 5
            }
          },
          input: {
            skillId: "skill_demo_001",
            order: "asc"
          }
        });
      }
      if (provider === "anthropic") {
        return rax.skill.listVersions({
          provider,
          model,
          providerOptions: {
            anthropic: {
              betas: REPORT_ANTHROPIC_BETAS,
              page: "cursor_demo",
              limit: 15
            }
          },
          input: {
            skillId: "skill_demo_001"
          }
        });
      }
      return rax.skill.listVersions({
        provider,
        model,
        input: {
          skillId: "skill_demo_001"
        }
      });
    case "getVersion":
      return rax.skill.getVersion({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          skillId: "skill_demo_001",
          version: "version_demo_007"
        }
      });
    case "publishVersion":
      return rax.skill.publishVersion({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          source: REPORT_SAMPLE_CONTAINER.source.rootDir,
          container: REPORT_SAMPLE_CONTAINER,
          skillId: "skill_demo_001",
          ...(provider === "openai" ? { setDefault: true } : {})
        }
      });
    case "removeVersion":
      return rax.skill.removeVersion({
        provider,
        model,
        ...(provider === "anthropic"
          ? {
              providerOptions: {
                anthropic: {
                  betas: REPORT_ANTHROPIC_BETAS
                }
              }
            }
          : {}),
        input: {
          skillId: "skill_demo_001",
          version: "version_demo_007"
        }
      });
    case "setDefaultVersion":
      return rax.skill.setDefaultVersion({
        provider,
        model,
        input: {
          skillId: "skill_demo_001",
          version: "version_demo_007"
        }
      });
    case "getContent":
      return rax.skill.getContent({
        provider,
        model,
        input: {
          skillId: "skill_demo_001"
        }
      });
    case "getVersionContent":
      return rax.skill.getVersionContent({
        provider,
        model,
        input: {
          skillId: "skill_demo_001",
          version: "version_demo_007"
        }
      });
  }
}

async function buildPreparedPayloadSummary(
  provider: ProviderId,
  action: SkillAction
): Promise<SkillPreparedPayloadSummary> {
  try {
    const invocation = await prepareReportInvocation(provider, action);
    return summarizePreparedPayloadInvocation(action, invocation);
  } catch (error) {
    if (error instanceof RaxRoutingError && error.code === "skill_managed_unsupported") {
      return {
        available: false,
        kind: "unsupported",
        argShape: "none",
        unsupportedReason: error.message
      };
    }

    throw error;
  }
}

export async function buildSkillCapabilityReport(input: {
  smokeRows: SkillSmokeRow[];
  smokeGeneratedAt?: string;
  generatedAt?: string;
  defaultProfiles?: readonly CompatibilityProfile[];
  localGatewayProfiles?: readonly CompatibilityProfile[];
}): Promise<SkillCapabilityReport> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const defaultProfiles = input.defaultProfiles ?? DEFAULT_COMPATIBILITY_PROFILES;
  const localGatewayProfiles = input.localGatewayProfiles ?? LOCAL_GATEWAY_COMPATIBILITY_PROFILES;
  const providers: ProviderId[] = ["openai", "anthropic", "deepmind"];

  return {
    generatedAt,
    smokeGeneratedAt: input.smokeGeneratedAt,
    providers: await Promise.all(providers.map(async (provider) => {
      const defaultProfile = getProfile(provider, defaultProfiles);
      const localProfile = getProfile(provider, localGatewayProfiles);
      const smokeRows = input.smokeRows.filter((row) => row.provider === provider);

      return {
        provider,
        actions: await Promise.all(SKILL_ACTION_MATRIX.map(async (entry) => {
          const routeEvidence = computeRouteEvidence(smokeRows, entry.action, entry.liveSteps);
          return {
            action: entry.action,
            capabilityKey: entry.capabilityKey,
            officialStatus: computeOfficialStatus(provider, entry.capabilityKey, entry.action),
            officialNotes: computeOfficialNotes(provider, entry.capabilityKey, entry.action),
            officialDocs: getOfficialDocs(provider, entry.action),
            localGatewayStatus: computeLocalGatewayStatus(provider, localProfile, entry.capabilityKey, entry.action),
            liveStatus: computeLiveStatus(smokeRows, entry.action, entry.liveSteps),
            sdkEntrypoints: getSdkEntrypoints(provider, entry.action),
            preparedPayload: await buildPreparedPayloadSummary(provider, entry.action),
            routeEvidence,
            routeSummary: routeEvidence.summary
          };
        })),
        official: {
          supportsManagedSkills: supportsManagedSkills(defaultProfile),
          profileId: defaultProfile?.id ?? "missing"
        },
        localGateway: localProfile
          ? {
              supportsManagedSkills: supportsManagedSkills(localProfile),
              profileId: localProfile.id,
              unsupportedMode: localProfile.unsupportedMode
            }
          : null,
        liveSmoke: inferLiveSmokeStatus(smokeRows)
      };
    }))
  };
}

async function readSmokeReport(path: string): Promise<SkillSmokeReportFile> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as SkillSmokeReportFile;
}

function parseArg(argv: string[], key: "--smoke-report=" | "--output="): string | undefined {
  const entry = argv.find((item) => item.startsWith(key));
  return entry?.slice(key.length);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const smokeReportPath = parseArg(argv, "--smoke-report=")
    ?? resolve(process.cwd(), "memory/live-reports/skill-live-smoke.json");
  const outputPath = parseArg(argv, "--output=")
    ?? resolve(process.cwd(), "memory/live-reports/skill-capability-report.json");

  const smoke = await readSmokeReport(smokeReportPath);
  const report = await buildSkillCapabilityReport({
    smokeRows: smoke.rows,
    smokeGeneratedAt: smoke.generatedAt
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`skill capability report written to ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
