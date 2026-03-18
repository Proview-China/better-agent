import type { CapabilityInvocationPlan } from "../capability-types/index.js";

export const TA_CAPABILITY_TIERS = [
  "B0",
  "B1",
  "B2",
  "B3",
] as const;
export type TaCapabilityTier = (typeof TA_CAPABILITY_TIERS)[number];

export const TA_POOL_MODES = [
  "strict",
  "balanced",
  "yolo",
] as const;
export type TaPoolMode = (typeof TA_POOL_MODES)[number];

export interface AgentCapabilityProfile {
  profileId: string;
  agentClass: string;
  defaultMode: TaPoolMode;
  baselineTier: TaCapabilityTier;
  baselineCapabilities?: string[];
  allowedCapabilityPatterns?: string[];
  deniedCapabilityPatterns?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentCapabilityProfileInput {
  profileId: string;
  agentClass: string;
  defaultMode?: TaPoolMode;
  baselineTier?: TaCapabilityTier;
  baselineCapabilities?: string[];
  allowedCapabilityPatterns?: string[];
  deniedCapabilityPatterns?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function escapePattern(pattern: string): string {
  return pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function toPatternRegex(pattern: string): RegExp {
  const escaped = escapePattern(pattern).replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function validateAgentCapabilityProfile(profile: AgentCapabilityProfile): void {
  if (!profile.profileId.trim()) {
    throw new Error("Agent capability profile requires a non-empty profileId.");
  }

  if (!profile.agentClass.trim()) {
    throw new Error("Agent capability profile requires a non-empty agentClass.");
  }

  if (!TA_POOL_MODES.includes(profile.defaultMode)) {
    throw new Error(`Unsupported ta-pool mode: ${profile.defaultMode}.`);
  }

  if (!TA_CAPABILITY_TIERS.includes(profile.baselineTier)) {
    throw new Error(`Unsupported ta capability tier: ${profile.baselineTier}.`);
  }
}

export function createAgentCapabilityProfile(
  input: CreateAgentCapabilityProfileInput,
): AgentCapabilityProfile {
  const profile: AgentCapabilityProfile = {
    profileId: input.profileId.trim(),
    agentClass: input.agentClass.trim(),
    defaultMode: input.defaultMode ?? "balanced",
    baselineTier: input.baselineTier ?? "B0",
    baselineCapabilities: normalizeStringArray(input.baselineCapabilities),
    allowedCapabilityPatterns: normalizeStringArray(input.allowedCapabilityPatterns),
    deniedCapabilityPatterns: normalizeStringArray(input.deniedCapabilityPatterns),
    notes: input.notes?.trim() || undefined,
    metadata: input.metadata,
  };

  validateAgentCapabilityProfile(profile);
  return profile;
}

export function matchesCapabilityPattern(params: {
  capabilityKey: string;
  patterns?: readonly string[];
}): boolean {
  const { capabilityKey, patterns } = params;
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => toPatternRegex(pattern).test(capabilityKey));
}

export function isCapabilityDeniedByProfile(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): boolean {
  return matchesCapabilityPattern({
    capabilityKey: params.capabilityKey,
    patterns: params.profile.deniedCapabilityPatterns,
  });
}

export function isCapabilityAllowedByProfile(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): boolean {
  const { profile, capabilityKey } = params;

  if (profile.baselineCapabilities?.includes(capabilityKey)) {
    return true;
  }

  if (matchesCapabilityPattern({
    capabilityKey,
    patterns: profile.deniedCapabilityPatterns,
  })) {
    return false;
  }

  if (!profile.allowedCapabilityPatterns || profile.allowedCapabilityPatterns.length === 0) {
    return false;
  }

  return matchesCapabilityPattern({
    capabilityKey,
    patterns: profile.allowedCapabilityPatterns,
  });
}

export function isInvocationBaselineAllowed(params: {
  profile: AgentCapabilityProfile;
  plan: Pick<CapabilityInvocationPlan, "capabilityKey">;
}): boolean {
  return isCapabilityAllowedByProfile({
    profile: params.profile,
    capabilityKey: params.plan.capabilityKey,
  });
}
