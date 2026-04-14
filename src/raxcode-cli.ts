import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getOpenAIAuthStatus,
  loginOpenAIWithApiKey,
  loginOpenAIWithBrowser,
  loginOpenAIWithDeviceCode,
  logoutOpenAIAuth,
} from "./raxcode-openai-auth.js";
import { loadOpenAILiveConfig } from "./rax/live-config.js";
import { runRaxodeLoginTui } from "./raxode-login-tui.js";
import { ensureRaxcodeHomeScaffold, loadResolvedRoleConfig, resolveConfiguredWorkspaceRoot } from "./raxcode-config.js";

const PRIMARY_CLI_COMMAND = "raxode";
const CLI_DISPLAY_NAME = "Raxode";
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export type RaxodeUiCommand = "tui" | "chat";

export interface RaxodeLaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export function resolveRaxodeCliCommand(argv: string[]): {
  command: RaxodeUiCommand | "login" | "logout" | "status" | "help";
  rest: string[];
} {
  const [rawCommand, ...rest] = argv;
  if (!rawCommand) {
    return {
      command: "tui",
      rest: [],
    };
  }
  if (rawCommand === "--help" || rawCommand === "-h" || rawCommand === "help") {
    return {
      command: "help",
      rest: [],
    };
  }
  return {
    command: rawCommand as RaxodeUiCommand | "login" | "logout" | "status",
    rest,
  };
}

function printUsage(): void {
  process.stdout.write(
    [
      `${CLI_DISPLAY_NAME} CLI`,
      "",
      "Usage:",
      `  ${PRIMARY_CLI_COMMAND} tui`,
      `  ${PRIMARY_CLI_COMMAND} chat [--ui=terminal|direct] [--once \"...\"]`,
      `  ${PRIMARY_CLI_COMMAND} login`,
      `  ${PRIMARY_CLI_COMMAND} login --device-auth`,
      `  ${PRIMARY_CLI_COMMAND} login --with-api-key`,
      `  ${PRIMARY_CLI_COMMAND} login status`,
      `  ${PRIMARY_CLI_COMMAND} logout`,
      `  ${PRIMARY_CLI_COMMAND} status`,
      "",
      "Alias:",
      "  raxcode -> raxode",
    ].join("\n") + "\n",
  );
}

function resolveCliAppRoot(moduleDir = MODULE_DIR): string {
  return resolve(moduleDir, "..");
}

function resolveUiEntrypoint(command: RaxodeUiCommand, moduleDir = MODULE_DIR): { command: string; args: string[] } {
  const appRoot = resolveCliAppRoot(moduleDir);
  const sourceEntrypoint = resolve(
    moduleDir,
    "agent_core",
    command === "tui" ? "direct-tui.tsx" : "live-agent-chat.ts",
  );
  if (existsSync(sourceEntrypoint)) {
    return {
      command: resolve(appRoot, "node_modules", ".bin", "tsx"),
      args: [sourceEntrypoint],
    };
  }
  const distEntrypoint = resolve(
    moduleDir,
    "agent_core",
    command === "tui" ? "direct-tui.js" : "live-agent-chat.js",
  );
  return {
    command: process.execPath,
    args: [distEntrypoint],
  };
}

export function resolveRaxodeLaunchPlan(
  command: RaxodeUiCommand,
  forwardedArgs: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    moduleDir?: string;
  } = {},
): RaxodeLaunchPlan {
  const cwd = resolveConfiguredWorkspaceRoot(options.cwd ?? process.cwd());
  const moduleDir = options.moduleDir ?? MODULE_DIR;
  const env = {
    ...process.env,
    ...options.env,
    PRAXIS_APP_ROOT: resolveCliAppRoot(moduleDir),
    PRAXIS_WORKSPACE_ROOT: cwd,
  };
  const entrypoint = resolveUiEntrypoint(command, moduleDir);
  return {
    command: entrypoint.command,
    args: [...entrypoint.args, ...forwardedArgs],
    cwd,
    env,
  };
}

async function runUiCommand(command: RaxodeUiCommand, args: string[]): Promise<number> {
  const launchPlan = resolveRaxodeLaunchPlan(command, args);
  return await new Promise<number>((resolveExitCode, reject) => {
    const child = spawn(launchPlan.command, launchPlan.args, {
      cwd: launchPlan.cwd,
      env: launchPlan.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        resolveExitCode(1);
        return;
      }
      resolveExitCode(code ?? 0);
    });
  });
}

