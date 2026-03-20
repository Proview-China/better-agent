import {
  type CmpAgentNeighborhood,
  type CmpIcmaPublishEnvelope,
  type CmpNeighborhoodDirection,
  validateCmpAgentNeighborhood,
  validateCmpIcmaPublishEnvelope,
} from "./cmp-mq-types.js";

export function resolveNeighborhoodAudience(params: {
  neighborhood: CmpAgentNeighborhood;
  direction: CmpNeighborhoodDirection;
}): string[] {
  validateCmpAgentNeighborhood(params.neighborhood);
  switch (params.direction) {
    case "parent":
      return params.neighborhood.parentAgentId
        ? [params.neighborhood.parentAgentId]
        : [];
    case "peer":
      return [...params.neighborhood.peerAgentIds];
    case "child":
      return [...params.neighborhood.childAgentIds];
  }
}

export function createCmpIcmaPublishEnvelope(input: {
  envelopeId: string;
  projectId: string;
  sourceAgentId: string;
  neighborhood: CmpAgentNeighborhood;
  direction: CmpNeighborhoodDirection;
  granularityLabel: string;
  payloadRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}): CmpIcmaPublishEnvelope {
  const envelope: CmpIcmaPublishEnvelope = {
    envelopeId: input.envelopeId.trim(),
    projectId: input.projectId.trim(),
    sourceAgentId: input.sourceAgentId.trim(),
    direction: input.direction,
    targetAgentIds: resolveNeighborhoodAudience({
      neighborhood: input.neighborhood,
      direction: input.direction,
    }),
    granularityLabel: input.granularityLabel.trim(),
    payloadRef: input.payloadRef.trim(),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };
  validateCmpIcmaPublishEnvelope(envelope);
  return envelope;
}

export function assertNoSkippingNeighborhoodBroadcast(params: {
  envelope: CmpIcmaPublishEnvelope;
  knownAncestorIds?: readonly string[];
  parentPeerIds?: readonly string[];
}): void {
  validateCmpIcmaPublishEnvelope(params.envelope);
  const ancestorIds = new Set(params.knownAncestorIds ?? []);
  const parentPeerIds = new Set(params.parentPeerIds ?? []);
  for (const targetAgentId of params.envelope.targetAgentIds) {
    if (ancestorIds.has(targetAgentId)) {
      throw new Error(
        `CMP neighborhood broadcast cannot skip upward to ancestor ${targetAgentId}.`,
      );
    }
    if (parentPeerIds.has(targetAgentId)) {
      throw new Error(
        `CMP neighborhood broadcast cannot target parent-peer ${targetAgentId} without parent mediation.`,
      );
    }
  }
}

