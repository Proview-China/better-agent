import { randomUUID } from "node:crypto";

import type { CapabilityResultEnvelope } from "../capability-types/index.js";
import type { KernelEvent, KernelResult, KernelResultStatus } from "../types/index.js";

function toKernelResultStatus(status: CapabilityResultEnvelope["status"]): KernelResultStatus {
  return status;
}

export function toKernelResult(params: {
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
    status: toKernelResultStatus(params.result.status),
    output: params.result.output,
    artifacts: params.result.artifacts,
    evidence: params.result.evidence,
    error: params.result.error,
    emittedAt: params.result.completedAt,
    correlationId: params.correlationId,
    metadata: params.result.metadata,
  };
}

export function createCapabilityResultReceivedEvent(params: {
  result: CapabilityResultEnvelope;
  sessionId: string;
  runId: string;
  requestId: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}): KernelEvent {
  return {
    eventId: randomUUID(),
    type: "capability.result_received",
    sessionId: params.sessionId,
    runId: params.runId,
    createdAt: params.result.completedAt,
    correlationId: params.correlationId,
    payload: {
      requestId: params.requestId,
      resultId: params.result.resultId,
      status: toKernelResultStatus(params.result.status),
    },
    metadata: params.metadata,
  };
}

export function buildCapabilityResultReceivedEvent(
  params: Parameters<typeof createCapabilityResultReceivedEvent>[0],
): KernelEvent {
  return createCapabilityResultReceivedEvent(params);
}

export function findCapabilityResultEventByResultId(params: {
  events: readonly KernelEvent[];
  resultId: string;
}): KernelEvent | undefined {
  return params.events.find((event) => {
    return event.type === "capability.result_received" && event.payload.resultId === params.resultId;
  });
}

export function appendCapabilityResultEventIfAbsent(params: {
  events: readonly KernelEvent[];
  nextEvent: KernelEvent;
}): KernelEvent[] {
  const existing = params.events.find((event) => event.eventId === params.nextEvent.eventId);
  if (existing) {
    return [...params.events];
  }
  return [...params.events, params.nextEvent];
}
