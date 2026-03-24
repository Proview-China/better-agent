import { randomUUID } from "node:crypto";

import {
  type CmpRedisNamespace,
  type CmpRedisProjectBootstrap,
  type CmpRedisTopicBinding,
  validateCmpRedisProjectBootstrap,
} from "./cmp-mq-types.js";
import { createCmpMqTopicTopology } from "./topic-topology.js";
import { createCmpRedisNamespace, createCmpRedisTopicBinding } from "./redis-routing.js";

export function createCmpRedisProjectBootstrap(input: {
  projectId: string;
  agentId: string;
  namespaceRoot?: string;
  metadata?: Record<string, unknown>;
}): CmpRedisProjectBootstrap {
  const namespace = createCmpRedisNamespace({
    projectId: input.projectId,
    namespaceRoot: input.namespaceRoot,
    metadata: input.metadata,
  });
  const topicBindings = createCmpMqTopicTopology({
    projectId: input.projectId,
    agentId: input.agentId,
  }).map((descriptor) => createCmpRedisTopicBinding({
    namespace,
    descriptor,
  }));

  const bootstrap: CmpRedisProjectBootstrap = {
    projectId: input.projectId.trim(),
    agentId: input.agentId.trim(),
    namespace,
    topicBindings,
    metadata: {
      bootstrapId: randomUUID(),
      ...(input.metadata ?? {}),
    },
  };
  validateCmpRedisProjectBootstrap(bootstrap);
  return bootstrap;
}

export function getCmpRedisBindingForChannel(params: {
  bootstrap: Pick<CmpRedisProjectBootstrap, "topicBindings">;
  channel: CmpRedisTopicBinding["channel"];
}): CmpRedisTopicBinding | undefined {
  return params.bootstrap.topicBindings.find((binding) => binding.channel === params.channel);
}

export function listCmpRedisBootstrapKeys(input: {
  namespace: CmpRedisNamespace;
}): string[] {
  return [
    input.namespace.keyPrefix,
    input.namespace.channelsPrefix,
    input.namespace.streamsPrefix,
    input.namespace.queuesPrefix,
    input.namespace.consumerGroupPrefix,
  ];
}
