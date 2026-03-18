import type { CapabilityBackpressureListener } from "../capability-types/capability-gateway.js";
import type { CapabilityBackpressureSignal } from "../capability-types/capability-result.js";
import type {
  CapabilityPoolBackpressureMonitorLike,
  CapabilityPoolBackpressureState,
} from "./pool-types.js";

export interface CapabilityPoolBackpressureOptions {
  maxQueueDepth: number;
  maxInflight: number;
  clock?: () => Date;
}

export class CapabilityPoolBackpressureMonitor implements CapabilityPoolBackpressureMonitorLike {
  readonly #maxQueueDepth: number;
  readonly #maxInflight: number;
  readonly #clock: () => Date;
  readonly #listeners = new Set<CapabilityBackpressureListener>();
  #lastState?: string;

  constructor(options: CapabilityPoolBackpressureOptions) {
    this.#maxQueueDepth = options.maxQueueDepth;
    this.#maxInflight = options.maxInflight;
    this.#clock = options.clock ?? (() => new Date());
  }

  evaluate(queueDepth: number, inflight: number): CapabilityPoolBackpressureState {
    if (inflight > this.#maxInflight) {
      return {
        active: true,
        queueDepth,
        inflight,
        reason: "inflight-threshold",
      };
    }

    if (queueDepth > this.#maxQueueDepth) {
      return {
        active: true,
        queueDepth,
        inflight,
        reason: "queue-threshold",
      };
    }

    return {
      active: false,
      queueDepth,
      inflight,
    };
  }

  notifyIfChanged(queueDepth: number, inflight: number): CapabilityBackpressureSignal {
    const next = this.evaluate(queueDepth, inflight);
    const nextKey = `${next.active}:${next.reason ?? "none"}:${next.queueDepth}:${next.inflight}`;
    if (nextKey !== this.#lastState) {
      this.#lastState = nextKey;
      const signal: CapabilityBackpressureSignal = {
        source: "global",
        queueDepth: next.queueDepth,
        inflight: next.inflight,
        reason: next.reason ?? "healthy",
        suggestedAction: next.active ? "wait" : "degrade",
        emittedAt: this.#clock().toISOString(),
      };
      for (const listener of this.#listeners) {
        listener(signal);
      }
      return signal;
    }

    return {
      source: "global",
      queueDepth: next.queueDepth,
      inflight: next.inflight,
      reason: next.reason ?? "healthy",
      suggestedAction: next.active ? "wait" : "degrade",
      emittedAt: this.#clock().toISOString(),
    };
  }

  onSignal(listener: CapabilityBackpressureListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

