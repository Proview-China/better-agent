import type { CapabilityPoolHealthRecord } from "../capability-pool/pool-health.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import type { TapCapabilityRegistrationAuditEntry } from "../integrations/tap-capability-family-assembly.js";
import type {
  TapAvailabilityFamilyKey,
  TapCapabilityAvailabilityContract,
  TapCapabilityEvidenceRecord,
  TapCapabilityHealthSource,
  TapCapabilitySmokeSource,
} from "./availability-types.js";

export interface CreateTapCapabilityAvailabilityContractInput {
  capabilityPackage: CapabilityPackage;
  familyKey?: TapAvailabilityFamilyKey;
  registration?: TapCapabilityRegistrationAuditEntry;
  healthRecord?: CapabilityPoolHealthRecord;
}

type TapCapabilityAvailabilityContractArg =
  | CapabilityPackage
  | CreateTapCapabilityAvailabilityContractInput;

function normalizeInput(
  input: TapCapabilityAvailabilityContractArg,
): CreateTapCapabilityAvailabilityContractInput {
  if ("manifest" in input && "verification" in input) {
    return {
      capabilityPackage: input,
    };
  }
  return input;
}

function inferFamilyKey(capabilityKey: string): TapAvailabilityFamilyKey {
  if (capabilityKey === "search.ground") {
    return "websearch";
  }
  if (capabilityKey.startsWith("skill.")) {
    return "skill";
  }
  if (capabilityKey.startsWith("mcp.")) {
    return "mcp";
  }
  return "foundation";
}

function inferHealthCheckSupport(capabilityPackage: CapabilityPackage): boolean {
  const capabilityKey = capabilityPackage.manifest.capabilityKey;
  return capabilityKey === "search.ground"
    || capabilityKey.startsWith("skill.")
    || capabilityKey.startsWith("mcp.");
}

function resolveHealthSource(params: {
  capabilityPackage: CapabilityPackage;
  registration?: TapCapabilityRegistrationAuditEntry;
  healthRecord?: CapabilityPoolHealthRecord;
}): TapCapabilityHealthSource {
  if (params.registration?.hasHealthCheck ?? inferHealthCheckSupport(params.capabilityPackage)) {
    return "adapter_health_check";
  }
  if (params.healthRecord) {
    return "adapter_health_check";
  }
  return "verification_entry";
}

function resolveSmokeSource(smokeEntry: string): TapCapabilitySmokeSource {
  return smokeEntry.startsWith("test:")
    ? "test_entry"
    : "verification_entry";
}

export function createTapCapabilityAvailabilityContract(
  input: TapCapabilityAvailabilityContractArg,
): TapCapabilityAvailabilityContract {
  const { capabilityPackage, familyKey, registration, healthRecord } = normalizeInput(input);

  return {
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    familyKey:
      familyKey
      ?? registration?.familyKey
      ?? inferFamilyKey(capabilityPackage.manifest.capabilityKey),
    tier: capabilityPackage.manifest.tier,
    riskLevel: capabilityPackage.policy.riskLevel,
    recommendedMode: capabilityPackage.policy.recommendedMode,
    reviewRequirements: [...capabilityPackage.policy.reviewRequirements],
    supportRouteCount: capabilityPackage.supportMatrix?.routes.length ?? 0,
    activationFactoryRef: capabilityPackage.activationSpec?.adapterFactoryRef,
    activationMode: capabilityPackage.activationSpec?.activationMode,
    targetPool: capabilityPackage.activationSpec?.targetPool,
    replayPolicy: capabilityPackage.replayPolicy,
    verification: capabilityPackage.verification,
    health: {
      healthEntry: capabilityPackage.verification.healthEntry,
      source: resolveHealthSource({ capabilityPackage, registration, healthRecord }),
      requiresBinding: capabilityPackage.activationSpec !== undefined,
      adapterHealthCheckSupported:
        registration?.hasHealthCheck ?? inferHealthCheckSupport(capabilityPackage),
      successCriteria: [...capabilityPackage.verification.successCriteria],
      failureSignals: [...capabilityPackage.verification.failureSignals],
      evidenceOutput: [...capabilityPackage.verification.evidenceOutput],
    },
    smoke: {
      smokeEntry: capabilityPackage.verification.smokeEntry,
      source: resolveSmokeSource(capabilityPackage.verification.smokeEntry),
      successCriteria: [...capabilityPackage.verification.successCriteria],
      failureSignals: [...capabilityPackage.verification.failureSignals],
      evidenceOutput: [...capabilityPackage.verification.evidenceOutput],
    },
    report: {
      usageDocRef: capabilityPackage.usage.usageDocRef,
      successCriteria: [...capabilityPackage.verification.successCriteria],
      failureSignals: [...capabilityPackage.verification.failureSignals],
      evidenceOutput: [...capabilityPackage.verification.evidenceOutput],
    },
    supportsRecovery:
      capabilityPackage.replayPolicy !== "none"
      || capabilityPackage.activationSpec !== undefined,
    packageRef: {
      templateVersion: capabilityPackage.templateVersion,
      version: capabilityPackage.manifest.version,
      generation: capabilityPackage.manifest.generation,
    },
  };
}

export function createTapCapabilityVerificationEvidence(
  input: TapCapabilityAvailabilityContractArg,
): TapCapabilityEvidenceRecord[] {
  const { capabilityPackage } = normalizeInput(input);
  const capabilityKey = capabilityPackage.manifest.capabilityKey;
  const evidence: TapCapabilityEvidenceRecord[] = [
    {
      source: "package_verification",
      status: "declared",
      ref: capabilityPackage.verification.smokeEntry,
      summary: `Declared smoke entry for ${capabilityKey}.`,
    },
    {
      source: "package_verification",
      status: "declared",
      ref: capabilityPackage.verification.healthEntry,
      summary: `Declared health entry for ${capabilityKey}.`,
    },
    {
      source: "report",
      status: "declared",
      ref: capabilityPackage.usage.usageDocRef,
      summary: `Declared usage and report reference for ${capabilityKey}.`,
      metadata: {
        evidenceOutput: [...capabilityPackage.verification.evidenceOutput],
      },
    },
  ];

  if (capabilityPackage.supportMatrix) {
    for (const route of capabilityPackage.supportMatrix.routes) {
      evidence.push({
        source: "support_matrix",
        status: "declared",
        ref: `${route.provider}:${route.sdkLayer}:${route.lowering}:${route.status}`,
        summary: `Declared support route for ${capabilityKey}.`,
      });
    }
  }

  if (capabilityPackage.activationSpec?.adapterFactoryRef) {
    evidence.push({
      source: "activation_spec",
      status: "declared",
      ref: capabilityPackage.activationSpec.adapterFactoryRef,
      summary: `Declared activation factory for ${capabilityKey}.`,
      metadata: {
        activationMode: capabilityPackage.activationSpec.activationMode,
        targetPool: capabilityPackage.activationSpec.targetPool,
      },
    });
  }

  return evidence;
}
