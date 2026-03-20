import {
  CMP_MQ_CHANNEL_KINDS,
  type CmpAgentNeighborhood,
  type CmpMqChannelKind,
  type CmpMqTopicDescriptor,
  validateCmpAgentNeighborhood,
  validateCmpMqTopicDescriptor,
} from "./cmp-mq-types.js";

function sanitizeTopicSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function createCmpMqTopic(params: {
  projectId: string;
  agentId: string;
  channel: CmpMqChannelKind;
}): CmpMqTopicDescriptor {
  const descriptor: CmpMqTopicDescriptor = {
    projectId: params.projectId.trim(),
    agentId: params.agentId.trim(),
    channel: params.channel,
    topic: `project.${sanitizeTopicSegment(params.projectId)}.agent.${sanitizeTopicSegment(params.agentId)}.${params.channel}`,
  };
  validateCmpMqTopicDescriptor(descriptor);
  return descriptor;
}

export function createCmpMqTopicTopology(input: {
  projectId: string;
  agentId: string;
}): CmpMqTopicDescriptor[] {
  return CMP_MQ_CHANNEL_KINDS.map((channel) => createCmpMqTopic({
    projectId: input.projectId,
    agentId: input.agentId,
    channel,
  }));
}

export function listNeighborhoodTopics(input: {
  projectId: string;
  neighborhood: CmpAgentNeighborhood;
}): {
  local: CmpMqTopicDescriptor;
  toParent?: CmpMqTopicDescriptor;
  peer: CmpMqTopicDescriptor;
  toChildren: CmpMqTopicDescriptor;
  promotion: CmpMqTopicDescriptor;
  criticalEscalation: CmpMqTopicDescriptor;
} {
  validateCmpAgentNeighborhood(input.neighborhood);
  return {
    local: createCmpMqTopic({
      projectId: input.projectId,
      agentId: input.neighborhood.agentId,
      channel: "local",
    }),
    toParent: input.neighborhood.parentAgentId
      ? createCmpMqTopic({
        projectId: input.projectId,
        agentId: input.neighborhood.agentId,
        channel: "to_parent",
      })
      : undefined,
    peer: createCmpMqTopic({
      projectId: input.projectId,
      agentId: input.neighborhood.agentId,
      channel: "peer",
    }),
    toChildren: createCmpMqTopic({
      projectId: input.projectId,
      agentId: input.neighborhood.agentId,
      channel: "to_children",
    }),
    promotion: createCmpMqTopic({
      projectId: input.projectId,
      agentId: input.neighborhood.agentId,
      channel: "promotion",
    }),
    criticalEscalation: createCmpMqTopic({
      projectId: input.projectId,
      agentId: input.neighborhood.agentId,
      channel: "critical_escalation",
    }),
  };
}

