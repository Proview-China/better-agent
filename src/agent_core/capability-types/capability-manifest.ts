export const CAPABILITY_KINDS = [
  "model",
  "tool",
  "resource",
  "runtime",
] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

export const CAPABILITY_BINDING_STATES = [
  "active",
  "draining",
  "disabled",
] as const;
export type CapabilityBindingState = (typeof CAPABILITY_BINDING_STATES)[number];

export interface CapabilitySchemaRef {
  id: string;
  version?: string;
}

export interface CapabilityRouteHint {
  key: string;
  value: string;
}

export interface CapabilityManifest {
  capabilityId: string;
  capabilityKey: string;
  kind: CapabilityKind;
  version: string;
  generation: number;
  description: string;
  inputSchemaRef?: CapabilitySchemaRef;
  outputSchemaRef?: CapabilitySchemaRef;
  supportsStreaming?: boolean;
  supportsCancellation?: boolean;
  supportsPrepare?: boolean;
  hotPath?: boolean;
  routeHints?: CapabilityRouteHint[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CapabilityBinding {
  bindingId: string;
  capabilityId: string;
  generation: number;
  adapterId: string;
  runtimeKind: string;
  routeProfile?: string;
  state: CapabilityBindingState;
  priorityClass?: string;
  metadata?: Record<string, unknown>;
}

