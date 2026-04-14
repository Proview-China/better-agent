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

export interface CoreMpRoutedPackageV1 {
  schemaVersion: "core-mp-routed-package/v1";
  deliveryStatus: "available" | "partial" | "absent";
  packageId: string;
  sourceClass: "mp_resolve_bundle" | "mp_history_bundle" | "repo_memory_fallback";
  summary: string;
  relevanceLabel?: "high" | "medium" | "low";
  freshnessLabel?: "fresh" | "aging" | "stale";
  confidenceLabel?: "high" | "medium" | "low";
  primaryMemoryRefs?: string[];
  supportingMemoryRefs?: string[];
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
