import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";

import {
  type RaxcodeAuthFile,
  type RaxcodeAuthProfile,
  RaxcodeConfigError,
  type RaxcodeConfigFile,
  loadRaxcodeAuthFile,
  loadRaxcodeConfigFile,
  loadRaxcodeRolePlan,
  loadResolvedProviderSlotConfig,
  writeRaxcodeAuthFile,
  writeRaxcodeConfigFile,
} from "./raxcode-config.js";

export const OPENAI_OAUTH_ISSUER = "https://auth.openai.com";
export const OPENAI_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_OFFICIAL_AUTH_PROFILE_ID = "auth.openai.official";
export const OPENAI_OFFICIAL_PROVIDER_PROFILE_ID = "profile.provider.openai.official";
export const OPENAI_DEFAULT_PROVIDER_PROFILE_ID = "profile.core.main";
export const OPENAI_OFFICIAL_BASE_URL = "https://chatgpt.com/backend-api/codex";

const OPENAI_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "api.connectors.read",
  "api.connectors.invoke",
].join(" ");

const OAUTH_HEADROOM_MS = 5 * 60 * 1000;

interface JwtClaims {
  email?: string;
  exp?: number;
  "https://api.openai.com/profile"?: {
    email?: string;
  };
  "https://api.openai.com/auth"?: {
    chatgpt_plan_type?: string;
    chatgpt_user_id?: string;
    user_id?: string;
    chatgpt_account_id?: string;
  };
}

interface OpenAITokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

interface OpenAIDeviceCodeResponse {
  device_auth_id: string;
  user_code: string;
  interval?: string | number;
}

interface OpenAIDevicePollResponse {
  authorization_code: string;
  code_challenge: string;
  code_verifier: string;
}

export interface OpenAIAuthStatus {
  authMode: "api_key" | "chatgpt_oauth" | "none";
  activeAuthProfileId?: string;
  activeProviderProfileId?: string;
  email?: string;
  planType?: string;
  accountId?: string;
  accessTokenExpiresAt?: string;
  refreshTokenPresent: boolean;
}

export interface OpenAILoginProgressCallbacks {
  onMessage?: (message: string) => void;
}

function timestamp(): string {
  return new Date().toISOString();
}

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64url");
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(randomBytes(64));
  const challenge = base64UrlEncode(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function generateState(): string {
  return base64UrlEncode(randomBytes(32));
}

function decodeJwtClaims(token: string | undefined): JwtClaims | undefined {
  if (!token) {
    return undefined;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return undefined;
  }
}

function parseJwtExpirationIso(token: string | undefined): string | undefined {
  const exp = decodeJwtClaims(token)?.exp;
  if (!exp || !Number.isFinite(exp)) {
    return undefined;
  }
  const value = new Date(exp * 1000);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function openAiClaims(token: string | undefined): JwtClaims["https://api.openai.com/auth"] {
  return decodeJwtClaims(token)?.["https://api.openai.com/auth"];
}

function readEmailFromToken(token: string | undefined): string | undefined {
  const claims = decodeJwtClaims(token);
  return claims?.email ?? claims?.["https://api.openai.com/profile"]?.email;
}

function buildAuthorizeUrl(params: {
  issuer?: string;
  clientId?: string;
  redirectUri: string;
  verifierChallenge: string;
  state: string;
}): string {
  const issuer = params.issuer ?? OPENAI_OAUTH_ISSUER;
  const clientId = params.clientId ?? OPENAI_OAUTH_CLIENT_ID;
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: params.redirectUri,
    scope: OPENAI_OAUTH_SCOPES,
    code_challenge: params.verifierChallenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state: params.state,
    originator: "codex_cli_rs",
  });
  return `${issuer}/oauth/authorize?${query.toString()}`;
}

