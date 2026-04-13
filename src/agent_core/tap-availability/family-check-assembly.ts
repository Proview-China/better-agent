import type { CapabilityAdapter, CapabilityManifest } from "../capability-types/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";
import {
  registerTapCapabilityFamilyAssembly,
  type RegisterTapCapabilityFamilyAssemblyInput,
  type TapActivationFactoryAuditEntry,
  type TapCapabilityRegistrationAuditEntry,
} from "../integrations/tap-capability-family-assembly.js";
import {
  createTapCapabilityAvailabilityReport,
  type CreateTapCapabilityAvailabilityReportInput,
} from "./availability-audit.js";
import type { TapCapabilityAvailabilityReport } from "./availability-types.js";
import type { TapFamilyCheckReport } from "./family-check-types.js";
import { createFoundationFamilyCheckReport } from "./foundation-family-check.js";
import { createWebsearchFamilyCheckReport } from "./websearch-family-check.js";
import { createSkillFamilyCheckReport } from "./skill-family-check.js";
import { createMcpFamilyCheckReport } from "./mcp-family-check.js";
import { createMpFamilyCheckReport } from "./mp-family-check.js";
import { createUserIoFamilyCheckReport } from "./userio-family-check.js";

class RecordingTapAssemblyRuntime {
  readonly registrationAudit: TapCapabilityRegistrationAuditEntry[] = [];
  readonly activationFactoryAuditMap = new Map<string, TapActivationFactoryAuditEntry>();

  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ) {
    const bindingId = `binding:${manifest.capabilityKey}`;
    this.registrationAudit.push({
      capabilityKey: manifest.capabilityKey,
      manifest,
      adapterId: adapter.id,
      runtimeKind: adapter.runtimeKind,
      bindingId,
      supportsPrepare: manifest.supportsPrepare ?? false,
      supportsCancellation: manifest.supportsCancellation ?? false,
      hasHealthCheck: typeof adapter.healthCheck === "function",
    });
    return {
      bindingId,
      capabilityId: manifest.capabilityId,
      generation: manifest.generation,
      adapterId: adapter.id,
      runtimeKind: adapter.runtimeKind,
      state: "active" as const,
    };
  }

  registerTaActivationFactory(ref: string, _factory: ActivationAdapterFactory): void {
    this.activationFactoryAuditMap.set(ref, {
      ref,
    });
  }
}

export interface CreateTapLiveAvailabilityReportInput
  extends Omit<RegisterTapCapabilityFamilyAssemblyInput, "runtime">,
    Omit<CreateTapCapabilityAvailabilityReportInput, "registrationAudit" | "activationFactoryAudit"> {}

export function createTapLiveAvailabilityReport(
  input: CreateTapLiveAvailabilityReportInput,
): TapCapabilityAvailabilityReport {
  const runtime = new RecordingTapAssemblyRuntime();
  const assembly = registerTapCapabilityFamilyAssembly({
    ...input,
    runtime,
  });

  for (const entry of assembly.activationFactoryAudit) {
    runtime.activationFactoryAuditMap.set(entry.ref, entry);
  }
  for (const entry of runtime.registrationAudit) {
    const familyKey = assembly.registrationAudit.find((audit) =>
      audit.capabilityKey === entry.capabilityKey
    )?.familyKey;
    entry.familyKey = familyKey;
  }

  return createTapCapabilityAvailabilityReport({
    inventory: input.inventory,
    registrationAudit: runtime.registrationAudit,
    activationFactoryAudit: [...runtime.activationFactoryAuditMap.values()],
    healthRecords: input.healthRecords,
    now: input.now,
    metadata: {
      source: "tap-live-availability-report",
      ...(input.metadata ?? {}),
    },
  });
}

export function createTapFormalFamilyCheckReports(
  report: TapCapabilityAvailabilityReport,
): Record<string, TapFamilyCheckReport> {
  return {
    foundation: createFoundationFamilyCheckReport(report),
    websearch: createWebsearchFamilyCheckReport(report),
    skill: createSkillFamilyCheckReport(report),
    mcp: createMcpFamilyCheckReport(report),
    mp: createMpFamilyCheckReport(report),
    userio: createUserIoFamilyCheckReport(report),
  };
}
