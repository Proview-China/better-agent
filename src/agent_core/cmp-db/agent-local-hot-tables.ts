import {
  CMP_DB_AGENT_LOCAL_TABLE_KINDS,
  type CmpDbColumnDefinition,
  type CmpAgentLocalTableSet,
  type CmpDbAgentLocalTableDefinition,
  type CmpDbIndexDefinition,
  sanitizeSqlIdentifier,
  validateCmpAgentLocalTableSet,
} from "./cmp-db-types.js";

function createAgentLocalTableColumns(
  kind: CmpDbAgentLocalTableDefinition["kind"],
): CmpDbColumnDefinition[] {
  const baseColumns: Pick<Record<string, CmpDbColumnDefinition>, "projectId" | "agentId" | "metadata" | "updatedAt"> = {
    projectId: {
      name: "project_id",
      sqlType: "text",
      description: "Owning project identity.",
    },
    agentId: {
      name: "agent_id",
      sqlType: "text",
      description: "Owning agent identity.",
    },
    metadata: {
      name: "metadata",
      sqlType: "jsonb",
      nullable: true,
      defaultExpression: "'{}'::jsonb",
      description: "Structured DB projection metadata only; never raw git truth.",
    },
    updatedAt: {
      name: "updated_at",
      sqlType: "timestamptz",
      defaultExpression: "CURRENT_TIMESTAMP",
      description: "Last DB-side update time.",
    },
  };

  switch (kind) {
    case "events":
      return [
        { name: "events_id", sqlType: "uuid", description: "Primary key." },
        baseColumns.projectId,
        baseColumns.agentId,
        { name: "event_id", sqlType: "text", description: "CMP context event identity." },
        { name: "session_id", sqlType: "text", nullable: true, description: "Optional session identity." },
        { name: "run_id", sqlType: "text", nullable: true, description: "Optional run identity." },
        { name: "kind", sqlType: "text", description: "Event kind." },
        { name: "payload_ref", sqlType: "text", description: "Payload reference only." },
        { name: "created_at", sqlType: "timestamptz", defaultExpression: "CURRENT_TIMESTAMP", description: "Event creation time." },
        baseColumns.updatedAt,
        baseColumns.metadata,
      ];
    case "snapshots":
      return [
        { name: "snapshots_id", sqlType: "uuid", description: "Primary key." },
        baseColumns.projectId,
        baseColumns.agentId,
        { name: "snapshot_id", sqlType: "text", description: "Checked snapshot identity." },
        { name: "branch_ref", sqlType: "text", description: "Linked git branch ref." },
        { name: "commit_ref", sqlType: "text", description: "Linked checked commit ref." },
        { name: "projection_state", sqlType: "text", description: "Projection lifecycle state." },
        { name: "checked_at", sqlType: "timestamptz", description: "Checker-approved time." },
        baseColumns.updatedAt,
        baseColumns.metadata,
      ];
    case "packages":
      return [
        { name: "packages_id", sqlType: "uuid", description: "Primary key." },
        baseColumns.projectId,
        baseColumns.agentId,
        { name: "package_id", sqlType: "text", description: "Context package identity." },
        { name: "source_projection_id", sqlType: "text", description: "Source projection identity." },
        { name: "target_agent_id", sqlType: "text", description: "Target agent identity." },
        { name: "package_kind", sqlType: "text", description: "Context package kind." },
        { name: "fidelity_label", sqlType: "text", description: "Delivery fidelity label." },
        { name: "state", sqlType: "text", description: "Package delivery state." },
        { name: "created_at", sqlType: "timestamptz", defaultExpression: "CURRENT_TIMESTAMP", description: "Package creation time." },
        baseColumns.updatedAt,
        baseColumns.metadata,
      ];
    case "dispatch":
      return [
        { name: "dispatch_id", sqlType: "uuid", description: "Primary key." },
        baseColumns.projectId,
        baseColumns.agentId,
        { name: "package_id", sqlType: "text", description: "Context package identity." },
        { name: "source_agent_id", sqlType: "text", description: "Source agent identity." },
        { name: "target_agent_id", sqlType: "text", description: "Target agent identity." },
        { name: "state", sqlType: "text", description: "Dispatch state." },
        { name: "created_at", sqlType: "timestamptz", defaultExpression: "CURRENT_TIMESTAMP", description: "Dispatch creation time." },
        { name: "delivered_at", sqlType: "timestamptz", nullable: true, description: "Delivery completion time." },
        { name: "acknowledged_at", sqlType: "timestamptz", nullable: true, description: "Acknowledgement completion time." },
        baseColumns.updatedAt,
        baseColumns.metadata,
      ];
  }
}

