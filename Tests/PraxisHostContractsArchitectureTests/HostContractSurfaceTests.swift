import Testing
@testable import PraxisInfraContracts
@testable import PraxisMpTypes
@testable import PraxisProviderContracts
@testable import PraxisToolingContracts
@testable import PraxisUserIOContracts
@testable import PraxisWorkspaceContracts

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
    let packageDescriptor = PraxisCmpContextPackageDescriptor(
      projectID: "project-1",
      packageID: .init(rawValue: "package-1"),
      sourceProjectionID: .init(rawValue: "projection-1"),
      sourceSnapshotID: .init(rawValue: "snapshot-1"),
      sourceAgentID: "agent-1",
      targetAgentID: "agent-2",
      packageKind: .runtimeFill,
      fidelityLabel: .highSignal,
      packageRef: "context://project-1/projection-1/agent-2/runtimeFill",
      status: .materialized,
      sourceSectionIDs: [.init(rawValue: "section-1")],
      createdAt: "2026-04-10T12:00:00Z",
      updatedAt: "2026-04-10T12:00:00Z"
    )
    let controlDescriptor = PraxisCmpControlDescriptor(
      projectID: "project-1",
      agentID: "agent-2",
      executionStyle: "manual",
      mode: "peer_review",
      readbackPriority: "package_first",
      fallbackPolicy: "registry_only",
      recoveryPreference: "resume_latest",
      automation: ["autoDispatch": false],
      updatedAt: "2026-04-10T12:05:00Z"
    )
    let peerApprovalDescriptor = PraxisCmpPeerApprovalDescriptor(
      projectID: "project-1",
      agentID: "agent-1",
      targetAgentID: "agent-2",
      capabilityKey: "tool.git",
      requestedTier: "B1",
      tapMode: "restricted",
      riskLevel: "normal",
      route: "humanReview",
      outcome: "escalated_to_human",
      humanGateState: "waitingApproval",
      summary: "Request peer approval for tool.git",
      decisionSummary: "Capability tool.git requires human approval in restricted mode.",
      requestedAt: "2026-04-10T12:06:00Z",
      updatedAt: "2026-04-10T12:06:00Z",
      metadata: ["decisionKind": .string("escalated_to_human")]
    )
    let tapRuntimeEvent = PraxisTapRuntimeEventRecord(
      eventID: "tap-event-1",
      projectID: "project-1",
      agentID: "agent-1",
      targetAgentID: "agent-2",
      eventKind: "peer_approval_requested",
      capabilityKey: "tool.git",
      summary: "Request peer approval for tool.git",
      detail: "Capability tool.git requires human approval in restricted mode.",
      createdAt: "2026-04-10T12:06:01Z",
      metadata: ["route": .string("humanReview")]
    )

    #expect(truth.status == .published)
    #expect(embedding.vectorLength == 1536)
    #expect(search.candidateStorageKeys == [embedding.storageKey])
    #expect(match.storageKey == embedding.storageKey)
    #expect(packageDescriptor.packageKind == .runtimeFill)
    #expect(packageDescriptor.status == .materialized)
    #expect(controlDescriptor.mode == "peer_review")
    #expect(controlDescriptor.automation["autoDispatch"] == false)
    #expect(peerApprovalDescriptor.tapMode == "restricted")
    #expect(peerApprovalDescriptor.humanGateState == "waitingApproval")
    #expect(tapRuntimeEvent.eventKind == "peer_approval_requested")
    #expect(tapRuntimeEvent.metadata["route"] == .string("humanReview"))
  }

  @Test
  func toolingContractsCoverSystemGitReadinessSurface() {
    let report = PraxisGitAvailabilityReport(
      status: .installPromptExpected,
      remediationHint: "Install Xcode Command Line Tools",
      notes: "macOS can prompt for Xcode Command Line Tools when git is first invoked."
    )

    #expect(report.status == .installPromptExpected)
    #expect(report.executablePath == nil)
    #expect(report.remediationHint == "Install Xcode Command Line Tools")
  }

  @Test
  func toolingContractsCoverBrowserGroundingEvidenceSurface() {
    let request = PraxisBrowserGroundingRequest(
      taskSummary: "Verify gold price",
      exampleURL: "https://example.com/gold",
      requestedFacts: ["gold_price_usd_per_ounce"],
      locale: "en-US",
      maxPages: 4
    )
    let bundle = PraxisBrowserGroundingEvidenceBundle(
      request: request,
      pages: [
        .init(
          role: .verifiedSource,
          url: "https://example.com/gold",
          title: "Verified source",
          snapshotPath: "snapshots/gold.txt",
          capturedAt: "2026-04-10T12:00:00Z"
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
          sourceTitle: "Verified source",
          citationSnippet: "Gold price reached 3351.24 USD/oz",
          observedAt: "2026-04-10T12:00:00Z"
        )
      ],
      generatedAt: "2026-04-10T12:00:01Z"
    )

    #expect(bundle.request?.requestedFacts == ["gold_price_usd_per_ounce"])
    #expect(bundle.pages.first?.role == .verifiedSource)
    #expect(bundle.facts.first?.status == .verified)
    #expect(bundle.facts.first?.unit == "USD/oz")
    #expect(bundle.facts.first?.citationSnippet == "Gold price reached 3351.24 USD/oz")
  }

  @Test
  func workspaceContractsCoverReadSearchAndChangeSurface() {
    let read = PraxisWorkspaceReadRequest(
      path: "/tmp/praxis/README.md",
      range: .init(startLine: 1, endLine: 10),
      includeRevisionToken: true
    )
    let readResult = PraxisWorkspaceReadResult(
      path: read.path,
      content: "# Praxis\n",
      revisionToken: "rev-1",
      lineCount: 1
    )
    let search = PraxisWorkspaceSearchRequest(
      query: "Praxis",
      kind: .fullText,
      roots: ["/tmp/praxis"],
      maxResults: 5
    )
    let match = PraxisWorkspaceSearchMatch(
      path: "/tmp/praxis/README.md",
      line: 1,
      column: 3,
      summary: "README heading",
      snippet: "# Praxis"
    )
    let change = PraxisWorkspaceChangeRequest(
      changes: [
        .init(kind: .updateFile, path: "/tmp/praxis/README.md", content: "# Praxis\nUpdated\n")
      ],
      changeSummary: "Refresh README"
    )

    #expect(read.range?.startLine == 1)
    #expect(readResult.revisionToken == "rev-1")
    #expect(search.kind == .fullText)
    #expect(match.snippet == "# Praxis")
    #expect(change.changes.first?.kind == .updateFile)
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
    #expect(memory.sessionMode == .shared)
    #expect(memory.visibilityState == .projectShared)
    #expect(memory.promotionState == .promotedToProject)
    #expect(memory.confidence == .medium)
    #expect(request.scopeLevels.count == 2)
    #expect(bundle.primaryMemoryIDs == [memory.id])
  }

  @Test
  func userIOContractsCoverMultimodalChips() {
    let prompt = PraxisPromptRequest(
      summary: "Approve deployment",
      detail: "Need explicit confirmation before push",
      kind: .confirmation,
      defaultValue: "no"
    )
    let permission = PraxisPermissionRequest(
      scope: "git.push",
      summary: "Push the current branch",
      urgency: .high
    )
    let terminalEvent = PraxisTerminalEvent(
      title: "Running tests",
      detail: "swift test",
      kind: .progress,
      command: "swift test"
    )
    let conversation = PraxisConversationPresentation(
      summary: "Wave5 finished",
      detail: "HostContracts are ready for HostRuntime",
      kind: .result
    )
    let chips = [
      PraxisMultimodalChip(
        kind: .audioTranscribe,
        label: "Audio",
        summary: "Transcribe uploaded audio",
        enabled: true
      ),
      PraxisMultimodalChip(
        kind: .speechSynthesize,
        label: "Speech",
        summary: "Generate spoken response",
        enabled: true
      ),
      PraxisMultimodalChip(
        kind: .imageGenerate,
        label: "Image",
        summary: "Generate preview image",
        enabled: false
      ),
    ]
    let transcription = PraxisAudioTranscriptionRequest(
      sourceRef: "file://note.m4a",
      locale: "zh-CN",
      hint: "meeting notes",
      diarizationEnabled: true
    )
    let synthesis = PraxisSpeechSynthesisRequest(
      text: "Runtime ready",
      voice: "alloy",
      locale: "en-US",
      format: "wav"
    )
    let image = PraxisImageGenerationRequest(
      prompt: "diagram of runtime architecture",
      style: "technical",
      size: "1024x1024",
      transparentBackground: true
    )

    #expect(prompt.kind == .confirmation)
    #expect(permission.urgency == .high)
    #expect(terminalEvent.kind == .progress)
    #expect(conversation.kind == .result)
    #expect(chips.map(\.kind) == [.audioTranscribe, .speechSynthesize, .imageGenerate])
    #expect(chips.last?.enabled == false)
    #expect(transcription.locale == "zh-CN")
    #expect(transcription.diarizationEnabled == true)
    #expect(synthesis.voice == "alloy")
    #expect(synthesis.format == "wav")
    #expect(image.size == "1024x1024")
    #expect(image.transparentBackground == true)
  }
}
