import { readFileSync } from "node:fs";

import OpenAI from "openai";

import {
  isRaxcodeRoleId,
  loadRaxcodeRolePlan,
  loadResolvedRoleConfig,
  loadResolvedProviderSlotConfigs,
  type RaxcodeResolvedProfile,
  RaxcodeConfigError,
} from "../raxcode-config.js";
import {
  resolveAuthJsonPath,
  resolveConfigJsonPath,
} from "../runtime-paths.js";

export interface OpenAILiveConfig {
  authMode: "api_key" | "chatgpt_oauth";
  apiKey: string;
  baseURL: string;
  apiStyle?: string;
  model: string;
  reasoningEffort?: string;
  contextWindowTokens?: number;
  accountId?: string;
  defaultHeaders?: Record<string, string>;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  planType?: string;
}

export const CHATGPT_BACKEND_CLIENT_VERSION = "0.118.0";

export type OpenAIGenerationVariant = "responses" | "chat_completions_compat";
export type ProviderGenerationVariant = OpenAIGenerationVariant | "messages" | "generateContent";

export interface AnthropicLiveConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  reasoningEffort?: string;
  contextWindowTokens?: number;
}

export interface DeepMindLiveConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  contextWindowTokens?: number;
}

export interface LiveProviderConfig {
  openai: OpenAILiveConfig;
  anthropic: AnthropicLiveConfig;
  anthropicAlt?: AnthropicLiveConfig;
  deepmind: DeepMindLiveConfig;
}

function normalizeOpenAIBaseURL(input: string): string {
  const url = new URL(input);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/v1";
  }
  return url.toString().replace(/\/$/u, "");
}

export function isChatgptCodexBackendBaseURL(baseURL: string): boolean {
  return /chatgpt\.com\/backend-api\/codex\/?$/iu.test(baseURL.trim());
}

export function isGmnOpenAIGatewayBaseURL(baseURL: string): boolean {
  return /^https:\/\/gmn\.chuangzuoli\.com(?:\/v1)?\/?$/iu.test(baseURL.trim());
}

function usesPriorityServiceTierWireValue(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL">,
): boolean {
  return (
    (isChatgptCodexBackendBaseURL(config.baseURL) && config.authMode === "chatgpt_oauth")
    || isGmnOpenAIGatewayBaseURL(config.baseURL)
  );
}

export function resolveOpenAIGenerationVariant(
  config: Pick<OpenAILiveConfig, "baseURL" | "apiStyle">,
): OpenAIGenerationVariant {
  const apiStyle = config.apiStyle?.trim().toLowerCase();
  if (apiStyle === "responses") {
    return "responses";
  }
  if (
    apiStyle === "chat_completions"
    || apiStyle === "chat/completions"
    || apiStyle === "chat_completions_compat"
    || apiStyle === "chat-completions"
  ) {
    return "chat_completions_compat";
  }
  if (isChatgptCodexBackendBaseURL(config.baseURL)) {
    return "responses";
  }
  return "chat_completions_compat";
}

export function resolveProviderGenerationVariant(input: {
  provider: "openai" | "anthropic" | "deepmind";
  baseURL: string;
  apiStyle?: string;
}): ProviderGenerationVariant {
  if (input.provider === "openai") {
    return resolveOpenAIGenerationVariant({
      baseURL: input.baseURL,
      apiStyle: input.apiStyle,
    });
  }
  if (input.provider === "anthropic") {
    return "messages";
  }
  return "generateContent";
}

export function mapOpenAIServiceTierForRequest(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL">,
  serviceTier?: string,
): string | undefined {
  if (!serviceTier) {
    return undefined;
  }
  if (usesPriorityServiceTierWireValue(config)) {
    return serviceTier === "fast" ? "priority" : serviceTier;
  }
  return serviceTier;
}

export function normalizeResponsesInputForChatgptCodexBackend(
  input: string | Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input;
  }
  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: input,
        },
      ],
    },
  ];
}

