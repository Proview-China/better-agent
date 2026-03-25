import type {
  CmpDbContextPackageRecord,
  CmpDbDeliveryRegistryRecord,
  CmpDbPsqlLiveExecutor,
  CmpDbPsqlStatementExecutionReceipt,
  CmpDbPostgresAdapter,
  CmpProjectionRecord,
} from "../cmp-db/index.js";
import type { CmpDbPostgresQueryPrimitive } from "../cmp-db/postgresql-adapter.js";

export interface CmpDbLoweringExecution {
  writeStatement: CmpDbPostgresQueryPrimitive;
  writeExecution: CmpDbPsqlStatementExecutionReceipt;
  readStatement: CmpDbPostgresQueryPrimitive;
  readExecution: CmpDbPsqlStatementExecutionReceipt;
}

export async function executeCmpProjectionLowering(input: {
  adapter: CmpDbPostgresAdapter;
  executor: CmpDbPsqlLiveExecutor;
  record: CmpProjectionRecord;
}): Promise<CmpDbLoweringExecution> {
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
