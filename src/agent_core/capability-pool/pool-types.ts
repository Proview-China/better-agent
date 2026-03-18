import type {
  CapabilityBackpressureListener,
  CapabilityPool,
  CapabilityResultListener,
} from "../capability-types/capability-gateway.js";
import type {
  CapabilityAdapter,
  CapabilityBinding,
  CapabilityManifest,
} from "../capability-types/index.js";
import type {
  CapabilityBackpressureSignal,
  CapabilityResultEnvelope,
} from "../capability-types/capability-result.js";
import type {
  CapabilityExecutionHandle,
  PreparedCapabilityCall,
} from "../capability-types/capability-invocation.js";

export interface CapabilityPoolOptions {
  maxQueueDepth?: number;
  maxInflight?: number;
  clock?: () => Date;
}

export interface CapabilityPoolStats {
  manifests: number;
  bindings: number;
  preparedCalls: number;
  executions: number;
  queued: number;
  inflight: number;
  cachedResults: number;
}

export interface CapabilityPoolRegistration {
  manifest: CapabilityManifest;
  binding: CapabilityBinding;
  adapter: CapabilityAdapter;
}

export interface CapabilityPoolQueueItem {
  prepared: PreparedCapabilityCall;
  enqueuedAt: string;
  sortPriority: number;
}

export interface CapabilityPoolListeners {
  result: Set<CapabilityResultListener>;
  backpressure: Set<CapabilityBackpressureListener>;
}

export interface CapabilityPoolBackpressureState {
  active: boolean;
  queueDepth: number;
  inflight: number;
  reason?: string;
}

export interface CapabilityPoolBackpressureMonitorLike {
  evaluate(queueDepth: number, inflight: number): CapabilityPoolBackpressureState;
  notifyIfChanged(queueDepth: number, inflight: number): CapabilityBackpressureSignal;
  onSignal(listener: CapabilityBackpressureListener): () => void;
}

export interface CapabilityPoolResultCacheLike {
  get(key: string | undefined): CapabilityResultEnvelope | undefined;
  set(key: string | undefined, result: CapabilityResultEnvelope): void;
  size(): number;
}

export interface CapabilityPoolRegistryLike {
  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityPoolRegistration;
  unregister(bindingId: string): void;
  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityPoolRegistration;
  suspend(bindingId: string): void;
  resume(bindingId: string): void;
  listCapabilities(): readonly CapabilityManifest[];
  listBindings(): readonly CapabilityBinding[];
  listBindingsForKey(capabilityKey: string): readonly CapabilityBinding[];
  listRegistrations(): readonly CapabilityPoolRegistration[];
  getRegistrationByBindingId(bindingId: string): CapabilityPoolRegistration | undefined;
  getActiveRegistrationsForCapability(capabilityKey: string): readonly CapabilityPoolRegistration[];
  getBinding(bindingId: string): CapabilityBinding | undefined;
  getManifest(capabilityId: string): CapabilityManifest | undefined;
  getAdapter(bindingId: string): CapabilityAdapter | undefined;
}

export interface DefaultCapabilityPool extends CapabilityPool {}

export interface CapabilityPoolRuntimeLike extends CapabilityPool {
  getStats(): CapabilityPoolStats;
  emitBackpressure(signal: CapabilityBackpressureSignal): void;
  getBinding(bindingId: string): CapabilityBinding | undefined;
  getManifest(capabilityId: string): CapabilityManifest | undefined;
  getPreparedCall(preparedId: string): PreparedCapabilityCall | undefined;
  getExecution(executionId: string): CapabilityExecutionHandle | undefined;
}
