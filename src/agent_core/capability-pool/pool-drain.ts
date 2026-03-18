export class CapabilityPoolDrainTracker {
  readonly #inflight = new Map<string, number>();

  start(bindingId: string): void {
    this.#inflight.set(bindingId, (this.#inflight.get(bindingId) ?? 0) + 1);
  }

  complete(bindingId: string): number {
    const next = Math.max(0, (this.#inflight.get(bindingId) ?? 1) - 1);
    if (next === 0) {
      this.#inflight.delete(bindingId);
      return 0;
    }
    this.#inflight.set(bindingId, next);
    return next;
  }

  getInflight(bindingId: string): number {
    return this.#inflight.get(bindingId) ?? 0;
  }
}

