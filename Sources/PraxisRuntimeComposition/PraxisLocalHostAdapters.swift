import Foundation
import SQLite3
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif
import PraxisCapabilityResults
import PraxisCheckpoint
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisInfraContracts
import PraxisJournal
import PraxisProviderContracts
import PraxisToolingContracts
import PraxisUserIOContracts
import PraxisWorkspaceContracts

private struct PraxisLocalRuntimePaths: Sendable {
  let rootDirectory: URL
  let databaseFileURL: URL

  init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
    databaseFileURL = rootDirectory.appendingPathComponent("runtime.sqlite3", isDirectory: false)
  }

  static func resolveRootDirectory(_ explicitRootDirectory: URL?) -> URL {
    if let explicitRootDirectory {
      return explicitRootDirectory
    }

    if let configuredRoot = ProcessInfo.processInfo.environment["PRAXIS_LOCAL_RUNTIME_ROOT"],
       !configuredRoot.isEmpty {
      return URL(fileURLWithPath: configuredRoot, isDirectory: true)
    }

    return FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-runtime", isDirectory: true)
  }
}

private let sqliteTransientDestructor = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
private let localSQLiteSchemaLock = NSLock()
private let localSQLiteRuntimeSchemaVersion = 1

private struct LocalSQLiteSchemaColumnSignature: Sendable, Equatable {
  let name: String
  let declaredType: String
  let isNotNull: Bool
  let primaryKeyOrdinal: Int
}

private struct LocalSQLiteSchemaTableSpec: Sendable {
  let name: String
  let expectedColumnSignatures: [LocalSQLiteSchemaColumnSignature]

  var expectedColumnSignatureByName: [String: LocalSQLiteSchemaColumnSignature] {
    Dictionary(uniqueKeysWithValues: expectedColumnSignatures.map { ($0.name, $0) })
  }
}

private enum LocalSQLiteSchemaPolicyDecision: Sendable {
  case initializeFresh
  case adoptLegacyCurrentSchema
  case reopenCurrentSchema
  case rejectUnsupportedOlder(foundVersion: Int)
  case rejectUnsupportedFuture(foundVersion: Int)
  case rejectIncompatibleSchema(reason: String)
}

private func localSQLiteColumn(
  _ name: String,
  _ declaredType: String,
  notNull: Bool = false,
  primaryKeyOrdinal: Int = 0
) -> LocalSQLiteSchemaColumnSignature {
  LocalSQLiteSchemaColumnSignature(
    name: name,
    declaredType: declaredType,
    isNotNull: notNull,
    primaryKeyOrdinal: primaryKeyOrdinal
  )
}

