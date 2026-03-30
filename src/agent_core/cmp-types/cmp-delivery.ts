export const CMP_PROJECTION_VISIBILITY_LEVELS = [
  "local",
  "parent",
  "peer",
  "children",
  "lineage",
] as const;
export type CmpProjectionVisibilityLevel = (typeof CMP_PROJECTION_VISIBILITY_LEVELS)[number];

export const CMP_PROJECTION_PROMOTION_STATUSES = [
  "local_only",
  "submitted_to_parent",
  "accepted_by_parent",
  "promoted_by_parent",
  "dispatched_downward",
  "archived",
] as const;
export type CmpProjectionPromotionStatus = (typeof CMP_PROJECTION_PROMOTION_STATUSES)[number];

export const CMP_CONTEXT_PACKAGE_KINDS = [
  "active_reseed",
  "historical_reply",
  "peer_exchange",
  "promotion_update",
  "child_seed",
] as const;
export type CmpContextPackageKind = (typeof CMP_CONTEXT_PACKAGE_KINDS)[number];

export const CMP_CONTEXT_PACKAGE_FIDELITY_LABELS = [
  "high_signal",
  "checked_high_fidelity",
  "raw_linked",
] as const;
export type CmpContextPackageFidelityLabel = (typeof CMP_CONTEXT_PACKAGE_FIDELITY_LABELS)[number];

export const CMP_CONTEXT_PACKAGE_STATUSES = [
  "materialized",
  "dispatched",
  "served",
] as const;
export type CmpContextPackageStatus = (typeof CMP_CONTEXT_PACKAGE_STATUSES)[number];

export const CMP_DISPATCH_STATUSES = [
  "queued",
  "delivered",
  "acknowledged",
  "rejected",
  "expired",
] as const;
export type CmpDispatchStatus = (typeof CMP_DISPATCH_STATUSES)[number];

export const CMP_SYNC_EVENT_CHANNELS = [
  "git",
  "db",
  "mq",
] as const;
export type CmpSyncEventChannel = (typeof CMP_SYNC_EVENT_CHANNELS)[number];

export const CMP_SYNC_EVENT_DIRECTIONS = [
  "local",
  "to_parent",
  "to_peer",
  "to_children",
  "promotion",
] as const;
export type CmpSyncEventDirection = (typeof CMP_SYNC_EVENT_DIRECTIONS)[number];

export const CMP_ESCALATION_SEVERITIES = [
  "high",
  "critical",
] as const;
export type CmpEscalationSeverity = (typeof CMP_ESCALATION_SEVERITIES)[number];

