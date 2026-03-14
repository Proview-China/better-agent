export type {
  CapabilityAction,
  CapabilityDefinition,
  CapabilityKey,
  CapabilityNamespace,
  CapabilityPlane,
  CapabilityRequest,
  CapabilityResult,
  CapabilityWeight,
  ProviderId,
  ProviderCapabilitySupport,
  SdkLayer,
  SupportPool,
  SupportStatus
} from "./types.js";
export type {
  AdapterSdkSurface,
  CapabilityAdapterDescriptor,
  FacadeCallOptions,
  PreparedInvocation
} from "./contracts.js";
export type {
  AnthropicCompatibilityProfile,
  CompatibilityProfile,
  DeepMindCompatibilityProfile,
  OpenAICompatibilityProfile
} from "./compatibility.js";

export {
  CAPABILITY_ACTIONS,
  CAPABILITY_NAMESPACES,
  CAPABILITY_PLANES,
  CAPABILITY_WEIGHTS,
  PROVIDERS,
  SDK_LAYERS,
  SUPPORT_POOLS,
  SUPPORT_STATUSES
} from "./types.js";
export { createConfiguredRaxFacade, createRaxFacade } from "./facade.js";
export { CapabilityRouter, createCapabilityRequest } from "./router.js";
export {
  CompatibilityBlockedError,
  MissingAdapterError,
  RaxRoutingError,
  UnsupportedCapabilityError
} from "./errors.js";

export {
  THIN_CAPABILITY_ADAPTERS
} from "./adapters.js";

export {
  applyCompatibilityProfile,
  DEFAULT_COMPATIBILITY_PROFILES,
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
  getCompatibilityProfile,
  supportsCapabilityInProfile
} from "./compatibility.js";

export {
  CAPABILITY_REGISTRY,
  getCapabilityDefinition,
  listCapabilities,
  listCapabilitiesForProvider
} from "./registry.js";
export { defaultCapabilityRouter, localGatewayCapabilityRouter, rax, raxLocal } from "./runtime.js";
