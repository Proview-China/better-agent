import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  resolveAuthJsonPath,
  resolveCacheDir,
  resolveConfigJsonPath,
  resolveConfigRoot,
  resolveLogsDir,
  resolveRaxcodeHome,
  resolveSessionsDir,
  resolveStateRoot,
  resolveWorkspaceRoot,
} from "./runtime-paths.js";
import type {
  TapAutomationDepth,
  TapShared15ViewCell,
  TapToolPolicyOverride,
  TapUserExplanationStyle,
  TaUserOverrideContract,
} from "./agent_core/ta-pool-model/index.js";
import { createTapGovernanceObject } from "./agent_core/ta-pool-model/index.js";
import type { TaPoolMode } from "./agent_core/ta-pool-types/index.js";

export const RAXCODE_SCHEMA_VERSION = 1;

export type RaxcodeProviderKind = "openai" | "anthropic" | "deepmind";
export type RaxcodeProviderSlot = "openai" | "anthropic" | "anthropicAlt" | "deepmind";
export type RaxcodeReasoningEffort = "low" | "medium" | "high" | "xhigh" | "none" | "minimal";
export type RaxcodeBootstrapSource = "manual" | "import" | "oauth";
export type RaxcodeAuthMode = "api_key" | "chatgpt_oauth";

export type RaxcodeRoleId =
  | "core.main"
  | "tap.reviewer"
  | "tap.toolReviewer"
  | "tap.provisioner"
  | "mp.icma"
  | "mp.iterator"
  | "mp.checker"
  | "mp.dbagent"
  | "mp.dispatcher"
  | "cmp.icma"
  | "cmp.iterator"
  | "cmp.checker"
  | "cmp.dbagent"
  | "cmp.dispatcher"
  | "tui.main";

export const RAXCODE_ROLE_IDS: RaxcodeRoleId[] = [
  "core.main",
  "tap.reviewer",
  "tap.toolReviewer",
  "tap.provisioner",
  "mp.icma",
  "mp.iterator",
  "mp.checker",
  "mp.dbagent",
  "mp.dispatcher",
  "cmp.icma",
  "cmp.iterator",
  "cmp.checker",
  "cmp.dbagent",
  "cmp.dispatcher",
  "tui.main",
];

export interface RaxcodeRoutePlan {
  model: string;
  reasoning: RaxcodeReasoningEffort;
  serviceTier?: "fast";
  maxOutputTokens?: number;
  contextWindowTokens?: number;
}

export interface RaxcodeLiveChatModelPlan {
  core: {
    main: RaxcodeRoutePlan;
  };
  tap: Record<"reviewer" | "toolReviewer" | "provisioner", RaxcodeRoutePlan>;
  mp: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", RaxcodeRoutePlan>;
  cmp: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", RaxcodeRoutePlan>;
  tui: {
    main: RaxcodeRoutePlan;
  };
}

export interface RaxcodeAuthProfile {
  id: string;
  provider: RaxcodeProviderKind;
  label: string;
  authMode: RaxcodeAuthMode;
  credentials: {
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    accountId?: string;
  };
  meta: {
    source: RaxcodeBootstrapSource;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    orgId?: string;
    projectId?: string;
    accountId?: string;
    email?: string;
    chatgptPlanType?: string;
    chatgptUserId?: string;
    chatgptAccountId?: string;
    lastRefreshAt?: string;
    accessTokenExpiresAt?: string;
    idTokenExpiresAt?: string;
  };
}

export interface RaxcodeAuthFile {
  schemaVersion: number;
  activeAuthProfileIdBySlot: Partial<Record<RaxcodeProviderSlot, string>>;
  authProfiles: RaxcodeAuthProfile[];
}

export interface RaxcodeProviderProfile {
  id: string;
  provider: RaxcodeProviderKind;
  label: string;
  authProfileId: string;
  route: {
    baseURL: string;
    apiStyle?: string;
  };
  model: string;
  reasoningEffort?: RaxcodeReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  enabled: boolean;
}

export interface RaxcodeRoleBinding {
  profileId: string;
  enabled: boolean;
  overrides?: Partial<RaxcodeRoutePlan>;
}

export interface RaxcodeUiConfig {
  language: string;
  startupView: string;
  defaultAgentsView: string;
  slashMenuStyle: string;
  toolSummaryStyle: string;
}

export interface RaxcodePermissionsConfig {
  requestedMode: TaPoolMode;
  automationDepth: TapAutomationDepth;
  explanationStyle: TapUserExplanationStyle;
  requireHumanOnRiskLevels: string[];
  capabilityOverrides: TapToolPolicyOverride[];
  shared15ViewMatrix: TapShared15ViewCell[];
  persistedAllowRules: RaxcodePersistedPermissionRule[];
}

export interface RaxcodePersistedPermissionRule {
  ruleId: string;
  agentId: string;
  capabilityFamily: "read";
  pathPrefix: string;
  createdAt: string;
  updatedAt: string;
}

export interface RaxcodeWorkspaceConfig {
  defaultPath: string;
}

