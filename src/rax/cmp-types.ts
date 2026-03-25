import type {
  BootstrapCmpProjectInfraInput,
  CommitContextDeltaInput,
  CommitContextDeltaResult,
  CmpProjectInfraBootstrapReceipt,
  CmpRuntimeInfraProjectState,
  CmpRuntimeSnapshot,
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
} from "../agent_core/index.js";
import type { CreateRaxCmpConfigInput, RaxCmpConfig } from "./cmp-config.js";

export type RaxCmpMode = "active_preferred" | "passive_only" | "mixed";

export interface RaxCmpBootstrapAgentInput {
  agentId: string;
  parentAgentId?: string;
  depth?: number;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpGitInfraConfig {
  provider: "shared_git_infra";
  repoName: string;
  repoRootPath: string;
  defaultBranchName: string;
  worktreeRootPath?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpDatabaseConfig {
  kind: "postgresql";
  databaseName: string;
  schemaName?: string;
  liveExecutionPreferred: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpMqConfig {
  kind: "redis";
  namespaceRoot?: string;
  liveExecutionPreferred: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSession {
  sessionId: string;
  projectId: string;
  createdAt: string;
  config: RaxCmpConfig;
  runtime: RaxCmpRuntimeLike;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpCreateInput {
  config: CreateRaxCmpConfigInput | RaxCmpConfig;
  runtime?: RaxCmpRuntimeLike;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpBootstrapInput {
  session: RaxCmpSession;
  payload: Omit<BootstrapCmpProjectInfraInput, "projectId" | "repoName" | "repoRootPath"> & {
    projectId?: string;
    repoName?: string;
    repoRootPath?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RaxCmpBootstrapResult {
  status: "bootstrapped";
  receipt: CmpProjectInfraBootstrapReceipt;
  session: RaxCmpSession;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpReadbackInput {
  session: RaxCmpSession;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpReadbackResult {
  status: "found" | "not_found";
  receipt?: CmpProjectInfraBootstrapReceipt;
  infraState?: CmpRuntimeInfraProjectState;
  summary?: RaxCmpReadbackSummary;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpReadbackSummary {
  projectId: string;
  status: "ready" | "degraded" | "failed";
  receiptAvailable: boolean;
  infraStateAvailable: boolean;
  gitBootstrapStatus?: CmpProjectInfraBootstrapReceipt["git"]["status"];
  dbReceiptStatus?: CmpProjectInfraBootstrapReceipt["dbReceipt"]["status"];
  gitBranchBootstrapCount: number;
  mqBootstrapCount: number;
  expectedLineageCount: number;
  hydratedLineageCount: number;
  expectedDbTargetCount?: number;
  presentDbTargetCount?: number;
  issues: string[];
}

export interface RaxCmpRecoverInput {
  session: RaxCmpSession;
  snapshot: CmpRuntimeSnapshot;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpRecoverResult {
  status: "recovered";
  session: RaxCmpSession;
  snapshot: CmpRuntimeSnapshot;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSmokeCheck {
  id: string;
  status: "ready" | "degraded" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSmokeInput {
  session: RaxCmpSession;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSmokeResult {
  status: "ready" | "degraded" | "failed";
  checks: RaxCmpSmokeCheck[];
  metadata?: Record<string, unknown>;
}

export interface RaxCmpIngestInput {
  session: RaxCmpSession;
  payload: IngestRuntimeContextInput;
}

export interface RaxCmpCommitInput {
  session: RaxCmpSession;
  payload: CommitContextDeltaInput;
}

export interface RaxCmpRequestHistoryInput {
  session: RaxCmpSession;
  payload: RequestHistoricalContextInput;
}

export interface RaxCmpResolveInput {
  session: RaxCmpSession;
  payload: ResolveCheckedSnapshotInput;
}

export interface RaxCmpMaterializeInput {
  session: RaxCmpSession;
  payload: MaterializeContextPackageInput;
}

export interface RaxCmpDispatchInput {
  session: RaxCmpSession;
  payload: DispatchContextPackageInput;
}

export interface RaxCmpRuntimeLike {
  bootstrapCmpProjectInfra(
    input: BootstrapCmpProjectInfraInput,
  ): Promise<CmpProjectInfraBootstrapReceipt> | CmpProjectInfraBootstrapReceipt;
  getCmpProjectInfraBootstrapReceipt(projectId: string): CmpProjectInfraBootstrapReceipt | undefined;
  getCmpRuntimeInfraProjectState?(projectId: string): CmpRuntimeInfraProjectState | undefined;
  recoverCmpRuntimeSnapshot(snapshot: CmpRuntimeSnapshot): Promise<void> | void;
  ingestRuntimeContext(
    input: IngestRuntimeContextInput,
  ): Promise<IngestRuntimeContextResult> | IngestRuntimeContextResult;
  commitContextDelta(
    input: CommitContextDeltaInput,
  ): Promise<CommitContextDeltaResult> | CommitContextDeltaResult;
  resolveCheckedSnapshot(
    input: ResolveCheckedSnapshotInput,
  ): Promise<ResolveCheckedSnapshotResult> | ResolveCheckedSnapshotResult;
  materializeContextPackage(
    input: MaterializeContextPackageInput,
  ): Promise<MaterializeContextPackageResult> | MaterializeContextPackageResult;
  dispatchContextPackage(
    input: DispatchContextPackageInput,
  ): Promise<DispatchContextPackageResult> | DispatchContextPackageResult;
  requestHistoricalContext(
    input: RequestHistoricalContextInput,
  ): Promise<RequestHistoricalContextResult> | RequestHistoricalContextResult;
}

export interface RaxCmpFacade {
  create(input: RaxCmpCreateInput): RaxCmpSession;
  bootstrap(input: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult>;
  readback(input: RaxCmpReadbackInput): Promise<RaxCmpReadbackResult>;
  recover(input: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult>;
  ingest(input: RaxCmpIngestInput): Promise<IngestRuntimeContextResult>;
  commit(input: RaxCmpCommitInput): Promise<CommitContextDeltaResult>;
  resolve(input: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult>;
  materialize(input: RaxCmpMaterializeInput): Promise<MaterializeContextPackageResult>;
  dispatch(input: RaxCmpDispatchInput): Promise<DispatchContextPackageResult>;
  requestHistory(input: RaxCmpRequestHistoryInput): Promise<RequestHistoricalContextResult>;
  smoke(input: RaxCmpSmokeInput): Promise<RaxCmpSmokeResult>;
}
