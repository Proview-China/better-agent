import path from "node:path";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createMpLineageNode,
  createMpScopeDescriptor,
} from "../index.js";
import { rax } from "../../rax/runtime.js";
import type {
  CoreMpRoutedPackageV1,
  CoreOverlayIndexEntryV1,
} from "../core-prompt/types.js";
import { createMemoryOverlayIndexEntries } from "../core-prompt/memory-overlay-index-producer.js";
import { loadRepoMemoryOverlaySnapshot } from "./repo-memory-overlay-source.js";

function createProjectId(cwd: string): string {
  const slug = cwd
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(-48);
  return `project.mp-overlay.${slug || "default"}`;
}

function toStoredSection(input: {
  projectId: string;
  agentId: string;
  entry: ReturnType<typeof loadRepoMemoryOverlaySnapshot>["entries"][number];
}) {
  const createdAt = new Date(input.entry.effectiveDateMs).toISOString();
  const section = createCmpSection({
    id: `section:${input.entry.id}`,
    projectId: input.projectId,
    agentId: input.agentId,
    lineagePath: [input.agentId],
    source: "system",
    kind: "historical_context",
    fidelity: "checked",
    payloadRefs: [input.entry.bodyRef],
    tags: [
      input.entry.category,
      input.entry.stabilityKind,
      ...(input.entry.docStatus ? [input.entry.docStatus] : []),
    ],
    createdAt,
    bodyRef: input.entry.bodyRef,
    metadata: {
      overlaySourcePath: input.entry.sourcePath,
      overlaySummary: input.entry.summary,
      bodyRef: input.entry.bodyRef,
      semanticGroupId: `overlay:${input.entry.category}`,
    },
  });

  return createCmpStoredSectionFromSection({
    storedSectionId: `stored:${input.entry.id}`,
    section,
    plane: "postgresql",
    storageRef: `postgresql:${input.entry.id}`,
    state: "promoted",
    visibility: "parent",
    persistedAt: createdAt,
    metadata: {
      semanticGroupId: `overlay:${input.entry.category}`,
      tags: [
        input.entry.category,
        input.entry.stabilityKind,
        ...(input.entry.docStatus ? [input.entry.docStatus] : []),
      ],
    },
  });
}

function toOverlayEntry(record: {
  memoryId: string;
  semanticGroupId?: string;
  sourceStoredSectionId?: string;
  bodyRef?: string;
  memoryKind: string;
  freshness: { status: string };
  confidence: string;
  alignment: { alignmentStatus: string };
  tags: string[];
}): CoreOverlayIndexEntryV1 {
  const bodyRef = record.bodyRef
    ? (record.bodyRef.startsWith("memory-body:")
      ? record.bodyRef
      : `memory-body:${record.bodyRef}`)
    : undefined;
  return {
    id: `memory:${record.memoryId}`,
    label: record.semanticGroupId ?? record.sourceStoredSectionId ?? record.bodyRef ?? record.memoryId,
    summary: [
      record.memoryKind,
      record.freshness.status,
      record.alignment.alignmentStatus,
      record.confidence,
      record.tags.length > 0 ? `tags:${record.tags.slice(0, 3).join("|")}` : undefined,
    ].filter((part): part is string => Boolean(part)).join(" / "),
    bodyRef,
  };
}

export async function discoverMpOverlayEntries(input: {
  cwd: string;
  userMessage: string;
  limit?: number;
  projectId?: string;
  rootPath?: string;
  agentId?: string;
  facade?: typeof rax;
}): Promise<CoreOverlayIndexEntryV1[]> {
  const artifacts = await discoverMpOverlayArtifacts(input);
  return artifacts.entries;
}

