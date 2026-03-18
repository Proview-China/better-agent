import type { AgentCapabilityProfile, TaPoolMode } from "../ta-pool-types/index.js";

export interface ReviewContextAperture {
  projectSummary?: string;
  runSummary?: string;
  profileSnapshot?: AgentCapabilityProfile;
  capabilityInventorySnapshot?: {
    totalCapabilities: number;
    availableCapabilityKeys: string[];
  };
  modeSnapshot?: TaPoolMode;
  metadata?: Record<string, unknown>;
}

export type ReviewContextApertureSnapshot = ReviewContextAperture;

export interface ProvisionContextAperture {
  projectSummary?: string;
  requestedCapabilityKey: string;
  inventorySnapshot?: {
    knownBindings: string[];
    knownTools: string[];
  };
  metadata?: Record<string, unknown>;
}

export type ProvisionContextApertureSnapshot = ProvisionContextAperture;

export function validateReviewContextApertureSnapshot(
  input: ReviewContextApertureSnapshot,
): void {
  if (input.modeSnapshot && input.modeSnapshot.trim().length === 0) {
    throw new Error("Review context aperture snapshot modeSnapshot cannot be empty.");
  }
}

export function validateProvisionContextApertureSnapshot(
  input: ProvisionContextApertureSnapshot,
): void {
  if (!input.requestedCapabilityKey.trim()) {
    throw new Error("Provision context aperture snapshot requires a non-empty requestedCapabilityKey.");
  }
}

export function createReviewContextAperture(
  input: ReviewContextAperture = {},
): ReviewContextAperture {
  const aperture = {
    projectSummary: input.projectSummary,
    runSummary: input.runSummary,
    profileSnapshot: input.profileSnapshot,
    capabilityInventorySnapshot: input.capabilityInventorySnapshot,
    modeSnapshot: input.modeSnapshot,
    metadata: input.metadata,
  };
  validateReviewContextApertureSnapshot(aperture);
  return aperture;
}

export function createProvisionContextAperture(
  input: ProvisionContextAperture,
): ProvisionContextAperture {
  const aperture = {
    projectSummary: input.projectSummary,
    requestedCapabilityKey: input.requestedCapabilityKey.trim(),
    inventorySnapshot: input.inventorySnapshot,
    metadata: input.metadata,
  };
  validateProvisionContextApertureSnapshot(aperture);
  return aperture;
}

export const createReviewContextApertureSnapshot = createReviewContextAperture;
export const createProvisionContextApertureSnapshot = createProvisionContextAperture;
