import PraxisInfraContracts
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes

/// Captures one host-backed MP candidate read before domain projection.
///
/// This snapshot keeps lowered records, optional semantic scores, and stable
/// fallback issues together so use cases do not need to reassemble them.
public struct PraxisMpHostCandidateSnapshot: Sendable, Equatable {
  public let records: [PraxisMpMemoryRecord]
  public let candidateCount: Int
  public let semanticScoresByStorageKey: [String: Double]
  public let issues: [String]
  public let omittedSupersededMemoryIDs: [String]

  public init(
    records: [PraxisMpMemoryRecord],
    candidateCount: Int,
    semanticScoresByStorageKey: [String: Double] = [:],
    issues: [String] = [],
    omittedSupersededMemoryIDs: [String] = []
  ) {
    self.records = records
    self.candidateCount = candidateCount
    self.semanticScoresByStorageKey = semanticScoresByStorageKey
    self.issues = issues
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
  }
}

/// Shared host-side orchestration for MP retrieval-oriented workflows.
///
/// This service owns the repeated runtime path that reads semantic memory truth,
/// reconstructs MP records, reranks them, and assembles one workflow bundle.
public struct PraxisMpHostRetrievalService: Sendable {
  private let loweringService: PraxisMpHostLoweringService
  private let rankingService: PraxisMpSearchRankingService
  private let bundleService: PraxisMpWorkflowBundleService
  private let diagnosticsService: PraxisMpHostDiagnosticsService

  public init(
    loweringService: PraxisMpHostLoweringService = PraxisMpHostLoweringService(),
    rankingService: PraxisMpSearchRankingService = PraxisMpSearchRankingService(),
    bundleService: PraxisMpWorkflowBundleService = PraxisMpWorkflowBundleService(),
    diagnosticsService: PraxisMpHostDiagnosticsService = PraxisMpHostDiagnosticsService()
  ) {
    self.loweringService = loweringService
    self.rankingService = rankingService
    self.bundleService = bundleService
    self.diagnosticsService = diagnosticsService
  }

  /// Loads host-backed MP candidate records for one search-like surface.
  ///
  /// - Parameters:
  ///   - plan: Search plan that defines query, scope, and result bounds.
  ///   - memoryStore: Semantic memory store used as host truth.
  ///   - semanticSearchIndex: Optional semantic search index used for score-aware reranking.
  ///   - limitMultiplier: Fetch multiplier applied to the request limit.
  ///   - includeSemanticScores: Whether semantic scores should be fetched when available.
  ///   - fallbackOperation: Operation label used when reporting semantic-search fallback.
  /// - Returns: One snapshot of lowered records, optional scores, and stable issues.
  /// - Throws: Propagates semantic memory store and semantic search failures.
  public func candidateSnapshot(
    plan: PraxisMpSearchPlan,
    memoryStore: any PraxisSemanticMemoryStoreContract,
    semanticSearchIndex: (any PraxisSemanticSearchIndexContract)? = nil,
    limitMultiplier: Int,
    includeSemanticScores: Bool,
    fallbackOperation: String
  ) async throws -> PraxisMpHostCandidateSnapshot {
    let semanticRecords = try await memoryStore.search(
      loweringService.searchRequest(from: plan, limitMultiplier: limitMultiplier)
    )
    let semanticScores = includeSemanticScores
      ? try await mergedSemanticScores(
        plan: plan,
        semanticRecords: semanticRecords,
        semanticSearchIndex: semanticSearchIndex,
        fallbackScores: [:],
        limitMultiplier: limitMultiplier
      )
      : [:]
    let issues = semanticSearchIndex == nil
      ? [diagnosticsService.semanticSearchFallbackIssue(for: fallbackOperation)]
      : []
    let mpRecords = semanticRecords.map {
      loweringService.mpMemoryRecord(from: $0, fallbackSessionID: plan.sessionID)
    }
    return PraxisMpHostCandidateSnapshot(
      records: mpRecords,
      candidateCount: semanticRecords.count,
      semanticScoresByStorageKey: semanticScores,
      issues: issues,
      omittedSupersededMemoryIDs: mpRecords
        .filter { $0.freshness.status == .superseded }
        .map(\.id)
    )
  }

