import { randomUUID } from "node:crypto";

import {
  type CmpDbAdapterLike,
  type CmpAgentLocalTableSet,
  type CmpDbContextPackageRecord,
  type CmpDbDeliveryRegistryRecord,
  type CmpDbQueryPrimitive,
  type CmpProjectDbTopology,
  type CmpProjectionRecord,
  assertNonEmptyString,
} from "./cmp-db-types.js";
import { getCmpAgentLocalTableByKind } from "./agent-local-hot-tables.js";
import { getCmpSharedTableByKind } from "./project-db-topology.js";

export interface CmpDbSqliteQueryPrimitive extends CmpDbQueryPrimitive {}

export interface CmpDbSqliteAdapter extends CmpDbAdapterLike {
  readonly driver: "sqlite";
}

export interface CreateCmpDbSqliteAdapterInput {
  topology: CmpProjectDbTopology;
  localTableSets: readonly CmpAgentLocalTableSet[];
}

function createQueryPrimitive(input: Omit<CmpDbSqliteQueryPrimitive, "statementId">): CmpDbSqliteQueryPrimitive {
  return {
    statementId: randomUUID(),
    ...input,
  };
}

function requireLocalTable(params: {
  localTableSets: Map<string, CmpAgentLocalTableSet>;
  agentId: string;
  kind: "snapshots" | "packages";
}) {
  const set = params.localTableSets.get(params.agentId);
  if (!set) {
    throw new Error(`CMP sqlite adapter is missing local table set for agent ${params.agentId}.`);
  }
  const table = getCmpAgentLocalTableByKind({
    set,
    kind: params.kind,
  });
  if (!table) {
    throw new Error(`CMP sqlite adapter is missing ${params.kind} table for agent ${params.agentId}.`);
  }
  return table;
}

function requireDeliveryRegistryTable(topology: CmpProjectDbTopology) {
  const table = getCmpSharedTableByKind({
    topology,
    kind: "delivery_registry",
  });
  if (!table) {
    throw new Error("CMP sqlite adapter is missing delivery_registry table.");
  }
  return table;
}

function qualifiedTableName(tableName: string): string {
  return `"${tableName}"`;
}

