import {
  type CmpMqChannelKind,
  type CmpMqTopicDescriptor,
  type CmpRedisLaneKind,
  type CmpRedisNamespace,
  type CmpRedisTopicBinding,
  validateCmpMqTopicDescriptor,
  validateCmpRedisNamespace,
  validateCmpRedisTopicBinding,
} from "./cmp-mq-types.js";

export const CMP_REDIS_DEFAULT_NAMESPACE_ROOT = "cmp";

export const CMP_REDIS_CHANNEL_LANE_MAP: Record<CmpMqChannelKind, CmpRedisLaneKind> = {
  local: "stream",
  to_parent: "stream",
  peer: "pubsub",
  to_children: "pubsub",
  promotion: "stream",
  critical_escalation: "queue",
};

function sanitizeRedisSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function createCmpRedisNamespace(input: {
  projectId: string;
  namespaceRoot?: string;
  metadata?: Record<string, unknown>;
}): CmpRedisNamespace {
  const projectSegment = sanitizeRedisSegment(input.projectId);
  const namespaceRoot = sanitizeRedisSegment(input.namespaceRoot ?? CMP_REDIS_DEFAULT_NAMESPACE_ROOT);
  const keyPrefix = `${namespaceRoot}:${projectSegment}`;
  const namespace: CmpRedisNamespace = {
    projectId: input.projectId.trim(),
    namespaceRoot,
    keyPrefix,
    channelsPrefix: `${keyPrefix}:channel`,
    streamsPrefix: `${keyPrefix}:stream`,
    queuesPrefix: `${keyPrefix}:queue`,
    consumerGroupPrefix: `${keyPrefix}:group`,
    metadata: input.metadata,
  };
  validateCmpRedisNamespace(namespace);
  return namespace;
}

export function resolveCmpRedisLaneForChannel(channel: CmpMqChannelKind): CmpRedisLaneKind {
  return CMP_REDIS_CHANNEL_LANE_MAP[channel];
}

export function createCmpRedisTopicBinding(input: {
  namespace: CmpRedisNamespace;
  descriptor: CmpMqTopicDescriptor;
  lane?: CmpRedisLaneKind;
  metadata?: Record<string, unknown>;
}): CmpRedisTopicBinding {
  validateCmpRedisNamespace(input.namespace);
  validateCmpMqTopicDescriptor(input.descriptor);
  const lane = input.lane ?? resolveCmpRedisLaneForChannel(input.descriptor.channel);
  const prefix = lane === "pubsub"
    ? input.namespace.channelsPrefix
    : lane === "stream"
      ? input.namespace.streamsPrefix
      : input.namespace.queuesPrefix;

  const binding: CmpRedisTopicBinding = {
    projectId: input.descriptor.projectId,
    agentId: input.descriptor.agentId,
    channel: input.descriptor.channel,
    topic: input.descriptor.topic,
    lane,
    redisKey: `${prefix}:${input.descriptor.topic}`,
    metadata: input.metadata,
  };
  validateCmpRedisTopicBinding(binding);
  return binding;
}
