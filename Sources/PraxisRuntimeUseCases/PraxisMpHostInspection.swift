import PraxisInfraContracts
import PraxisRuntimeComposition

/// Projects MP host inspection and smoke snapshots from adapter readiness.
///
/// This service keeps host-facing readiness wording and projection shape out of
/// individual MP use cases. It does not own MP workflow rules or persistence.
public struct PraxisMpHostInspectionService: Sendable {
  private let diagnosticsService: PraxisMpHostDiagnosticsService

  public init(
    diagnosticsService: PraxisMpHostDiagnosticsService = PraxisMpHostDiagnosticsService()
  ) {
    self.diagnosticsService = diagnosticsService
  }

  /// Builds one host-neutral MP smoke result from current adapter readiness.
  ///
  /// - Parameters:
  ///   - projectID: Project identifier under inspection.
  ///   - hostAdapters: Current host adapter registry.
  /// - Returns: One compact smoke snapshot for MP runtime gates.
  public func smoke(
    projectID: String,
    hostAdapters: PraxisHostAdapterRegistry
  ) -> PraxisMpSmoke {
    let checks: [PraxisRuntimeSmokeCheckRecord] = [
      smokeCheck(
        id: "mp.memory.store",
        gate: "memory-store",
        ready: hostAdapters.semanticMemoryStore != nil,
        readyStatus: "ready",
        missingStatus: "missing",
        readySummary: "Semantic memory store is available for MP workflow persistence.",
        fallbackSummary: "Semantic memory store is missing."
      ),
      smokeCheck(
        id: "mp.semantic.search",
        gate: "semantic-search",
        ready: hostAdapters.semanticSearchIndex != nil,
        readyStatus: "ready",
        missingStatus: "missing",
        readySummary: "Semantic search index is available for MP retrieval reranking.",
        fallbackSummary: "Semantic search index is missing."
      ),
      smokeCheck(
        id: "mp.provider.inference",
        gate: "provider-inference",
        ready: hostAdapters.providerInferenceExecutor != nil,
        readyStatus: "ready",
        missingStatus: "degraded",
        readySummary: "Provider inference surface is available for future MP checker/align enrichment.",
        fallbackSummary: "Provider inference is absent; MP remains local-baseline only."
      ),
      smokeCheck(
        id: "mp.browser.grounding",
        gate: "browser-grounding",
        ready: hostAdapters.browserGroundingCollector != nil,
        readyStatus: "ready",
        missingStatus: "degraded",
        readySummary: "Browser grounding collector is wired for future evidence-backed memory capture.",
        fallbackSummary: "Browser grounding collector is absent; browser-backed memory capture remains unavailable."
      ),
    ]
    let readyChecks = checks.filter { $0.status == "ready" }.count
    return PraxisMpSmoke(
      projectID: projectID,
      summary: diagnosticsService.smokeSummary(
        readyChecks: readyChecks,
        totalChecks: checks.count,
        projectID: projectID
      ),
      checks: checks
    )
  }

  /// Builds one MP inspection snapshot from current host adapters.
  ///
  /// - Parameters:
  ///   - projectID: Project identifier used for local-runtime inspection.
  ///   - inspectionQuery: Semantic search probe used during inspection.
  ///   - hostAdapters: Current host adapter registry.
  /// - Returns: One MP inspection snapshot.
  /// - Throws: Propagates semantic memory or semantic search adapter failures.
  public func inspect(
    projectID: String,
    inspectionQuery: String = "host runtime",
    hostAdapters: PraxisHostAdapterRegistry
  ) async throws -> PraxisMpInspection {
    let memoryBundle = try await hostAdapters.semanticMemoryStore?.bundle(
      .init(
        projectID: projectID,
        query: "",
        scopeLevels: [.global, .project, .agent, .session],
        includeSuperseded: false
      )
    )
    let semanticMatches = try await hostAdapters.semanticSearchIndex?.search(
      .init(query: inspectionQuery, limit: 3)
    ) ?? []

    return PraxisMpInspection(
      summary: "MP workflow surface is now reading HostRuntime memory and multimodal adapter state.",
      workflowSummary: workflowSummary(providerInferenceReady: hostAdapters.providerInferenceExecutor != nil),
      memoryStoreSummary: memoryStoreSummary(
        bundle: memoryBundle,
        semanticMatchCount: semanticMatches.count
      ),
      multimodalSummary: multimodalSummary(from: hostAdapters),
      issues: inspectionIssues(
        hostAdapters: hostAdapters,
        semanticMatchCount: semanticMatches.count
      )
    )
  }

  private func smokeCheck(
    id: String,
    gate: String,
    ready: Bool,
    readyStatus: String,
    missingStatus: String,
    readySummary: String,
    fallbackSummary: String
  ) -> PraxisRuntimeSmokeCheckRecord {
    PraxisRuntimeSmokeCheckRecord(
      id: id,
      gate: gate,
      status: ready ? readyStatus : missingStatus,
      summary: ready ? readySummary : fallbackSummary
    )
  }

  private func workflowSummary(providerInferenceReady: Bool) -> String {
    providerInferenceReady
      ? "ICMA / Iterator / Checker / DbAgent / Dispatcher lanes now have a provider inference surface available for future host-backed execution."
      : "Five-agent lanes remain Core-side protocols until a provider inference surface is composed."
  }

  private func memoryStoreSummary(
    bundle: PraxisSemanticMemoryBundle?,
    semanticMatchCount: Int
  ) -> String {
    let baseSummary: String
    if let bundle {
      baseSummary =
        "Semantic memory bundle exposes \(bundle.primaryMemoryIDs.count) primary records and omits \(bundle.omittedSupersededMemoryIDs.count) superseded records."
    } else {
      baseSummary = "Semantic memory store is not wired into HostRuntime yet."
    }
    return "\(baseSummary) Semantic search matches for inspection query: \(semanticMatchCount)."
  }

  private func inspectionIssues(
    hostAdapters: PraxisHostAdapterRegistry,
    semanticMatchCount: Int
  ) -> [String] {
    var issues: [String] = []
    if hostAdapters.semanticMemoryStore == nil {
      issues.append("MP runtime still needs a semantic memory store adapter on the Swift side.")
    }
    if hostAdapters.semanticSearchIndex == nil {
      issues.append("MP runtime still needs a semantic search index adapter on the Swift side.")
    }
    if semanticMatchCount == 0 {
      issues.append("No semantic search matches are currently available for the local MP inspection query.")
    }
    if hostAdapters.browserGroundingCollector == nil
      || hostAdapters.audioTranscriptionDriver == nil
      || hostAdapters.speechSynthesisDriver == nil
      || hostAdapters.imageGenerationDriver == nil {
      issues.append("Browser grounding and multimodal chips still need the full host adapter set.")
    }
    return issues
  }

  private func multimodalSummary(from hostAdapters: PraxisHostAdapterRegistry) -> String {
    let chips = [
      hostAdapters.audioTranscriptionDriver != nil ? "audio.transcribe" : nil,
      hostAdapters.speechSynthesisDriver != nil ? "speech.synthesize" : nil,
      hostAdapters.imageGenerationDriver != nil ? "image.generate" : nil,
      hostAdapters.browserGroundingCollector != nil ? "browser.ground" : nil,
    ].compactMap { $0 }

    if chips.isEmpty {
      return "No multimodal host chips are currently registered."
    }
    return "Multimodal host chips: \(chips.joined(separator: ", "))"
  }
}
