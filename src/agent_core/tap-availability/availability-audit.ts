import type {
  CapabilityBinding,
  CapabilityManifest,
} from "../capability-types/index.js";
import type { CapabilityPoolHealthRecord } from "../capability-pool/pool-health.js";
import type {
  TapActivationFactoryAuditEntry,
  TapCapabilityRegistrationAuditEntry,
} from "../integrations/tap-capability-family-assembly.js";
import {
  createTapCapabilityAvailabilityContract,
  createTapCapabilityVerificationEvidence,
} from "./availability-contract.js";
import { createTapFormalFamilyInventory } from "./formal-family-inventory.js";
import type {
  TapCapabilityAvailabilityFamilySummary,
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityTruthTable,
  TapCapabilityEvidenceRecord,
  TapFormalFamilyInventory,
  TapFormalFamilyInventoryEntry,
} from "./availability-types.js";

export interface CreateTapCapabilityAvailabilityReportInput {
  inventory?: TapFormalFamilyInventory;
  manifests?: readonly CapabilityManifest[];
  bindings?: readonly CapabilityBinding[];
  registrationAudit?: readonly TapCapabilityRegistrationAuditEntry[];
  activationFactoryAudit?: readonly TapActivationFactoryAuditEntry[];
  healthRecords?: readonly CapabilityPoolHealthRecord[];
  now?: () => Date;
  metadata?: Record<string, unknown>;
}

function createObservedEvidence(params: {
  entry: TapFormalFamilyInventoryEntry;
  manifest?: CapabilityManifest;
  registration?: TapCapabilityRegistrationAuditEntry;
  binding?: CapabilityBinding;
  activationFactory?: TapActivationFactoryAuditEntry;
  healthRecords: readonly CapabilityPoolHealthRecord[];
}): TapCapabilityEvidenceRecord[] {
  const capabilityKey = params.entry.capabilityKey;
  const evidence: TapCapabilityEvidenceRecord[] = [
    {
      source: "registered_manifest",
      status: params.manifest || params.registration ? "observed" : "missing",
      ref:
        params.manifest?.capabilityId
        ?? params.registration?.manifest.capabilityId
        ?? `missing:${capabilityKey}:manifest`,
      summary: params.manifest || params.registration
        ? `Capability ${capabilityKey} is registered through TAP family assembly.`
        : `Capability ${capabilityKey} is not registered through TAP family assembly.`,
    },
    {
      source: "binding",
      status: params.binding || params.registration?.bindingId ? "observed" : "missing",
      ref:
        params.binding?.bindingId
        ?? params.registration?.bindingId
        ?? `missing:${capabilityKey}:binding`,
      summary: params.binding || params.registration?.bindingId
        ? `Capability ${capabilityKey} has a binding audit entry.`
        : `Capability ${capabilityKey} has no binding audit entry.`,
    },
  ];

  if (params.activationFactory) {
    evidence.push({
      source: "activation_spec",
      status: "observed",
      ref: params.activationFactory.ref,
      summary: `Capability ${capabilityKey} has a registered activation factory audit entry.`,
    });
  }

  if (params.healthRecords.length > 0) {
    for (const healthRecord of params.healthRecords) {
      evidence.push({
        source: "pool_health",
        status: "observed",
        ref: healthRecord.bindingId,
        summary: `Capability ${capabilityKey} has a pool health observation.`,
        metadata: {
          state: healthRecord.state,
          checkedAt: healthRecord.checkedAt,
        },
      });
    }
  } else {
    evidence.push({
      source: "pool_health",
      status: "missing",
      ref: `missing:${capabilityKey}:health`,
      summary: `Capability ${capabilityKey} has no pool health observation yet.`,
    });
  }

  return evidence;
}

function createGate(params: {
  registered: boolean;
  prepareReady: boolean;
  executeReady: boolean;
  healthy: boolean;
  hasActivationFactory: boolean;
  adapterHealthCheckSupported: boolean;
}) {
  const reasons: string[] = [];
  if (!params.registered) {
    reasons.push("missing_registration");
  }
  if (!params.prepareReady) {
    reasons.push("missing_prepare_readiness");
  }
  if (!params.executeReady) {
    reasons.push("missing_execute_readiness");
  }
  if (!params.hasActivationFactory) {
    reasons.push("missing_activation_factory");
  }
  if (params.adapterHealthCheckSupported && !params.healthy) {
    reasons.push("missing_runtime_health_observation");
  }

  if (reasons.length === 0) {
    return {
      status: "ready" as const,
      reasons,
    };
  }

  const onlyHealthGap = reasons.every(
    (reason) => reason === "missing_runtime_health_observation",
  );
  if (onlyHealthGap) {
    return {
      status: "review_required" as const,
      reasons,
    };
  }

  return {
    status: "blocked" as const,
    reasons,
  };
}