export interface RaxcodeEmbeddingConfig {
  lanceDbModel: "text-embedding-3-large" | "text-embedding-3-small";
  provider?: "openai";
  baseURL?: string;
  authProfileId?: string;
  dimensions?: number;
}

export interface RaxcodeConfigFile {
  schemaVersion: number;
  providerSlots: Partial<Record<RaxcodeProviderSlot, string>>;
  profiles: RaxcodeProviderProfile[];
  roleBindings: Record<RaxcodeRoleId, RaxcodeRoleBinding>;
  embedding: RaxcodeEmbeddingConfig;
  workspace: RaxcodeWorkspaceConfig;
  ui: RaxcodeUiConfig;
  permissions: RaxcodePermissionsConfig;
}

export interface RaxcodeRuntimeConfigSnapshot {
  modelPlan: RaxcodeLiveChatModelPlan;
  tapOverride: TaUserOverrideContract;
  ui: RaxcodeUiConfig;
  permissions: RaxcodePermissionsConfig;
  embedding: RaxcodeEmbeddingConfig;
  workspace: RaxcodeWorkspaceConfig;
}

export interface RaxcodeResolvedProfile {
  slot: RaxcodeProviderSlot;
  profile: RaxcodeProviderProfile;
  authProfile: RaxcodeAuthProfile;
}

export interface RaxcodeResolvedRoleConfig {
  roleId: RaxcodeRoleId;
  binding: RaxcodeRoleBinding;
  profile: RaxcodeProviderProfile;
  authProfile: RaxcodeAuthProfile;
}

export interface RaxcodeResolvedEmbeddingConfig {
  provider: "openai";
  model: RaxcodeEmbeddingConfig["lanceDbModel"];
  baseURL: string;
  apiKey: string;
  dimensions?: number;
  authProfileId: string;
}

export class RaxcodeConfigError extends Error {
  readonly filePath?: string;
  readonly fieldPath?: string;

  constructor(message: string, options: { filePath?: string; fieldPath?: string } = {}) {
    super(message);
    this.name = "RaxcodeConfigError";
    this.filePath = options.filePath;
    this.fieldPath = options.fieldPath;
  }
}

export function isRaxcodeRoleId(value: string): value is RaxcodeRoleId {
  return (RAXCODE_ROLE_IDS as readonly string[]).includes(value);
}

const DEFAULT_UI_CONFIG: RaxcodeUiConfig = {
  language: "zh-CN",
  startupView: "chat",
  defaultAgentsView: "list",
  slashMenuStyle: "ordered",
  toolSummaryStyle: "animated",
};

export const DEFAULT_RAXCODE_UI_CONFIG: RaxcodeUiConfig = {
  ...DEFAULT_UI_CONFIG,
};

export const DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN: RaxcodeLiveChatModelPlan = {
  core: {
    main: {
      model: "gpt-5.4",
      reasoning: "high",
      contextWindowTokens: 1_050_000,
    },
  },
  tap: {
    reviewer: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 1_120_000,
    },
    toolReviewer: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 1_120_000,
    },
    provisioner: {
      model: "gpt-5.4",
      reasoning: "medium",
      maxOutputTokens: 1_120_000,
    },
  },
  mp: {
    icma: {
      model: "gpt-5.4-mini",
      reasoning: "none",
      maxOutputTokens: 1_280_000,
    },
    iterator: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 960_000,
    },
    checker: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 1_120_000,
    },
    dbagent: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 1_120_000,
    },
    dispatcher: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 480_000,
    },
  },
  cmp: {
    icma: {
      model: "gpt-5.4-mini",
      reasoning: "none",
      maxOutputTokens: 1_280_000,
    },
    iterator: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 960_000,
    },
    checker: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 1_120_000,
    },
    dbagent: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 1_120_000,
    },
    dispatcher: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 480_000,
    },
  },
  tui: {
    main: {
      model: "gpt-5.4-mini",
      reasoning: "low",
      contextWindowTokens: 1_050_000,
    },
  },
};

export const DEFAULT_RAXCODE_TAP_OVERRIDE: TaUserOverrideContract = {
  requestedMode: "bapr",
  automationDepth: "prefer_auto",
  explanationStyle: "plain_language",
  toolPolicyOverrides: [],
};

function timestamp(): string {
  return new Date().toISOString();
}

function cloneMatrix(matrix: readonly TapShared15ViewCell[]): TapShared15ViewCell[] {
  return matrix.map((cell) => ({ ...cell }));
}

function buildDefaultMatrix(override = DEFAULT_RAXCODE_TAP_OVERRIDE): TapShared15ViewCell[] {
  return cloneMatrix(createTapGovernanceObject({
    userOverride: override,
  }).shared15ViewMatrix);
}