export async function discoverMpOverlayArtifacts(input: {
  cwd: string;
  userMessage: string;
  limit?: number;
  projectId?: string;
  rootPath?: string;
  agentId?: string;
  facade?: typeof rax;
}): Promise<{
  entries: CoreOverlayIndexEntryV1[];
  routedPackage: CoreMpRoutedPackageV1;
}> {
  const facade = input.facade ?? rax;
  const projectId = input.projectId ?? createProjectId(input.cwd);
  const rootPath = input.rootPath ?? path.join(input.cwd, "memory", "generated", "mp-overlay-cache");
  const agentId = input.agentId ?? "main";
  const snapshot = loadRepoMemoryOverlaySnapshot({
    rootDir: path.join(input.cwd, "memory"),
  });
  if (snapshot.entries.length === 0) {
    return {
      entries: [],
      routedPackage: {
        schemaVersion: "core-mp-routed-package/v1",
        deliveryStatus: "absent",
        packageId: `mp-empty:${projectId}`,
        sourceClass: "repo_memory_fallback",
        summary: "MP routed package is currently unavailable because no repo memory snapshot was found.",
        relevanceLabel: "low",
        freshnessLabel: "stale",
        confidenceLabel: "low",
      },
    };
  }

  const repoFallback = createRepoFallbackArtifacts({
    projectId,
    userMessage: input.userMessage,
    snapshot,
    limit: input.limit,
  });

  try {
    const session = facade.mp.create({
      config: {
        projectId,
        defaultAgentId: agentId,
        lance: {
          rootPath,
        },
      },
    });

    await facade.mp.bootstrap({
      session,
      payload: {
        projectId,
        rootPath,
        agentIds: [agentId],
      },
    });

    await facade.mp.materializeBatch({
      session,
      payload: snapshot.entries.map((entry) => ({
        projectId,
        rootPath,
        agentIds: [agentId],
        storedSection: toStoredSection({
          projectId,
          agentId,
          entry,
        }),
        checkedSnapshotRef: `snapshot:${entry.id}`,
        branchRef: `mp/${agentId}`,
        scope: createMpScopeDescriptor({
          projectId,
          agentId,
          scopeLevel: "project",
          sessionMode: "shared",
        }),
      })),
    });

    const requesterLineage = createMpLineageNode({
      projectId,
      agentId,
      depth: 0,
    });
    const resolved = await facade.mp.resolve({
      session,
      payload: {
        queryText: input.userMessage,
        requesterLineage,
        sourceLineages: [requesterLineage],
        limit: input.limit ?? 6,
      },
    });

    const fromResolve = [...resolved.bundle.primary, ...resolved.bundle.supporting]
      .map((record) => toOverlayEntry(record))
      .slice(0, input.limit ?? 6);
    const routedPackageFromResolve = toRoutedPackage({
      packageId: `mp-resolve:${projectId}`,
      sourceClass: "mp_resolve_bundle",
      records: [...resolved.bundle.primary, ...resolved.bundle.supporting],
      primaryRecords: resolved.bundle.primary,
      supportingRecords: resolved.bundle.supporting,
    });
    if (fromResolve.length > 0) {
      return {
        entries: fromResolve,
        routedPackage: routedPackageFromResolve,
      };
    }

    const fallbackRecords = session.runtime.getMpManagedRecords?.() ?? [];
    if (fallbackRecords.length > 0) {
      const fallbackEntries = fallbackRecords
        .slice(0, input.limit ?? 6)
        .map((record) => toOverlayEntry(record));
      return {
        entries: fallbackEntries,
        routedPackage: toRoutedPackage({
          packageId: `mp-fallback:${projectId}`,
          sourceClass: "repo_memory_fallback",
          records: fallbackRecords,
          primaryRecords: fallbackRecords.slice(0, input.limit ?? 3),
          supportingRecords: fallbackRecords.slice(input.limit ?? 3, input.limit ?? 6),
        }),
      };
    }
  } catch {
    return repoFallback;
  }

  return repoFallback;
}

function toRoutedPackage(input: {
  packageId: string;
  sourceClass: CoreMpRoutedPackageV1["sourceClass"];
  records: Array<{
    memoryId: string;
    freshness: { status: string };
    confidence: string;
  }>;
  primaryRecords: Array<{ memoryId: string }>;
  supportingRecords: Array<{ memoryId: string }>;
}): CoreMpRoutedPackageV1 {
  const freshest = input.records[0];
  const deliveryStatus = input.records.length > 0 ? "available" : "absent";
  return {
    schemaVersion: "core-mp-routed-package/v1",
    deliveryStatus,
    packageId: input.packageId,
    sourceClass: input.sourceClass,
    summary: input.records.length > 0
      ? `MP routed ${input.primaryRecords.length} primary and ${input.supportingRecords.length} supporting memories for the current objective.`
      : "MP routed package is currently unavailable.",
    relevanceLabel: input.records.length > 0 ? "high" : "low",
    freshnessLabel: freshest
      ? (freshest.freshness.status === "fresh" || freshest.freshness.status === "aging" || freshest.freshness.status === "stale"
        ? freshest.freshness.status
        : "stale")
      : "stale",
    confidenceLabel: freshest && (freshest.confidence === "high" || freshest.confidence === "medium" || freshest.confidence === "low")
      ? freshest.confidence
      : "low",
    primaryMemoryRefs: input.primaryRecords.map((record) => record.memoryId),
    supportingMemoryRefs: input.supportingRecords.map((record) => record.memoryId),
  };
}

function createRepoFallbackArtifacts(input: {
  projectId: string;
  userMessage: string;
  snapshot: ReturnType<typeof loadRepoMemoryOverlaySnapshot>;
  limit?: number;
}): {
  entries: CoreOverlayIndexEntryV1[];
  routedPackage: CoreMpRoutedPackageV1;
} {
  const entries = createMemoryOverlayIndexEntries({
    userMessage: input.userMessage,
    snapshot: input.snapshot,
    limit: input.limit,
  });
  return {
    entries,
    routedPackage: {
      schemaVersion: "core-mp-routed-package/v1",
      deliveryStatus: entries.length > 0 ? "partial" : "absent",
      packageId: `mp-fallback:${input.projectId}`,
      sourceClass: "repo_memory_fallback",
      summary: entries.length > 0
        ? "MP-native routing is unavailable, so core is using repo-memory fallback entries for this turn."
        : "MP routed package is currently unavailable and repo-memory fallback produced no entries.",
      relevanceLabel: entries.length > 0 ? "medium" : "low",
      freshnessLabel: entries.length > 0 ? "aging" : "stale",
      confidenceLabel: entries.length > 0 ? "medium" : "low",
      primaryMemoryRefs: entries.slice(0, 3).map((entry) => entry.id),
      supportingMemoryRefs: entries.slice(3).map((entry) => entry.id),
    },
  };
}
