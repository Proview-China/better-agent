export const CMP_MQ_CHANNEL_KINDS = [
  "local",
  "to_parent",
  "peer",
  "to_children",
  "promotion",
  "critical_escalation",
] as const;
export type CmpMqChannelKind = (typeof CMP_MQ_CHANNEL_KINDS)[number];

export const CMP_NEIGHBORHOOD_DIRECTIONS = [
  "parent",
  "peer",
  "child",
] as const;
export type CmpNeighborhoodDirection = (typeof CMP_NEIGHBORHOOD_DIRECTIONS)[number];

export interface CmpAgentNeighborhood {
  agentId: string;
  parentAgentId?: string;
  peerAgentIds: readonly string[];
  childAgentIds: readonly string[];
}

export interface CmpMqTopicDescriptor {
  projectId: string;
  agentId: string;
  channel: CmpMqChannelKind;
  topic: string;
}

export interface CmpIcmaPublishEnvelope {
  envelopeId: string;
  projectId: string;
  sourceAgentId: string;
  direction: CmpNeighborhoodDirection;
  targetAgentIds: string[];
  granularityLabel: string;
  payloadRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function assertNonEmptyString(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function validateCmpAgentNeighborhood(
  neighborhood: CmpAgentNeighborhood,
): void {
  assertNonEmptyString(neighborhood.agentId, "CMP neighborhood agentId");
  for (const peerId of neighborhood.peerAgentIds) {
    assertNonEmptyString(peerId, "CMP neighborhood peerAgentId");
    if (peerId === neighborhood.agentId) {
      throw new Error("CMP neighborhood peer list cannot contain self.");
    }
  }
  for (const childId of neighborhood.childAgentIds) {
    assertNonEmptyString(childId, "CMP neighborhood childAgentId");
    if (childId === neighborhood.agentId) {
      throw new Error("CMP neighborhood child list cannot contain self.");
    }
  }
}

export function validateCmpMqTopicDescriptor(descriptor: CmpMqTopicDescriptor): void {
  assertNonEmptyString(descriptor.projectId, "CMP MQ topic projectId");
  assertNonEmptyString(descriptor.agentId, "CMP MQ topic agentId");
  assertNonEmptyString(descriptor.topic, "CMP MQ topic");
}

export function validateCmpIcmaPublishEnvelope(
  envelope: CmpIcmaPublishEnvelope,
): void {
  assertNonEmptyString(envelope.envelopeId, "CMP ICMA publish envelopeId");
  assertNonEmptyString(envelope.projectId, "CMP ICMA publish projectId");
  assertNonEmptyString(envelope.sourceAgentId, "CMP ICMA publish sourceAgentId");
  assertNonEmptyString(envelope.granularityLabel, "CMP ICMA publish granularityLabel");
  assertNonEmptyString(envelope.payloadRef, "CMP ICMA publish payloadRef");
  assertNonEmptyString(envelope.createdAt, "CMP ICMA publish createdAt");
  if (envelope.targetAgentIds.length === 0) {
    throw new Error("CMP ICMA publish requires at least one target agent.");
  }
}
