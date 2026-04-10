import Testing
@testable import PraxisCapabilityCatalog
@testable import PraxisCapabilityContracts
@testable import PraxisCapabilityPlanning

struct CapabilityExecutionSurfaceTests {
  @Test
  func capabilityPlanningBoundaryStillCoversExecutionPlaneModules() {
    #expect(PraxisCapabilityPlanningModule.boundary.tsModules.contains("src/agent_core/capability-gateway"))
    #expect(PraxisCapabilityPlanningModule.boundary.tsModules.contains("src/agent_core/capability-pool"))
    #expect(PraxisCapabilityPlanningModule.boundary.tsModules.contains("src/agent_core/port"))
  }

  @Test
  func capabilityExecutionModelsCaptureGatewayPoolAndPortSurface() {
    let capabilityID = PraxisCapabilityID(rawValue: "code.read")
    let prepared = PraxisPreparedCapabilityCall(
      preparedID: "prepared-1",
      capabilityID: capabilityID,
      bindingKey: "binding.read",
      inputSummary: "read current file",
      metadata: ["scope": "workspace"]
    )
    let handle = PraxisCapabilityExecutionHandle(
      executionID: "exec-1",
      preparedID: prepared.preparedID,
      state: .running,
      startedAt: "2026-04-10T12:00:00Z"
    )
    let backpressure = PraxisCapabilityBackpressureState(
      queueDepth: 2,
      inflightCount: 1,
      isDraining: false
    )
    let intent = PraxisCapabilityPortIntent(
      intentID: "intent-1",
      capabilityID: capabilityID,
      correlationID: "corr-1",
      payloadSummary: "read app.swift",
      createdAt: "2026-04-10T12:00:00Z"
    )
    let result = PraxisCapabilityPortResult(
      intentID: intent.intentID,
      executionID: handle.executionID,
      state: .completed,
      summary: "returned 40 lines"
    )

    #expect(prepared.capabilityID == capabilityID)
    #expect(handle.preparedID == "prepared-1")
    #expect(backpressure.queueDepth == 2)
    #expect(intent.correlationID == "corr-1")
    #expect(result.executionID == "exec-1")
  }

  @Test
  func capabilityCatalogTracksMpWorkflowFamilyBaseline() {
    let baseline = PraxisCapabilityCatalogBuilder().buildMpBaseline()

    #expect(baseline.familyName == "mp")
    #expect(baseline.capabilityIDs.contains(PraxisCapabilityID(rawValue: "mp.ingest")))
    #expect(baseline.capabilityIDs.contains(PraxisCapabilityID(rawValue: "mp.resolve")))
    #expect(baseline.capabilityIDs.contains(PraxisCapabilityID(rawValue: "mp.compact")))
  }
}
