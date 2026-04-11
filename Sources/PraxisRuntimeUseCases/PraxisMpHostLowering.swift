import Foundation
import PraxisCoreTypes
import PraxisInfraContracts
import PraxisMpFiveAgent
import PraxisMpSearch
import PraxisMpTypes

/// Lowers host-side semantic memory requests and records into MP domain models.
///
/// This type owns only host/runtime translation concerns. It does not execute
/// MP workflow rules, ranking, or governance decisions.
public struct PraxisMpHostLoweringService: Sendable {
  public init() {}

  /// Lowers MP scope levels into semantic memory store scope levels.
  ///
  /// - Parameter scopeLevels: Requested MP scope levels.
  /// - Returns: Deduplicated semantic memory scope levels ordered by raw value.
  public func memoryScopeLevels(
    from scopeLevels: [PraxisMpScopeLevel]
  ) -> [PraxisMemoryScopeLevel] {
    let requested = scopeLevels.isEmpty ? PraxisMpScopeLevel.allCases : scopeLevels
    var lowered: [PraxisMemoryScopeLevel] = []
    for scopeLevel in requested {
      switch scopeLevel {
      case .global:
        lowered.append(.global)
      case .project:
        lowered.append(.project)
      case .agentIsolated:
        lowered.append(.agent)
        lowered.append(.session)
      }
    }
    return Array(Set(lowered)).sorted { $0.rawValue < $1.rawValue }
  }

  /// Builds one semantic memory search request from an MP search plan.
  ///
  /// - Parameters:
  ///   - plan: MP search plan to lower.
  ///   - limitMultiplier: Optional multiplier used by host-side prefetch callers.
  /// - Returns: A semantic memory search request for the current plan.
  public func searchRequest(
    from plan: PraxisMpSearchPlan,
    limitMultiplier: Int = 1
  ) -> PraxisSemanticMemorySearchRequest {
    PraxisSemanticMemorySearchRequest(
      projectID: plan.projectID,
      query: plan.query,
      scopeLevels: memoryScopeLevels(from: plan.scopeLevels),
      limit: max(1, plan.limit * max(1, limitMultiplier)),
      agentID: plan.agentID,
      sessionID: plan.sessionID
    )
  }

  /// Builds one semantic memory bundle request from an MP search plan.
  ///
  /// - Parameter plan: MP search plan to lower.
  /// - Returns: A semantic memory bundle request for the current plan.
  public func bundleRequest(
    from plan: PraxisMpSearchPlan
  ) -> PraxisSemanticMemoryBundleRequest {
    PraxisSemanticMemoryBundleRequest(
      projectID: plan.projectID,
      query: plan.query,
      scopeLevels: memoryScopeLevels(from: plan.scopeLevels),
      limit: plan.limit,
      agentID: plan.agentID,
      sessionID: plan.sessionID,
      includeSuperseded: plan.includeSuperseded
    )
  }

  /// Reconstructs one MP scope descriptor from persisted semantic memory truth.
  ///
  /// - Parameters:
  ///   - record: Persisted semantic memory record.
  ///   - fallbackSessionID: Optional session identifier used when the record omits it.
  /// - Returns: One MP scope descriptor carrying host-backed governance fields.
  public func mpScopeDescriptor(
    from record: PraxisSemanticMemoryRecord,
    fallbackSessionID: String?
  ) -> PraxisMpScopeDescriptor {
    PraxisMpScopeDescriptor(
      projectID: record.projectID,
      agentID: record.agentID,
      sessionID: record.sessionID ?? fallbackSessionID,
      scopeLevel: mpScopeLevel(from: record.scopeLevel),
      sessionMode: record.sessionMode,
      visibilityState: record.visibilityState,
      promotionState: record.promotionState,
      lineagePath: record.lineagePath,
      metadata: record.metadata
    )
  }

