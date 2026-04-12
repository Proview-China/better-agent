import Foundation
import Testing
import PraxisCmpDelivery
import PraxisCoreTypes
import PraxisCmpTypes
import PraxisCapabilityResults
import PraxisGoal
import PraxisInfraContracts
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes
import PraxisProviderContracts
import PraxisRuntimeComposition
import PraxisRuntimeGateway
import PraxisRuntimeUseCases
import PraxisSession
import PraxisTapReview
import PraxisTapTypes
import PraxisToolingContracts
import PraxisUserIOContracts

private struct StubSemanticMemoryStore: PraxisSemanticMemoryStoreContract {
  let bundleResult: PraxisSemanticMemoryBundle
  let searchResults: [PraxisSemanticMemoryRecord]

  init(
    bundleResult: PraxisSemanticMemoryBundle,
    searchResults: [PraxisSemanticMemoryRecord] = []
  ) {
    self.bundleResult = bundleResult
    self.searchResults = searchResults
  }

  func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt {
    PraxisSemanticMemoryWriteReceipt(memoryID: record.id, storageKey: record.storageKey)
  }

  func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord? {
    nil
  }

  func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord] {
    Array(searchResults.prefix(request.limit))
  }

  func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle {
    bundleResult
  }
}

private func encodeUseCaseTestJSON<T: Encodable>(_ value: T) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  guard let string = String(data: try encoder.encode(value), encoding: .utf8) else {
    throw PraxisError.invariantViolation("Failed to encode use case test payload as UTF-8 JSON.")
  }
  return string
}

private func decodeUseCaseTestJSON<T: Decodable>(_ type: T.Type, from string: String) throws -> T {
  guard let data = string.data(using: .utf8) else {
    throw PraxisError.invalidInput("Failed to decode use case test payload from UTF-8 JSON.")
  }
  return try JSONDecoder().decode(type, from: data)
}

