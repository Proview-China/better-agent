import { randomUUID } from "node:crypto";

import type {
  CapabilityResultArtifact,
  CapabilityResultEnvelope,
  CapabilityResultError,
  CapabilityResultStatus,
} from "../capability-types/index.js";
import type { CapabilityPortResponse, KernelResult, KernelResultStatus } from "../types/index.js";

export function createCapabilityResultEnvelope(input: {
  executionId: string;
  status: CapabilityResultStatus;
  output?: unknown;
  artifacts?: CapabilityResultArtifact[];
  evidence?: unknown[];
  error?: CapabilityResultError;
  usage?: Record<string, unknown>;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}): CapabilityResultEnvelope {
  return {
    executionId: input.executionId,
    resultId: randomUUID(),
    status: input.status,
    output: input.output,
    artifacts: input.artifacts,
    evidence: input.evidence,
    error: input.error,
    usage: input.usage,
    completedAt: input.completedAt ?? new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function mapEnvelopeStatusToKernelStatus(
  status: CapabilityResultStatus,
): KernelResultStatus {
  return status;
}

export function mapEnvelopeStatusToPortResponseStatus(
  status: CapabilityResultStatus,
): CapabilityPortResponse["status"] {
  switch (status) {
    case "success":
    case "partial":
      return "completed";
    case "failed":
    case "blocked":
      return "failed";
    case "timeout":
      return "timed_out";
    case "cancelled":
      return "cancelled";
  }
}

export function envelopeToKernelResult(params: {
  result: CapabilityResultEnvelope;
  sessionId: string;
  runId: string;
  source?: KernelResult["source"];
  correlationId?: string;
}): KernelResult {
  return {
    resultId: params.result.resultId,
    sessionId: params.sessionId,
    runId: params.runId,
    source: params.source ?? "capability",
    status: mapEnvelopeStatusToKernelStatus(params.result.status),
    output: params.result.output,
    artifacts: params.result.artifacts,
    evidence: params.result.evidence,
    error: params.result.error,
    emittedAt: params.result.completedAt,
    correlationId: params.correlationId,
    metadata: params.result.metadata,
  };
}

export function envelopeToCapabilityPortResponse(params: {
  result: CapabilityResultEnvelope;
  requestId: string;
  intentId: string;
  sessionId: string;
  runId: string;
}): CapabilityPortResponse {
  return {
    requestId: params.requestId,
    intentId: params.intentId,
    sessionId: params.sessionId,
    runId: params.runId,
    status: mapEnvelopeStatusToPortResponseStatus(params.result.status),
    result: envelopeToKernelResult({
      result: params.result,
      sessionId: params.sessionId,
      runId: params.runId,
    }),
    output: params.result.output,
    artifacts: params.result.artifacts,
    evidence: params.result.evidence,
    error: params.result.error,
    completedAt: params.result.completedAt,
    metadata: params.result.metadata,
  };
}