export function createDefaultRaxcodePermissionsConfig(): RaxcodePermissionsConfig {
  return {
    requestedMode: "bapr",
    automationDepth: "prefer_auto",
    explanationStyle: "plain_language",
    requireHumanOnRiskLevels: [],
    capabilityOverrides: [],
    shared15ViewMatrix: buildDefaultMatrix(),
    persistedAllowRules: [],
  };
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeJsonIfMissing(filePath: string, payload: unknown): boolean {
  if (existsSync(filePath)) {
    return false;
  }
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort only.
  }
  return true;
}

function parseJsonFile<T extends Record<string, unknown>>(filePath: string): T {
  let raw = "";
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new RaxcodeConfigError(
      `无法读取 Raxcode 配置文件: ${filePath}`,
      { filePath },
    );
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("root must be an object");
    }
    return parsed as T;
  } catch (error) {
    throw new RaxcodeConfigError(
      `Raxcode 配置文件不是合法 JSON: ${filePath}${error instanceof Error ? ` (${error.message})` : ""}`,
      { filePath },
    );
  }
}

function makeAuthProfile(
  id: string,
  provider: RaxcodeProviderKind,
  label: string,
  stamp: string,
): RaxcodeAuthProfile {
  return {
    id,
    provider,
    label,
    authMode: "api_key",
    credentials: {
      apiKey: "",
    },
    meta: {
      source: "manual",
      createdAt: stamp,
      updatedAt: stamp,
    },
  };
}

function routePlanForRole(roleId: RaxcodeRoleId): RaxcodeRoutePlan {
  switch (roleId) {
    case "core.main":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.core.main };
    case "tap.reviewer":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.tap.reviewer };
    case "tap.toolReviewer":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.tap.toolReviewer };
    case "tap.provisioner":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.tap.provisioner };
    case "mp.icma":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.mp.icma };
    case "mp.iterator":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.mp.iterator };
    case "mp.checker":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.mp.checker };
    case "mp.dbagent":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.mp.dbagent };
    case "mp.dispatcher":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.mp.dispatcher };
    case "cmp.icma":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.cmp.icma };
    case "cmp.iterator":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.cmp.iterator };
    case "cmp.checker":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.cmp.checker };
    case "cmp.dbagent":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.cmp.dbagent };
    case "cmp.dispatcher":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.cmp.dispatcher };
    case "tui.main":
      return { ...DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN.tui.main };
  }
}

