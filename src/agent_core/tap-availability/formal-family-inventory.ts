import {
  createCapabilityManifestFromPackage,
  createMcpCapabilityPackage,
  createMcpReadCapabilityPackage,
  createRaxMpCapabilityPackageCatalog,
  createRaxSkillCapabilityPackageCatalog,
  createTapToolingBaselineCapabilityPackages,
  createTapVendorNetworkCapabilityPackageCatalog,
  createTapVendorUserIoCapabilityPackageCatalog,
  listFirstClassToolingBaselineCapabilityPackages,
  type CapabilityPackage,
} from "../capability-package/index.js";
import type {
  TapFormalFamilyInventory,
  TapFormalFamilyInventoryEntry,
  TapFormalFamilyKey,
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
  return [
    ...listFirstClassToolingBaselineCapabilityPackages().map((capabilityPackage) =>
      createEntry({
        familyKey: "foundation",
        capabilityPackage,
        packageSourceRef:
          "capability-package/first-class-tooling-baseline#listFirstClassToolingBaselineCapabilityPackages",
        registerHelperRef: "integrations/workspace-read-adapter#registerFirstClassToolingBaselineCapabilities",
      })),
    ...createTapToolingBaselineCapabilityPackages().map((capabilityPackage) =>
      createEntry({
        familyKey: "foundation",
        capabilityPackage,
        packageSourceRef:
          "capability-package/tap-tooling-baseline#createTapToolingBaselineCapabilityPackages",
        registerHelperRef: "integrations/tap-tooling-adapter#registerTapToolingBaseline",
      })),
  ];
}

function buildWebsearchEntries(): TapFormalFamilyInventoryEntry[] {
  return createTapVendorNetworkCapabilityPackageCatalog().map((capabilityPackage) =>
    createEntry({
      familyKey: "websearch",
      capabilityPackage,
      packageSourceRef:
        "capability-package/vendor-network-capability-package#createTapVendorNetworkCapabilityPackageCatalog",
      registerHelperRef: "integrations/tap-vendor-network-adapter#registerTapVendorNetworkCapabilityFamily",
    }));
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
  return [
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpReadCapabilityPackage({ capabilityKey: "mcp.listTools" }),
      packageSourceRef:
        "capability-package/mcp-read-family-package#createMcpReadCapabilityPackage",
      registerHelperRef: "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpReadCapabilityPackage({ capabilityKey: "mcp.listResources" }),
      packageSourceRef:
        "capability-package/mcp-read-family-package#createMcpReadCapabilityPackage",
      registerHelperRef: "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpReadCapabilityPackage({ capabilityKey: "mcp.readResource" }),
      packageSourceRef:
        "capability-package/mcp-read-family-package#createMcpReadCapabilityPackage",
      registerHelperRef: "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpCapabilityPackage({ capabilityKey: "mcp.call" }),
      packageSourceRef:
        "capability-package/capability-package#createMcpCapabilityPackage",
      registerHelperRef: "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
    }),
    createEntry({
      familyKey: "mcp",
      capabilityPackage: createMcpCapabilityPackage({ capabilityKey: "mcp.native.execute" }),
      packageSourceRef:
        "capability-package/capability-package#createMcpCapabilityPackage",
      registerHelperRef: "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
    }),
  ];
}

function buildMpEntries(): TapFormalFamilyInventoryEntry[] {
  return createRaxMpCapabilityPackageCatalog().map((capabilityPackage) =>
    createEntry({
      familyKey: "mp",
      capabilityPackage,
      packageSourceRef:
        "capability-package/mp-family-capability-package#createRaxMpCapabilityPackageCatalog",
      registerHelperRef: "integrations/rax-mp-adapter#registerRaxMpCapabilityFamily",
    }));
}

function buildUserIoEntries(): TapFormalFamilyInventoryEntry[] {
  return createTapVendorUserIoCapabilityPackageCatalog().map((capabilityPackage) =>
    createEntry({
      familyKey: "userio",
      capabilityPackage,
      packageSourceRef:
        "capability-package/vendor-user-io-capability-package#createTapVendorUserIoCapabilityPackageCatalog",
      registerHelperRef: "integrations/tap-vendor-user-io-adapter#registerTapVendorUserIoFamily",
    }));
}

export function listTapFormalFamilyInventoryEntries(): TapFormalFamilyInventoryEntry[] {
  return [
    ...buildFoundationEntries(),
    ...buildWebsearchEntries(),
    ...buildSkillEntries(),
    ...buildMcpEntries(),
    ...buildMpEntries(),
    ...buildUserIoEntries(),
  ];
}

export function createTapFormalFamilyInventory(): TapFormalFamilyInventory {
  const entries = listTapFormalFamilyInventoryEntries();
  const familyKeys = ["foundation", "websearch", "skill", "mcp", "mp", "userio"] as const;
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
