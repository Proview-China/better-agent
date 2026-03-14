import type {
  CapabilityAction,
  CapabilityKey,
  CapabilityNamespace,
  CapabilityRequest,
  ProviderId,
  SdkLayer
} from "./types.js";

export interface AdapterSdkSurface {
  packageName: string;
  entrypoint: string;
  notes?: string;
}

export interface PreparedInvocation<TPayload = unknown> {
  key: CapabilityKey;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  variant?: string;
  adapterId: string;
  sdk: AdapterSdkSurface;
  payload: TPayload;
}

export interface CapabilityAdapterDescriptor<
  TInput = unknown,
  TPayload = unknown
> {
  id: string;
  variant?: string;
  key: CapabilityKey;
  namespace: CapabilityNamespace;
  action: CapabilityAction;
  provider: ProviderId;
  layer: Exclude<SdkLayer, "auto">;
  description: string;
  prepare(request: CapabilityRequest<TInput>): PreparedInvocation<TPayload>;
}

export interface FacadeCallOptions<TInput = unknown> {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
  input: TInput;
  session?: unknown;
  tools?: unknown[];
  policy?: unknown;
  metadata?: Record<string, unknown>;
  providerOptions?: Partial<Record<ProviderId, Record<string, unknown>>>;
}