function createRow(params: {
  entry: TapFormalFamilyInventoryEntry;
  manifest?: CapabilityManifest;
  binding?: CapabilityBinding;
  registration?: TapCapabilityRegistrationAuditEntry;
  activationFactory?: TapActivationFactoryAuditEntry;
  healthRecords: readonly CapabilityPoolHealthRecord[];
}) {
  const contract = createTapCapabilityAvailabilityContract({
    capabilityPackage: params.entry.capabilityPackage,
    registration: params.registration,
    healthRecord: params.healthRecords[0],
  });
  const observed = {
    manifest: params.manifest ?? params.registration?.manifest,
    hasActivationFactory: params.activationFactory !== undefined,
    bindingIds:
      params.binding?.bindingId
        ? [params.binding.bindingId]
        : params.registration?.bindingId
          ? [params.registration.bindingId]
          : [],
    bindingStates: params.binding ? [params.binding.state] : [],
    healthRecords: [...params.healthRecords],
    registered: params.manifest !== undefined || params.registration !== undefined,
    prepareReady:
      (params.manifest !== undefined || params.registration !== undefined)
      && params.entry.capabilityPackage.adapter.prepare.ref.length > 0,
    executeReady:
      (params.manifest !== undefined || params.registration !== undefined)
      && params.entry.capabilityPackage.adapter.execute.ref.length > 0,
    healthy: params.healthRecords.some((record) => record.state === "healthy"),
  };
  const gate = createGate({
    registered: observed.registered,
    prepareReady: observed.prepareReady,
    executeReady: observed.executeReady,
    healthy: observed.healthy,
    hasActivationFactory: observed.hasActivationFactory,
    adapterHealthCheckSupported: contract.health.adapterHealthCheckSupported,
  });

  return {
    familyKey: params.entry.familyKey,
    capabilityKey: params.entry.capabilityKey,
    packageSourceRef: params.entry.packageSourceRef,
    registerHelperRef: params.entry.registerHelperRef,
    assemblyRef: params.entry.assemblyRef,
    activationFactoryRefs: [...params.entry.activationFactoryRefs],
    supportRoutes: params.entry.capabilityPackage.supportMatrix?.routes.length ?? 0,
    contract,
    observed,
    gate,
    evidence: [
      ...createTapCapabilityVerificationEvidence(params.entry.capabilityPackage),
      ...createObservedEvidence({
        entry: params.entry,
        manifest: params.manifest,
        registration: params.registration,
        binding: params.binding,
        activationFactory: params.activationFactory,
        healthRecords: params.healthRecords,
      }),
    ],
  };
}

function summarizeFamilies(
  rows: readonly TapCapabilityAvailabilityReport["rows"][number][],
): TapCapabilityAvailabilityFamilySummary[] {
  const familyKeys = [...new Set(rows.map((row) => row.familyKey))];
  return familyKeys.map((familyKey) => {
    const familyRows = rows.filter((row) => row.familyKey === familyKey);
    return {
      familyKey,
      total: familyRows.length,
      registered: familyRows.filter((row) => row.observed.registered).length,
      executeReady: familyRows.filter((row) => row.observed.executeReady).length,
      healthy: familyRows.filter((row) => row.observed.healthy).length,
      ready: familyRows.filter((row) => row.gate.status === "ready").length,
      reviewRequired: familyRows.filter((row) => row.gate.status === "review_required").length,
      blocked: familyRows.filter((row) => row.gate.status === "blocked").length,
    };
  });
}

export function createTapCapabilityAvailabilityTruthTable(
  input: CreateTapCapabilityAvailabilityReportInput = {},
): TapCapabilityAvailabilityTruthTable {
  const inventory = input.inventory ?? createTapFormalFamilyInventory();
  const registrationByCapability = new Map(
    (input.registrationAudit ?? []).map((entry) => [entry.capabilityKey, entry] as const),
  );
  const activationByCapability = new Map(
    (input.activationFactoryAudit ?? [])
      .filter((entry): entry is TapActivationFactoryAuditEntry & { capabilityKey: string } =>
        typeof entry.capabilityKey === "string" && entry.capabilityKey.length > 0,
      )
      .map((entry) => [entry.capabilityKey, entry] as const),
  );
  const healthByBinding = new Map(
    (input.healthRecords ?? []).map((entry) => [entry.bindingId, entry] as const),
  );
  const manifestsByCapabilityId = new Map(
    (input.manifests ?? []).map((entry) => [entry.capabilityId, entry] as const),
  );
  const bindingsByCapabilityId = new Map(
    (input.bindings ?? []).map((entry) => [entry.capabilityId, entry] as const),
  );

  const rows = inventory.entries.map((entry) => {
    const registration = registrationByCapability.get(entry.capabilityKey);
    const manifest = manifestsByCapabilityId.get(entry.manifest.capabilityId);
    const binding = bindingsByCapabilityId.get(entry.manifest.capabilityId);
    const bindingId = binding?.bindingId ?? registration?.bindingId;
    const healthRecords = bindingId
      ? [healthByBinding.get(bindingId)].filter(
        (record): record is CapabilityPoolHealthRecord => record !== undefined,
      )
      : [];
    return createRow({
      entry,
      manifest,
      binding,
      registration,
      activationFactory: activationByCapability.get(entry.capabilityKey),
      healthRecords,
    });
  });

  return {
    inventory,
    rows,
  };
}

export function createTapCapabilityAvailabilityReport(
  input: CreateTapCapabilityAvailabilityReportInput = {},
): TapCapabilityAvailabilityReport {
  const truthTable = createTapCapabilityAvailabilityTruthTable(input);
  return {
    generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    inventory: truthTable.inventory,
    rows: truthTable.rows,
    summary: {
      totalCapabilities: truthTable.rows.length,
      registeredCapabilities: truthTable.rows.filter((row) => row.observed.registered).length,
      executeReadyCapabilities: truthTable.rows.filter((row) => row.observed.executeReady).length,
      healthyCapabilities: truthTable.rows.filter((row) => row.observed.healthy).length,
      readyCapabilities: truthTable.rows.filter((row) => row.gate.status === "ready").length,
      reviewRequiredCapabilities: truthTable.rows.filter((row) => row.gate.status === "review_required").length,
      blockedCapabilities: truthTable.rows.filter((row) => row.gate.status === "blocked").length,
    },
    families: summarizeFamilies(truthTable.rows),
    metadata: input.metadata,
  };
}
