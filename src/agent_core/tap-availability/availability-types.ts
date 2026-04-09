import type { CapabilityManifest } from "../capability-types/index.js";
import type { CapabilityPackage, CapabilityPackageVerification } from "../capability-package/index.js";
import type { CapabilityPoolHealthRecord } from "../capability-pool/pool-health.js";
import type {
  TapActivationFactoryAuditEntry,
  TapCapabilityRegistrationAuditEntry,
} from "../integrations/tap-capability-family-assembly.js";
import type {
  ReplayPolicy,
  ReviewVote,
  TaPoolMode,
  TaPoolRiskLevel,
} from "../ta-pool-types/index.js";

export const TAP_AVAILABILITY_FAMILY_KEYS = [
  "foundation",
  "websearch",
  "skill",
  "mcp",
  "mp",
  "userio",
] as const;
export const TAP_FORMAL_FAMILY_KEYS = TAP_AVAILABILITY_FAMILY_KEYS;
export type TapAvailabilityFamilyKey =
  (typeof TAP_AVAILABILITY_FAMILY_KEYS)[number];
export type TapFormalFamilyKey = TapAvailabilityFamilyKey;

export const TAP_AVAILABILITY_EVIDENCE_SOURCES = [
  "package_verification",
  "package_usage",
  "report",
  "support_matrix",
  "activation_spec",
  "inventory",
  "registered_manifest",
  "binding",
  "pool_health",
] as const;
export type TapAvailabilityEvidenceSource =
  (typeof TAP_AVAILABILITY_EVIDENCE_SOURCES)[number];

export const TAP_AVAILABILITY_EVIDENCE_STATUSES = [
  "declared",
  "observed",
  "missing",
] as const;
export type TapAvailabilityEvidenceStatus =
  (typeof TAP_AVAILABILITY_EVIDENCE_STATUSES)[number];

export const TAP_CAPABILITY_HEALTH_SOURCES = [
  "verification_entry",
  "adapter_health_check",
  "pool_health_registry",
] as const;
export type TapCapabilityHealthSource =
  (typeof TAP_CAPABILITY_HEALTH_SOURCES)[number];

export const TAP_CAPABILITY_SMOKE_SOURCES = [
  "declared_entry",
  "verification_entry",
  "test_entry",
] as const;
export type TapCapabilitySmokeSource =
  (typeof TAP_CAPABILITY_SMOKE_SOURCES)[number];

export const TAP_CAPABILITY_AVAILABILITY_GATE_STATUSES = [
  "ready",
  "review_required",
  "blocked",
] as const;
export const TAP_CAPABILITY_GATE_STATUSES = TAP_CAPABILITY_AVAILABILITY_GATE_STATUSES;
export type TapCapabilityAvailabilityGateStatus =
  (typeof TAP_CAPABILITY_AVAILABILITY_GATE_STATUSES)[number];
export type TapCapabilityGateStatus = TapCapabilityAvailabilityGateStatus;

export interface TapCapabilityEvidenceRecord {
  capabilityKey?: string;
  source: TapAvailabilityEvidenceSource;
  status: TapAvailabilityEvidenceStatus;
  ref: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface TapCapabilityHealthContract {
  healthEntry: string;
  source: TapCapabilityHealthSource;
  requiresBinding: boolean;
  adapterHealthCheckSupported: boolean;
  successCriteria: string[];
  failureSignals: string[];
  evidenceOutput: string[];
}

export interface TapCapabilitySmokeContract {
  smokeEntry: string;
  source: TapCapabilitySmokeSource;
  successCriteria: string[];
  failureSignals: string[];
  evidenceOutput: string[];
}

export interface TapCapabilityReportContract {
  usageDocRef: string;
  successCriteria: string[];
  failureSignals: string[];
  evidenceOutput: string[];
}

export interface TapCapabilityAvailabilityContract {
  capabilityKey: string;
  familyKey: TapAvailabilityFamilyKey;
  tier?: string;
  riskLevel: TaPoolRiskLevel;
  recommendedMode: TaPoolMode;
  reviewRequirements: ReviewVote[];
  supportRouteCount: number;
  activationFactoryRef?: string;
  replayPolicy: ReplayPolicy;
  activationMode?: string;
  targetPool?: string;
  verification: CapabilityPackageVerification;
  health: TapCapabilityHealthContract;
  smoke: TapCapabilitySmokeContract;
  report: TapCapabilityReportContract;
  packageRef: {
    templateVersion: string;
    version: string;
    generation: number;
  };
  supportsRecovery: boolean;
}

export interface TapFormalFamilyInventoryEntry {
  familyKey: TapAvailabilityFamilyKey;
  capabilityKey: string;
  capabilityPackage: CapabilityPackage;
  manifest: CapabilityManifest;
  packageSourceRef: string;
  registerHelperRef: string;
  assemblyRef: string;
  activationFactoryRefs: string[];
}

export interface TapFormalFamilyInventoryFamily {
  familyKey: TapAvailabilityFamilyKey;
  capabilityKeys: string[];
  packageSourceRefs: string[];
  registerHelperRefs: string[];
  assemblyRef: string;
  activationFactoryRefs: string[];
  packageCount: number;
  entries: TapFormalFamilyInventoryEntry[];
}

export interface TapFormalFamilyInventory {
  familyKeys: TapAvailabilityFamilyKey[];
  capabilityKeys: string[];
  assemblyRef: string;
  families: TapFormalFamilyInventoryFamily[];
  entries: TapFormalFamilyInventoryEntry[];
}

export interface TapCapabilityAvailabilityObservedState {
  manifest?: CapabilityManifest;
  registration?: TapCapabilityRegistrationAuditEntry;
  activationFactory?: TapActivationFactoryAuditEntry;
  bindingIds: string[];
  bindingStates: string[];
  healthRecords: CapabilityPoolHealthRecord[];
  registered: boolean;
  prepareReady: boolean;
  executeReady: boolean;
  healthy: boolean;
  hasActivationFactory: boolean;
}

export interface TapCapabilityAvailabilityGate {
  status: TapCapabilityAvailabilityGateStatus;
  reasons: string[];
}

export interface TapCapabilityAvailabilityRow {
  familyKey: TapAvailabilityFamilyKey;
  capabilityKey: string;
  packageSourceRef: string;
  registerHelperRef: string;
  assemblyRef: string;
  activationFactoryRefs: string[];
  contract: TapCapabilityAvailabilityContract;
  supportRoutes: number;
  observed: TapCapabilityAvailabilityObservedState;
  gate: TapCapabilityAvailabilityGate;
  evidence: TapCapabilityEvidenceRecord[];
}

export interface TapCapabilityAvailabilityFamilySummary {
  familyKey: TapAvailabilityFamilyKey;
  total: number;
  registered: number;
  executeReady: number;
  healthy: number;
  ready: number;
  reviewRequired: number;
  blocked: number;
}

export interface TapCapabilityAvailabilityTruthTable {
  inventory: TapFormalFamilyInventory;
  rows: TapCapabilityAvailabilityRow[];
}

export interface TapCapabilityAvailabilityReport {
  generatedAt: string;
  inventory: TapFormalFamilyInventory;
  rows: TapCapabilityAvailabilityRow[];
  summary: {
    totalCapabilities: number;
    registeredCapabilities: number;
    executeReadyCapabilities: number;
    healthyCapabilities: number;
    readyCapabilities: number;
    reviewRequiredCapabilities: number;
    blockedCapabilities: number;
  };
  families: TapCapabilityAvailabilityFamilySummary[];
  metadata?: Record<string, unknown>;
}
