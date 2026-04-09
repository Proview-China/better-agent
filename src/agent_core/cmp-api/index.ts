import type {
  CmpFiveAgentCapabilityAccessResolution,
  CmpFiveAgentSummary,
  CmpFiveAgentRuntimeSnapshot,
  CmpPeerExchangeApprovalRecord,
  CmpFiveAgentRole,
  CmpIcmaIngestInput,
  CmpIcmaLiveOptions,
  CmpIteratorAdvanceInput,
  CmpIteratorLiveOptions,
  CmpCheckerEvaluateInput,
  CmpCheckerLiveOptions,
  CmpDbAgentMaterializeInput,
  CmpDbAgentMaterializeLiveOptions,
  CmpDbAgentPassiveInput,
  CmpDbAgentPassiveLiveOptions,
  CmpDispatcherDispatchInput,
  CmpDispatcherLiveOptions,
  CmpDispatcherPassiveReturnInput,
  CmpDispatcherPassiveLiveOptions,
  CmpFiveAgentActiveLiveRunInput,
  CmpFiveAgentPassiveLiveRunInput,
  CmpFiveAgentTapBridgeContext,
} from "../cmp-five-agent/index.js";
import type {
  CommitContextDeltaInput,
  CommitContextDeltaResult,
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextInput,
  IngestRuntimeContextResult,
  MaterializeContextPackageInput,
  MaterializeContextPackageResult,
  RequestHistoricalContextInput,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotInput,
  ResolveCheckedSnapshotResult,
} from "../cmp-types/index.js";
import type {
  BootstrapCmpProjectInfraInput,
  CmpRuntimeDeliveryTruthSummary,
  DispatchCmpFiveAgentCapabilityResult,
  CmpRuntimeProjectRecoverySummary,
  CmpRuntimeRecoverySummary,
} from "../runtime.js";
import type { CmpRuntimeInfraProjectState } from "../cmp-runtime/infra-state.js";
import type { CmpRuntimeSnapshot } from "../cmp-runtime/runtime-snapshot.js";
import type { CmpProjectInfraBootstrapReceipt } from "../cmp-runtime/infra-bootstrap.js";
import type {
  AccessRequestScope,
  TaCapabilityTier,
  TaPoolMode,
} from "../ta-pool-types/index.js";
import type { IntentPriority } from "../types/index.js";

export interface AdvanceCmpMqDeliveryTimeoutsInput {
  projectId?: string;
  now?: string;
}

export interface AdvanceCmpMqDeliveryTimeoutsResult {
  projectId?: string;
  processedCount: number;
  retryScheduledCount: number;
  expiredCount: number;
}

