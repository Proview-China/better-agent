import {
  CMP_DB_SHARED_TABLE_KINDS,
  type CmpDbSharedTableDefinition,
  type CmpProjectDbTopology,
  sanitizeSqlIdentifier,
  validateCmpProjectDbTopology,
} from "./cmp-db-types.js";

function createSharedTableDefinition(params: {
  projectId: string;
  kind: CmpDbSharedTableDefinition["kind"];
}): CmpDbSharedTableDefinition {
  const projectSegment = sanitizeSqlIdentifier(params.projectId);
  return {
    tableName: `cmp_${projectSegment}_${params.kind}`,
    kind: params.kind,
    ownership: "project_shared",
    primaryKey: `${params.kind}_id`,
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
  metadata?: Record<string, unknown>;
}): CmpProjectDbTopology {
  const projectSegment = sanitizeSqlIdentifier(input.projectId);
  const topology: CmpProjectDbTopology = {
    projectId: input.projectId.trim(),
    databaseName: input.databaseName?.trim() || `cmp_${projectSegment}`,
    sharedTables: CMP_DB_SHARED_TABLE_KINDS.map((kind) => createSharedTableDefinition({
      projectId: input.projectId,
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