async function exchangeAuthorizationCode(params: {
  issuer?: string;
  clientId?: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<Required<OpenAITokenResponse>> {
  const issuer = params.issuer ?? OPENAI_OAUTH_ISSUER;
  const clientId = params.clientId ?? OPENAI_OAUTH_CLIENT_ID;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: clientId,
    code_verifier: params.codeVerifier,
  });
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new RaxcodeConfigError(`OpenAI token exchange failed: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as OpenAITokenResponse;
  if (!payload.access_token || !payload.refresh_token || !payload.id_token) {
    throw new RaxcodeConfigError("OpenAI token exchange response is missing required tokens.");
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    id_token: payload.id_token,
  };
}

async function refreshTokenWithAuthority(refreshToken: string, issuer = OPENAI_OAUTH_ISSUER, clientId = OPENAI_OAUTH_CLIENT_ID): Promise<OpenAITokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new RaxcodeConfigError(`OpenAI token refresh failed: ${response.status} ${detail || response.statusText}`);
  }
  return await response.json() as OpenAITokenResponse;
}

function shouldAttemptRefresh(profile: RaxcodeAuthProfile, force = false): boolean {
  if (profile.authMode !== "chatgpt_oauth") {
    return false;
  }
  if (force) {
    return true;
  }
  const expiration = profile.meta.accessTokenExpiresAt ?? parseJwtExpirationIso(profile.credentials.accessToken);
  if (!expiration) {
    return false;
  }
  return new Date(expiration).getTime() <= Date.now() + OAUTH_HEADROOM_MS;
}

function upsertAuthProfile(authFile: RaxcodeAuthFile, profile: RaxcodeAuthProfile): void {
  const index = authFile.authProfiles.findIndex((entry) => entry.id === profile.id);
  if (index === -1) {
    authFile.authProfiles.push(profile);
  } else {
    authFile.authProfiles[index] = profile;
  }
}

function ensureOfficialOpenAIProviderProfile(configFile: RaxcodeConfigFile): void {
  const existing = configFile.profiles.find((entry) => entry.id === OPENAI_OFFICIAL_PROVIDER_PROFILE_ID);
  const corePlan = loadRaxcodeRolePlan("core.main");
  if (existing) {
    existing.provider = "openai";
    existing.label = "OpenAI Official";
    existing.authProfileId = OPENAI_OFFICIAL_AUTH_PROFILE_ID;
    existing.route = {
      baseURL: OPENAI_OFFICIAL_BASE_URL,
      apiStyle: "responses",
    };
    existing.enabled = true;
    if (!existing.model) {
      existing.model = corePlan.model;
    }
    if (!existing.reasoningEffort) {
      existing.reasoningEffort = corePlan.reasoning;
    }
    return;
  }
  configFile.profiles.push({
    id: OPENAI_OFFICIAL_PROVIDER_PROFILE_ID,
    provider: "openai",
    label: "OpenAI Official",
    authProfileId: OPENAI_OFFICIAL_AUTH_PROFILE_ID,
    route: {
      baseURL: OPENAI_OFFICIAL_BASE_URL,
      apiStyle: "responses",
    },
    model: corePlan.model,
    reasoningEffort: corePlan.reasoning,
    contextWindowTokens: corePlan.contextWindowTokens,
    maxOutputTokens: corePlan.maxOutputTokens,
    enabled: true,
  });
}

function persistOfficialOpenAIProfile(params: {
  fallbackDir?: string;
  tokens: Required<OpenAITokenResponse>;
}): OpenAIAuthStatus {
  const fallbackDir = params.fallbackDir ?? process.cwd();
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const existing = authFile.authProfiles.find((entry) => entry.id === OPENAI_OFFICIAL_AUTH_PROFILE_ID);
  const now = timestamp();
  const authClaims = openAiClaims(params.tokens.id_token);
  const accountId = authClaims?.chatgpt_account_id;
  const profile: RaxcodeAuthProfile = {
    id: OPENAI_OFFICIAL_AUTH_PROFILE_ID,
    provider: "openai",
    label: "OpenAI Official",
    authMode: "chatgpt_oauth",
    credentials: {
      accessToken: params.tokens.access_token,
      refreshToken: params.tokens.refresh_token,
      idToken: params.tokens.id_token,
      accountId,
    },
    meta: {
      source: "oauth",
      createdAt: existing?.meta.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: now,
      accountId: accountId ?? existing?.meta.accountId,
      email: readEmailFromToken(params.tokens.id_token) ?? existing?.meta.email,
      chatgptPlanType: authClaims?.chatgpt_plan_type ?? existing?.meta.chatgptPlanType,
      chatgptUserId: authClaims?.chatgpt_user_id ?? authClaims?.user_id ?? existing?.meta.chatgptUserId,
      chatgptAccountId: accountId ?? existing?.meta.chatgptAccountId,
      lastRefreshAt: now,
      accessTokenExpiresAt: parseJwtExpirationIso(params.tokens.access_token) ?? existing?.meta.accessTokenExpiresAt,
      idTokenExpiresAt: parseJwtExpirationIso(params.tokens.id_token) ?? existing?.meta.idTokenExpiresAt,
      orgId: existing?.meta.orgId,
      projectId: existing?.meta.projectId,
    },
  };

  upsertAuthProfile(authFile, profile);
  authFile.activeAuthProfileIdBySlot.openai = OPENAI_OFFICIAL_AUTH_PROFILE_ID;

  ensureOfficialOpenAIProviderProfile(configFile);
  configFile.providerSlots.openai = OPENAI_OFFICIAL_PROVIDER_PROFILE_ID;

  writeRaxcodeAuthFile(authFile, fallbackDir);
  writeRaxcodeConfigFile(configFile, fallbackDir);

  return {
    authMode: "chatgpt_oauth",
    activeAuthProfileId: OPENAI_OFFICIAL_AUTH_PROFILE_ID,
    activeProviderProfileId: OPENAI_OFFICIAL_PROVIDER_PROFILE_ID,
    email: profile.meta.email,
    planType: profile.meta.chatgptPlanType,
    accountId: profile.meta.chatgptAccountId,
    accessTokenExpiresAt: profile.meta.accessTokenExpiresAt,
    refreshTokenPresent: Boolean(profile.credentials.refreshToken),
  };
}

function persistApiKeyToDefaultProfile(apiKey: string, fallbackDir = process.cwd()): OpenAIAuthStatus {
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const existing = authFile.authProfiles.find((entry) => entry.id === "auth.openai.default");
  const now = timestamp();
  upsertAuthProfile(authFile, {
    id: "auth.openai.default",
    provider: "openai",
    label: existing?.label ?? "OpenAI Default",
    authMode: "api_key",
    credentials: {
      apiKey,
    },
    meta: {
      source: "manual",
      createdAt: existing?.meta.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: now,
      orgId: existing?.meta.orgId,
      projectId: existing?.meta.projectId,
      accountId: existing?.meta.accountId,
      email: existing?.meta.email,
      chatgptPlanType: existing?.meta.chatgptPlanType,
      chatgptUserId: existing?.meta.chatgptUserId,
      chatgptAccountId: existing?.meta.chatgptAccountId,
      lastRefreshAt: existing?.meta.lastRefreshAt,
      accessTokenExpiresAt: existing?.meta.accessTokenExpiresAt,
      idTokenExpiresAt: existing?.meta.idTokenExpiresAt,
    },
  });
  authFile.activeAuthProfileIdBySlot.openai = "auth.openai.default";
  writeRaxcodeAuthFile(authFile, fallbackDir);
  return {
    authMode: "api_key",
    activeAuthProfileId: "auth.openai.default",
    activeProviderProfileId: loadRaxcodeConfigFile(fallbackDir).providerSlots.openai,
    refreshTokenPresent: false,
  };
}

function tryOpenBrowser(url: string): void {
  const commands = process.platform === "darwin"
    ? [["open", url]]
    : process.platform === "win32"
      ? [["cmd", "/c", "start", "", url]]
      : [["xdg-open", url], ["gio", "open", url]];
  for (const [command, ...args] of commands) {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => {
      // Try the next opener.
    });
    child.unref();
    return;
  }
}

async function awaitBrowserCallback(params: {
  issuer?: string;
  clientId?: string;
  callbacks?: OpenAILoginProgressCallbacks;
}): Promise<Required<OpenAITokenResponse>> {
  const issuer = params.issuer ?? OPENAI_OAUTH_ISSUER;
  const clientId = params.clientId ?? OPENAI_OAUTH_CLIENT_ID;
  const callbacks = params.callbacks;
  const state = generateState();
  const pkce = generatePkcePair();
  let port = 1455;

  return await new Promise<Required<OpenAITokenResponse>>((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        if (!req.url) {
          res.statusCode = 400;
          res.end("Missing callback URL.");
          return;
        }
        const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        if (requestUrl.pathname !== "/auth/callback") {
          res.statusCode = 404;
          res.end("Not found.");
          return;
        }
        const callbackState = requestUrl.searchParams.get("state");
        if (callbackState !== state) {
          res.statusCode = 400;
          res.end("State mismatch.");
          reject(new RaxcodeConfigError("OpenAI OAuth callback state mismatch."));
          server.close();
          return;
        }
        const errorCode = requestUrl.searchParams.get("error");
        if (errorCode) {
          const errorDescription = requestUrl.searchParams.get("error_description");
          res.statusCode = 400;
          res.end("Sign-in failed. You can return to the terminal.");
          reject(new RaxcodeConfigError(`OpenAI OAuth callback failed: ${errorDescription ?? errorCode}`));
          server.close();
          return;
        }
        const code = requestUrl.searchParams.get("code");
        if (!code) {
          res.statusCode = 400;
          res.end("Missing authorization code.");
          reject(new RaxcodeConfigError("OpenAI OAuth callback did not include an authorization code."));
          server.close();
          return;
        }
        const redirectUri = `http://localhost:${port}/auth/callback`;
        const tokens = await exchangeAuthorizationCode({
          issuer,
          clientId,
          redirectUri,
          code,
          codeVerifier: pkce.verifier,
        });
        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end("<html><body><h2>Raxcode login complete</h2><p>You can return to the terminal.</p></body></html>");
        resolve(tokens);
        server.close();
      } catch (error) {
        res.statusCode = 500;
        res.end("Sign-in failed. You can return to the terminal.");
        reject(error);
        server.close();
      }
    });

    server.listen(1455, "127.0.0.1", () => {
      const info = server.address();
      if (!info || typeof info === "string") {
        reject(new RaxcodeConfigError("Unable to determine local OAuth callback port."));
        server.close();
        return;
      }
      port = info.port;
      const redirectUri = `http://localhost:${info.port}/auth/callback`;
      const authUrl = buildAuthorizeUrl({
        issuer,
        clientId,
        redirectUri,
        verifierChallenge: pkce.challenge,
        state,
      });
      const message =
        `Starting local login server on http://localhost:${info.port}.\n`
        + "If your browser did not open, navigate to this URL to authenticate:\n\n"
        + `${authUrl}\n`;
      if (callbacks?.onMessage) {
        callbacks.onMessage(message);
      } else {
        process.stderr.write(
          `${message}\nOn a remote or headless machine? Use \`raxode login --device-auth\` instead.\n`,
        );
      }
      tryOpenBrowser(authUrl);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        server.listen(0, "127.0.0.1");
        return;
      }
      reject(error);
    });
  });
}

