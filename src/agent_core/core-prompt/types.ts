export type CorePromptPackId =
  | "core-system/v1"
  | "core-development/v1"
  | "core-contextual-user/v1";

export interface CoreSystemPromptPack {
  promptPackId: "core-system/v1";
  text: string;
}

export interface CoreDevelopmentPromptPack {
  promptPackId: "core-development/v1";
  text: string;
}

export interface CoreCmpContextPackageIdentityV1 {
  packageId: string;
  packageRef: string;
  packageKind?: string;
  packageMode?: string;
  projectionId?: string;
  snapshotId?: string;
}

export interface CoreCmpContextPackageObjectiveV1 {
  taskSummary?: string;
  currentObjective?: string;
  requestedAction?: string;
}

export interface CoreCmpContextPackagePayloadV1 {
  primaryContext?: string;
  backgroundContext?: string;
  timelineSummary?: string;
  constraints?: string[];
  risks?: string[];
  sourceAnchorRefs?: string[];
}

export interface CoreCmpContextPackageGovernanceV1 {
  operatorGuide?: string;
  childGuide?: string;
  checkerReason?: string;
  routeRationale?: string;
  scopePolicy?: string;
  confidenceLabel?: "high" | "medium" | "low";
  fidelityLabel?: string;
  freshness?: "fresh" | "stale" | "aging";
}

export interface CoreCmpContextPackageV1 {
  schemaVersion: "core-cmp-context-package/v1";
  deliveryStatus: "available" | "partial" | "absent" | "pending" | "skipped";
  identity?: CoreCmpContextPackageIdentityV1;
  objective?: CoreCmpContextPackageObjectiveV1;
  payload?: CoreCmpContextPackagePayloadV1;
  governance?: CoreCmpContextPackageGovernanceV1;
}

export interface CoreCmpWorksitePackageIdentityV1 {
  sessionId: string;
  agentId: string;
  packageId?: string;
  packageRef?: string;
  packageKind?: string;
  packageMode?: string;
  projectionId?: string;
  snapshotId?: string;
  packageFamilyId?: string;
  primaryPackageId?: string;
  primaryPackageRef?: string;
}

export interface CoreCmpWorksitePackageObjectiveV1 {
  currentObjective?: string;
  taskSummary?: string;
  requestedAction?: string;
  activeTurnIndex?: number;
}

export interface CoreCmpWorksitePackagePayloadV1 {
  primaryContext?: string;
  backgroundContext?: string;
  timelineSummary?: string;
  sourceAnchorRefs?: string[];
  unresolvedStateSummary?: string;
  reviewStateSummary?: string;
  routeStateSummary?: string;
}

export interface CoreCmpWorksitePackageGovernanceV1 {
  operatorGuide?: string;
  childGuide?: string;
  checkerReason?: string;
  routeRationale?: string;
  scopePolicy?: string;
  confidenceLabel?: "high" | "medium" | "low";
  fidelityLabel?: string;
  freshness?: "fresh" | "stale" | "aging";
  recoveryStatus?: "healthy" | "degraded";
}

export interface CoreCmpWorksitePackageFlowV1 {
  pendingPeerApprovalCount?: number;
  approvedPeerApprovalCount?: number;
  parentPromoteReviewCount?: number;
  reinterventionPendingCount?: number;
  reinterventionServedCount?: number;
  childSeedToIcmaCount?: number;
  passiveReturnCount?: number;
  latestStages?: string[];
}

export interface CoreCmpWorksitePackageV1 {
  schemaVersion: "core-cmp-worksite-package/v1";
  deliveryStatus: "available" | "partial" | "absent" | "pending" | "skipped";
  identity?: CoreCmpWorksitePackageIdentityV1;
  objective?: CoreCmpWorksitePackageObjectiveV1;
  payload?: CoreCmpWorksitePackagePayloadV1;
  governance?: CoreCmpWorksitePackageGovernanceV1;
  flow?: CoreCmpWorksitePackageFlowV1;
}

export interface CoreMpRoutedPackageObjectiveV1 {
  currentObjective?: string;
  retrievalMode?: "resolve" | "history" | "fallback";
  objectiveMatchSummary?: string;
}

export interface CoreMpRoutedPackageGovernanceV1 {
  routeLabel?: string;
  governanceReason?: string;
  fallbackReason?: string;
}

export interface CoreMpRoutedPackageRetrievalV1 {
  receiptId?: string;
  primaryCount?: number;
  supportingCount?: number;
  omittedCount?: number;
}

export interface CoreMpRoutedPackageV1 {
  schemaVersion: "core-mp-routed-package/v1" | "core-mp-routed-package/v2";
  deliveryStatus: "available" | "partial" | "absent" | "pending" | "skipped";
  packageId: string;
  packageRef?: string;
  sourceClass:
    | "mp_resolve_bundle"
    | "mp_history_bundle"
    | "mp_native_resolve"
    | "mp_native_history"
    | "cmp_seeded_memory"
    | "repo_memory_fallback";
  summary: string;
  relevanceLabel?: "high" | "medium" | "low";
  freshnessLabel?: "fresh" | "aging" | "stale";
  confidenceLabel?: "high" | "medium" | "low";
  primaryMemoryRefs?: string[];
  supportingMemoryRefs?: string[];
  objective?: CoreMpRoutedPackageObjectiveV1;
  governance?: CoreMpRoutedPackageGovernanceV1;
  retrieval?: CoreMpRoutedPackageRetrievalV1;
}

export interface CoreWorkspaceInitContextV1 {
  schemaVersion: "core-workspace-init-context/v1";
  sourcePath: string;
  bodyRef?: string;
  summary: string;
  excerpt: string;
  updatedAt: string;
  freshness: "fresh" | "changed";
}

export interface CoreOverlayIndexEntryV1 {
  id: string;
  label: string;
  summary: string;
  bodyRef?: string;
}

export interface CoreOverlayIndexV1 {
  schemaVersion: "core-overlay-index/v1";
  capabilityFamilies?: CoreOverlayIndexEntryV1[];
  skills?: CoreOverlayIndexEntryV1[];
  memories?: CoreOverlayIndexEntryV1[];
}

export interface CoreContextualTextBlock {
  heading: string;
  body: string;
}

export interface CoreDevelopmentPromptInput {
  tapMode: string;
  automationDepth: string;
  uiMode?: string;
}

export interface CoreContextualUserV1 {
  currentObjective: string;
  recentTranscript: string;
  workspaceContext?: string;
  workspaceInitContext?: string | CoreWorkspaceInitContextV1;
  cmpWorksitePackage?: string | CoreCmpWorksitePackageV1;
  cmpContextPackage?: string | CoreCmpContextPackageV1;
  mpRoutedPackage?: string | CoreMpRoutedPackageV1;
  overlayIndex?: CoreOverlayIndexV1;
  tapCapabilityWindow?: string;
  capabilityHistory?: string;
  latestToolResult?: string;
  groundingEvidence?: string;
  taskSpecificConstraints?: string;
}

export interface CorePromptMessage {
  role: "system" | "developer" | "user";
  content: string;
}
