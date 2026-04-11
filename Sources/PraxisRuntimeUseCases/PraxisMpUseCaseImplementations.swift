import Foundation
import PraxisCoreTypes
import PraxisInfraContracts
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes
import PraxisRuntimeComposition

private func requireSemanticMemoryRecord(
  projectID: String,
  memoryID: String,
  memoryStore: any PraxisSemanticMemoryStoreContract,
  capability: String
) async throws -> PraxisSemanticMemoryRecord {
  guard let persistedRecord = try await memoryStore.load(memoryID: memoryID) else {
    throw PraxisError.invalidInput("\(capability) could not find memory record \(memoryID).")
  }
  guard persistedRecord.projectID == projectID else {
    throw PraxisError.invalidInput("\(capability) cannot mutate memory \(memoryID) outside project \(projectID).")
  }
  return persistedRecord
}

private func requireSemanticMemoryStore(
  from dependencies: PraxisDependencyGraph,
  capability: String
) throws -> any PraxisSemanticMemoryStoreContract {
  guard let store = dependencies.hostAdapters.semanticMemoryStore else {
    throw PraxisError.dependencyMissing("\(capability) requires a semantic memory store adapter.")
  }
  return store
}

public final class PraxisInspectMpUseCase: PraxisInspectMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let inspectionService = PraxisMpHostInspectionService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  /// Builds the inspection output for the current reserved MP workflow surface.
  ///
  /// - Returns: An inspection result that describes the MP workflow, memory store, and multimodal surface.
  /// - Throws: This implementation does not actively throw, but it propagates underlying errors from the call chain.
  public func execute() async throws -> PraxisMpInspection {
    try await inspectionService.inspect(
      projectID: "mp.local-runtime",
      hostAdapters: dependencies.hostAdapters
    )
  }
}

public final class PraxisSearchMpUseCase: PraxisSearchMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let planningService = PraxisMpSearchPlanningService()
  private let rankingService = PraxisMpSearchRankingService()
  private let projectionService = PraxisMpSearchProjectionService()
  private let retrievalService = PraxisMpHostRetrievalService()
  private let resultMappingService = PraxisMpHostResultMappingService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisSearchMpCommand) async throws -> PraxisMpSearchResult {
    let plan = planningService.makePlan(
      projectID: command.projectID,
      query: command.query,
      scopeLevels: command.scopeLevels,
      limit: command.limit,
      agentID: command.agentID,
      sessionID: command.sessionID,
      includeSuperseded: command.includeSuperseded
    )

    guard let memoryStore = dependencies.hostAdapters.semanticMemoryStore else {
      return PraxisMpSearchResult(
        projectID: plan.projectID,
        query: plan.query,
        summary: diagnosticsService.missingSemanticMemoryStoreSummary(for: "search"),
        hits: [],
        issues: [diagnosticsService.missingSemanticMemoryStoreIssue(for: "search")]
      )
    }

    let candidateSnapshot = try await retrievalService.candidateSnapshot(
      plan: plan,
      memoryStore: memoryStore,
      semanticSearchIndex: dependencies.hostAdapters.semanticSearchIndex,
      limitMultiplier: 4,
      includeSemanticScores: true,
      fallbackOperation: "search"
    )
    let rankedHits = rankingService.rank(
      records: candidateSnapshot.records,
      semanticScoresByStorageKey: candidateSnapshot.semanticScoresByStorageKey,
      plan: plan
    )
    let projection = projectionService.project(
      hits: rankedHits,
      candidateCount: candidateSnapshot.candidateCount,
      plan: plan
    )
    return resultMappingService.searchResult(
      projectID: plan.projectID,
      query: plan.query,
      projection: projection,
      issues: candidateSnapshot.issues
    )
  }
}