  /// Reconstructs one MP memory record from persisted semantic memory truth.
  ///
  /// - Parameters:
  ///   - record: Persisted semantic memory record.
  ///   - fallbackSessionID: Optional session identifier used when the record omits it.
  /// - Returns: One MP memory record ready for domain services.
  public func mpMemoryRecord(
    from record: PraxisSemanticMemoryRecord,
    fallbackSessionID: String? = nil
  ) -> PraxisMpMemoryRecord {
    PraxisMpMemoryRecord(
      id: record.id,
      scope: mpScopeDescriptor(from: record, fallbackSessionID: fallbackSessionID),
      summary: record.summary,
      storageKey: record.storageKey,
      memoryKind: mpMemoryKind(from: record.memoryKind),
      freshness: .init(status: mpFreshnessStatus(from: record.freshnessStatus)),
      confidence: record.confidence,
      alignment: .init(status: mpAlignmentStatus(from: record.alignmentStatus)),
      sourceRefs: record.sourceRefs.isEmpty ? [record.storageKey] : record.sourceRefs,
      tags: record.tags,
      semanticGroupID: record.semanticGroupID,
      embedding: record.embeddingStorageKey.map {
        .init(vectorRef: $0)
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      metadata: record.metadata
    )
  }

  /// Lowers one MP memory record into persisted semantic memory truth.
  ///
  /// - Parameter record: MP memory record to persist.
  /// - Returns: One semantic memory record carrying host-native fields.
  public func semanticMemoryRecord(
    from record: PraxisMpMemoryRecord
  ) -> PraxisSemanticMemoryRecord {
    PraxisSemanticMemoryRecord(
      id: record.id,
      projectID: record.scope.projectID,
      agentID: record.scope.agentID,
      sessionID: record.scope.sessionID,
      scopeLevel: memoryScopeLevel(from: record.scope),
      sessionMode: record.scope.sessionMode,
      visibilityState: record.scope.visibilityState,
      promotionState: record.scope.promotionState,
      memoryKind: memoryKind(from: record.memoryKind),
      summary: record.summary,
      storageKey: record.storageKey,
      freshnessStatus: memoryFreshnessStatus(from: record.freshness.status),
      alignmentStatus: memoryAlignmentStatus(from: record.alignment.status),
      sourceRefs: record.sourceRefs,
      tags: record.tags,
      semanticGroupID: record.semanticGroupID,
      confidence: record.confidence,
      lineagePath: record.scope.lineagePath,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      metadata: record.metadata,
      embeddingStorageKey: record.embedding?.vectorRef
    )
  }

  /// Loads seed MP records from semantic memory truth for host-backed workflow runtimes.
  ///
  /// - Parameters:
  ///   - projectID: Project identity whose memory records should seed the runtime.
  ///   - fallbackSessionID: Optional session identifier used during reconstruction.
  ///   - memoryStore: Semantic memory store adapter.
  /// - Returns: Reconstructed MP memory records from host truth.
  /// - Throws: Propagates memory store failures.
  public func loadSeedRecords(
    projectID: String,
    fallbackSessionID: String?,
    memoryStore: any PraxisSemanticMemoryStoreContract
  ) async throws -> [PraxisMpMemoryRecord] {
    let records = try await memoryStore.search(
      PraxisSemanticMemorySearchRequest(
        projectID: projectID,
        query: "",
        scopeLevels: [.global, .project, .agent, .session],
        limit: 500
      )
    )
    return records.map { mpMemoryRecord(from: $0, fallbackSessionID: fallbackSessionID) }
  }

  /// Persists MP records back into semantic memory truth.
  ///
  /// - Parameters:
  ///   - records: MP records to persist.
  ///   - memoryStore: Semantic memory store adapter.
  /// - Returns: None.
  /// - Throws: Propagates memory store failures.
  public func persist(
    _ records: [PraxisMpMemoryRecord],
    using memoryStore: any PraxisSemanticMemoryStoreContract
  ) async throws {
    for record in records {
      _ = try await memoryStore.save(semanticMemoryRecord(from: record))
    }
  }

  /// Reconstructs the target MP scope for one ingest command.
  ///
  /// - Parameter command: MP ingest command.
  /// - Returns: One MP scope descriptor aligned with current local host semantics.
  public func scopeDescriptor(
    from command: PraxisIngestMpCommand
  ) -> PraxisMpScopeDescriptor {
    let sessionMode: PraxisMpSessionMode?
    let visibilityState: PraxisMpVisibilityState?

    switch command.scopeLevel {
    case .global, .project:
      sessionMode = .shared
      visibilityState = nil
    case .agentIsolated:
      if command.sessionID == nil {
        sessionMode = .isolated
        visibilityState = .localOnly
      } else {
        sessionMode = .bridged
        visibilityState = .sessionBridged
      }
    }

    return PraxisMpScopeDescriptor(
      projectID: command.projectID,
      agentID: command.agentID,
      sessionID: command.sessionID,
      scopeLevel: command.scopeLevel,
      sessionMode: sessionMode,
      visibilityState: visibilityState
    )
  }

  /// Normalizes one optional timestamp for MP workflow operations.
  ///
  /// - Parameter candidate: Optional timestamp string from command input.
  /// - Returns: A trimmed timestamp or the current ISO8601 timestamp when absent.
  public func normalizedTimestamp(_ candidate: String?) -> String {
    let trimmed = candidate?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if trimmed.isEmpty == false {
      return trimmed
    }
    return ISO8601DateFormatter().string(from: Date())
  }

  /// Generates one transient artifact identifier for ingest workflows.
  ///
  /// - Returns: One generated artifact identifier.
  public func makeArtifactID() -> String {
    "artifact.\(UUID().uuidString.lowercased())"
  }

  /// Computes the storage key that host persistence should use for one ingest command.
  ///
  /// - Parameters:
  ///   - command: MP ingest command.
  ///   - artifactID: Generated artifact identifier for the ingest attempt.
  /// - Returns: One stable storage key for the candidate memory.
  public func storageKey(
    from command: PraxisIngestMpCommand,
    artifactID: String
  ) -> String {
    if let storageKey = command.storageKey?.trimmingCharacters(in: .whitespacesAndNewlines),
       storageKey.isEmpty == false {
      return storageKey
    }
    let normalizedSessionID = command.sessionID?.trimmingCharacters(in: .whitespacesAndNewlines)
    let sessionComponent = (normalizedSessionID?.isEmpty == false) ? normalizedSessionID! : "shared"
    return "memory/\(command.projectID)/\(command.agentID)/\(sessionComponent)/\(artifactID)"
  }

  /// Builds the stored-artifact descriptor that feeds the five-agent ingest runtime.
  ///
  /// - Parameters:
  ///   - command: MP ingest command.
  ///   - artifactID: Generated artifact identifier for the ingest attempt.
  ///   - persistedAt: Timestamp associated with the persisted artifact.
  ///   - storageKey: Host storage key for the artifact.
  /// - Returns: One stored-artifact descriptor for five-agent ingest.
  public func storedArtifact(
    from command: PraxisIngestMpCommand,
    artifactID: String,
    persistedAt: String,
    storageKey: String
  ) -> PraxisMpFiveAgentStoredArtifact {
    PraxisMpFiveAgentStoredArtifact(
      id: artifactID,
      projectID: command.projectID,
      agentID: command.agentID,
      storageRef: storageKey,
      persistedAt: persistedAt,
      summary: command.summary,
      semanticGroupID: command.semanticGroupID,
      tags: command.tags
    )
  }

  private func mpScopeLevel(from scopeLevel: PraxisMemoryScopeLevel) -> PraxisMpScopeLevel {
    switch scopeLevel {
    case .global:
      return .global
    case .project:
      return .project
    case .agent, .session:
      return .agentIsolated
    }
  }

  private func mpMemoryKind(from memoryKind: PraxisMemoryKind) -> PraxisMpMemoryKind {
    switch memoryKind {
    case .episodic:
      return .episodic
    case .semantic:
      return .semantic
    case .summary:
      return .summary
    case .directive:
      return .directive
    case .statusSnapshot:
      return .statusSnapshot
    }
  }

  private func mpFreshnessStatus(
    from status: PraxisMemoryFreshnessStatus
  ) -> PraxisMpMemoryFreshnessStatus {
    switch status {
    case .fresh:
      return .fresh
    case .aging:
      return .aging
    case .stale:
      return .stale
    case .superseded:
      return .superseded
    }
  }

  private func mpAlignmentStatus(
    from status: PraxisMemoryAlignmentStatus
  ) -> PraxisMpMemoryAlignmentStatus {
    switch status {
    case .unreviewed:
      return .unreviewed
    case .aligned:
      return .aligned
    case .drifted:
      return .drifted
    }
  }

  private func memoryKind(from kind: PraxisMpMemoryKind) -> PraxisMemoryKind {
    switch kind {
    case .episodic:
      return .episodic
    case .semantic:
      return .semantic
    case .summary:
      return .summary
    case .directive:
      return .directive
    case .statusSnapshot:
      return .statusSnapshot
    }
  }

  private func memoryFreshnessStatus(
    from status: PraxisMpMemoryFreshnessStatus
  ) -> PraxisMemoryFreshnessStatus {
    switch status {
    case .fresh:
      return .fresh
    case .aging:
      return .aging
    case .stale:
      return .stale
    case .superseded:
      return .superseded
    }
  }

  private func memoryAlignmentStatus(
    from status: PraxisMpMemoryAlignmentStatus
  ) -> PraxisMemoryAlignmentStatus {
    switch status {
    case .unreviewed:
      return .unreviewed
    case .aligned:
      return .aligned
    case .drifted:
      return .drifted
    }
  }

  private func memoryScopeLevel(from scope: PraxisMpScopeDescriptor) -> PraxisMemoryScopeLevel {
    switch scope.scopeLevel {
    case .global:
      return .global
    case .project:
      return .project
    case .agentIsolated:
      return scope.sessionID == nil ? .agent : .session
    }
  }
}
