import path from "node:path";

import {
  createMpLineageNode,
} from "../index.js";
import { rax } from "../../rax/runtime.js";
import type {
  CoreCmpWorksitePackageV1,
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

function cloneFallbackEntry(entry: CoreOverlayIndexEntryV1): CoreOverlayIndexEntryV1 {
  return {
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    bodyRef: entry.bodyRef,
  };
}

function createMpRoutingQueryText(input: {
  userMessage: string;
  currentObjective?: string;
  cmpWorksitePackage?: CoreCmpWorksitePackageV1;
}): string {
  const worksite = input.cmpWorksitePackage;
  const parts = [
    input.currentObjective,
    input.userMessage,
    worksite?.objective?.taskSummary,
    worksite?.objective?.requestedAction,
    worksite?.payload?.routeStateSummary,
    ...(worksite?.payload?.sourceAnchorRefs ?? []),
  ];
  return [...new Set(parts.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join(" ");
}

function createMpRoutingGovernanceSignals(input: {
  cmpWorksitePackage?: CoreCmpWorksitePackageV1;
  fallbackPackage: CoreMpRoutedPackageV1;
}) {
  const worksite = input.cmpWorksitePackage;
  return {
    cmpPackageId: worksite?.identity?.packageId,
    cmpRouteRationale: worksite?.governance?.routeRationale,
    cmpScopePolicy: worksite?.governance?.scopePolicy,
    freshnessHint: worksite?.governance?.freshness ?? input.fallbackPackage.freshnessLabel,
    confidenceHint: worksite?.governance?.confidenceLabel ?? input.fallbackPackage.confidenceLabel,
  };
}

export async function discoverMpOverlayEntries(input: {
  cwd: string;
  userMessage: string;
  currentObjective?: string;
  limit?: number;
  projectId?: string;
  rootPath?: string;
  agentId?: string;
  cmpWorksitePackage?: CoreCmpWorksitePackageV1;
  cmpCandidatePayloads?: Parameters<typeof rax.mp.materializeFromCmpCandidates>[0]["payload"]["candidates"];
  facade?: typeof rax;
}): Promise<CoreOverlayIndexEntryV1[]> {
  const artifacts = await discoverMpOverlayArtifacts(input);
  return artifacts.entries;
}

export async function discoverMpOverlayArtifacts(input: {
  cwd: string;
  userMessage: string;
  currentObjective?: string;
  limit?: number;
  projectId?: string;
  rootPath?: string;
  agentId?: string;
  cmpWorksitePackage?: CoreCmpWorksitePackageV1;
  cmpCandidatePayloads?: Parameters<typeof rax.mp.materializeFromCmpCandidates>[0]["payload"]["candidates"];
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

    const cmpCandidatePayloads = input.cmpCandidatePayloads ?? [];
    if (cmpCandidatePayloads.length > 0) {
      await facade.mp.materializeFromCmpCandidates({
        session,
        payload: {
          candidates: cmpCandidatePayloads,
        },
      });
    }

    const requesterLineage = createMpLineageNode({
      projectId,
      agentId,
      depth: 0,
    });
    const routed = await facade.mp.routeForCore({
      session,
      payload: {
        queryText: createMpRoutingQueryText({
          userMessage: input.userMessage,
          currentObjective: input.currentObjective,
          cmpWorksitePackage: input.cmpWorksitePackage,
        }),
        currentObjective: input.currentObjective ?? input.userMessage,
        requesterLineage,
        sourceLineages: [requesterLineage],
        limit: input.limit ?? 6,
        routeHint: "resolve",
        fallbackEntries: repoFallback.entries.map((entry) => cloneFallbackEntry(entry)),
        governanceSignals: createMpRoutingGovernanceSignals({
          cmpWorksitePackage: input.cmpWorksitePackage,
          fallbackPackage: repoFallback.routedPackage,
        }),
        metadata: {
          currentObjective: input.currentObjective ?? input.userMessage,
          cmpWorksitePackageRef: input.cmpWorksitePackage?.identity?.packageRef,
          cmpCandidateCount: cmpCandidatePayloads.length,
        },
      },
    });

    const fromResolve = [...routed.primaryRecords, ...routed.supportingRecords]
      .map((record) => toOverlayEntry(record))
      .slice(0, input.limit ?? 6);
    if (fromResolve.length > 0 || routed.fallbackEntries.length > 0) {
      return {
        entries: fromResolve.length > 0 ? fromResolve : routed.fallbackEntries.map((entry) => cloneFallbackEntry(entry)),
        routedPackage: toRoutedPackage({
          packageId: routed.readback.routeKind === "fallback" ? `mp-fallback:${projectId}` : `mp-route:${projectId}`,
          packageRef: routed.readback.receiptId,
          sourceClass: routed.readback.routeKind === "history"
            ? "mp_native_history"
            : routed.readback.routeKind === "fallback"
              ? "repo_memory_fallback"
              : cmpCandidatePayloads.length > 0
                ? "cmp_seeded_memory"
                : "mp_native_resolve",
          records: [...routed.primaryRecords, ...routed.supportingRecords],
          primaryRecords: routed.primaryRecords,
          supportingRecords: routed.supportingRecords,
          deliveryStatus: routed.readback.deliveryStatus,
          objectiveSummary: routed.readback.objectiveSummary,
          objectiveMatchSummary: routed.readback.objectiveMatchSummary,
          governanceReason: routed.readback.governanceReason,
          fallbackReason: routed.readback.fallbackReason,
          receiptId: routed.readback.receiptId,
          omittedCount: routed.readback.omittedMemoryRefs.length,
        }),
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
          packageRef: `mp-fallback:${projectId}:managed`,
          sourceClass: "repo_memory_fallback",
          records: fallbackRecords,
          primaryRecords: fallbackRecords.slice(0, input.limit ?? 3),
          supportingRecords: fallbackRecords.slice(input.limit ?? 3, input.limit ?? 6),
          deliveryStatus: "partial",
          objectiveSummary: input.userMessage,
          objectiveMatchSummary: `fallback to managed MP records for "${input.userMessage}"`,
          governanceReason: "native route returned no bundle, so managed MP records were used",
          fallbackReason: "managed_records_fallback",
          receiptId: `mp-fallback:${projectId}:managed`,
          omittedCount: 0,
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
  packageRef?: string;
  sourceClass: CoreMpRoutedPackageV1["sourceClass"];
  records: Array<{
    memoryId: string;
    freshness: { status: string };
    confidence: string;
  }>;
  primaryRecords: Array<{ memoryId: string }>;
  supportingRecords: Array<{ memoryId: string }>;
  deliveryStatus?: CoreMpRoutedPackageV1["deliveryStatus"];
  objectiveSummary?: string;
  objectiveMatchSummary?: string;
  governanceReason?: string;
  fallbackReason?: string;
  receiptId?: string;
  omittedCount?: number;
}): CoreMpRoutedPackageV1 {
  const freshest = input.records[0];
  const deliveryStatus = input.deliveryStatus ?? (input.records.length > 0 ? "available" : "absent");
  return {
    schemaVersion: "core-mp-routed-package/v2",
    deliveryStatus,
    packageId: input.packageId,
    packageRef: input.packageRef,
    sourceClass: input.sourceClass,
    summary: input.records.length > 0
      ? `MP routed ${input.primaryRecords.length} primary and ${input.supportingRecords.length} supporting memories for "${input.objectiveSummary ?? "the current objective"}".`
      : input.fallbackReason
        ? `MP routed package fell back because ${input.fallbackReason}.`
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
    objective: {
      currentObjective: input.objectiveSummary,
      retrievalMode: input.sourceClass === "mp_native_history" ? "history" : input.sourceClass === "repo_memory_fallback" ? "fallback" : "resolve",
      objectiveMatchSummary: input.objectiveMatchSummary,
    },
    governance: {
      routeLabel: input.sourceClass,
      governanceReason: input.governanceReason,
      fallbackReason: input.fallbackReason,
    },
    retrieval: {
      receiptId: input.receiptId,
      primaryCount: input.primaryRecords.length,
      supportingCount: input.supportingRecords.length,
      omittedCount: input.omittedCount,
    },
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
      schemaVersion: "core-mp-routed-package/v2",
      deliveryStatus: entries.length > 0 ? "partial" : "absent",
      packageId: `mp-fallback:${input.projectId}`,
      packageRef: `mp-fallback:${input.projectId}:repo`,
      sourceClass: "repo_memory_fallback",
      summary: entries.length > 0
        ? "MP-native routing is unavailable, so core is using repo-memory fallback entries for this turn."
        : "MP routed package is currently unavailable and repo-memory fallback produced no entries.",
      relevanceLabel: entries.length > 0 ? "medium" : "low",
      freshnessLabel: entries.length > 0 ? "aging" : "stale",
      confidenceLabel: entries.length > 0 ? "medium" : "low",
      primaryMemoryRefs: entries.slice(0, 3).map((entry) => entry.id),
      supportingMemoryRefs: entries.slice(3).map((entry) => entry.id),
      objective: {
        currentObjective: input.userMessage,
        retrievalMode: "fallback",
        objectiveMatchSummary: entries.length > 0
          ? `repo-memory fallback selected ${entries.length} entries for "${input.userMessage}"`
          : `no repo-memory fallback entries were available for "${input.userMessage}"`,
      },
      governance: {
        routeLabel: "repo_memory_fallback",
        governanceReason: "repo-memory bootstrap fallback remains enabled while MP-native routing is being strengthened",
        fallbackReason: entries.length > 0 ? "repo_memory_bootstrap_fallback" : "repo_memory_snapshot_empty",
      },
      retrieval: {
        receiptId: `mp-fallback:${input.projectId}:repo`,
        primaryCount: Math.min(entries.length, 3),
        supportingCount: Math.max(entries.length - 3, 0),
        omittedCount: 0,
      },
    },
  };
}
