import type { CapabilityKey, ProviderId, SdkLayer } from "./types.js";

export class RaxRoutingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RaxRoutingError";
  }
}

export class UnsupportedCapabilityError extends RaxRoutingError {
  readonly key: CapabilityKey;
  readonly provider: ProviderId;

  constructor(key: CapabilityKey, provider: ProviderId, message: string) {
    super("unsupported_capability", message);
    this.key = key;
    this.provider = provider;
  }
}

export class MissingAdapterError extends RaxRoutingError {
  readonly key: CapabilityKey;
  readonly provider: ProviderId;
  readonly layer: SdkLayer;

  constructor(key: CapabilityKey, provider: ProviderId, layer: SdkLayer, message: string) {
    super("missing_adapter", message);
    this.key = key;
    this.provider = provider;
    this.layer = layer;
  }
}

export class CompatibilityBlockedError extends RaxRoutingError {
  readonly key: CapabilityKey;
  readonly provider: ProviderId;
  readonly profileId: string;

  constructor(
    key: CapabilityKey,
    provider: ProviderId,
    profileId: string,
    message: string
  ) {
    super("blocked_by_compatibility_profile", message);
    this.key = key;
    this.provider = provider;
    this.profileId = profileId;
  }
}
