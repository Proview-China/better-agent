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
  rollbackHandleId?: string;
  reportId: string;
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
    rollbackHandleId: input.rollbackHandle?.handleId,
    reportId: input.report.reportId,
  };
}
