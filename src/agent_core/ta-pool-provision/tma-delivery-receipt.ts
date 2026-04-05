import type {
  ProvisionArtifactRef,
  TmaExecutionReport,
  TmaRollbackHandle,
  TmaVerificationEvidence,
} from "../ta-pool-types/index.js";

export interface TmaReadyBundleArtifactRefs {
  tool: string;
  binding: string;
  verification: string;
  usage: string;
}

export interface TmaReadyBundleVerificationItem {
  evidenceId: string;
  kind: string;
  status: string;
  summary: string;
  ref?: string;
}

export interface TmaReadyBundleVerificationSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TmaReadyBundleExecutionSummary {
  reportId: string;
  status: string;
  summary: string;
}

export interface TmaReadyBundleReceipt {
  provisionId: string;
  requestedCapabilityKey: string;
  lane: string;
  readyAt: string;
  completionTarget: "ready_bundle";
  originalTaskDisposition: "left_for_main_agent";
  plannerSessionId: string;
  executorSessionId: string;
  resumedFromSessionId?: string;
  artifactRefs: TmaReadyBundleArtifactRefs;
  verificationEvidenceIds: string[];
  verificationStatuses: string[];
  verificationSummary: TmaReadyBundleVerificationSummary;
  verificationItems: TmaReadyBundleVerificationItem[];
  rollbackHandleId?: string;
  reportId: string;
  executionSummary: TmaReadyBundleExecutionSummary;
}

function toArtifactRef(artifact: ProvisionArtifactRef): string {
  return artifact.ref?.trim() || artifact.artifactId;
}

export function createTmaReadyBundleReceipt(input: {
  provisionId: string;
  requestedCapabilityKey: string;
  lane: string;
  readyAt: string;
  plannerSessionId: string;
  executorSessionId: string;
  resumedFromSessionId?: string;
  toolArtifact: ProvisionArtifactRef;
  bindingArtifact: ProvisionArtifactRef;
  verificationArtifact: ProvisionArtifactRef;
  usageArtifact: ProvisionArtifactRef;
  verificationEvidence: readonly TmaVerificationEvidence[];
  rollbackHandle?: TmaRollbackHandle;
  report: TmaExecutionReport;
}): TmaReadyBundleReceipt {
  const verificationItems = input.verificationEvidence.map((item) => ({
    evidenceId: item.evidenceId,
    kind: item.kind,
    status: item.status,
    summary: item.summary,
    ref: item.ref?.trim() || undefined,
  }));
  const verificationSummary: TmaReadyBundleVerificationSummary = {
    total: verificationItems.length,
    passed: verificationItems.filter((item) => item.status === "passed").length,
    failed: verificationItems.filter((item) => item.status === "failed").length,
    skipped: verificationItems.filter((item) => item.status === "skipped").length,
  };

  return {
    provisionId: input.provisionId,
    requestedCapabilityKey: input.requestedCapabilityKey,
    lane: input.lane,
    readyAt: input.readyAt,
    completionTarget: "ready_bundle",
    originalTaskDisposition: "left_for_main_agent",
    plannerSessionId: input.plannerSessionId,
    executorSessionId: input.executorSessionId,
    resumedFromSessionId: input.resumedFromSessionId?.trim() || undefined,
    artifactRefs: {
      tool: toArtifactRef(input.toolArtifact),
      binding: toArtifactRef(input.bindingArtifact),
      verification: toArtifactRef(input.verificationArtifact),
      usage: toArtifactRef(input.usageArtifact),
    },
    verificationEvidenceIds: input.verificationEvidence.map((item) => item.evidenceId),
    verificationStatuses: input.verificationEvidence.map((item) => item.status),
    verificationSummary,
    verificationItems,
    rollbackHandleId: input.rollbackHandle?.handleId,
    reportId: input.report.reportId,
    executionSummary: {
      reportId: input.report.reportId,
      status: input.report.status,
      summary: input.report.summary,
    },
  };
}