export function hasConfiguredPrimaryModelAuth(): boolean {
  try {
    const resolved = loadResolvedRoleConfig("core.main");
    const authProfile = resolved.authProfile;
    const profile = resolved.profile;
    if (!profile.route.baseURL) {
      return false;
    }
    if (!profile.model) {
      return false;
    }
    if (authProfile.authMode === "chatgpt_oauth") {
      return Boolean(authProfile.credentials.accessToken && authProfile.credentials.accountId);
    }
    return Boolean(authProfile.credentials.apiKey);
  } catch {
    return false;
  }
}

async function readApiKeyFromInput(): Promise<string> {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
    return process.env.OPENAI_API_KEY.trim();
  }
  if (process.stdin.isTTY) {
    throw new Error("`--with-api-key` expects OPENAI_API_KEY in the environment or the key piped on stdin.");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const apiKey = Buffer.concat(chunks).toString("utf8").trim();
  if (!apiKey) {
    throw new Error("No API key was provided on stdin.");
  }
  return apiKey;
}

function printStatus(): void {
  const status = getOpenAIAuthStatus();
  const scaffold = ensureRaxcodeHomeScaffold();
  process.stdout.write(`${CLI_DISPLAY_NAME} home: ${scaffold.home}\n`);
  process.stdout.write(`Workspace: ${resolveConfiguredWorkspaceRoot()}\n`);
  process.stdout.write(`OpenAI auth mode: ${status.authMode}\n`);
  process.stdout.write(`OpenAI auth profile: ${status.activeAuthProfileId ?? "(none)"}\n`);
  process.stdout.write(`OpenAI provider profile: ${status.activeProviderProfileId ?? "(none)"}\n`);
  if (status.email) {
    process.stdout.write(`Email: ${status.email}\n`);
  }
  if (status.planType) {
    process.stdout.write(`ChatGPT plan: ${status.planType}\n`);
  }
  if (status.accountId) {
    process.stdout.write(`ChatGPT account: ${status.accountId}\n`);
  }
  if (status.accessTokenExpiresAt) {
    process.stdout.write(`Access token expires at: ${status.accessTokenExpiresAt}\n`);
  }
  process.stdout.write(`Refresh token present: ${status.refreshTokenPresent ? "yes" : "no"}\n`);
}

async function runLogin(args: string[]): Promise<number> {
  if (args[0] === "status") {
    printStatus();
    return 0;
  }
  if (args.length === 0 && process.stdin.isTTY && process.stdout.isTTY) {
    await runRaxodeLoginTui();
    return 0;
  }
  if (args.includes("--with-api-key")) {
    const apiKey = await readApiKeyFromInput();
    const status = loginOpenAIWithApiKey(apiKey);
    process.stdout.write(`Saved OpenAI API key to ${status.activeAuthProfileId}.\n`);
    return 0;
  }
  if (args.includes("--device-auth")) {
    const status = await loginOpenAIWithDeviceCode();
    process.stdout.write(`OpenAI official login succeeded for ${status.email ?? status.accountId ?? "current user"}.\n`);
    return 0;
  }
  const status = await loginOpenAIWithBrowser();
  process.stdout.write(`OpenAI official login succeeded for ${status.email ?? status.accountId ?? "current user"}.\n`);
  return 0;
}

export async function runRaxcodeCli(argv: string[]): Promise<number> {
  const { command, rest } = resolveRaxodeCliCommand(argv);
  if (command === "help") {
    printUsage();
    return 0;
  }
  if (command === "login") {
    return await runLogin(rest);
  }
  if ((command === "tui" || command === "chat") && !hasConfiguredPrimaryModelAuth()) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await runRaxodeLoginTui();
      return 0;
    }
    throw new Error("Raxode requires a primary model login or API configuration. Run `raxode login` in an interactive terminal first.");
  }
  if (command === "tui") {
    return await runUiCommand("tui", rest);
  }
  if (command === "chat") {
    return await runUiCommand("chat", rest);
  }
  if (command === "logout") {
    const status = logoutOpenAIAuth();
    process.stdout.write(`OpenAI auth cleared. Current mode: ${status.authMode}.\n`);
    return 0;
  }
  if (command === "status") {
    printStatus();
    return 0;
  }
  printUsage();
  return 1;
}
