import { createInterface, type Interface as ReadlineInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  OPENAI_OFFICIAL_AUTH_PROFILE_ID,
  OPENAI_OFFICIAL_BASE_URL,
  loginOpenAIWithBrowser,
} from "./raxcode-openai-auth.js";
import { loadOpenAILiveConfig } from "./rax/live-config.js";
import {
  type RaxcodeAuthFile,
  type RaxcodeAuthProfile,
  type RaxcodeConfigFile,
  type RaxcodeProviderKind,
  RAXCODE_ROLE_IDS,
  loadRaxcodeAuthFile,
  loadRaxcodeConfigFile,
  loadResolvedEmbeddingConfig,
  writeRaxcodeAuthFile,
  writeRaxcodeConfigFile,
} from "./raxcode-config.js";
import {
  EMBEDDING_MODEL_CATALOG,
  listAvailableChatModels,
  probeEmbeddingModelAvailability,
} from "./agent_core/tui-input/model-catalog.js";

const OPENAI_DEFAULT_AUTH_PROFILE_ID = "auth.openai.default";
const OPENAI_EMBEDDING_AUTH_PROFILE_ID = "auth.openai.embedding.default";
const ANTHROPIC_DEFAULT_AUTH_PROFILE_ID = "auth.anthropic.default";

type LoginMethod = "chatgpt_subscription" | "openai_compatible_api" | "anthropic_api";
export type OpenAICompatibleRouteKind = "gpt_compatible" | "gemini_compatible";

interface OpenAICompatibleFormState {
  baseURL: string;
  apiKey: string;
}

interface AnthropicFormState {
  baseURL: string;
  apiKey: string;
}

interface EmbeddingFormState {
  baseURL: string;
  apiKey: string;
}

interface LoginWizardResult {
  method: LoginMethod;
  chatModelsStatus: "ready" | "failed" | "skipped";
  embeddingStatus: "ready" | "failed" | "skipped";
  chatModelCount: number;
  embeddingModelCount: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/gu, "\n");
}

function clearScreen(): void {
  if (output.isTTY) {
    output.write("\u001Bc");
  }
}

function writeScreen(lines: string[]): void {
  clearScreen();
  output.write(`${lines.join("\n")}\n`);
}

export function maskSecretForDisplay(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 11) {
    return `${trimmed.slice(0, Math.min(7, trimmed.length))}${"*".repeat(Math.max(0, trimmed.length - Math.min(7, trimmed.length)))}`;
  }
  const visiblePrefix = trimmed.slice(0, 7);
  const visibleSuffix = trimmed.slice(-4);
  return `${visiblePrefix}${"*".repeat(Math.max(0, trimmed.length - 11))}${visibleSuffix}`;
}