export function prepareResponsesParamsForOpenAIAuth(
  config: Pick<OpenAILiveConfig, "authMode" | "baseURL">,
  params: Record<string, unknown>,
  fallbackInstructions?: string,
): Record<string, unknown> {
  const mappedServiceTier = mapOpenAIServiceTierForRequest(
    config,
    typeof params.service_tier === "string" ? params.service_tier : undefined,
  );
  if (!isChatgptCodexBackendBaseURL(config.baseURL) || config.authMode !== "chatgpt_oauth") {
    return mappedServiceTier === params.service_tier
      ? params
      : {
          ...params,
          service_tier: mappedServiceTier,
        };
  }
  const { max_output_tokens: _maxOutputTokens, ...rest } = params;
  const normalizedInput = normalizeResponsesInputForChatgptCodexBackend(
    Array.isArray(rest.input) || typeof rest.input === "string"
      ? rest.input as string | Array<Record<string, unknown>>
      : fallbackInstructions ?? "",
  );
  return {
    ...rest,
    service_tier: mappedServiceTier,
    instructions: typeof rest.instructions === "string" && rest.instructions.trim().length > 0
      ? rest.instructions
      : (fallbackInstructions ?? ""),
    input: normalizedInput,
    store: false,
    stream: true,
  };
}

function parseEnvFile(filePath: string): Record<string, string> {
  let contents = "";
  try {
    contents = readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
  const variables: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    variables[key] = value;
  }

  return variables;
}

function mergeProcessEnv(values: Record<string, string>): Record<string, string> {
  const merged = { ...values };

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.length > 0) {
      merged[key] = value;
    }
  }

  return merged;
}

function requireField(source: Record<string, string>, field: string): string {
  const value = source[field];
  if (!value) {
    if (process.env.PRAXIS_LIVE_ENV_FILE) {
      throw new RaxcodeConfigError(`显式环境配置缺少必填字段: ${field}`);
    }
    throw new RaxcodeConfigError(
      `Raxcode 全局配置未完成，缺少 ${field}。请编辑 ${resolveAuthJsonPath()} 和 ${resolveConfigJsonPath()}。`,
      { fieldPath: field },
    );
  }
  return value;
}

