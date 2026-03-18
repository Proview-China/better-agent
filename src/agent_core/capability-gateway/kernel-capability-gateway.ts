import type {
  CapabilityBackpressureListener,
  CapabilityExecutionHandle,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityPool,
  CapabilityResultListener,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import type { KernelCapabilityGatewayLike, KernelCapabilityGatewayOptions } from "./gateway-types.js";

export class DefaultKernelCapabilityGateway implements KernelCapabilityGatewayLike {
  readonly pool: CapabilityPool;

  constructor(options: KernelCapabilityGatewayOptions) {
    this.pool = options.pool;
  }

  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease> {
    return this.pool.acquire(plan);
  }

  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall> {
    return this.pool.prepare(lease, plan);
  }

  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle> {
    return this.pool.dispatch(prepared);
  }

  cancel(executionId: string): Promise<void> {
    return this.pool.cancel(executionId);
  }

  onResult(listener: CapabilityResultListener): () => void {
    return this.pool.onResult(listener);
  }

  onBackpressure(listener: CapabilityBackpressureListener): () => void {
    return this.pool.onBackpressure(listener);
  }
}

export function createKernelCapabilityGateway(
  options: KernelCapabilityGatewayOptions,
): KernelCapabilityGatewayLike {
  return new DefaultKernelCapabilityGateway(options);
}