async function requestDeviceCode(issuer = OPENAI_OAUTH_ISSUER, clientId = OPENAI_OAUTH_CLIENT_ID): Promise<Required<OpenAIDeviceCodeResponse>> {
  const response = await fetch(`${issuer}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new RaxcodeConfigError(`OpenAI device auth request failed: ${response.status} ${detail || response.statusText}`);
  }
  const payload = await response.json() as OpenAIDeviceCodeResponse;
  if (!payload.device_auth_id || !payload.user_code) {
    throw new RaxcodeConfigError("OpenAI device auth did not return a device_auth_id and user_code.");
  }
  return {
    ...payload,
    interval: payload.interval ?? 5,
  };
}

async function pollDeviceCode(issuer: string, code: Required<OpenAIDeviceCodeResponse>): Promise<OpenAIDevicePollResponse> {
  const deadline = Date.now() + 15 * 60 * 1000;
  const interval = typeof code.interval === "string" ? Number.parseInt(code.interval, 10) || 5 : code.interval;
  while (Date.now() < deadline) {
    const response = await fetch(`${issuer}/api/accounts/deviceauth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        device_auth_id: code.device_auth_id,
        user_code: code.user_code,
      }),
    });
    if (response.ok) {
      const payload = await response.json() as OpenAIDevicePollResponse;
      if (!payload.authorization_code || !payload.code_verifier) {
        throw new RaxcodeConfigError("OpenAI device auth returned an incomplete authorization payload.");
      }
      return payload;
    }
    if (response.status === 403 || response.status === 404) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(interval, 1) * 1000));
      continue;
    }
    const detail = await response.text();
    throw new RaxcodeConfigError(`OpenAI device auth polling failed: ${response.status} ${detail || response.statusText}`);
  }
  throw new RaxcodeConfigError("OpenAI device auth timed out after 15 minutes.");
}

