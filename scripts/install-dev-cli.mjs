#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const launcherPath = resolve(appRoot, "scripts", "raxode-dev.mjs");
const binDir = resolve(os.homedir(), ".local", "bin");
const commandNames = ["raxode", "raxcode"];

mkdirSync(binDir, { recursive: true });

for (const commandName of commandNames) {
  const linkPath = resolve(binDir, commandName);
  if (existsSync(linkPath)) {
    const stats = lstatSync(linkPath);
    if (stats.isSymbolicLink()) {
      const currentTarget = resolve(binDir, readlinkSync(linkPath));
      if (currentTarget === launcherPath) {
        process.stdout.write(`${commandName} already points to ${launcherPath}\n`);
        continue;
      }
      unlinkSync(linkPath);
    } else {
      throw new Error(`${linkPath} already exists and is not a symlink. Move it away before linking dev raxode.`);
    }
  }
  symlinkSync(launcherPath, linkPath);
  process.stdout.write(`Linked ${commandName} -> ${launcherPath}\n`);
}
