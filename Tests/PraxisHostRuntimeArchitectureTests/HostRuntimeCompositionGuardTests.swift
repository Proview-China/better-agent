import Foundation
import Testing
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeUseCases
import PraxisCoreTypes
import PraxisProviderContracts
import PraxisToolingContracts
import PraxisUserIOContracts
import PraxisWorkspaceContracts

private final class CompositionGuardWorkspaceReader: PraxisWorkspaceReader, @unchecked Sendable {
  func read(_ request: PraxisWorkspaceReadRequest) async throws -> PraxisWorkspaceReadResult {
    throw PraxisError.unsupportedOperation("Composition guard test double should not execute workspace reads.")
  }
}

private final class CompositionGuardShellExecutor: PraxisShellExecutor, @unchecked Sendable {
  func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult {
    throw PraxisError.unsupportedOperation("Composition guard test double should not execute shell commands.")
  }
}

private final class CompositionGuardUserInputDriver: PraxisUserInputDriver, @unchecked Sendable {
  func prompt(_ request: PraxisPromptRequest) async throws -> PraxisPromptResponse {
    throw PraxisError.unsupportedOperation("Composition guard test double should not prompt for user input.")
  }
}

private final class CompositionGuardProviderInferenceExecutor: PraxisProviderInferenceExecutor, @unchecked Sendable {
  func infer(_ request: PraxisProviderInferenceRequest) async throws -> PraxisProviderInferenceResponse {
    PraxisProviderInferenceResponse(
      output: .init(summary: "composition-guard override"),
      receipt: .init(
        capabilityKey: "provider.infer",
        backend: "composition-guard",
        status: .succeeded,
        summary: "Composition guard override."
      )
    )
  }
}

