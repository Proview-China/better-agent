import {
  CMP_NEIGHBOR_RELATIONS,
  type CmpLineageNode,
  type CmpNeighborRelation,
  type CmpPayloadRef,
  assertNonEmpty,
  createCmpLineageNode,
  createCmpPayloadRef,
  isCmpNeighborRelation,
} from "./runtime-types.js";
import type { CmpSection } from "../cmp-types/cmp-section.js";

export interface CmpIngressRecord {
  ingressId: string;
  lineage: CmpLineageNode;
  sessionId: string;
  runId: string;
  payloadRef: CmpPayloadRef;
  granularityLabel: string;
  createdAt: string;
  source: "core_agent";
  metadata?: Record<string, unknown>;
}

export interface CmpNeighborhoodBroadcastEnvelope {
  envelopeId: string;
  ingressId: string;
  sourceAgentId: string;
  relation: CmpNeighborRelation;
  targetAgentId: string;
  payloadRef: CmpPayloadRef;
  granularityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PlanCmpNeighborhoodBroadcastInput {
  ingress: CmpIngressRecord;
  parentAgentId?: string;
  peerAgentIds?: string[];
  childAgentIds?: string[];
}

export interface CmpSectionIngressRecord {
  ingress: CmpIngressRecord;
  sections: CmpSection[];
}

function normalizeTargetIds(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createCmpIngressRecord(input: CmpIngressRecord): CmpIngressRecord {
  return {
    ingressId: assertNonEmpty(input.ingressId, "CMP ingress ingressId"),
    lineage: createCmpLineageNode(input.lineage),
    sessionId: assertNonEmpty(input.sessionId, "CMP ingress sessionId"),
    runId: assertNonEmpty(input.runId, "CMP ingress runId"),
    payloadRef: createCmpPayloadRef(input.payloadRef),
    granularityLabel: assertNonEmpty(input.granularityLabel, "CMP ingress granularityLabel"),
    createdAt: input.createdAt,
    source: "core_agent",
    metadata: input.metadata,
  };
}

export function createCmpNeighborhoodBroadcastEnvelope(
  input: CmpNeighborhoodBroadcastEnvelope,
): CmpNeighborhoodBroadcastEnvelope {
  if (!isCmpNeighborRelation(input.relation)) {
    throw new Error(`Unsupported CMP neighborhood relation: ${input.relation}.`);
  }

  if (input.sourceAgentId === input.targetAgentId) {
    throw new Error("CMP neighborhood broadcasts cannot target the source agent.");
  }

  return {
    envelopeId: assertNonEmpty(input.envelopeId, "CMP broadcast envelopeId"),
    ingressId: assertNonEmpty(input.ingressId, "CMP broadcast ingressId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP broadcast sourceAgentId"),
    relation: input.relation,
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP broadcast targetAgentId"),
    payloadRef: createCmpPayloadRef(input.payloadRef),
    granularityLabel: assertNonEmpty(input.granularityLabel, "CMP broadcast granularityLabel"),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };
}

export function planCmpNeighborhoodBroadcast(
  input: PlanCmpNeighborhoodBroadcastInput,
): readonly CmpNeighborhoodBroadcastEnvelope[] {
  const ingress = createCmpIngressRecord(input.ingress);
  const parentAgentId = input.parentAgentId?.trim();
  const peerAgentIds = normalizeTargetIds(input.peerAgentIds);
  const childAgentIds = normalizeTargetIds(input.childAgentIds);

  const envelopes: CmpNeighborhoodBroadcastEnvelope[] = [];
  if (parentAgentId) {
    envelopes.push(createCmpNeighborhoodBroadcastEnvelope({
      envelopeId: `${ingress.ingressId}:parent:${parentAgentId}`,
      ingressId: ingress.ingressId,
      sourceAgentId: ingress.lineage.agentId,
      relation: "parent",
      targetAgentId: parentAgentId,
      payloadRef: ingress.payloadRef,
      granularityLabel: ingress.granularityLabel,
      createdAt: ingress.createdAt,
    }));
  }
  for (const peerAgentId of peerAgentIds) {
    envelopes.push(createCmpNeighborhoodBroadcastEnvelope({
      envelopeId: `${ingress.ingressId}:peer:${peerAgentId}`,
      ingressId: ingress.ingressId,
      sourceAgentId: ingress.lineage.agentId,
      relation: "peer",
      targetAgentId: peerAgentId,
      payloadRef: ingress.payloadRef,
      granularityLabel: ingress.granularityLabel,
      createdAt: ingress.createdAt,
    }));
  }
  for (const childAgentId of childAgentIds) {
    envelopes.push(createCmpNeighborhoodBroadcastEnvelope({
      envelopeId: `${ingress.ingressId}:child:${childAgentId}`,
      ingressId: ingress.ingressId,
      sourceAgentId: ingress.lineage.agentId,
      relation: "child",
      targetAgentId: childAgentId,
      payloadRef: ingress.payloadRef,
      granularityLabel: ingress.granularityLabel,
      createdAt: ingress.createdAt,
    }));
  }

  return envelopes;
}

export function isAllowedCmpNeighborhoodRelation(relation: string): relation is CmpNeighborRelation {
  return CMP_NEIGHBOR_RELATIONS.includes(relation as CmpNeighborRelation);
}

export function createCmpSectionIngressRecord(
  input: CmpSectionIngressRecord,
): CmpSectionIngressRecord {
  return {
    ingress: createCmpIngressRecord(input.ingress),
    sections: input.sections.map((section) => ({
      ...section,
      payloadRefs: [...section.payloadRefs],
      lineagePath: [...section.lineagePath],
      tags: [...section.tags],
      metadata: section.metadata ? structuredClone(section.metadata) : undefined,
    })),
  };
}
