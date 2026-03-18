import type {
  CapabilityPool,
  CapabilityBackpressureListener,
  CapabilityResultListener,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
  CapabilityExecutionHandle,
} from "../capability-types/index.js";

export interface KernelCapabilityGatewayOptions {
  pool: CapabilityPool;
}

export interface KernelCapabilityGatewayLike {
  readonly pool: CapabilityPool;
  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease>;
  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall>;
  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  onResult(listener: CapabilityResultListener): () => void;
  onBackpressure(listener: CapabilityBackpressureListener): () => void;
}

