import type { CapabilityAdapter, CapabilityManifest } from "../capability-types/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";
import type { RegisterRaxMcpCapabilitiesInput } from "./rax-mcp-adapter.js";
import type { RegisterRaxMpCapabilityFamilyInput } from "./rax-mp-adapter.js";
import type { RegisterRaxSkillCapabilityFamilyInput } from "./rax-skill-adapter.js";
import type { TapToolingAdapterOptions } from "./tap-tooling-adapter.js";
import type { TapVendorNetworkAdapterOptions } from "./tap-vendor-network-adapter.js";
import type { WorkspaceReadActivationFactoryOptions } from "./workspace-read-adapter.js";
import { registerRaxMcpCapabilities } from "./rax-mcp-adapter.js";
import { registerRaxMpCapabilityFamily } from "./rax-mp-adapter.js";
import { registerRaxSkillCapabilityFamily } from "./rax-skill-adapter.js";
import { registerTapToolingBaseline } from "./tap-tooling-adapter.js";
import { registerTapVendorNetworkCapabilityFamily } from "./tap-vendor-network-adapter.js";
import { registerTapVendorUserIoFamily } from "./tap-vendor-user-io-adapter.js";
import { registerFirstClassToolingBaselineCapabilities } from "./workspace-read-adapter.js";

export const TAP_FORMAL_CAPABILITY_FAMILY_KEYS = [
  "foundation",
  "websearch",
  "skill",
  "mcp",
  "mp",
  "userio",
] as const;
export type TapFormalCapabilityFamilyKey =
  (typeof TAP_FORMAL_CAPABILITY_FAMILY_KEYS)[number];

export interface TapCapabilityFamilyAssemblyTarget {
  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ): unknown;
  registerTaActivationFactory(
    ref: string,
    factory: ActivationAdapterFactory,
  ): void;
}

export interface RegisterTapCapabilityFamilyAssemblyInput {
  runtime: TapCapabilityFamilyAssemblyTarget;
  foundation: {
    workspaceRoot: string;
    read?: Partial<Omit<WorkspaceReadActivationFactoryOptions, "workspaceRoot" | "capabilityKey">>;
    tooling?: Omit<TapToolingAdapterOptions, "workspaceRoot">;
  };
  websearch?: Omit<TapVendorNetworkAdapterOptions, "capabilityKey">;
  skill?: Omit<RegisterRaxSkillCapabilityFamilyInput, "runtime">;
  mcp?: Omit<RegisterRaxMcpCapabilitiesInput, "runtime">;
  mp?: Omit<RegisterRaxMpCapabilityFamilyInput, "runtime">;
  userio?: {
    capabilityKeys?: readonly ("request_user_input" | "request_permissions")[];
  };
  includeFamilies?: Partial<Record<TapFormalCapabilityFamilyKey, boolean>>;
}

export interface TapCapabilityRegistrationAuditEntry {
  capabilityKey: string;
  familyKey?: TapFormalCapabilityFamilyKey;
  manifest: CapabilityManifest;
  adapterId: string;
  runtimeKind: string;
  bindingId?: string;
  supportsPrepare: boolean;
  supportsCancellation: boolean;
  hasHealthCheck: boolean;
}

export interface TapActivationFactoryAuditEntry {
  ref: string;
  capabilityKey?: string;
  familyKey?: TapFormalCapabilityFamilyKey;
}

export interface RegisterTapCapabilityFamilyAssemblyResult {
  packages: CapabilityPackage[];
  bindings: unknown[];
  activationFactoryRefs: string[];
  familyKeys: Record<TapFormalCapabilityFamilyKey, string[]>;
  registrationAudit: TapCapabilityRegistrationAuditEntry[];
  activationFactoryAudit: TapActivationFactoryAuditEntry[];
}

function createEmptyFamilyKeys(): Record<TapFormalCapabilityFamilyKey, string[]> {
  return {
    foundation: [],
    websearch: [],
    skill: [],
    mcp: [],
    mp: [],
    userio: [],
  };
}

