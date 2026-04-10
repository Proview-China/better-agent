import Testing
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimePresentationBridge
@testable import PraxisRuntimeUseCases

struct HostRuntimeSurfaceTests {
  @Test
  func runtimeSurfaceModelsCaptureLocalHostProfileAndSmokeViews() {
    let hostProfile = PraxisLocalRuntimeHostProfile(
      executionStyle: "local-first",
      structuredStore: "sqlite",
      deliveryStore: "sqlite",
      messageTransport: "in_process_actor_bus",
      gitAccess: "system_git",
      semanticIndex: "accelerate"
    )
    let runtimeSummary = PraxisCmpProjectLocalRuntimeSummary(
      projectID: "project-1",
      hostProfile: hostProfile,
      componentStatuses: [
        "structuredStore": .ready,
        "messageTransport": .ready,
        "gitAccess": .degraded,
      ],
      issues: ["system git may require Command Line Tools installation"]
    )
    let smoke = PraxisRuntimeSmokeResult(
      summary: "local runtime mostly ready",
      checks: [
        .init(id: "cmp.host.sqlite", gate: "host", status: .ready, summary: "SQLite host profile ready"),
        .init(id: "cmp.host.git", gate: "host", status: .degraded, summary: "git may still need first-run installation")
      ]
    )

    #expect(runtimeSummary.hostProfile.executionStyle == "local-first")
    #expect(runtimeSummary.componentStatuses["gitAccess"] == PraxisTruthLayerStatus.degraded)
    #expect(smoke.checks.count == 2)
  }

  @Test
  func runtimeFacadeAndBridgeExposeStructuredPlaceholderFlow() async throws {
    let dependencies = PraxisDependencyGraph(
      boundaries: PraxisRuntimePresentationBridgeModule.bootstrap.foundationModules
        + PraxisRuntimePresentationBridgeModule.bootstrap.functionalDomainModules
        + PraxisRuntimePresentationBridgeModule.bootstrap.hostContractModules
        + PraxisRuntimePresentationBridgeModule.bootstrap.runtimeModules
    )
    let runtimeFacade = PraxisRuntimeFacade(
      runFacade: PraxisRunFacade(
        runGoalUseCase: PraxisRunGoalUseCase(dependencies: dependencies),
        resumeRunUseCase: PraxisResumeRunUseCase(dependencies: dependencies)
      ),
      inspectionFacade: PraxisInspectionFacade(
        inspectTapUseCase: PraxisInspectTapUseCase(dependencies: dependencies),
        inspectCmpUseCase: PraxisInspectCmpUseCase(dependencies: dependencies),
        inspectMpUseCase: PraxisInspectMpUseCase(dependencies: dependencies),
        buildCapabilityCatalogUseCase: PraxisBuildCapabilityCatalogUseCase(dependencies: dependencies)
      )
    )
    let bridge = PraxisCLICommandBridge(runtimeFacade: runtimeFacade)

    let architectureState = try await bridge.handle(.init(intent: .inspectArchitecture, payloadSummary: ""))
    let tapState = try await bridge.handle(.init(intent: .inspectTap, payloadSummary: ""))
    let cmpState = try await bridge.handle(.init(intent: .inspectCmp, payloadSummary: ""))
    let mpState = try await bridge.handle(.init(intent: .inspectMp, payloadSummary: ""))
    let catalog = try await runtimeFacade.inspectionFacade.buildCapabilityCatalogSnapshot()

    #expect(architectureState.title == "Praxis Architecture")
    #expect(tapState.title == "TAP Inspection")
    #expect(cmpState.title == "CMP Inspection")
    #expect(mpState.title == "MP Inspection")
    #expect(cmpState.summary.contains("SQLite"))
    #expect(mpState.summary.contains("Store:"))
    #expect(catalog.summary.contains("Capability catalog placeholder"))
  }
}