function roleLabel(roleId: RaxcodeRoleId): string {
  return roleId
    .split(".")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function makeRoleProfile(roleId: RaxcodeRoleId): RaxcodeProviderProfile {
  const plan = routePlanForRole(roleId);
  return {
    id: `profile.${roleId}`,
    provider: "openai",
    label: `${roleLabel(roleId)} Default`,
    authProfileId: "auth.openai.default",
    route: {
      baseURL: "https://api.openai.com/v1",
      apiStyle: "responses",
    },
    model: plan.model,
    reasoningEffort: plan.reasoning,
    contextWindowTokens: plan.contextWindowTokens,
    maxOutputTokens: plan.maxOutputTokens,
    enabled: true,
  };
}

function createDefaultAuthFile(): RaxcodeAuthFile {
  const stamp = timestamp();
  return {
    schemaVersion: RAXCODE_SCHEMA_VERSION,
    activeAuthProfileIdBySlot: {
      openai: "auth.openai.default",
      anthropic: "auth.anthropic.default",
      anthropicAlt: "auth.anthropic.alt",
      deepmind: "auth.deepmind.default",
    },
    authProfiles: [
      makeAuthProfile("auth.openai.default", "openai", "OpenAI Default", stamp),
      makeAuthProfile("auth.anthropic.default", "anthropic", "Anthropic Default", stamp),
      makeAuthProfile("auth.anthropic.alt", "anthropic", "Anthropic Alt", stamp),
      makeAuthProfile("auth.deepmind.default", "deepmind", "DeepMind Default", stamp),
    ],
  };
}

function createDefaultConfigFile(fallbackDir = process.cwd()): RaxcodeConfigFile {
  const roleProfiles = RAXCODE_ROLE_IDS.map((roleId) => makeRoleProfile(roleId));
  return {
    schemaVersion: RAXCODE_SCHEMA_VERSION,
    providerSlots: {
      openai: "profile.core.main",
      anthropic: "profile.provider.anthropic.default",
      anthropicAlt: "profile.provider.anthropic.alt",
      deepmind: "profile.provider.deepmind.default",
    },
    profiles: [
      ...roleProfiles,
      {
        id: "profile.provider.anthropic.default",
        provider: "anthropic",
        label: "Anthropic Default",
        authProfileId: "auth.anthropic.default",
        route: {
          baseURL: "https://api.anthropic.com",
          apiStyle: "messages",
        },
        model: "claude-opus-4-6-thinking",
        contextWindowTokens: 200_000,
        enabled: true,
      },
      {
        id: "profile.provider.anthropic.alt",
        provider: "anthropic",
        label: "Anthropic Alt",
        authProfileId: "auth.anthropic.alt",
        route: {
          baseURL: "https://api.anthropic.com",
          apiStyle: "messages",
        },
        model: "claude-opus-4-6-thinking",
        contextWindowTokens: 200_000,
        enabled: true,
      },
      {
        id: "profile.provider.deepmind.default",
        provider: "deepmind",
        label: "DeepMind Default",
        authProfileId: "auth.deepmind.default",
        route: {
          baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
          apiStyle: "generateContent",
        },
        model: "gemini-3.1-pro-preview",
        contextWindowTokens: 1_000_000,
        enabled: true,
      },
    ],
    roleBindings: Object.fromEntries(
      RAXCODE_ROLE_IDS.map((roleId) => [roleId, {
        profileId: `profile.${roleId}`,
        enabled: true,
      } satisfies RaxcodeRoleBinding]),
    ) as Record<RaxcodeRoleId, RaxcodeRoleBinding>,
    embedding: {
      lanceDbModel: "text-embedding-3-large",
      provider: "openai",
    },
    workspace: {
      defaultPath: resolveWorkspaceRoot(fallbackDir),
    },
    ui: {
      ...DEFAULT_UI_CONFIG,
    },
    permissions: {
      ...createDefaultRaxcodePermissionsConfig(),
    },
  };
}

export function ensureRaxcodeHomeScaffold(fallbackDir = process.cwd()): {
  home: string;
  authPath: string;
  configPath: string;
  createdPaths: string[];
} {
  const home = resolveRaxcodeHome(fallbackDir);
  const configRoot = resolveConfigRoot(fallbackDir);
  const stateRoot = resolveStateRoot(fallbackDir);
  const authPath = resolveAuthJsonPath(fallbackDir);
  const configPath = resolveConfigJsonPath(fallbackDir);

  const createdPaths: string[] = [];
  for (const dir of [
    home,
    configRoot,
    stateRoot,
    resolveLogsDir(fallbackDir),
    resolveSessionsDir(fallbackDir),
    resolveCacheDir(fallbackDir),
  ]) {
    const already = existsSync(dir);
    ensureDirectory(dir);
    if (!already) {
      createdPaths.push(dir);
    }
  }
  if (writeJsonIfMissing(authPath, createDefaultAuthFile())) {
    createdPaths.push(authPath);
  }
  if (writeJsonIfMissing(configPath, createDefaultConfigFile(fallbackDir))) {
    createdPaths.push(configPath);
  }
  return {
    home,
    authPath,
    configPath,
    createdPaths,
  };
}

function asRecord(value: unknown, filePath: string, fieldPath: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RaxcodeConfigError(
      `Raxcode 配置字段无效: ${fieldPath}`,
      { filePath, fieldPath },
    );
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, filePath: string, fieldPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RaxcodeConfigError(
      `Raxcode 配置缺少必填字段: ${fieldPath}`,
      { filePath, fieldPath },
    );
  }
  return value.trim();
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asBoolean(value: unknown, defaultValue = true): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function loadAuthProfiles(filePath: string): RaxcodeAuthFile {
  const parsed = parseJsonFile<Record<string, unknown>>(filePath);
  const authProfilesRaw = parsed.authProfiles;
  if (!Array.isArray(authProfilesRaw)) {
    throw new RaxcodeConfigError("Raxcode auth.json 缺少 authProfiles 数组。", {
      filePath,
      fieldPath: "authProfiles",
    });
  }

  const authProfiles = authProfilesRaw.map((entry, index) => {
    const record = asRecord(entry, filePath, `authProfiles[${index}]`);
    const credentials = asRecord(record.credentials, filePath, `authProfiles[${index}].credentials`);
    const metaRecord = asRecord(record.meta ?? {}, filePath, `authProfiles[${index}].meta`);
    const authMode =
      asOptionalString(record.authMode) === "chatgpt_oauth"
      || (
        typeof credentials.accessToken === "string"
        && credentials.accessToken.trim().length > 0
      )
        ? "chatgpt_oauth"
        : "api_key";
    return {
      id: asString(record.id, filePath, `authProfiles[${index}].id`),
      provider: asString(record.provider, filePath, `authProfiles[${index}].provider`) as RaxcodeProviderKind,
      label: asString(record.label, filePath, `authProfiles[${index}].label`),
      authMode,
      credentials: {
        apiKey: typeof credentials.apiKey === "string" ? credentials.apiKey : undefined,
        accessToken: typeof credentials.accessToken === "string" ? credentials.accessToken : undefined,
        refreshToken: typeof credentials.refreshToken === "string" ? credentials.refreshToken : undefined,
        idToken: typeof credentials.idToken === "string" ? credentials.idToken : undefined,
        accountId: typeof credentials.accountId === "string" ? credentials.accountId : undefined,
      },
      meta: {
        source: (asOptionalString(metaRecord.source) ?? "manual") as RaxcodeBootstrapSource,
        createdAt: asOptionalString(metaRecord.createdAt) ?? timestamp(),
        updatedAt: asOptionalString(metaRecord.updatedAt) ?? timestamp(),
        lastUsedAt: asOptionalString(metaRecord.lastUsedAt),
        orgId: asOptionalString(metaRecord.orgId),
        projectId: asOptionalString(metaRecord.projectId),
        accountId: asOptionalString(metaRecord.accountId),
        email: asOptionalString(metaRecord.email),
        chatgptPlanType: asOptionalString(metaRecord.chatgptPlanType),
        chatgptUserId: asOptionalString(metaRecord.chatgptUserId),
        chatgptAccountId: asOptionalString(metaRecord.chatgptAccountId),
        lastRefreshAt: asOptionalString(metaRecord.lastRefreshAt),
        accessTokenExpiresAt: asOptionalString(metaRecord.accessTokenExpiresAt),
        idTokenExpiresAt: asOptionalString(metaRecord.idTokenExpiresAt),
      },
    } satisfies RaxcodeAuthProfile;
  });

  const activeAuthProfileIdBySlot = asRecord(
    parsed.activeAuthProfileIdBySlot ?? {},
    filePath,
    "activeAuthProfileIdBySlot",
  );

  return {
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : RAXCODE_SCHEMA_VERSION,
    activeAuthProfileIdBySlot: Object.fromEntries(
      Object.entries(activeAuthProfileIdBySlot)
        .filter(([, value]) => typeof value === "string" && value.trim().length > 0),
    ) as Partial<Record<RaxcodeProviderSlot, string>>,
    authProfiles,
  };
}

function loadConfigFile(filePath: string): RaxcodeConfigFile {
  const parsed = parseJsonFile<Record<string, unknown>>(filePath);
  const profilesRaw = parsed.profiles;
  if (!Array.isArray(profilesRaw)) {
    throw new RaxcodeConfigError("Raxcode config.json 缺少 profiles 数组。", {
      filePath,
      fieldPath: "profiles",
    });
  }

  const profiles = profilesRaw.map((entry, index) => {
    const record = asRecord(entry, filePath, `profiles[${index}]`);
    const route = asRecord(record.route, filePath, `profiles[${index}].route`);
    return {
      id: asString(record.id, filePath, `profiles[${index}].id`),
      provider: asString(record.provider, filePath, `profiles[${index}].provider`) as RaxcodeProviderKind,
      label: asString(record.label, filePath, `profiles[${index}].label`),
      authProfileId: asString(record.authProfileId, filePath, `profiles[${index}].authProfileId`),
      route: {
        baseURL: asString(route.baseURL, filePath, `profiles[${index}].route.baseURL`),
        apiStyle: asOptionalString(route.apiStyle),
      },
      model: asString(record.model, filePath, `profiles[${index}].model`),
      reasoningEffort: asOptionalString(record.reasoningEffort) as RaxcodeReasoningEffort | undefined,
      contextWindowTokens: asPositiveInteger(record.contextWindowTokens),
      maxOutputTokens: asPositiveInteger(record.maxOutputTokens),
      enabled: asBoolean(record.enabled, true),
    } satisfies RaxcodeProviderProfile;
  });

  const roleBindingsRaw = asRecord(parsed.roleBindings, filePath, "roleBindings");
  const roleBindings = Object.fromEntries(
    RAXCODE_ROLE_IDS.map((roleId) => {
      const rawBinding = asRecord(roleBindingsRaw[roleId], filePath, `roleBindings.${roleId}`);
      const overrides = rawBinding.overrides
        ? asRecord(rawBinding.overrides, filePath, `roleBindings.${roleId}.overrides`)
        : undefined;
      return [roleId, {
        profileId: asString(rawBinding.profileId, filePath, `roleBindings.${roleId}.profileId`),
        enabled: asBoolean(rawBinding.enabled, true),
        overrides: overrides
          ? {
              model: asOptionalString(overrides.model),
              reasoning: asOptionalString(overrides.reasoning) as RaxcodeReasoningEffort | undefined,
              serviceTier: (
                asOptionalString(overrides.serviceTier)
                ?? (asOptionalBoolean(overrides.fastMode) ? "fast" : undefined)
              ) as "fast" | undefined,
              contextWindowTokens: asPositiveInteger(overrides.contextWindowTokens),
              maxOutputTokens: asPositiveInteger(overrides.maxOutputTokens),
            }
          : undefined,
      } satisfies RaxcodeRoleBinding];
    }),
  ) as Record<RaxcodeRoleId, RaxcodeRoleBinding>;

  const workspace = asRecord(parsed.workspace ?? {}, filePath, "workspace");
  const embedding = asRecord(parsed.embedding ?? {}, filePath, "embedding");
  const ui = asRecord(parsed.ui ?? {}, filePath, "ui");
  const permissions = asRecord(parsed.permissions ?? {}, filePath, "permissions");
  const providerSlots = asRecord(parsed.providerSlots ?? {}, filePath, "providerSlots");
  const matrix = Array.isArray(permissions.shared15ViewMatrix)
    ? permissions.shared15ViewMatrix.map((entry, index) => ({
        ...asRecord(entry, filePath, `permissions.shared15ViewMatrix[${index}]`),
      })) as unknown as TapShared15ViewCell[]
    : buildDefaultMatrix();
  const capabilityOverrides = Array.isArray(permissions.capabilityOverrides)
    ? permissions.capabilityOverrides.map((entry, index) => {
        const record = asRecord(entry, filePath, `permissions.capabilityOverrides[${index}]`);
        return {
          capabilitySelector: asString(
            record.capabilitySelector,
            filePath,
            `permissions.capabilityOverrides[${index}].capabilitySelector`,
          ),
          policy: asString(record.policy, filePath, `permissions.capabilityOverrides[${index}].policy`) as TapToolPolicyOverride["policy"],
          reason: asOptionalString(record.reason),
        } satisfies TapToolPolicyOverride;
      })
    : [];
  const persistedAllowRules = Array.isArray(permissions.persistedAllowRules)
    ? permissions.persistedAllowRules.map((entry, index) => {
        const record = asRecord(entry, filePath, `permissions.persistedAllowRules[${index}]`);
        return {
          ruleId: asString(
            record.ruleId,
            filePath,
            `permissions.persistedAllowRules[${index}].ruleId`,
          ),
          agentId: asString(
            record.agentId,
            filePath,
            `permissions.persistedAllowRules[${index}].agentId`,
          ),
          capabilityFamily: "read",
          pathPrefix: asString(
            record.pathPrefix,
            filePath,
            `permissions.persistedAllowRules[${index}].pathPrefix`,
          ),
          createdAt: asString(
            record.createdAt,
            filePath,
            `permissions.persistedAllowRules[${index}].createdAt`,
          ),
          updatedAt: asString(
            record.updatedAt,
            filePath,
            `permissions.persistedAllowRules[${index}].updatedAt`,
          ),
        } satisfies RaxcodePersistedPermissionRule;
      })
    : [];

  return {
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : RAXCODE_SCHEMA_VERSION,
    providerSlots: Object.fromEntries(
      Object.entries(providerSlots)
        .filter(([, value]) => typeof value === "string" && value.trim().length > 0),
    ) as Partial<Record<RaxcodeProviderSlot, string>>,
    profiles,
    roleBindings,
    embedding: {
      lanceDbModel: (asOptionalString(embedding.lanceDbModel) ?? "text-embedding-3-large") as RaxcodeEmbeddingConfig["lanceDbModel"],
      provider: (asOptionalString(embedding.provider) ?? "openai") as RaxcodeEmbeddingConfig["provider"],
      baseURL: asOptionalString(embedding.baseURL),
      authProfileId: asOptionalString(embedding.authProfileId),
      dimensions: asPositiveInteger(embedding.dimensions),
    },
    workspace: {
      defaultPath: asOptionalString(workspace.defaultPath) ?? resolveWorkspaceRoot(),
    },
    ui: {
      language: asOptionalString(ui.language) ?? DEFAULT_UI_CONFIG.language,
      startupView: asOptionalString(ui.startupView) ?? DEFAULT_UI_CONFIG.startupView,
      defaultAgentsView: asOptionalString(ui.defaultAgentsView) ?? DEFAULT_UI_CONFIG.defaultAgentsView,
      slashMenuStyle: asOptionalString(ui.slashMenuStyle) ?? DEFAULT_UI_CONFIG.slashMenuStyle,
      toolSummaryStyle: asOptionalString(ui.toolSummaryStyle) ?? DEFAULT_UI_CONFIG.toolSummaryStyle,
    },
    permissions: {
      ...createDefaultRaxcodePermissionsConfig(),
      requestedMode: (asOptionalString(permissions.requestedMode) ?? "bapr") as TaPoolMode,
      automationDepth: (asOptionalString(permissions.automationDepth) ?? "prefer_auto") as TapAutomationDepth,
      explanationStyle: (asOptionalString(permissions.explanationStyle) ?? "plain_language") as TapUserExplanationStyle,
      requireHumanOnRiskLevels: Array.isArray(permissions.requireHumanOnRiskLevels)
        ? permissions.requireHumanOnRiskLevels.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [],
      capabilityOverrides,
      shared15ViewMatrix: matrix,
      persistedAllowRules,
    },
  };
}

export function loadRaxcodeAuthFile(fallbackDir = process.cwd()): RaxcodeAuthFile {
  ensureRaxcodeHomeScaffold(fallbackDir);
  return loadAuthProfiles(resolveAuthJsonPath(fallbackDir));
}

export function writeRaxcodeAuthFile(
  authFile: RaxcodeAuthFile,
  fallbackDir = process.cwd(),
): void {
  ensureRaxcodeHomeScaffold(fallbackDir);
  const filePath = resolveAuthJsonPath(fallbackDir);
  writeFileSync(filePath, `${JSON.stringify(authFile, null, 2)}\n`, "utf8");
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort only.
  }
}