private let localSQLiteCurrentSchemaTableSpecs: [LocalSQLiteSchemaTableSpec] = [
  .init(
    name: "checkpoints",
    expectedColumnSignatures: [
      localSQLiteColumn("pointer_key", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("checkpoint_id", "TEXT", notNull: true),
      localSQLiteColumn("session_id", "TEXT", notNull: true),
      localSQLiteColumn("tier", "TEXT", notNull: true),
      localSQLiteColumn("created_at", "TEXT", notNull: true),
      localSQLiteColumn("last_sequence", "INTEGER"),
      localSQLiteColumn("record_json", "TEXT", notNull: true),
      localSQLiteColumn("updated_at", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "journal_events",
    expectedColumnSignatures: [
      localSQLiteColumn("sequence", "INTEGER", primaryKeyOrdinal: 1),
      localSQLiteColumn("session_id", "TEXT", notNull: true),
      localSQLiteColumn("run_reference", "TEXT"),
      localSQLiteColumn("correlation_id", "TEXT"),
      localSQLiteColumn("type", "TEXT", notNull: true),
      localSQLiteColumn("summary", "TEXT", notNull: true),
      localSQLiteColumn("metadata_json", "TEXT"),
    ]
  ),
  .init(
    name: "projections",
    expectedColumnSignatures: [
      localSQLiteColumn("project_id", "TEXT", notNull: true, primaryKeyOrdinal: 1),
      localSQLiteColumn("projection_id", "TEXT", notNull: true, primaryKeyOrdinal: 2),
      localSQLiteColumn("lineage_id", "TEXT"),
      localSQLiteColumn("agent_id", "TEXT"),
      localSQLiteColumn("updated_at", "TEXT"),
      localSQLiteColumn("descriptor_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "cmp_packages",
    expectedColumnSignatures: [
      localSQLiteColumn("project_id", "TEXT", notNull: true, primaryKeyOrdinal: 1),
      localSQLiteColumn("package_id", "TEXT", notNull: true, primaryKeyOrdinal: 2),
      localSQLiteColumn("source_agent_id", "TEXT", notNull: true),
      localSQLiteColumn("target_agent_id", "TEXT", notNull: true),
      localSQLiteColumn("source_snapshot_id", "TEXT"),
      localSQLiteColumn("package_kind", "TEXT", notNull: true),
      localSQLiteColumn("updated_at", "TEXT", notNull: true),
      localSQLiteColumn("descriptor_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "cmp_controls",
    expectedColumnSignatures: [
      localSQLiteColumn("project_id", "TEXT", notNull: true, primaryKeyOrdinal: 1),
      localSQLiteColumn("agent_id", "TEXT", notNull: true, primaryKeyOrdinal: 2),
      localSQLiteColumn("updated_at", "TEXT", notNull: true),
      localSQLiteColumn("descriptor_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "cmp_peer_approvals",
    expectedColumnSignatures: [
      localSQLiteColumn("project_id", "TEXT", notNull: true, primaryKeyOrdinal: 1),
      localSQLiteColumn("agent_id", "TEXT", notNull: true, primaryKeyOrdinal: 2),
      localSQLiteColumn("target_agent_id", "TEXT", notNull: true, primaryKeyOrdinal: 3),
      localSQLiteColumn("capability_key", "TEXT", notNull: true, primaryKeyOrdinal: 4),
      localSQLiteColumn("updated_at", "TEXT", notNull: true),
      localSQLiteColumn("descriptor_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "tap_runtime_events",
    expectedColumnSignatures: [
      localSQLiteColumn("event_id", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("project_id", "TEXT", notNull: true),
      localSQLiteColumn("agent_id", "TEXT", notNull: true),
      localSQLiteColumn("target_agent_id", "TEXT"),
      localSQLiteColumn("event_kind", "TEXT", notNull: true),
      localSQLiteColumn("capability_key", "TEXT"),
      localSQLiteColumn("created_at", "TEXT", notNull: true),
      localSQLiteColumn("record_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "delivery_truth",
    expectedColumnSignatures: [
      localSQLiteColumn("delivery_id", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("package_id", "TEXT"),
      localSQLiteColumn("topic", "TEXT", notNull: true),
      localSQLiteColumn("target_agent_id", "TEXT"),
      localSQLiteColumn("status", "TEXT", notNull: true),
      localSQLiteColumn("updated_at", "TEXT", notNull: true),
      localSQLiteColumn("record_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "embeddings",
    expectedColumnSignatures: [
      localSQLiteColumn("embedding_id", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("storage_key", "TEXT", notNull: true),
      localSQLiteColumn("record_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "semantic_memory",
    expectedColumnSignatures: [
      localSQLiteColumn("memory_id", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("project_id", "TEXT", notNull: true),
      localSQLiteColumn("agent_id", "TEXT", notNull: true),
      localSQLiteColumn("scope_level", "TEXT", notNull: true),
      localSQLiteColumn("freshness_status", "TEXT", notNull: true),
      localSQLiteColumn("summary", "TEXT", notNull: true),
      localSQLiteColumn("storage_key", "TEXT", notNull: true),
      localSQLiteColumn("record_json", "TEXT", notNull: true),
    ]
  ),
  .init(
    name: "lineages",
    expectedColumnSignatures: [
      localSQLiteColumn("lineage_id", "TEXT", primaryKeyOrdinal: 1),
      localSQLiteColumn("branch_ref", "TEXT", notNull: true),
      localSQLiteColumn("parent_lineage_id", "TEXT"),
      localSQLiteColumn("descriptor_json", "TEXT", notNull: true),
    ]
  ),
]

private func localRuntimeEncodeJSON<Value: Encodable>(_ value: Value) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  let data = try encoder.encode(value)
  guard let string = String(data: data, encoding: .utf8) else {
    throw PraxisError.invariantViolation("Failed to encode local runtime SQLite payload as UTF-8 JSON.")
  }
  return string
}

private func localRuntimeDecodeJSON<Value: Decodable>(_ type: Value.Type, from string: String) throws -> Value {
  guard let data = string.data(using: .utf8) else {
    throw PraxisError.invalidInput("Local runtime SQLite payload is not valid UTF-8 JSON.")
  }
  return try JSONDecoder().decode(type, from: data)
}

private func localSQLiteErrorMessage(_ database: OpaquePointer?) -> String {
  guard let database, let messagePointer = sqlite3_errmsg(database) else {
    return "Unknown SQLite error."
  }
  return String(cString: messagePointer)
}

private func localSQLiteBindText(
  _ value: String?,
  at index: Int32,
  in statement: OpaquePointer?,
  database: OpaquePointer?
) throws {
  let code: Int32
  if let value {
    code = sqlite3_bind_text(statement, index, value, -1, sqliteTransientDestructor)
  } else {
    code = sqlite3_bind_null(statement, index)
  }
  guard code == SQLITE_OK else {
    throw PraxisError.invariantViolation("Failed to bind SQLite text value: \(localSQLiteErrorMessage(database)).")
  }
}

private func localSQLiteBindInteger(
  _ value: Int?,
  at index: Int32,
  in statement: OpaquePointer?,
  database: OpaquePointer?
) throws {
  let code: Int32
  if let value {
    code = sqlite3_bind_int64(statement, index, sqlite3_int64(value))
  } else {
    code = sqlite3_bind_null(statement, index)
  }
  guard code == SQLITE_OK else {
    throw PraxisError.invariantViolation("Failed to bind SQLite integer value: \(localSQLiteErrorMessage(database)).")
  }
}

private func localSQLitePrepareStatement(
  _ sql: String,
  database: OpaquePointer?
) throws -> OpaquePointer? {
  var statement: OpaquePointer?
  let code = sqlite3_prepare_v2(database, sql, -1, &statement, nil)
  guard code == SQLITE_OK else {
    throw PraxisError.invariantViolation("Failed to prepare SQLite statement: \(localSQLiteErrorMessage(database)). SQL: \(sql)")
  }
  return statement
}

private func localSQLiteExecute(
  _ sql: String,
  database: OpaquePointer?
) throws {
  let code = sqlite3_exec(database, sql, nil, nil, nil)
  guard code == SQLITE_OK else {
    throw PraxisError.invariantViolation("Failed to execute SQLite statement: \(localSQLiteErrorMessage(database)). SQL: \(sql)")
  }
}

private func localSQLiteText(
  from statement: OpaquePointer?,
  at index: Int32
) -> String? {
  guard let value = sqlite3_column_text(statement, index) else {
    return nil
  }
  return String(cString: value)
}

private func localSQLiteInteger(
  from statement: OpaquePointer?,
  at index: Int32
) -> Int? {
  guard sqlite3_column_type(statement, index) != SQLITE_NULL else {
    return nil
  }
  return Int(sqlite3_column_int64(statement, index))
}

private func localSQLiteReadUserVersion(database: OpaquePointer?) throws -> Int {
  let statement = try localSQLitePrepareStatement("PRAGMA user_version;", database: database)
  defer { sqlite3_finalize(statement) }
  switch sqlite3_step(statement) {
  case SQLITE_ROW:
    return Int(sqlite3_column_int64(statement, 0))
  case SQLITE_DONE:
    return 0
  default:
    throw PraxisError.invariantViolation("Failed to read local runtime SQLite schema version: \(localSQLiteErrorMessage(database)).")
  }
}

private func localSQLiteWriteUserVersion(
  _ version: Int,
  database: OpaquePointer?
) throws {
  try localSQLiteExecute("PRAGMA user_version = \(version);", database: database)
}

private func localSQLiteUserTableNames(database: OpaquePointer?) throws -> Set<String> {
  let statement = try localSQLitePrepareStatement(
    """
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%';
    """,
    database: database
  )
  defer { sqlite3_finalize(statement) }

  var tableNames: Set<String> = []
  while true {
    let code = sqlite3_step(statement)
    switch code {
    case SQLITE_ROW:
      guard let tableName = localSQLiteText(from: statement, at: 0) else {
        continue
      }
      tableNames.insert(tableName)
    case SQLITE_DONE:
      return tableNames
    default:
      throw PraxisError.invariantViolation("Failed to inspect local runtime SQLite tables: \(localSQLiteErrorMessage(database)).")
    }
  }
}

private func localSQLiteNormalizeDeclaredType(_ declaredType: String?) -> String {
  declaredType?
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .uppercased() ?? ""
}

private func localSQLiteColumnSignatures(
  in tableName: String,
  database: OpaquePointer?
) throws -> [String: LocalSQLiteSchemaColumnSignature] {
  let statement = try localSQLitePrepareStatement(
    "PRAGMA table_info(\(tableName));",
    database: database
  )
  defer { sqlite3_finalize(statement) }

  var signatures: [String: LocalSQLiteSchemaColumnSignature] = [:]
  while true {
    let code = sqlite3_step(statement)
    switch code {
    case SQLITE_ROW:
      guard let columnName = localSQLiteText(from: statement, at: 1) else {
        continue
      }
      signatures[columnName] = LocalSQLiteSchemaColumnSignature(
        name: columnName,
        declaredType: localSQLiteNormalizeDeclaredType(localSQLiteText(from: statement, at: 2)),
        isNotNull: (localSQLiteInteger(from: statement, at: 3) ?? 0) != 0,
        primaryKeyOrdinal: localSQLiteInteger(from: statement, at: 5) ?? 0
      )
    case SQLITE_DONE:
      return signatures
    default:
      throw PraxisError.invariantViolation("Failed to inspect local runtime SQLite column signatures for \(tableName): \(localSQLiteErrorMessage(database)).")
    }
  }
}

private let localSQLiteManagedExactTableNames = Set(localSQLiteCurrentSchemaTableSpecs.map(\.name))
private let localSQLiteManagedTablePrefixes = ["cmp_", "tap_"]

private func localSQLiteIsManagedTableName(_ tableName: String) -> Bool {
  if localSQLiteManagedExactTableNames.contains(tableName) {
    return true
  }

  return localSQLiteManagedTablePrefixes.contains { tableName.hasPrefix($0) }
}

private func localSQLiteMatchesCurrentRuntimeSchema(
  database: OpaquePointer?,
  allowMissingManagedTables: Bool
) throws -> Bool {
  let tableNames = try localSQLiteUserTableNames(database: database)
  let managedTableNames = Set(tableNames.filter(localSQLiteIsManagedTableName))
  guard managedTableNames.isSubset(of: localSQLiteManagedExactTableNames) else {
    return false
  }

  if !allowMissingManagedTables,
     managedTableNames != localSQLiteManagedExactTableNames {
    return false
  }

  let tableSpecsByName = Dictionary(uniqueKeysWithValues: localSQLiteCurrentSchemaTableSpecs.map { ($0.name, $0) })
  for tableName in managedTableNames {
    guard let table = tableSpecsByName[tableName] else {
      return false
    }

    let columnSignatures = try localSQLiteColumnSignatures(in: tableName, database: database)
    guard columnSignatures == table.expectedColumnSignatureByName else {
      return false
    }
  }

  return true
}

private func localSQLiteApplyCurrentSchemaArtifacts(database: OpaquePointer?) throws {
  let statements = [
    """
    CREATE TABLE IF NOT EXISTS checkpoints (
      pointer_key TEXT PRIMARY KEY,
      checkpoint_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_sequence INTEGER,
      record_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      run_reference TEXT,
      correlation_id TEXT,
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_journal_events_session_sequence ON journal_events(session_id, sequence);",
    "CREATE INDEX IF NOT EXISTS idx_journal_events_session_run_sequence ON journal_events(session_id, run_reference, sequence);",
    """
    CREATE TABLE IF NOT EXISTS projections (
      project_id TEXT NOT NULL,
      projection_id TEXT NOT NULL,
      lineage_id TEXT,
      agent_id TEXT,
      updated_at TEXT,
      descriptor_json TEXT NOT NULL,
      PRIMARY KEY (project_id, projection_id)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_projections_project_updated_at ON projections(project_id, updated_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS cmp_packages (
      project_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      source_agent_id TEXT NOT NULL,
      target_agent_id TEXT NOT NULL,
      source_snapshot_id TEXT,
      package_kind TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      descriptor_json TEXT NOT NULL,
      PRIMARY KEY (project_id, package_id)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_cmp_packages_project_updated_at ON cmp_packages(project_id, updated_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS cmp_controls (
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      descriptor_json TEXT NOT NULL,
      PRIMARY KEY (project_id, agent_id)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_cmp_controls_project_updated_at ON cmp_controls(project_id, updated_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS cmp_peer_approvals (
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      target_agent_id TEXT NOT NULL,
      capability_key TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      descriptor_json TEXT NOT NULL,
      PRIMARY KEY (project_id, agent_id, target_agent_id, capability_key)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_cmp_peer_approvals_project_updated_at ON cmp_peer_approvals(project_id, updated_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS tap_runtime_events (
      event_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      target_agent_id TEXT,
      event_kind TEXT NOT NULL,
      capability_key TEXT,
      created_at TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_tap_runtime_events_project_created_at ON tap_runtime_events(project_id, created_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS delivery_truth (
      delivery_id TEXT PRIMARY KEY,
      package_id TEXT,
      topic TEXT NOT NULL,
      target_agent_id TEXT,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_delivery_truth_topic_updated_at ON delivery_truth(topic, updated_at DESC);",
    """
    CREATE TABLE IF NOT EXISTS embeddings (
      embedding_id TEXT PRIMARY KEY,
      storage_key TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS semantic_memory (
      memory_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      scope_level TEXT NOT NULL,
      freshness_status TEXT NOT NULL,
      summary TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_semantic_memory_project_id ON semantic_memory(project_id);",
    """
    CREATE TABLE IF NOT EXISTS lineages (
      lineage_id TEXT PRIMARY KEY,
      branch_ref TEXT NOT NULL,
      parent_lineage_id TEXT,
      descriptor_json TEXT NOT NULL
    );
    """
  ]

  for statement in statements {
    try localSQLiteExecute(statement, database: database)
  }
}

private func localSQLiteInitializeFreshSchema(database: OpaquePointer?) throws {
  try localSQLiteExecute("BEGIN IMMEDIATE TRANSACTION;", database: database)
  do {
    try localSQLiteApplyCurrentSchemaArtifacts(database: database)
    try localSQLiteWriteUserVersion(localSQLiteRuntimeSchemaVersion, database: database)
    try localSQLiteExecute("COMMIT;", database: database)
  } catch {
    try? localSQLiteExecute("ROLLBACK;", database: database)
    throw error
  }
}

private func localSQLiteAdoptLegacyCurrentSchema(database: OpaquePointer?) throws {
  try localSQLiteExecute("BEGIN IMMEDIATE TRANSACTION;", database: database)
  do {
    try localSQLiteApplyCurrentSchemaArtifacts(database: database)
    try localSQLiteWriteUserVersion(localSQLiteRuntimeSchemaVersion, database: database)
    try localSQLiteExecute("COMMIT;", database: database)
  } catch {
    try? localSQLiteExecute("ROLLBACK;", database: database)
    throw error
  }
}

private func localSQLiteResolveSchemaPolicyDecision(
  database: OpaquePointer?
) throws -> LocalSQLiteSchemaPolicyDecision {
  let schemaVersion = try localSQLiteReadUserVersion(database: database)
  let tableNames = try localSQLiteUserTableNames(database: database)

  switch schemaVersion {
  case 0 where tableNames.isEmpty:
    return .initializeFresh
  case 0:
    guard try localSQLiteMatchesCurrentRuntimeSchema(
      database: database,
      allowMissingManagedTables: true
    ) else {
      return .rejectIncompatibleSchema(
        reason: "Local runtime SQLite schema is unversioned and does not satisfy the current baseline adoption policy."
      )
    }
    return .adoptLegacyCurrentSchema
  case localSQLiteRuntimeSchemaVersion:
    guard try localSQLiteMatchesCurrentRuntimeSchema(
      database: database,
      allowMissingManagedTables: false
    ) else {
      return .rejectIncompatibleSchema(
        reason: "Local runtime SQLite schema version \(localSQLiteRuntimeSchemaVersion) does not satisfy the current baseline policy."
      )
    }
    return .reopenCurrentSchema
  case let version where version > localSQLiteRuntimeSchemaVersion:
    return .rejectUnsupportedFuture(foundVersion: version)
  default:
    return .rejectUnsupportedOlder(foundVersion: schemaVersion)
  }
}

private func localSQLiteEnsureSchema(database: OpaquePointer?) throws {
  switch try localSQLiteResolveSchemaPolicyDecision(database: database) {
  case .initializeFresh:
    try localSQLiteInitializeFreshSchema(database: database)
  case .adoptLegacyCurrentSchema:
    try localSQLiteAdoptLegacyCurrentSchema(database: database)
  case .reopenCurrentSchema:
    try localSQLiteApplyCurrentSchemaArtifacts(database: database)
  case let .rejectUnsupportedOlder(foundVersion):
    throw PraxisError.invariantViolation(
      "Local runtime SQLite schema version \(foundVersion) is older than supported version \(localSQLiteRuntimeSchemaVersion), and no migration path is available."
    )
  case let .rejectUnsupportedFuture(foundVersion):
    throw PraxisError.invariantViolation(
      "Local runtime SQLite schema version \(foundVersion) is newer than supported version \(localSQLiteRuntimeSchemaVersion). Refusing to open this runtime store."
    )
  case let .rejectIncompatibleSchema(reason):
    throw PraxisError.invariantViolation(reason)
  }
}

private func withLocalSQLiteDatabase<Result>(
  at fileURL: URL,
  _ body: (OpaquePointer?) throws -> Result
) throws -> Result {
  try FileManager.default.createDirectory(
    at: fileURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )

  var database: OpaquePointer?
  let openCode = sqlite3_open_v2(
    fileURL.path,
    &database,
    SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
    nil
  )
  guard openCode == SQLITE_OK else {
    defer { sqlite3_close(database) }
    throw PraxisError.invariantViolation("Failed to open local runtime SQLite database at \(fileURL.path): \(localSQLiteErrorMessage(database))")
  }

  defer { sqlite3_close(database) }
  sqlite3_busy_timeout(database, 2_000)
  localSQLiteSchemaLock.lock()
  defer { localSQLiteSchemaLock.unlock() }
  try localSQLiteEnsureSchema(database: database)
  return try body(database)
}

private func localRuntimeNow() -> String {
  ISO8601DateFormatter().string(from: Date())
}

private struct PraxisLocalWorkspaceContext: Sendable {
  let rootDirectory: URL

  init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory.standardizedFileURL
  }

  static func resolveRootDirectory(_ explicitRootDirectory: URL?) -> URL {
    if let explicitRootDirectory {
      return explicitRootDirectory
    }

    if let configuredRoot = ProcessInfo.processInfo.environment["PRAXIS_WORKSPACE_ROOT"],
       !configuredRoot.isEmpty {
      return URL(fileURLWithPath: configuredRoot, isDirectory: true)
    }

    return URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
  }

  func resolvePath(_ path: String) throws -> URL {
    let candidate: URL
    if path.hasPrefix("/") {
      candidate = URL(fileURLWithPath: path, isDirectory: false)
    } else {
      candidate = rootDirectory.appendingPathComponent(path, isDirectory: false)
    }
    let standardized = candidate.standardizedFileURL
    let rootPath = rootDirectory.path
    let candidatePath = standardized.path
    guard candidatePath == rootPath || candidatePath.hasPrefix(rootPath + "/") else {
      throw PraxisError.invalidInput("Workspace path \(path) escapes the configured local workspace root.")
    }
    return standardized
  }
}

private func localWorkspaceNormalizedLines(from content: String) -> [String] {
  guard !content.isEmpty else {
    return []
  }

  var lines = content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
  if content.hasSuffix("\n"), lines.last == "" {
    lines.removeLast()
  }
  return lines
}

private func localWorkspaceSlice(content: String, range: PraxisWorkspaceLineRange?) -> String {
  guard let range else {
    return content
  }

  let lines = localWorkspaceNormalizedLines(from: content)
  guard !lines.isEmpty else {
    return ""
  }

  let startIndex = max(range.startLine - 1, 0)
  let endIndex = min(range.endLine - 1, lines.count - 1)
  guard startIndex <= endIndex, startIndex < lines.count else {
    return ""
  }

  return lines[startIndex...endIndex].joined(separator: "\n")
}

private func localWorkspaceRevisionToken(for fileURL: URL) -> String? {
  guard let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path) else {
    return nil
  }
  let modificationDate = (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
  let fileSize = (attributes[.size] as? NSNumber)?.int64Value ?? 0
  return "\(Int64(modificationDate * 1000))-\(fileSize)"
}

private func localWorkspaceMatchesFilePattern(_ path: String, filePattern: String?) -> Bool {
  guard let filePattern, !filePattern.isEmpty else {
    return true
  }

  let escaped = NSRegularExpression.escapedPattern(for: filePattern)
    .replacingOccurrences(of: "\\*", with: ".*")
    .replacingOccurrences(of: "\\?", with: ".")
  guard let regex = try? NSRegularExpression(pattern: "^\(escaped)$", options: [.caseInsensitive]) else {
    return path == filePattern
  }
  let range = NSRange(path.startIndex..<path.endIndex, in: path)
  return regex.firstMatch(in: path, options: [], range: range) != nil
}

private func localWorkspaceRoots(
  for requestRoots: [String],
  context: PraxisLocalWorkspaceContext
) -> [URL] {
  let roots = requestRoots.isEmpty ? [context.rootDirectory.path] : requestRoots
  var resolvedRoots: [URL] = []
  for root in roots {
    if let resolved = try? context.resolvePath(root), !resolvedRoots.contains(resolved) {
      resolvedRoots.append(resolved)
    }
  }
  return resolvedRoots.isEmpty ? [context.rootDirectory] : resolvedRoots
}

private func localWorkspaceCandidateFiles(
  for request: PraxisWorkspaceSearchRequest,
  context: PraxisLocalWorkspaceContext
) -> [URL] {
  let fileManager = FileManager.default
  let ignoredDirectories = Set([".git", ".build", "node_modules"])
  let roots = localWorkspaceRoots(for: request.roots, context: context)
  var fileURLs: [URL] = []

  for root in roots {
    var isDirectory: ObjCBool = false
    guard fileManager.fileExists(atPath: root.path, isDirectory: &isDirectory) else {
      continue
    }

    if !isDirectory.boolValue {
      if localWorkspaceMatchesFilePattern(root.lastPathComponent, filePattern: request.filePattern) {
        fileURLs.append(root)
      }
      continue
    }

    guard let enumerator = fileManager.enumerator(
      at: root,
      includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
      options: [.skipsHiddenFiles]
    ) else {
      continue
    }

    for case let fileURL as URL in enumerator {
      if ignoredDirectories.contains(fileURL.lastPathComponent) {
        enumerator.skipDescendants()
        continue
      }
      let values = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
      guard values?.isRegularFile == true else {
        continue
      }
      if let fileSize = values?.fileSize, fileSize > 1_000_000 {
        continue
      }
      if localWorkspaceMatchesFilePattern(fileURL.lastPathComponent, filePattern: request.filePattern) {
        fileURLs.append(fileURL)
      }
    }
  }

  return fileURLs
}

private func localWorkspaceReadText(at fileURL: URL) -> String? {
  guard let data = try? Data(contentsOf: fileURL) else {
    return nil
  }
  return String(data: data, encoding: .utf8)
}

private func localWorkspaceRelativePath(for fileURL: URL, workspaceRoot: URL) -> String {
  let rootComponents = workspaceRoot.standardizedFileURL.pathComponents
  let fileComponents = fileURL.standardizedFileURL.pathComponents
  guard fileComponents.starts(with: rootComponents) else {
    return fileURL.path
  }

  let relativeComponents = Array(fileComponents.dropFirst(rootComponents.count))
  guard !relativeComponents.isEmpty else {
    return fileURL.lastPathComponent
  }
  return NSString.path(withComponents: relativeComponents)
}

private func localWorkspaceSearchMatch(
  for fileURL: URL,
  content: String,
  query: String,
  workspaceRoot: URL
) -> PraxisWorkspaceSearchMatch? {
  let lines = localWorkspaceNormalizedLines(from: content)
  guard let lineIndex = lines.firstIndex(where: { $0.localizedCaseInsensitiveContains(query) }) else {
    return nil
  }

  let line = lines[lineIndex]
  let lowercasedLine = line.lowercased()
  let lowercasedQuery = query.lowercased()
  let column = lowercasedLine.range(of: lowercasedQuery)?.lowerBound.utf16Offset(in: lowercasedLine).advanced(by: 1)
  let relativePath = localWorkspaceRelativePath(for: fileURL, workspaceRoot: workspaceRoot)
  return PraxisWorkspaceSearchMatch(
    path: relativePath,
    line: lineIndex + 1,
    column: column,
    summary: "Matched \(query) in \(fileURL.lastPathComponent).",
    snippet: line
  )
}

public struct PraxisLocalWorkspaceReader: PraxisWorkspaceReader, Sendable {
  private let context: PraxisLocalWorkspaceContext

  public init(rootDirectory: URL) {
    self.context = PraxisLocalWorkspaceContext(rootDirectory: rootDirectory)
  }

  public func read(_ request: PraxisWorkspaceReadRequest) async throws -> PraxisWorkspaceReadResult {
    let fileURL = try context.resolvePath(request.path)
    guard let content = localWorkspaceReadText(at: fileURL) else {
      return PraxisWorkspaceReadResult(path: request.path, content: "", lineCount: 0)
    }
    let slicedContent = localWorkspaceSlice(content: content, range: request.range)
    return PraxisWorkspaceReadResult(
      path: request.path,
      content: slicedContent,
      revisionToken: request.includeRevisionToken ? localWorkspaceRevisionToken(for: fileURL) : nil,
      lineCount: localWorkspaceNormalizedLines(from: slicedContent).count
    )
  }
}

public struct PraxisLocalWorkspaceSearcher: PraxisWorkspaceSearcher, Sendable {
  private let context: PraxisLocalWorkspaceContext

  public init(rootDirectory: URL) {
    self.context = PraxisLocalWorkspaceContext(rootDirectory: rootDirectory)
  }

  public func search(_ request: PraxisWorkspaceSearchRequest) async throws -> [PraxisWorkspaceSearchMatch] {
    guard !request.query.isEmpty else {
      return []
    }

    let files = localWorkspaceCandidateFiles(for: request, context: context)
    var matches: [PraxisWorkspaceSearchMatch] = []

    for fileURL in files {
      guard matches.count < request.maxResults else {
        break
      }

      let relativePath = localWorkspaceRelativePath(for: fileURL, workspaceRoot: context.rootDirectory)

      switch request.kind {
      case .fileName:
        guard fileURL.lastPathComponent.localizedCaseInsensitiveContains(request.query) else {
          continue
        }
        matches.append(
          PraxisWorkspaceSearchMatch(
            path: relativePath,
            summary: "Matched file name \(fileURL.lastPathComponent)."
          )
        )
      case .fullText, .symbol:
        guard let content = localWorkspaceReadText(at: fileURL),
              let match = localWorkspaceSearchMatch(
                for: fileURL,
                content: content,
                query: request.query,
                workspaceRoot: context.rootDirectory
              ) else {
          continue
        }
        matches.append(match)
      }
    }

    return matches
  }
}

public actor PraxisLocalWorkspaceWriter: PraxisWorkspaceWriter {
  private let context: PraxisLocalWorkspaceContext

  public init(rootDirectory: URL) {
    self.context = PraxisLocalWorkspaceContext(rootDirectory: rootDirectory)
  }

  public func apply(_ request: PraxisWorkspaceChangeRequest) async throws -> PraxisWorkspaceChangeReceipt {
    var changedPaths: [String] = []

    for change in request.changes {
      let fileURL = try context.resolvePath(change.path)
      try validateRevisionToken(change.expectedRevisionToken, for: fileURL)

      switch change.kind {
      case .createFile, .updateFile:
        guard let content = change.content else {
          throw PraxisError.invalidInput("Workspace change \(change.kind.rawValue) requires content.")
        }
        try FileManager.default.createDirectory(
          at: fileURL.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
      case .deleteFile:
        if FileManager.default.fileExists(atPath: fileURL.path) {
          try FileManager.default.removeItem(at: fileURL)
        }
      case .applyPatch:
        throw PraxisError.unsupportedOperation("Local workspace patch application is not implemented yet.")
      }

      changedPaths.append(change.path)
    }

    return PraxisWorkspaceChangeReceipt(
      changedPaths: changedPaths,
      appliedChangeCount: changedPaths.count,
      summary: request.changeSummary
    )
  }

  private func validateRevisionToken(_ expectedRevisionToken: String?, for fileURL: URL) throws {
    guard let expectedRevisionToken else {
      return
    }
    let currentRevisionToken = localWorkspaceRevisionToken(for: fileURL)
    guard currentRevisionToken == expectedRevisionToken else {
      throw PraxisError.invariantViolation("Workspace revision token mismatch for \(fileURL.path).")
    }
  }
}

private func localCheckpointPointerKey(_ pointer: PraxisCheckpointPointer) -> String {
  "\(pointer.sessionID.rawValue)|\(pointer.checkpointID.rawValue)"
}

private func localJournalMetadataJSONString(_ metadata: [String: PraxisValue]?) throws -> String? {
  guard let metadata else {
    return nil
  }
  return try localRuntimeEncodeJSON(metadata)
}

public actor PraxisLocalCheckpointStore: PraxisCheckpointStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ record: PraxisCheckpointRecord) async throws -> PraxisCheckpointSaveReceipt {
    let recordJSON = try localRuntimeEncodeJSON(record)
    let pointerKey = localCheckpointPointerKey(record.pointer)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO checkpoints (
          pointer_key,
          checkpoint_id,
          session_id,
          tier,
          created_at,
          last_sequence,
          record_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pointer_key) DO UPDATE SET
          checkpoint_id = excluded.checkpoint_id,
          session_id = excluded.session_id,
          tier = excluded.tier,
          created_at = excluded.created_at,
          last_sequence = excluded.last_sequence,
          record_json = excluded.record_json,
          updated_at = excluded.updated_at;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(pointerKey, at: 1, in: statement, database: database)
      try localSQLiteBindText(record.pointer.checkpointID.rawValue, at: 2, in: statement, database: database)
      try localSQLiteBindText(record.pointer.sessionID.rawValue, at: 3, in: statement, database: database)
      try localSQLiteBindText(record.snapshot.tier.rawValue, at: 4, in: statement, database: database)
      try localSQLiteBindText(record.snapshot.createdAt, at: 5, in: statement, database: database)
      try localSQLiteBindInteger(record.snapshot.lastCursor?.sequence, at: 6, in: statement, database: database)
      try localSQLiteBindText(recordJSON, at: 7, in: statement, database: database)
      try localSQLiteBindText(localRuntimeNow(), at: 8, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist checkpoint record: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisCheckpointSaveReceipt(
      pointer: record.pointer,
      tier: record.snapshot.tier,
      storedAt: localRuntimeNow()
    )
  }

  public func load(pointer: PraxisCheckpointPointer) async throws -> PraxisCheckpointRecord? {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM checkpoints WHERE pointer_key = ? LIMIT 1;",
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(localCheckpointPointerKey(pointer), at: 1, in: statement, database: database)
      switch sqlite3_step(statement) {
      case SQLITE_ROW:
        guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisCheckpointRecord.self, from: recordJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to load checkpoint record: \(localSQLiteErrorMessage(database)).")
      }
    }
  }
}

public actor PraxisLocalJournalStore: PraxisJournalStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func append(_ batch: PraxisJournalRecordBatch) async throws -> PraxisJournalAppendReceipt {
    guard !batch.events.isEmpty else {
      return PraxisJournalAppendReceipt(appendedCount: 0, lastCursor: nil)
    }

    let lastSequence: Int? = try withLocalSQLiteDatabase(at: fileURL) { database in
      try localSQLiteExecute("BEGIN IMMEDIATE TRANSACTION;", database: database)
      do {
        var lastInsertedSequence: Int?
        for event in batch.events {
          let statement = try localSQLitePrepareStatement(
            """
            INSERT INTO journal_events (
              session_id,
              run_reference,
              correlation_id,
              type,
              summary,
              metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?);
            """,
            database: database
          )
          defer { sqlite3_finalize(statement) }
          try localSQLiteBindText(event.sessionID.rawValue, at: 1, in: statement, database: database)
          try localSQLiteBindText(event.runReference, at: 2, in: statement, database: database)
          try localSQLiteBindText(event.correlationID, at: 3, in: statement, database: database)
          try localSQLiteBindText(event.type, at: 4, in: statement, database: database)
          try localSQLiteBindText(event.summary, at: 5, in: statement, database: database)
          try localSQLiteBindText(try localJournalMetadataJSONString(event.metadata), at: 6, in: statement, database: database)
          guard sqlite3_step(statement) == SQLITE_DONE else {
            throw PraxisError.invariantViolation("Failed to append journal event: \(localSQLiteErrorMessage(database)).")
          }
          lastInsertedSequence = Int(sqlite3_last_insert_rowid(database))
        }
        try localSQLiteExecute("COMMIT;", database: database)
        return lastInsertedSequence
      } catch {
        try? localSQLiteExecute("ROLLBACK;", database: database)
        throw error
      }
    }

    return PraxisJournalAppendReceipt(
      appendedCount: batch.events.count,
      lastCursor: lastSequence.map(PraxisJournalCursor.init(sequence:))
    )
  }

  public func read(_ request: PraxisJournalSliceRequest) async throws -> PraxisJournalSlice {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      var clauses = ["session_id = ?"]
      if request.runReference != nil {
        clauses.append("run_reference = ?")
      }
      if request.afterCursor != nil {
        clauses.append("sequence > ?")
      }

      let statement = try localSQLitePrepareStatement(
        """
        SELECT sequence, session_id, run_reference, correlation_id, type, summary, metadata_json
        FROM journal_events
        WHERE \(clauses.joined(separator: " AND "))
        ORDER BY sequence ASC
        LIMIT ?;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }

      var bindingIndex: Int32 = 1
      try localSQLiteBindText(request.sessionID, at: bindingIndex, in: statement, database: database)
      bindingIndex += 1
      if let runReference = request.runReference {
        try localSQLiteBindText(runReference, at: bindingIndex, in: statement, database: database)
        bindingIndex += 1
      }
      if let afterSequence = request.afterCursor?.sequence {
        try localSQLiteBindInteger(afterSequence, at: bindingIndex, in: statement, database: database)
        bindingIndex += 1
      }
      try localSQLiteBindInteger(request.limit, at: bindingIndex, in: statement, database: database)

      var events: [PraxisJournalEvent] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          let metadata: [String: PraxisValue]?
          if let metadataJSON = localSQLiteText(from: statement, at: 6) {
            metadata = try localRuntimeDecodeJSON([String: PraxisValue].self, from: metadataJSON)
          } else {
            metadata = nil
          }
          events.append(
            PraxisJournalEvent(
              sequence: localSQLiteInteger(from: statement, at: 0) ?? 0,
              sessionID: .init(rawValue: localSQLiteText(from: statement, at: 1) ?? request.sessionID),
              runReference: localSQLiteText(from: statement, at: 2),
              correlationID: localSQLiteText(from: statement, at: 3),
              type: localSQLiteText(from: statement, at: 4) ?? "",
              summary: localSQLiteText(from: statement, at: 5) ?? "",
              metadata: metadata
            )
          )
        case SQLITE_DONE:
          return PraxisJournalSlice(
            events: events,
            nextCursor: events.last.map { PraxisJournalCursor(sequence: $0.sequence) }
          )
        default:
          throw PraxisError.invariantViolation("Failed to read journal events: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalProjectionStore: PraxisProjectionStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ descriptor: PraxisProjectionRecordDescriptor) async throws -> PraxisProjectionStoreWriteReceipt {
    let descriptorJSON = try localRuntimeEncodeJSON(descriptor)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO projections (
          project_id,
          projection_id,
          lineage_id,
          agent_id,
          updated_at,
          descriptor_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, projection_id) DO UPDATE SET
          lineage_id = excluded.lineage_id,
          agent_id = excluded.agent_id,
          updated_at = excluded.updated_at,
          descriptor_json = excluded.descriptor_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(descriptor.projectID, at: 1, in: statement, database: database)
      try localSQLiteBindText(descriptor.projectionID.rawValue, at: 2, in: statement, database: database)
      try localSQLiteBindText(descriptor.lineageID?.rawValue, at: 3, in: statement, database: database)
      try localSQLiteBindText(descriptor.agentID, at: 4, in: statement, database: database)
      try localSQLiteBindText(descriptor.updatedAt, at: 5, in: statement, database: database)
      try localSQLiteBindText(descriptorJSON, at: 6, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist projection descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisProjectionStoreWriteReceipt(
      projectionID: descriptor.projectionID,
      storageKey: descriptor.storageKey,
      storedAt: descriptor.updatedAt ?? localRuntimeNow()
    )
  }

  public func describe(projectId: String) async throws -> PraxisProjectionRecordDescriptor {
    let descriptors = try await describe(.init(projectID: projectId))
    guard let descriptor = descriptors.first else {
      throw PraxisCmpValidationError.invalid("Projection descriptor for project \(projectId) is missing.")
    }
    return descriptor
  }

  public func describe(_ query: PraxisProjectionDescriptorQuery) async throws -> [PraxisProjectionRecordDescriptor] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        SELECT descriptor_json
        FROM projections
        WHERE project_id = ?
        ORDER BY COALESCE(updated_at, '') DESC, projection_id ASC;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(query.projectID, at: 1, in: statement, database: database)

      var descriptors: [PraxisProjectionRecordDescriptor] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let descriptorJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          let descriptor = try localRuntimeDecodeJSON(PraxisProjectionRecordDescriptor.self, from: descriptorJSON)
          guard query.projectionID == nil || descriptor.projectionID == query.projectionID,
                query.lineageID == nil || descriptor.lineageID == query.lineageID,
                query.agentID == nil || descriptor.agentID == query.agentID else {
            continue
          }
          descriptors.append(descriptor)
        case SQLITE_DONE:
          return descriptors
        default:
          throw PraxisError.invariantViolation("Failed to read projection descriptors: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalCmpContextPackageStore: PraxisCmpContextPackageStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ descriptor: PraxisCmpContextPackageDescriptor) async throws -> PraxisCmpContextPackageStoreWriteReceipt {
    let descriptorJSON = try localRuntimeEncodeJSON(descriptor)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO cmp_packages (
          project_id,
          package_id,
          source_agent_id,
          target_agent_id,
          source_snapshot_id,
          package_kind,
          updated_at,
          descriptor_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, package_id) DO UPDATE SET
          source_agent_id = excluded.source_agent_id,
          target_agent_id = excluded.target_agent_id,
          source_snapshot_id = excluded.source_snapshot_id,
          package_kind = excluded.package_kind,
          updated_at = excluded.updated_at,
          descriptor_json = excluded.descriptor_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(descriptor.projectID, at: 1, in: statement, database: database)
      try localSQLiteBindText(descriptor.packageID.rawValue, at: 2, in: statement, database: database)
      try localSQLiteBindText(descriptor.sourceAgentID, at: 3, in: statement, database: database)
      try localSQLiteBindText(descriptor.targetAgentID, at: 4, in: statement, database: database)
      try localSQLiteBindText(descriptor.sourceSnapshotID?.rawValue, at: 5, in: statement, database: database)
      try localSQLiteBindText(descriptor.packageKind.rawValue, at: 6, in: statement, database: database)
      try localSQLiteBindText(descriptor.updatedAt, at: 7, in: statement, database: database)
      try localSQLiteBindText(descriptorJSON, at: 8, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist CMP package descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisCmpContextPackageStoreWriteReceipt(
      packageID: descriptor.packageID,
      status: descriptor.status,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpContextPackageQuery) async throws -> [PraxisCmpContextPackageDescriptor] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        SELECT descriptor_json
        FROM cmp_packages
        WHERE project_id = ?
        ORDER BY updated_at DESC, package_id ASC;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(query.projectID, at: 1, in: statement, database: database)

      var descriptors: [PraxisCmpContextPackageDescriptor] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let descriptorJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          let descriptor = try localRuntimeDecodeJSON(PraxisCmpContextPackageDescriptor.self, from: descriptorJSON)
          guard query.packageID == nil || descriptor.packageID == query.packageID,
                query.sourceAgentID == nil || descriptor.sourceAgentID == query.sourceAgentID,
                query.targetAgentID == nil || descriptor.targetAgentID == query.targetAgentID,
                query.sourceSnapshotID == nil || descriptor.sourceSnapshotID == query.sourceSnapshotID,
                query.packageKind == nil || descriptor.packageKind == query.packageKind else {
            continue
          }
          descriptors.append(descriptor)
        case SQLITE_DONE:
          return descriptors
        default:
          throw PraxisError.invariantViolation("Failed to read CMP package descriptors: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalMessageBus: PraxisMessageBusContract {
  private var publishedMessages: [PraxisPublishedMessage] = []
  private var subscriptions: [PraxisMessageSubscription] = []

  public init() {}

  public func publish(_ message: PraxisPublishedMessage) async throws -> PraxisMessagePublicationReceipt {
    publishedMessages.append(message)
    return PraxisMessagePublicationReceipt(
      messageID: message.messageID,
      topic: message.topic,
      acceptedAt: message.publishedAt ?? localRuntimeNow()
    )
  }

  public func subscribe(topic: String, consumerID: String) async throws -> PraxisMessageSubscription {
    let subscription = PraxisMessageSubscription(
      topic: topic,
      consumerID: consumerID,
      startedAt: localRuntimeNow()
    )
    subscriptions.append(subscription)
    return subscription
  }
}

public actor PraxisLocalCmpControlStore: PraxisCmpControlStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ descriptor: PraxisCmpControlDescriptor) async throws -> PraxisCmpControlStoreWriteReceipt {
    let descriptorJSON = try localRuntimeEncodeJSON(descriptor)
    let agentScope = descriptor.agentID ?? ""
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO cmp_controls (
          project_id,
          agent_id,
          updated_at,
          descriptor_json
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id, agent_id) DO UPDATE SET
          updated_at = excluded.updated_at,
          descriptor_json = excluded.descriptor_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(descriptor.projectID, at: 1, in: statement, database: database)
      try localSQLiteBindText(agentScope, at: 2, in: statement, database: database)
      try localSQLiteBindText(descriptor.updatedAt, at: 3, in: statement, database: database)
      try localSQLiteBindText(descriptorJSON, at: 4, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist CMP control descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisCmpControlStoreWriteReceipt(
      projectID: descriptor.projectID,
      agentID: descriptor.agentID,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpControlQuery) async throws -> PraxisCmpControlDescriptor? {
    let agentScope = query.agentID ?? ""
    return try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        SELECT descriptor_json
        FROM cmp_controls
        WHERE project_id = ? AND agent_id = ?
        ORDER BY updated_at DESC
        LIMIT 1;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(query.projectID, at: 1, in: statement, database: database)
      try localSQLiteBindText(agentScope, at: 2, in: statement, database: database)
      let code = sqlite3_step(statement)
      switch code {
      case SQLITE_ROW:
        guard let descriptorJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisCmpControlDescriptor.self, from: descriptorJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to read CMP control descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
  }
}

public actor PraxisLocalCmpPeerApprovalStore: PraxisCmpPeerApprovalStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ descriptor: PraxisCmpPeerApprovalDescriptor) async throws -> PraxisCmpPeerApprovalStoreWriteReceipt {
    let descriptorJSON = try localRuntimeEncodeJSON(descriptor)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO cmp_peer_approvals (
          project_id,
          agent_id,
          target_agent_id,
          capability_key,
          updated_at,
          descriptor_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, agent_id, target_agent_id, capability_key) DO UPDATE SET
          updated_at = excluded.updated_at,
          descriptor_json = excluded.descriptor_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(descriptor.projectID, at: 1, in: statement, database: database)
      try localSQLiteBindText(descriptor.agentID, at: 2, in: statement, database: database)
      try localSQLiteBindText(descriptor.targetAgentID, at: 3, in: statement, database: database)
      try localSQLiteBindText(descriptor.capabilityKey, at: 4, in: statement, database: database)
      try localSQLiteBindText(descriptor.updatedAt, at: 5, in: statement, database: database)
      try localSQLiteBindText(descriptorJSON, at: 6, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist CMP peer approval descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisCmpPeerApprovalStoreWriteReceipt(
      projectID: descriptor.projectID,
      agentID: descriptor.agentID,
      targetAgentID: descriptor.targetAgentID,
      capabilityKey: descriptor.capabilityKey,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpPeerApprovalQuery) async throws -> PraxisCmpPeerApprovalDescriptor? {
    try await describeAll(query).first
  }

  public func describeAll(_ query: PraxisCmpPeerApprovalQuery) async throws -> [PraxisCmpPeerApprovalDescriptor] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      var predicates = ["project_id = ?"]
      var bindings: [String] = [query.projectID]
      if let agentID = query.agentID {
        predicates.append("agent_id = ?")
        bindings.append(agentID)
      }
      if let targetAgentID = query.targetAgentID {
        predicates.append("target_agent_id = ?")
        bindings.append(targetAgentID)
      }
      if let capabilityKey = query.capabilityKey {
        predicates.append("capability_key = ?")
        bindings.append(capabilityKey)
      }
      let statement = try localSQLitePrepareStatement(
        """
        SELECT descriptor_json
        FROM cmp_peer_approvals
        WHERE \(predicates.joined(separator: " AND "))
        ORDER BY updated_at DESC, agent_id ASC, target_agent_id ASC, capability_key ASC
        LIMIT 200;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      for (offset, binding) in bindings.enumerated() {
        try localSQLiteBindText(binding, at: Int32(offset + 1), in: statement, database: database)
      }
      var descriptors: [PraxisCmpPeerApprovalDescriptor] = []

      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let descriptorJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          let descriptor = try localRuntimeDecodeJSON(PraxisCmpPeerApprovalDescriptor.self, from: descriptorJSON)
          descriptors.append(descriptor)
        case SQLITE_DONE:
          return descriptors
        default:
          throw PraxisError.invariantViolation("Failed to read CMP peer approval descriptor: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalTapRuntimeEventStore: PraxisTapRuntimeEventStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func append(_ record: PraxisTapRuntimeEventRecord) async throws -> PraxisTapRuntimeEventStoreWriteReceipt {
    let recordJSON = try localRuntimeEncodeJSON(record)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO tap_runtime_events (
          event_id,
          project_id,
          agent_id,
          target_agent_id,
          event_kind,
          capability_key,
          created_at,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(record.eventID, at: 1, in: statement, database: database)
      try localSQLiteBindText(record.projectID, at: 2, in: statement, database: database)
      try localSQLiteBindText(record.agentID, at: 3, in: statement, database: database)
      try localSQLiteBindText(record.targetAgentID, at: 4, in: statement, database: database)
      try localSQLiteBindText(record.eventKind.rawValue, at: 5, in: statement, database: database)
      try localSQLiteBindText(record.capabilityKey, at: 6, in: statement, database: database)
      try localSQLiteBindText(record.createdAt, at: 7, in: statement, database: database)
      try localSQLiteBindText(recordJSON, at: 8, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to append TAP runtime event: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisTapRuntimeEventStoreWriteReceipt(
      eventID: record.eventID,
      projectID: record.projectID,
      createdAt: record.createdAt
    )
  }

  public func read(_ query: PraxisTapRuntimeEventQuery) async throws -> [PraxisTapRuntimeEventRecord] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      var predicates = ["project_id = ?"]
      var textBindings: [String] = [query.projectID]
      if let agentID = query.agentID {
        predicates.append("agent_id = ?")
        textBindings.append(agentID)
      }
      if let targetAgentID = query.targetAgentID {
        predicates.append("target_agent_id = ?")
        textBindings.append(targetAgentID)
      }
      let statement = try localSQLitePrepareStatement(
        """
        SELECT record_json
        FROM tap_runtime_events
        WHERE \(predicates.joined(separator: " AND "))
        ORDER BY created_at DESC, event_id DESC
        LIMIT ?;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      let clampedLimit = max(0, min(query.limit, 200))
      for (offset, binding) in textBindings.enumerated() {
        try localSQLiteBindText(binding, at: Int32(offset + 1), in: statement, database: database)
      }
      try localSQLiteBindInteger(clampedLimit, at: Int32(textBindings.count + 1), in: statement, database: database)

      var records: [PraxisTapRuntimeEventRecord] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          let record = try localRuntimeDecodeJSON(PraxisTapRuntimeEventRecord.self, from: recordJSON)
          records.append(record)
        case SQLITE_DONE:
          return records
        default:
          throw PraxisError.invariantViolation("Failed to read TAP runtime events: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalDeliveryTruthStore: PraxisDeliveryTruthStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ record: PraxisDeliveryTruthRecord) async throws -> PraxisDeliveryTruthUpsertReceipt {
    let recordJSON = try localRuntimeEncodeJSON(record)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO delivery_truth (
          delivery_id,
          package_id,
          topic,
          target_agent_id,
          status,
          updated_at,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(delivery_id) DO UPDATE SET
          package_id = excluded.package_id,
          topic = excluded.topic,
          target_agent_id = excluded.target_agent_id,
          status = excluded.status,
          updated_at = excluded.updated_at,
          record_json = excluded.record_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(record.id, at: 1, in: statement, database: database)
      try localSQLiteBindText(record.packageID?.rawValue, at: 2, in: statement, database: database)
      try localSQLiteBindText(record.topic, at: 3, in: statement, database: database)
      try localSQLiteBindText(record.targetAgentID, at: 4, in: statement, database: database)
      try localSQLiteBindText(record.status.rawValue, at: 5, in: statement, database: database)
      try localSQLiteBindText(record.updatedAt, at: 6, in: statement, database: database)
      try localSQLiteBindText(recordJSON, at: 7, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist delivery truth record: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisDeliveryTruthUpsertReceipt(
      deliveryID: record.id,
      status: record.status,
      updatedAt: record.updatedAt
    )
  }

  public func lookup(deliveryID: String) async throws -> PraxisDeliveryTruthRecord? {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM delivery_truth WHERE delivery_id = ? LIMIT 1;",
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(deliveryID, at: 1, in: statement, database: database)
      switch sqlite3_step(statement) {
      case SQLITE_ROW:
        guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisDeliveryTruthRecord.self, from: recordJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to load delivery truth record: \(localSQLiteErrorMessage(database)).")
      }
    }
  }

  public func lookup(_ query: PraxisDeliveryTruthQuery) async throws -> [PraxisDeliveryTruthRecord] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM delivery_truth ORDER BY updated_at DESC, delivery_id ASC;",
        database: database
      )
      defer { sqlite3_finalize(statement) }

      var records: [PraxisDeliveryTruthRecord] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          let record = try localRuntimeDecodeJSON(PraxisDeliveryTruthRecord.self, from: recordJSON)
          guard query.deliveryID == nil || record.id == query.deliveryID,
                query.packageID == nil || record.packageID == query.packageID,
                query.topic == nil || record.topic == query.topic,
                query.targetAgentID == nil || record.targetAgentID == query.targetAgentID else {
            continue
          }
          records.append(record)
        case SQLITE_DONE:
          return records
        default:
          throw PraxisError.invariantViolation("Failed to read delivery truth records: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public actor PraxisLocalEmbeddingStore: PraxisEmbeddingStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ record: PraxisEmbeddingRecord) async throws -> PraxisEmbeddingStoreWriteReceipt {
    let recordJSON = try localRuntimeEncodeJSON(record)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO embeddings (embedding_id, storage_key, record_json)
        VALUES (?, ?, ?)
        ON CONFLICT(embedding_id) DO UPDATE SET
          storage_key = excluded.storage_key,
          record_json = excluded.record_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(record.id, at: 1, in: statement, database: database)
      try localSQLiteBindText(record.storageKey, at: 2, in: statement, database: database)
      try localSQLiteBindText(recordJSON, at: 3, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist embedding record: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisEmbeddingStoreWriteReceipt(embeddingID: record.id, storageKey: record.storageKey)
  }

  public func load(embeddingID: String) async throws -> PraxisEmbeddingRecord? {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM embeddings WHERE embedding_id = ? LIMIT 1;",
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(embeddingID, at: 1, in: statement, database: database)
      switch sqlite3_step(statement) {
      case SQLITE_ROW:
        guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisEmbeddingRecord.self, from: recordJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to load embedding record: \(localSQLiteErrorMessage(database)).")
      }
    }
  }
}

public actor PraxisLocalSemanticMemoryStore: PraxisSemanticMemoryStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt {
    let recordJSON = try localRuntimeEncodeJSON(record)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO semantic_memory (
          memory_id,
          project_id,
          agent_id,
          scope_level,
          freshness_status,
          summary,
          storage_key,
          record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(memory_id) DO UPDATE SET
          project_id = excluded.project_id,
          agent_id = excluded.agent_id,
          scope_level = excluded.scope_level,
          freshness_status = excluded.freshness_status,
          summary = excluded.summary,
          storage_key = excluded.storage_key,
          record_json = excluded.record_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(record.id, at: 1, in: statement, database: database)
      try localSQLiteBindText(record.projectID, at: 2, in: statement, database: database)
      try localSQLiteBindText(record.agentID, at: 3, in: statement, database: database)
      try localSQLiteBindText(record.scopeLevel.rawValue, at: 4, in: statement, database: database)
      try localSQLiteBindText(record.freshnessStatus.rawValue, at: 5, in: statement, database: database)
      try localSQLiteBindText(record.summary, at: 6, in: statement, database: database)
      try localSQLiteBindText(record.storageKey, at: 7, in: statement, database: database)
      try localSQLiteBindText(recordJSON, at: 8, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist semantic memory record: \(localSQLiteErrorMessage(database)).")
      }
    }
    return PraxisSemanticMemoryWriteReceipt(memoryID: record.id, storageKey: record.storageKey)
  }

  public func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord? {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM semantic_memory WHERE memory_id = ? LIMIT 1;",
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(memoryID, at: 1, in: statement, database: database)
      switch sqlite3_step(statement) {
      case SQLITE_ROW:
        guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisSemanticMemoryRecord.self, from: recordJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to load semantic memory record: \(localSQLiteErrorMessage(database)).")
      }
    }
  }

  public func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord] {
    let records = try loadRecords(projectID: request.projectID)
    return records
      .filter { record in
        guard record.visibilityState != .archived else {
          return false
        }
        guard request.scopeLevels.contains(record.scopeLevel) else {
          return false
        }
        if let agentID = request.agentID, record.agentID != agentID {
          return false
        }
        if let sessionID = request.sessionID,
           record.scopeLevel == .session,
           record.sessionID != sessionID {
          return false
        }
        if request.query.isEmpty {
          return true
        }
        return record.summary.localizedCaseInsensitiveContains(request.query)
      }
      .sorted { $0.id < $1.id }
      .prefix(request.limit)
      .map { $0 }
  }

  public func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle {
    let filteredRecords = try loadRecords(projectID: request.projectID).filter { record in
      guard record.visibilityState != .archived else {
        return false
      }
      guard request.scopeLevels.contains(record.scopeLevel) else {
        return false
      }
      if let agentID = request.agentID, record.agentID != agentID {
        return false
      }
      if let sessionID = request.sessionID,
         record.scopeLevel == .session,
         record.sessionID != sessionID {
        return false
      }
      if request.query.isEmpty {
        return true
      }
      return record.summary.localizedCaseInsensitiveContains(request.query)
    }

    let primaryRecords = filteredRecords
      .filter { request.includeSuperseded || $0.freshnessStatus != .superseded }
      .prefix(request.limit)
    let supportingRecords = filteredRecords
      .dropFirst(primaryRecords.count)
      .prefix(max(request.limit - primaryRecords.count, 0))
    let omittedSuperseded = request.includeSuperseded
      ? []
      : filteredRecords
        .filter { $0.freshnessStatus == .superseded }
        .map(\.id)

    return PraxisSemanticMemoryBundle(
      primaryMemoryIDs: primaryRecords.map(\.id),
      supportingMemoryIDs: supportingRecords.map(\.id),
      omittedSupersededMemoryIDs: omittedSuperseded
    )
  }

  private func loadRecords(projectID: String) throws -> [PraxisSemanticMemoryRecord] {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        SELECT record_json
        FROM semantic_memory
        WHERE project_id = ?
        ORDER BY memory_id ASC;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(projectID, at: 1, in: statement, database: database)

      var records: [PraxisSemanticMemoryRecord] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          records.append(try localRuntimeDecodeJSON(PraxisSemanticMemoryRecord.self, from: recordJSON))
        case SQLITE_DONE:
          return records
        default:
          throw PraxisError.invariantViolation("Failed to read semantic memory records: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
  }
}

public struct PraxisLocalSemanticSearchIndex: PraxisSemanticSearchIndexContract, Sendable {
  private let databaseFileURL: URL

  public init(databaseFileURL: URL) {
    self.databaseFileURL = databaseFileURL
  }

  public func search(_ request: PraxisSemanticSearchRequest) async throws -> [PraxisSemanticSearchMatch] {
    let memoryRecords = try withLocalSQLiteDatabase(at: databaseFileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT record_json FROM semantic_memory ORDER BY memory_id ASC;",
        database: database
      )
      defer { sqlite3_finalize(statement) }

      var records: [PraxisSemanticMemoryRecord] = []
      while true {
        let code = sqlite3_step(statement)
        switch code {
        case SQLITE_ROW:
          guard let recordJSON = localSQLiteText(from: statement, at: 0) else {
            continue
          }
          records.append(try localRuntimeDecodeJSON(PraxisSemanticMemoryRecord.self, from: recordJSON))
        case SQLITE_DONE:
          return records
        default:
          throw PraxisError.invariantViolation("Failed to read semantic memory search records: \(localSQLiteErrorMessage(database)).")
        }
      }
    }
    let normalizedQuery = request.query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedQuery.isEmpty else {
      return []
    }

    return memoryRecords
      .filter { record in
        if let candidateStorageKeys = request.candidateStorageKeys,
           !candidateStorageKeys.contains(record.storageKey) {
          return false
        }
        return record.summary.localizedCaseInsensitiveContains(normalizedQuery)
      }
      .map { record in
        PraxisSemanticSearchMatch(
          id: record.id,
          score: 1,
          contentSummary: record.summary,
          storageKey: record.storageKey
        )
      }
      .prefix(request.limit)
      .map { $0 }
  }
}

public actor PraxisLocalLineageStore: PraxisLineageStoreContract {
  private let fileURL: URL

  public init(fileURL: URL) {
    self.fileURL = fileURL
  }

  public func save(_ descriptor: PraxisLineageDescriptor) async throws {
    let descriptorJSON = try localRuntimeEncodeJSON(descriptor)
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        """
        INSERT INTO lineages (
          lineage_id,
          branch_ref,
          parent_lineage_id,
          descriptor_json
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(lineage_id) DO UPDATE SET
          branch_ref = excluded.branch_ref,
          parent_lineage_id = excluded.parent_lineage_id,
          descriptor_json = excluded.descriptor_json;
        """,
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(descriptor.lineageID.rawValue, at: 1, in: statement, database: database)
      try localSQLiteBindText(descriptor.branchRef, at: 2, in: statement, database: database)
      try localSQLiteBindText(descriptor.parentLineageID?.rawValue, at: 3, in: statement, database: database)
      try localSQLiteBindText(descriptorJSON, at: 4, in: statement, database: database)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw PraxisError.invariantViolation("Failed to persist lineage descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
  }

  public func describe(lineageID: PraxisCmpLineageID) async throws -> String {
    try await describe(.init(lineageID: lineageID))?.summary ?? "Unknown lineage \(lineageID.rawValue)"
  }

  public func describe(_ request: PraxisLineageLookupRequest) async throws -> PraxisLineageDescriptor? {
    try withLocalSQLiteDatabase(at: fileURL) { database in
      let statement = try localSQLitePrepareStatement(
        "SELECT descriptor_json FROM lineages WHERE lineage_id = ? LIMIT 1;",
        database: database
      )
      defer { sqlite3_finalize(statement) }
      try localSQLiteBindText(request.lineageID.rawValue, at: 1, in: statement, database: database)
      switch sqlite3_step(statement) {
      case SQLITE_ROW:
        guard let descriptorJSON = localSQLiteText(from: statement, at: 0) else {
          return nil
        }
        return try localRuntimeDecodeJSON(PraxisLineageDescriptor.self, from: descriptorJSON)
      case SQLITE_DONE:
        return nil
      default:
        throw PraxisError.invariantViolation("Failed to load lineage descriptor: \(localSQLiteErrorMessage(database)).")
      }
    }
  }
}

private final class PraxisProcessResumeGate: @unchecked Sendable {
  private let lock = NSLock()
  private var hasResumed = false

  func resume(
    continuation: CheckedContinuation<PraxisShellResult, Error>,
    with result: Result<PraxisShellResult, Error>
  ) {
    lock.lock()
    defer { lock.unlock() }
    guard !hasResumed else {
      return
    }
    hasResumed = true
    continuation.resume(with: result)
  }
}

private enum PraxisSystemGitExecutableResolver {
  static func resolve() -> String? {
    let fileManager = FileManager.default
    return PraxisLocalHostPlatformSupport.nativeGitExecutablePaths.first {
      fileManager.isExecutableFile(atPath: $0)
    }
  }
}

#if os(macOS)
private enum PraxisLocalProcessRunner {
  static func run(
    executableURL: URL,
    arguments: [String],
    currentDirectoryURL: URL? = nil,
    environment: [String: String] = [:],
    timeoutSeconds: Double? = nil
  ) async throws -> PraxisShellResult {
    let process = Process()
    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()
    let startTime = Date()
    process.executableURL = executableURL
    process.arguments = arguments
    process.currentDirectoryURL = currentDirectoryURL
    process.environment = ProcessInfo.processInfo.environment.merging(environment) { _, newValue in newValue }
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe

    return try await withCheckedThrowingContinuation { continuation in
      let resumeGate = PraxisProcessResumeGate()
      let resume: @Sendable (Result<PraxisShellResult, Error>) -> Void = { result in
        resumeGate.resume(continuation: continuation, with: result)
      }

      process.terminationHandler = { process in
        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        let stdout = String(decoding: stdoutData, as: UTF8.self)
        let stderr = String(decoding: stderrData, as: UTF8.self)
        let duration = Int(Date().timeIntervalSince(startTime) * 1000)
        let terminationReason: PraxisShellTerminationReason = switch process.terminationReason {
        case .exit:
          .exited
        case .uncaughtSignal:
          .cancelled
        @unknown default:
          .failedToLaunch
        }
        resume(
          .success(
            PraxisShellResult(
              stdout: stdout,
              stderr: stderr,
              exitCode: process.terminationStatus,
              durationMilliseconds: duration,
              terminationReason: terminationReason
            )
          )
        )
      }

      do {
        try process.run()
      } catch {
        resume(.failure(error))
        return
      }

      guard let timeoutSeconds, timeoutSeconds > 0 else {
        return
      }

      Task.detached {
        let nanoseconds = UInt64(timeoutSeconds * 1_000_000_000)
        try? await Task.sleep(nanoseconds: nanoseconds)
        guard process.isRunning else {
          return
        }
        process.terminate()
        resume(
          .success(
            PraxisShellResult(
              stdout: "",
              stderr: "Command timed out after \(timeoutSeconds) seconds.",
              exitCode: process.terminationStatus,
              durationMilliseconds: Int(Date().timeIntervalSince(startTime) * 1000),
              terminationReason: .timedOut
            )
          )
        )
      }
    }
  }
}

private struct PraxisLocalProcessHandleDescriptor {
  let processID: Int32
  let terminalStatus: PraxisLongRunningTaskStatus?
  let exitCode: Int32?
}

private enum PraxisLocalProcessHandleParser {
  static func descriptor(from identifier: String) -> PraxisLocalProcessHandleDescriptor? {
    let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return nil
    }

    let segments = trimmed.split(separator: ":").map(String.init)
    guard !segments.isEmpty else {
      return nil
    }

    let rawProcessID: String
    let metadataSegments: ArraySlice<String>
    if segments.count >= 2, segments[0] == "pid" {
      rawProcessID = segments[1]
      metadataSegments = segments.dropFirst(2)
    } else {
      rawProcessID = segments[0]
      metadataSegments = segments.dropFirst()
    }

    guard let processID = Int32(rawProcessID), processID > 0 else {
      return nil
    }

    var terminalStatus: PraxisLongRunningTaskStatus?
    var exitCode: Int32?
    for segment in metadataSegments {
      let parts = segment.split(separator: "=", maxSplits: 1).map(String.init)
      guard parts.count == 2 else {
        continue
      }
      switch parts[0] {
      case "status":
        terminalStatus = PraxisLongRunningTaskStatus(rawValue: parts[1])
      case "exit", "exitCode":
        exitCode = Int32(parts[1])
      default:
        continue
      }
    }

    return PraxisLocalProcessHandleDescriptor(
      processID: processID,
      terminalStatus: terminalStatus,
      exitCode: exitCode
    )
  }
}
#endif

private enum PraxisLocalInferenceBaseline {
  static func condensedText(from text: String, limit: Int = 160) -> String {
    let normalized = text
      .components(separatedBy: .newlines)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: " ")
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)

    guard normalized.count > limit else {
      return normalized
    }

    let endIndex = normalized.index(normalized.startIndex, offsetBy: limit)
    return normalized[..<endIndex].trimmingCharacters(in: .whitespacesAndNewlines) + "..."
  }

  static func output(for request: PraxisProviderInferenceRequest) -> PraxisNormalizedCapabilityOutput {
    let promptSummary = condensedText(from: request.prompt)
    let contextSummary = request.contextSummary.map { condensedText(from: $0, limit: 120) }
    let summary: String
    if let contextSummary, !contextSummary.isEmpty {
      summary = "Local heuristic inference prepared a response plan for: \(promptSummary). Context: \(contextSummary)."
    } else {
      summary = "Local heuristic inference prepared a response plan for: \(promptSummary)."
    }

    var structuredFields: [String: PraxisValue] = [
      "backendProfile": .string("local-runtime"),
      "inferenceMode": .string("heuristic_baseline"),
      "effectiveModel": .string(request.preferredModel ?? "local-heuristic-v1"),
      "promptSummary": .string(promptSummary),
      "promptLength": .number(Double(request.prompt.count)),
      "requiredCapabilities": .array(request.requiredCapabilities.map(PraxisValue.string))
    ]
    if let systemPrompt = request.systemPrompt, !systemPrompt.isEmpty {
      structuredFields["systemPromptSummary"] = .string(condensedText(from: systemPrompt, limit: 100))
    }
    if let contextSummary, !contextSummary.isEmpty {
      structuredFields["contextSummary"] = .string(contextSummary)
    }
    if let temperature = request.temperature {
      structuredFields["temperature"] = .number(temperature)
    }
    if !request.metadata.isEmpty {
      structuredFields["metadataKeys"] = .array(request.metadata.keys.sorted().map(PraxisValue.string))
    }

    return PraxisNormalizedCapabilityOutput(summary: summary, structuredFields: structuredFields)
  }
}

private enum PraxisLocalHostBaseline {
  static func slug(from text: String) -> String {
    let slug = text
      .lowercased()
      .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "-", options: .regularExpression)
      .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return slug.isEmpty ? "baseline" : slug
  }

  static func condensedText(from text: String, limit: Int = 120) -> String {
    PraxisLocalInferenceBaseline.condensedText(from: text, limit: limit)
  }

  static func assetReference(
    kind: String,
    label: String,
    rootDirectory: URL,
    extension fileExtension: String
  ) -> String {
    rootDirectory
      .appendingPathComponent(kind, isDirectory: true)
      .appendingPathComponent("\(slug(from: label)).\(fileExtension)", isDirectory: false)
      .path
  }
}

private enum PraxisLocalBrowserGroundingBaseline {
  static func slug(from text: String) -> String {
    let slug = text
      .lowercased()
      .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "-", options: .regularExpression)
      .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return slug.isEmpty ? "grounding" : slug
  }

  static func pageTitle(from url: URL) -> String {
    if let host = url.host, !host.isEmpty {
      return host + (url.path.isEmpty ? "" : url.path)
    }
    return url.absoluteString
  }

  static func factValue(named factName: String, for url: URL) -> String? {
    let normalized = factName.lowercased()
    if normalized.contains("url") {
      return url.absoluteString
    }
    if normalized.contains("host") || normalized.contains("domain") {
      return url.host
    }
    if normalized.contains("path") {
      return url.path.isEmpty ? "/" : url.path
    }
    if normalized.contains("title") {
      return pageTitle(from: url)
    }
    return nil
  }
}

private enum PraxisLocalBrowserArtifactWriter {
  static func writeSnapshot(
    at path: String,
    lines: [String]
  ) throws {
    let snapshotURL = URL(fileURLWithPath: path, isDirectory: false)
    let snapshotDirectory = snapshotURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: snapshotDirectory, withIntermediateDirectories: true)
    let snapshotBody = lines.joined(separator: "\n") + "\n"
    try snapshotBody.write(to: snapshotURL, atomically: true, encoding: .utf8)
  }
}

public struct PraxisLocalProviderInferenceExecutor: PraxisProviderInferenceExecutor, Sendable {
  public init() {}

  public func infer(_ request: PraxisProviderInferenceRequest) async throws -> PraxisProviderInferenceResponse {
    PraxisProviderInferenceResponse(
      output: PraxisLocalInferenceBaseline.output(for: request),
      receipt: PraxisHostCapabilityReceipt(
        capabilityKey: "provider.infer",
        backend: "local-runtime",
        status: .succeeded,
        completedAt: localRuntimeNow(),
        summary: "Local heuristic inference baseline executed without an external provider dependency."
      )
    )
  }
}

public struct PraxisLocalCapabilityExecutor: PraxisCapabilityExecutor, Sendable {
  public init() {}

  public func execute(_ request: PraxisHostCapabilityRequest) async throws -> PraxisHostCapabilityReceipt {
    PraxisHostCapabilityReceipt(
      capabilityKey: request.capabilityKey,
      backend: "local-runtime",
      status: .succeeded,
      providerOperationID: "local-capability:\(PraxisLocalHostBaseline.slug(from: request.capabilityKey))",
      completedAt: localRuntimeNow(),
      summary: "Local host capability baseline executed \(request.capabilityKey) for \(PraxisLocalHostBaseline.condensedText(from: request.payloadSummary))."
    )
  }
}

public struct PraxisLocalProviderEmbeddingExecutor: PraxisProviderEmbeddingExecutor, Sendable {
  public init() {}

  public func embed(_ request: PraxisProviderEmbeddingRequest) async throws -> PraxisProviderEmbeddingResponse {
    let tokenLikeCount = request.content
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .split(whereSeparator: \.isWhitespace)
      .count
    return PraxisProviderEmbeddingResponse(
      vectorLength: max(tokenLikeCount, 1),
      model: request.preferredModel ?? "local-embedding-v1"
    )
  }
}

public actor PraxisLocalProviderFileStore: PraxisProviderFileStore {
  private let rootDirectory: URL
  private var requests: [PraxisProviderFileUploadRequest] = []

  public init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
  }

  public func upload(_ request: PraxisProviderFileUploadRequest) async throws -> PraxisProviderFileUploadReceipt {
    requests.append(request)
    return PraxisProviderFileUploadReceipt(
      fileID: PraxisLocalHostBaseline.assetReference(
        kind: "provider-files",
        label: request.summary,
        rootDirectory: rootDirectory,
        extension: "json"
      ),
      backend: "local-runtime"
    )
  }

  public func allRequests() async -> [PraxisProviderFileUploadRequest] {
    requests
  }
}

public actor PraxisLocalProviderBatchExecutor: PraxisProviderBatchExecutor {
  private var requests: [PraxisProviderBatchRequest] = []

  public init() {}

  public func enqueue(_ request: PraxisProviderBatchRequest) async throws -> PraxisProviderBatchReceipt {
    requests.append(request)
    return PraxisProviderBatchReceipt(batchID: "local-batch-\(requests.count)", backend: "local-runtime")
  }

  public func allRequests() async -> [PraxisProviderBatchRequest] {
    requests
  }
}

public struct PraxisLocalProviderSkillRegistry: PraxisProviderSkillRegistry, Sendable {
  public let skillKeys: [String]

  public init(skillKeys: [String] = [
    "runtime.inspect",
    "workspace.read",
    "tool.git",
    "provider.infer",
    "browser.ground"
  ]) {
    self.skillKeys = skillKeys
  }

  public func listSkillKeys() async throws -> [String] {
    skillKeys
  }
}

public actor PraxisLocalProviderSkillActivator: PraxisProviderSkillActivator {
  private var requests: [PraxisProviderSkillActivationRequest] = []

  public init() {}

  public func activate(_ request: PraxisProviderSkillActivationRequest) async throws -> PraxisProviderSkillActivationReceipt {
    requests.append(request)
    return PraxisProviderSkillActivationReceipt(
      skillKey: request.skillKey,
      activated: !request.skillKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    )
  }

  public func allRequests() async -> [PraxisProviderSkillActivationRequest] {
    requests
  }
}

public struct PraxisLocalBrowserGroundingCollector: PraxisBrowserGroundingCollector, Sendable {
  public let rootDirectory: URL

  public init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
  }

  public func collectEvidence(_ request: PraxisBrowserGroundingRequest) async throws -> PraxisBrowserGroundingEvidenceBundle {
    let generatedAt = localRuntimeNow()
    guard let exampleURL = request.exampleURL,
          let url = URL(string: exampleURL) else {
      let blockedFacts = request.requestedFacts.map {
        PraxisBrowserGroundingFactEvidence(
          name: $0,
          status: .blocked,
          detail: "Local browser grounding baseline requires a valid example URL."
        )
      }
      return PraxisBrowserGroundingEvidenceBundle(
        request: request,
        pages: [],
        facts: blockedFacts,
        generatedAt: generatedAt,
        blockedReason: "No valid example URL was provided to the local browser grounding baseline."
      )
    }

    let snapshotSlug = PraxisLocalBrowserGroundingBaseline.slug(from: request.taskSummary)
    let snapshotRoot = rootDirectory.appendingPathComponent("browser-grounding", isDirectory: true)
    let snapshotPath = snapshotRoot.appendingPathComponent("\(snapshotSlug).txt", isDirectory: false).path
    try PraxisLocalBrowserArtifactWriter.writeSnapshot(
      at: snapshotPath,
      lines: [
        "Local browser grounding baseline snapshot",
        "Task: \(request.taskSummary)",
        "Example URL: \(url.absoluteString)",
        "Fetch status: not fetched",
        "Note: Facts in this artifact were derived from the input URL only and remain unverified until a live browser fetch runs."
      ]
    )

    let page = PraxisBrowserGroundingPageEvidence(
      role: .example,
      url: url.absoluteString,
      snapshotPath: snapshotPath,
      capturedAt: generatedAt
    )

    let facts = request.requestedFacts.map { factName in
      if let value = PraxisLocalBrowserGroundingBaseline.factValue(named: factName, for: url) {
        return PraxisBrowserGroundingFactEvidence(
          name: factName,
          status: .candidate,
          value: value,
          detail: "Derived from the example URL without fetching the page, so redirects and live document state remain unverified.",
          sourceRole: .example,
          sourceURL: url.absoluteString,
          citationSnippet: "Example URL: \(url.absoluteString)"
        )
      }

      return PraxisBrowserGroundingFactEvidence(
        name: factName,
        status: .candidate,
        detail: "Local browser grounding baseline did not fetch the page, so this fact remains unverified.",
        sourceRole: .example,
        sourceURL: url.absoluteString,
        citationSnippet: "Example URL: \(url.absoluteString)"
      )
    }

    return PraxisBrowserGroundingEvidenceBundle(
      request: request,
      pages: [page],
      facts: facts,
      generatedAt: generatedAt
    )
  }
}

public struct PraxisLocalBrowserExecutor: PraxisBrowserExecutor, Sendable {
  public let rootDirectory: URL

  public init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
  }

  public func navigate(_ request: PraxisBrowserNavigationRequest) async throws -> PraxisBrowserNavigationReceipt {
    guard let url = URL(string: request.url) else {
      throw PraxisError.invalidInput("Local browser baseline received an invalid URL: \(request.url)")
    }
    let title = PraxisLocalBrowserGroundingBaseline.pageTitle(from: url)
    let snapshotPath = request.captureSnapshot
      ? PraxisLocalHostBaseline.assetReference(
        kind: "browser-snapshots",
        label: request.url,
        rootDirectory: rootDirectory,
        extension: "txt"
      )
      : nil
    if let snapshotPath {
      try PraxisLocalBrowserArtifactWriter.writeSnapshot(
        at: snapshotPath,
        lines: [
          "Local browser navigation baseline snapshot",
          "Requested URL: \(request.url)",
          "Resolved URL: \(url.absoluteString)",
          "Wait policy: \(request.waitPolicy.rawValue)",
          "Fetch status: not fetched",
          "Note: This artifact records the navigation request only; it does not contain fetched page contents."
        ]
      )
    }
    return PraxisBrowserNavigationReceipt(
      requestedURL: request.url,
      finalURL: url.absoluteString,
      title: request.preferredTitle ?? title,
      snapshotPath: snapshotPath
    )
  }
}

public struct PraxisLocalProviderMCPExecutor: PraxisProviderMCPExecutor, Sendable {
  public init() {}

  public func callTool(_ request: PraxisProviderMCPToolCallRequest) async throws -> PraxisProviderMCPToolCallReceipt {
    let summaryText = PraxisLocalInferenceBaseline.condensedText(from: request.summary, limit: 140)
    let serverLabel = request.serverName ?? "local-runtime"
    return PraxisProviderMCPToolCallReceipt(
      toolName: request.toolName,
      status: .succeeded,
      summary: "Local MCP baseline accepted \(request.toolName) for \(serverLabel): \(summaryText)"
    )
  }
}

public struct PraxisLocalUserInputDriver: PraxisUserInputDriver, Sendable {
  public init() {}

  public func prompt(_ request: PraxisPromptRequest) async throws -> PraxisPromptResponse {
    if let defaultValue = request.defaultValue {
      let selectedChoiceID = request.choices.first {
        $0.id == defaultValue || $0.label == defaultValue
      }?.id
      return PraxisPromptResponse(
        content: defaultValue,
        selectedChoiceID: selectedChoiceID,
        acceptedDefault: true
      )
    }

    if let firstChoice = request.choices.first {
      return PraxisPromptResponse(
        content: firstChoice.label,
        selectedChoiceID: firstChoice.id,
        acceptedDefault: false
      )
    }

    return PraxisPromptResponse(
      content: "Local baseline acknowledged: \(PraxisLocalHostBaseline.condensedText(from: request.summary, limit: 80))",
      acceptedDefault: false
    )
  }
}

public struct PraxisLocalPermissionDriver: PraxisPermissionDriver, Sendable {
  public init() {}

  public func request(_ request: PraxisPermissionRequest) async throws -> PraxisPermissionDecision {
    let normalizedScope = request.scope.lowercased()
    let granted: Bool
    if normalizedScope.contains("push")
      || normalizedScope.contains("delete")
      || normalizedScope.contains("destroy")
      || normalizedScope.contains("write")
      || normalizedScope.contains("execute") {
      granted = false
    } else if request.urgency == .high {
      granted = false
    } else {
      granted = true
    }

    let reason = granted
      ? "Local runtime baseline auto-approved non-destructive scope \(request.scope)."
      : "Local runtime baseline requires an interactive host before granting \(request.scope)."
    return PraxisPermissionDecision(granted: granted, reason: reason)
  }
}

public actor PraxisLocalTerminalPresenter: PraxisTerminalPresenter {
  private var events: [PraxisTerminalEvent] = []

  public init() {}

  public func present(_ event: PraxisTerminalEvent) async {
    events.append(event)
  }

  public func allEvents() async -> [PraxisTerminalEvent] {
    events
  }
}

public actor PraxisLocalConversationPresenter: PraxisConversationPresenter {
  private var presentations: [PraxisConversationPresentation] = []

  public init() {}

  public func present(_ presentation: PraxisConversationPresentation) async {
    presentations.append(presentation)
  }

  public func allPresentations() async -> [PraxisConversationPresentation] {
    presentations
  }
}

public struct PraxisLocalAudioTranscriptionDriver: PraxisAudioTranscriptionDriver, Sendable {
  public init() {}

  public func transcribe(_ request: PraxisAudioTranscriptionRequest) async throws -> PraxisAudioTranscriptionResponse {
    let transcript = [
      "Local transcript",
      PraxisLocalHostBaseline.condensedText(from: request.sourceRef, limit: 60),
      request.hint.map { "hint: \(PraxisLocalHostBaseline.condensedText(from: $0, limit: 40))" }
    ]
      .compactMap { $0 }
      .joined(separator: " | ")
    return PraxisAudioTranscriptionResponse(
      transcript: transcript,
      durationSeconds: request.diarizationEnabled ? 12 : 10,
      language: request.locale
    )
  }
}

public struct PraxisLocalSpeechSynthesisDriver: PraxisSpeechSynthesisDriver, Sendable {
  public let rootDirectory: URL

  public init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
  }

  public func synthesize(_ request: PraxisSpeechSynthesisRequest) async throws -> PraxisSpeechSynthesisResponse {
    let format = request.format ?? "wav"
    return PraxisSpeechSynthesisResponse(
      audioAssetRef: PraxisLocalHostBaseline.assetReference(
        kind: "speech",
        label: request.text,
        rootDirectory: rootDirectory,
        extension: format
      ),
      format: format,
      durationSeconds: Double(max(request.text.count, 1)) / 12
    )
  }
}

public struct PraxisLocalImageGenerationDriver: PraxisImageGenerationDriver, Sendable {
  public let rootDirectory: URL

  public init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
  }

  public func generate(_ request: PraxisImageGenerationRequest) async throws -> PraxisImageGenerationResponse {
    let mimeType = request.transparentBackground ? "image/png" : "image/jpeg"
    let fileExtension = request.transparentBackground ? "png" : "jpg"
    let revisedPromptParts = [
      request.prompt,
      request.style,
      request.size
    ].compactMap { $0 }.joined(separator: " | ")
    return PraxisImageGenerationResponse(
      assetRef: PraxisLocalHostBaseline.assetReference(
        kind: "images",
        label: revisedPromptParts,
        rootDirectory: rootDirectory,
        extension: fileExtension
      ),
      mimeType: mimeType,
      revisedPrompt: "\(request.prompt) [local-runtime baseline]"
    )
  }
}

#if os(macOS)
public struct PraxisLocalProcessSupervisor: PraxisProcessSupervisor, Sendable {
  public init() {}

  public func poll(handle: PraxisLongRunningTaskHandle) async throws -> PraxisLongRunningTaskUpdate {
    guard let descriptor = PraxisLocalProcessHandleParser.descriptor(from: handle.identifier) else {
      return PraxisLongRunningTaskUpdate(
        handle: handle,
        status: .failed,
        stderrTail: "Local process supervisor expected a pid-based handle identifier.",
        finishedAt: localRuntimeNow()
      )
    }
    let processID = descriptor.processID

    if kill(processID, 0) == 0 {
      return PraxisLongRunningTaskUpdate(
        handle: handle,
        status: .running,
        stdoutTail: await commandSummary(for: processID)
      )
    }

    let errorCode = errno
    if errorCode == ESRCH {
      if let terminalStatus = descriptor.terminalStatus, terminalStatus != .running {
        return PraxisLongRunningTaskUpdate(
          handle: handle,
          status: terminalStatus,
          stderrTail: terminalStatus == .failed
            ? "Process \(processID) exited before polling; preserved terminal metadata indicates failure."
            : "Process \(processID) exited before polling; preserved terminal metadata was used.",
          exitCode: descriptor.exitCode,
          finishedAt: localRuntimeNow()
        )
      }
      return PraxisLongRunningTaskUpdate(
        handle: handle,
        status: .failed,
        stderrTail: "Process \(processID) is no longer running, and the handle did not preserve a terminal status or exit code.",
        finishedAt: localRuntimeNow()
      )
    }

    return PraxisLongRunningTaskUpdate(
      handle: handle,
      status: .failed,
      stderrTail: "Failed to inspect process \(processID): \(String(cString: strerror(errorCode))).",
      finishedAt: localRuntimeNow()
    )
  }

  private func commandSummary(for processID: Int32) async -> String? {
    guard let processInspectionExecutablePath = PraxisLocalHostPlatformSupport.nativeProcessInspectionExecutablePath else {
      return nil
    }

    do {
      let result = try await PraxisLocalProcessRunner.run(
        executableURL: URL(fileURLWithPath: processInspectionExecutablePath, isDirectory: false),
        arguments: ["-o", "command=", "-p", String(processID)],
        timeoutSeconds: 2
      )
      guard result.exitCode == 0 else {
        return nil
      }
      let lines = result.stdout
        .split(separator: "\n")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
      return lines.first
    } catch {
      return nil
    }
  }
}

public struct PraxisSystemShellExecutor: PraxisShellExecutor, Sendable {
  public init() {}

  public func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult {
    guard let shellExecutablePath = PraxisLocalHostPlatformSupport.nativeShellExecutablePath else {
      throw PraxisError.unsupportedOperation(PraxisLocalHostPlatformSupport.unsupportedShellMessage)
    }

    return try await PraxisLocalProcessRunner.run(
      executableURL: URL(fileURLWithPath: shellExecutablePath, isDirectory: false),
      arguments: ["-lc", command.command],
      currentDirectoryURL: command.workingDirectory.map { URL(fileURLWithPath: $0, isDirectory: true) },
      environment: command.environment,
      timeoutSeconds: command.timeoutSeconds
    )
  }
}

public struct PraxisSystemGitExecutor: PraxisGitExecutor, Sendable {
  public init() {}

  public func apply(_ plan: PraxisGitPlan) async throws -> PraxisGitExecutionReceipt {
    guard let executablePath = PraxisSystemGitExecutableResolver.resolve() else {
      return PraxisGitExecutionReceipt(
        operationID: plan.operationID,
        status: .rejected,
        outputSummary: "System git executable is unavailable.",
        completedAt: localRuntimeNow()
      )
    }

    var stepSummaries: [String] = []
    var completedStepCount = 0

    for step in plan.steps {
      let arguments = try gitArguments(for: step)
      let result = try await PraxisLocalProcessRunner.run(
        executableURL: URL(fileURLWithPath: executablePath, isDirectory: false),
        arguments: arguments,
        currentDirectoryURL: plan.repositoryRoot.map { URL(fileURLWithPath: $0, isDirectory: true) },
        timeoutSeconds: 15
      )
      let output = [result.stdout, result.stderr]
        .joined(separator: "\n")
        .trimmingCharacters(in: .whitespacesAndNewlines)

      if result.exitCode == 0 {
        completedStepCount += 1
        stepSummaries.append("\(step.kind.rawValue): \(output.isEmpty ? "ok" : output)")
        continue
      }

      let failureSummary = output.isEmpty ? "git exited with \(result.exitCode)." : output
      stepSummaries.append("\(step.kind.rawValue): \(failureSummary)")
      return PraxisGitExecutionReceipt(
        operationID: plan.operationID,
        status: completedStepCount == 0 ? .rejected : .partial,
        outputSummary: stepSummaries.joined(separator: " | "),
        completedAt: localRuntimeNow()
      )
    }

    let summary = stepSummaries.isEmpty ? plan.summary : stepSummaries.joined(separator: " | ")
    return PraxisGitExecutionReceipt(
      operationID: plan.operationID,
      status: .applied,
      outputSummary: summary,
      completedAt: localRuntimeNow()
    )
  }

  private func gitArguments(for step: PraxisGitPlanStep) throws -> [String] {
    switch step.kind {
    case .verifyRepository:
      return ["rev-parse", "--show-toplevel"]
    case .fetch:
      return ["fetch"] + optionalGitArgument(step.arguments["remote"])
    case .checkout:
      if let target = step.arguments["target"] ?? step.arguments["branch"] {
        if step.arguments["createBranch"] == "true" {
          return ["checkout", "-b", target]
        }
        return ["checkout", target]
      }
      throw PraxisError.invalidInput("Git checkout step requires a target or branch argument.")
    case .commit:
      guard let message = step.arguments["message"], !message.isEmpty else {
        throw PraxisError.invalidInput("Git commit step requires a message argument.")
      }
      return ["commit", "-m", message]
    case .push:
      var arguments = ["push"]
      if let remote = step.arguments["remote"] {
        arguments.append(remote)
      }
      if let branch = step.arguments["branch"] {
        arguments.append(branch)
      }
      return arguments
    case .merge:
      guard let target = step.arguments["target"] ?? step.arguments["branch"] else {
        throw PraxisError.invalidInput("Git merge step requires a target or branch argument.")
      }
      return ["merge", target]
    case .inspectRef:
      guard let ref = step.arguments["ref"] else {
        throw PraxisError.invalidInput("Git inspectRef step requires a ref argument.")
      }
      return ["rev-parse", "--verify", ref]
    case .updateRef:
      guard let ref = step.arguments["ref"],
            let target = step.arguments["target"] else {
        throw PraxisError.invalidInput("Git updateRef step requires ref and target arguments.")
      }
      return ["update-ref", ref, target]
    }
  }

  private func optionalGitArgument(_ value: String?) -> [String] {
    guard let value, !value.isEmpty else {
      return []
    }
    return [value]
  }
}

public struct PraxisSystemGitAvailabilityProbe: PraxisGitAvailabilityProbe, Sendable {
  public init() {}

  public func probeGitReadiness() async -> PraxisGitAvailabilityReport {
    guard let executablePath = PraxisSystemGitExecutableResolver.resolve() else {
      return PraxisGitAvailabilityReport(
        status: .unavailable,
        executablePath: nil,
        versionString: nil,
        supportsWorktree: false,
        remediationHint: PraxisLocalHostPlatformSupport.gitMissingRemediationHint,
        notes: "System git executable was not found in standard locations."
      )
    }

    do {
      let result = try await PraxisLocalProcessRunner.run(
        executableURL: URL(fileURLWithPath: executablePath, isDirectory: false),
        arguments: ["--version"],
        timeoutSeconds: 5
      )
      let combinedOutput = [result.stdout, result.stderr]
        .joined(separator: "\n")
        .trimmingCharacters(in: .whitespacesAndNewlines)

      if result.exitCode == 0 {
        return PraxisGitAvailabilityReport(
          status: .ready,
          executablePath: executablePath,
          versionString: combinedOutput.isEmpty ? nil : combinedOutput,
          supportsWorktree: supportsGitWorktree(versionString: combinedOutput),
          remediationHint: nil,
          notes: "System git responded successfully to --version."
        )
      }

      if looksLikeCommandLineToolsPrompt(combinedOutput) {
        return PraxisGitAvailabilityReport(
          status: .installPromptExpected,
          executablePath: executablePath,
          versionString: combinedOutput.isEmpty ? nil : combinedOutput,
          supportsWorktree: false,
          remediationHint: PraxisLocalHostPlatformSupport.gitActivationRemediationHint,
          notes: PraxisLocalHostPlatformSupport.gitActivationNotes
        )
      }

      return PraxisGitAvailabilityReport(
        status: .unavailable,
        executablePath: executablePath,
        versionString: combinedOutput.isEmpty ? nil : combinedOutput,
        supportsWorktree: false,
        remediationHint: "Check the system git installation and PATH configuration.",
        notes: "System git exited unsuccessfully during readiness probing."
      )
    } catch {
      return PraxisGitAvailabilityReport(
        status: .unavailable,
        executablePath: executablePath,
        versionString: nil,
        supportsWorktree: false,
        remediationHint: "System git probing failed: \(error).",
        notes: "The runtime could not execute system git."
      )
    }
  }

  private func supportsGitWorktree(versionString: String) -> Bool {
    let numericParts = versionString
      .split(whereSeparator: { !$0.isNumber })
      .compactMap { Int($0) }
    guard numericParts.count >= 2 else {
      return false
    }
    let major = numericParts[0]
    let minor = numericParts[1]
    return major > 2 || (major == 2 && minor >= 5)
  }

  private func looksLikeCommandLineToolsPrompt(_ output: String) -> Bool {
    let normalized = output.lowercased()
    return PraxisLocalHostPlatformSupport.gitActivationSignalPhrases.contains {
      normalized.contains($0)
    }
  }
}
#else
public struct PraxisLocalProcessSupervisor: PraxisProcessSupervisor, Sendable {
  public init() {}

  public func poll(handle: PraxisLongRunningTaskHandle) async throws -> PraxisLongRunningTaskUpdate {
    PraxisLongRunningTaskUpdate(
      handle: handle,
      status: .failed,
      stderrTail: PraxisLocalHostPlatformSupport.unsupportedProcessSupervisorMessage,
      finishedAt: localRuntimeNow()
    )
  }
}

public struct PraxisSystemShellExecutor: PraxisShellExecutor, Sendable {
  public init() {}

  public func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult {
    PraxisShellResult(
      stdout: "",
      stderr: "\(PraxisLocalHostPlatformSupport.unsupportedShellMessage) Command: \(command.command)",
      exitCode: 127,
      terminationReason: .failedToLaunch
    )
  }
}

public struct PraxisSystemGitExecutor: PraxisGitExecutor, Sendable {
  public init() {}

  public func apply(_ plan: PraxisGitPlan) async throws -> PraxisGitExecutionReceipt {
    PraxisGitExecutionReceipt(
      operationID: plan.operationID,
      status: .rejected,
      outputSummary: PraxisLocalHostPlatformSupport.unsupportedGitExecutionMessage,
      completedAt: localRuntimeNow()
    )
  }
}

public struct PraxisSystemGitAvailabilityProbe: PraxisGitAvailabilityProbe, Sendable {
  public init() {}

  public func probeGitReadiness() async -> PraxisGitAvailabilityReport {
    PraxisGitAvailabilityReport(
      status: .unavailable,
      executablePath: nil,
      versionString: nil,
      supportsWorktree: false,
      remediationHint: PraxisLocalHostPlatformSupport.gitMissingRemediationHint,
      notes: PraxisLocalHostPlatformSupport.unsupportedGitExecutionMessage
    )
  }
}
#endif

public extension PraxisHostAdapterRegistry {
  static func localDefaults(rootDirectory: URL? = nil) -> PraxisHostAdapterRegistry {
    let resolvedRootDirectory = PraxisLocalRuntimePaths.resolveRootDirectory(rootDirectory)
    let paths = PraxisLocalRuntimePaths(rootDirectory: resolvedRootDirectory)
    let workspaceRootDirectory = PraxisLocalWorkspaceContext.resolveRootDirectory(rootDirectory)

    return PraxisHostAdapterRegistry(
      runtimeRootDirectory: resolvedRootDirectory,
      workspaceRootDirectory: workspaceRootDirectory,
      capabilityExecutor: PraxisLocalCapabilityExecutor(),
      providerInferenceExecutor: PraxisLocalProviderInferenceExecutor(),
      providerEmbeddingExecutor: PraxisLocalProviderEmbeddingExecutor(),
      providerFileStore: PraxisLocalProviderFileStore(rootDirectory: resolvedRootDirectory),
      providerBatchExecutor: PraxisLocalProviderBatchExecutor(),
      providerSkillRegistry: PraxisLocalProviderSkillRegistry(),
      providerSkillActivator: PraxisLocalProviderSkillActivator(),
      providerMCPExecutor: PraxisLocalProviderMCPExecutor(),
      workspaceReader: PraxisLocalWorkspaceReader(rootDirectory: workspaceRootDirectory),
      workspaceSearcher: PraxisLocalWorkspaceSearcher(rootDirectory: workspaceRootDirectory),
      workspaceWriter: PraxisLocalWorkspaceWriter(rootDirectory: workspaceRootDirectory),
      shellExecutor: PraxisSystemShellExecutor(),
      browserExecutor: PraxisLocalBrowserExecutor(rootDirectory: resolvedRootDirectory),
      browserGroundingCollector: PraxisLocalBrowserGroundingCollector(rootDirectory: resolvedRootDirectory),
      gitAvailabilityProbe: PraxisSystemGitAvailabilityProbe(),
      gitExecutor: PraxisSystemGitExecutor(),
      processSupervisor: PraxisLocalProcessSupervisor(),
      checkpointStore: PraxisLocalCheckpointStore(fileURL: paths.databaseFileURL),
      journalStore: PraxisLocalJournalStore(fileURL: paths.databaseFileURL),
      projectionStore: PraxisLocalProjectionStore(fileURL: paths.databaseFileURL),
      cmpContextPackageStore: PraxisLocalCmpContextPackageStore(fileURL: paths.databaseFileURL),
      cmpControlStore: PraxisLocalCmpControlStore(fileURL: paths.databaseFileURL),
      cmpPeerApprovalStore: PraxisLocalCmpPeerApprovalStore(fileURL: paths.databaseFileURL),
      tapRuntimeEventStore: PraxisLocalTapRuntimeEventStore(fileURL: paths.databaseFileURL),
      messageBus: PraxisLocalMessageBus(),
      deliveryTruthStore: PraxisLocalDeliveryTruthStore(fileURL: paths.databaseFileURL),
      embeddingStore: PraxisLocalEmbeddingStore(fileURL: paths.databaseFileURL),
      semanticSearchIndex: PraxisLocalSemanticSearchIndex(databaseFileURL: paths.databaseFileURL),
      semanticMemoryStore: PraxisLocalSemanticMemoryStore(fileURL: paths.databaseFileURL),
      lineageStore: PraxisLocalLineageStore(fileURL: paths.databaseFileURL),
      userInputDriver: PraxisLocalUserInputDriver(),
      permissionDriver: PraxisLocalPermissionDriver(),
      terminalPresenter: PraxisLocalTerminalPresenter(),
      conversationPresenter: PraxisLocalConversationPresenter(),
      audioTranscriptionDriver: PraxisLocalAudioTranscriptionDriver(),
      speechSynthesisDriver: PraxisLocalSpeechSynthesisDriver(rootDirectory: resolvedRootDirectory),
      imageGenerationDriver: PraxisLocalImageGenerationDriver(rootDirectory: resolvedRootDirectory),
      providerInferenceSurfaceProvenance: .localBaseline,
      browserGroundingSurfaceProvenance: .localBaseline,
      audioTranscriptionSurfaceProvenance: .localBaseline,
      speechSynthesisSurfaceProvenance: .localBaseline,
      imageGenerationSurfaceProvenance: .localBaseline
    )
  }
}