export interface ResolveCmpFiveAgentCapabilityAccessInput {
  role: CmpFiveAgentRole;
  sessionId: string;
  runId: string;
  agentId: string;
  capabilityKey: string;
  reason: string;
  requestedTier?: TaCapabilityTier;
  mode?: TaPoolMode;
  taskContext?: Record<string, unknown>;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface DispatchCmpFiveAgentCapabilityInput
  extends ResolveCmpFiveAgentCapabilityAccessInput {
  capabilityInput: Record<string, unknown>;
  priority?: IntentPriority;
  timeoutMs?: number;
  cmpContext?: CmpFiveAgentTapBridgeContext;
}

export interface ReviewCmpPeerExchangeApprovalInput {
  approvalId: string;
  actorAgentId: string;
  decision: "approved" | "rejected";
  note?: string;
}

export interface AgentCoreCmpProjectApi {
  bootstrapProjectInfra(
    input: BootstrapCmpProjectInfraInput,
  ): Promise<CmpProjectInfraBootstrapReceipt> | CmpProjectInfraBootstrapReceipt;
  getBootstrapReceipt(projectId: string): CmpProjectInfraBootstrapReceipt | undefined;
  getInfraProjectState(projectId: string): CmpRuntimeInfraProjectState | undefined;
  getRecoverySummary(): CmpRuntimeRecoverySummary;
  getProjectRecoverySummary(projectId: string): CmpRuntimeProjectRecoverySummary | undefined;
  getDeliveryTruthSummary(projectId: string): CmpRuntimeDeliveryTruthSummary;
  createSnapshot(): CmpRuntimeSnapshot;
  recoverSnapshot(snapshot: CmpRuntimeSnapshot): Promise<void> | void;
  advanceDeliveryTimeouts(
    input?: AdvanceCmpMqDeliveryTimeoutsInput,
  ): AdvanceCmpMqDeliveryTimeoutsResult;
}

export interface AgentCoreCmpWorkflowApi {
  ingest(
    input: IngestRuntimeContextInput,
  ): Promise<IngestRuntimeContextResult> | IngestRuntimeContextResult;
  commit(
    input: CommitContextDeltaInput,
  ): Promise<CommitContextDeltaResult> | CommitContextDeltaResult;
  resolve(
    input: ResolveCheckedSnapshotInput,
  ): Promise<ResolveCheckedSnapshotResult> | ResolveCheckedSnapshotResult;
  materialize(
    input: MaterializeContextPackageInput,
  ): Promise<MaterializeContextPackageResult> | MaterializeContextPackageResult;
  dispatch(
    input: DispatchContextPackageInput,
  ): Promise<DispatchContextPackageResult> | DispatchContextPackageResult;
  requestHistory(
    input: RequestHistoricalContextInput,
  ): Promise<RequestHistoricalContextResult> | RequestHistoricalContextResult;
}

export interface AgentCoreCmpFiveAgentApi {
  getSummary(agentId?: string): CmpFiveAgentSummary;
  getSnapshot(agentId?: string): CmpFiveAgentRuntimeSnapshot;
  captureIcmaWithLlm(
    input: CmpIcmaIngestInput,
    options?: CmpIcmaLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["captureCmpIcmaWithLlm"]>>>;
  advanceIteratorWithLlm(
    input: CmpIteratorAdvanceInput,
    options?: CmpIteratorLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["advanceCmpIteratorWithLlm"]>>>;
  evaluateCheckerWithLlm(
    input: CmpCheckerEvaluateInput,
    options?: CmpCheckerLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["evaluateCmpCheckerWithLlm"]>>>;
  materializeDbAgentWithLlm(
    input: CmpDbAgentMaterializeInput,
    options?: CmpDbAgentMaterializeLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["materializeCmpDbAgentWithLlm"]>>>;
  servePassiveDbAgentWithLlm(
    input: CmpDbAgentPassiveInput,
    options?: CmpDbAgentPassiveLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["servePassiveCmpDbAgentWithLlm"]>>>;
  dispatchDispatcherWithLlm(
    input: CmpDispatcherDispatchInput,
    options?: CmpDispatcherLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["dispatchCmpDispatcherWithLlm"]>>>;
  deliverPassiveDispatcherWithLlm(
    input: CmpDispatcherPassiveReturnInput,
    options?: CmpDispatcherPassiveLiveOptions,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["deliverPassiveCmpDispatcherWithLlm"]>>>;
  runActiveLoopWithLlm(
    input: CmpFiveAgentActiveLiveRunInput,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["runCmpFiveAgentActiveLiveLoop"]>>>;
  runPassiveLoopWithLlm(
    input: CmpFiveAgentPassiveLiveRunInput,
  ): Promise<Awaited<ReturnType<import("../runtime.js").AgentCoreRuntime["runCmpFiveAgentPassiveLiveLoop"]>>>;
}

export interface AgentCoreCmpTapBridgeApi {
  resolveCapabilityAccess(
    input: ResolveCmpFiveAgentCapabilityAccessInput,
  ): Promise<CmpFiveAgentCapabilityAccessResolution> | CmpFiveAgentCapabilityAccessResolution;
  dispatchCapability(
    input: DispatchCmpFiveAgentCapabilityInput,
  ): Promise<DispatchCmpFiveAgentCapabilityResult> | DispatchCmpFiveAgentCapabilityResult;
  reviewPeerExchangeApproval(
    input: ReviewCmpPeerExchangeApprovalInput,
  ): Promise<CmpPeerExchangeApprovalRecord> | CmpPeerExchangeApprovalRecord;
}

export interface AgentCoreCmpApi {
  readonly project: AgentCoreCmpProjectApi;
  readonly workflow: AgentCoreCmpWorkflowApi;
  readonly fiveAgent: AgentCoreCmpFiveAgentApi;
  readonly tapBridge: AgentCoreCmpTapBridgeApi;
}
