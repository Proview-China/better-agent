import type { TaCapabilityTier } from "./ta-pool-profile.js";

export const PROVISION_ARTIFACT_STATUSES = [
  "pending",
  "building",
  "verifying",
  "ready",
  "failed",
  "superseded",
] as const;
export type ProvisionArtifactStatus = (typeof PROVISION_ARTIFACT_STATUSES)[number];

export interface ProvisionArtifactRef {
  artifactId: string;
  kind: string;
  ref?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionRequest {
  provisionId: string;
  sourceRequestId: string;
  requestedCapabilityKey: string;
  requestedTier: TaCapabilityTier;
  reason: string;
  desiredProviderOrRuntime?: string;
  requiredVerification?: string[];
  expectedArtifacts?: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProvisionRequestInput {
  provisionId: string;
  sourceRequestId: string;
  requestedCapabilityKey: string;
  requestedTier?: TaCapabilityTier;
  reason: string;
  desiredProviderOrRuntime?: string;
  requiredVerification?: string[];
  expectedArtifacts?: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionArtifactBundle {
  bundleId: string;
  provisionId: string;
  status: ProvisionArtifactStatus;
  toolArtifact?: ProvisionArtifactRef;
  bindingArtifact?: ProvisionArtifactRef;
  verificationArtifact?: ProvisionArtifactRef;
  usageArtifact?: ProvisionArtifactRef;
  completedAt?: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateProvisionArtifactBundleInput {
  bundleId: string;
  provisionId: string;
  status: ProvisionArtifactStatus;
  toolArtifact?: ProvisionArtifactRef;
  bindingArtifact?: ProvisionArtifactRef;
  verificationArtifact?: ProvisionArtifactRef;
  usageArtifact?: ProvisionArtifactRef;
  completedAt?: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function validateArtifactRef(label: string, artifact?: ProvisionArtifactRef): void {
  if (!artifact) {
    return;
  }

  if (!artifact.artifactId.trim()) {
    throw new Error(`${label} requires a non-empty artifactId.`);
  }

  if (!artifact.kind.trim()) {
    throw new Error(`${label} requires a non-empty kind.`);
  }
}

export function validateProvisionRequest(request: ProvisionRequest): void {
  if (!request.provisionId.trim()) {
    throw new Error("Provision request requires a non-empty provisionId.");
  }

  if (!request.sourceRequestId.trim()) {
    throw new Error("Provision request requires a non-empty sourceRequestId.");
  }

  if (!request.requestedCapabilityKey.trim()) {
    throw new Error("Provision request requires a non-empty requestedCapabilityKey.");
  }

  if (!request.reason.trim()) {
    throw new Error("Provision request requires a non-empty reason.");
  }
}

export function createProvisionRequest(input: CreateProvisionRequestInput): ProvisionRequest {
  const request: ProvisionRequest = {
    provisionId: input.provisionId.trim(),
    sourceRequestId: input.sourceRequestId.trim(),
    requestedCapabilityKey: input.requestedCapabilityKey.trim(),
    requestedTier: input.requestedTier ?? "B1",
    reason: input.reason.trim(),
    desiredProviderOrRuntime: input.desiredProviderOrRuntime?.trim() || undefined,
    requiredVerification: normalizeStringArray(input.requiredVerification),
    expectedArtifacts: normalizeStringArray(input.expectedArtifacts),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateProvisionRequest(request);
  return request;
}

export function validateProvisionArtifactBundle(bundle: ProvisionArtifactBundle): void {
  if (!bundle.bundleId.trim()) {
    throw new Error("Provision artifact bundle requires a non-empty bundleId.");
  }

  if (!bundle.provisionId.trim()) {
    throw new Error("Provision artifact bundle requires a non-empty provisionId.");
  }

  validateArtifactRef("toolArtifact", bundle.toolArtifact);
  validateArtifactRef("bindingArtifact", bundle.bindingArtifact);
  validateArtifactRef("verificationArtifact", bundle.verificationArtifact);
  validateArtifactRef("usageArtifact", bundle.usageArtifact);

  if (bundle.status === "ready") {
    if (!bundle.toolArtifact || !bundle.bindingArtifact || !bundle.verificationArtifact || !bundle.usageArtifact) {
      throw new Error("Ready provision artifact bundles require all four artifact slots.");
    }
  }

  if (bundle.status === "failed" && !bundle.error) {
    throw new Error("Failed provision artifact bundles require an error.");
  }
}

export function createProvisionArtifactBundle(
  input: CreateProvisionArtifactBundleInput,
): ProvisionArtifactBundle {
  const bundle: ProvisionArtifactBundle = {
    bundleId: input.bundleId.trim(),
    provisionId: input.provisionId.trim(),
    status: input.status,
    toolArtifact: input.toolArtifact,
    bindingArtifact: input.bindingArtifact,
    verificationArtifact: input.verificationArtifact,
    usageArtifact: input.usageArtifact,
    completedAt: input.completedAt,
    error: input.error,
    metadata: input.metadata,
  };

  validateProvisionArtifactBundle(bundle);
  return bundle;
}
