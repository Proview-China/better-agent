import {
  createCapabilityGrant,
  matchesCapabilityPattern,
  type AccessRequest,
  type AgentCapabilityProfile,
  type CapabilityGrant,
  type CreateCapabilityGrantInput,
  type TaCapabilityTier,
} from "../ta-pool-types/index.js";

export interface BaselineMatchResult {
  matched: boolean;
  reason: "denied_by_pattern" | "baseline_capability" | "allowed_pattern" | "unmatched";
  matchedPattern?: string;
}

export interface EvaluatedBaselineProfile {
  allowed: boolean;
  reason: BaselineMatchResult["reason"];
  matchedPattern?: string;
}

export interface BaselineCapabilityResolution {
  status: "baseline_allowed" | "pattern_allowed" | "denied" | "unmatched";
  capabilityKey: string;
  tier: TaCapabilityTier;
  matchedPattern?: string;
}
export type BaselineCapabilityStatus = BaselineCapabilityResolution["status"];

export interface CreateBaselineGrantInput {
  grantId: string;
  request: Pick<
    AccessRequest,
    "requestId" | "requestedCapabilityKey" | "requestedScope" | "mode"
  >;
  profile: Pick<AgentCapabilityProfile, "profileId" | "baselineTier">;
  issuedAt: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

export interface CreateDefaultCapabilityGrantInput {
  requestId: string;
  capabilityKey: string;
  tier?: TaCapabilityTier;
  mode?: AccessRequest["mode"];
  issuedAt: string;
  metadata?: Record<string, unknown>;
}
export type CreateDefaultGrantInput = CreateDefaultCapabilityGrantInput;

function firstMatchingPattern(params: {
  capabilityKey: string;
  patterns?: readonly string[];
}): string | undefined {
  const { capabilityKey, patterns } = params;
  if (!patterns || patterns.length === 0) {
    return undefined;
  }

  return patterns.find((pattern) => {
    return matchesCapabilityPattern({
      capabilityKey,
      patterns: [pattern],
    });
  });
}

export function matchBaselineCapability(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): BaselineMatchResult {
  const { profile, capabilityKey } = params;

  const deniedPattern = firstMatchingPattern({
    capabilityKey,
    patterns: profile.deniedCapabilityPatterns,
  });
  if (deniedPattern) {
    return {
      matched: false,
      reason: "denied_by_pattern",
      matchedPattern: deniedPattern,
    };
  }

  if (profile.baselineCapabilities?.includes(capabilityKey)) {
    return {
      matched: true,
      reason: "baseline_capability",
    };
  }

  const allowedPattern = firstMatchingPattern({
    capabilityKey,
    patterns: profile.allowedCapabilityPatterns,
  });
  if (allowedPattern) {
    return {
      matched: true,
      reason: "allowed_pattern",
      matchedPattern: allowedPattern,
    };
  }

  return {
    matched: false,
    reason: "unmatched",
  };
}

export function evaluateBaselineProfile(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): EvaluatedBaselineProfile {
  const result = matchBaselineCapability(params);
  return {
    allowed: result.matched,
    reason: result.reason,
    matchedPattern: result.matchedPattern,
  };
}

export function resolveBaselineCapability(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
  requestedTier?: TaCapabilityTier;
}): BaselineCapabilityResolution {
  const result = matchBaselineCapability({
    profile: params.profile,
    capabilityKey: params.capabilityKey,
  });

  switch (result.reason) {
    case "baseline_capability":
      return {
        status: "baseline_allowed",
        capabilityKey: params.capabilityKey,
        tier: params.requestedTier ?? params.profile.baselineTier,
      };
    case "allowed_pattern":
      return {
        status: "pattern_allowed",
        capabilityKey: params.capabilityKey,
        tier: params.requestedTier ?? params.profile.baselineTier,
        matchedPattern: result.matchedPattern,
      };
    case "denied_by_pattern":
      return {
        status: "denied",
        capabilityKey: params.capabilityKey,
        tier: params.requestedTier ?? params.profile.baselineTier,
        matchedPattern: result.matchedPattern,
      };
    case "unmatched":
      return {
        status: "unmatched",
        capabilityKey: params.capabilityKey,
        tier: params.requestedTier ?? params.profile.baselineTier,
      };
  }
}

export function isBaselineCapabilityMatched(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): boolean {
  return matchBaselineCapability(params).matched;
}

export function isBaselineCapabilityDenied(params: {
  profile: AgentCapabilityProfile;
  capabilityKey: string;
}): boolean {
  return matchBaselineCapability(params).reason === "denied_by_pattern";
}

export function createBaselineGrantInput(
  input: CreateBaselineGrantInput,
): CreateCapabilityGrantInput {
  return {
    grantId: input.grantId,
    requestId: input.request.requestId,
    capabilityKey: input.request.requestedCapabilityKey,
    grantedTier: input.profile.baselineTier,
    grantedScope: input.request.requestedScope,
    mode: input.request.mode,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    constraints: input.constraints,
    metadata: {
      baselineProfileId: input.profile.profileId,
      baselineGrant: true,
      ...(input.metadata ?? {}),
    },
  };
}

export function createDefaultBaselineGrant(
  input: CreateBaselineGrantInput,
): CapabilityGrant {
  return createCapabilityGrant(createBaselineGrantInput(input));
}

export function createDefaultGrantFromAccessRequest(params: {
  grantId: string;
  request: Pick<
    AccessRequest,
    "requestId" | "requestedCapabilityKey" | "requestedScope" | "mode" | "requestedTier"
  >;
  issuedAt: string;
  profile?: Pick<AgentCapabilityProfile, "profileId" | "baselineTier">;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}): CapabilityGrant {
  return createDefaultBaselineGrant({
    grantId: params.grantId,
    request: params.request,
    profile: params.profile ?? {
      profileId: "baseline-profile",
      baselineTier: params.request.requestedTier,
    },
    issuedAt: params.issuedAt,
    constraints: params.constraints,
    metadata: params.metadata,
    expiresAt: params.expiresAt,
  });
}

export function createDefaultCapabilityGrant(
  input: CreateDefaultCapabilityGrantInput,
): CapabilityGrant {
  return createCapabilityGrant({
    grantId: `grant:${input.requestId}:${input.capabilityKey}`,
    requestId: input.requestId,
    capabilityKey: input.capabilityKey,
    grantedTier: input.tier ?? "B0",
    mode: input.mode ?? "balanced",
    issuedAt: input.issuedAt,
    constraints: {
      source: "default-profile",
    },
    metadata: input.metadata,
  });
}
