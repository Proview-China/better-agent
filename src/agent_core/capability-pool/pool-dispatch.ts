import { randomUUID } from "node:crypto";

import { RaxRoutingError } from "../../rax/errors.js";
import type {
  CapabilityAdapter,
  CapabilityBackpressureListener,
  CapabilityBinding,
  CapabilityManifest,
  CapabilityPool,
  CapabilityResultListener,
  CapabilityResultEnvelope,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityExecutionHandle,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import type { CapabilityPoolOptions, CapabilityPoolStats } from "./pool-types.js";
import { CapabilityPoolBackpressureMonitor } from "./pool-backpressure.js";
import { CapabilityPoolDrainTracker } from "./pool-drain.js";
import { CapabilityPoolHealthRegistry } from "./pool-health.js";
import { CapabilityPoolResultCache } from "./pool-idempotency.js";
import { CapabilityPoolLifecycle } from "./pool-lifecycle.js";
import { CapabilityPoolQueue } from "./pool-queue.js";
import { CapabilityPoolRegistry } from "./pool-registry.js";

const PRIORITY_ORDER: Record<CapabilityInvocationPlan["priority"], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class DefaultCapabilityPool implements CapabilityPool {
  readonly #registry = new CapabilityPoolRegistry();
  readonly #lifecycle = new CapabilityPoolLifecycle(this.#registry);
  readonly #queue = new CapabilityPoolQueue();
  readonly #backpressure: CapabilityPoolBackpressureMonitor;
  readonly #resultCache = new CapabilityPoolResultCache();
  readonly #health = new CapabilityPoolHealthRegistry();
  readonly #drain = new CapabilityPoolDrainTracker();
  readonly #resultListeners = new Set<CapabilityResultListener>();
  readonly #backpressureListeners = new Set<CapabilityBackpressureListener>();
  readonly #clock: () => Date;
  readonly #maxInflight: number;
  readonly #maxQueueDepth: number;
  readonly #executions = new Map<string, { bindingId: string; preparedId: string; adapter: CapabilityAdapter; planKey?: string }>();
  #inflight = 0;
  #drainingQueue = false;

  constructor(options: CapabilityPoolOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
    this.#maxInflight = options.maxInflight ?? 16;
    this.#maxQueueDepth = options.maxQueueDepth ?? 128;
    this.#backpressure = new CapabilityPoolBackpressureMonitor({
      maxInflight: this.#maxInflight,
      maxQueueDepth: this.#maxQueueDepth,
      clock: this.#clock,
    });
  }

  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding {
    return this.#lifecycle.register(manifest, adapter);
  }

  unregister(bindingId: string): void {
    if (this.#drain.getInflight(bindingId) > 0) {
      this.#registry.suspend(bindingId);
      return;
    }
    this.#lifecycle.unregister(bindingId);
  }

  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding {
    return this.#lifecycle.replace(bindingId, manifest, adapter);
  }

  suspend(bindingId: string): void {
    this.#lifecycle.suspend(bindingId);
  }

  resume(bindingId: string): void {
    this.#lifecycle.resume(bindingId);
  }

  listCapabilities(): readonly CapabilityManifest[] {
    return this.#registry.listCapabilities();
  }

  listBindings(): readonly CapabilityBinding[] {
    return this.#registry.listBindings();
  }

  async acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease> {
    const registration = this.#registry.getActiveRegistrationsForCapability(plan.capabilityKey)
      .find((entry) => entry.adapter.supports(plan));
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_pool_binding_missing",
        `No active capability binding is available for ${plan.capabilityKey}.`,
      );
    }

    return {
      leaseId: randomUUID(),
      capabilityId: registration.manifest.capabilityId,
      bindingId: registration.binding.bindingId,
      generation: registration.binding.generation,
      grantedAt: this.#clock().toISOString(),
      priority: plan.priority,
      queueClass: registration.binding.priorityClass,
      backpressureSnapshot: {
        queueDepth: this.#queue.size(),
        inflight: this.#inflight,
      },
      preparedCacheKey: plan.idempotencyKey,
      metadata: {
        capabilityKey: plan.capabilityKey,
        operation: plan.operation,
      },
    };
  }

  async prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall> {
    const registration = this.#registry.getRegistrationByBindingId(lease.bindingId);
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_pool_binding_missing",
        `Capability binding ${lease.bindingId} was not found during prepare.`,
      );
    }

    const prepared = await registration.adapter.prepare(plan, lease);
    return {
      ...prepared,
      metadata: {
        ...(prepared.metadata ?? {}),
        planId: plan.planId,
        idempotencyKey: plan.idempotencyKey,
        priority: plan.priority,
      },
    };
  }

  async dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle> {
    const registration = this.#registry.getRegistrationByBindingId(prepared.bindingId);
    if (!registration) {
      throw new RaxRoutingError(
        "agent_core_capability_pool_binding_missing",
        `Capability binding ${prepared.bindingId} was not found during dispatch.`,
      );
    }

    const cached = this.#resultCache.get(prepared.metadata?.idempotencyKey as string | undefined);
    const executionId = randomUUID();
    const baseHandle: CapabilityExecutionHandle = {
      executionId,
      preparedId: prepared.preparedId,
      startedAt: this.#clock().toISOString(),
      state: prepared.executionMode === "queued" ? "queued" : "running",
      metadata: {
        bindingId: prepared.bindingId,
        capabilityKey: prepared.capabilityKey,
      },
    };

    this.#executions.set(executionId, {
      bindingId: prepared.bindingId,
      preparedId: prepared.preparedId,
      adapter: registration.adapter,
      planKey: prepared.metadata?.idempotencyKey as string | undefined,
    });

    if (cached) {
      queueMicrotask(() => {
        this.#emitResult({
          ...cached,
          executionId,
          metadata: {
            ...(cached.metadata ?? {}),
            preparedId: prepared.preparedId,
          },
        });
      });
      return {
        ...baseHandle,
        state: "completed",
      };
    }

    if (prepared.executionMode === "queued") {
      this.#queue.enqueue({
        prepared,
        enqueuedAt: this.#clock().toISOString(),
        sortPriority: PRIORITY_ORDER[(prepared.metadata?.priority as CapabilityInvocationPlan["priority"]) ?? "normal"],
      });
      this.#notifyBackpressure();
      this.#scheduleDrain();
      return baseHandle;
    }

    void this.#runExecution(executionId, prepared, registration.adapter);
    return baseHandle;
  }

  async cancel(executionId: string): Promise<void> {
    const execution = this.#executions.get(executionId);
    if (!execution) {
      return;
    }

    await execution.adapter.cancel?.(executionId);
    const now = this.#clock().toISOString();
    this.#emitResult({
      executionId,
      resultId: executionId,
      status: "cancelled",
      completedAt: now,
      error: {
        code: "agent_core_capability_cancelled",
        message: `Capability execution ${executionId} was cancelled.`,
      },
      metadata: {
        bindingId: execution.bindingId,
        preparedId: execution.preparedId,
      },
    });
  }

  async health(bindingId?: string): Promise<unknown> {
    if (bindingId) {
      const registration = this.#registry.getRegistrationByBindingId(bindingId);
      if (!registration) {
        return this.#health.get(bindingId);
      }
      const result = await registration.adapter.healthCheck?.();
      if (result && typeof result === "object") {
        this.#health.set({
          bindingId,
          state: "healthy",
          checkedAt: this.#clock().toISOString(),
          details: result as Record<string, unknown>,
        });
      }
      return result ?? this.#health.get(bindingId);
    }
    return this.#health.list();
  }

  stats(): CapabilityPoolStats {
    return {
      manifests: this.#registry.listCapabilities().length,
      bindings: this.#registry.listBindings().length,
      preparedCalls: 0,
      executions: this.#executions.size,
      queued: this.#queue.size(),
      inflight: this.#inflight,
      cachedResults: this.#resultCache.size(),
    };
  }

  onResult(listener: CapabilityResultListener): () => void {
    this.#resultListeners.add(listener);
    return () => {
      this.#resultListeners.delete(listener);
    };
  }

  onBackpressure(listener: CapabilityBackpressureListener): () => void {
    this.#backpressureListeners.add(listener);
    const off = this.#backpressure.onSignal(listener);
    return () => {
      this.#backpressureListeners.delete(listener);
      off();
    };
  }

  #scheduleDrain(): void {
    if (this.#drainingQueue) {
      return;
    }
    this.#drainingQueue = true;
    queueMicrotask(async () => {
      try {
        while (this.#inflight < this.#maxInflight) {
          const next = this.#queue.dequeue();
          if (!next) {
            break;
          }
          const registration = this.#registry.getRegistrationByBindingId(next.prepared.bindingId);
          if (!registration) {
            continue;
          }
          const executionId = randomUUID();
          this.#executions.set(executionId, {
            bindingId: next.prepared.bindingId,
            preparedId: next.prepared.preparedId,
            adapter: registration.adapter,
            planKey: next.prepared.metadata?.idempotencyKey as string | undefined,
          });
          void this.#runExecution(executionId, next.prepared, registration.adapter);
        }
      } finally {
        this.#drainingQueue = false;
        this.#notifyBackpressure();
      }
    });
  }

  async #runExecution(
    executionId: string,
    prepared: PreparedCapabilityCall,
    adapter: CapabilityAdapter,
  ): Promise<void> {
    this.#inflight += 1;
    this.#drain.start(prepared.bindingId);
    this.#notifyBackpressure();

    try {
      const result = await adapter.execute(prepared);
      this.#resultCache.set(prepared.metadata?.idempotencyKey as string | undefined, result);
      this.#emitResult({
        ...result,
        executionId,
        metadata: {
          ...(result.metadata ?? {}),
          preparedId: prepared.preparedId,
        },
      });
    } catch (error) {
      this.#emitResult({
        executionId,
        resultId: executionId,
        status: "failed",
        completedAt: this.#clock().toISOString(),
        error: {
          code: "agent_core_capability_pool_execute_failed",
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          bindingId: prepared.bindingId,
          capabilityKey: prepared.capabilityKey,
          preparedId: prepared.preparedId,
        },
      });
    } finally {
      this.#inflight = Math.max(0, this.#inflight - 1);
      const remaining = this.#drain.complete(prepared.bindingId);
      const registration = this.#registry.getRegistrationByBindingId(prepared.bindingId);
      if (registration?.binding.state === "draining" && remaining === 0) {
        this.#lifecycle.unregister(prepared.bindingId);
      }
      this.#executions.delete(executionId);
      this.#notifyBackpressure();
      this.#scheduleDrain();
    }
  }

  #emitResult(result: CapabilityResultEnvelope): void {
    for (const listener of this.#resultListeners) {
      listener(result);
    }
  }

  #notifyBackpressure(): void {
    this.#backpressure.notifyIfChanged(this.#queue.size(), this.#inflight);
  }
}