export function loadRaxcodeConfigFile(fallbackDir = process.cwd()): RaxcodeConfigFile {
  ensureRaxcodeHomeScaffold(fallbackDir);
  return loadConfigFile(resolveConfigJsonPath(fallbackDir));
}

export function writeRaxcodeConfigFile(
  configFile: RaxcodeConfigFile,
  fallbackDir = process.cwd(),
): void {
  ensureRaxcodeHomeScaffold(fallbackDir);
  const filePath = resolveConfigJsonPath(fallbackDir);
  writeFileSync(filePath, `${JSON.stringify(configFile, null, 2)}\n`, "utf8");
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort only.
  }
}

export function resolveConfiguredWorkspaceRoot(fallbackDir = process.cwd()): string {
  return resolveWorkspaceRoot(fallbackDir);
}

function resolveRoleBindingProfile(
  config: RaxcodeConfigFile,
  roleId: RaxcodeRoleId,
): RaxcodeProviderProfile {
  const binding = config.roleBindings[roleId];
  if (!binding) {
    throw new RaxcodeConfigError(`Raxcode config.json 缺少角色绑定: ${roleId}`);
  }
  const profile = config.profiles.find((entry) => entry.id === binding.profileId);
  if (!profile) {
    throw new RaxcodeConfigError(`Raxcode config.json 找不到角色 ${roleId} 绑定的 profile: ${binding.profileId}`);
  }
  return profile;
}