export function createCmpDbSqliteAdapter(
  input: CreateCmpDbSqliteAdapterInput,
): CmpDbSqliteAdapter {
  const localTableSets = new Map(input.localTableSets.map((set) => [set.agentId, set]));

  return {
    driver: "sqlite",
    topology: input.topology,
    localTableSets,
    buildProjectionUpsert(record) {
      const table = requireLocalTable({
        localTableSets,
        agentId: record.agentId,
        kind: "snapshots",
      });
      return createQueryPrimitive({
        phase: "write",
        target: `${table.schemaName}.${table.tableName}`,
        text: `INSERT INTO ${qualifiedTableName(table.tableName)} (snapshots_id, project_id, agent_id, snapshot_id, branch_ref, commit_ref, projection_state, checked_at, updated_at, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(snapshot_id) DO UPDATE SET branch_ref = excluded.branch_ref, commit_ref = excluded.commit_ref, projection_state = excluded.projection_state, checked_at = excluded.checked_at, updated_at = excluded.updated_at, metadata = excluded.metadata;`,
        values: [
          record.projectionId,
          input.topology.projectId,
          record.agentId,
          record.snapshotId,
          record.branchRef,
          record.commitRef,
          record.state,
          record.updatedAt,
          record.updatedAt,
          record.metadata ?? {},
        ],
        metadata: {
          purpose: "projection_upsert",
        },
      });
    },
    buildProjectionSelect(params) {
      const table = requireLocalTable({
        localTableSets,
        agentId: assertNonEmptyString(params.agentId, "CMP sqlite projection agentId"),
        kind: "snapshots",
      });
      return createQueryPrimitive({
        phase: "read",
        target: `${table.schemaName}.${table.tableName}`,
        text: `SELECT * FROM ${qualifiedTableName(table.tableName)} WHERE snapshot_id = $1 LIMIT 1;`,
        values: [assertNonEmptyString(params.snapshotId, "CMP sqlite projection snapshotId")],
        metadata: {
          purpose: "projection_select",
        },
      });
    },
    buildContextPackageUpsert(record) {
      const table = requireLocalTable({
        localTableSets,
        agentId: record.sourceAgentId,
        kind: "packages",
      });
      return createQueryPrimitive({
        phase: "write",
        target: `${table.schemaName}.${table.tableName}`,
        text: `INSERT INTO ${qualifiedTableName(table.tableName)} (packages_id, project_id, agent_id, package_id, source_projection_id, target_agent_id, package_kind, fidelity_label, state, created_at, updated_at, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(package_id) DO UPDATE SET source_projection_id = excluded.source_projection_id, target_agent_id = excluded.target_agent_id, package_kind = excluded.package_kind, fidelity_label = excluded.fidelity_label, state = excluded.state, updated_at = excluded.updated_at, metadata = excluded.metadata;`,
        values: [
          record.packageId,
          input.topology.projectId,
          record.sourceAgentId,
          record.packageId,
          record.sourceProjectionId,
          record.targetAgentId,
          record.packageKind,
          record.fidelityLabel,
          record.state,
          record.createdAt,
          record.updatedAt,
          record.metadata ?? {},
        ],
        metadata: {
          purpose: "package_upsert",
        },
      });
    },
    buildContextPackageSelect(params) {
      const table = requireLocalTable({
        localTableSets,
        agentId: assertNonEmptyString(params.agentId, "CMP sqlite package agentId"),
        kind: "packages",
      });
      return createQueryPrimitive({
        phase: "read",
        target: `${table.schemaName}.${table.tableName}`,
        text: `SELECT * FROM ${qualifiedTableName(table.tableName)} WHERE package_id = $1 LIMIT 1;`,
        values: [assertNonEmptyString(params.packageId, "CMP sqlite package packageId")],
        metadata: {
          purpose: "package_select",
        },
      });
    },
    buildDeliveryUpsert(record) {
      const table = requireDeliveryRegistryTable(input.topology);
      return createQueryPrimitive({
        phase: "write",
        target: `${table.schemaName}.${table.tableName}`,
        text: `INSERT INTO ${qualifiedTableName(table.tableName)} (delivery_registry_id, project_id, source_agent_id, target_agent_id, package_id, state, updated_at, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(delivery_registry_id) DO UPDATE SET source_agent_id = excluded.source_agent_id, target_agent_id = excluded.target_agent_id, package_id = excluded.package_id, state = excluded.state, updated_at = excluded.updated_at, metadata = excluded.metadata;`,
        values: [
          record.deliveryId,
          input.topology.projectId,
          record.sourceAgentId,
          record.targetAgentId,
          record.packageId,
          record.state,
          record.acknowledgedAt ?? record.deliveredAt ?? record.createdAt,
          {
            dispatchId: record.dispatchId,
            createdAt: record.createdAt,
            deliveredAt: record.deliveredAt,
            acknowledgedAt: record.acknowledgedAt,
            ...(record.metadata ?? {}),
          },
        ],
        metadata: {
          purpose: "delivery_upsert",
        },
      });
    },
    buildDeliverySelect(params) {
      const table = requireDeliveryRegistryTable(input.topology);
      return createQueryPrimitive({
        phase: "read",
        target: `${table.schemaName}.${table.tableName}`,
        text: `SELECT * FROM ${qualifiedTableName(table.tableName)} WHERE delivery_registry_id = $1 LIMIT 1;`,
        values: [assertNonEmptyString(params.deliveryId, "CMP sqlite delivery deliveryId")],
        metadata: {
          purpose: "delivery_select",
        },
      });
    },
  };
}