export async function loginOpenAIWithBrowser(
  fallbackDir = process.cwd(),
  callbacks?: OpenAILoginProgressCallbacks,
): Promise<OpenAIAuthStatus> {
  const tokens = await awaitBrowserCallback({
    callbacks,
  });
  return persistOfficialOpenAIProfile({
    fallbackDir,
    tokens,
  });
}

export async function loginOpenAIWithDeviceCode(
  fallbackDir = process.cwd(),
  callbacks?: OpenAILoginProgressCallbacks,
): Promise<OpenAIAuthStatus> {
  const code = await requestDeviceCode();
  const message =
    "\nFollow these steps to sign in with ChatGPT using device code authorization:\n\n"
    + "1. Open this link in your browser and sign in to your account\n"
    + `   ${OPENAI_OAUTH_ISSUER.replace(/\/$/u, "")}/codex/device\n\n`
    + "2. Enter this one-time code\n"
    + `   ${code.user_code}\n\n`
    + "Device codes are a common phishing target. Never share this code.\n";
  if (callbacks?.onMessage) {
    callbacks.onMessage(message);
  } else {
    process.stderr.write(`${message}\n`);
  }
  const authorization = await pollDeviceCode(OPENAI_OAUTH_ISSUER, code);
  const tokens = await exchangeAuthorizationCode({
    redirectUri: `${OPENAI_OAUTH_ISSUER}/deviceauth/callback`,
    code: authorization.authorization_code,
    codeVerifier: authorization.code_verifier,
  });
  return persistOfficialOpenAIProfile({
    fallbackDir,
    tokens,
  });
}

