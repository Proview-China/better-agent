import Foundation
import PraxisCapabilityResults
import PraxisCoreTypes
import PraxisInfraContracts
import PraxisProviderContracts
import PraxisToolingContracts
import PraxisUserIOContracts
import PraxisWorkspaceContracts

/// Groups host-facing adapters so Composition can assemble a runtime without leaking
/// individual doubles and protocol conformers across entry points or tests.
public struct PraxisHostAdapterRegistry: Sendable {
  public let runtimeRootDirectory: URL?
  public let workspaceRootDirectory: URL?
  public let capabilityExecutor: (any PraxisCapabilityExecutor)?
  public let providerInferenceExecutor: (any PraxisProviderInferenceExecutor)?
  public let providerEmbeddingExecutor: (any PraxisProviderEmbeddingExecutor)?
  public let providerFileStore: (any PraxisProviderFileStore)?
  public let providerBatchExecutor: (any PraxisProviderBatchExecutor)?
  public let providerSkillRegistry: (any PraxisProviderSkillRegistry)?
  public let providerSkillActivator: (any PraxisProviderSkillActivator)?
  public let providerMCPExecutor: (any PraxisProviderMCPExecutor)?

  public let workspaceReader: (any PraxisWorkspaceReader)?
  public let workspaceSearcher: (any PraxisWorkspaceSearcher)?
  public let workspaceWriter: (any PraxisWorkspaceWriter)?

  public let shellExecutor: (any PraxisShellExecutor)?
  public let browserExecutor: (any PraxisBrowserExecutor)?
  public let browserGroundingCollector: (any PraxisBrowserGroundingCollector)?
  public let gitAvailabilityProbe: (any PraxisGitAvailabilityProbe)?
  public let gitExecutor: (any PraxisGitExecutor)?
  public let processSupervisor: (any PraxisProcessSupervisor)?

  public let checkpointStore: (any PraxisCheckpointStoreContract)?
  public let journalStore: (any PraxisJournalStoreContract)?
  public let projectionStore: (any PraxisProjectionStoreContract)?
  public let cmpContextPackageStore: (any PraxisCmpContextPackageStoreContract)?
  public let cmpControlStore: (any PraxisCmpControlStoreContract)?
  public let cmpPeerApprovalStore: (any PraxisCmpPeerApprovalStoreContract)?
  public let tapRuntimeEventStore: (any PraxisTapRuntimeEventStoreContract)?
  public let messageBus: (any PraxisMessageBusContract)?
  public let deliveryTruthStore: (any PraxisDeliveryTruthStoreContract)?
  public let embeddingStore: (any PraxisEmbeddingStoreContract)?
  public let semanticSearchIndex: (any PraxisSemanticSearchIndexContract)?
  public let semanticMemoryStore: (any PraxisSemanticMemoryStoreContract)?
  public let lineageStore: (any PraxisLineageStoreContract)?

  public let userInputDriver: (any PraxisUserInputDriver)?
  public let permissionDriver: (any PraxisPermissionDriver)?
  public let terminalPresenter: (any PraxisTerminalPresenter)?
  public let conversationPresenter: (any PraxisConversationPresenter)?
  public let audioTranscriptionDriver: (any PraxisAudioTranscriptionDriver)?
  public let speechSynthesisDriver: (any PraxisSpeechSynthesisDriver)?
  public let imageGenerationDriver: (any PraxisImageGenerationDriver)?
  public let providerInferenceSurfaceProvenance: PraxisHostAdapterSurfaceProvenance
  public let browserGroundingSurfaceProvenance: PraxisHostAdapterSurfaceProvenance
  public let audioTranscriptionSurfaceProvenance: PraxisHostAdapterSurfaceProvenance
  public let speechSynthesisSurfaceProvenance: PraxisHostAdapterSurfaceProvenance
  public let imageGenerationSurfaceProvenance: PraxisHostAdapterSurfaceProvenance