export interface PromotedProjection {
  projectionId: string;
  snapshotId: string;
  agentId: string;
  visibilityLevel: CmpProjectionVisibilityLevel;
  promotionStatus: CmpProjectionPromotionStatus;
  projectionRefs: string[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePromotedProjectionInput {
  projectionId: string;
  snapshotId: string;
  agentId: string;
  visibilityLevel?: CmpProjectionVisibilityLevel;
  promotionStatus?: CmpProjectionPromotionStatus;
  projectionRefs: string[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ContextPackage {
  packageId: string;
  sourceProjectionId: string;
  targetAgentId: string;
  packageKind: CmpContextPackageKind;
  packageRef: string;
  fidelityLabel: CmpContextPackageFidelityLabel;
  createdAt: string;
  updatedAt?: string;
  packageStatus?: CmpContextPackageStatus;
  sourceSnapshotId?: string;
  sourceSectionIds?: string[];
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateContextPackageInput {
  packageId: string;
  sourceProjectionId: string;
  targetAgentId: string;
  packageKind?: CmpContextPackageKind;
  packageRef: string;
  fidelityLabel?: CmpContextPackageFidelityLabel;
  createdAt: string;
  updatedAt?: string;
  packageStatus?: CmpContextPackageStatus;
  sourceSnapshotId?: string;
  sourceSectionIds?: string[];
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface DispatchReceipt {
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  status: CmpDispatchStatus;
  deliveredAt?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDispatchReceiptInput {
  dispatchId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  status?: CmpDispatchStatus;
  deliveredAt?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncEvent {
  syncEventId: string;
  agentId: string;
  channel: CmpSyncEventChannel;
  direction: CmpSyncEventDirection;
  objectRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSyncEventInput {
  syncEventId: string;
  agentId: string;
  channel: CmpSyncEventChannel;
  direction: CmpSyncEventDirection;
  objectRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface EscalationAlert {
  alertId: string;
  sourceAgentId: string;
  targetAncestorId: string;
  severity: CmpEscalationSeverity;
  reason: string;
  evidenceRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEscalationAlertInput {
  alertId: string;
  sourceAgentId: string;
  targetAncestorId: string;
  severity?: CmpEscalationSeverity;
  reason: string;
  evidenceRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values: string[], label: string): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new Error(`${label} requires at least one non-empty string.`);
  }
  return normalized;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function isCmpProjectionVisibilityLevel(value: string): value is CmpProjectionVisibilityLevel {
  return CMP_PROJECTION_VISIBILITY_LEVELS.includes(value as CmpProjectionVisibilityLevel);
}

export function isCmpProjectionPromotionStatus(value: string): value is CmpProjectionPromotionStatus {
  return CMP_PROJECTION_PROMOTION_STATUSES.includes(value as CmpProjectionPromotionStatus);
}

export function isCmpContextPackageKind(value: string): value is CmpContextPackageKind {
  return CMP_CONTEXT_PACKAGE_KINDS.includes(value as CmpContextPackageKind);
}

export function isCmpContextPackageFidelityLabel(value: string): value is CmpContextPackageFidelityLabel {
  return CMP_CONTEXT_PACKAGE_FIDELITY_LABELS.includes(value as CmpContextPackageFidelityLabel);
}

export function isCmpContextPackageStatus(value: string): value is CmpContextPackageStatus {
  return CMP_CONTEXT_PACKAGE_STATUSES.includes(value as CmpContextPackageStatus);
}

export function isCmpDispatchStatus(value: string): value is CmpDispatchStatus {
  return CMP_DISPATCH_STATUSES.includes(value as CmpDispatchStatus);
}

export function isCmpSyncEventChannel(value: string): value is CmpSyncEventChannel {
  return CMP_SYNC_EVENT_CHANNELS.includes(value as CmpSyncEventChannel);
}

export function isCmpSyncEventDirection(value: string): value is CmpSyncEventDirection {
  return CMP_SYNC_EVENT_DIRECTIONS.includes(value as CmpSyncEventDirection);
}

export function isCmpEscalationSeverity(value: string): value is CmpEscalationSeverity {
  return CMP_ESCALATION_SEVERITIES.includes(value as CmpEscalationSeverity);
}

export function validatePromotedProjection(projection: PromotedProjection): void {
  assertNonEmpty(projection.projectionId, "CMP PromotedProjection projectionId");
  assertNonEmpty(projection.snapshotId, "CMP PromotedProjection snapshotId");
  assertNonEmpty(projection.agentId, "CMP PromotedProjection agentId");
  if (!isCmpProjectionVisibilityLevel(projection.visibilityLevel)) {
    throw new Error(`Unsupported CMP PromotedProjection visibilityLevel: ${projection.visibilityLevel}.`);
  }
  if (!isCmpProjectionPromotionStatus(projection.promotionStatus)) {
    throw new Error(`Unsupported CMP PromotedProjection promotionStatus: ${projection.promotionStatus}.`);
  }
  normalizeStringArray(projection.projectionRefs, "CMP PromotedProjection projectionRefs");
}

export function createPromotedProjection(input: CreatePromotedProjectionInput): PromotedProjection {
  const projection: PromotedProjection = {
    projectionId: assertNonEmpty(input.projectionId, "CMP PromotedProjection projectionId"),
    snapshotId: assertNonEmpty(input.snapshotId, "CMP PromotedProjection snapshotId"),
    agentId: assertNonEmpty(input.agentId, "CMP PromotedProjection agentId"),
    visibilityLevel: input.visibilityLevel ?? "local",
    promotionStatus: input.promotionStatus ?? "local_only",
    projectionRefs: normalizeStringArray(input.projectionRefs, "CMP PromotedProjection projectionRefs"),
    updatedAt: input.updatedAt,
    metadata: input.metadata,
  };

  validatePromotedProjection(projection);
  return projection;
}

export function validateContextPackage(contextPackage: ContextPackage): void {
  assertNonEmpty(contextPackage.packageId, "CMP ContextPackage packageId");
  assertNonEmpty(contextPackage.sourceProjectionId, "CMP ContextPackage sourceProjectionId");
  assertNonEmpty(contextPackage.targetAgentId, "CMP ContextPackage targetAgentId");
  assertNonEmpty(contextPackage.packageRef, "CMP ContextPackage packageRef");
  if (contextPackage.updatedAt) {
    assertNonEmpty(contextPackage.updatedAt, "CMP ContextPackage updatedAt");
  }
  if (!isCmpContextPackageKind(contextPackage.packageKind)) {
    throw new Error(`Unsupported CMP ContextPackage packageKind: ${contextPackage.packageKind}.`);
  }
  if (!isCmpContextPackageFidelityLabel(contextPackage.fidelityLabel)) {
    throw new Error(`Unsupported CMP ContextPackage fidelityLabel: ${contextPackage.fidelityLabel}.`);
  }
  if (contextPackage.packageStatus && !isCmpContextPackageStatus(contextPackage.packageStatus)) {
    throw new Error(`Unsupported CMP ContextPackage packageStatus: ${contextPackage.packageStatus}.`);
  }
}

export function createContextPackage(input: CreateContextPackageInput): ContextPackage {
  const contextPackage: ContextPackage = {
    packageId: assertNonEmpty(input.packageId, "CMP ContextPackage packageId"),
    sourceProjectionId: assertNonEmpty(input.sourceProjectionId, "CMP ContextPackage sourceProjectionId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP ContextPackage targetAgentId"),
    packageKind: input.packageKind ?? "active_reseed",
    packageRef: assertNonEmpty(input.packageRef, "CMP ContextPackage packageRef"),
    fidelityLabel: input.fidelityLabel ?? "checked_high_fidelity",
    createdAt: input.createdAt,
    updatedAt: assertNonEmpty(input.updatedAt ?? input.createdAt, "CMP ContextPackage updatedAt"),
    packageStatus: input.packageStatus ?? "materialized",
    sourceSnapshotId: input.sourceSnapshotId?.trim() || undefined,
    sourceSectionIds: [...new Set((input.sourceSectionIds ?? []).map((value) => value.trim()).filter(Boolean))],
    requestId: input.requestId?.trim() || undefined,
    metadata: input.metadata,
  };

  validateContextPackage(contextPackage);
  return contextPackage;
}

export function validateDispatchReceipt(receipt: DispatchReceipt): void {
  assertNonEmpty(receipt.dispatchId, "CMP DispatchReceipt dispatchId");
  assertNonEmpty(receipt.packageId, "CMP DispatchReceipt packageId");
  assertNonEmpty(receipt.sourceAgentId, "CMP DispatchReceipt sourceAgentId");
  assertNonEmpty(receipt.targetAgentId, "CMP DispatchReceipt targetAgentId");
  if (!isCmpDispatchStatus(receipt.status)) {
    throw new Error(`Unsupported CMP DispatchReceipt status: ${receipt.status}.`);
  }
  if (receipt.acknowledgedAt && !receipt.deliveredAt) {
    throw new Error("CMP DispatchReceipt acknowledgedAt requires deliveredAt to be set.");
  }
}

export function createDispatchReceipt(input: CreateDispatchReceiptInput): DispatchReceipt {
  const receipt: DispatchReceipt = {
    dispatchId: assertNonEmpty(input.dispatchId, "CMP DispatchReceipt dispatchId"),
    packageId: assertNonEmpty(input.packageId, "CMP DispatchReceipt packageId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP DispatchReceipt sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP DispatchReceipt targetAgentId"),
    status: input.status ?? "queued",
    deliveredAt: input.deliveredAt,
    acknowledgedAt: input.acknowledgedAt,
    metadata: input.metadata,
  };

  validateDispatchReceipt(receipt);
  return receipt;
}

export function validateSyncEvent(syncEvent: SyncEvent): void {
  assertNonEmpty(syncEvent.syncEventId, "CMP SyncEvent syncEventId");
  assertNonEmpty(syncEvent.agentId, "CMP SyncEvent agentId");
  assertNonEmpty(syncEvent.objectRef, "CMP SyncEvent objectRef");
  if (!isCmpSyncEventChannel(syncEvent.channel)) {
    throw new Error(`Unsupported CMP SyncEvent channel: ${syncEvent.channel}.`);
  }
  if (!isCmpSyncEventDirection(syncEvent.direction)) {
    throw new Error(`Unsupported CMP SyncEvent direction: ${syncEvent.direction}.`);
  }
}

export function createSyncEvent(input: CreateSyncEventInput): SyncEvent {
  const syncEvent: SyncEvent = {
    syncEventId: assertNonEmpty(input.syncEventId, "CMP SyncEvent syncEventId"),
    agentId: assertNonEmpty(input.agentId, "CMP SyncEvent agentId"),
    channel: input.channel,
    direction: input.direction,
    objectRef: assertNonEmpty(input.objectRef, "CMP SyncEvent objectRef"),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateSyncEvent(syncEvent);
  return syncEvent;
}

export function validateEscalationAlert(alert: EscalationAlert): void {
  assertNonEmpty(alert.alertId, "CMP EscalationAlert alertId");
  assertNonEmpty(alert.sourceAgentId, "CMP EscalationAlert sourceAgentId");
  assertNonEmpty(alert.targetAncestorId, "CMP EscalationAlert targetAncestorId");
  assertNonEmpty(alert.reason, "CMP EscalationAlert reason");
  assertNonEmpty(alert.evidenceRef, "CMP EscalationAlert evidenceRef");
  if (!isCmpEscalationSeverity(alert.severity)) {
    throw new Error(`Unsupported CMP EscalationAlert severity: ${alert.severity}.`);
  }
}

export function createEscalationAlert(input: CreateEscalationAlertInput): EscalationAlert {
  const alert: EscalationAlert = {
    alertId: assertNonEmpty(input.alertId, "CMP EscalationAlert alertId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP EscalationAlert sourceAgentId"),
    targetAncestorId: assertNonEmpty(input.targetAncestorId, "CMP EscalationAlert targetAncestorId"),
    severity: input.severity ?? "critical",
    reason: assertNonEmpty(input.reason, "CMP EscalationAlert reason"),
    evidenceRef: assertNonEmpty(input.evidenceRef, "CMP EscalationAlert evidenceRef"),
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  validateEscalationAlert(alert);
  return alert;
}
