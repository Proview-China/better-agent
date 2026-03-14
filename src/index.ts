import { pathToFileURL } from "node:url";

export * from "./rax/index.js";

export const praxisBootstrapStatus = {
  branch: "reboot/blank-slate",
  primaryLanguage: "TypeScript",
  runtimeName: "rax",
  desktopTargets: {
    macos: "native-first",
    windows: "electron-candidate",
    linux: "electron-candidate"
  },
  memoryDirectory: "./memory"
} as const;

export function describePraxisBootstrap(): string {
  return [
    "Praxis reboot scaffold ready.",
    "The unified capability runtime is named rax.",
    "TypeScript/Node is the active baseline.",
    "Project memory lives under ./memory."
  ].join(" ");
}

const entrypoint = process.argv[1];
const isDirectRun =
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isDirectRun) {
  console.log(describePraxisBootstrap());
}