public final class PraxisReadbackMpUseCase: PraxisReadbackMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let loweringService = PraxisMpHostLoweringService()
  private let planningService = PraxisMpSearchPlanningService()
  private let projectionService = PraxisMpReadbackProjectionService()
  private let retrievalService = PraxisMpHostRetrievalService()
  private let resultMappingService = PraxisMpHostResultMappingService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisReadbackMpCommand) async throws -> PraxisMpReadback {
    let plan = planningService.makePlan(
      projectID: command.projectID,
      query: command.query,
      scopeLevels: command.scopeLevels,
      limit: command.limit,
      agentID: command.agentID,
      sessionID: command.sessionID,
      includeSuperseded: command.includeSuperseded
    )

    guard let memoryStore = dependencies.hostAdapters.semanticMemoryStore else {
      return PraxisMpReadback(
        projectID: plan.projectID,
        summary: diagnosticsService.missingSemanticMemoryStoreSummary(for: "readback"),
        totalMemoryCount: 0,
        primaryCount: 0,
        supportingCount: 0,
        omittedSupersededCount: 0,
        freshnessBreakdown: [:],
        alignmentBreakdown: [:],
        scopeBreakdown: [:],
        issues: [diagnosticsService.missingSemanticMemoryStoreIssue(for: "readback")]
      )
    }

    let candidateSnapshot = try await retrievalService.candidateSnapshot(
      plan: plan,
      memoryStore: memoryStore,
      semanticSearchIndex: dependencies.hostAdapters.semanticSearchIndex,
      limitMultiplier: 10,
      includeSemanticScores: false,
      fallbackOperation: "readback"
    )
    let bundle = try await memoryStore.bundle(
      loweringService.bundleRequest(from: plan)
    )
    let projection = projectionService.project(
      records: candidateSnapshot.records,
      primaryCount: bundle.primaryMemoryIDs.count,
      supportingCount: bundle.supportingMemoryIDs.count,
      omittedSupersededCount: bundle.omittedSupersededMemoryIDs.count
    )
    return resultMappingService.readbackResult(
      projectID: plan.projectID,
      projection: projection,
      issues: candidateSnapshot.issues
    )
  }
}

public final class PraxisSmokeMpUseCase: PraxisSmokeMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let inspectionService = PraxisMpHostInspectionService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisSmokeMpCommand) async throws -> PraxisMpSmoke {
    inspectionService.smoke(
      projectID: command.projectID,
      hostAdapters: dependencies.hostAdapters
    )
  }
}

public final class PraxisIngestMpUseCase: PraxisIngestMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let loweringService = PraxisMpHostLoweringService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisIngestMpCommand) async throws -> PraxisMpIngestResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP ingest")
    let timestamp = loweringService.normalizedTimestamp(command.observedAt ?? command.capturedAt)
    let seedRecords = try await loweringService.loadSeedRecords(
      projectID: command.projectID,
      fallbackSessionID: command.sessionID,
      memoryStore: memoryStore
    )
    let runtime = PraxisMpFiveAgentRuntime(seedRecords: seedRecords)
    let artifactID = loweringService.makeArtifactID()
    let storageKey = loweringService.storageKey(from: command, artifactID: artifactID)
    let ingestResult = await runtime.ingest(
      .init(
        projectID: command.projectID,
        artifact: loweringService.storedArtifact(
          from: command,
          artifactID: artifactID,
          persistedAt: timestamp,
          storageKey: storageKey
        ),
        checkedSnapshotRef: command.checkedSnapshotRef,
        branchRef: command.branchRef,
        scope: loweringService.scopeDescriptor(from: command),
        memoryKind: command.memoryKind,
        observedAt: command.observedAt,
        capturedAt: command.capturedAt,
        sourceRefs: command.sourceRefs,
        confidence: command.confidence
      )
    )

    try await loweringService.persist(ingestResult.records, using: memoryStore)
    let primary = ingestResult.alignment.primary
    let summary = diagnosticsService.ingestSummary(
      updatedCount: ingestResult.records.count,
      decision: ingestResult.alignment.decisionOutput.decision,
      primaryMemoryID: primary.id
    )
    return PraxisMpIngestResult(
      projectID: command.projectID,
      agentID: command.agentID,
      sessionID: command.sessionID,
      summary: summary,
      primaryMemoryID: primary.id,
      storageKey: primary.storageKey,
      updatedMemoryIDs: ingestResult.records.map(\.id).sorted(),
      supersededMemoryIDs: ingestResult.alignment.supersededMemoryIDs.sorted(),
      staleMemoryIDs: ingestResult.alignment.staleMemoryIDs.sorted(),
      decision: ingestResult.alignment.decisionOutput.decision,
      freshnessStatus: primary.freshness.status,
      alignmentStatus: primary.alignment.status,
      issues: []
    )
  }
}

