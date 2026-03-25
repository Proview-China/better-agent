import {
  createCapabilityManifestFromPackage,
  createMcpCapabilityPackage,
  createMcpReadCapabilityPackage,
  createRaxSkillCapabilityPackageCatalog,
  createRaxWebsearchCapabilityPackage,
  createTapToolingBaselineCapabilityPackages,
  listFirstClassToolingBaselineCapabilityPackages,
  type CapabilityPackage,
} from "../capability-package/index.js";
import type {
  TapFormalFamilyKey,
  TapFormalFamilyInventory,
  TapFormalFamilyInventoryEntry,
} from "./availability-types.js";

const TAP_ASSEMBLY_REF =
  "integrations/tap-capability-family-assembly#registerTapCapabilityFamilyAssembly";

function createEntry(params: {
  familyKey: TapFormalFamilyKey;
  capabilityPackage: CapabilityPackage;
  packageSourceRef: string;
  registerHelperRef: string;
}): TapFormalFamilyInventoryEntry {
  return {
    familyKey: params.familyKey,
    capabilityKey: params.capabilityPackage.manifest.capabilityKey,
    capabilityPackage: params.capabilityPackage,
    manifest: createCapabilityManifestFromPackage(params.capabilityPackage),
    packageSourceRef: params.packageSourceRef,
    registerHelperRef: params.registerHelperRef,
    assemblyRef: TAP_ASSEMBLY_REF,
    activationFactoryRefs: params.capabilityPackage.activationSpec?.adapterFactoryRef
      ? [params.capabilityPackage.activationSpec.adapterFactoryRef]
      : [],
  };
}

function buildFoundationEntries(): TapFormalFamilyInventoryEntry[] {
  const firstClassSource =
    "capability-package/first-class-tooling-baseline#listFirstClassToolingBaselineCapabilityPackages";
  const firstClassRegisterHelper =
    "integrations/workspace-read-adapter#registerFirstClassToolingBaselineCapabilities";
  const tapToolingSource =
    "capability-package/tap-tooling-baseline#createTapToolingBaselineCapabilityPackages";
  const tapToolingRegisterHelper =
    "integrations/tap-tooling-adapter#registerTapToolingBaseline";

  return [
    ...listFirstClassToolingBaselineCapabilityPackages().map((capabilityPackage) =>
      createEntry({
        familyKey: "foundation",
        capabilityPackage,
        packageSourceRef: firstClassSource,
        registerHelperRef: firstClassRegisterHelper,
      })),
    ...createTapToolingBaselineCapabilityPackages().map((capabilityPackage) =>
      createEntry({
        familyKey: "foundation",
        capabilityPackage,
        packageSourceRef: tapToolingSource,
        registerHelperRef: tapToolingRegisterHelper,
      })),
  ];
}

function buildWebsearchEntries(): TapFormalFamilyInventoryEntry[] {
  return [
    createEntry({
      familyKey: "websearch",
      capabilityPackage: createRaxWebsearchCapabilityPackage(),
      packageSourceRef:
        "capability-package/search-ground-capability-package#createRaxWebsearchCapabilityPackage",
      registerHelperRef: "integrations/rax-websearch-adapter#registerRaxWebsearchCapability",
    }),
  ];
}

function buildSkillEntries(): TapFormalFamilyInventoryEntry[] {
  return createRaxSkillCapabilityPackageCatalog().map((capabilityPackage) =>
    createEntry({
      familyKey: "skill",
      capabilityPackage,
      packageSourceRef:
        "capability-package/skill-family-capability-package#createRaxSkillCapabilityPackageCatalog",
      registerHelperRef: "integrations/rax-skill-adapter#registerRaxSkillCapabilityFamily",
    }));
}

function buildMcpEntries(): TapFormalFamilyInventoryEntry[] {
  const readSource =
    "capability-package/mcp-read-family-package#createMcpReadCapabilityPackage";
  const mcpRegisterHelper = "integrations/rax-mcp-adapter#registerRaxMcpCapabilities";
  const invokeSource = "capability-package/capability-package#createMcpCapabilityPackage";

  return [
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpReadCapabilityPackage({ capabilityKey: "mcp.listTools" }),
      packageSourceRef: readSource,
      registerHelperRef: mcpRegisterHelper,
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpReadCapabilityPackage({ capabilityKey: "mcp.readResource" }),
      packageSourceRef: readSource,
      registerHelperRef: mcpRegisterHelper,
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpCapabilityPackage({ capabilityKey: "mcp.call" }),
      packageSourceRef: invokeSource,
      registerHelperRef: mcpRegisterHelper,
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpCapabilityPackage({ capabilityKey: "mcp.native.execute" }),
      packageSourceRef: invokeSource,
      registerHelperRef: mcpRegisterHelper,
    }),
  ];
}

export function listTapFormalFamilyInventoryEntries(): TapFormalFamilyInventoryEntry[] {
  return [
    ...buildFoundationEntries(),
    ...buildWebsearchEntries(),
    ...buildSkillEntries(),
    ...buildMcpEntries(),
  ];
}

export function createTapFormalFamilyInventory(): TapFormalFamilyInventory {
  const entries = listTapFormalFamilyInventoryEntries();
  const familyKeys = ["foundation", "websearch", "skill", "mcp"] as const;
  const families = familyKeys.map((familyKey) => {
    const familyEntries = entries.filter((entry) => entry.familyKey === familyKey);
    return {
      familyKey,
      capabilityKeys: familyEntries.map((entry) => entry.capabilityKey),
      packageSourceRefs: [...new Set(familyEntries.map((entry) => entry.packageSourceRef))],
      registerHelperRefs: [...new Set(familyEntries.map((entry) => entry.registerHelperRef))],
      assemblyRef: TAP_ASSEMBLY_REF,
      activationFactoryRefs: [...new Set(familyEntries.flatMap((entry) => entry.activationFactoryRefs))],
      packageCount: familyEntries.length,
      entries: familyEntries,
    };
  });

  return {
    familyKeys: [...familyKeys],
    capabilityKeys: entries.map((entry) => entry.capabilityKey),
    assemblyRef: TAP_ASSEMBLY_REF,
    families,
    entries,
  };
}

export function getTapFormalFamilyInventoryFamily(
  familyKey: TapFormalFamilyKey,
) {
  return createTapFormalFamilyInventory().families.find((family) => family.familyKey === familyKey);
}
