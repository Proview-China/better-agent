export {
  CMP_GIT_BRANCH_KINDS,
  CMP_GIT_CANDIDATE_STATUSES,
  CMP_GIT_LINEAGE_STATUSES,
  CMP_GIT_REPO_STRATEGIES,
  CMP_GIT_SYNC_INTENTS,
  createCmpGitBranchFamily,
  createCmpGitBranchRef,
  createCmpGitCommitDeltaBinding,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
  createCmpGitSnapshotCandidateFromBinding,
  type CmpGitBranchFamily,
  type CmpGitBranchKind,
  type CmpGitBranchRef,
  type CmpGitCommitDeltaBinding,
  type CmpGitContextDeltaLike,
  type CmpGitLineageNode,
  type CmpGitLineageStatus,
  type CmpGitProjectRepo,
  type CmpGitRepoStrategy,
  type CmpGitSnapshotCandidateRecord,
  type CmpGitSnapshotCandidateStatus,
  type CmpGitSyncIntent,
  type CreateCmpGitCommitDeltaBindingInput,
  type CreateCmpGitLineageNodeInput,
  type CreateCmpGitProjectRepoInput,
} from "./cmp-git-types.js";
export { CmpGitLineageRegistry } from "./lineage-registry.js";
export {
  syncCmpGitCommitDelta,
  type CmpGitCommitSyncInput,
  type CmpGitCommitSyncResult,
} from "./commit-sync.js";
export type {
  CmpGitPullRequestRecord,
  CmpGitPullRequestStatus,
  CmpGitMergeRecord,
  CmpGitMergeStatus,
  CmpGitPromotionRecord,
  CmpGitPromotionStatus,
  CmpGitPromotionVisibility,
} from "./governance.js";
export {
  CMP_GIT_PULL_REQUEST_STATUSES,
  CMP_GIT_MERGE_STATUSES,
  CMP_GIT_PROMOTION_STATUSES,
  CMP_GIT_PROMOTION_VISIBILITIES,
  createCmpGitPromotionPullRequest,
  mergeCmpGitPromotionPullRequest,
  promoteCmpGitMerge,
  assertCmpGitPromotionKeepsAncestorsInvisible,
} from "./governance.js";
export type {
  CmpGitCheckedSnapshotRef,
  CmpGitCheckedRefStatus,
  CmpGitPromotedSnapshotRef,
  CmpGitPromotedRefStatus,
  CmpGitBranchHeadState,
} from "./refs-lifecycle.js";
export {
  CMP_GIT_CHECKED_REF_STATUSES,
  CMP_GIT_PROMOTED_REF_STATUSES,
  createCmpGitCheckedSnapshotRef,
  createCmpGitPromotedSnapshotRef,
  reconcileCmpGitBranchHeadState,
  supersedeCmpGitCheckedSnapshotRef,
  supersedeCmpGitPromotedSnapshotRef,
} from "./refs-lifecycle.js";
export {
  CmpGitSyncRuntimeOrchestrator,
  createCmpGitSyncRuntimeOrchestrator,
  type CreateCmpGitOrchestratorInput,
} from "./orchestrator.js";
export type {
  CmpGitBootstrapStatus,
  CmpGitProjectRepoBootstrapInput,
  CmpGitProjectRepoBootstrapPlan,
} from "./project-repo-bootstrap.js";
export {
  CMP_GIT_BOOTSTRAP_STATUSES,
  createCmpGitProjectRepoBootstrapPlan,
  isCmpGitBootstrapStatus,
} from "./project-repo-bootstrap.js";
export type {
  CmpGitAgentBranchRuntime,
  CreateCmpGitAgentBranchRuntimeInput,
} from "./branch-runtime.js";
export {
  createCmpGitAgentBranchRuntime,
  listCmpGitBranchRuntimes,
  resolveCmpGitAgentBranchRuntime,
} from "./branch-runtime.js";
export type {
  CmpGitBackend,
  CmpGitBackendBootstrapReceipt,
  CmpGitRefReadback,
  CmpGitAdapterErrorCode,
} from "./git-backend.js";
export {
  CMP_GIT_ADAPTER_ERROR_CODES,
  CmpGitAdapterError,
  createCmpGitAdapterError,
  isCmpGitAdapterErrorCode,
} from "./git-backend.js";
export {
  InMemoryCmpGitBackend,
  createInMemoryCmpGitBackend,
} from "./in-memory-backend.js";
export {
  GitCliCmpGitBackend,
  assertGitCliAvailable,
  createGitCliCmpGitBackend,
} from "./git-cli-backend.js";
export type {
  CmpGitLineageRelation,
  CmpGitCriticalEscalationAlert,
} from "./lineage-guard.js";
export {
  resolveCmpGitLineageRelation,
  assertCmpGitNonSkippingPromotion,
  assertCmpGitPeerExchangeStaysLocal,
  createCmpGitCriticalEscalationAlert,
  assertCmpGitCriticalEscalationAllowed,
} from "./lineage-guard.js";
export type {
  CmpGitLineageHook,
  CmpGitRuntimeHooks,
  CmpGitSyncReceipt,
  CmpGitProjectionSourceAnchor,
} from "./integration-hooks.js";
export {
  createCmpGitLineageHook,
  createCmpGitProjectionSourceAnchor,
  createCmpGitRuntimeHooks,
  createCmpGitSyncReceipt,
} from "./integration-hooks.js";