public final class PraxisAlignMpUseCase: PraxisAlignMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let loweringService = PraxisMpHostLoweringService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisAlignMpCommand) async throws -> PraxisMpAlignResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP align")
    let persistedRecord = try await requireSemanticMemoryRecord(
      projectID: command.projectID,
      memoryID: command.memoryID,
      memoryStore: memoryStore,
      capability: "MP align"
    )

    let seedRecords = try await loweringService.loadSeedRecords(
      projectID: command.projectID,
      fallbackSessionID: nil,
      memoryStore: memoryStore
    )
    let runtime = PraxisMpFiveAgentRuntime(seedRecords: seedRecords)
    let alignment = await runtime.align(
      .init(
        record: loweringService.mpMemoryRecord(from: persistedRecord),
        alignedAt: loweringService.normalizedTimestamp(command.alignedAt),
        queryText: command.queryText ?? persistedRecord.summary
      )
    )

    try await loweringService.persist(alignment.updatedRecords, using: memoryStore)
    let summary = diagnosticsService.alignSummary(
      updatedCount: alignment.updatedRecords.count,
      decision: alignment.decisionOutput.decision,
      memoryID: command.memoryID
    )
    return PraxisMpAlignResult(
      projectID: command.projectID,
      memoryID: command.memoryID,
      summary: summary,
      primaryMemoryID: alignment.primary.id,
      updatedMemoryIDs: alignment.updatedRecords.map(\.id).sorted(),
      supersededMemoryIDs: alignment.supersededMemoryIDs.sorted(),
      staleMemoryIDs: alignment.staleMemoryIDs.sorted(),
      decision: alignment.decisionOutput.decision,
      freshnessStatus: alignment.primary.freshness.status,
      alignmentStatus: alignment.primary.alignment.status,
      issues: []
    )
  }
}

public final class PraxisResolveMpUseCase: PraxisResolveMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let planningService = PraxisMpSearchPlanningService()
  private let retrievalService = PraxisMpHostRetrievalService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisResolveMpCommand) async throws -> PraxisMpResolveResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP resolve")
    let plan = planningService.makePlan(
      projectID: command.projectID,
      query: command.query,
      scopeLevels: command.scopeLevels,
      limit: command.limit,
      agentID: nil,
      sessionID: command.requesterSessionID,
      includeSuperseded: false
    )
    let bundle = try await retrievalService.bundle(
      plan: plan,
      requesterAgentID: command.requesterAgentID,
      requesterSessionID: command.requesterSessionID,
      memoryStore: memoryStore,
      semanticSearchIndex: dependencies.hostAdapters.semanticSearchIndex
    )
    let summary = diagnosticsService.resolveSummary(
      primaryCount: bundle.primary.count,
      supportingCount: bundle.supporting.count,
      query: command.query
    )
    var issues: [String] = []
    if dependencies.hostAdapters.semanticSearchIndex == nil {
      issues.append(diagnosticsService.semanticSearchFallbackIssue(for: "resolve"))
    }
    let dispatcherTelemetry = retrievalService.dispatcherTelemetry()
    return PraxisMpResolveResult(
      projectID: command.projectID,
      query: command.query,
      summary: summary,
      primaryMemoryIDs: bundle.primary.map(\.id),
      supportingMemoryIDs: bundle.supporting.map(\.id),
      omittedSupersededMemoryIDs: bundle.diagnostics.omittedSupersededMemoryIDs,
      rerankComposition: bundle.diagnostics.rerankComposition,
      roleCounts: dispatcherTelemetry.roleCounts,
      roleStages: dispatcherTelemetry.roleStages,
      issues: issues
    )
  }
}

