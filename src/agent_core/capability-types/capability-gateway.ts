import type { CapabilityBinding, CapabilityManifest } from "./capability-manifest.js";
import type {
  CapabilityExecutionHandle,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "./capability-invocation.js";
import type {
  CapabilityBackpressureSignal,
  CapabilityResultEnvelope,
} from "./capability-result.js";

export type CapabilityResultListener = (result: CapabilityResultEnvelope) => void;
export type CapabilityBackpressureListener = (signal: CapabilityBackpressureSignal) => void;

export interface CapabilityAdapter {
  id: string;
  runtimeKind: string;
  supports(plan: CapabilityInvocationPlan): boolean;
  prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall>;
  execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope>;
  cancel?(executionId: string): Promise<void>;
  healthCheck?(): Promise<unknown>;
}

export interface CapabilityPool {
  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding;
  unregister(bindingId: string): void;
  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding;
  suspend(bindingId: string): void;
  resume(bindingId: string): void;
  listCapabilities(): readonly CapabilityManifest[];
  listBindings(): readonly CapabilityBinding[];
  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease>;
  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall>;
  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  health(bindingId?: string): Promise<unknown>;
  stats(): unknown;
  onResult(listener: CapabilityResultListener): () => void;
  onBackpressure(listener: CapabilityBackpressureListener): () => void;
}

export interface KernelCapabilityGateway {
  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease>;
  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall>;
  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  onResult(listener: CapabilityResultListener): () => void;
  onBackpressure(listener: CapabilityBackpressureListener): () => void;
}
