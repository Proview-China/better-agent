import type { DialogueTurn, CmpTurnArtifacts } from "../live-agent-chat/shared.js";
import { formatTranscript } from "../live-agent-chat/shared.js";
import { renderCoreContextualUserV1 } from "./contextual.js";
import { createLiveChatOverlayIndex } from "./live-chat-overlays.js";
import type {
  CoreCmpContextPackageV1,
  CoreContextualUserV1,
  CoreMpRoutedPackageV1,
  CoreOverlayIndexEntryV1,
  CoreWorkspaceInitContextV1,
} from "./types.js";

function inferCmpDeliveryStatus(input: CmpTurnArtifacts): CoreCmpContextPackageV1["deliveryStatus"] {
  const values = [
    input.packageId,
    input.packageRef,
    input.projectionId,
    input.snapshotId,
    input.intent,
    input.operatorGuide,
    input.childGuide,
    input.checkerReason,
    input.routeRationale,
    input.scopePolicy,
    input.packageStrategy,
    input.timelineStrategy,
  ].map((value) => value.trim().toLowerCase());

  if (values.some((value) => value === "skipped" || value.includes("skipped in once mode"))) {
    return "skipped";
  }
  if (values.some((value) => value === "pending")) {
    return "pending";
  }
  if (values.some((value) => value === "missing")) {
    return "partial";
  }
  return "available";
}

function inferCmpConfidenceLabel(
  deliveryStatus: CoreCmpContextPackageV1["deliveryStatus"],
): NonNullable<CoreCmpContextPackageV1["governance"]>["confidenceLabel"] {
  if (deliveryStatus === "available") {
    return "high";
  }
  if (deliveryStatus === "partial") {
    return "medium";
  }
  return "low";
}

function inferCmpFreshness(
  deliveryStatus: CoreCmpContextPackageV1["deliveryStatus"],
): NonNullable<CoreCmpContextPackageV1["governance"]>["freshness"] {
  if (deliveryStatus === "available") {
    return "fresh";
  }
  if (deliveryStatus === "partial") {
    return "aging";
  }
  return "stale";
}

function createCmpContextPackage(input: CmpTurnArtifacts | undefined): CoreCmpContextPackageV1 | undefined {
  if (!input) {
    return {
      schemaVersion: "core-cmp-context-package/v1",
      deliveryStatus: "absent",
      objective: {
        taskSummary: "no fresh CMP package is available yet for this turn",
      },
      governance: {
        operatorGuide: "proceed with the direct user request and any already available capability window",
      },
    };
  }

  const deliveryStatus = inferCmpDeliveryStatus(input);

  return {
    schemaVersion: "core-cmp-context-package/v1",
    deliveryStatus,
    identity: {
      packageId: input.packageId,
      packageRef: input.packageRef,
      packageKind: input.packageKind,
      packageMode: input.packageMode,
      projectionId: input.projectionId,
      snapshotId: input.snapshotId,
    },
    objective: {
      taskSummary: input.intent,
      requestedAction: input.operatorGuide,
    },
    payload: {
      backgroundContext: input.childGuide,
      timelineSummary: input.timelineStrategy,
    },
    governance: {
      operatorGuide: input.operatorGuide,
      childGuide: input.childGuide,
      checkerReason: input.checkerReason,
      routeRationale: input.routeRationale,
      scopePolicy: input.scopePolicy,
      fidelityLabel: input.fidelityLabel,
      confidenceLabel: inferCmpConfidenceLabel(deliveryStatus),
      freshness: inferCmpFreshness(deliveryStatus),
    },
  };
}

export function createLiveChatCoreContextualInput(input: {
  userMessage: string;
  transcript: DialogueTurn[];
  cmp?: CmpTurnArtifacts;
  mpRoutedPackage?: CoreMpRoutedPackageV1;
  workspaceInitContext?: CoreWorkspaceInitContextV1;
  availableCapabilitiesText: string;
  capabilityUsageIndexText?: string;
  skillEntries?: CoreOverlayIndexEntryV1[];
  memoryEntries?: CoreOverlayIndexEntryV1[];
  capabilityHistoryText?: string;
  toolResultText?: string;
  groundingEvidenceText?: string;
}): CoreContextualUserV1 {
  const recentTurns = input.transcript.slice(-6);

  return {
    currentObjective: input.userMessage,
    recentTranscript: formatTranscript(recentTurns),
    workspaceInitContext: input.workspaceInitContext,
    cmpContextPackage: createCmpContextPackage(input.cmp),
    mpRoutedPackage: input.mpRoutedPackage,
    overlayIndex: createLiveChatOverlayIndex({
      userMessage: input.userMessage,
      capabilityUsageIndexText: input.capabilityUsageIndexText,
      skillEntries: input.skillEntries,
      memoryEntries: input.memoryEntries,
    }),
    tapCapabilityWindow: input.availableCapabilitiesText,
    capabilityHistory: input.capabilityHistoryText,
    latestToolResult: input.toolResultText,
    groundingEvidence: input.groundingEvidenceText,
  };
}

export function buildLiveChatCoreContextualPrompt(input: {
  userMessage: string;
  transcript: DialogueTurn[];
  cmp?: CmpTurnArtifacts;
  mpRoutedPackage?: CoreMpRoutedPackageV1;
  workspaceInitContext?: CoreWorkspaceInitContextV1;
  availableCapabilitiesText: string;
  capabilityUsageIndexText?: string;
  skillEntries?: CoreOverlayIndexEntryV1[];
  memoryEntries?: CoreOverlayIndexEntryV1[];
  capabilityHistoryText?: string;
  toolResultText?: string;
  groundingEvidenceText?: string;
}): string {
  return renderCoreContextualUserV1(createLiveChatCoreContextualInput(input));
}
