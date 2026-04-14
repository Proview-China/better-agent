import PraxisCoreTypes
import PraxisInfraContracts
import PraxisProviderContracts
import PraxisToolingContracts
import PraxisUserIOContracts
import PraxisWorkspaceContracts

public protocol PraxisDependencyResolving {
  func resolveBoundary(named name: String) -> PraxisBoundaryDescriptor?
}

public final class PraxisDependencyGraph: PraxisDependencyResolving, @unchecked Sendable {
  public let boundaries: [PraxisBoundaryDescriptor]
  public let hostAdapters: PraxisHostAdapterRegistry

  public var providerInferenceExecutor: (any PraxisProviderInferenceExecutor)? {
    hostAdapters.providerInferenceExecutor
  }

  public var providerWebSearchExecutor: (any PraxisProviderWebSearchExecutor)? {
    hostAdapters.providerWebSearchExecutor
  }

  public var workspaceReader: (any PraxisWorkspaceReader)? {
    hostAdapters.workspaceReader
  }

  public var shellExecutor: (any PraxisShellExecutor)? {
    hostAdapters.shellExecutor
  }

  public var checkpointStore: (any PraxisCheckpointStoreContract)? {
    hostAdapters.checkpointStore
  }

  public var userInputDriver: (any PraxisUserInputDriver)? {
    hostAdapters.userInputDriver
  }

  public init(
    boundaries: [PraxisBoundaryDescriptor],
    hostAdapters: PraxisHostAdapterRegistry = .init(),
    providerInferenceExecutor: (any PraxisProviderInferenceExecutor)? = nil,
    providerInferenceSurfaceProvenance: PraxisHostAdapterSurfaceProvenance? = nil,
    workspaceReader: (any PraxisWorkspaceReader)? = nil,
    shellExecutor: (any PraxisShellExecutor)? = nil,
    checkpointStore: (any PraxisCheckpointStoreContract)? = nil,
    userInputDriver: (any PraxisUserInputDriver)? = nil,
  ) {
    self.boundaries = boundaries
    self.hostAdapters = PraxisHostAdapterRegistry(
      runtimeRootDirectory: hostAdapters.runtimeRootDirectory,
      workspaceRootDirectory: hostAdapters.workspaceRootDirectory,
      capabilityExecutor: hostAdapters.capabilityExecutor,
      providerInferenceExecutor: providerInferenceExecutor ?? hostAdapters.providerInferenceExecutor,
      providerWebSearchExecutor: hostAdapters.providerWebSearchExecutor,
      providerEmbeddingExecutor: hostAdapters.providerEmbeddingExecutor,
      providerFileStore: hostAdapters.providerFileStore,
      providerBatchExecutor: hostAdapters.providerBatchExecutor,
      providerSkillRegistry: hostAdapters.providerSkillRegistry,
      providerSkillActivator: hostAdapters.providerSkillActivator,
      providerMCPExecutor: hostAdapters.providerMCPExecutor,
      workspaceReader: workspaceReader ?? hostAdapters.workspaceReader,
      workspaceSearcher: hostAdapters.workspaceSearcher,
      workspaceWriter: hostAdapters.workspaceWriter,
      shellExecutor: shellExecutor ?? hostAdapters.shellExecutor,
      browserExecutor: hostAdapters.browserExecutor,
      browserGroundingCollector: hostAdapters.browserGroundingCollector,
      gitAvailabilityProbe: hostAdapters.gitAvailabilityProbe,
      gitExecutor: hostAdapters.gitExecutor,
      processSupervisor: hostAdapters.processSupervisor,
      checkpointStore: checkpointStore ?? hostAdapters.checkpointStore,
      journalStore: hostAdapters.journalStore,
      projectionStore: hostAdapters.projectionStore,
      cmpContextPackageStore: hostAdapters.cmpContextPackageStore,
      cmpControlStore: hostAdapters.cmpControlStore,
      cmpPeerApprovalStore: hostAdapters.cmpPeerApprovalStore,
      tapRuntimeEventStore: hostAdapters.tapRuntimeEventStore,
      messageBus: hostAdapters.messageBus,
      deliveryTruthStore: hostAdapters.deliveryTruthStore,
      embeddingStore: hostAdapters.embeddingStore,
      semanticSearchIndex: hostAdapters.semanticSearchIndex,
      semanticMemoryStore: hostAdapters.semanticMemoryStore,
      lineageStore: hostAdapters.lineageStore,
      userInputDriver: userInputDriver ?? hostAdapters.userInputDriver,
      permissionDriver: hostAdapters.permissionDriver,
      terminalPresenter: hostAdapters.terminalPresenter,
      conversationPresenter: hostAdapters.conversationPresenter,
      audioTranscriptionDriver: hostAdapters.audioTranscriptionDriver,
      speechSynthesisDriver: hostAdapters.speechSynthesisDriver,
      imageGenerationDriver: hostAdapters.imageGenerationDriver,
      providerInferenceSurfaceProvenance: providerInferenceExecutor == nil
        ? hostAdapters.providerInferenceSurfaceProvenance
        : (providerInferenceSurfaceProvenance ?? .composed),
      browserGroundingSurfaceProvenance: hostAdapters.browserGroundingSurfaceProvenance,
      audioTranscriptionSurfaceProvenance: hostAdapters.audioTranscriptionSurfaceProvenance,
      speechSynthesisSurfaceProvenance: hostAdapters.speechSynthesisSurfaceProvenance,
      imageGenerationSurfaceProvenance: hostAdapters.imageGenerationSurfaceProvenance
    )
  }

  public func resolveBoundary(named name: String) -> PraxisBoundaryDescriptor? {
    boundaries.first { $0.name == name }
  }
}
