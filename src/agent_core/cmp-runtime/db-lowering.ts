import type {
  CmpDbContextPackageRecord,
  CmpDbDeliveryRegistryRecord,
  CmpDbPsqlLiveExecutor,
  CmpDbPsqlStatementExecutionReceipt,
  CmpDbPostgresAdapter,
  CmpDbDeliveryRecordState,
  CmpProjectionRecord,
} from "../cmp-db/index.js";
import type { CmpDbPostgresQueryPrimitive } from "../cmp-db/postgresql-adapter.js";
import type { CmpMqDeliveryProjectionPatch } from "../cmp-mq/index.js";

export interface CmpDbLoweringExecution {
  writeStatement: CmpDbPostgresQueryPrimitive;
  writeExecution: CmpDbPsqlStatementExecutionReceipt;
  readStatement: CmpDbPostgresQueryPrimitive;
  readExecution: CmpDbPsqlStatementExecutionReceipt;
}

export interface CmpProjectionTruthReadback {
  projectionId: string;
  snapshotId: string;
  agentId: string;
  status: "present" | "missing";
  readTarget: string;
  tableRef?: string;
}

function normalizeReadbackTableRef(stdout: string): string | undefined {
  const normalized = stdout.trim();
  return normalized ? normalized : undefined;
}

export function summarizeCmpProjectionTruthReadback(input: {
  record: CmpProjectionRecord;
  execution: CmpDbPsqlStatementExecutionReceipt;
}): CmpProjectionTruthReadback {
  const tableRef = normalizeReadbackTableRef(input.execution.stdout);
  return {
    projectionId: input.record.projectionId,
    snapshotId: input.record.snapshotId,
    agentId: input.record.agentId,
    status: tableRef ? "present" : "missing",
    readTarget: input.execution.target,
    tableRef,
  };
}

export interface CmpProjectionLoweringExecution extends CmpDbLoweringExecution {
  truthReadback: CmpProjectionTruthReadback;
}

export async function executeCmpProjectionLowering(input: {
  adapter: CmpDbPostgresAdapter;
  executor: CmpDbPsqlLiveExecutor;
  record: CmpProjectionRecord;
}): Promise<CmpProjectionLoweringExecution> {
  const writeStatement = input.adapter.buildProjectionUpsert(input.record);
  const writeExecution = await input.executor.executeStatement(writeStatement);
  const readStatement = input.adapter.buildProjectionSelect({
    agentId: input.record.agentId,
    snapshotId: input.record.snapshotId,
  });
  const readExecution = await input.executor.executeStatement(readStatement);
  return {
    writeStatement,
    writeExecution,
    readStatement,
    readExecution,
    truthReadback: summarizeCmpProjectionTruthReadback({
      record: input.record,
      execution: readExecution,
    }),
  };
}

export async function executeCmpContextPackageLowering(input: {
  adapter: CmpDbPostgresAdapter;
  executor: CmpDbPsqlLiveExecutor;
  record: CmpDbContextPackageRecord;
}): Promise<CmpDbLoweringExecution> {
  const writeStatement = input.adapter.buildContextPackageUpsert(input.record);
  const writeExecution = await input.executor.executeStatement(writeStatement);
  const readStatement = input.adapter.buildContextPackageSelect({
    agentId: input.record.sourceAgentId,
    packageId: input.record.packageId,
  });
  const readExecution = await input.executor.executeStatement(readStatement);
  return {
    writeStatement,
    writeExecution,
    readStatement,
    readExecution,
  };
}

export async function executeCmpDeliveryLowering(input: {
  adapter: CmpDbPostgresAdapter;
  executor: CmpDbPsqlLiveExecutor;
  record: CmpDbDeliveryRegistryRecord;
}): Promise<CmpDbLoweringExecution> {
  const writeStatement = input.adapter.buildDeliveryUpsert(input.record);
  const writeExecution = await input.executor.executeStatement(writeStatement);
  const readStatement = input.adapter.buildDeliverySelect({
    deliveryId: input.record.deliveryId,
  });
  const readExecution = await input.executor.executeStatement(readStatement);
  return {
    writeStatement,
    writeExecution,
    readStatement,
    readExecution,
  };
}

function mapCmpMqPatchStateToDbState(state: CmpMqDeliveryProjectionPatch["state"]): CmpDbDeliveryRecordState {
  switch (state) {
    case "pending_delivery":
      return "pending_delivery";
    case "acknowledged":
      return "acknowledged";
    case "expired":
      return "expired";
  }
}

export function applyCmpMqDeliveryProjectionPatchToRecord(input: {
  record: CmpDbDeliveryRegistryRecord;
  patch: CmpMqDeliveryProjectionPatch;
  metadata?: Record<string, unknown>;
}): CmpDbDeliveryRegistryRecord {
  if (input.record.deliveryId !== input.patch.deliveryId || input.record.dispatchId !== input.patch.dispatchId) {
    throw new Error("CMP MQ delivery patch must match DB delivery record ids.");
  }
  if (input.record.packageId !== input.patch.packageId) {
    throw new Error("CMP MQ delivery patch must match DB delivery package id.");
  }
  if (input.record.sourceAgentId !== input.patch.sourceAgentId || input.record.targetAgentId !== input.patch.targetAgentId) {
    throw new Error("CMP MQ delivery patch must match DB delivery source/target ids.");
  }

  return {
    ...input.record,
    state: mapCmpMqPatchStateToDbState(input.patch.state),
    deliveredAt: input.patch.deliveredAt ?? input.record.deliveredAt,
    acknowledgedAt: input.patch.acknowledgedAt ?? input.record.acknowledgedAt,
    metadata: {
      ...(input.record.metadata ?? {}),
      ...(input.patch.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export function createCmpDeliveryRecordFromMqProjectionPatch(input: {
  patch: CmpMqDeliveryProjectionPatch;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}): CmpDbDeliveryRegistryRecord {
  return {
    deliveryId: input.patch.deliveryId,
    dispatchId: input.patch.dispatchId,
    packageId: input.patch.packageId,
    sourceAgentId: input.patch.sourceAgentId,
    targetAgentId: input.patch.targetAgentId,
    state: mapCmpMqPatchStateToDbState(input.patch.state),
    createdAt: input.createdAt ?? input.patch.deliveredAt ?? input.patch.acknowledgedAt ?? new Date().toISOString(),
    deliveredAt: input.patch.deliveredAt,
    acknowledgedAt: input.patch.acknowledgedAt,
    metadata: {
      ...(input.patch.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}
