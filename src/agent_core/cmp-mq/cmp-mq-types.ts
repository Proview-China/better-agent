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

export const CMP_SUBSCRIPTION_RELATIONS = [
  "parent",
  "peer",
  "child",
] as const;
export type CmpSubscriptionRelation = (typeof CMP_SUBSCRIPTION_RELATIONS)[number];

export const CMP_CRITICAL_ESCALATION_SEVERITIES = [
  "high",
  "critical",
] as const;
export type CmpCriticalEscalationSeverity = (typeof CMP_CRITICAL_ESCALATION_SEVERITIES)[number];

export const CMP_REDIS_LANE_KINDS = [
  "pubsub",
  "stream",
  "queue",
] as const;
export type CmpRedisLaneKind = (typeof CMP_REDIS_LANE_KINDS)[number];

export const CMP_MQ_DELIVERY_TRUTH_STATUSES = [
  "published",
  "acknowledged",
  "retry_scheduled",
  "expired",
] as const;
export type CmpMqDeliveryTruthStatus = (typeof CMP_MQ_DELIVERY_TRUTH_STATUSES)[number];

export const CMP_REDIS_DELIVERY_TRUTH_STATES = [
  "published",
  "acknowledged",
  "expired",
] as const;
export type CmpRedisDeliveryTruthState = (typeof CMP_REDIS_DELIVERY_TRUTH_STATES)[number];

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

