export type {
  MpAccessDecision,
  MpLineageNode,
  MpLineageRelation,
  MpPromotionDecision,
  MpRuntimeBootstrapContext,
  MpRuntimeLoweringContext,
  MpSessionAccessDecision,
} from "./runtime-types.js";
export {
  createMpLineageNode,
  createMpMemoryOwnerLineage,
  createMpRuntimeBootstrapContext,
  createMpRuntimeLoweringContext,
  validateMpLineageNode,
} from "./runtime-types.js";

export {
  assertMpPromotionAllowed,
  assertMpScopeVisibleToTarget,
  evaluateMpPromotionAllowed,
  evaluateMpScopeAccess,
  resolveMpLineageRelation,
} from "./scope-enforcement.js";

export type {
  MpSessionBridgeRecord,
  MpSessionBridgeStatus,
} from "./session-bridge.js";
export {
  MP_SESSION_BRIDGE_STATUSES,
  assertMpSessionBridgeAllowed,
  createMpSessionBridgeRecord,
  evaluateMpSessionBridgeAccess,
  resolveMpEffectiveSessionMode,
} from "./session-bridge.js";

export type {
  ArchiveMpMemoryRecordInput,
  MaterializeMpStoredSectionBatchInput,
  MaterializeMpStoredSectionInput,
  PromoteMpMemoryRecordInput,
} from "./materialization.js";
export {
  archiveMpMemoryRecord,
  materializeMpStoredSection,
  materializeMpStoredSectionBatch,
  promoteMpMemoryRecord,
} from "./materialization.js";

export type {
  CreateMpSearchPlanInput,
  ExecuteMpSearchPlanInput,
  MpSearchPlan,
} from "./search-planner.js";
export {
  buildMpSourceLineages,
  createMpSearchPlan,
  executeMpSearchPlan,
  summarizeMpSearchHits,
} from "./search-planner.js";
