import type {
  CapabilityAdapter,
  CapabilityBinding,
  CapabilityBindingState,
  CapabilityKind,
  CapabilityManifest,
  CapabilityRouteHint,
  CapabilitySchemaRef,
} from "../capability-types/index.js";

export interface CreateCapabilityManifestInput {
  capabilityId: string;
  capabilityKey: string;
  kind: CapabilityKind;
  version?: string;
  generation?: number;
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

export interface CreateCapabilityBindingInput {
  bindingId: string;
  capabilityId: string;
  generation: number;
  adapter: CapabilityAdapter;
  runtimeKind: string;
  routeProfile?: string;
  state?: CapabilityBindingState;
  priorityClass?: string;
  metadata?: Record<string, unknown>;
}

export function createCapabilityManifest(input: CreateCapabilityManifestInput): CapabilityManifest {
  return {
    capabilityId: input.capabilityId,
    capabilityKey: input.capabilityKey,
    kind: input.kind,
    version: input.version ?? "0.1.0",
    generation: input.generation ?? 1,
    description: input.description,
    inputSchemaRef: input.inputSchemaRef,
    outputSchemaRef: input.outputSchemaRef,
    supportsStreaming: input.supportsStreaming ?? false,
    supportsCancellation: input.supportsCancellation ?? false,
    supportsPrepare: input.supportsPrepare ?? true,
    hotPath: input.hotPath ?? false,
    routeHints: input.routeHints,
    tags: input.tags,
    metadata: input.metadata,
  };
}

export function createCapabilityModelBinding(input: CreateCapabilityBindingInput): CapabilityBinding {
  return {
    bindingId: input.bindingId,
    capabilityId: input.capabilityId,
    generation: input.generation,
    adapterId: input.adapter.id,
    runtimeKind: input.adapter.runtimeKind ?? input.runtimeKind,
    routeProfile: input.routeProfile,
    state: input.state ?? "active",
    priorityClass: input.priorityClass,
    metadata: input.metadata,
  };
}

export function isCapabilityBindingActive(binding: CapabilityBinding): boolean {
  return binding.state === "active";
}

export function markCapabilityBindingState(
  binding: CapabilityBinding,
  state: CapabilityBindingState,
): CapabilityBinding {
  return {
    ...binding,
    state,
  };
}