export function loadResolvedRoleConfig(
  roleId: RaxcodeRoleId,
  fallbackDir = process.cwd(),
): RaxcodeResolvedRoleConfig {
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const binding = configFile.roleBindings[roleId];
  if (!binding) {
    throw new RaxcodeConfigError(`Raxcode config.json 缺少角色绑定: ${roleId}`);
  }
  const profile = resolveRoleBindingProfile(configFile, roleId);
  const authProfile = authFile.authProfiles.find((entry) => entry.id === profile.authProfileId);
  if (!authProfile) {
    throw new RaxcodeConfigError(`Raxcode auth.json 找不到角色 ${roleId} 绑定 profile 使用的 auth profile: ${profile.authProfileId}`);
  }
  if (authProfile.provider !== profile.provider) {
    throw new RaxcodeConfigError(
      `Raxcode role/auth 不匹配: ${roleId} 使用了 ${profile.provider} profile，但 auth profile 属于 ${authProfile.provider}`,
    );
  }
  return {
    roleId,
    binding,
    profile,
    authProfile,
  };
}

function resolveRolePlan(
  config: RaxcodeConfigFile,
  roleId: RaxcodeRoleId,
): RaxcodeRoutePlan {
  const binding = config.roleBindings[roleId];
  const profile = resolveRoleBindingProfile(config, roleId);
  return {
    model: binding.overrides?.model ?? profile.model,
    reasoning: binding.overrides?.reasoning ?? profile.reasoningEffort ?? "none",
    serviceTier: binding.overrides?.serviceTier,
    contextWindowTokens: binding.overrides?.contextWindowTokens ?? profile.contextWindowTokens,
    maxOutputTokens: binding.overrides?.maxOutputTokens ?? profile.maxOutputTokens,
  };
}

