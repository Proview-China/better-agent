#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const entrypoint = resolve(appRoot, "src", "index.ts");
const tsxBin = resolve(appRoot, "node_modules", ".bin", "tsx");

const child = spawn(tsxBin, [entrypoint, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PRAXIS_APP_ROOT: appRoot,
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
