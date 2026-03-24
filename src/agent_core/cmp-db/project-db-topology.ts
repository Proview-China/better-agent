import {
  CMP_DB_SHARED_TABLE_KINDS,
  type CmpDbColumnDefinition,
  type CmpDbSharedTableDefinition,
  type CmpProjectDbTopology,
  sanitizeSqlIdentifier,
  validateCmpProjectDbTopology,
} from "./cmp-db-types.js";

function createBaseColumns(): {
  projectId: CmpDbColumnDefinition;
  agentId: CmpDbColumnDefinition;
  metadata: CmpDbColumnDefinition;
  updatedAt: CmpDbColumnDefinition;
} {
  return {
    projectId: {
      name: "project_id",
      sqlType: "text",
      description: "Owning project identity.",
    },
    agentId: {
      name: "agent_id",
      sqlType: "text",
      description: "Owning agent identity when applicable.",
    },
    metadata: {
      name: "metadata",
      sqlType: "jsonb",
      nullable: true,
      defaultExpression: "'{}'::jsonb",
      description: "Structured projection metadata only; never canonical git truth.",
    },
    updatedAt: {
      name: "updated_at",
      sqlType: "timestamptz",
      defaultExpression: "CURRENT_TIMESTAMP",
      description: "Last DB-side projection update time.",
    },
  };
}

function createSharedTableColumns(kind: CmpDbSharedTableDefinition["kind"]): CmpDbColumnDefinition[] {
  const base = createBaseColumns();
  switch (kind) {
    case "agent_registry":
      return [
        { name: "agent_registry_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        base.agentId,
        { name: "status", sqlType: "text", description: "Lineage registration status." },
        base.updatedAt,
        base.metadata,
      ];
    case "agent_lineage":
      return [
        { name: "agent_lineage_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        base.agentId,
        { name: "parent_agent_id", sqlType: "text", nullable: true, description: "Direct parent agent." },
        { name: "depth", sqlType: "integer", description: "Lineage depth." },
        base.updatedAt,
        base.metadata,
      ];
    case "branch_registry":
      return [
        { name: "branch_registry_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        base.agentId,
        { name: "branch_kind", sqlType: "text", description: "work/cmp/mp/tap branch family kind." },
        { name: "branch_ref", sqlType: "text", description: "Concrete git ref." },
        base.updatedAt,
        base.metadata,
      ];
    case "sync_event_registry":
      return [
        { name: "sync_event_registry_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        base.agentId,
        { name: "channel", sqlType: "text", description: "Originating sync channel." },
        { name: "direction", sqlType: "text", description: "Propagation direction." },
        { name: "object_ref", sqlType: "text", description: "Linked object reference." },
        { name: "created_at", sqlType: "timestamptz", defaultExpression: "CURRENT_TIMESTAMP", description: "Sync event creation time." },
        base.metadata,
      ];
    case "promotion_registry":
      return [
        { name: "promotion_registry_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        base.agentId,
        { name: "snapshot_id", sqlType: "text", description: "Linked checked snapshot identity." },
        { name: "promotion_state", sqlType: "text", description: "Projection promotion state." },
        base.updatedAt,
        base.metadata,
      ];
    case "delivery_registry":
      return [
        { name: "delivery_registry_id", sqlType: "uuid", description: "Primary key." },
        base.projectId,
        { name: "source_agent_id", sqlType: "text", description: "Source agent identity." },
        { name: "target_agent_id", sqlType: "text", description: "Target agent identity." },
        { name: "package_id", sqlType: "text", description: "Context package identity." },
        { name: "state", sqlType: "text", description: "Delivery lifecycle state." },
        base.updatedAt,
        base.metadata,
      ];
  }
}

function createSharedTableDefinition(params: {
  projectId: string;
  schemaName: string;
  kind: CmpDbSharedTableDefinition["kind"];
}): CmpDbSharedTableDefinition {
  const projectSegment = sanitizeSqlIdentifier(params.projectId);
  return {
    schemaName: params.schemaName,
    tableName: `cmp_${projectSegment}_${params.kind}`,
    kind: params.kind,
    storageEngine: "postgresql",
    ownership: "project_shared",
    primaryKey: `${params.kind}_id`,
    columns: createSharedTableColumns(params.kind),
    description: `CMP shared table for ${params.kind} in project ${params.projectId}.`,
    indexes: [
      {
        name: `idx_${projectSegment}_${params.kind}_updated_at`,
        columns: ["updated_at"],
      },
    ],
    metadata: {
      projectId: params.projectId,
    },
  };
}

export function createCmpProjectDbTopology(input: {
  projectId: string;
  databaseName?: string;
  schemaName?: string;
  metadata?: Record<string, unknown>;
}): CmpProjectDbTopology {
  const projectSegment = sanitizeSqlIdentifier(input.projectId);
  const schemaName = input.schemaName?.trim() || "cmp";
  const topology: CmpProjectDbTopology = {
    projectId: input.projectId.trim(),
    databaseName: input.databaseName?.trim() || `cmp_${projectSegment}`,
    schemaName,
    sharedTables: CMP_DB_SHARED_TABLE_KINDS.map((kind) => createSharedTableDefinition({
      projectId: input.projectId,
      schemaName,
      kind,
    })),
    metadata: input.metadata,
  };
  validateCmpProjectDbTopology(topology);
  return topology;
}

export function getCmpSharedTableByKind(params: {
  topology: CmpProjectDbTopology;
  kind: CmpDbSharedTableDefinition["kind"];
}): CmpDbSharedTableDefinition | undefined {
  return params.topology.sharedTables.find((table) => table.kind === params.kind);
}
