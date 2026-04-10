import PraxisRuntimeFacades

public struct PraxisPresentationStateMapper: Sendable {
  public init() {}

  public func mapBlueprintSummary() -> PraxisPresentationState {
    PraxisPresentationState(
      title: "Praxis Architecture",
      summary: "Foundation \(PraxisRuntimePresentationBridgeModule.bootstrap.foundationModules.count) / Domain \(PraxisRuntimePresentationBridgeModule.bootstrap.functionalDomainModules.count) / Host \(PraxisRuntimePresentationBridgeModule.bootstrap.hostContractModules.count + PraxisRuntimePresentationBridgeModule.bootstrap.runtimeModules.count)"
    )
  }

  public func map(runSummary: PraxisRunSummary) -> PraxisPresentationState {
    PraxisPresentationState(
      title: "Run \(runSummary.runID.rawValue)",
      summary: runSummary.phaseSummary
    )
  }

  public func map(tapInspection: PraxisTapInspectionSnapshot) -> PraxisPresentationState {
    PraxisPresentationState(
      title: "TAP Inspection",
      summary: "\(tapInspection.summary) Governance: \(tapInspection.governanceSummary)"
    )
  }

  public func map(cmpInspection: PraxisCmpInspectionSnapshot) -> PraxisPresentationState {
    PraxisPresentationState(
      title: "CMP Inspection",
      summary: "\(cmpInspection.projectID): \(cmpInspection.hostRuntimeSummary)"
    )
  }

  public func map(catalogSnapshot: PraxisInspectionSnapshot) -> PraxisPresentationState {
    PraxisPresentationState(
      title: "Capability Catalog",
      summary: catalogSnapshot.summary
    )
  }
}

public actor PraxisPresentationEventStream {
  public private(set) var events: [PraxisPresentationEvent]

  public init(events: [PraxisPresentationEvent] = []) {
    self.events = events
  }

  public func append(_ event: PraxisPresentationEvent) {
    events.append(event)
  }
}