function readPositiveIntegerField(source: Record<string, string>, field: string): number | undefined {
  const raw = source[field];
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function applyResolvedProfileValues(
  values: Record<string, string>,
  profile: Pick<RaxcodeResolvedProfile, "profile" | "authProfile">,
  prefix: "OPENAI" | "ANTHROPIC" | "ANTHROPIC_ALT" | "DEEPMIND",
): void {
  if (prefix === "OPENAI") {
    values.OPENAI_AUTH_MODE = profile.authProfile.authMode;
    if (profile.authProfile.authMode === "chatgpt_oauth") {
      values.OPENAI_ACCESS_TOKEN = profile.authProfile.credentials.accessToken ?? "";
      values.OPENAI_REFRESH_TOKEN = profile.authProfile.credentials.refreshToken ?? "";
      values.OPENAI_ID_TOKEN = profile.authProfile.credentials.idToken ?? "";
      values.OPENAI_ACCOUNT_ID =
        profile.authProfile.credentials.accountId
        ?? profile.authProfile.meta.chatgptAccountId
        ?? profile.authProfile.meta.accountId
        ?? "";
      if (profile.authProfile.meta.chatgptPlanType) {
        values.OPENAI_PLAN_TYPE = profile.authProfile.meta.chatgptPlanType;
      }
    } else {
      values.OPENAI_API_KEY = profile.authProfile.credentials.apiKey ?? "";
    }
  } else {
    values[`${prefix}_API_KEY`] = profile.authProfile.credentials.apiKey ?? "";
  }
  values[`${prefix}_BASE_URL`] = profile.profile.route.baseURL;
  if (prefix !== "OPENAI") {
    values[`${prefix}_MODEL`] = profile.profile.model;
    if (profile.profile.reasoningEffort) {
      values[`${prefix}_REASONING_EFFORT`] = profile.profile.reasoningEffort;
    }
    if (typeof profile.profile.contextWindowTokens === "number") {
      values[`${prefix}_CONTEXT_WINDOW_TOKENS`] = String(profile.profile.contextWindowTokens);
    }
  } else if (profile.profile.route.apiStyle) {
    values.OPENAI_API_STYLE = profile.profile.route.apiStyle;
  }
}

function readJsonProviderValues(startDir = process.cwd()): Record<string, string> {
  const resolved = loadResolvedProviderSlotConfigs(startDir);
  const values: Record<string, string> = {};
  applyResolvedProfileValues(values, resolved.openai, "OPENAI");
  applyResolvedProfileValues(values, resolved.anthropic, "ANTHROPIC");
  if (resolved.anthropicAlt) {
    applyResolvedProfileValues(values, resolved.anthropicAlt, "ANTHROPIC_ALT");
  }
  applyResolvedProfileValues(values, resolved.deepmind, "DEEPMIND");
  return values;
}

function readJsonOpenAIRoleValues(
  roleId: Parameters<typeof loadRaxcodeRolePlan>[0],
  startDir = process.cwd(),
): Record<string, string> {
  const resolved = loadResolvedRoleConfig(roleId, startDir);
  if (resolved.profile.provider !== "openai") {
    throw new RaxcodeConfigError(
      `角色 ${roleId} 当前 provider 为 ${resolved.profile.provider}，不能按 OpenAI live config 读取。`,
    );
  }
  const values: Record<string, string> = {};
  applyResolvedProfileValues(values, resolved, "OPENAI");
  return values;
}

function readMergedLiveValues(
  envPath?: string,
): Record<string, string> {
  const explicitEnvPath = envPath ?? process.env.PRAXIS_LIVE_ENV_FILE;
  const baseValues = explicitEnvPath
    ? parseEnvFile(explicitEnvPath)
    : readJsonProviderValues();
  return mergeProcessEnv(baseValues);
}

function readMergedOpenAILiveValues(
  roleId: Parameters<typeof loadRaxcodeRolePlan>[0],
  envPath?: string,
): Record<string, string> {
  const explicitEnvPath = envPath ?? process.env.PRAXIS_LIVE_ENV_FILE;
  const baseValues = explicitEnvPath
    ? parseEnvFile(explicitEnvPath)
    : readJsonOpenAIRoleValues(roleId);
  return mergeProcessEnv(baseValues);
}

function normalizeOpenAIConfigArgs(
  roleOrEnvPath?: Parameters<typeof loadRaxcodeRolePlan>[0] | string,
  envPath?: string,
): { roleId: Parameters<typeof loadRaxcodeRolePlan>[0]; envPath?: string } {
  if (typeof roleOrEnvPath === "string" && isRaxcodeRoleId(roleOrEnvPath)) {
    return {
      roleId: roleOrEnvPath,
      envPath,
    };
  }
  if (
    typeof roleOrEnvPath === "string"
    && (roleOrEnvPath.includes("/") || roleOrEnvPath.includes("\\") || roleOrEnvPath.endsWith(".env"))
  ) {
    return {
      roleId: "core.main",
      envPath: roleOrEnvPath,
    };
  }
  return {
    roleId: (roleOrEnvPath as Parameters<typeof loadRaxcodeRolePlan>[0] | undefined) ?? "core.main",
    envPath,
  };
}

export function loadOpenAILiveConfig(
  roleOrEnvPath?: Parameters<typeof loadRaxcodeRolePlan>[0] | string,
  envPath?: string,
): OpenAILiveConfig {
  const normalizedArgs = normalizeOpenAIConfigArgs(roleOrEnvPath, envPath);
  const values = readMergedOpenAILiveValues(normalizedArgs.roleId, normalizedArgs.envPath);
  const rolePlan = loadRaxcodeRolePlan(normalizedArgs.roleId);
  return buildOpenAILiveConfig(values, rolePlan);
}

function buildOpenAILiveConfig(
  values: Record<string, string>,
  rolePlan: ReturnType<typeof loadRaxcodeRolePlan>,
): OpenAILiveConfig {
  const authMode = values.OPENAI_AUTH_MODE === "chatgpt_oauth" ? "chatgpt_oauth" : "api_key";
  if (authMode === "chatgpt_oauth") {
    const accessToken = requireField(values, "OPENAI_ACCESS_TOKEN");
    const accountId = requireField(values, "OPENAI_ACCOUNT_ID");
    return {
      authMode,
      apiKey: accessToken,
      accessToken,
      refreshToken: values.OPENAI_REFRESH_TOKEN,
      idToken: values.OPENAI_ID_TOKEN,
      accountId,
      defaultHeaders: {
        "chatgpt-account-id": accountId,
      },
      baseURL: normalizeOpenAIBaseURL(requireField(values, "OPENAI_BASE_URL")),
      apiStyle: values.OPENAI_API_STYLE,
      model: values.OPENAI_MODEL ?? rolePlan.model,
      reasoningEffort: values.OPENAI_REASONING_EFFORT ?? rolePlan.reasoning,
      contextWindowTokens: readPositiveIntegerField(values, "OPENAI_CONTEXT_WINDOW_TOKENS") ?? rolePlan.contextWindowTokens,
      planType: values.OPENAI_PLAN_TYPE,
    };
  }
  return {
    authMode,
    apiKey: requireField(values, "OPENAI_API_KEY"),
    baseURL: normalizeOpenAIBaseURL(requireField(values, "OPENAI_BASE_URL")),
    apiStyle: values.OPENAI_API_STYLE,
    model: values.OPENAI_MODEL ?? rolePlan.model,
    reasoningEffort: values.OPENAI_REASONING_EFFORT ?? rolePlan.reasoning,
    contextWindowTokens: readPositiveIntegerField(values, "OPENAI_CONTEXT_WINDOW_TOKENS") ?? rolePlan.contextWindowTokens,
  };
}

export function loadLiveProviderConfig(
  envPath?: string,
): LiveProviderConfig {
  const values = readMergedLiveValues(envPath);

  const anthropicAltConfigured =
    values.ANTHROPIC_ALT_API_KEY !== undefined &&
    values.ANTHROPIC_ALT_BASE_URL !== undefined &&
    values.ANTHROPIC_ALT_MODEL !== undefined;

  return {
    openai: {
      ...buildOpenAILiveConfig(values, loadRaxcodeRolePlan("core.main")),
    },
    anthropic: {
      apiKey: requireField(values, "ANTHROPIC_API_KEY"),
      baseURL: requireField(values, "ANTHROPIC_BASE_URL"),
      model: requireField(values, "ANTHROPIC_MODEL"),
      reasoningEffort: values.ANTHROPIC_REASONING_EFFORT,
      contextWindowTokens: readPositiveIntegerField(values, "ANTHROPIC_CONTEXT_WINDOW_TOKENS"),
    },
    anthropicAlt: anthropicAltConfigured
      ? {
          apiKey: requireField(values, "ANTHROPIC_ALT_API_KEY"),
          baseURL: requireField(values, "ANTHROPIC_ALT_BASE_URL"),
          model: requireField(values, "ANTHROPIC_ALT_MODEL"),
          reasoningEffort: values.ANTHROPIC_ALT_REASONING_EFFORT,
          contextWindowTokens: readPositiveIntegerField(values, "ANTHROPIC_ALT_CONTEXT_WINDOW_TOKENS"),
        }
      : undefined,
    deepmind: {
      apiKey: requireField(values, "DEEPMIND_API_KEY"),
      baseURL: requireField(values, "DEEPMIND_BASE_URL"),
      model: requireField(values, "DEEPMIND_MODEL"),
      contextWindowTokens: readPositiveIntegerField(values, "DEEPMIND_CONTEXT_WINDOW_TOKENS"),
    }
  };
}

export function createOpenAIClient(
  config: Pick<OpenAILiveConfig, "apiKey" | "baseURL" | "defaultHeaders"> = loadOpenAILiveConfig(),
): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
    defaultQuery: isChatgptCodexBackendBaseURL(config.baseURL)
      ? { client_version: CHATGPT_BACKEND_CLIENT_VERSION }
      : undefined,
  });
}