struct HostRuntimeCompositionGuardTests {
  @Test
  func bootstrapValidatorRejectsEmptyBoundaryLists() throws {
    let validator = PraxisBootstrapValidator()

    #expect(throws: PraxisError.dependencyMissing("Runtime composition requires at least one boundary descriptor.")) {
      try validator.validate(boundaries: [])
    }
  }

  @Test
  func bootstrapValidatorRejectsDuplicateBoundaryNames() throws {
    let validator = PraxisBootstrapValidator()
    let duplicateBoundaries = [
      PraxisBoundaryDescriptor(name: "PraxisRuntimeUseCases", responsibility: "use cases"),
      PraxisBoundaryDescriptor(name: "PraxisRuntimeUseCases", responsibility: "duplicate use cases"),
    ]

    #expect(throws: PraxisError.invariantViolation("Duplicate runtime boundary detected: PraxisRuntimeUseCases")) {
      try validator.validate(boundaries: duplicateBoundaries)
    }
  }

  @Test
  func compositionRootBuildsResolvableGraphAndRetainsRegistryInputs() throws {
    let boundaries = [
      PraxisBoundaryDescriptor(name: "PraxisRuntimeComposition", responsibility: "composition"),
      PraxisBoundaryDescriptor(name: "PraxisRuntimeUseCases", responsibility: "use cases"),
      PraxisBoundaryDescriptor(name: "PraxisRuntimeFacades", responsibility: "facades"),
    ]
    let rootDirectory = Self.temporaryRootDirectory()
    let workspaceReader = CompositionGuardWorkspaceReader()
    let shellExecutor = CompositionGuardShellExecutor()
    let userInputDriver = CompositionGuardUserInputDriver()
    let registry = PraxisHostAdapterRegistry(
      runtimeRootDirectory: rootDirectory,
      workspaceRootDirectory: rootDirectory,
      workspaceReader: workspaceReader,
      shellExecutor: shellExecutor,
      userInputDriver: userInputDriver
    )
    let root = PraxisRuntimeCompositionRoot(boundaries: boundaries, hostAdapters: registry)

    let graph = try root.makeDependencyGraph()

    #expect(graph.boundaries == boundaries)
    #expect(graph.resolveBoundary(named: "PraxisRuntimeUseCases") == boundaries[1])
    #expect(graph.resolveBoundary(named: "PraxisRuntimeGateway") == nil)
    #expect(graph.hostAdapters.runtimeRootDirectory?.standardizedFileURL == rootDirectory.standardizedFileURL)
    #expect(graph.hostAdapters.workspaceRootDirectory?.standardizedFileURL == rootDirectory.standardizedFileURL)
    #expect(Self.sameInstance(graph.workspaceReader.map { $0 as AnyObject }, workspaceReader))
    #expect(Self.sameInstance(graph.shellExecutor.map { $0 as AnyObject }, shellExecutor))
    #expect(Self.sameInstance(graph.userInputDriver.map { $0 as AnyObject }, userInputDriver))
  }

  @Test
  func dependencyGraphOverridesOnlyRequestedAdapters() {
    let boundaries = [
      PraxisBoundaryDescriptor(name: "PraxisRuntimeComposition", responsibility: "composition"),
    ]
    let originalWorkspaceReader = CompositionGuardWorkspaceReader()
    let originalShellExecutor = CompositionGuardShellExecutor()
    let originalUserInputDriver = CompositionGuardUserInputDriver()
    let overrideWorkspaceReader = CompositionGuardWorkspaceReader()
    let overrideUserInputDriver = CompositionGuardUserInputDriver()
    let registry = PraxisHostAdapterRegistry(
      workspaceReader: originalWorkspaceReader,
      shellExecutor: originalShellExecutor,
      userInputDriver: originalUserInputDriver
    )

    let graph = PraxisDependencyGraph(
      boundaries: boundaries,
      hostAdapters: registry,
      workspaceReader: overrideWorkspaceReader,
      userInputDriver: overrideUserInputDriver
    )

    #expect(Self.sameInstance(graph.workspaceReader.map { $0 as AnyObject }, overrideWorkspaceReader))
    #expect(Self.sameInstance(graph.hostAdapters.workspaceReader.map { $0 as AnyObject }, overrideWorkspaceReader))
    #expect(Self.sameInstance(graph.shellExecutor.map { $0 as AnyObject }, originalShellExecutor))
    #expect(Self.sameInstance(graph.hostAdapters.shellExecutor.map { $0 as AnyObject }, originalShellExecutor))
    #expect(Self.sameInstance(graph.userInputDriver.map { $0 as AnyObject }, overrideUserInputDriver))
    #expect(Self.sameInstance(graph.hostAdapters.userInputDriver.map { $0 as AnyObject }, overrideUserInputDriver))
  }

  @Test
  func dependencyGraphProviderInferenceOverrideDefaultsProvenanceToCurrentOverrideSurface() {
    let boundaries = [
      PraxisBoundaryDescriptor(name: "PraxisRuntimeComposition", responsibility: "composition"),
    ]
    let registry = PraxisHostAdapterRegistry(
      providerInferenceExecutor: CompositionGuardProviderInferenceExecutor(),
      providerInferenceSurfaceProvenance: .localBaseline
    )
    let overrideProviderInferenceExecutor = CompositionGuardProviderInferenceExecutor()

    let graph = PraxisDependencyGraph(
      boundaries: boundaries,
      hostAdapters: registry,
      providerInferenceExecutor: overrideProviderInferenceExecutor
    )
    let smoke = PraxisMpHostInspectionService().smoke(
      projectID: "mp.local-runtime",
      hostAdapters: graph.hostAdapters
    )

    #expect(Self.sameInstance(graph.providerInferenceExecutor.map { $0 as AnyObject }, overrideProviderInferenceExecutor))
    #expect(graph.hostAdapters.providerInferenceSurfaceProvenance == .composed)
    #expect(
      smoke.checks.first { $0.gate == .providerInference }?.summary
        == "Provider inference surface is composed for MP enrichment."
    )
  }

  @Test
  func hostAdapterFactoryScaffoldDefaultsReturnNonEmptyNeutralRegistry() {
    let factory = PraxisHostAdapterFactory()

    let registry = factory.makeScaffoldAdapters()

    #expect(registry.runtimeRootDirectory == nil)
    #expect(registry.workspaceRootDirectory == nil)
    #expect(registry.capabilityExecutor != nil)
    #expect(registry.providerInferenceExecutor != nil)
    #expect(registry.workspaceReader != nil)
    #expect(registry.shellExecutor != nil)
    #expect(registry.messageBus != nil)
    #expect(registry.tapRuntimeEventStore != nil)
    #expect(registry.userInputDriver != nil)
    #expect(registry.terminalPresenter != nil)
  }

  @Test
  func hostAdapterFactoryScaffoldDefaultsExposePlatformAwareGitProbeProfile() async {
    let factory = PraxisHostAdapterFactory()

    let registry = factory.makeScaffoldAdapters()
    let report = await registry.gitAvailabilityProbe?.probeGitReadiness()

    #expect(report?.status == PraxisLocalHostPlatformSupport.scaffoldGitAvailabilityStatus)
    #expect(report?.executablePath == PraxisLocalHostPlatformSupport.scaffoldGitExecutablePath)
    #expect(report?.supportsWorktree == PraxisLocalHostPlatformSupport.scaffoldGitSupportsWorktree)
    #expect(report?.remediationHint == PraxisLocalHostPlatformSupport.scaffoldGitRemediationHint)
    #expect(report?.notes == PraxisLocalHostPlatformSupport.scaffoldGitNotes)
  }

  @Test
  func hostAdapterFactoryLocalDefaultsPreserveExplicitRootAndProvisionCoreAdapters() throws {
    let factory = PraxisHostAdapterFactory()
    let rootDirectory = Self.temporaryRootDirectory()
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = factory.makeLocalAdapters(rootDirectory: rootDirectory)

    #expect(registry.runtimeRootDirectory?.standardizedFileURL == rootDirectory.standardizedFileURL)
    #expect(registry.workspaceRootDirectory?.standardizedFileURL == rootDirectory.standardizedFileURL)
    #expect(registry.capabilityExecutor != nil)
    #expect(registry.providerInferenceExecutor != nil)
    #expect(registry.workspaceReader != nil)
    #expect(registry.shellExecutor != nil)
    #expect(registry.checkpointStore != nil)
    #expect(registry.tapRuntimeEventStore != nil)
    #expect(registry.permissionDriver != nil)
  }

  private static func sameInstance(_ lhs: AnyObject?, _ rhs: AnyObject?) -> Bool {
    switch (lhs, rhs) {
    case (nil, nil):
      true
    case let (lhs?, rhs?):
      ObjectIdentifier(lhs) == ObjectIdentifier(rhs)
    default:
      false
    }
  }

  private static func temporaryRootDirectory() -> URL {
    FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-composition-guard-\(UUID().uuidString)", isDirectory: true)
      .standardizedFileURL
  }
}
