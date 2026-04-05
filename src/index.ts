import { pathToFileURL } from "node:url";

export {
  CMP_RULE_ACTIONS,
  CMP_SECTION_FIDELITY,
  CMP_SECTION_KINDS,
  CMP_SECTION_SOURCES,
  CMP_STORED_SECTION_PLANES,
  CMP_STORED_SECTION_STATES,
  type CmpRule,
  type CmpRuleAction,
  type CmpRuleEvaluation,
  type CmpRuleMatch,
  type CmpRulePack,
  type CmpSection,
  type CmpSectionFidelity,
  type CmpSectionKind,
  type CmpSectionSource,
  type CmpStoredSection,
  type CmpStoredSectionPlane,
  type CmpStoredSectionState,
  createCmpRule,
  createCmpRulePack,
  createCmpSection,
  createCmpStoredSection,
  createCmpStoredSectionFromSection,
  evaluateCmpRulePack,
} from "./rax/index.js";

export * from "./rax/index.js";
export * from "./agent_core/index.js";

export const praxisBootstrapStatus = {
  branch: "reboot/blank-slate",
  primaryLanguage: "TypeScript",
  runtimeName: "rax",
  desktopTargets: {
    macos: "native-first",
    windows: "electron-candidate",
    linux: "electron-candidate",
  },
  memoryDirectory: "./memory",
} as const;

export function describePraxisBootstrap(): string {
  return [
    "Praxis reboot scaffold ready.",
    "The unified capability runtime is named rax.",
    "TypeScript/Node is the active baseline.",
    "Project memory lives under ./memory.",
  ].join(" ");
}

const entrypoint = process.argv[1];
const isDirectRun =
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isDirectRun) {
  console.log(describePraxisBootstrap());
}
