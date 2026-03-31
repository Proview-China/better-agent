export const TAP_AGENT_RECORD_ACTORS = [
  "reviewer",
  "tool_reviewer",
  "tma",
] as const;
export type TapAgentRecordActor = (typeof TAP_AGENT_RECORD_ACTORS)[number];

export interface TapAgentRecord {
  recordId: string;
  actor: TapAgentRecordActor;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  status: string;
  summary: string;
  createdAt: string;
  requestId?: string;
  provisionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTapAgentRecordInput {
  recordId: string;
  actor: TapAgentRecordActor;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  status: string;
  summary: string;
  createdAt: string;
  requestId?: string;
  provisionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TapThreeAgentUsageReport {
  sessionId?: string;
  runId?: string;
  recordCount: number;
  summary: string;
  records: TapAgentRecord[];
  latestByActor: Partial<Record<TapAgentRecordActor, TapAgentRecord>>;
  actorsSeen: TapAgentRecordActor[];
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function cloneRecord(record: TapAgentRecord): TapAgentRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined,
  };
}

export function createTapAgentRecord(
  input: CreateTapAgentRecordInput,
): TapAgentRecord {
  return {
    recordId: assertNonEmpty(input.recordId, "Tap agent record recordId"),
    actor: input.actor,
    sessionId: assertNonEmpty(input.sessionId, "Tap agent record sessionId"),
    runId: assertNonEmpty(input.runId, "Tap agent record runId"),
    capabilityKey: assertNonEmpty(input.capabilityKey, "Tap agent record capabilityKey"),
    status: assertNonEmpty(input.status, "Tap agent record status"),
    summary: assertNonEmpty(input.summary, "Tap agent record summary"),
    createdAt: assertNonEmpty(input.createdAt, "Tap agent record createdAt"),
    requestId: input.requestId?.trim() || undefined,
    provisionId: input.provisionId?.trim() || undefined,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

export function cloneTapAgentRecords(
  records: readonly TapAgentRecord[] = [],
): TapAgentRecord[] {
  return records.map(cloneRecord);
}

export function createTapThreeAgentUsageReport(input: {
  records: readonly TapAgentRecord[];
  sessionId?: string;
  runId?: string;
}): TapThreeAgentUsageReport {
  const scoped = input.records
    .filter((record) => !input.sessionId || record.sessionId === input.sessionId)
    .filter((record) => !input.runId || record.runId === input.runId)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const latestByActor: Partial<Record<TapAgentRecordActor, TapAgentRecord>> = {};
  const actorsSeen: TapAgentRecordActor[] = [];

  for (const record of scoped) {
    latestByActor[record.actor] = cloneRecord(record);
    if (!actorsSeen.includes(record.actor)) {
      actorsSeen.push(record.actor);
    }
  }

  const latestReviewer = latestByActor.reviewer;
  const latestToolReviewer = latestByActor.tool_reviewer;
  const latestTma = latestByActor.tma;
  const summary = scoped.length === 0
    ? "No three-agent TAP usage records are available for the requested scope."
    : [
      latestReviewer
        ? `Reviewer is ${latestReviewer.status}`
        : "Reviewer has not recorded a decision yet",
      latestToolReviewer
        ? `tool reviewer is ${latestToolReviewer.status}`
        : "tool reviewer has no governance record yet",
      latestTma
        ? `TMA is ${latestTma.status}`
        : "TMA has no delivery record yet",
    ].join("; ");

  return {
    sessionId: input.sessionId,
    runId: input.runId,
    recordCount: scoped.length,
    summary,
    records: cloneTapAgentRecords(scoped),
    latestByActor,
    actorsSeen,
  };
}
