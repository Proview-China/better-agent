import PraxisGoal
import PraxisRuntimeFacades
import PraxisRun

public final class PraxisCLICommandBridge {
  public let runtimeFacade: PraxisRuntimeFacade
  public let stateMapper: PraxisPresentationStateMapper

  public init(
    runtimeFacade: PraxisRuntimeFacade,
    stateMapper: PraxisPresentationStateMapper = .init()
  ) {
    self.runtimeFacade = runtimeFacade
    self.stateMapper = stateMapper
  }

  public func handle(_ command: PraxisPresentationCommand) async throws -> PraxisPresentationState {
    switch command.intent {
    case .inspectArchitecture:
      return stateMapper.mapBlueprintSummary()
    case .runGoal:
      let goal = PraxisCompiledGoal(
        normalizedGoal: .init(
          id: .init(rawValue: "cli.goal"),
          title: "CLI requested goal",
          summary: command.payloadSummary
        ),
        intentSummary: command.payloadSummary
      )
      let summary = try await runtimeFacade.runFacade.runGoal(.init(goal: goal))
      return stateMapper.map(runSummary: summary)
    case .resumeRun:
      let summary = try await runtimeFacade.runFacade.resumeRun(
        .init(runID: PraxisRunID(rawValue: command.payloadSummary))
      )
      return stateMapper.map(runSummary: summary)
    case .inspectTap:
      let inspection = try await runtimeFacade.inspectionFacade.inspectTap()
      return stateMapper.map(tapInspection: inspection)
    case .inspectCmp:
      let inspection = try await runtimeFacade.inspectionFacade.inspectCmp()
      return stateMapper.map(cmpInspection: inspection)
    case .inspectMp:
      let inspection = try await runtimeFacade.inspectionFacade.inspectMp()
      return stateMapper.map(mpInspection: inspection)
    }
  }
}

@MainActor
public final class PraxisApplePresentationBridge {
  public let runtimeFacade: PraxisRuntimeFacade
  public let stateMapper: PraxisPresentationStateMapper

  public init(
    runtimeFacade: PraxisRuntimeFacade,
    stateMapper: PraxisPresentationStateMapper = .init()
  ) {
    self.runtimeFacade = runtimeFacade
    self.stateMapper = stateMapper
  }

  public func initialState() -> PraxisPresentationState {
    stateMapper.mapBlueprintSummary()
  }

  public func inspectTapState() async throws -> PraxisPresentationState {
    stateMapper.map(tapInspection: try await runtimeFacade.inspectionFacade.inspectTap())
  }

  public func inspectCmpState() async throws -> PraxisPresentationState {
    stateMapper.map(cmpInspection: try await runtimeFacade.inspectionFacade.inspectCmp())
  }

  public func inspectMpState() async throws -> PraxisPresentationState {
    stateMapper.map(mpInspection: try await runtimeFacade.inspectionFacade.inspectMp())
  }
}

public final class PraxisFFIBridge {
  public let runtimeFacade: PraxisRuntimeFacade

  public init(runtimeFacade: PraxisRuntimeFacade) {
    self.runtimeFacade = runtimeFacade
  }

  public func exportArchitectureSnapshot() -> PraxisRuntimeBlueprint {
    PraxisRuntimePresentationBridgeModule.bootstrap
  }
}