  /// Builds one MP workflow bundle from persisted semantic memory truth.
  ///
  /// - Parameters:
  ///   - plan: Search plan that defines query, scope, and result bounds.
  ///   - requesterAgentID: Agent requesting the bundle.
  ///   - requesterSessionID: Optional session identifier for requester-scoped reads.
  ///   - memoryStore: Semantic memory store used as host truth.
  ///   - semanticSearchIndex: Optional semantic search index used for score-aware reranking.
  ///   - semanticScoresByStorageKey: Optional semantic scores keyed by storage key.
  /// - Returns: One assembled MP workflow bundle.
  /// - Throws: Propagates semantic memory store failures.
  public func bundle(
    plan: PraxisMpSearchPlan,
    requesterAgentID: String,
    requesterSessionID: String?,
    memoryStore: any PraxisSemanticMemoryStoreContract,
    semanticSearchIndex: (any PraxisSemanticSearchIndexContract)? = nil,
    semanticScoresByStorageKey: [String: Double] = [:]
  ) async throws -> PraxisMpWorkflowBundle {
    let snapshot = try await candidateSnapshot(
      plan: plan,
      memoryStore: memoryStore,
      semanticSearchIndex: semanticSearchIndex,
      limitMultiplier: 10,
      includeSemanticScores: true,
      fallbackOperation: "resolve"
    )
    let rankedRecords = rankingService.rank(
      records: snapshot.records,
      semanticScoresByStorageKey: semanticScoresByStorageKey.merging(
        snapshot.semanticScoresByStorageKey,
        uniquingKeysWith: max
      ),
      plan: plan
    ).map(\.memory)
    return bundleService.assemble(
      scope: PraxisMpScopeDescriptor(
        projectID: plan.projectID,
        agentID: requesterAgentID,
        sessionID: requesterSessionID,
        scopeLevel: plan.scopeLevels.first ?? .agentIsolated
      ),
      orderedRecords: rankedRecords,
      limit: plan.limit,
      omittedSupersededMemoryIDs: snapshot.omittedSupersededMemoryIDs
    )
  }

  /// Emits the current fixed dispatcher telemetry for host-side retrieval workflows.
  ///
  /// - Returns: One pair of role count and stage maps.
  public func dispatcherTelemetry() -> (roleCounts: PraxisMpRoleCountMap, roleStages: PraxisMpRoleStageMap) {
    (
      roleCounts: .init(counts: [.dispatcher: 1]),
      roleStages: .init(stages: [.dispatcher: .assembleBundle])
    )
  }

  private func mergedSemanticScores(
    plan: PraxisMpSearchPlan,
    semanticRecords: [PraxisSemanticMemoryRecord],
    semanticSearchIndex: (any PraxisSemanticSearchIndexContract)?,
    fallbackScores: [String: Double],
    limitMultiplier: Int
  ) async throws -> [String: Double] {
    var mergedScores = fallbackScores
    guard let semanticSearchIndex,
          plan.query.isEmpty == false,
          semanticRecords.isEmpty == false else {
      return mergedScores
    }

    let candidateStorageKeys = semanticRecords.map(\.storageKey)
    let matches = try await semanticSearchIndex.search(
      PraxisSemanticSearchRequest(
        query: plan.query,
        limit: plan.limit * limitMultiplier,
        candidateStorageKeys: candidateStorageKeys
      )
    )
    let providerScores = Dictionary(matches.map { ($0.storageKey, $0.score) }, uniquingKeysWith: max)
    for (storageKey, score) in providerScores {
      mergedScores[storageKey] = max(mergedScores[storageKey] ?? 0, score)
    }
    return mergedScores
  }
}