export function loginOpenAIWithApiKey(apiKey: string, fallbackDir = process.cwd()): OpenAIAuthStatus {
  return persistApiKeyToDefaultProfile(apiKey, fallbackDir);
}

export async function refreshOpenAIOAuthIfNeeded(
  fallbackDir = process.cwd(),
  options: { force?: boolean } = {},
): Promise<boolean> {
  const resolved = loadResolvedProviderSlotConfig("openai", fallbackDir);
  if (resolved.authProfile.authMode !== "chatgpt_oauth") {
    return false;
  }
  if (!shouldAttemptRefresh(resolved.authProfile, options.force)) {
    return false;
  }
  const refreshToken = resolved.authProfile.credentials.refreshToken;
  if (!refreshToken) {
    throw new RaxcodeConfigError("OpenAI 官方登录缺少 refresh token，请重新登录。");
  }
  const refreshed = await refreshTokenWithAuthority(refreshToken);
  const tokens = {
    access_token: refreshed.access_token ?? resolved.authProfile.credentials.accessToken ?? "",
    refresh_token: refreshed.refresh_token ?? refreshToken,
    id_token: refreshed.id_token ?? resolved.authProfile.credentials.idToken ?? "",
  };
  if (!tokens.access_token || !tokens.id_token) {
    throw new RaxcodeConfigError("OpenAI token refresh returned incomplete tokens. Please log in again.");
  }
  persistOfficialOpenAIProfile({
    fallbackDir,
    tokens,
  });
  return true;
}

