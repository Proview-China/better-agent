import type {
  CapabilityBinding,
  CapabilityManifest,
  CapabilityRouteHint,
} from "../capability-types/index.js";

export interface CreateCapabilityManifestInput {
  capabilityId: string;
  capabilityKey: string;
  kind: CapabilityManifest["kind"];
  version: string;
  generation?: number;
  description: string;
  inputSchemaRef?: CapabilityManifest["inputSchemaRef"];
  outputSchemaRef?: CapabilityManifest["outputSchemaRef"];
  supportsStreaming?: boolean;
  supportsCancellation?: boolean;
  supportsPrepare?: boolean;
  hotPath?: boolean;
  routeHints?: CapabilityRouteHint[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CapabilityManifestHotFields {
  capabilityId: string;
  capabilityKey: string;
  kind: CapabilityManifest["kind"];
  generation: number;
  hotPath: boolean;
}

export interface CapabilityManifestColdFields {
  version: string;
  description: string;
  inputSchemaRef?: CapabilityManifest["inputSchemaRef"];
  outputSchemaRef?: CapabilityManifest["outputSchemaRef"];
  supportsStreaming?: boolean;
  supportsCancellation?: boolean;
  supportsPrepare?: boolean;
  routeHints?: CapabilityRouteHint[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CapabilityCatalogEntry {
  manifest: CapabilityManifest;
  wired: boolean;
  activeBindingIds: string[];
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRouteHints(routeHints?: CapabilityRouteHint[]): CapabilityRouteHint[] | undefined {
  if (!routeHints || routeHints.length === 0) {
    return undefined;
  }

  const normalized = routeHints
    .map((hint) => ({
      key: hint.key.trim(),
      value: hint.value.trim(),
    }))
    .filter((hint) => hint.key.length > 0 && hint.value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

export function validateCapabilityManifest(manifest: CapabilityManifest): void {
  if (!manifest.capabilityId.trim()) {
    throw new Error("Capability manifest requires a non-empty capabilityId.");
  }

  if (!manifest.capabilityKey.trim()) {
    throw new Error("Capability manifest requires a non-empty capabilityKey.");
  }

  if (!manifest.version.trim()) {
    throw new Error("Capability manifest requires a non-empty version.");
  }

  if (!manifest.description.trim()) {
    throw new Error("Capability manifest requires a non-empty description.");
  }

  if (!Number.isInteger(manifest.generation) || manifest.generation < 1) {
    throw new Error("Capability manifest generation must be an integer greater than or equal to 1.");
  }
}

export function createCapabilityManifest(input: CreateCapabilityManifestInput): CapabilityManifest {
  const manifest: CapabilityManifest = {
    capabilityId: input.capabilityId.trim(),
    capabilityKey: input.capabilityKey.trim(),
    kind: input.kind,
    version: input.version.trim(),
    generation: input.generation ?? 1,
    description: input.description.trim(),
    inputSchemaRef: input.inputSchemaRef,
    outputSchemaRef: input.outputSchemaRef,
    supportsStreaming: input.supportsStreaming,
    supportsCancellation: input.supportsCancellation,
    supportsPrepare: input.supportsPrepare,
    hotPath: input.hotPath,
    routeHints: normalizeRouteHints(input.routeHints),
    tags: normalizeStringArray(input.tags),
    metadata: input.metadata,
  };

  validateCapabilityManifest(manifest);
  return manifest;
}

export function getCapabilityManifestHotFields(manifest: CapabilityManifest): CapabilityManifestHotFields {
  return {
    capabilityId: manifest.capabilityId,
    capabilityKey: manifest.capabilityKey,
    kind: manifest.kind,
    generation: manifest.generation,
    hotPath: manifest.hotPath ?? false,
  };
}

export function getCapabilityManifestColdFields(manifest: CapabilityManifest): CapabilityManifestColdFields {
  return {
    version: manifest.version,
    description: manifest.description,
    inputSchemaRef: manifest.inputSchemaRef,
    outputSchemaRef: manifest.outputSchemaRef,
    supportsStreaming: manifest.supportsStreaming,
    supportsCancellation: manifest.supportsCancellation,
    supportsPrepare: manifest.supportsPrepare,
    routeHints: manifest.routeHints,
    tags: manifest.tags,
    metadata: manifest.metadata,
  };
}

export function isCapabilityWiredSurface(params: {
  manifest: CapabilityManifest;
  bindings: readonly CapabilityBinding[];
}): boolean {
  const { manifest, bindings } = params;
  return bindings.some((binding) => binding.capabilityId === manifest.capabilityId && binding.state === "active");
}

export function toCapabilityCatalogEntry(params: {
  manifest: CapabilityManifest;
  bindings?: readonly CapabilityBinding[];
}): CapabilityCatalogEntry {
  const bindings = params.bindings ?? [];
  const activeBindingIds = bindings
    .filter((binding) => binding.capabilityId === params.manifest.capabilityId && binding.state === "active")
    .map((binding) => binding.bindingId);

  return {
    manifest: params.manifest,
    wired: activeBindingIds.length > 0,
    activeBindingIds,
  };
}

