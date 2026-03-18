import { randomUUID } from "node:crypto";

import { RaxRoutingError } from "../../rax/errors.js";
import type {
  CapabilityAdapter,
  CapabilityBinding,
  CapabilityManifest,
} from "../capability-types/index.js";
import type {
  CapabilityPoolRegistration,
  CapabilityPoolRegistryLike,
} from "./pool-types.js";

function cloneManifest(manifest: CapabilityManifest): CapabilityManifest {
  return {
    ...manifest,
    routeHints: manifest.routeHints ? [...manifest.routeHints] : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    metadata: manifest.metadata ? { ...manifest.metadata } : undefined,
  };
}

function cloneBinding(binding: CapabilityBinding): CapabilityBinding {
  return {
    ...binding,
    metadata: binding.metadata ? { ...binding.metadata } : undefined,
  };
}

export class CapabilityPoolRegistry implements CapabilityPoolRegistryLike {
  readonly #registrations = new Map<string, CapabilityPoolRegistration>();
  readonly #bindingsByCapabilityKey = new Map<string, Set<string>>();

  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityPoolRegistration {
    const binding: CapabilityBinding = {
      bindingId: randomUUID(),
      capabilityId: manifest.capabilityId,
      generation: manifest.generation,
      adapterId: adapter.id,
      runtimeKind: adapter.runtimeKind,
      routeProfile: manifest.routeHints?.map((entry) => `${entry.key}:${entry.value}`).join("|") || undefined,
      state: "active",
      priorityClass: manifest.hotPath ? "hot" : "default",
    };

    const registration: CapabilityPoolRegistration = {
      manifest: cloneManifest(manifest),
      binding,
      adapter,
    };
    this.#registrations.set(binding.bindingId, registration);
    const capabilityBindings = this.#bindingsByCapabilityKey.get(manifest.capabilityKey) ?? new Set<string>();
    capabilityBindings.add(binding.bindingId);
    this.#bindingsByCapabilityKey.set(manifest.capabilityKey, capabilityBindings);
    return {
      manifest: cloneManifest(registration.manifest),
      binding: cloneBinding(binding),
      adapter,
    };
  }

  unregister(bindingId: string): void {
    const registration = this.#registrations.get(bindingId);
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_binding_missing",
        `Capability binding ${bindingId} was not found.`,
      );
    }

    const capabilityBindings = this.#bindingsByCapabilityKey.get(registration.manifest.capabilityKey);
    capabilityBindings?.delete(bindingId);
    if (capabilityBindings && capabilityBindings.size === 0) {
      this.#bindingsByCapabilityKey.delete(registration.manifest.capabilityKey);
    }
    this.#registrations.delete(bindingId);
  }

  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityPoolRegistration {
    const registration = this.#registrations.get(bindingId);
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_binding_missing",
        `Capability binding ${bindingId} was not found for replace.`,
      );
    }

    registration.binding = {
      ...registration.binding,
      state: "draining",
      metadata: {
        ...(registration.binding.metadata ?? {}),
        supersededAt: new Date().toISOString(),
      },
    };

    const nextManifest: CapabilityManifest = {
      ...manifest,
      capabilityId: registration.manifest.capabilityId,
      capabilityKey: registration.manifest.capabilityKey,
      generation: Math.max(registration.binding.generation + 1, manifest.generation),
    };

    return this.register(nextManifest, adapter);
  }

  suspend(bindingId: string): void {
    const registration = this.#requireRegistration(bindingId);
    registration.binding = {
      ...registration.binding,
      state: "disabled",
    };
  }

  resume(bindingId: string): void {
    const registration = this.#requireRegistration(bindingId);
    registration.binding = {
      ...registration.binding,
      state: "active",
    };
  }

  listCapabilities(): readonly CapabilityManifest[] {
    return [...new Map(
      [...this.#registrations.values()].map((entry) => [entry.manifest.capabilityId, cloneManifest(entry.manifest)]),
    ).values()];
  }

  listBindings(): readonly CapabilityBinding[] {
    return [...this.#registrations.values()].map((entry) => cloneBinding(entry.binding));
  }

  listBindingsForKey(capabilityKey: string): readonly CapabilityBinding[] {
    const bindingIds = this.#bindingsByCapabilityKey.get(capabilityKey);
    if (!bindingIds) {
      return [];
    }
    return [...bindingIds]
      .map((bindingId) => this.#registrations.get(bindingId))
      .filter((entry): entry is CapabilityPoolRegistration => entry !== undefined)
      .map((entry) => cloneBinding(entry.binding));
  }

  listRegistrations(): readonly CapabilityPoolRegistration[] {
    return [...this.#registrations.values()].map((entry) => ({
      manifest: cloneManifest(entry.manifest),
      binding: cloneBinding(entry.binding),
      adapter: entry.adapter,
    }));
  }

  getRegistrationByBindingId(bindingId: string): CapabilityPoolRegistration | undefined {
    const registration = this.#registrations.get(bindingId);
    if (!registration) {
      return undefined;
    }
    return {
      manifest: cloneManifest(registration.manifest),
      binding: cloneBinding(registration.binding),
      adapter: registration.adapter,
    };
  }

  getActiveRegistrationsForCapability(capabilityKey: string): readonly CapabilityPoolRegistration[] {
    const bindingIds = this.#bindingsByCapabilityKey.get(capabilityKey);
    if (!bindingIds) {
      return [];
    }
    return [...bindingIds]
      .map((bindingId) => this.#registrations.get(bindingId))
      .filter((entry): entry is CapabilityPoolRegistration => {
        return entry !== undefined && entry.binding.state === "active";
      })
      .map((entry) => ({
        manifest: cloneManifest(entry.manifest),
        binding: cloneBinding(entry.binding),
        adapter: entry.adapter,
      }));
  }

  getBinding(bindingId: string): CapabilityBinding | undefined {
    const registration = this.#registrations.get(bindingId);
    return registration ? cloneBinding(registration.binding) : undefined;
  }

  getManifest(capabilityId: string): CapabilityManifest | undefined {
    const registration = [...this.#registrations.values()].find((entry) => entry.manifest.capabilityId === capabilityId);
    return registration ? cloneManifest(registration.manifest) : undefined;
  }

  getAdapter(bindingId: string): CapabilityAdapter | undefined {
    return this.#registrations.get(bindingId)?.adapter;
  }

  #requireRegistration(bindingId: string): CapabilityPoolRegistration {
    const registration = this.#registrations.get(bindingId);
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_binding_missing",
        `Capability binding ${bindingId} was not found.`,
      );
    }
    return registration;
  }
}
