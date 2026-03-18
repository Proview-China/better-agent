import type {
  CapabilityBinding,
  CapabilityBindingState,
  CapabilityManifest,
} from "../capability-types/index.js";

export interface CreateCapabilityBindingInput {
  bindingId: string;
  capabilityId: string;
  generation: number;
  adapterId: string;
  runtimeKind: string;
  routeProfile?: string;
  state?: CapabilityBindingState;
  priorityClass?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityBindingHotFields {
  bindingId: string;
  capabilityId: string;
  generation: number;
  adapterId: string;
  runtimeKind: string;
  routeProfile?: string;
  state: CapabilityBindingState;
  priorityClass?: string;
}

export interface CapabilityBindingColdFields {
  metadata?: Record<string, unknown>;
}

export function validateCapabilityBinding(binding: CapabilityBinding): void {
  if (!binding.bindingId.trim()) {
    throw new Error("Capability binding requires a non-empty bindingId.");
  }

  if (!binding.capabilityId.trim()) {
    throw new Error("Capability binding requires a non-empty capabilityId.");
  }

  if (!binding.adapterId.trim()) {
    throw new Error("Capability binding requires a non-empty adapterId.");
  }

  if (!binding.runtimeKind.trim()) {
    throw new Error("Capability binding requires a non-empty runtimeKind.");
  }

  if (!Number.isInteger(binding.generation) || binding.generation < 1) {
    throw new Error("Capability binding generation must be an integer greater than or equal to 1.");
  }
}

export function createCapabilityBinding(input: CreateCapabilityBindingInput): CapabilityBinding {
  const binding: CapabilityBinding = {
    bindingId: input.bindingId.trim(),
    capabilityId: input.capabilityId.trim(),
    generation: input.generation,
    adapterId: input.adapterId.trim(),
    runtimeKind: input.runtimeKind.trim(),
    routeProfile: input.routeProfile?.trim() || undefined,
    state: input.state ?? "active",
    priorityClass: input.priorityClass?.trim() || undefined,
    metadata: input.metadata,
  };

  validateCapabilityBinding(binding);
  return binding;
}

export function getCapabilityBindingHotFields(binding: CapabilityBinding): CapabilityBindingHotFields {
  return {
    bindingId: binding.bindingId,
    capabilityId: binding.capabilityId,
    generation: binding.generation,
    adapterId: binding.adapterId,
    runtimeKind: binding.runtimeKind,
    routeProfile: binding.routeProfile,
    state: binding.state,
    priorityClass: binding.priorityClass,
  };
}

export function getCapabilityBindingColdFields(binding: CapabilityBinding): CapabilityBindingColdFields {
  return {
    metadata: binding.metadata,
  };
}

export function setCapabilityBindingState(
  binding: CapabilityBinding,
  state: CapabilityBindingState,
): CapabilityBinding {
  if (binding.state === state) {
    return binding;
  }

  return {
    ...binding,
    state,
  };
}

export function nextCapabilityGeneration(params: {
  capabilityId: string;
  bindings: readonly CapabilityBinding[];
  manifests?: readonly CapabilityManifest[];
}): number {
  const bindingGenerations = params.bindings
    .filter((binding) => binding.capabilityId === params.capabilityId)
    .map((binding) => binding.generation);

  const manifestGenerations = (params.manifests ?? [])
    .filter((manifest) => manifest.capabilityId === params.capabilityId)
    .map((manifest) => manifest.generation);

  const highest = Math.max(0, ...bindingGenerations, ...manifestGenerations);
  return highest + 1;
}

export function listCapabilityBindingsByState(params: {
  bindings: readonly CapabilityBinding[];
  capabilityId?: string;
  state?: CapabilityBindingState;
}): CapabilityBinding[] {
  return params.bindings.filter((binding) => {
    if (params.capabilityId && binding.capabilityId !== params.capabilityId) {
      return false;
    }

    if (params.state && binding.state !== params.state) {
      return false;
    }

    return true;
  });
}

export function listCapabilityGenerations(params: {
  bindings: readonly CapabilityBinding[];
  capabilityId: string;
}): number[] {
  return [...new Set(
    params.bindings
      .filter((binding) => binding.capabilityId === params.capabilityId)
      .map((binding) => binding.generation),
  )].sort((left, right) => left - right);
}