export function getOpenAIAuthStatus(fallbackDir = process.cwd()): OpenAIAuthStatus {
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  try {
    const resolved = loadResolvedProviderSlotConfig("openai", fallbackDir);
    if (resolved.authProfile.authMode === "chatgpt_oauth") {
      return {
        authMode: "chatgpt_oauth",
        activeAuthProfileId: resolved.authProfile.id,
        activeProviderProfileId: configFile.providerSlots.openai,
        email: resolved.authProfile.meta.email,
        planType: resolved.authProfile.meta.chatgptPlanType,
        accountId: resolved.authProfile.meta.chatgptAccountId ?? resolved.authProfile.credentials.accountId,
        accessTokenExpiresAt: resolved.authProfile.meta.accessTokenExpiresAt ?? parseJwtExpirationIso(resolved.authProfile.credentials.accessToken),
        refreshTokenPresent: Boolean(resolved.authProfile.credentials.refreshToken),
      };
    }
    if (resolved.authProfile.authMode === "api_key" && resolved.authProfile.credentials.apiKey) {
      return {
        authMode: "api_key",
        activeAuthProfileId: resolved.authProfile.id,
        activeProviderProfileId: configFile.providerSlots.openai,
        refreshTokenPresent: false,
      };
    }
  } catch {
    // Fall through to none.
  }
  return {
    authMode: "none",
    activeProviderProfileId: configFile.providerSlots.openai,
    refreshTokenPresent: false,
  };
}

export function logoutOpenAIAuth(fallbackDir = process.cwd()): OpenAIAuthStatus {
  const authFile = loadRaxcodeAuthFile(fallbackDir);
  const configFile = loadRaxcodeConfigFile(fallbackDir);
  const activeAuthId = authFile.activeAuthProfileIdBySlot.openai;
  const activeAuth = activeAuthId
    ? authFile.authProfiles.find((entry) => entry.id === activeAuthId)
    : undefined;

  if (activeAuth?.authMode === "chatgpt_oauth" || activeAuth?.id === OPENAI_OFFICIAL_AUTH_PROFILE_ID) {
    authFile.authProfiles = authFile.authProfiles.filter((entry) => entry.id !== OPENAI_OFFICIAL_AUTH_PROFILE_ID);
    authFile.activeAuthProfileIdBySlot.openai = "auth.openai.default";
    if (configFile.providerSlots.openai === OPENAI_OFFICIAL_PROVIDER_PROFILE_ID) {
      configFile.providerSlots.openai = OPENAI_DEFAULT_PROVIDER_PROFILE_ID;
    }
  } else if (activeAuth?.authMode === "api_key") {
    activeAuth.credentials = { apiKey: "" };
    activeAuth.meta.updatedAt = timestamp();
  }

  writeRaxcodeAuthFile(authFile, fallbackDir);
  writeRaxcodeConfigFile(configFile, fallbackDir);
  return getOpenAIAuthStatus(fallbackDir);
}