export function loadRaxcodeRolePlan(
  roleId: RaxcodeRoleId,
  fallbackDir = process.cwd(),
): RaxcodeRoutePlan {
  const config = loadRaxcodeConfigFile(fallbackDir);
  return resolveRolePlan(config, roleId);
}

export function loadRaxcodeLiveChatModelPlan(fallbackDir = process.cwd()): RaxcodeLiveChatModelPlan {
  const config = loadRaxcodeConfigFile(fallbackDir);
  return {
    core: {
      main: resolveRolePlan(config, "core.main"),
    },
    tap: {
      reviewer: resolveRolePlan(config, "tap.reviewer"),
      toolReviewer: resolveRolePlan(config, "tap.toolReviewer"),
      provisioner: resolveRolePlan(config, "tap.provisioner"),
    },
    mp: {
      icma: resolveRolePlan(config, "mp.icma"),
      iterator: resolveRolePlan(config, "mp.iterator"),
      checker: resolveRolePlan(config, "mp.checker"),
      dbagent: resolveRolePlan(config, "mp.dbagent"),
      dispatcher: resolveRolePlan(config, "mp.dispatcher"),
    },
    cmp: {
      icma: resolveRolePlan(config, "cmp.icma"),
      iterator: resolveRolePlan(config, "cmp.iterator"),
      checker: resolveRolePlan(config, "cmp.checker"),
      dbagent: resolveRolePlan(config, "cmp.dbagent"),
      dispatcher: resolveRolePlan(config, "cmp.dispatcher"),
    },
    tui: {
      main: resolveRolePlan(config, "tui.main"),
    },
  };
}

export function loadRaxcodeUiConfig(fallbackDir = process.cwd()): RaxcodeUiConfig {
  return loadRaxcodeConfigFile(fallbackDir).ui;
}