public final class PraxisRequestMpHistoryUseCase: PraxisRequestMpHistoryUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let planningService = PraxisMpSearchPlanningService()
  private let retrievalService = PraxisMpHostRetrievalService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistoryResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP history")
    let plan = planningService.makePlan(
      projectID: command.projectID,
      query: command.query,
      scopeLevels: command.scopeLevels,
      limit: command.limit,
      agentID: nil,
      sessionID: command.requesterSessionID,
      includeSuperseded: false
    )
    let bundle = try await retrievalService.bundle(
      plan: plan,
      requesterAgentID: command.requesterAgentID,
      requesterSessionID: command.requesterSessionID,
      memoryStore: memoryStore,
      semanticSearchIndex: dependencies.hostAdapters.semanticSearchIndex
    )
    var issues: [String] = []
    if dependencies.hostAdapters.semanticSearchIndex == nil {
      issues.append(diagnosticsService.semanticSearchFallbackIssue(for: "history"))
    }
    let summary = diagnosticsService.historySummary(
      primaryCount: bundle.primary.count,
      supportingCount: bundle.supporting.count,
      requesterAgentID: command.requesterAgentID
    )
    let dispatcherTelemetry = retrievalService.dispatcherTelemetry()
    return PraxisMpHistoryResult(
      projectID: command.projectID,
      requesterAgentID: command.requesterAgentID,
      query: command.query,
      reason: command.reason,
      summary: summary,
      primaryMemoryIDs: bundle.primary.map(\.id),
      supportingMemoryIDs: bundle.supporting.map(\.id),
      omittedSupersededMemoryIDs: bundle.diagnostics.omittedSupersededMemoryIDs,
      rerankComposition: bundle.diagnostics.rerankComposition,
      roleCounts: dispatcherTelemetry.roleCounts,
      roleStages: dispatcherTelemetry.roleStages,
      issues: issues
    )
  }
}

public final class PraxisPromoteMpUseCase: PraxisPromoteMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let loweringService = PraxisMpHostLoweringService()
  private let governanceService = PraxisMpMemoryGovernanceService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisPromoteMpCommand) async throws -> PraxisMpPromoteResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP promote")
    let persistedRecord = try await requireSemanticMemoryRecord(
      projectID: command.projectID,
      memoryID: command.memoryID,
      memoryStore: memoryStore,
      capability: "MP promote"
    )
    let timestamp = loweringService.normalizedTimestamp(command.promotedAt)
    let updatedRecord = try governanceService.promote(
      record: loweringService.mpMemoryRecord(
        from: persistedRecord,
        fallbackSessionID: persistedRecord.sessionID
      ),
      targetPromotionState: command.targetPromotionState,
      targetSessionID: command.targetSessionID,
      changedAt: timestamp,
      reason: command.reason
    )
    _ = try await memoryStore.save(loweringService.semanticMemoryRecord(from: updatedRecord))

    return PraxisMpPromoteResult(
      projectID: command.projectID,
      memoryID: command.memoryID,
      summary: diagnosticsService.promoteSummary(
        memoryID: command.memoryID,
        promotionState: updatedRecord.scope.promotionState,
        visibilityState: updatedRecord.scope.visibilityState
      ),
      scopeLevel: updatedRecord.scope.scopeLevel,
      sessionID: updatedRecord.scope.sessionID,
      sessionMode: updatedRecord.scope.sessionMode,
      visibilityState: updatedRecord.scope.visibilityState,
      promotionState: updatedRecord.scope.promotionState,
      updatedAt: timestamp,
      issues: []
    )
  }
}

public final class PraxisArchiveMpUseCase: PraxisArchiveMpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph
  private let diagnosticsService = PraxisMpHostDiagnosticsService()
  private let loweringService = PraxisMpHostLoweringService()
  private let governanceService = PraxisMpMemoryGovernanceService()

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisArchiveMpCommand) async throws -> PraxisMpArchiveResult {
    let memoryStore = try requireSemanticMemoryStore(from: dependencies, capability: "MP archive")
    let persistedRecord = try await requireSemanticMemoryRecord(
      projectID: command.projectID,
      memoryID: command.memoryID,
      memoryStore: memoryStore,
      capability: "MP archive"
    )
    let timestamp = loweringService.normalizedTimestamp(command.archivedAt)
    let updatedRecord = try governanceService.archive(
      record: loweringService.mpMemoryRecord(
        from: persistedRecord,
        fallbackSessionID: persistedRecord.sessionID
      ),
      archivedAt: timestamp,
      reason: command.reason
    )
    _ = try await memoryStore.save(loweringService.semanticMemoryRecord(from: updatedRecord))

    return PraxisMpArchiveResult(
      projectID: command.projectID,
      memoryID: command.memoryID,
      summary: diagnosticsService.archiveSummary(memoryID: command.memoryID),
      scopeLevel: updatedRecord.scope.scopeLevel,
      sessionID: updatedRecord.scope.sessionID,
      sessionMode: updatedRecord.scope.sessionMode,
      visibilityState: updatedRecord.scope.visibilityState,
      promotionState: updatedRecord.scope.promotionState,
      updatedAt: timestamp,
      issues: []
    )
  }
}
