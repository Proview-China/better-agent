import {
  CMP_DB_AGENT_LOCAL_TABLE_KINDS,
  type CmpAgentLocalTableSet,
  type CmpDbAgentLocalTableDefinition,
  sanitizeSqlIdentifier,
  validateCmpAgentLocalTableSet,
} from "./cmp-db-types.js";

function createLocalTableDefinition(params: {
  projectId: string;
  agentId: string;
  kind: CmpDbAgentLocalTableDefinition["kind"];
}): CmpDbAgentLocalTableDefinition {
  const projectSegment = sanitizeSqlIdentifier(params.projectId);
  const agentSegment = sanitizeSqlIdentifier(params.agentId);
  return {
    tableName: `cmp_${projectSegment}_${agentSegment}_${params.kind}`,
    agentId: params.agentId.trim(),
    kind: params.kind,
    ownership: "agent_local",
    primaryKey: `${params.kind}_id`,
    description: `CMP agent-local ${params.kind} table for ${params.agentId}.`,
    indexes: [
      {
        name: `idx_${projectSegment}_${agentSegment}_${params.kind}_updated_at`,
        columns: ["updated_at"],
      },
    ],
    metadata: {
      projectId: params.projectId,
    },
  };
}

export function createCmpAgentLocalTableSet(input: {
  projectId: string;
  agentId: string;
}): CmpAgentLocalTableSet {
  const set: CmpAgentLocalTableSet = {
    agentId: input.agentId.trim(),
    tables: CMP_DB_AGENT_LOCAL_TABLE_KINDS.map((kind) => createLocalTableDefinition({
      projectId: input.projectId,
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

