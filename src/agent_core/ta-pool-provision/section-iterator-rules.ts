export const SECTION_ITERATOR_RULE_ACTIONS = [
  "store",
  "split",
  "merge",
  "iterate",
  "update",
] as const;
export type SectionIteratorRuleAction =
  (typeof SECTION_ITERATOR_RULE_ACTIONS)[number];

export interface SectionIteratorRule {
  ruleId: string;
  action: SectionIteratorRuleAction;
  priority: number;
  summary: string;
  rationale: string;
  signals: string[];
}

export interface SectionIteratorRuleSetFlow {
  sourceStore: string;
  runtime: string;
  returnStore: string;
}

export interface SectionIteratorRuleSet {
  slot: "iterator_rules";
  version: "cmp-section-iterator.v0";
  objective: string;
  granularityFocus: string;
  hierarchyFocus: string;
  flow: SectionIteratorRuleSetFlow;
  rules: SectionIteratorRule[];
  metadata?: Record<string, unknown>;
}

export interface CreateSectionIteratorRuleSetInput {
  capabilityKey: string;
  lane: "bootstrap" | "extended";
}

export function createSectionIteratorRuleSet(
  input: CreateSectionIteratorRuleSetInput,
): SectionIteratorRuleSet {
  return {
    slot: "iterator_rules",
    version: "cmp-section-iterator.v0",
    objective:
      "Judge whether an incoming section is stable enough to return to Stored-Agent as a reusable knowledge block.",
    granularityFocus:
      "Prefer one semantic unit per stored section; split mixed topics and merge fragments that cannot stand alone.",
    hierarchyFocus:
      "Preserve parent-child history before replacement; update only peers, iterate when lineage or conflict remains unclear.",
    flow: {
      sourceStore: "Stored-Agent",
      runtime: "iterator-agent-loop-runtime",
      returnStore: "Stored-Agent",
    },
    rules: [
      {
        ruleId: "store_standalone_semantic_unit",
        action: "store",
        priority: 10,
        summary:
          "Store directly when the section expresses one stable semantic unit and keeps meaning outside the current run.",
        rationale:
          "Stored-Agent should only retain reusable blocks that do not depend on hidden runtime context.",
        signals: [
          "single topic or capability decision",
          "clear source or lineage hints",
          "can be reused without the surrounding transient run log",
        ],
      },
      {
        ruleId: "split_mixed_topic_or_mixed_lifecycle_section",
        action: "split",
        priority: 20,
        summary:
          "Split when one section mixes multiple topics, lifecycle phases, or unrelated decisions.",
        rationale:
          "Iterator granularity checks should prevent broad mixed payloads from polluting retrieval quality.",
        signals: [
          "background plus action plus verification packed together",
          "multiple capability objects in one section",
          "one block contains both parent summary and child detail with no boundary",
        ],
      },
      {
        ruleId: "merge_fragment_that_cannot_stand_alone",
        action: "merge",
        priority: 30,
        summary:
          "Merge when the section is too fragmentary to survive as a standalone stored block.",
        rationale:
          "Very small orphaned sections harm retrieval because they lose their meaning outside nearby context.",
        signals: [
          "only a caveat, tail note, or isolated bullet",
          "depends on adjacent parent section to make sense",
          "missing subject, scope, or decision target",
        ],
      },
      {
        ruleId: "update_same_semantic_peer_when_newer_or_clearer",
        action: "update",
        priority: 40,
        summary:
          "Update when the incoming section is the newer or clearer peer of an existing stored section.",
        rationale:
          "Iterator should refresh stale peer records instead of duplicating the same semantic unit.",
        signals: [
          "same semantic key or capability subject",
          "same hierarchy layer as the stored peer",
          "incoming block has stronger evidence, fresher timestamp, or clearer boundary",
        ],
      },
      {
        ruleId: "iterate_when_hierarchy_or_conflict_is_not_settled",
        action: "iterate",
        priority: 50,
        summary:
          "Keep iterating when parent-child hierarchy, cross-section conflict, or lineage is still unresolved.",
        rationale:
          "History-layer checks should delay storage until the iterator can tell whether the new block extends, replaces, or contradicts older sections.",
        signals: [
          "new section conflicts with stored content but source authority is unclear",
          "possible parent-child relation is visible but not stable yet",
          "needs neighboring sections before a safe store/update decision can be made",
        ],
      },
    ],
    metadata: {
      capabilityKey: input.capabilityKey,
      lane: input.lane,
      owner: "cmp-iterator-external-rules",
    },
  };
}