struct PraxisRuntimeUseCasesTests {
  @Test
  func mpHostDiagnosticsServiceBuildsStableFallbackIssuesAndSummaries() {
    let diagnosticsService = PraxisMpHostDiagnosticsService()

    #expect(
      diagnosticsService.missingSemanticMemoryStoreSummary(for: "search")
        == "MP search could not run because the semantic memory store is not wired into HostRuntime."
    )
    #expect(
      diagnosticsService.missingSemanticMemoryStoreIssue(for: "readback")
        == "MP readback requires a semantic memory store adapter."
    )
    #expect(
      diagnosticsService.semanticSearchFallbackIssue(for: "resolve")
        == "Semantic search index is not wired; MP resolve currently uses governance-only ranking."
    )
    #expect(
      diagnosticsService.smokeSummary(
        readyChecks: 3,
        totalChecks: 4,
        projectID: "mp.local-runtime"
      ) == "MP smoke reports 3/4 runtime gates ready for project mp.local-runtime."
    )
  }

  @Test
  func mpHostDiagnosticsServiceBuildsStableMutationAndRetrievalSummaries() {
    let diagnosticsService = PraxisMpHostDiagnosticsService()

    #expect(
      diagnosticsService.ingestSummary(
        updatedCount: 1,
        decision: .keep,
        primaryMemoryID: "memory.primary"
      ) == "MP ingest stored 1 record update(s) and finished with keep for memory.primary."
    )
    #expect(
      diagnosticsService.alignSummary(
        updatedCount: 2,
        decision: .supersedeExisting,
        memoryID: "memory.primary"
      ) == "MP align updated 2 record(s) and produced supersede_existing for memory.primary."
    )
    #expect(
      diagnosticsService.resolveSummary(
        primaryCount: 1,
        supportingCount: 1,
        query: "onboarding"
      ) == "MP resolve assembled 1 primary and 1 supporting memory record(s) for query onboarding."
    )
    #expect(
      diagnosticsService.historySummary(
        primaryCount: 1,
        supportingCount: 0,
        requesterAgentID: "runtime.local"
      ) == "MP history returned 1 primary and 0 supporting memory record(s) for runtime.local."
    )
    #expect(
      diagnosticsService.promoteSummary(
        memoryID: "memory.primary",
        promotionState: .promotedToProject,
        visibilityState: .projectShared
      ) == "MP promotion moved memory.primary to promoted_to_project with project_shared visibility."
    )
    #expect(
      diagnosticsService.archiveSummary(memoryID: "memory.primary")
        == "MP archive marked memory.primary archived while preserving persisted memory truth."
    )
  }

  @Test
  func mpHostInspectionServiceBuildsSmokeChecksFromAdapterReadiness() {
    let inspectionService = PraxisMpHostInspectionService()
    let hostAdapters = PraxisHostAdapterRegistry(
      providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
        PraxisProviderInferenceResponse(
          output: .init(summary: "stubbed inference"),
          receipt: .init(
            capabilityKey: "provider.infer",
            backend: "stub-provider",
            status: .succeeded,
            summary: "Inference is stubbed for MP inspection tests."
          )
        )
      },
      browserGroundingCollector: PraxisStubBrowserGroundingCollector { _ in
        PraxisBrowserGroundingEvidenceBundle(
          pages: [.init(role: .verifiedSource, url: "https://example.com", title: "Stub page")],
          facts: []
        )
      },
      semanticMemoryStore: StubSemanticMemoryStore(
        bundleResult: .init(
          primaryMemoryIDs: [],
          supportingMemoryIDs: [],
          omittedSupersededMemoryIDs: []
        )
      )
    )

    let smoke = inspectionService.smoke(
      projectID: "mp.local-runtime",
      hostAdapters: hostAdapters
    )

    #expect(smoke.summary == "MP smoke reports 3/4 runtime gates ready for project mp.local-runtime.")
    #expect(smoke.checks.map { $0.gate } == ["memory-store", "semantic-search", "provider-inference", "browser-grounding"])
    #expect(smoke.checks.first { $0.gate == "memory-store" }?.status == "ready")
    #expect(smoke.checks.first { $0.gate == "semantic-search" }?.status == "missing")
    #expect(smoke.checks.first { $0.gate == "provider-inference" }?.status == "ready")
    #expect(smoke.checks.first { $0.gate == "browser-grounding" }?.status == "ready")
  }

  @Test
  func mpHostInspectionServiceBuildsInspectionProjectionFromHostTruth() async throws {
    let inspectionService = PraxisMpHostInspectionService()
    let hostAdapters = PraxisHostAdapterRegistry(
      providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
        PraxisProviderInferenceResponse(
          output: .init(summary: "stubbed inference"),
          receipt: .init(
            capabilityKey: "provider.infer",
            backend: "stub-provider",
            status: .succeeded,
            summary: "Inference is stubbed for MP inspection tests."
          )
        )
      },
      browserGroundingCollector: PraxisStubBrowserGroundingCollector { _ in
        PraxisBrowserGroundingEvidenceBundle(
          pages: [.init(role: .verifiedSource, url: "https://example.com", title: "Stub page")],
          facts: []
        )
      },
      semanticSearchIndex: PraxisStubSemanticSearchIndex(
        cannedResults: [
          "host runtime": [
            .init(id: "match-1", score: 0.9, contentSummary: "Host runtime memory hit", storageKey: "memory/primary")
          ]
        ]
      ),
      semanticMemoryStore: StubSemanticMemoryStore(
        bundleResult: .init(
          primaryMemoryIDs: ["memory.primary"],
          supportingMemoryIDs: ["memory.supporting"],
          omittedSupersededMemoryIDs: ["memory.superseded"]
        )
      ),
      audioTranscriptionDriver: PraxisStubAudioTranscriptionDriver { _ in
        .init(transcript: "stub audio transcript")
      },
      speechSynthesisDriver: PraxisStubSpeechSynthesisDriver { _ in
        .init(audioAssetRef: "audio://stub.mp3", format: "mp3")
      },
      imageGenerationDriver: PraxisStubImageGenerationDriver { _ in
        .init(assetRef: "image://stub.png", mimeType: "image/png")
      }
    )

    let inspection = try await inspectionService.inspect(
      projectID: "mp.local-runtime",
      hostAdapters: hostAdapters
    )

    #expect(inspection.summary == "MP workflow surface is now reading HostRuntime memory and multimodal adapter state.")
    #expect(inspection.workflowSummary.contains("provider inference surface available"))
    #expect(inspection.memoryStoreSummary.contains("1 primary records and omits 1 superseded records"))
    #expect(inspection.memoryStoreSummary.contains("Semantic search matches for inspection query: 1."))
    #expect(inspection.multimodalSummary == "Multimodal host chips: audio.transcribe, speech.synthesize, image.generate, browser.ground")
    #expect(inspection.issues.isEmpty)
  }

  @Test
  func mpHostRetrievalServiceBuildsCandidateSnapshotWithSemanticScores() async throws {
    let retrievalService = PraxisMpHostRetrievalService()
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: [],
        supportingMemoryIDs: [],
        omittedSupersededMemoryIDs: []
      ),
      searchResults: [
        PraxisSemanticMemoryRecord(
          id: "memory.semantic-winner",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "semantic ranking candidate two",
          storageKey: "memory/two",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:00:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.lexical-first",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "semantic ranking candidate one",
          storageKey: "memory/one",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:00:00Z"
        ),
      ]
    )
    let searchIndex = PraxisStubSemanticSearchIndex(
      cannedResults: [
        "semantic": [
          .init(id: "match-2", score: 0.99, contentSummary: "semantic ranking candidate two", storageKey: "memory/two"),
          .init(id: "match-1", score: 0.10, contentSummary: "semantic ranking candidate one", storageKey: "memory/one"),
        ]
      ]
    )
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "semantic",
      scopeLevels: [.project],
      limit: 5,
      agentID: "runtime.local"
    )

    let snapshot = try await retrievalService.candidateSnapshot(
      plan: plan,
      memoryStore: memoryStore,
      semanticSearchIndex: searchIndex,
      limitMultiplier: 4,
      includeSemanticScores: true,
      fallbackOperation: "search"
    )

    #expect(snapshot.records.map(\.id) == ["memory.semantic-winner", "memory.lexical-first"])
    #expect(snapshot.candidateCount == 2)
    #expect(snapshot.semanticScoresByStorageKey["memory/two"] == 0.99)
    #expect(snapshot.semanticScoresByStorageKey["memory/one"] == 0.10)
    #expect(snapshot.issues.isEmpty)
  }

  @Test
  func mpHostRetrievalServiceBuildsCandidateSnapshotWithFallbackIssueWhenSemanticSearchIsMissing() async throws {
    let retrievalService = PraxisMpHostRetrievalService()
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: [],
        supportingMemoryIDs: [],
        omittedSupersededMemoryIDs: []
      ),
      searchResults: [
        PraxisSemanticMemoryRecord(
          id: "memory.primary",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "Host runtime onboarding note",
          storageKey: "memory/primary",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:05:00Z"
        )
      ]
    )
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "onboarding",
      scopeLevels: [.project],
      limit: 5,
      agentID: "runtime.local"
    )

    let snapshot = try await retrievalService.candidateSnapshot(
      plan: plan,
      memoryStore: memoryStore,
      semanticSearchIndex: nil,
      limitMultiplier: 10,
      includeSemanticScores: false,
      fallbackOperation: "readback"
    )

    #expect(snapshot.records.map(\.id) == ["memory.primary"])
    #expect(snapshot.candidateCount == 1)
    #expect(snapshot.semanticScoresByStorageKey.isEmpty)
    #expect(snapshot.issues == ["Semantic search index is not wired; readback currently reflects memory-store truth only."])
  }

  @Test
  func mpHostResultMappingServiceBuildsSearchResultFromProjection() {
    let resultMappingService = PraxisMpHostResultMappingService()
    let projection = PraxisMpSearchProjection(
      summary: "MP search returned 1 ranked hit from 2 candidates.",
      hits: [
        PraxisMpSearchProjectionHit(
          memoryID: "memory.primary",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          summary: "Host runtime onboarding note",
          storageKey: "memory/primary",
          semanticScore: 0.88,
          finalScore: 0.93,
          rankExplanation: "freshness=fresh, alignment=aligned, semantic=0.880"
        )
      ]
    )

    let result = resultMappingService.searchResult(
      projectID: "mp.local-runtime",
      query: "onboarding",
      projection: projection,
      issues: ["Semantic search index is not wired; ranking fell back to memory governance only."]
    )

    #expect(result.projectID == "mp.local-runtime")
    #expect(result.query == "onboarding")
    #expect(result.summary == projection.summary)
    #expect(result.hits.count == 1)
    #expect(result.hits.first?.memoryID == "memory.primary")
    #expect(result.hits.first?.semanticScore == 0.88)
    #expect(result.hits.first?.rankExplanation == "freshness=fresh, alignment=aligned, semantic=0.880")
    #expect(result.issues == ["Semantic search index is not wired; ranking fell back to memory governance only."])
  }

  @Test
  func mpHostResultMappingServiceBuildsReadbackResultFromProjection() {
    let resultMappingService = PraxisMpHostResultMappingService()
    let projection = PraxisMpReadbackProjection(
      summary: "MP readback summarized 3 memory record(s) across 2 scopes.",
      totalMemoryCount: 3,
      primaryCount: 1,
      supportingCount: 2,
      omittedSupersededCount: 1,
      freshnessBreakdown: ["fresh": 2, "aging": 1],
      alignmentBreakdown: ["aligned": 2, "unreviewed": 1],
      scopeBreakdown: ["project": 2, "session_bridged": 1]
    )

    let result = resultMappingService.readbackResult(
      projectID: "mp.local-runtime",
      projection: projection,
      issues: ["Semantic search index is not wired; readback currently reflects memory-store truth only."]
    )

    #expect(result.projectID == "mp.local-runtime")
    #expect(result.summary == projection.summary)
    #expect(result.totalMemoryCount == 3)
    #expect(result.primaryCount == 1)
    #expect(result.supportingCount == 2)
    #expect(result.omittedSupersededCount == 1)
    #expect(result.freshnessBreakdown == ["fresh": 2, "aging": 1])
    #expect(result.alignmentBreakdown == ["aligned": 2, "unreviewed": 1])
    #expect(result.scopeBreakdown == ["project": 2, "session_bridged": 1])
    #expect(result.issues == ["Semantic search index is not wired; readback currently reflects memory-store truth only."])
  }

  @Test
  func mpHostLoweringServiceRoundTripsSemanticMemoryTruthAndRequests() async throws {
    let loweringService = PraxisMpHostLoweringService()
    let semanticRecord = PraxisSemanticMemoryRecord(
      id: "memory.host.lowering",
      projectID: "mp.local-runtime",
      agentID: "runtime.local",
      sessionID: "mp.session",
      scopeLevel: .session,
      sessionMode: .bridged,
      visibilityState: .sessionBridged,
      promotionState: .acceptedByParent,
      memoryKind: .summary,
      summary: "Shared onboarding summary",
      storageKey: "memory/primary",
      freshnessStatus: .aging,
      alignmentStatus: .aligned,
      sourceRefs: ["payload-a"],
      tags: ["history"],
      semanticGroupID: "semantic.onboarding",
      confidence: .high,
      lineagePath: ["agent.runtime.local", "session.mp"],
      createdAt: "2026-04-11T10:00:00Z",
      updatedAt: "2026-04-11T10:05:00Z",
      metadata: ["seed": .string("true")],
      embeddingStorageKey: "embed/primary"
    )

    let mpRecord = loweringService.mpMemoryRecord(from: semanticRecord)
    let roundTripRecord = loweringService.semanticMemoryRecord(from: mpRecord)
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "onboarding",
      scopeLevels: [.agentIsolated, .project],
      limit: 2,
      agentID: "runtime.local",
      sessionID: "mp.session",
      includeSuperseded: true
    )
    let searchRequest = loweringService.searchRequest(from: plan, limitMultiplier: 4)
    let bundleRequest = loweringService.bundleRequest(from: plan)
    let ingestCommand = PraxisIngestMpCommand(
      projectID: "mp.local-runtime",
      agentID: "runtime.local",
      sessionID: "mp.session",
      summary: "Host runtime onboarding note",
      checkedSnapshotRef: "snapshot.mp.1",
      branchRef: "main"
    )
    let ingestScope = loweringService.scopeDescriptor(from: ingestCommand)
    let storageKey = loweringService.storageKey(from: ingestCommand, artifactID: "artifact.test")

    #expect(mpRecord.scope.scopeLevel == .agentIsolated)
    #expect(mpRecord.scope.sessionID == "mp.session")
    #expect(mpRecord.embedding?.vectorRef == "embed/primary")
    #expect(roundTripRecord == semanticRecord)
    #expect(searchRequest.limit == 8)
    #expect(searchRequest.scopeLevels == [.agent, .project, .session])
    #expect(searchRequest.agentID == "runtime.local")
    #expect(searchRequest.sessionID == "mp.session")
    #expect(bundleRequest.includeSuperseded)
    #expect(ingestScope.sessionMode == .bridged)
    #expect(ingestScope.visibilityState == .sessionBridged)
    #expect(storageKey == "memory/mp.local-runtime/runtime.local/mp.session/artifact.test")
  }

  @Test
  func mpHostLoweringServicePersistsAndReloadsSeedRecords() async throws {
    let loweringService = PraxisMpHostLoweringService()
    let memoryStore = PraxisFakeSemanticMemoryStore()
    let mpRecord = PraxisMpMemoryRecord(
      id: "memory.persisted",
      scope: PraxisMpScopeDescriptor(
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: "mp.session",
        scopeLevel: .agentIsolated,
        sessionMode: .bridged,
        visibilityState: .sessionBridged,
        promotionState: .submittedToParent,
        metadata: ["seed": .string("true")]
      ),
      summary: "Persisted host lowering note",
      storageKey: "memory/persisted",
      memoryKind: .semantic,
      freshness: .init(status: .fresh),
      confidence: .medium,
      alignment: .init(status: .aligned),
      sourceRefs: ["payload-a"],
      tags: ["history"],
      semanticGroupID: "semantic.persisted",
      embedding: .init(vectorRef: "embed/persisted"),
      createdAt: "2026-04-11T10:00:00Z",
      updatedAt: "2026-04-11T10:05:00Z",
      metadata: ["seed": .string("true")]
    )

    try await loweringService.persist([mpRecord], using: memoryStore)
    let seedRecords = try await loweringService.loadSeedRecords(
      projectID: "mp.local-runtime",
      fallbackSessionID: "mp.session",
      memoryStore: memoryStore
    )

    #expect(seedRecords == [mpRecord])
  }

  @Test
  func mpHostRetrievalServiceBuildsWorkflowBundleAndDispatcherTelemetry() async throws {
    let retrievalService = PraxisMpHostRetrievalService()
    let memoryStore = PraxisFakeSemanticMemoryStore(
      seedRecords: [
        PraxisSemanticMemoryRecord(
          id: "memory.primary",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "Host runtime onboarding note",
          storageKey: "memory/primary",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:05:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.supporting",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "Host runtime onboarding note supporting",
          storageKey: "memory/supporting",
          freshnessStatus: .aging,
          alignmentStatus: .unreviewed,
          updatedAt: "2026-04-11T10:04:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.superseded",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "Host runtime onboarding note superseded",
          storageKey: "memory/superseded",
          freshnessStatus: .superseded,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:03:00Z"
        ),
      ]
    )
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "onboarding",
      scopeLevels: [.project],
      limit: 5,
      agentID: "runtime.local"
    )

    let bundle = try await retrievalService.bundle(
      plan: plan,
      requesterAgentID: "runtime.local",
      requesterSessionID: nil,
      memoryStore: memoryStore
    )
    let dispatcherTelemetry = retrievalService.dispatcherTelemetry()

    #expect(bundle.primary.map(\.id) == ["memory.primary"])
    #expect(bundle.supporting.map(\.id) == ["memory.supporting"])
    #expect(bundle.diagnostics.omittedSupersededMemoryIDs == ["memory.superseded"])
    #expect(dispatcherTelemetry.roleCounts == ["dispatcher": 1])
    #expect(dispatcherTelemetry.roleStages == ["dispatcher": "assemble_bundle"])
  }

  @Test
  func mpHostRetrievalServiceUsesSemanticSearchScoresWhenAvailable() async throws {
    let retrievalService = PraxisMpHostRetrievalService()
    let memoryStore = PraxisFakeSemanticMemoryStore(
      seedRecords: [
        PraxisSemanticMemoryRecord(
          id: "memory.lexical-first",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "semantic ranking candidate one",
          storageKey: "memory/one",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:00:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.semantic-winner",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "semantic ranking candidate two",
          storageKey: "memory/two",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-11T10:00:00Z"
        ),
      ]
    )
    let semanticSearchIndex = PraxisStubSemanticSearchIndex(
      cannedResults: [
        "semantic": [
          .init(id: "match-2", score: 0.99, contentSummary: "semantic ranking candidate two", storageKey: "memory/two"),
          .init(id: "match-1", score: 0.10, contentSummary: "semantic ranking candidate one", storageKey: "memory/one"),
        ]
      ]
    )
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "semantic",
      scopeLevels: [.project],
      limit: 5,
      agentID: "runtime.local"
    )

    let bundle = try await retrievalService.bundle(
      plan: plan,
      requesterAgentID: "runtime.local",
      requesterSessionID: nil,
      memoryStore: memoryStore,
      semanticSearchIndex: semanticSearchIndex
    )

    #expect(bundle.primary.map(\.id) == ["memory.semantic-winner"])
    #expect(bundle.supporting.map(\.id) == ["memory.lexical-first"])
  }

  @Test
  func cmpProjectUseCasesBuildNeutralSessionBootstrapReadbackAndSmoke() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-project-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let dependencies = try makeDependencies(rootDirectory: rootDirectory)
    let openSessionUseCase = PraxisOpenCmpSessionUseCase(dependencies: dependencies)
    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: dependencies)
    let readbackProjectUseCase = PraxisReadbackCmpProjectUseCase(dependencies: dependencies)
    let smokeProjectUseCase = PraxisSmokeCmpProjectUseCase(dependencies: dependencies)

    let session = try await openSessionUseCase.execute(
      PraxisOpenCmpSessionCommand(projectID: "cmp.local-runtime", sessionID: "cmp.session.usecases")
    )
    let bootstrap = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let readback = try await readbackProjectUseCase.execute(
      PraxisReadbackCmpProjectCommand(projectID: "cmp.local-runtime")
    )
    let smoke = try await smokeProjectUseCase.execute(
      PraxisSmokeCmpProjectCommand(projectID: "cmp.local-runtime")
    )

    #expect(session.projectID == "cmp.local-runtime")
    #expect(session.sessionID == "cmp.session.usecases")
    #expect(session.hostProfile.executionStyle == .localFirst)
    #expect(session.summary.contains("host-neutral CMP session"))
    #expect(bootstrap.projectID == "cmp.local-runtime")
    #expect(bootstrap.hostProfile.structuredStore == .sqlite)
    #expect(bootstrap.gitBranchRuntimes.count == 2)
    #expect(bootstrap.lineages.count == 2)
    #expect(readback.projectID == "cmp.local-runtime")
    let gitExecutorStatus = try #require(readback.componentStatuses[.gitExecutor])
    let gitSmokeCheck = try #require(smoke.checks.first { $0.gate == .git })
    #expect(readback.hostProfile.messageTransport == .inProcessActorBus)
    #expect(readback.componentStatuses[.structuredStore] == .ready)
    #expect(gitExecutorStatus != .missing)
    #expect(readback.persistenceSummary.contains("Checkpoint and journal persistence"))
    #expect(smoke.projectID == "cmp.local-runtime")
    #expect(smoke.checks.count == 5)
    #expect(gitSmokeCheck.status == gitExecutorStatus)
    #expect(smoke.checks.map(\.gate).contains(.workspace))
    #expect(smoke.checks.map(\.gate).contains(.lineage))
  }

  @Test
  func cmpProjectSmokeRoundTripsTypedGateAndStatusAndRejectsUnknownValues() throws {
    let smoke = PraxisCmpProjectSmoke(
      projectID: "cmp.local-runtime",
      summary: "CMP smoke summary",
      checks: [
        .init(
          id: "cmp.project.git",
          gate: .git,
          status: .ready,
          summary: "Git readiness is ready."
        ),
        .init(
          id: "cmp.project.lineage",
          gate: .lineage,
          status: .degraded,
          summary: "Lineage readiness is degraded."
        ),
      ]
    )

    let encoded = try encodeUseCaseTestJSON(smoke)
    let decoded = try decodeUseCaseTestJSON(PraxisCmpProjectSmoke.self, from: encoded)

    #expect(encoded.contains(#""gate":"git""#))
    #expect(encoded.contains(#""status":"ready""#))
    #expect(decoded.checks.first?.gate == .git)
    #expect(decoded.checks.last?.status == .degraded)

    let invalidGateJSON =
      #"{"checks":[{"gate":"broken_gate","id":"cmp.project.git","status":"ready","summary":"Git readiness is ready."}],"projectID":"cmp.local-runtime","summary":"CMP smoke summary"}"#

    #expect(throws: DecodingError.self) {
      try decodeUseCaseTestJSON(PraxisCmpProjectSmoke.self, from: invalidGateJSON)
    }
  }

  @Test
  func cmpProjectReadbackRoundTripsTypedHostProfileAndComponentStatuses() throws {
    let readback = PraxisCmpProjectReadback(
      projectID: "cmp.local-runtime",
      summary: "CMP project readback",
      hostSummary: "local runtime summary",
      persistenceSummary: "sqlite persistence",
      coordinationSummary: "actor bus ready",
      hostProfile: .init(
        executionStyle: .localFirst,
        structuredStore: .sqlite,
        deliveryStore: .sqlite,
        messageTransport: .inProcessActorBus,
        gitAccess: .systemGit,
        semanticIndex: .localSemanticIndex
      ),
      componentStatuses: .init(statuses: [
        .structuredStore: .ready,
        .gitExecutor: .degraded,
      ]),
      issues: []
    )

    let encoded = try encodeUseCaseTestJSON(readback)
    let decoded = try decodeUseCaseTestJSON(PraxisCmpProjectReadback.self, from: encoded)

    #expect(encoded.contains(#""executionStyle":"local-first""#))
    #expect(encoded.contains(#""componentStatuses":{"gitExecutor":"degraded","structuredStore":"ready"}"#))
    #expect(decoded.hostProfile.executionStyle == .localFirst)
    #expect(decoded.hostProfile.semanticIndex == .localSemanticIndex)
    #expect(decoded.componentStatuses[.gitExecutor] == .degraded)
  }

  @Test
  func cmpProjectReadbackDecodeRejectsUnknownTypedHostProfileAndComponentStatuses() throws {
    let cases = [
      #"{"componentStatuses":{"structuredStore":"ready"},"coordinationSummary":"actor bus ready","hostProfile":{"deliveryStore":"sqlite","executionStyle":"broken_style","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"hostSummary":"local runtime summary","issues":[],"persistenceSummary":"sqlite persistence","projectID":"cmp.local-runtime","summary":"CMP project readback"}"#,
      #"{"componentStatuses":{"structuredStore":"broken_status"},"coordinationSummary":"actor bus ready","hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"hostSummary":"local runtime summary","issues":[],"persistenceSummary":"sqlite persistence","projectID":"cmp.local-runtime","summary":"CMP project readback"}"#,
      #"{"componentStatuses":{"broken_component":"ready"},"coordinationSummary":"actor bus ready","hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"hostSummary":"local runtime summary","issues":[],"persistenceSummary":"sqlite persistence","projectID":"cmp.local-runtime","summary":"CMP project readback"}"#
    ]

    for json in cases {
      #expect(throws: DecodingError.self) {
        try decodeUseCaseTestJSON(PraxisCmpProjectReadback.self, from: json)
      }
    }
  }

  @Test
  func cmpFlowUseCasesReturnDomainModelsWithoutFacadeProjection() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-flow-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let dependencies = try makeDependencies(rootDirectory: rootDirectory)
    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: dependencies)
    let ingestFlowUseCase = PraxisIngestCmpFlowUseCase(dependencies: dependencies)
    let commitFlowUseCase = PraxisCommitCmpFlowUseCase(dependencies: dependencies)
    let runGoalUseCase = PraxisRunGoalUseCase(dependencies: dependencies)
    let resolveFlowUseCase = PraxisResolveCmpFlowUseCase(dependencies: dependencies)
    let materializeFlowUseCase = PraxisMaterializeCmpFlowUseCase(dependencies: dependencies)
    let dispatchFlowUseCase = PraxisDispatchCmpFlowUseCase(dependencies: dependencies)
    let readbackRolesUseCase = PraxisReadbackCmpRolesUseCase(dependencies: dependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: dependencies)

    _ = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let ingest = try await ingestFlowUseCase.execute(
      PraxisIngestCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.usecases",
        taskSummary: "Capture one runtime context material",
        materials: [
          PraxisCmpRuntimeContextMaterial(kind: .userInput, ref: "payload:user:usecases")
        ],
        requiresActiveSync: true
      )
    )
    let commit = try await commitFlowUseCase.execute(
      PraxisCommitCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.usecases",
        eventIDs: ["evt.usecases.1"],
        changeSummary: "Commit one runtime context event",
        syncIntent: .toParent
      )
    )
    _ = try await runGoalUseCase.execute(
      PraxisRunGoalCommand(
        goal: .init(
          normalizedGoal: .init(
            id: .init(rawValue: "goal.cmp-usecases-resolve"),
            title: "CMP Use Case Resolve Seed",
            summary: "Seed projection for CMP flow readback typing"
          ),
          intentSummary: "Seed projection for CMP flow readback typing"
        ),
        sessionID: .init(rawValue: "session.cmp-usecases-resolve")
      )
    )
    let resolve = try await resolveFlowUseCase.execute(
      PraxisResolveCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local"
      )
    )
    let materialize = try await materializeFlowUseCase.execute(
      PraxisMaterializeCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal
      )
    )
    let dispatch = try await dispatchFlowUseCase.execute(
      PraxisDispatchCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: materialize.result.contextPackage,
        targetKind: .peer,
        reason: "Dispatch runtime fill to checker"
      )
    )
    let roles = try await readbackRolesUseCase.execute(
      PraxisReadbackCmpRolesCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let status = try await readbackStatusUseCase.execute(
      PraxisReadbackCmpStatusCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    #expect(ingest.projectID == "cmp.local-runtime")
    #expect(ingest.agentID == "runtime.local")
    #expect(ingest.sessionID == "cmp.flow.usecases")
    #expect(ingest.result.acceptedEventIDs.count == 1)
    #expect(ingest.result.nextAction == .commitContextDelta)
    #expect(ingest.ingress.sections.count == 1)
    #expect(ingest.loweredSections.isEmpty == false)
    #expect(commit.projectID == "cmp.local-runtime")
    #expect(commit.agentID == "runtime.local")
    #expect(commit.result.delta.eventRefs.map(\.rawValue) == ["evt.usecases.1"])
    #expect(commit.activeLine.stage == .candidateReady)
    #expect(commit.snapshotCandidate.deltaRefs == [commit.result.delta.id])
    #expect(resolve.result.status == .resolved)
    #expect(resolve.snapshot?.qualityLabel == .usable)
    #expect(materialize.result.contextPackage.kind == .runtimeFill)
    #expect(dispatch.result.receipt.targetKind == .peer)
    #expect(dispatch.result.receipt.status == .delivered)
    #expect(roles.projectID == "cmp.local-runtime")
    #expect(roles.agentID == "checker.local")
    #expect(roles.roles.map(\.role) == [.icma, .iterator, .checker, .dbAgent, .dispatcher])
    #expect(roles.roles.first(where: { $0.role == .icma })?.latestStage == .ingested)
    #expect(roles.roles.first(where: { $0.role == .iterator })?.latestStage == nil)
    #expect(roles.roles.first(where: { $0.role == .checker })?.latestStage == nil)
    #expect(roles.roles.first(where: { $0.role == .dbAgent })?.latestStage == .materialized)
    #expect(roles.roles.first(where: { $0.role == .dispatcher })?.latestStage == .delivered)
    #expect(roles.latestDispatchStatus == .delivered)
    #expect(!roles.summary.contains("CLI"))
    #expect(!roles.summary.contains("GUI"))
    #expect(status.projectID == "cmp.local-runtime")
    #expect(status.agentID == "checker.local")
    #expect(status.latestDispatchStatus == .delivered)
    #expect(status.roles.isEmpty == false)
  }

  @Test
  func cmpFlowIngestReturnsNoopNextActionWhenActiveSyncIsDisabled() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-ingest-noop-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let dependencies = try makeDependencies(rootDirectory: rootDirectory)
    let ingestUseCase = PraxisIngestCmpFlowUseCase(dependencies: dependencies)

    let ingest = try await ingestUseCase.execute(
      PraxisIngestCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.noop",
        taskSummary: "Capture one runtime material without active sync",
        materials: [
          PraxisCmpRuntimeContextMaterial(kind: .userInput, ref: "payload:user:noop")
        ],
        requiresActiveSync: false
      )
    )

    #expect(ingest.projectID == "cmp.local-runtime")
    #expect(ingest.result.nextAction == PraxisCmpFlowIngestNextAction.noop)
    #expect(ingest.result.acceptedEventIDs.count == 1)
  }

  @Test
  func retryDispatchUseCaseRejectsCorruptedPersistedDispatchTargetMetadata() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-dispatch-target-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let retryDispatchUseCase = PraxisRetryCmpDispatchUseCase(dependencies: dependencies)

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "blocked_by_tap_gate": .bool(true),
          "dispatch_target_kind": .string("broken_target_kind"),
          "last_dispatch_status": .string(PraxisCmpDispatchStatus.rejected.rawValue),
        ]
      )
    )

    do {
      _ = try await retryDispatchUseCase.execute(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: "projection.runtime.local:checker.local:runtimeFill"
        )
      )
      Issue.record("Expected retryCmpDispatch to reject corrupted persisted dispatch target metadata.")
    } catch let error as PraxisError {
      guard case let .invalidInput(message) = error else {
        Issue.record("Expected invalidInput from retryCmpDispatch, got \(error).")
        return
      }
      #expect(message.contains("dispatch_target_kind"))
      #expect(message.contains("broken_target_kind"))
    } catch {
      Issue.record("Expected PraxisError.invalidInput from retryCmpDispatch, got \(error).")
    }
  }

  @Test
  func retryDispatchUseCaseRejectsCorruptedPersistedDispatchStatusMetadata() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-dispatch-status-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let retryDispatchUseCase = PraxisRetryCmpDispatchUseCase(dependencies: dependencies)

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "blocked_by_tap_gate": .bool(true),
          "dispatch_target_kind": .string(PraxisCmpDispatchTargetKind.peer.rawValue),
          "last_dispatch_status": .string("broken_dispatch_status"),
        ]
      )
    )

    do {
      _ = try await retryDispatchUseCase.execute(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: "projection.runtime.local:checker.local:runtimeFill"
        )
      )
      Issue.record("Expected retryCmpDispatch to reject corrupted persisted dispatch status metadata.")
    } catch let error as PraxisError {
      guard case let .invalidInput(message) = error else {
        Issue.record("Expected invalidInput from retryCmpDispatch, got \(error).")
        return
      }
      #expect(message.contains("last_dispatch_status"))
      #expect(message.contains("broken_dispatch_status"))
    } catch {
      Issue.record("Expected PraxisError.invalidInput from retryCmpDispatch, got \(error).")
    }
  }

  @Test
  func cmpReadbackPrefersNewerDeliveryTruthAndNeutralizesDispatcherStage() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-newer-delivery-truth-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackRolesUseCase = PraxisReadbackCmpRolesUseCase(dependencies: dependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: dependencies)
    let packageID = PraxisCmpPackageID(rawValue: "projection.runtime.local:checker.local:runtimeFill")

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: packageID,
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "last_dispatch_status": .string(PraxisCmpDispatchStatus.prepared.rawValue),
        ]
      )
    )
    _ = try await registry.deliveryTruthStore?.save(
      .init(
        id: "delivery.projection.runtime.local:checker.local:runtimeFill",
        packageID: packageID,
        topic: "cmp.dispatch.checker.local",
        targetAgentID: "checker.local",
        status: .published,
        payloadSummary: "Dispatch runtime fill to checker",
        updatedAt: "2026-04-11T00:05:00Z"
      )
    )

    let roles = try await readbackRolesUseCase.execute(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let status = try await readbackStatusUseCase.execute(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let dispatcher = try #require(roles.roles.first(where: { $0.role == .dispatcher }))

    #expect(roles.latestDispatchStatus == .delivered)
    #expect(status.latestDispatchStatus == .delivered)
    #expect(dispatcher.latestStage == .delivered)
    #expect(dispatcher.latestStage?.rawValue != PraxisDeliveryTruthStatus.published.rawValue)
  }

  @Test
  func cmpReadbackUseCasesPreserveRetryScheduledLatestDispatchStatus() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-retry-scheduled-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackRolesUseCase = PraxisReadbackCmpRolesUseCase(dependencies: dependencies)
    let readbackControlUseCase = PraxisReadbackCmpControlUseCase(dependencies: dependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: dependencies)
    let packageID = PraxisCmpPackageID(rawValue: "projection.runtime.local:checker.local:runtimeFill")

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: packageID,
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:10:00Z",
        metadata: [
          "last_dispatch_status": .string(PraxisCmpDispatchStatus.rejected.rawValue),
          "last_dispatch_updated_at": .string("2026-04-11T00:00:00Z"),
        ]
      )
    )
    _ = try await registry.deliveryTruthStore?.save(
      .init(
        id: "delivery.retry.projection.runtime.local:checker.local:runtimeFill",
        packageID: packageID,
        topic: "cmp.dispatch.checker.local",
        targetAgentID: "checker.local",
        status: .retryScheduled,
        payloadSummary: "Retry dispatch runtime fill to checker",
        updatedAt: "2026-04-11T00:05:00Z"
      )
    )

    let roles = try await readbackRolesUseCase.execute(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let control = try await readbackControlUseCase.execute(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let status = try await readbackStatusUseCase.execute(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    let dispatcher = try #require(roles.roles.first(where: { $0.role == .dispatcher }))
    #expect(roles.latestDispatchStatus == .retryScheduled)
    #expect(control.latestDispatchStatus == .retryScheduled)
    #expect(status.latestDispatchStatus == .retryScheduled)
    #expect(dispatcher.latestStage == .retryScheduled)
  }

  @Test
  func cmpReadbackUseCasesRejectCorruptedPersistedDispatchStatusMetadata() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-readback-dispatch-status-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackRolesUseCase = PraxisReadbackCmpRolesUseCase(dependencies: dependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: dependencies)

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "last_dispatch_status": .string("broken_dispatch_status"),
        ]
      )
    )

    let operations: [(String, () async throws -> Void)] = [
      (
        "readbackCmpRoles",
        {
          _ = try await readbackRolesUseCase.execute(.init(projectID: "cmp.local-runtime", agentID: "checker.local"))
        }
      ),
      (
        "readbackCmpStatus",
        {
          _ = try await readbackStatusUseCase.execute(.init(projectID: "cmp.local-runtime", agentID: "checker.local"))
        }
      ),
    ]

    for (label, operation) in operations {
      do {
        try await operation()
        Issue.record("Expected \(label) to reject corrupted persisted dispatch status metadata.")
      } catch let error as PraxisError {
        guard case let .invalidInput(message) = error else {
          Issue.record("Expected invalidInput from \(label), got \(error).")
          continue
        }
        #expect(message.contains("last_dispatch_status"))
        #expect(message.contains("broken_dispatch_status"))
      } catch {
        Issue.record("Expected PraxisError.invalidInput from \(label), got \(error).")
      }
    }
  }

  @Test
  func cmpControlAndApprovalUseCasesPersistAcrossIndependentDependencyGraphs() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-readback-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let firstDependencies = try makeDependencies(rootDirectory: rootDirectory)
    let secondDependencies = try makeDependencies(rootDirectory: rootDirectory)

    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: firstDependencies)
    let updateControlUseCase = PraxisUpdateCmpControlUseCase(dependencies: firstDependencies)
    let requestApprovalUseCase = PraxisRequestCmpPeerApprovalUseCase(dependencies: firstDependencies)
    let decideApprovalUseCase = PraxisDecideCmpPeerApprovalUseCase(dependencies: firstDependencies)

    let readbackControlUseCase = PraxisReadbackCmpControlUseCase(dependencies: secondDependencies)
    let readbackApprovalUseCase = PraxisReadbackCmpPeerApprovalUseCase(dependencies: secondDependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: secondDependencies)

    _ = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let updatedControl = try await updateControlUseCase.execute(
      PraxisUpdateCmpControlCommand(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        readbackPriority: .packageFirst,
        fallbackPolicy: .registryOnly,
        recoveryPreference: .resumeLatest,
        automation: ["autoDispatch": false]
      )
    )
    let requestedApproval = try await requestApprovalUseCase.execute(
      PraxisRequestCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decidedApproval = try await decideApprovalUseCase.execute(
      PraxisDecideCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let controlReadback = try await readbackControlUseCase.execute(
      PraxisReadbackCmpControlCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let approvalReadback = try await readbackApprovalUseCase.execute(
      PraxisReadbackCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )
    let statusReadback = try await readbackStatusUseCase.execute(
      PraxisReadbackCmpStatusCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    #expect(updatedControl.control.executionStyle == .manual)
    #expect(updatedControl.control.mode == .peerReview)
    #expect(updatedControl.control.fallbackPolicy == .registryOnly)
    #expect(updatedControl.control.recoveryPreference == .resumeLatest)
    #expect(updatedControl.control.automation["autoDispatch"] == false)
    #expect(requestedApproval.route == .humanReview)
    #expect(requestedApproval.outcome == .escalatedToHuman)
    #expect(requestedApproval.humanGateState == .waitingApproval)
    #expect(decidedApproval.outcome == .approvedByHuman)
    #expect(decidedApproval.humanGateState == .approved)
    #expect(decidedApproval.decisionSummary == "Approved git access for checker")
    #expect(controlReadback.projectID == "cmp.local-runtime")
    #expect(controlReadback.agentID == "checker.local")
    #expect(controlReadback.control.executionStyle == .manual)
    #expect(controlReadback.control.mode == .peerReview)
    #expect(controlReadback.control.readbackPriority == .packageFirst)
    #expect(controlReadback.control.fallbackPolicy == .registryOnly)
    #expect(controlReadback.control.recoveryPreference == .resumeLatest)
    #expect(controlReadback.control.automation["autoDispatch"] == false)
    #expect(approvalReadback.found)
    #expect(approvalReadback.capabilityKey == "tool.git")
    #expect(approvalReadback.requestedTier == .b1)
    #expect(approvalReadback.route == .humanReview)
    #expect(approvalReadback.outcome == .approvedByHuman)
    #expect(approvalReadback.tapMode == .restricted)
    #expect(approvalReadback.humanGateState == .approved)
    #expect(approvalReadback.decisionSummary == "Approved git access for checker")
    #expect(statusReadback.projectID == "cmp.local-runtime")
    #expect(statusReadback.agentID == "checker.local")
    #expect(statusReadback.control.executionStyle == .manual)
    #expect(statusReadback.control.mode == .peerReview)
    #expect(statusReadback.control.fallbackPolicy == .registryOnly)
    #expect(statusReadback.control.recoveryPreference == .resumeLatest)
    #expect(statusReadback.control.automation["autoDispatch"] == false)
    #expect(statusReadback.roles.isEmpty == false)
  }

  @Test
  func tapReadbackUseCasesSurfaceTypedPeerApprovalAndStatusWhileHistoryStaysDisplayOriented() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-tap-readback-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let updateControlUseCase = PraxisUpdateCmpControlUseCase(dependencies: dependencies)
    let requestApprovalUseCase = PraxisRequestCmpPeerApprovalUseCase(dependencies: dependencies)
    let readbackTapStatusUseCase = PraxisReadbackTapStatusUseCase(dependencies: dependencies)
    let readbackTapHistoryUseCase = PraxisReadbackTapHistoryUseCase(dependencies: dependencies)

    _ = try await updateControlUseCase.execute(
      PraxisUpdateCmpControlCommand(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        automation: ["autoDispatch": false]
      )
    )
    _ = try await requestApprovalUseCase.execute(
      PraxisRequestCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.shell.exec",
        requestedTier: .b2,
        summary: "Escalate shell execution for checker"
      )
    )

    let tapStatus = try await readbackTapStatusUseCase.execute(
      PraxisReadbackTapStatusCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let tapHistory = try await readbackTapHistoryUseCase.execute(
      PraxisReadbackTapHistoryCommand(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
    )

    #expect(tapStatus.tapMode == .restricted)
    #expect(tapStatus.humanGateState == .waitingApproval)
    let containsEscalatedApproval = tapHistory.entries.contains { entry in
      entry.capabilityKey == "tool.shell.exec"
        && entry.requestedTier == .b2
        && entry.route == .toolReview
        && entry.outcome == .redirectedToProvisioning
        && entry.humanGateState == .waitingApproval
    }
    #expect(containsEscalatedApproval)
  }

  @Test
  func cmpPeerApprovalReadbackRejectsCorruptedPersistedTypedRawValues() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-peer-approval-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackApprovalUseCase = PraxisReadbackCmpPeerApprovalUseCase(dependencies: dependencies)

    _ = try await registry.cmpPeerApprovalStore?.save(
      PraxisCmpPeerApprovalDescriptor(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: PraxisTapCapabilityTier.b1.rawValue,
        tapMode: PraxisTapMode.restricted.rawValue,
        riskLevel: PraxisTapRiskLevel.normal.rawValue,
        route: "not_a_real_route",
        outcome: PraxisReviewRoutingOutcome.escalatedToHuman.rawValue,
        humanGateState: PraxisHumanGateState.waitingApproval.rawValue,
        summary: "Persisted corrupted approval",
        decisionSummary: "Corrupted route should fail decoding",
        requestedAt: "2026-04-12T00:00:00Z",
        updatedAt: "2026-04-12T00:00:00Z"
      )
    )

    await #expect(throws: PraxisError.self) {
      try await readbackApprovalUseCase.execute(
        PraxisReadbackCmpPeerApprovalCommand(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: "tool.git"
        )
      )
    }
  }

  @Test
  func tapHistoryReadbackRejectsInvalidPersistedRouteRawValue() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-tap-history-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackTapHistoryUseCase = PraxisReadbackTapHistoryUseCase(dependencies: dependencies)

    _ = try await registry.tapRuntimeEventStore?.append(
      PraxisTapRuntimeEventRecord(
        eventID: "tap.invalid.route",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        eventKind: "peer_approval_requested",
        capabilityKey: "tool.git",
        summary: "Corrupted TAP route",
        createdAt: "2026-04-12T00:00:00Z",
        metadata: [
          "requestedTier": .string(PraxisTapCapabilityTier.b1.rawValue),
          "route": .string("not_a_real_route"),
          "outcome": .string(PraxisReviewRoutingOutcome.escalatedToHuman.rawValue),
          "humanGateState": .string(PraxisHumanGateState.waitingApproval.rawValue),
        ]
      )
    )

    await #expect(throws: PraxisError.self) {
      try await readbackTapHistoryUseCase.execute(
        PraxisReadbackTapHistoryCommand(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
      )
    }
  }

  @Test
  func cmpControlUseCasesRejectCorruptedPersistedDescriptorsInsteadOfNormalizingToBaseline() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-corrupted-control-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let dependencies = try makeDependencies(hostAdapters: registry)
    let readbackControlUseCase = PraxisReadbackCmpControlUseCase(dependencies: dependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: dependencies)
    let updateControlUseCase = PraxisUpdateCmpControlUseCase(dependencies: dependencies)

    let corruptedFields = [
      ("executionStyle", "not_a_real_execution_style"),
      ("mode", "not_a_real_mode"),
      ("fallbackPolicy", "registry_only_but_corrupted"),
    ]

    for corruptedField in corruptedFields {
      _ = try await registry.cmpControlStore?.save(
        PraxisCmpControlDescriptor(
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          executionStyle: corruptedField.0 == "executionStyle"
            ? corruptedField.1
            : PraxisCmpExecutionStyle.manual.rawValue,
          mode: corruptedField.0 == "mode"
            ? corruptedField.1
            : PraxisCmpControlMode.peerReview.rawValue,
          readbackPriority: PraxisCmpReadbackPriority.packageFirst.rawValue,
          fallbackPolicy: corruptedField.0 == "fallbackPolicy"
            ? corruptedField.1
            : PraxisCmpFallbackPolicy.registryOnly.rawValue,
          recoveryPreference: PraxisCmpRecoveryPreference.resumeLatest.rawValue,
          automation: ["autoDispatch": false],
          updatedAt: "2026-04-12T00:00:00Z"
        )
      )

      do {
        _ = try await readbackControlUseCase.execute(
          PraxisReadbackCmpControlCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
        )
        Issue.record("Expected readbackCmpControl to reject corrupted persisted control descriptors.")
      } catch let error as PraxisError {
        guard case let .invalidInput(message) = error else {
          Issue.record("Expected invalidInput from readbackCmpControl, got \(error).")
          return
        }
        #expect(message.contains(corruptedField.0))
        #expect(message.contains(corruptedField.1))
      } catch {
        Issue.record("Expected PraxisError.invalidInput from readbackCmpControl, got \(error).")
      }

      do {
        _ = try await updateControlUseCase.execute(
          PraxisUpdateCmpControlCommand(
            projectID: "cmp.local-runtime",
            agentID: "checker.local",
            automation: ["autoDispatch": true]
          )
        )
        Issue.record("Expected updateCmpControl to reject corrupted persisted control descriptors.")
      } catch let error as PraxisError {
        guard case let .invalidInput(message) = error else {
          Issue.record("Expected invalidInput from updateCmpControl, got \(error).")
          return
        }
        #expect(message.contains(corruptedField.0))
        #expect(message.contains(corruptedField.1))
      } catch {
        Issue.record("Expected PraxisError.invalidInput from updateCmpControl, got \(error).")
      }

      do {
        _ = try await readbackStatusUseCase.execute(
          PraxisReadbackCmpStatusCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
        )
        Issue.record("Expected readbackCmpStatus to reject corrupted persisted control descriptors.")
      } catch let error as PraxisError {
        guard case let .invalidInput(message) = error else {
          Issue.record("Expected invalidInput from readbackCmpStatus, got \(error).")
          return
        }
        #expect(message.contains(corruptedField.0))
        #expect(message.contains(corruptedField.1))
      } catch {
        Issue.record("Expected PraxisError.invalidInput from readbackCmpStatus, got \(error).")
      }
    }
  }

  @Test
  func mpInspectUseCaseReportsHostBackedMemoryAndSearchState() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: ["memory.primary"],
        supportingMemoryIDs: [],
        omittedSupersededMemoryIDs: ["memory.superseded"]
      )
    )
    let searchIndex = PraxisStubSemanticSearchIndex(
      cannedResults: [
        "host runtime": [
          .init(id: "match-1", score: 0.9, contentSummary: "Host runtime memory hit", storageKey: "memory/primary"),
          .init(id: "match-2", score: 0.7, contentSummary: "Secondary host runtime hit", storageKey: "memory/secondary"),
        ]
      ]
    )
    let inferenceExecutor = PraxisStubProviderInferenceExecutor { _ in
      PraxisProviderInferenceResponse(
        output: .init(summary: "stubbed inference"),
        receipt: .init(
          capabilityKey: "provider.infer",
          backend: "stub-provider",
          status: .succeeded,
          summary: "Inference is stubbed for MP tests."
        )
      )
    }
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: inferenceExecutor,
        semanticSearchIndex: searchIndex,
        semanticMemoryStore: memoryStore
      )
    )
    let inspectMpUseCase = PraxisInspectMpUseCase(dependencies: dependencies)

    let inspection = try await inspectMpUseCase.execute()

    #expect(inspection.summary == "MP workflow surface is now reading HostRuntime memory and multimodal adapter state.")
    #expect(inspection.workflowSummary.contains("provider inference surface available"))
    #expect(inspection.memoryStoreSummary.contains("1 primary records and omits 1 superseded records"))
    #expect(inspection.memoryStoreSummary.contains("Semantic search matches for inspection query: 2."))
    #expect(inspection.multimodalSummary == "No multimodal host chips are currently registered.")
    #expect(inspection.issues.contains { $0.contains("Browser grounding and multimodal chips") })
    #expect(inspection.issues.contains { $0.contains("semantic memory store") } == false)
    #expect(inspection.issues.contains { $0.contains("semantic search index") } == false)
  }

  @Test
  func mpSearchReadbackAndSmokeUseCasesUseHostRuntimeSemanticMemorySurface() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: ["memory.primary"],
        supportingMemoryIDs: ["memory.supporting"],
        omittedSupersededMemoryIDs: ["memory.superseded"]
      ),
      searchResults: [
        PraxisSemanticMemoryRecord(
          id: "memory.primary",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .agent,
          memoryKind: .semantic,
          summary: "Host runtime onboarding note",
          storageKey: "memory/primary",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          embeddingStorageKey: "embed/primary"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.supporting",
          projectID: "mp.local-runtime",
          agentID: "checker.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "Shared onboarding summary",
          storageKey: "memory/supporting",
          freshnessStatus: .aging,
          alignmentStatus: .unreviewed,
          embeddingStorageKey: "embed/supporting"
        ),
      ]
    )
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
          PraxisProviderInferenceResponse(
            output: .init(summary: "stubbed inference"),
            receipt: .init(
              capabilityKey: "provider.infer",
              backend: "stub-provider",
              status: .succeeded,
              summary: "Inference is stubbed for MP use case tests."
            )
          )
        },
        browserGroundingCollector: PraxisStubBrowserGroundingCollector { request in
          PraxisBrowserGroundingEvidenceBundle(
            request: request,
            pages: [
              .init(role: .verifiedSource, url: "https://example.com/mp")
            ],
            facts: [
              .init(name: "mp-smoke", status: .verified, value: "reachable")
            ]
          )
        },
        semanticSearchIndex: PraxisStubSemanticSearchIndex(
          cannedResults: [
            "onboarding": [
              .init(id: "match-1", score: 0.91, contentSummary: "Host runtime onboarding note", storageKey: "memory/primary"),
              .init(id: "match-2", score: 0.63, contentSummary: "Shared onboarding summary", storageKey: "memory/supporting"),
            ]
          ]
        ),
        semanticMemoryStore: memoryStore
      )
    )

    let search = try await PraxisSearchMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        scopeLevels: [.agentIsolated, .project],
        limit: 5
      )
    )
    let readback = try await PraxisReadbackMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        scopeLevels: [.agentIsolated, .project],
        limit: 5
      )
    )
    let smoke = try await PraxisSmokeMpUseCase(dependencies: dependencies).execute(
      .init(projectID: "mp.local-runtime")
    )

    #expect(search.hits.map(\.memoryID) == ["memory.primary", "memory.supporting"])
    #expect(search.hits.first?.scopeLevel == .agentIsolated)
    #expect(readback.totalMemoryCount == 2)
    #expect(readback.primaryCount == 1)
    #expect(readback.supportingCount == 1)
    #expect(readback.omittedSupersededCount == 1)
    #expect(readback.freshnessBreakdown[PraxisMpMemoryFreshnessStatus.fresh.rawValue] == 1)
    #expect(readback.scopeBreakdown[PraxisMpScopeLevel.project.rawValue] == 1)
    #expect(smoke.projectID == "mp.local-runtime")
    #expect(smoke.checks.count == 4)
    #expect(smoke.checks.map(\.gate).contains("browser-grounding"))
  }

  @Test
  func mpWorkflowUseCasesPersistAlignmentAndResolveBundlesThroughSemanticMemoryTruth() async throws {
    let memoryStore = PraxisFakeSemanticMemoryStore()
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(
        semanticMemoryStore: memoryStore
      )
    )

    let ingest = try await PraxisIngestMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: "mp.session",
        summary: "Host runtime onboarding note",
        checkedSnapshotRef: "snapshot.mp.1",
        branchRef: "main",
        observedAt: "2026-04-11T10:00:00Z"
      )
    )
    let aligned = try await PraxisAlignMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        alignedAt: "2026-04-11T10:05:00Z"
      )
    )
    let submitted = try await PraxisPromoteMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .submittedToParent,
        targetSessionID: "mp.session",
        promotedAt: "2026-04-11T10:06:00Z",
        reason: "Share with session peers"
      )
    )
    let accepted = try await PraxisPromoteMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .acceptedByParent,
        targetSessionID: "mp.session",
        promotedAt: "2026-04-11T10:07:00Z"
      )
    )
    let promoted = try await PraxisPromoteMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .promotedToProject,
        promotedAt: "2026-04-11T10:08:00Z",
        reason: "Stabilized as project truth"
      )
    )
    let resolve = try await PraxisResolveMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        requesterAgentID: "runtime.local",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await PraxisRequestMpHistoryUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        requesterAgentID: "runtime.local",
        reason: "Need historical context",
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let archived = try await PraxisArchiveMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        archivedAt: "2026-04-11T10:09:00Z",
        reason: "Superseded by canonical project brief"
      )
    )

    let currentRecord = try await memoryStore.load(memoryID: ingest.primaryMemoryID)
    let visibleProjectRecords = try await memoryStore.search(
      .init(
        projectID: "mp.local-runtime",
        query: "",
        scopeLevels: [.project],
        limit: 5
      )
    )

    #expect(ingest.decision == .keep)
    #expect(ingest.updatedMemoryIDs == [ingest.primaryMemoryID])
    #expect(currentRecord?.freshnessStatus == .fresh)
    #expect(currentRecord?.alignmentStatus == .aligned)
    #expect(submitted.promotionState == .submittedToParent)
    #expect(submitted.sessionID == "mp.session")
    #expect(submitted.visibilityState == .sessionBridged)
    #expect(accepted.promotionState == .acceptedByParent)
    #expect(promoted.scopeLevel == .project)
    #expect(promoted.promotionState == .promotedToProject)
    #expect(promoted.visibilityState == .projectShared)
    #expect(aligned.decision == .keep)
    #expect(aligned.primaryMemoryID == ingest.primaryMemoryID)
    #expect(resolve.primaryMemoryIDs == [ingest.primaryMemoryID])
    #expect(resolve.supportingMemoryIDs.isEmpty)
    #expect(resolve.roleCounts["dispatcher"] == 1)
    #expect(resolve.issues.contains { $0.contains("governance-only ranking") })
    #expect(history.primaryMemoryIDs == [ingest.primaryMemoryID])
    #expect(history.reason == "Need historical context")
    #expect(history.roleCounts["dispatcher"] == 1)
    #expect(history.issues.contains { $0.contains("governance-only ranking") })
    #expect(archived.promotionState == .archived)
    #expect(archived.visibilityState == .archived)
    #expect(currentRecord?.promotionState == .archived)
    #expect(currentRecord?.visibilityState == .archived)
    #expect(visibleProjectRecords.isEmpty)
  }

  @Test
  func mpAlignUseCaseRejectsMemoryFromDifferentProject() async throws {
    let memoryStore = PraxisFakeSemanticMemoryStore(
      seedRecords: [
        PraxisSemanticMemoryRecord(
          id: "memory.foreign",
          projectID: "mp.other-project",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "Foreign project memory",
          storageKey: "memory/foreign",
          freshnessStatus: .fresh,
          alignmentStatus: .unreviewed
        )
      ]
    )
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(semanticMemoryStore: memoryStore)
    )

    await #expect(throws: PraxisError.self) {
      _ = try await PraxisAlignMpUseCase(dependencies: dependencies).execute(
        .init(
          projectID: "mp.local-runtime",
          memoryID: "memory.foreign",
          alignedAt: "2026-04-12T00:00:00Z"
        )
      )
    }
  }

  @Test
  func mpResolveAndHistoryReadSharedProjectMemoriesAcrossAgents() async throws {
    let memoryStore = PraxisFakeSemanticMemoryStore(
      seedRecords: [
        PraxisSemanticMemoryRecord(
          id: "memory.shared.project",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          visibilityState: .projectShared,
          promotionState: .promotedToProject,
          memoryKind: .semantic,
          summary: "Shared onboarding note",
          storageKey: "memory/shared/onboarding",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          tags: ["onboarding"]
        )
      ]
    )
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(semanticMemoryStore: memoryStore)
    )

    let resolve = try await PraxisResolveMpUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        requesterAgentID: "checker.local",
        requesterSessionID: "mp.session.checker",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await PraxisRequestMpHistoryUseCase(dependencies: dependencies).execute(
      .init(
        projectID: "mp.local-runtime",
        requesterAgentID: "checker.local",
        requesterSessionID: "mp.session.checker",
        reason: "Need peer shared context",
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )

    #expect(resolve.primaryMemoryIDs == ["memory.shared.project"])
    #expect(history.primaryMemoryIDs == ["memory.shared.project"])
  }

  private func makeDependencies(rootDirectory: URL) throws -> PraxisDependencyGraph {
    try makeDependencies(hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory))
  }

  private func makeDependencies(hostAdapters: PraxisHostAdapterRegistry) throws -> PraxisDependencyGraph {
    try PraxisRuntimeGatewayFactory.makeCompositionRoot(
      hostAdapters: hostAdapters,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    ).makeDependencyGraph()
  }
}