export interface CmpSubscriptionRequest {
  requestId: string;
  projectId: string;
  publisherAgentId: string;
  subscriberAgentId: string;
  relation: CmpSubscriptionRelation;
  channel: CmpMqChannelKind;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpCriticalEscalationEnvelope {
  escalationId: string;
  projectId: string;
  sourceAgentId: string;
  targetAncestorId: string;
  severity: CmpCriticalEscalationSeverity;
  reason: string;
  evidenceRef: string;
  createdAt: string;
  deliveryMode: "alert_envelope";
  redactionLevel: "summary_only";
  metadata?: Record<string, unknown>;
}

export interface CmpRedisNamespace {
  projectId: string;
  namespaceRoot: string;
  keyPrefix: string;
  channelsPrefix: string;
  streamsPrefix: string;
  queuesPrefix: string;
  consumerGroupPrefix: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRedisTopicBinding {
  projectId: string;
  agentId: string;
  channel: CmpMqChannelKind;
  topic: string;
  lane: CmpRedisLaneKind;
  redisKey: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRedisProjectBootstrap {
  projectId: string;
  agentId: string;
  namespace: CmpRedisNamespace;
  topicBindings: CmpRedisTopicBinding[];
  metadata?: Record<string, unknown>;
}

export interface CmpRedisPublishReceipt {
  receiptId: string;
  projectId: string;
  sourceAgentId: string;
  channel: CmpMqChannelKind;
  lane: CmpRedisLaneKind;
  redisKey: string;
  targetCount: number;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRedisDeliveryTruthRecord {
  receiptId: string;
  projectId: string;
  sourceAgentId: string;
  channel: CmpMqChannelKind;
  lane: CmpRedisLaneKind;
  redisKey: string;
  targetCount: number;
  state: CmpRedisDeliveryTruthState;
  publishedAt: string;
  acknowledgedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRedisEscalationReceipt {
  receiptId: string;
  projectId: string;
  sourceAgentId: string;
  targetAncestorId: string;
  lane: "queue";
  redisKey: string;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpMqRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface CmpMqExpiryPolicy {
  ackTimeoutMs: number;
}

export interface CmpMqDeliveryStateRecord {
  deliveryId: string;
  dispatchId: string;
  packageId: string;
  projectId: string;
  sourceAgentId: string;
  targetAgentId: string;
  redisKey: string;
  lane: CmpRedisLaneKind;
  status: CmpMqDeliveryTruthStatus;
  currentAttempt: number;
  maxAttempts: number;
  publishedAt: string;
  ackDeadlineAt: string;
  nextRetryAt?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpMqDeliveryProjectionPatch {
  deliveryId: string;
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  state: "pending_delivery" | "acknowledged" | "expired";
  deliveredAt?: string;
  acknowledgedAt?: string;
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

export function isCmpSubscriptionRelation(value: string): value is CmpSubscriptionRelation {
  return CMP_SUBSCRIPTION_RELATIONS.includes(value as CmpSubscriptionRelation);
}

export function isCmpCriticalEscalationSeverity(
  value: string,
): value is CmpCriticalEscalationSeverity {
  return CMP_CRITICAL_ESCALATION_SEVERITIES.includes(value as CmpCriticalEscalationSeverity);
}

export function isCmpRedisLaneKind(value: string): value is CmpRedisLaneKind {
  return CMP_REDIS_LANE_KINDS.includes(value as CmpRedisLaneKind);
}

export function validateCmpSubscriptionRequest(
  request: CmpSubscriptionRequest,
): void {
  assertNonEmptyString(request.requestId, "CMP subscription requestId");
  assertNonEmptyString(request.projectId, "CMP subscription projectId");
  assertNonEmptyString(request.publisherAgentId, "CMP subscription publisherAgentId");
  assertNonEmptyString(request.subscriberAgentId, "CMP subscription subscriberAgentId");
  assertNonEmptyString(request.createdAt, "CMP subscription createdAt");
  if (request.publisherAgentId === request.subscriberAgentId) {
    throw new Error("CMP subscription request cannot target the publisher itself.");
  }
  if (!isCmpSubscriptionRelation(request.relation)) {
    throw new Error(`Unsupported CMP subscription relation: ${request.relation}.`);
  }
}

export function validateCmpCriticalEscalationEnvelope(
  envelope: CmpCriticalEscalationEnvelope,
): void {
  assertNonEmptyString(envelope.escalationId, "CMP critical escalation escalationId");
  assertNonEmptyString(envelope.projectId, "CMP critical escalation projectId");
  assertNonEmptyString(envelope.sourceAgentId, "CMP critical escalation sourceAgentId");
  assertNonEmptyString(envelope.targetAncestorId, "CMP critical escalation targetAncestorId");
  assertNonEmptyString(envelope.reason, "CMP critical escalation reason");
  assertNonEmptyString(envelope.evidenceRef, "CMP critical escalation evidenceRef");
  assertNonEmptyString(envelope.createdAt, "CMP critical escalation createdAt");
  if (envelope.sourceAgentId === envelope.targetAncestorId) {
    throw new Error("CMP critical escalation targetAncestorId cannot equal sourceAgentId.");
  }
  if (!isCmpCriticalEscalationSeverity(envelope.severity)) {
    throw new Error(`Unsupported CMP critical escalation severity: ${envelope.severity}.`);
  }
  if (envelope.deliveryMode !== "alert_envelope") {
    throw new Error("CMP critical escalation must use alert_envelope delivery mode.");
  }
  if (envelope.redactionLevel !== "summary_only") {
    throw new Error("CMP critical escalation must use summary_only redaction.");
  }
}

export function validateCmpRedisNamespace(namespace: CmpRedisNamespace): void {
  assertNonEmptyString(namespace.projectId, "CMP Redis namespace projectId");
  assertNonEmptyString(namespace.namespaceRoot, "CMP Redis namespace namespaceRoot");
  assertNonEmptyString(namespace.keyPrefix, "CMP Redis namespace keyPrefix");
  assertNonEmptyString(namespace.channelsPrefix, "CMP Redis namespace channelsPrefix");
  assertNonEmptyString(namespace.streamsPrefix, "CMP Redis namespace streamsPrefix");
  assertNonEmptyString(namespace.queuesPrefix, "CMP Redis namespace queuesPrefix");
  assertNonEmptyString(namespace.consumerGroupPrefix, "CMP Redis namespace consumerGroupPrefix");
}

export function validateCmpRedisTopicBinding(binding: CmpRedisTopicBinding): void {
  assertNonEmptyString(binding.projectId, "CMP Redis topic binding projectId");
  assertNonEmptyString(binding.agentId, "CMP Redis topic binding agentId");
  assertNonEmptyString(binding.topic, "CMP Redis topic binding topic");
  assertNonEmptyString(binding.redisKey, "CMP Redis topic binding redisKey");
  if (!isCmpRedisLaneKind(binding.lane)) {
    throw new Error(`Unsupported CMP Redis lane kind: ${binding.lane}.`);
  }
}

export function validateCmpRedisProjectBootstrap(
  bootstrap: CmpRedisProjectBootstrap,
): void {
  assertNonEmptyString(bootstrap.projectId, "CMP Redis bootstrap projectId");
  assertNonEmptyString(bootstrap.agentId, "CMP Redis bootstrap agentId");
  validateCmpRedisNamespace(bootstrap.namespace);
  if (bootstrap.topicBindings.length === 0) {
    throw new Error("CMP Redis bootstrap requires at least one topic binding.");
  }
  for (const binding of bootstrap.topicBindings) {
    validateCmpRedisTopicBinding(binding);
  }
}

export function validateCmpRedisPublishReceipt(receipt: CmpRedisPublishReceipt): void {
  assertNonEmptyString(receipt.receiptId, "CMP Redis publish receiptId");
  assertNonEmptyString(receipt.projectId, "CMP Redis publish projectId");
  assertNonEmptyString(receipt.sourceAgentId, "CMP Redis publish sourceAgentId");
  assertNonEmptyString(receipt.redisKey, "CMP Redis publish redisKey");
  assertNonEmptyString(receipt.publishedAt, "CMP Redis publish publishedAt");
  if (!isCmpRedisLaneKind(receipt.lane)) {
    throw new Error(`Unsupported CMP Redis publish lane: ${receipt.lane}.`);
  }
  if (receipt.targetCount < 1) {
    throw new Error("CMP Redis publish targetCount must be at least 1.");
  }
}

export function validateCmpRedisDeliveryTruthRecord(record: CmpRedisDeliveryTruthRecord): void {
  assertNonEmptyString(record.receiptId, "CMP Redis delivery truth receiptId");
  assertNonEmptyString(record.projectId, "CMP Redis delivery truth projectId");
  assertNonEmptyString(record.sourceAgentId, "CMP Redis delivery truth sourceAgentId");
  assertNonEmptyString(record.redisKey, "CMP Redis delivery truth redisKey");
  assertNonEmptyString(record.publishedAt, "CMP Redis delivery truth publishedAt");
  if (!isCmpRedisLaneKind(record.lane)) {
    throw new Error(`Unsupported CMP Redis delivery truth lane: ${record.lane}.`);
  }
  if (!CMP_REDIS_DELIVERY_TRUTH_STATES.includes(record.state)) {
    throw new Error(`Unsupported CMP Redis delivery truth state: ${record.state}.`);
  }
  if (record.targetCount < 1) {
    throw new Error("CMP Redis delivery truth targetCount must be at least 1.");
  }
}

export function validateCmpRedisEscalationReceipt(receipt: CmpRedisEscalationReceipt): void {
  assertNonEmptyString(receipt.receiptId, "CMP Redis escalation receiptId");
  assertNonEmptyString(receipt.projectId, "CMP Redis escalation projectId");
  assertNonEmptyString(receipt.sourceAgentId, "CMP Redis escalation sourceAgentId");
  assertNonEmptyString(receipt.targetAncestorId, "CMP Redis escalation targetAncestorId");
  assertNonEmptyString(receipt.redisKey, "CMP Redis escalation redisKey");
  assertNonEmptyString(receipt.publishedAt, "CMP Redis escalation publishedAt");
  if (receipt.lane !== "queue") {
    throw new Error("CMP Redis escalation receipt must use queue lane.");
  }
}

export function validateCmpMqRetryPolicy(policy: CmpMqRetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new Error("CMP MQ retry policy maxAttempts must be an integer >= 1.");
  }
  if (!Number.isInteger(policy.backoffMs) || policy.backoffMs < 0) {
    throw new Error("CMP MQ retry policy backoffMs must be an integer >= 0.");
  }
}

export function validateCmpMqExpiryPolicy(policy: CmpMqExpiryPolicy): void {
  if (!Number.isInteger(policy.ackTimeoutMs) || policy.ackTimeoutMs < 1) {
    throw new Error("CMP MQ expiry policy ackTimeoutMs must be an integer >= 1.");
  }
}

export function validateCmpMqDeliveryStateRecord(record: CmpMqDeliveryStateRecord): void {
  assertNonEmptyString(record.deliveryId, "CMP MQ delivery state deliveryId");
  assertNonEmptyString(record.dispatchId, "CMP MQ delivery state dispatchId");
  assertNonEmptyString(record.packageId, "CMP MQ delivery state packageId");
  assertNonEmptyString(record.projectId, "CMP MQ delivery state projectId");
  assertNonEmptyString(record.sourceAgentId, "CMP MQ delivery state sourceAgentId");
  assertNonEmptyString(record.targetAgentId, "CMP MQ delivery state targetAgentId");
  assertNonEmptyString(record.redisKey, "CMP MQ delivery state redisKey");
  assertNonEmptyString(record.publishedAt, "CMP MQ delivery state publishedAt");
  assertNonEmptyString(record.ackDeadlineAt, "CMP MQ delivery state ackDeadlineAt");
  if (!CMP_MQ_DELIVERY_TRUTH_STATUSES.includes(record.status)) {
    throw new Error(`Unsupported CMP MQ delivery truth status: ${record.status}.`);
  }
  if (!isCmpRedisLaneKind(record.lane)) {
    throw new Error(`Unsupported CMP MQ delivery state lane: ${record.lane}.`);
  }
  if (!Number.isInteger(record.currentAttempt) || record.currentAttempt < 1) {
    throw new Error("CMP MQ delivery state currentAttempt must be an integer >= 1.");
  }
  if (!Number.isInteger(record.maxAttempts) || record.maxAttempts < record.currentAttempt) {
    throw new Error("CMP MQ delivery state maxAttempts must be an integer >= currentAttempt.");
  }
}

export function validateCmpMqDeliveryProjectionPatch(
  patch: CmpMqDeliveryProjectionPatch,
): void {
  assertNonEmptyString(patch.deliveryId, "CMP MQ delivery projection deliveryId");
  assertNonEmptyString(patch.dispatchId, "CMP MQ delivery projection dispatchId");
  assertNonEmptyString(patch.packageId, "CMP MQ delivery projection packageId");
  assertNonEmptyString(patch.sourceAgentId, "CMP MQ delivery projection sourceAgentId");
  assertNonEmptyString(patch.targetAgentId, "CMP MQ delivery projection targetAgentId");
}
