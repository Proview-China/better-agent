#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const entrypoint = resolve(appRoot, "src", "index.ts");
const tsxBin = resolve(appRoot, "node_modules", ".bin", "tsx");
const argv = process.argv.slice(2);
const raxodeHome = resolve(process.env.RAXCODE_HOME ?? resolve(process.env.HOME ?? process.cwd(), ".raxcode"));
const configPath = resolve(raxodeHome, "config.json");
const launchWorkspace = resolve(process.env.PRAXIS_WORKSPACE_ROOT ?? appRoot);

function resolveDevCommand(args) {
  const [rawCommand] = args;
  if (!rawCommand) {
    return "tui";
  }
  if (rawCommand === "--help" || rawCommand === "-h" || rawCommand === "help") {
    return "help";
  }
  return rawCommand;
}

function resolveConfiguredAnimationMode() {
  if (!existsSync(configPath)) {
    return "fresh";
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    const configuredMode = parsed?.ui?.animationMode;
    return configuredMode === "off" || configuredMode === "resume" || configuredMode === "fresh"
      ? configuredMode
      : "fresh";
  } catch {
    return "fresh";
  }
}

function resolveLauncherAnimationMode(command) {
  const configuredMode = resolveConfiguredAnimationMode();
  if (configuredMode === "off" || configuredMode === "resume") {
    return configuredMode;
  }
  if (command === "resume") {
    return "resume";
  }
  return "fresh";
}

async function runWithImmediateSplashIfNeeded() {
  const command = resolveDevCommand(argv);
  const animationMode = resolveLauncherAnimationMode(command);
  const shouldUseWrapper =
    process.stdin.isTTY
    && process.stdout.isTTY
    && (command === "tui" || command === "resume");

  if (!shouldUseWrapper) {
    return {
      exitCode: null,
      animationMode,
    };
  }

  const { runRaxodeTuiWithStartupSplash } = await import("../src/raxode-startup-splash.ts");
  return {
    exitCode: await runRaxodeTuiWithStartupSplash({
    command: tsxBin,
    args: [entrypoint, ...argv],
    cwd: launchWorkspace,
    env: {
      ...process.env,
      PRAXIS_APP_ROOT: appRoot,
      PRAXIS_WORKSPACE_ROOT: launchWorkspace,
      PRAXIS_BOOTSTRAP_PARENT_ACTIVE: "1",
    },
    animationMode,
  }),
    animationMode,
  };
}

runWithImmediateSplashIfNeeded()
  .then(({ exitCode, animationMode }) => {
    if (exitCode !== null) {
      process.exit(exitCode);
      return;
    }

    const child = spawn(tsxBin, [entrypoint, ...argv], {
      cwd: launchWorkspace,
      env: {
        ...process.env,
        PRAXIS_APP_ROOT: appRoot,
        PRAXIS_WORKSPACE_ROOT: launchWorkspace,
        PRAXIS_BOOTSTRAP_MODE: animationMode,
      },
      stdio: "inherit",
    });

    child.once("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to start dev raxode launcher: ${message}\n`);
      process.exitCode = 1;
    });

    child.once("exit", (code, signal) => {
      if (signal) {
        process.exitCode = 1;
        return;
      }
      process.exitCode = code ?? 0;
    });
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to start dev raxode launcher: ${message}\n`);
    process.exitCode = 1;
  });