export function normalizeOpenAICompatibleBaseURL(inputValue: string): string {
  const trimmed = inputValue.trim().replace(/\/$/u, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.endsWith("/v1/responses")) {
    return trimmed.slice(0, -"/responses".length);
  }
  if (trimmed.endsWith("/responses")) {
    return trimmed.slice(0, -"/responses".length);
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

export function normalizeGeminiCompatibleBaseURL(inputValue: string): string {
  const trimmed = inputValue.trim().replace(/\/$/u, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.endsWith("/v1/chat/completions")) {
    return trimmed.slice(0, -"/chat/completions".length);
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed.slice(0, -"/chat/completions".length);
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

export function normalizeAnthropicBaseURL(inputValue: string): string {
  const trimmed = inputValue.trim().replace(/\/$/u, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.endsWith("/v1/messages")) {
    return trimmed.slice(0, -"/v1/messages".length);
  }
  if (trimmed.endsWith("/messages")) {
    return trimmed.slice(0, -"/messages".length);
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -"/v1".length);
  }
  return trimmed;
}

export function normalizeEmbeddingBaseURL(inputValue: string): string {
  const trimmed = inputValue.trim().replace(/\/$/u, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.endsWith("/v1/embeddings")) {
    return trimmed.slice(0, -"/embeddings".length);
  }
  if (trimmed.endsWith("/embeddings")) {
    return trimmed.slice(0, -"/embeddings".length);
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

function upsertAuthProfile(authFile: RaxcodeAuthFile, profile: RaxcodeAuthProfile): void {
  const index = authFile.authProfiles.findIndex((entry) => entry.id === profile.id);
  if (index === -1) {
    authFile.authProfiles.push(profile);
    return;
  }
  authFile.authProfiles[index] = profile;
}

function createApiKeyAuthProfile(
  id: string,
  provider: RaxcodeProviderKind,
  label: string,
  apiKey: string,
  source: "manual" | "import" = "manual",
  previous?: RaxcodeAuthProfile,
): RaxcodeAuthProfile {
  const stamp = nowIso();
  return {
    id,
    provider,
    label,
    authMode: "api_key",
    credentials: {
      apiKey: apiKey.trim(),
    },
    meta: {
      source,
      createdAt: previous?.meta.createdAt ?? stamp,
      updatedAt: stamp,
      lastUsedAt: stamp,
      orgId: previous?.meta.orgId,
      projectId: previous?.meta.projectId,
      accountId: previous?.meta.accountId,
      email: previous?.meta.email,
      chatgptPlanType: previous?.meta.chatgptPlanType,
      chatgptUserId: previous?.meta.chatgptUserId,
      chatgptAccountId: previous?.meta.chatgptAccountId,
      lastRefreshAt: previous?.meta.lastRefreshAt,
      accessTokenExpiresAt: previous?.meta.accessTokenExpiresAt,
      idTokenExpiresAt: previous?.meta.idTokenExpiresAt,
    },
  };
}

function applyOpenAIRouteToAllRoles(
  configFile: RaxcodeConfigFile,
  options: {
    authProfileId: string;
    baseURL: string;
    labelPrefix: string;
    apiStyle: string;
    defaultModel?: string;
  },
): void {
  for (const roleId of RAXCODE_ROLE_IDS) {
    const binding = configFile.roleBindings[roleId];
    if (!binding) {
      continue;
    }
    const profileId = configFile.roleBindings[roleId]?.profileId;
    if (!profileId) {
      continue;
    }
    const profile = configFile.profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      continue;
    }
    profile.provider = "openai";
    profile.authProfileId = options.authProfileId;
    profile.route = {
      baseURL: options.baseURL,
      apiStyle: options.apiStyle,
    };
    if (options.defaultModel) {
      profile.model = options.defaultModel;
    }
    if (options.apiStyle === "chat/completions") {
      profile.reasoningEffort = undefined;
      binding.overrides = {
        ...binding.overrides,
        reasoning: undefined,
        serviceTier: undefined,
      };
    }
    profile.enabled = true;
    profile.label = `${options.labelPrefix} ${roleId}`;
  }
}

export function applyOpenAICompatibleApiLoginConfig(
  baseURL: string,
  apiKey: string,
  fallbackDir = process.cwd(),
  options: {
    routeKind?: OpenAICompatibleRouteKind;
  } = {},
): void {
  const routeKind = options.routeKind ?? "gpt_compatible";
  const normalizedBaseURL = routeKind === "gemini_compatible"
    ? normalizeGeminiCompatibleBaseURL(baseURL)
    : normalizeOpenAICompatibleBaseURL(baseURL);
  if (!normalizedBaseURL || !apiKey.trim()) {
    throw new Error("OpenAI compatible configuration requires both base URL and API key.");
  }
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const existing = authFile.authProfiles.find((entry) => entry.id === OPENAI_DEFAULT_AUTH_PROFILE_ID);
  upsertAuthProfile(authFile, createApiKeyAuthProfile(
    OPENAI_DEFAULT_AUTH_PROFILE_ID,
    "openai",
    "OpenAI Compatible Default",
    apiKey,
    "manual",
    existing,
  ));
  authFile.activeAuthProfileIdBySlot.openai = OPENAI_DEFAULT_AUTH_PROFILE_ID;
  applyOpenAIRouteToAllRoles(configFile, {
    authProfileId: OPENAI_DEFAULT_AUTH_PROFILE_ID,
    baseURL: normalizedBaseURL,
    labelPrefix: routeKind === "gemini_compatible" ? "Gemini Compatible" : "OpenAI Compatible",
    apiStyle: routeKind === "gemini_compatible" ? "chat/completions" : "responses",
    defaultModel: routeKind === "gemini_compatible" ? "gemini-3.1-pro-preview" : undefined,
  });
  configFile.providerSlots.openai = configFile.roleBindings["core.main"]?.profileId ?? "profile.core.main";
  writeRaxcodeAuthFile(authFile, fallbackDir);
  writeRaxcodeConfigFile(configFile, fallbackDir);
}

export function applyChatGptSubscriptionRoleRouting(
  fallbackDir = process.cwd(),
): void {
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  applyOpenAIRouteToAllRoles(configFile, {
    authProfileId: OPENAI_OFFICIAL_AUTH_PROFILE_ID,
    baseURL: OPENAI_OFFICIAL_BASE_URL,
    labelPrefix: "OpenAI Official",
    apiStyle: "responses",
  });
  writeRaxcodeConfigFile(configFile, fallbackDir);
}

export function applyAnthropicEndpointLoginConfig(
  baseURL: string,
  apiKey: string,
  fallbackDir = process.cwd(),
): void {
  const normalizedBaseURL = normalizeAnthropicBaseURL(baseURL);
  if (!normalizedBaseURL || !apiKey.trim()) {
    throw new Error("Anthropic endpoint configuration requires both base URL and API key.");
  }
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const existing = authFile.authProfiles.find((entry) => entry.id === ANTHROPIC_DEFAULT_AUTH_PROFILE_ID);
  upsertAuthProfile(authFile, createApiKeyAuthProfile(
    ANTHROPIC_DEFAULT_AUTH_PROFILE_ID,
    "anthropic",
    "Anthropic Endpoint Default",
    apiKey,
    "manual",
    existing,
  ));
  authFile.activeAuthProfileIdBySlot.anthropic = ANTHROPIC_DEFAULT_AUTH_PROFILE_ID;
  const profile = configFile.profiles.find((entry) => entry.id === "profile.provider.anthropic.default");
  if (profile) {
    profile.authProfileId = ANTHROPIC_DEFAULT_AUTH_PROFILE_ID;
    profile.route = {
      baseURL: normalizedBaseURL,
      apiStyle: "messages",
    };
    profile.model = "claude-sonnet-4-6";
    profile.enabled = true;
  }
  configFile.providerSlots.anthropic = "profile.provider.anthropic.default";
  for (const roleId of RAXCODE_ROLE_IDS) {
    const binding = configFile.roleBindings[roleId];
    const profileId = binding?.profileId;
    if (!profileId) {
      continue;
    }
    const roleProfile = configFile.profiles.find((entry) => entry.id === profileId);
    if (!roleProfile) {
      continue;
    }
    roleProfile.provider = "anthropic";
    roleProfile.authProfileId = ANTHROPIC_DEFAULT_AUTH_PROFILE_ID;
    roleProfile.route = {
      baseURL: normalizedBaseURL,
      apiStyle: "messages",
    };
    roleProfile.model = "claude-sonnet-4-6";
    binding.overrides = {
      ...binding?.overrides,
      serviceTier: undefined,
    };
    roleProfile.enabled = true;
    roleProfile.label = `Anthropic Compatible ${roleId}`;
  }
  writeRaxcodeAuthFile(authFile, fallbackDir);
  writeRaxcodeConfigFile(configFile, fallbackDir);
}

export function applyEmbeddingLoginConfig(
  embedding: EmbeddingFormState | null,
  fallbackDir = process.cwd(),
): void {
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  if (!embedding || (!embedding.baseURL.trim() && !embedding.apiKey.trim())) {
    configFile.embedding.baseURL = undefined;
    configFile.embedding.authProfileId = undefined;
    writeRaxcodeConfigFile(configFile, fallbackDir);
    return;
  }
  const normalizedBaseURL = normalizeEmbeddingBaseURL(embedding.baseURL);
  if (!normalizedBaseURL || !embedding.apiKey.trim()) {
    throw new Error("Embedding configuration requires both base URL and API key.");
  }
  const existing = authFile.authProfiles.find((entry) => entry.id === OPENAI_EMBEDDING_AUTH_PROFILE_ID);
  upsertAuthProfile(authFile, createApiKeyAuthProfile(
    OPENAI_EMBEDDING_AUTH_PROFILE_ID,
    "openai",
    "Embedding Upstream",
    embedding.apiKey,
    "manual",
    existing,
  ));
  configFile.embedding.provider = "openai";
  configFile.embedding.baseURL = normalizedBaseURL;
  configFile.embedding.authProfileId = OPENAI_EMBEDDING_AUTH_PROFILE_ID;
  if (!configFile.embedding.lanceDbModel) {
    configFile.embedding.lanceDbModel = "text-embedding-3-large";
  }
  writeRaxcodeAuthFile(authFile, fallbackDir);
  writeRaxcodeConfigFile(configFile, fallbackDir);
}

export async function listAvailableAnthropicModels(baseURL: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${normalizeAnthropicBaseURL(baseURL).replace(/\/$/u, "")}/v1/models`, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to load Anthropic models: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as { data?: Array<{ id?: string }> };
  return (payload.data ?? [])
    .map((entry) => entry.id?.trim())
    .filter((entry): entry is string => Boolean(entry));
}

function buildLoginSummaryScreen(result: LoginWizardResult): string[] {
  return [
    "Raxode Login Complete",
    "",
    `Chat provider: ${result.method === "chatgpt_subscription" ? "ChatGPT subscription" : result.method === "openai_compatible_api" ? "OpenAI compatible api key" : "Anthropic Endpoint api key"}`,
    `chat models: ${result.chatModelsStatus}${result.chatModelCount > 0 ? ` (${result.chatModelCount})` : ""}`,
    `embedding models: ${result.embeddingStatus}${result.embeddingModelCount > 0 ? ` (${result.embeddingModelCount})` : ""}`,
    "",
    "press ENTER to finish",
  ];
}

async function promptSecret(promptLabel: string): Promise<string> {
  if (!input.isTTY) {
    throw new Error("Secret input requires an interactive terminal.");
  }
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const restoreRawMode = input.isRaw;
    const cleanup = () => {
      input.off("data", onData);
      if (!restoreRawMode) {
        input.setRawMode(false);
      }
    };
    const render = () => {
      output.write(`\r${promptLabel}${maskSecretForDisplay(value)}\u001B[K`);
    };
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        cleanup();
        reject(new Error("Login cancelled."));
        return;
      }
      if (text === "\r" || text === "\n") {
        output.write("\n");
        cleanup();
        resolve(value.trim());
        return;
      }
      if (text === "\u007F" || text === "\b" || text === "\x1b[3~") {
        value = value.slice(0, -1);
        render();
        return;
      }
      if (text >= " " && text !== "\u001b") {
        value += normalizeLineEndings(text);
        render();
      }
    };
    if (!restoreRawMode) {
      input.setRawMode(true);
    }
    input.on("data", onData);
    render();
  });
}

async function promptLine(rl: ReadlineInterface, promptLabel: string): Promise<string> {
  return (await rl.question(promptLabel)).trim();
}

async function promptSelection(rl: ReadlineInterface): Promise<LoginMethod> {
  writeScreen([
    "Raxode Login",
    "",
    "Choose how you want to connect your model service.",
    "",
    "1. Login with ChatGPT subscription",
    "2. Use OpenAI compatible api key",
    "3. Use Anthropic Endpoint api key",
    "",
    "type 1, 2, or 3 and press ENTER",
    "press Ctrl+C to cancel",
  ]);
  while (true) {
    const selected = await promptLine(rl, "Selection: ");
    if (selected === "1") {
      return "chatgpt_subscription";
    }
    if (selected === "2") {
      return "openai_compatible_api";
    }
    if (selected === "3") {
      return "anthropic_api";
    }
  }
}

async function promptOpenAICompatibleForm(rl: ReadlineInterface): Promise<OpenAICompatibleFormState> {
  writeScreen([
    "GPT Compatible Model Configuration",
    "",
    "openai_compatible_format_base_url: [                         ] /v1/responses",
    "secret-api-key:                  [ sk-abc1****************7890 ]",
    "",
    "type each value and press ENTER",
  ]);
  const baseURL = await promptLine(rl, "openai_compatible_format_base_url: ");
  rl.pause();
  const apiKey = await promptSecret("secret-api-key: ");
  rl.resume();
  return { baseURL, apiKey };
}

async function promptAnthropicForm(rl: ReadlineInterface): Promise<AnthropicFormState> {
  writeScreen([
    "Anthropic Endpoint Model Configuration",
    "",
    "anthropic_format_base_url: [                         ] /v1/messages",
    "secret-api-key:            [ sk-ant****************7890 ]",
    "",
    "type each value and press ENTER",
  ]);
  const baseURL = await promptLine(rl, "anthropic_format_base_url: ");
  rl.pause();
  const apiKey = await promptSecret("secret-api-key: ");
  rl.resume();
  return { baseURL, apiKey };
}

async function promptEmbeddingForm(rl: ReadlineInterface): Promise<EmbeddingFormState | null> {
  writeScreen([
    "Embedding Model Configuration",
    "",
    "openai_embedding_format_base_url: [                         ] /v1/embeddings",
    "secret-api-key:                   [ sk-emb****************7890 ]",
    "",
    "Leave blank to skip, but the Memory Pool feature cannot be used.",
    "",
    "type each value and press ENTER",
  ]);
  const baseURL = await promptLine(rl, "openai_embedding_format_base_url: ");
  let apiKey = "";
  if (baseURL.trim().length > 0) {
    rl.pause();
    apiKey = await promptSecret("secret-api-key: ");
    rl.resume();
  }
  if (!baseURL.trim() && !apiKey.trim()) {
    return null;
  }
  return { baseURL, apiKey };
}

async function runChatModelFetch(method: LoginMethod, fallbackDir = process.cwd()): Promise<{ status: "ready" | "failed" | "skipped"; count: number }> {
  try {
    if (method === "anthropic_api") {
      const configFile = loadRaxcodeConfigFile(fallbackDir);
      const authFile = loadRaxcodeAuthFile(fallbackDir);
      const profile = configFile.profiles.find((entry) => entry.id === "profile.provider.anthropic.default");
      const auth = authFile.authProfiles.find((entry) => entry.id === ANTHROPIC_DEFAULT_AUTH_PROFILE_ID);
      if (!profile || !auth?.credentials.apiKey) {
        return { status: "failed", count: 0 };
      }
      const models = await listAvailableAnthropicModels(profile.route.baseURL, auth.credentials.apiKey);
      return {
        status: models.length > 0 ? "ready" : "failed",
        count: models.length,
      };
    }
    const models = await listAvailableChatModels(loadOpenAILiveConfig("core.main", undefined));
    return {
      status: models.length > 0 ? "ready" : "failed",
      count: models.length,
    };
  } catch {
    return { status: "failed", count: 0 };
  }
}

async function runEmbeddingFetch(fallbackDir = process.cwd()): Promise<{ status: "ready" | "failed" | "skipped"; count: number }> {
  const config = loadResolvedEmbeddingConfig(fallbackDir);
  if (!config) {
    return { status: "skipped", count: 0 };
  }
  const results = await Promise.all(EMBEDDING_MODEL_CATALOG.map(async (entry) => ({
    id: entry.id,
    result: await probeEmbeddingModelAvailability(entry.id as typeof config.model, config),
  })));
  const availableCount = results.filter((entry) => entry.result.status === "available").length;
  return {
    status: availableCount > 0 ? "ready" : "failed",
    count: availableCount,
  };
}

function buildFetchingScreen(
  method: LoginMethod,
  chatStatus: "checking" | "ready" | "failed" | "skipped",
  embeddingStatus: "checking" | "ready" | "failed" | "skipped",
): string[] {
  return [
    "Fetching Available Models",
    "",
    `chat models:       ${chatStatus}`,
    `embedding models:  ${embeddingStatus}`,
    "",
    `chat provider: ${method === "chatgpt_subscription" ? "ChatGPT subscription" : method === "openai_compatible_api" ? "OpenAI compatible api key" : "Anthropic Endpoint api key"}`,
  ];
}

export async function runRaxodeLoginWizard(fallbackDir = process.cwd()): Promise<LoginWizardResult> {
  const rl = createInterface({
    input,
    output,
  });
  try {
    const method = await promptSelection(rl);

    if (method === "chatgpt_subscription") {
      writeScreen([
        "ChatGPT Subscription Login",
        "",
        "You will sign in with your ChatGPT account to use official GPT models.",
        "",
        "press ENTER to continue with browser login",
        "press Ctrl+C to cancel",
      ]);
      await promptLine(rl, "");
      const status = await loginOpenAIWithBrowser(fallbackDir);
      applyChatGptSubscriptionRoleRouting(fallbackDir);
      writeScreen([
        "ChatGPT Subscription Login",
        "",
        `Signed in as ${status.email ?? status.accountId ?? "current user"}.`,
        "",
        "press ENTER to continue to embedding configuration",
      ]);
      await promptLine(rl, "");
    } else if (method === "openai_compatible_api") {
      const form = await promptOpenAICompatibleForm(rl);
      applyOpenAICompatibleApiLoginConfig(form.baseURL, form.apiKey, fallbackDir);
    } else {
      const form = await promptAnthropicForm(rl);
      applyAnthropicEndpointLoginConfig(form.baseURL, form.apiKey, fallbackDir);
      writeScreen([
        "Anthropic Endpoint Model Configuration",
        "",
        "Anthropic endpoint credentials were saved.",
        "Current direct chat remains OpenAI-first until provider-aware chat routing is generalized.",
        "",
        "press ENTER to continue to embedding configuration",
      ]);
      await promptLine(rl, "");
    }

    const embeddingForm = await promptEmbeddingForm(rl);
    applyEmbeddingLoginConfig(embeddingForm, fallbackDir);

    writeScreen(buildFetchingScreen(method, "checking", embeddingForm ? "checking" : "skipped"));
    const chatModelsStatus = await runChatModelFetch(method, fallbackDir);
    writeScreen(buildFetchingScreen(method, chatModelsStatus.status, embeddingForm ? "checking" : "skipped"));
    const embeddingStatus = embeddingForm ? await runEmbeddingFetch(fallbackDir) : { status: "skipped" as const, count: 0 };

    const result: LoginWizardResult = {
      method,
      chatModelsStatus: chatModelsStatus.status,
      embeddingStatus: embeddingStatus.status,
      chatModelCount: chatModelsStatus.count,
      embeddingModelCount: embeddingStatus.count,
    };

    writeScreen(buildLoginSummaryScreen(result));
    await promptLine(rl, "");
    return result;
  } finally {
    rl.close();
  }
}
