import Testing
@testable import PraxisInfraContracts
@testable import PraxisProviderContracts
@testable import PraxisToolingContracts
@testable import PraxisUserIOContracts

struct HostContractSurfaceTests {
  @Test
  func providerContractsNowCoverWebSearchSurface() {
    let request = PraxisProviderWebSearchRequest(query: "Swift Package Manager", locale: "zh-CN")
    let response = PraxisProviderWebSearchResponse(
      query: request.query,
      results: [
        .init(title: "SwiftPM", snippet: "Apple package manager", url: "https://example.com/swiftpm")
      ]
    )

    #expect(request.locale == "zh-CN")
    #expect(response.results.count == 1)
    #expect(response.results.first?.title == "SwiftPM")
  }

  @Test
  func infraContractsCoverLocalPersistenceAndSemanticSearchSurface() {
    let truth = PraxisDeliveryTruthRecord(
      id: "delivery-1",
      topic: "cmp.peer.sync",
      status: .published,
      payloadSummary: "peer context package dispatched",
      updatedAt: "2026-04-10T12:00:00Z"
    )
    let embedding = PraxisEmbeddingRecord(
      id: "embedding-1",
      contentSummary: "section summary",
      vectorLength: 1536,
      storageKey: "sqlite://chunks/section-1"
    )
    let search = PraxisSemanticSearchRequest(
      query: "find section summary",
      limit: 3,
      candidateStorageKeys: [embedding.storageKey]
    )
    let match = PraxisSemanticSearchMatch(
      id: "match-1",
      score: 0.91,
      contentSummary: embedding.contentSummary,
      storageKey: embedding.storageKey
    )

    #expect(truth.status == .published)
    #expect(embedding.vectorLength == 1536)
    #expect(search.candidateStorageKeys == [embedding.storageKey])
    #expect(match.storageKey == embedding.storageKey)
  }

  @Test
  func toolingContractsCoverSystemGitReadinessSurface() {
    let report = PraxisGitAvailabilityReport(
      status: .installPromptExpected,
      notes: "macOS can prompt for Xcode Command Line Tools when git is first invoked."
    )

    #expect(report.status == .installPromptExpected)
    #expect(report.executablePath == nil)
  }

  @Test
  func toolingContractsCoverBrowserGroundingEvidenceSurface() {
    let bundle = PraxisBrowserGroundingEvidenceBundle(
      pages: [
        .init(
          role: .verifiedSource,
          url: "https://example.com/gold",
          title: "Verified source",
          snapshotPath: "snapshots/gold.txt"
        )
      ],
      facts: [
        .init(
          name: "gold_price_usd_per_ounce",
          status: .verified,
          value: "3351.24",
          unit: "USD/oz",
          sourceRole: .verifiedSource,
          sourceURL: "https://example.com/gold",
          sourceTitle: "Verified source"
        )
      ]
    )

    #expect(bundle.pages.first?.role == .verifiedSource)
    #expect(bundle.facts.first?.status == .verified)
    #expect(bundle.facts.first?.unit == "USD/oz")
  }

  @Test
  func infraContractsCoverSemanticMemorySurface() {
    let memory = PraxisSemanticMemoryRecord(
      id: "memory-1",
      projectID: "project-1",
      agentID: "agent-main",
      scopeLevel: .project,
      memoryKind: .semantic,
      summary: "Current workflow baseline",
      storageKey: "sqlite://mp/memory-1",
      freshnessStatus: .fresh,
      alignmentStatus: .aligned,
      embeddingStorageKey: "sqlite://mp/embedding-1"
    )
    let request = PraxisSemanticMemorySearchRequest(
      projectID: memory.projectID,
      query: "workflow baseline",
      scopeLevels: [.project, .agent],
      limit: 3,
      agentID: memory.agentID
    )
    let bundle = PraxisSemanticMemoryBundle(
      primaryMemoryIDs: [memory.id],
      supportingMemoryIDs: [],
      omittedSupersededMemoryIDs: []
    )

    #expect(memory.scopeLevel == .project)
    #expect(request.scopeLevels.count == 2)
    #expect(bundle.primaryMemoryIDs == [memory.id])
  }

  @Test
  func userIOContractsCoverMultimodalChips() {
    let chips = [
      PraxisMultimodalChip(
        kind: .audioTranscribe,
        label: "Audio",
        summary: "Transcribe uploaded audio"
      ),
      PraxisMultimodalChip(
        kind: .speechSynthesize,
        label: "Speech",
        summary: "Generate spoken response"
      ),
      PraxisMultimodalChip(
        kind: .imageGenerate,
        label: "Image",
        summary: "Generate preview image"
      ),
    ]
    let transcription = PraxisAudioTranscriptionRequest(
      sourceRef: "file://note.m4a",
      locale: "zh-CN",
      hint: "meeting notes"
    )
    let synthesis = PraxisSpeechSynthesisRequest(
      text: "Runtime ready",
      voice: "alloy",
      locale: "en-US"
    )
    let image = PraxisImageGenerationRequest(
      prompt: "diagram of runtime architecture",
      style: "technical",
      size: "1024x1024"
    )

    #expect(chips.map(\.kind) == [.audioTranscribe, .speechSynthesize, .imageGenerate])
    #expect(transcription.locale == "zh-CN")
    #expect(synthesis.voice == "alloy")
    #expect(image.size == "1024x1024")
  }
}
