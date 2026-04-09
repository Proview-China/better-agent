export const MP_FIVE_AGENT_ROLES = [
  "icma",
  "iterator",
  "checker",
  "dbagent",
  "dispatcher",
] as const;

export type MpFiveAgentRole = (typeof MP_FIVE_AGENT_ROLES)[number];

export const MP_ICMA_STAGES = [
  "capture",
  "chunk_candidate",
  "emit_candidate",
] as const;
export const MP_ITERATOR_STAGES = [
  "accept_candidate",
  "rewrite_draft",
  "handoff_checker",
] as const;
export const MP_CHECKER_STAGES = [
  "inspect_candidate",
  "judge_alignment",
  "emit_decision",
] as const;
export const MP_DBAGENT_STAGES = [
  "materialize",
  "update_lineage",
  "persist_truth",
] as const;
export const MP_DISPATCHER_STAGES = [
  "search",
  "rerank",
  "assemble_bundle",
] as const;

export type MpIcmaStage = (typeof MP_ICMA_STAGES)[number];
export type MpIteratorStage = (typeof MP_ITERATOR_STAGES)[number];
export type MpCheckerStage = (typeof MP_CHECKER_STAGES)[number];
export type MpDbAgentStage = (typeof MP_DBAGENT_STAGES)[number];
export type MpDispatcherStage = (typeof MP_DISPATCHER_STAGES)[number];
