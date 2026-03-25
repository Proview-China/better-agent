import { randomUUID } from "node:crypto";

import type { IngestRuntimeContextInput, CmpRuntimeContextMaterial } from "../cmp-types/cmp-interface.js";
import type { AgentLineage } from "../cmp-types/cmp-lineage.js";
import type { CmpSection, CmpSectionKind, CmpSectionSource } from "../cmp-types/cmp-section.js";
import { createCmpSection } from "../cmp-types/cmp-section.js";
import type { CmpSectionIngressRecord } from "./ingress-contract.js";
import { createCmpSectionIngressRecord } from "./ingress-contract.js";

export interface CreateCmpExactSectionFromMaterialInput {
  projectId: string;
  agentId: string;
  lineagePath: string[];
  source?: CmpSectionSource;
  material: CmpRuntimeContextMaterial;
  taskSummary: string;
  createdAt: string;
  sectionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpExactSectionsFromIngressInput {
  ingest: IngestRuntimeContextInput;
  createdAt?: string;
  source?: CmpSectionSource;
  sectionIdFactory?: (material: CmpRuntimeContextMaterial, index: number) => string;
}

export interface CreateCmpSectionIngressRecordFromIngressInput {
  ingest: IngestRuntimeContextInput;
  ingressId: string;
  createdAt?: string;
  source?: CmpSectionSource;
  sectionIdFactory?: (material: CmpRuntimeContextMaterial, index: number) => string;
  payloadRefIndex?: number;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function inferLineagePath(lineage: AgentLineage): string[] {
  const ancestorAgentIds = Array.isArray(lineage.metadata?.ancestorAgentIds)
    ? lineage.metadata.ancestorAgentIds.filter((value): value is string => typeof value === "string")
    : [];
  return uniqueStrings([...ancestorAgentIds, lineage.agentId]);
}

function inferSectionKind(material: CmpRuntimeContextMaterial): CmpSectionKind {
  if (material.kind !== "context_package") {
    return "runtime_context";
  }

  const packageKind = typeof material.metadata?.packageKind === "string"
    ? material.metadata.packageKind.trim()
    : undefined;

  switch (packageKind) {
    case "child_seed":
      return "task_seed";
    case "historical_reply":
      return "historical_context";
    case "peer_exchange":
      return "peer_signal";
    case "promotion_update":
      return "promotion_signal";
    default:
      return "task_seed";
  }
}

function inferSectionTags(input: {
  material: CmpRuntimeContextMaterial;
  taskSummary: string;
  kind: CmpSectionKind;
}): string[] {
  const packageKind = typeof input.material.metadata?.packageKind === "string"
    ? input.material.metadata.packageKind.trim()
    : undefined;
  return uniqueStrings([
    "fidelity:exact",
    `material:${input.material.kind}`,
    `section:${input.kind}`,
    packageKind ? `package:${packageKind}` : "",
    input.taskSummary ? `task:${input.taskSummary}` : "",
  ]);
}

export function createCmpExactSectionFromMaterial(
  input: CreateCmpExactSectionFromMaterialInput,
): CmpSection {
  const kind = inferSectionKind(input.material);
  return createCmpSection({
    id: input.sectionId ?? randomUUID(),
    projectId: assertNonEmpty(input.projectId, "CMP section ingress projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP section ingress agentId"),
    lineagePath: uniqueStrings(input.lineagePath),
    source: input.source ?? "core_agent",
    kind,
    fidelity: "exact",
    payloadRefs: [assertNonEmpty(input.material.ref, "CMP section ingress material.ref")],
    tags: inferSectionTags({
      material: input.material,
      taskSummary: input.taskSummary,
      kind,
    }),
    createdAt: assertNonEmpty(input.createdAt, "CMP section ingress createdAt"),
    metadata: {
      materialKind: input.material.kind,
      taskSummary: input.taskSummary,
      ...(input.material.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function createCmpExactSectionsFromIngress(
  input: CreateCmpExactSectionsFromIngressInput,
): CmpSection[] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const lineagePath = inferLineagePath(input.ingest.lineage);
  return input.ingest.materials.map((material, index) =>
    createCmpExactSectionFromMaterial({
      projectId: input.ingest.lineage.projectId,
      agentId: input.ingest.agentId,
      lineagePath,
      source: input.source ?? "core_agent",
      material,
      taskSummary: input.ingest.taskSummary,
      createdAt,
      sectionId: input.sectionIdFactory?.(material, index),
      metadata: input.ingest.metadata,
    }),
  );
}

export function createCmpSectionIngressRecordFromIngress(
  input: CreateCmpSectionIngressRecordFromIngressInput,
): CmpSectionIngressRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const material = input.ingest.materials[input.payloadRefIndex ?? 0] ?? input.ingest.materials[0];
  if (!material) {
    throw new Error("CMP section ingress requires at least one material.");
  }

  return createCmpSectionIngressRecord({
    ingress: {
      ingressId: assertNonEmpty(input.ingressId, "CMP section ingress ingressId"),
      lineage: {
        projectId: input.ingest.lineage.projectId,
        agentId: input.ingest.lineage.agentId,
        parentAgentId: input.ingest.lineage.parentAgentId,
        depth: input.ingest.lineage.depth,
        childAgentIds: input.ingest.lineage.childAgentIds,
        metadata: input.ingest.lineage.metadata,
      },
      sessionId: input.ingest.sessionId,
      runId: input.ingest.runId ?? `${input.ingest.sessionId}:cmp`,
      payloadRef: {
        ref: material.ref,
        kind: material.kind,
        metadata: material.metadata,
      },
      granularityLabel: input.ingest.taskSummary,
      createdAt,
      source: "core_agent",
      metadata: {
        ...(input.ingest.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    },
    sections: createCmpExactSectionsFromIngress({
      ingest: input.ingest,
      createdAt,
      source: input.source,
      sectionIdFactory: input.sectionIdFactory,
    }),
  });
}
