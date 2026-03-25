import { randomUUID } from "node:crypto";

import type { IngestRuntimeContextInput } from "../cmp-types/cmp-interface.js";
import type { AgentLineage } from "../cmp-types/cmp-lineage.js";
import {
  createCmpRulePack,
  createCmpStoredSectionFromSection,
  evaluateCmpRulePack,
  type CmpRuleAction,
  type CmpRuleEvaluation,
  type CmpRulePack,
  type CmpSection,
  type CmpSectionKind,
  type CmpStoredSection,
  type CmpStoredSectionPlane,
  type CmpStoredSectionState,
} from "../cmp-types/cmp-section.js";
import type { CmpSectionIngressRecord } from "./ingress-contract.js";
import { createCmpSectionIngressRecordFromIngress } from "./section-ingress.js";

export interface CreateCmpSectionsFromIngestInput {
  projectId: string;
  lineage: AgentLineage;
  source?: CmpSection["source"];
  materials: IngestRuntimeContextInput["materials"];
  createdAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface LowerCmpSectionsWithRulePackInput {
  sections: readonly CmpSection[];
  pack: CmpRulePack;
  plane: CmpStoredSectionPlane;
  persistedAt: string;
  storageRefFactory?: (section: CmpSection, evaluation: CmpRuleEvaluation) => string;
  metadata?: Record<string, unknown>;
}

export interface CmpSectionLoweringRecord {
  section: CmpSection;
  evaluation: CmpRuleEvaluation;
  storedSection?: CmpStoredSection;
  dropped: boolean;
}

export interface LowerCmpSectionIngressRecordWithRulePackInput
  extends Omit<LowerCmpSectionsWithRulePackInput, "sections"> {
  record: CmpSectionIngressRecord;
}

export interface CmpSectionIngressLoweringResult {
  ingressRecord: CmpSectionIngressRecord;
  lowered: CmpSectionLoweringRecord[];
  storedSections: CmpStoredSection[];
  droppedSectionIds: string[];
}

function actionToStoredSectionState(action: CmpRuleAction): CmpStoredSectionState | undefined {
  switch (action) {
    case "store":
    case "accept":
      return "stored";
    case "promote":
      return "promoted";
    case "dispatch":
      return "dispatched";
    case "defer":
      return "checked";
    case "drop":
      return undefined;
  }
}

function defaultStorageRef(section: CmpSection, plane: CmpStoredSectionPlane): string {
  return `${plane}:section:${section.id}`;
}

function createLineagePath(lineage: AgentLineage): string[] {
  const ancestorAgentIds = Array.isArray(lineage.metadata?.ancestorAgentIds)
    ? lineage.metadata?.ancestorAgentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return [...ancestorAgentIds, lineage.agentId];
}

export function createCmpSectionsFromIngest(
  input: CreateCmpSectionsFromIngestInput,
): CmpSection[] {
  const extraTags = input.tags?.map((value) => value.trim()).filter(Boolean) ?? [];
  const baseSections = createCmpSectionIngressRecordFromIngress({
    ingest: {
      agentId: input.lineage.agentId,
      sessionId: `${input.lineage.agentId}:section-ingress`,
      runId: `${input.lineage.agentId}:section-ingress`,
      lineage: {
        ...input.lineage,
        metadata: {
          ancestorAgentIds: createLineagePath(input.lineage).slice(0, -1),
          ...(input.lineage.metadata ?? {}),
        },
      },
      taskSummary: extraTags.join("|") || "section-first-ingress",
      materials: input.materials,
      metadata: input.metadata,
    },
    ingressId: `${input.lineage.agentId}:section-ingress:${randomUUID()}`,
    createdAt: input.createdAt,
    source: input.source,
    sectionIdFactory: (_material, index) => `${input.lineage.agentId}:section:${index}:${randomUUID()}`,
  }).sections;

  if (extraTags.length === 0) {
    return baseSections;
  }

  return baseSections.map((section) => ({
    ...section,
    tags: [...new Set([...section.tags, ...extraTags])],
  }));
}

export function lowerCmpSectionsWithRulePack(
  input: LowerCmpSectionsWithRulePackInput,
): CmpSectionLoweringRecord[] {
  const pack = createCmpRulePack(input.pack);
  return input.sections.map((section) => {
    const evaluation = evaluateCmpRulePack({
      pack,
      section,
    });
    const state = actionToStoredSectionState(evaluation.recommendedAction);

    if (!state) {
      return {
        section,
        evaluation,
        dropped: true,
      };
    }

    return {
      section,
      evaluation,
      storedSection: createCmpStoredSectionFromSection({
        storedSectionId: `${section.id}:stored`,
        section,
        plane: input.plane,
        storageRef: input.storageRefFactory?.(section, evaluation) ?? defaultStorageRef(section, input.plane),
        state,
        persistedAt: input.persistedAt,
        metadata: {
          packId: pack.id,
          recommendedAction: evaluation.recommendedAction,
          ...(input.metadata ?? {}),
        },
      }),
      dropped: false,
    };
  });
}

export function lowerCmpSectionIngressRecordWithRulePack(
  input: LowerCmpSectionIngressRecordWithRulePackInput,
): CmpSectionIngressLoweringResult {
  const lowered = lowerCmpSectionsWithRulePack({
    sections: input.record.sections,
    pack: input.pack,
    plane: input.plane,
    persistedAt: input.persistedAt,
    storageRefFactory: input.storageRefFactory,
    metadata: input.metadata,
  });

  return {
    ingressRecord: input.record,
    lowered,
    storedSections: lowered
      .map((record) => record.storedSection)
      .filter((section): section is CmpStoredSection => Boolean(section)),
    droppedSectionIds: lowered
      .filter((record) => record.dropped)
      .map((record) => record.section.id),
  };
}
