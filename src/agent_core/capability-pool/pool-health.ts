export const CAPABILITY_POOL_HEALTH_STATES = [
  "healthy",
  "degraded",
  "blocked",
  "disabled",
] as const;
export type CapabilityPoolHealthState = (typeof CAPABILITY_POOL_HEALTH_STATES)[number];

export interface CapabilityPoolHealthRecord {
  bindingId: string;
  state: CapabilityPoolHealthState;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export class CapabilityPoolHealthRegistry {
  readonly #records = new Map<string, CapabilityPoolHealthRecord>();

  set(record: CapabilityPoolHealthRecord): void {
    this.#records.set(record.bindingId, record);
  }

  get(bindingId: string): CapabilityPoolHealthRecord | undefined {
    return this.#records.get(bindingId);
  }

  list(): readonly CapabilityPoolHealthRecord[] {
    return [...this.#records.values()];
  }
}

