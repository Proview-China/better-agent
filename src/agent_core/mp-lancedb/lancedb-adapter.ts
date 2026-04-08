import { mkdir } from "node:fs/promises";

import {
  createMpMemoryRecord,
  type MpMemoryRecord,
} from "../mp-types/index.js";
import {
  type MpLanceArchiveMemoryInput,
  type MpLanceBootstrapPlan,
  type MpLanceBootstrapReceipt,
  type MpLanceDbAdapter,
  type MpLanceGetMemoryByIdInput,
  type MpLanceSearchHit,
  type MpLanceSearchRequest,
  type MpLanceSearchResult,
  type MpLanceUpsertMemoriesInput,
  type MpLanceUpdateMemoryInput,
} from "./lancedb-types.js";
import { createMpLanceBootstrapReceipt } from "./lancedb-bootstrap.js";

interface InMemoryMpLanceProjectState {
  projectId: string;
  tables: Set<string>;
}

interface RealMpLanceProjectState {
  projectId: string;
  rootPath: string;
  tables: Set<string>;
}

interface MpLanceStoredRow {
  memoryId: string;
  projectId: string;
  agentId: string;
  sessionId: string | null;
  scopeLevel: string;
  sessionMode: string;
  visibilityState: string;
  promotionState: string;
  lineagePathJson: string;
  branchRef: string | null;
  sourceSectionId: string | null;
  sourceStoredSectionId: string | null;
  sourceCommitRef: string | null;
  semanticGroupId: string | null;
  bodyRef: string | null;
  payloadRefsJson: string;
  tagsJson: string;
  embeddingJson: string | null;
  ancestryJson: string | null;
  createdAt: string;
  updatedAt: string;
  metadataJson: string | null;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreMemoryAgainstQuery(record: MpMemoryRecord, queryText: string): number {
  const queryTokens = new Set(tokenize(queryText));
  if (queryTokens.size === 0) {
    return 0;
  }

  const corpus = [
    record.bodyRef ?? "",
    record.semanticGroupId ?? "",
    ...record.tags,
    ...record.payloadRefs,
    typeof record.metadata?.sectionKind === "string" ? record.metadata.sectionKind : "",
    typeof record.metadata?.sectionSource === "string" ? record.metadata.sectionSource : "",
  ].join(" ");
  const corpusTokens = tokenize(corpus);
  if (corpusTokens.length === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of corpusTokens) {
    if (queryTokens.has(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.size;
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}

function serializeMpMemoryRecord(record: MpMemoryRecord): MpLanceStoredRow {
  return {
    memoryId: record.memoryId,
    projectId: record.projectId,
    agentId: record.agentId,
    sessionId: record.sessionId ?? null,
    scopeLevel: record.scopeLevel,
    sessionMode: record.sessionMode,
    visibilityState: record.visibilityState,
    promotionState: record.promotionState,
    lineagePathJson: JSON.stringify(record.lineagePath),
    branchRef: record.branchRef ?? null,
    sourceSectionId: record.sourceSectionId ?? null,
    sourceStoredSectionId: record.sourceStoredSectionId ?? null,
    sourceCommitRef: record.sourceCommitRef ?? null,
    semanticGroupId: record.semanticGroupId ?? null,
    bodyRef: record.bodyRef ?? null,
    payloadRefsJson: JSON.stringify(record.payloadRefs),
    tagsJson: JSON.stringify(record.tags),
    embeddingJson: jsonOrNull(record.embedding),
    ancestryJson: jsonOrNull(record.ancestry),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadataJson: jsonOrNull(record.metadata),
  };
}

function deserializeMpMemoryRecord(row: Record<string, unknown>): MpMemoryRecord {
  return createMpMemoryRecord({
    memoryId: String(row.memoryId ?? ""),
    projectId: String(row.projectId ?? ""),
    agentId: String(row.agentId ?? ""),
    sessionId: typeof row.sessionId === "string" && row.sessionId.length > 0 ? row.sessionId : undefined,
    scopeLevel: String(row.scopeLevel ?? "") as MpMemoryRecord["scopeLevel"],
    sessionMode: String(row.sessionMode ?? "") as MpMemoryRecord["sessionMode"],
    visibilityState: String(row.visibilityState ?? "") as MpMemoryRecord["visibilityState"],
    promotionState: String(row.promotionState ?? "") as MpMemoryRecord["promotionState"],
    lineagePath: parseJson<string[]>(typeof row.lineagePathJson === "string" ? row.lineagePathJson : null, []),
    branchRef: typeof row.branchRef === "string" && row.branchRef.length > 0 ? row.branchRef : undefined,
    sourceSectionId: typeof row.sourceSectionId === "string" && row.sourceSectionId.length > 0 ? row.sourceSectionId : undefined,
    sourceStoredSectionId: typeof row.sourceStoredSectionId === "string" && row.sourceStoredSectionId.length > 0 ? row.sourceStoredSectionId : undefined,
    sourceCommitRef: typeof row.sourceCommitRef === "string" && row.sourceCommitRef.length > 0 ? row.sourceCommitRef : undefined,
    semanticGroupId: typeof row.semanticGroupId === "string" && row.semanticGroupId.length > 0 ? row.semanticGroupId : undefined,
    bodyRef: typeof row.bodyRef === "string" && row.bodyRef.length > 0 ? row.bodyRef : undefined,
    payloadRefs: parseJson<string[]>(typeof row.payloadRefsJson === "string" ? row.payloadRefsJson : null, []),
    tags: parseJson<string[]>(typeof row.tagsJson === "string" ? row.tagsJson : null, []),
    embedding: parseJson(row.embeddingJson as string | null, undefined),
    ancestry: parseJson(row.ancestryJson as string | null, undefined),
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    metadata: parseJson<Record<string, unknown> | undefined>(row.metadataJson as string | null, undefined),
  });
}

export function createInMemoryMpLanceDbAdapter(): MpLanceDbAdapter {
  const tables = new Map<string, Map<string, MpMemoryRecord>>();
  const projectTables = new Map<string, InMemoryMpLanceProjectState>();

  function ensureTable(tableName: string): Map<string, MpMemoryRecord> {
    const normalized = assertNonEmpty(tableName, "MP Lance tableName");
    let table = tables.get(normalized);
    if (!table) {
      table = new Map<string, MpMemoryRecord>();
      tables.set(normalized, table);
    }
    return table;
  }

  return {
    bootstrap(plan: MpLanceBootstrapPlan): MpLanceBootstrapReceipt {
      for (const descriptor of plan.tableDescriptors) {
        ensureTable(descriptor.tableName);
      }

      const state: InMemoryMpLanceProjectState = {
        projectId: plan.projectId,
        tables: new Set(plan.tableDescriptors.map((descriptor) => descriptor.tableName)),
      };
      projectTables.set(plan.projectId, state);

      return createMpLanceBootstrapReceipt({
        plan,
        createdTables: [...state.tables],
      });
    },

    listProjectTables(projectId: string): string[] {
      return [...(projectTables.get(assertNonEmpty(projectId, "MP Lance projectId"))?.tables ?? [])];
    },

    upsertMemories(input: MpLanceUpsertMemoriesInput): void {
      const table = ensureTable(input.tableName);
      for (const record of input.records) {
        const normalized = createMpMemoryRecord(record);
        table.set(normalized.memoryId, normalized);
      }
    },

    getMemoryById(input: MpLanceGetMemoryByIdInput): MpMemoryRecord | undefined {
      return ensureTable(input.tableName).get(assertNonEmpty(input.memoryId, "MP Lance memoryId"));
    },

    updateMemory(input: MpLanceUpdateMemoryInput): MpMemoryRecord {
      const table = ensureTable(input.tableName);
      const normalized = createMpMemoryRecord(input.record);
      table.set(normalized.memoryId, normalized);
      return normalized;
    },

    archiveMemory(input: MpLanceArchiveMemoryInput): MpMemoryRecord | undefined {
      const table = ensureTable(input.tableName);
      const current = table.get(assertNonEmpty(input.memoryId, "MP Lance memoryId"));
      if (!current) {
        return undefined;
      }

      const archived = createMpMemoryRecord({
        ...current,
        visibilityState: "archived",
        promotionState: "archived",
        updatedAt: assertNonEmpty(input.archivedAt, "MP Lance archivedAt"),
        metadata: {
          ...(current.metadata ?? {}),
          archivedAt: input.archivedAt,
          ...(input.metadata ?? {}),
        },
      });
      table.set(archived.memoryId, archived);
      return archived;
    },

    searchMemories(input: MpLanceSearchRequest): MpLanceSearchResult {
      const tableNames = input.tableNames?.length
        ? [...new Set(input.tableNames.map((tableName) => tableName.trim()).filter(Boolean))]
        : [...(projectTables.get(assertNonEmpty(input.projectId, "MP Lance projectId"))?.tables ?? [])];
      const scopeLevels = input.scopeLevels?.length
        ? new Set(input.scopeLevels)
        : undefined;
      const hits: MpLanceSearchHit[] = [];

      for (const tableName of tableNames) {
        const table = tables.get(tableName);
        if (!table) {
          continue;
        }
        for (const record of table.values()) {
          if (record.projectId !== input.projectId) {
            continue;
          }
          if (scopeLevels && !scopeLevels.has(record.scopeLevel)) {
            continue;
          }
          if (input.agentId && record.agentId !== input.agentId && record.scopeLevel === "agent_isolated") {
            continue;
          }
          const score = scoreMemoryAgainstQuery(record, input.queryText);
          if (score <= 0) {
            continue;
          }
          hits.push({
            memoryId: record.memoryId,
            tableName,
            score,
            record,
          });
        }
      }

      hits.sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.record.memoryId.localeCompare(right.record.memoryId);
      });

      return {
        projectId: input.projectId,
        queryText: input.queryText,
        hits: hits.slice(0, input.limit ?? 10),
        metadata: input.metadata,
      };
    },
  };
}

export function createLanceDbMpLanceDbAdapter(): MpLanceDbAdapter {
  const projectTables = new Map<string, RealMpLanceProjectState>();
  const tableRoots = new Map<string, string>();
  const connectionCache = new Map<string, Promise<{
    connect: typeof import("@lancedb/lancedb").connect;
    connection: import("@lancedb/lancedb").Connection;
  }>>();

  async function loadConnection(rootPath: string) {
    const normalizedRoot = assertNonEmpty(rootPath, "MP Lance rootPath");
    let cached = connectionCache.get(normalizedRoot);
    if (!cached) {
      cached = (async () => {
        await mkdir(normalizedRoot, { recursive: true });
        const lancedb = await import("@lancedb/lancedb");
        return {
          connect: lancedb.connect,
          connection: await lancedb.connect(normalizedRoot),
        };
      })();
      connectionCache.set(normalizedRoot, cached);
    }
    return cached;
  }

  async function createEmptySchema() {
    const arrow = await import("apache-arrow");
    const {
      Schema,
      Field,
      Utf8,
    } = arrow;

    return new Schema([
      new Field("memoryId", new Utf8(), false),
      new Field("projectId", new Utf8(), false),
      new Field("agentId", new Utf8(), false),
      new Field("sessionId", new Utf8(), true),
      new Field("scopeLevel", new Utf8(), false),
      new Field("sessionMode", new Utf8(), false),
      new Field("visibilityState", new Utf8(), false),
      new Field("promotionState", new Utf8(), false),
      new Field("lineagePathJson", new Utf8(), false),
      new Field("branchRef", new Utf8(), true),
      new Field("sourceSectionId", new Utf8(), true),
      new Field("sourceStoredSectionId", new Utf8(), true),
      new Field("sourceCommitRef", new Utf8(), true),
      new Field("semanticGroupId", new Utf8(), true),
      new Field("bodyRef", new Utf8(), true),
      new Field("payloadRefsJson", new Utf8(), false),
      new Field("tagsJson", new Utf8(), false),
      new Field("embeddingJson", new Utf8(), true),
      new Field("ancestryJson", new Utf8(), true),
      new Field("createdAt", new Utf8(), false),
      new Field("updatedAt", new Utf8(), false),
      new Field("metadataJson", new Utf8(), true),
    ]);
  }

  async function openTable(tableName: string) {
    const normalized = assertNonEmpty(tableName, "MP Lance tableName");
    const rootPath = tableRoots.get(normalized);
    if (!rootPath) {
      throw new Error(`MP Lance table ${normalized} is not registered. Bootstrap the project first.`);
    }
    const { connection } = await loadConnection(rootPath);
    return connection.openTable(normalized);
  }

  return {
    async bootstrap(plan: MpLanceBootstrapPlan): Promise<MpLanceBootstrapReceipt> {
      const { connection } = await loadConnection(plan.rootPath);
      const schema = await createEmptySchema();

      for (const descriptor of plan.tableDescriptors) {
        await connection.createEmptyTable(descriptor.tableName, schema, {
          mode: "create",
          existOk: true,
        });
        tableRoots.set(descriptor.tableName, plan.rootPath);
      }

      projectTables.set(plan.projectId, {
        projectId: plan.projectId,
        rootPath: plan.rootPath,
        tables: new Set(plan.tableDescriptors.map((descriptor) => descriptor.tableName)),
      });

      return createMpLanceBootstrapReceipt({
        plan,
        createdTables: plan.tableDescriptors.map((descriptor) => descriptor.tableName),
      });
    },

    listProjectTables(projectId: string): string[] {
      return [...(projectTables.get(assertNonEmpty(projectId, "MP Lance projectId"))?.tables ?? [])];
    },

    async upsertMemories(input: MpLanceUpsertMemoriesInput): Promise<void> {
      const table = await openTable(input.tableName);
      for (const record of input.records) {
        const normalized = createMpMemoryRecord(record);
        await table.delete(`memoryId = ${sqlQuote(normalized.memoryId)}`);
        await table.add([
          serializeMpMemoryRecord(normalized) as unknown as Record<string, unknown>,
        ]);
      }
    },

    async getMemoryById(input: MpLanceGetMemoryByIdInput): Promise<MpMemoryRecord | undefined> {
      const table = await openTable(input.tableName);
      const rows = await table.query()
        .where(`memoryId = ${sqlQuote(assertNonEmpty(input.memoryId, "MP Lance memoryId"))}`)
        .toArray();
      const row = rows[0] as Record<string, unknown> | undefined;
      return row ? deserializeMpMemoryRecord(row) : undefined;
    },

    async updateMemory(input: MpLanceUpdateMemoryInput): Promise<MpMemoryRecord> {
      const normalized = createMpMemoryRecord(input.record);
      await this.upsertMemories({
        tableName: input.tableName,
        records: [normalized],
      });
      return normalized;
    },

    async archiveMemory(input: MpLanceArchiveMemoryInput): Promise<MpMemoryRecord | undefined> {
      const current = await this.getMemoryById({
        tableName: input.tableName,
        memoryId: input.memoryId,
      });
      if (!current) {
        return undefined;
      }

      const archived = createMpMemoryRecord({
        ...current,
        visibilityState: "archived",
        promotionState: "archived",
        updatedAt: assertNonEmpty(input.archivedAt, "MP Lance archivedAt"),
        metadata: {
          ...(current.metadata ?? {}),
          archivedAt: input.archivedAt,
          ...(input.metadata ?? {}),
        },
      });
      await this.upsertMemories({
        tableName: input.tableName,
        records: [archived],
      });
      return archived;
    },

    async searchMemories(input: MpLanceSearchRequest): Promise<MpLanceSearchResult> {
      const tableNames = input.tableNames?.length
        ? [...new Set(input.tableNames.map((tableName) => tableName.trim()).filter(Boolean))]
        : [...(projectTables.get(assertNonEmpty(input.projectId, "MP Lance projectId"))?.tables ?? [])];
      const scopeLevels = input.scopeLevels?.length
        ? new Set(input.scopeLevels)
        : undefined;
      const hits: MpLanceSearchHit[] = [];

      for (const tableName of tableNames) {
        const table = await openTable(tableName);
        const rows = await table.query().toArray();
        for (const raw of rows as Record<string, unknown>[]) {
          const record = deserializeMpMemoryRecord(raw);
          if (record.projectId !== input.projectId) {
            continue;
          }
          if (scopeLevels && !scopeLevels.has(record.scopeLevel)) {
            continue;
          }
          if (input.agentId && record.agentId !== input.agentId && record.scopeLevel === "agent_isolated") {
            continue;
          }
          const score = scoreMemoryAgainstQuery(record, input.queryText);
          if (score <= 0) {
            continue;
          }
          hits.push({
            memoryId: record.memoryId,
            tableName,
            score,
            record,
          });
        }
      }

      hits.sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.record.memoryId.localeCompare(right.record.memoryId);
      });

      return {
        projectId: input.projectId,
        queryText: input.queryText,
        hits: hits.slice(0, input.limit ?? 10),
        metadata: input.metadata,
      };
    },
  };
}