  public init(
    runtimeRootDirectory: URL? = nil,
    workspaceRootDirectory: URL? = nil,
    capabilityExecutor: (any PraxisCapabilityExecutor)? = nil,
    providerInferenceExecutor: (any PraxisProviderInferenceExecutor)? = nil,
    providerEmbeddingExecutor: (any PraxisProviderEmbeddingExecutor)? = nil,
    providerFileStore: (any PraxisProviderFileStore)? = nil,
    providerBatchExecutor: (any PraxisProviderBatchExecutor)? = nil,
    providerSkillRegistry: (any PraxisProviderSkillRegistry)? = nil,
    providerSkillActivator: (any PraxisProviderSkillActivator)? = nil,
    providerMCPExecutor: (any PraxisProviderMCPExecutor)? = nil,
    workspaceReader: (any PraxisWorkspaceReader)? = nil,
    workspaceSearcher: (any PraxisWorkspaceSearcher)? = nil,
    workspaceWriter: (any PraxisWorkspaceWriter)? = nil,
    shellExecutor: (any PraxisShellExecutor)? = nil,
    browserExecutor: (any PraxisBrowserExecutor)? = nil,
    browserGroundingCollector: (any PraxisBrowserGroundingCollector)? = nil,
    gitAvailabilityProbe: (any PraxisGitAvailabilityProbe)? = nil,
    gitExecutor: (any PraxisGitExecutor)? = nil,
    processSupervisor: (any PraxisProcessSupervisor)? = nil,
    checkpointStore: (any PraxisCheckpointStoreContract)? = nil,
    journalStore: (any PraxisJournalStoreContract)? = nil,
    projectionStore: (any PraxisProjectionStoreContract)? = nil,
    cmpContextPackageStore: (any PraxisCmpContextPackageStoreContract)? = nil,
    cmpControlStore: (any PraxisCmpControlStoreContract)? = nil,
    cmpPeerApprovalStore: (any PraxisCmpPeerApprovalStoreContract)? = nil,
    tapRuntimeEventStore: (any PraxisTapRuntimeEventStoreContract)? = nil,
    messageBus: (any PraxisMessageBusContract)? = nil,
    deliveryTruthStore: (any PraxisDeliveryTruthStoreContract)? = nil,
    embeddingStore: (any PraxisEmbeddingStoreContract)? = nil,
    semanticSearchIndex: (any PraxisSemanticSearchIndexContract)? = nil,
    semanticMemoryStore: (any PraxisSemanticMemoryStoreContract)? = nil,
    lineageStore: (any PraxisLineageStoreContract)? = nil,
    userInputDriver: (any PraxisUserInputDriver)? = nil,
    permissionDriver: (any PraxisPermissionDriver)? = nil,
    terminalPresenter: (any PraxisTerminalPresenter)? = nil,
    conversationPresenter: (any PraxisConversationPresenter)? = nil,
    audioTranscriptionDriver: (any PraxisAudioTranscriptionDriver)? = nil,
    speechSynthesisDriver: (any PraxisSpeechSynthesisDriver)? = nil,
    imageGenerationDriver: (any PraxisImageGenerationDriver)? = nil,
    providerInferenceSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil,
    browserGroundingSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil,
    audioTranscriptionSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil,
    speechSynthesisSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil,
    imageGenerationSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil
  ) {
    self.runtimeRootDirectory = runtimeRootDirectory
    self.workspaceRootDirectory = workspaceRootDirectory
    self.capabilityExecutor = capabilityExecutor
    self.providerInferenceExecutor = providerInferenceExecutor
    self.providerEmbeddingExecutor = providerEmbeddingExecutor
    self.providerFileStore = providerFileStore
    self.providerBatchExecutor = providerBatchExecutor
    self.providerSkillRegistry = providerSkillRegistry
    self.providerSkillActivator = providerSkillActivator
    self.providerMCPExecutor = providerMCPExecutor
    self.workspaceReader = workspaceReader
    self.workspaceSearcher = workspaceSearcher
    self.workspaceWriter = workspaceWriter
    self.shellExecutor = shellExecutor
    self.browserExecutor = browserExecutor
    self.browserGroundingCollector = browserGroundingCollector
    self.gitAvailabilityProbe = gitAvailabilityProbe
    self.gitExecutor = gitExecutor
    self.processSupervisor = processSupervisor
    self.checkpointStore = checkpointStore
    self.journalStore = journalStore
    self.projectionStore = projectionStore
    self.cmpContextPackageStore = cmpContextPackageStore
    self.cmpControlStore = cmpControlStore
    self.cmpPeerApprovalStore = cmpPeerApprovalStore
    self.tapRuntimeEventStore = tapRuntimeEventStore
    self.messageBus = messageBus
    self.deliveryTruthStore = deliveryTruthStore
    self.embeddingStore = embeddingStore
    self.semanticSearchIndex = semanticSearchIndex
    self.semanticMemoryStore = semanticMemoryStore
    self.lineageStore = lineageStore
    self.userInputDriver = userInputDriver
    self.permissionDriver = permissionDriver
    self.terminalPresenter = terminalPresenter
    self.conversationPresenter = conversationPresenter
    self.audioTranscriptionDriver = audioTranscriptionDriver
    self.speechSynthesisDriver = speechSynthesisDriver
    self.imageGenerationDriver = imageGenerationDriver
    self.providerInferenceSurfaceProvenance =
      providerInferenceExecutor == nil ? .unavailable : (providerInferenceSurfaceProvenance ?? .composed)
    self.browserGroundingSurfaceProvenance =
      browserGroundingCollector == nil ? .unavailable : (browserGroundingSurfaceProvenance ?? .composed)
    self.audioTranscriptionSurfaceProvenance =
      audioTranscriptionDriver == nil ? .unavailable : (audioTranscriptionSurfaceProvenance ?? .composed)
    self.speechSynthesisSurfaceProvenance =
      speechSynthesisDriver == nil ? .unavailable : (speechSynthesisSurfaceProvenance ?? .composed)
    self.imageGenerationSurfaceProvenance =
      imageGenerationDriver == nil ? .unavailable : (imageGenerationSurfaceProvenance ?? .composed)
  }