function createLocalTableDefinition(params: {
  projectId: string;
  schemaName: string;
  agentId: string;
  kind: CmpDbAgentLocalTableDefinition["kind"];
}): CmpDbAgentLocalTableDefinition {
  const projectSegment = sanitizeSqlIdentifier(params.projectId);
  const agentSegment = sanitizeSqlIdentifier(params.agentId);
  const indexes: CmpDbIndexDefinition[] = [
    {
      name: `idx_${projectSegment}_${agentSegment}_${params.kind}_updated_at`,
      columns: ["updated_at"],
    },
  ];
  if (params.kind === "events") {
    indexes.push({
      name: `uidx_${projectSegment}_${agentSegment}_${params.kind}_event_id`,
      columns: ["event_id"],
      unique: true,
    });
  }
  if (params.kind === "snapshots") {
    indexes.push({
      name: `uidx_${projectSegment}_${agentSegment}_${params.kind}_snapshot_id`,
      columns: ["snapshot_id"],
      unique: true,
    });
  }
  if (params.kind === "packages") {
    indexes.push({
      name: `uidx_${projectSegment}_${agentSegment}_${params.kind}_package_id`,
      columns: ["package_id"],
      unique: true,
    });
  }
  return {
    schemaName: params.schemaName,
    tableName: `cmp_${projectSegment}_${agentSegment}_${params.kind}`,
    agentId: params.agentId.trim(),
    kind: params.kind,
    storageEngine: "postgresql",
    ownership: "agent_local",
    primaryKey: `${params.kind}_id`,
    columns: createAgentLocalTableColumns(params.kind),
    description: `CMP agent-local ${params.kind} table for ${params.agentId}.`,
    indexes,
    metadata: {
      projectId: params.projectId,
    },
  };
}

export function createCmpAgentLocalTableSet(input: {
  projectId: string;
  schemaName?: string;
  agentId: string;
}): CmpAgentLocalTableSet {
  const schemaName = input.schemaName?.trim() || "cmp";
  const set: CmpAgentLocalTableSet = {
    projectId: input.projectId.trim(),
    schemaName,
    agentId: input.agentId.trim(),
    tables: CMP_DB_AGENT_LOCAL_TABLE_KINDS.map((kind) => createLocalTableDefinition({
      projectId: input.projectId,
      schemaName,
      agentId: input.agentId,
      kind,
    })),
  };
  validateCmpAgentLocalTableSet(set);
  return set;
}

export function getCmpAgentLocalTableByKind(params: {
  set: CmpAgentLocalTableSet;
  kind: CmpDbAgentLocalTableDefinition["kind"];
}): CmpDbAgentLocalTableDefinition | undefined {
  return params.set.tables.find((table) => table.kind === params.kind);
}

export function assertCmpAgentOwnsLocalTable(params: {
  agentId: string;
  table: CmpDbAgentLocalTableDefinition;
}): void {
  if (params.agentId !== params.table.agentId) {
    throw new Error(
      `CMP local table ${params.table.tableName} belongs to ${params.table.agentId}, not ${params.agentId}.`,
    );
  }
}
