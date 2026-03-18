import type { CapabilityAdapter, CapabilityBinding, CapabilityManifest } from "../capability-types/index.js";
import { CapabilityPoolRegistry } from "./pool-registry.js";

export class CapabilityPoolLifecycle {
  readonly #registry: CapabilityPoolRegistry;

  constructor(registry: CapabilityPoolRegistry) {
    this.#registry = registry;
  }

  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding {
    return this.#registry.register(manifest, adapter).binding;
  }

  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding {
    return this.#registry.replace(bindingId, manifest, adapter).binding;
  }

  unregister(bindingId: string): void {
    this.#registry.unregister(bindingId);
  }

  suspend(bindingId: string): void {
    this.#registry.suspend(bindingId);
  }

  resume(bindingId: string): void {
    this.#registry.resume(bindingId);
  }
}