  public static func scaffoldDefaults() -> PraxisHostAdapterRegistry {
    PraxisHostAdapterRegistry(
      runtimeRootDirectory: nil,
      workspaceRootDirectory: nil,
      capabilityExecutor: PraxisStubCapabilityExecutor { request in
        PraxisHostCapabilityReceipt(
          capabilityKey: request.capabilityKey,
          backend: "scaffold-provider",
          status: .succeeded,
          summary: "Scaffold host capability receipt for \(request.capabilityKey)."
        )
      },
      providerInferenceExecutor: PraxisStubProviderInferenceExecutor { request in
        PraxisProviderInferenceResponse(
          output: .init(summary: "Scaffold inference placeholder for prompt: \(request.prompt)"),
          receipt: PraxisHostCapabilityReceipt(
            capabilityKey: "provider.infer",
            backend: "scaffold-provider",
            status: .succeeded,
            summary: "Scaffold inference executed for HostRuntime assembly."
          )
        )
      },
      providerEmbeddingExecutor: PraxisStubProviderEmbeddingExecutor { request in
        PraxisProviderEmbeddingResponse(
          vectorLength: max(request.content.count, 1),
          model: request.preferredModel ?? "scaffold-embed"
        )
      },
      providerFileStore: PraxisFakeProviderFileStore(backend: "scaffold-provider"),
      providerBatchExecutor: PraxisFakeProviderBatchExecutor(backend: "scaffold-provider"),
      providerSkillRegistry: PraxisStubProviderSkillRegistry(skills: ["tap.inspect", "cmp.inspect"]),
      providerSkillActivator: PraxisFakeProviderSkillActivator(),
      providerMCPExecutor: PraxisStubProviderMCPExecutor { request in
        PraxisProviderMCPToolCallReceipt(
          toolName: request.toolName,
          status: .succeeded,
          summary: "Scaffold MCP execution placeholder for \(request.toolName)."
        )
      },
      workspaceReader: PraxisFakeWorkspaceReader(),
      workspaceSearcher: PraxisStubWorkspaceSearcher(),
      workspaceWriter: PraxisSpyWorkspaceWriter(),
      shellExecutor: PraxisFakeShellExecutor(),
      browserExecutor: PraxisSpyBrowserExecutor(),
      browserGroundingCollector: PraxisStubBrowserGroundingCollector { request in
        PraxisBrowserGroundingEvidenceBundle(
          request: request,
          pages: [],
          facts: [],
          blockedReason: "Scaffold browser grounding bundle."
        )
      },
      gitAvailabilityProbe: PraxisStubGitAvailabilityProbe(
        report: PraxisGitAvailabilityReport(
          status: PraxisLocalHostPlatformSupport.scaffoldGitAvailabilityStatus,
          executablePath: PraxisLocalHostPlatformSupport.scaffoldGitExecutablePath,
          supportsWorktree: PraxisLocalHostPlatformSupport.scaffoldGitSupportsWorktree,
          remediationHint: PraxisLocalHostPlatformSupport.scaffoldGitRemediationHint,
          notes: PraxisLocalHostPlatformSupport.scaffoldGitNotes
        )
      ),
      gitExecutor: PraxisFakeGitExecutor(),
      processSupervisor: PraxisStubProcessSupervisor(),
      checkpointStore: PraxisFakeCheckpointStore(),
      journalStore: PraxisFakeJournalStore(),
      projectionStore: PraxisFakeProjectionStore(),
      cmpContextPackageStore: PraxisFakeCmpContextPackageStore(),
      cmpControlStore: PraxisFakeCmpControlStore(),
      cmpPeerApprovalStore: PraxisFakeCmpPeerApprovalStore(),
      tapRuntimeEventStore: PraxisFakeTapRuntimeEventStore(),
      messageBus: PraxisSpyMessageBus(),
      deliveryTruthStore: PraxisFakeDeliveryTruthStore(),
      embeddingStore: PraxisFakeEmbeddingStore(),
      semanticSearchIndex: PraxisStubSemanticSearchIndex(),
      semanticMemoryStore: PraxisFakeSemanticMemoryStore(),
      lineageStore: PraxisStubLineageStore(),
      userInputDriver: PraxisStubUserInputDriver { request in
        PraxisPromptResponse(content: request.defaultValue ?? "", acceptedDefault: request.defaultValue != nil)
      },
      permissionDriver: PraxisStubPermissionDriver { request in
        PraxisPermissionDecision(granted: request.urgency != .high, reason: "Scaffold permission policy.")
      },
      terminalPresenter: PraxisSpyTerminalPresenter(),
      conversationPresenter: PraxisSpyConversationPresenter(),
      audioTranscriptionDriver: PraxisStubAudioTranscriptionDriver { request in
        PraxisAudioTranscriptionResponse(
          transcript: "Scaffold transcript for \(request.sourceRef).",
          language: request.locale
        )
      },
      speechSynthesisDriver: PraxisStubSpeechSynthesisDriver { request in
        PraxisSpeechSynthesisResponse(
          audioAssetRef: "memory://speech/\(request.voice)",
          format: request.format ?? "wav"
        )
      },
      imageGenerationDriver: PraxisStubImageGenerationDriver { request in
        PraxisImageGenerationResponse(
          assetRef: "memory://image/\(request.prompt.replacingOccurrences(of: " ", with: "-"))",
          mimeType: "image/png",
          revisedPrompt: request.prompt
        )
      },
      providerInferenceSurfaceProvenance: .scaffoldPlaceholder,
      browserGroundingSurfaceProvenance: .scaffoldPlaceholder,
      audioTranscriptionSurfaceProvenance: .scaffoldPlaceholder,
      speechSynthesisSurfaceProvenance: .scaffoldPlaceholder,
      imageGenerationSurfaceProvenance: .scaffoldPlaceholder
    )
  }
}

/// Describes whether one composed host surface is absent, provided by a scaffold placeholder,
/// provided by the local baseline, or backed by a non-baseline composed adapter.
public enum PraxisHostAdapterSurfaceProvenance: String, Sendable {
  case unavailable
  case scaffoldPlaceholder
  case localBaseline
  case composed
}