export function loadRaxcodeTapOverride(fallbackDir = process.cwd()): TaUserOverrideContract {
  const permissions = loadRaxcodeConfigFile(fallbackDir).permissions;
  return {
    requestedMode: permissions.requestedMode,
    automationDepth: permissions.automationDepth,
    explanationStyle: permissions.explanationStyle,
    requireHumanOnRiskLevels: permissions.requireHumanOnRiskLevels as TaUserOverrideContract["requireHumanOnRiskLevels"],
    toolPolicyOverrides: permissions.capabilityOverrides,
  };
}

export function loadRaxcodePermissionsConfig(fallbackDir = process.cwd()): RaxcodePermissionsConfig {
  return loadRaxcodeConfigFile(fallbackDir).permissions;
}

export function loadRaxcodeRuntimeConfigSnapshot(
  fallbackDir = process.cwd(),
): RaxcodeRuntimeConfigSnapshot {
  const config = loadRaxcodeConfigFile(fallbackDir);
  return {
    modelPlan: loadRaxcodeLiveChatModelPlan(fallbackDir),
    tapOverride: {
      requestedMode: config.permissions.requestedMode,
      automationDepth: config.permissions.automationDepth,
      explanationStyle: config.permissions.explanationStyle,
      requireHumanOnRiskLevels: config.permissions.requireHumanOnRiskLevels as TaUserOverrideContract["requireHumanOnRiskLevels"],
      toolPolicyOverrides: config.permissions.capabilityOverrides,
    },
    ui: config.ui,
    permissions: config.permissions,
    embedding: config.embedding,
    workspace: config.workspace,
  };
}

export function loadResolvedProviderSlotConfig(
  slot: RaxcodeProviderSlot,
  fallbackDir = process.cwd(),
): RaxcodeResolvedProfile {
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const profileId = configFile.providerSlots[slot];
  if (!profileId) {
    throw new RaxcodeConfigError(`Raxcode config.json 未配置 providerSlots.${slot}`);
  }
  const profile = configFile.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    throw new RaxcodeConfigError(`Raxcode config.json 找不到 providerSlots.${slot} 指向的 profile: ${profileId}`);
  }
  const authId = authFile.activeAuthProfileIdBySlot[slot] ?? profile.authProfileId;
  const authProfile = authFile.authProfiles.find((entry) => entry.id === authId);
  if (!authProfile) {
    throw new RaxcodeConfigError(`Raxcode auth.json 找不到 provider slot ${slot} 使用的 auth profile: ${authId}`);
  }
  if (authProfile.provider !== profile.provider) {
    throw new RaxcodeConfigError(
      `Raxcode provider/auth 不匹配: ${slot} 使用了 ${profile.provider} profile，但 auth profile 属于 ${authProfile.provider}`,
    );
  }
  return {
    slot,
    profile,
    authProfile,
  };
}

export function loadResolvedProviderSlotConfigs(fallbackDir = process.cwd()): {
  openai: RaxcodeResolvedProfile;
  anthropic: RaxcodeResolvedProfile;
  anthropicAlt?: RaxcodeResolvedProfile;
  deepmind: RaxcodeResolvedProfile;
} {
  const config = loadRaxcodeConfigFile(fallbackDir);
  const anthropicAlt = config.providerSlots.anthropicAlt
    ? loadResolvedProviderSlotConfig("anthropicAlt", fallbackDir)
    : undefined;
  return {
    openai: loadResolvedProviderSlotConfig("openai", fallbackDir),
    anthropic: loadResolvedProviderSlotConfig("anthropic", fallbackDir),
    anthropicAlt,
    deepmind: loadResolvedProviderSlotConfig("deepmind", fallbackDir),
  };
}

function normalizeEmbeddingBaseURL(input: string): string {
  const trimmed = input.trim().replace(/\/$/u, "");
  return trimmed.endsWith("/embeddings")
    ? trimmed.slice(0, -"/embeddings".length)
    : trimmed;
}

export function loadResolvedEmbeddingConfig(
  fallbackDir = process.cwd(),
): RaxcodeResolvedEmbeddingConfig | null {
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const provider = configFile.embedding.provider ?? "openai";
  const baseURL = configFile.embedding.baseURL?.trim();
  const authProfileId = configFile.embedding.authProfileId?.trim();
  if (provider !== "openai" || !baseURL || !authProfileId) {
    return null;
  }
  const authProfile = authFile.authProfiles.find((entry) => entry.id === authProfileId);
  if (!authProfile) {
    throw new RaxcodeConfigError(`Raxcode auth.json 找不到 embedding 使用的 auth profile: ${authProfileId}`);
  }
  if (authProfile.provider !== "openai") {
    throw new RaxcodeConfigError(`Embedding auth profile 必须属于 openai provider: ${authProfileId}`);
  }
  const apiKey = authProfile.credentials.apiKey?.trim();
  if (!apiKey) {
    throw new RaxcodeConfigError(`Embedding auth profile 缺少 apiKey: ${authProfileId}`);
  }
  return {
    provider: "openai",
    model: configFile.embedding.lanceDbModel,
    baseURL: normalizeEmbeddingBaseURL(baseURL),
    apiKey,
    dimensions: configFile.embedding.dimensions,
    authProfileId,
  };
}
