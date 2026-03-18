import type { CapabilityResultEnvelope } from "../capability-types/capability-result.js";
import type { CapabilityPoolResultCacheLike } from "./pool-types.js";

export class CapabilityPoolResultCache implements CapabilityPoolResultCacheLike {
  readonly #results = new Map<string, CapabilityResultEnvelope>();

  get(key: string | undefined): CapabilityResultEnvelope | undefined {
    if (!key) {
      return undefined;
    }
    return this.#results.get(key);
  }

  set(key: string | undefined, result: CapabilityResultEnvelope): void {
    if (!key) {
      return;
    }
    this.#results.set(key, result);
  }

  size(): number {
    return this.#results.size;
  }
}

