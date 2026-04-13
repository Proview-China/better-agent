import Foundation
import PraxisGoal
import PraxisRuntimeFacades
import PraxisRun

public final class PraxisCLICommandBridge {
  public let runtimeFacade: PraxisRuntimeFacade
  public let stateMapper: PraxisPresentationStateMapper
  public let eventStream: PraxisPresentationEventStream

  public init(
    runtimeFacade: PraxisRuntimeFacade,
    stateMapper: PraxisPresentationStateMapper = .init(),
    eventStream: PraxisPresentationEventStream = .init()
  ) {
    self.runtimeFacade = runtimeFacade
    self.stateMapper = stateMapper
    self.eventStream = eventStream
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
      let state = stateMapper.map(runSummary: summary)
      await eventStream.append(contentsOf: state.events)
      return state
    case .resumeRun:
      let summary = try await runtimeFacade.runFacade.resumeRun(
        .init(runID: PraxisRunID(rawValue: command.payloadSummary))
      )
      let state = stateMapper.map(runSummary: summary)
      await eventStream.append(contentsOf: state.events)
      return state
    case .inspectTap:
      let inspection = try await runtimeFacade.inspectionFacade.inspectTap()
      return stateMapper.map(tapInspection: inspection)
    case .inspectCmp:
      let inspection = try await runtimeFacade.inspectionFacade.inspectCmp()
      return stateMapper.map(cmpInspection: inspection)
    case .inspectMp:
      let inspection = try await runtimeFacade.mpFacade.inspect()
      return stateMapper.map(mpInspection: inspection)
    case .buildCapabilityCatalog:
      let catalog = try await runtimeFacade.inspectionFacade.buildCapabilityCatalogSnapshot()
      return stateMapper.map(catalogSnapshot: catalog)
    }
  }

  public func snapshotEvents() async -> [PraxisPresentationEvent] {
    await eventStream.snapshot()
  }

  public func drainEvents() async -> [PraxisPresentationEvent] {
    await eventStream.drain()
  }
}

@MainActor
public final class PraxisApplePresentationBridge {
  public let runtimeFacade: PraxisRuntimeFacade
  public let stateMapper: PraxisPresentationStateMapper
  public let eventStream: PraxisPresentationEventStream

  public init(
    runtimeFacade: PraxisRuntimeFacade,
    stateMapper: PraxisPresentationStateMapper = .init(),
    eventStream: PraxisPresentationEventStream = .init()
  ) {
    self.runtimeFacade = runtimeFacade
    self.stateMapper = stateMapper
    self.eventStream = eventStream
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
    stateMapper.map(mpInspection: try await runtimeFacade.mpFacade.inspect())
  }

  public func buildCapabilityCatalogState() async throws -> PraxisPresentationState {
    stateMapper.map(catalogSnapshot: try await runtimeFacade.inspectionFacade.buildCapabilityCatalogSnapshot())
  }

  public func runGoalState(_ goal: PraxisCompiledGoal) async throws -> PraxisPresentationState {
    let summary = try await runtimeFacade.runFacade.runGoal(.init(goal: goal))
    let state = stateMapper.map(runSummary: summary)
    await eventStream.append(contentsOf: state.events)
    return state
  }

  public func resumeRunState(runID: PraxisRunID) async throws -> PraxisPresentationState {
    let summary = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))
    let state = stateMapper.map(runSummary: summary)
    await eventStream.append(contentsOf: state.events)
    return state
  }

  public func snapshotEvents() async -> [PraxisPresentationEvent] {
    await eventStream.snapshot()
  }

  public func drainEvents() async -> [PraxisPresentationEvent] {
    await eventStream.drain()
  }
}