function readBindingId(binding: unknown): string | undefined {
  if (!binding || typeof binding !== "object") {
    return undefined;
  }

  const candidate = (binding as { bindingId?: unknown }).bindingId;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

export function registerTapCapabilityFamilyAssembly(
  input: RegisterTapCapabilityFamilyAssemblyInput,
): RegisterTapCapabilityFamilyAssemblyResult {
  const packages: CapabilityPackage[] = [];
  const bindings: unknown[] = [];
  const activationFactoryRefs = new Set<string>();
  const familyKeys = createEmptyFamilyKeys();
  const registrationAudit: TapCapabilityRegistrationAuditEntry[] = [];
  const includeFamilies: Record<TapFormalCapabilityFamilyKey, boolean> = {
    foundation: input.includeFamilies?.foundation ?? true,
    websearch: input.includeFamilies?.websearch ?? true,
    skill: input.includeFamilies?.skill ?? true,
    mcp: input.includeFamilies?.mcp ?? true,
    mp: input.includeFamilies?.mp ?? true,
    userio: input.includeFamilies?.userio ?? true,
  };
  const runtime: TapCapabilityFamilyAssemblyTarget = {
    registerCapabilityAdapter(manifest, adapter) {
      const binding = input.runtime.registerCapabilityAdapter(manifest, adapter);
      registrationAudit.push({
        capabilityKey: manifest.capabilityKey,
        manifest,
        adapterId: adapter.id,
        runtimeKind: adapter.runtimeKind,
        bindingId: readBindingId(binding),
        supportsPrepare: manifest.supportsPrepare ?? false,
        supportsCancellation: manifest.supportsCancellation ?? false,
        hasHealthCheck: typeof adapter.healthCheck === "function",
      });
      return binding;
    },
    registerTaActivationFactory(ref, factory) {
      activationFactoryRefs.add(ref);
      input.runtime.registerTaActivationFactory(ref, factory);
    },
  };

  if (includeFamilies.foundation) {
    const firstClass = registerFirstClassToolingBaselineCapabilities({
      runtime,
      workspaceRoot: input.foundation.workspaceRoot,
    });
    const tapTooling = registerTapToolingBaseline(runtime, {
      workspaceRoot: input.foundation.workspaceRoot,
      ...(input.foundation.tooling ?? {}),
    });
    packages.push(...firstClass.packages, ...tapTooling.packages);
    bindings.push(...firstClass.bindings, ...tapTooling.bindings);
    familyKeys.foundation.push(
      ...firstClass.capabilityKeys,
      ...tapTooling.capabilityKeys,
    );
    for (const capabilityPackage of [...firstClass.packages, ...tapTooling.packages]) {
      const ref = capabilityPackage.activationSpec?.adapterFactoryRef;
      if (ref) {
        activationFactoryRefs.add(ref);
      }
    }
  }

  if (includeFamilies.websearch) {
    const registration = registerTapVendorNetworkCapabilityFamily({
      runtime,
      facade: input.websearch?.facade,
      fetcher: input.websearch?.fetcher,
    });
    packages.push(...registration.packages);
    bindings.push(...registration.bindings);
    familyKeys.websearch.push(...registration.capabilityKeys);
    for (const ref of registration.activationFactoryRefs) {
      activationFactoryRefs.add(ref);
    }
  }

  if (includeFamilies.skill) {
    const registration = registerRaxSkillCapabilityFamily({
      runtime,
      ...input.skill,
    });
    packages.push(...registration.packages);
    bindings.push(...registration.bindings);
    familyKeys.skill.push(...registration.capabilityKeys);
    for (const ref of registration.activationFactoryRefs) {
      activationFactoryRefs.add(ref);
    }
  }

  if (includeFamilies.mcp) {
    const registration = registerRaxMcpCapabilities({
      runtime,
      ...input.mcp,
    });
    packages.push(...registration.packages);
    bindings.push(...registration.bindings);
    familyKeys.mcp.push(...registration.capabilityKeys);
    for (const ref of registration.activationFactoryRefs) {
      activationFactoryRefs.add(ref);
    }
  }

  if (includeFamilies.mp) {
    const registration = registerRaxMpCapabilityFamily({
      runtime,
      ...input.mp,
    });
    packages.push(...registration.packages);
    bindings.push(...registration.bindings);
    familyKeys.mp.push(...registration.capabilityKeys);
    for (const ref of registration.activationFactoryRefs) {
      activationFactoryRefs.add(ref);
    }
  }

  if (includeFamilies.userio) {
    const registration = registerTapVendorUserIoFamily({
      runtime,
      capabilityKeys: input.userio?.capabilityKeys,
    });
    packages.push(...registration.packages);
    bindings.push(...registration.bindings);
    familyKeys.userio.push(...registration.capabilityKeys);
    for (const ref of registration.activationFactoryRefs) {
      activationFactoryRefs.add(ref);
    }
  }

  const capabilityToFamily = new Map<string, TapFormalCapabilityFamilyKey>();
  for (const familyKey of TAP_FORMAL_CAPABILITY_FAMILY_KEYS) {
    for (const capabilityKey of familyKeys[familyKey]) {
      capabilityToFamily.set(capabilityKey, familyKey);
    }
  }
  for (const entry of registrationAudit) {
    entry.familyKey = capabilityToFamily.get(entry.capabilityKey);
  }
  const activationFactoryAudit = [...activationFactoryRefs].map((ref) => {
    const capabilityPackage = packages.find(
      (item) => item.activationSpec?.adapterFactoryRef === ref,
    );
    const capabilityKey = capabilityPackage?.manifest.capabilityKey;
    return {
      ref,
      capabilityKey,
      familyKey: capabilityKey ? capabilityToFamily.get(capabilityKey) : undefined,
    };
  });

  return {
    packages,
    bindings,
    activationFactoryRefs: [...activationFactoryRefs],
    familyKeys,
    registrationAudit,
    activationFactoryAudit,
  };
}
