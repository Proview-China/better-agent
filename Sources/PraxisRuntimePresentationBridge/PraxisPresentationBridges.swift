import Foundation
import PraxisGoal
import PraxisRuntimeFacades
import PraxisRuntimeInterface
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
      let inspection = try await runtimeFacade.inspectionFacade.inspectMp()
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
    stateMapper.map(mpInspection: try await runtimeFacade.inspectionFacade.inspectMp())
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

public final class PraxisFFIBridge {
  public let runtimeInterfaceRegistry: PraxisRuntimeInterfaceRegistry
  public let runtimeInterfaceCodec: any PraxisRuntimeInterfaceCoding

  public init(
    runtimeInterfaceRegistry: PraxisRuntimeInterfaceRegistry,
    runtimeInterfaceCodec: any PraxisRuntimeInterfaceCoding = PraxisJSONRuntimeInterfaceCodec()
  ) {
    self.runtimeInterfaceRegistry = runtimeInterfaceRegistry
    self.runtimeInterfaceCodec = runtimeInterfaceCodec
  }

  public func exportArchitectureSnapshot() -> PraxisRuntimeBlueprint {
    PraxisRuntimePresentationBridgeModule.bootstrap
  }

  public func openRuntimeSession() async throws -> PraxisRuntimeInterfaceSessionHandle {
    try await runtimeInterfaceRegistry.openSession()
  }

  public func activeRuntimeSessionHandles() async -> [PraxisRuntimeInterfaceSessionHandle] {
    await runtimeInterfaceRegistry.activeHandles()
  }

  public func closeRuntimeSession(_ handle: PraxisRuntimeInterfaceSessionHandle) async -> Bool {
    await runtimeInterfaceRegistry.closeSession(handle)
  }

  public func handleEncodedRequest(
    _ requestData: Data,
    on handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    let request: PraxisRuntimeInterfaceRequest
    do {
      request = try runtimeInterfaceCodec.decodeRequest(requestData)
    } catch {
      return try runtimeInterfaceCodec.encode(
        .failure(
          error: .init(
            code: .invalidInput,
            message: "Failed to decode runtime interface request payload: \(error)"
          )
        )
      )
    }

    let response = await runtimeInterfaceRegistry.handle(request, on: handle)
    return try runtimeInterfaceCodec.encode(response)
  }

  public func snapshotEncodedEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    try encodeEventEnvelope(await eventEnvelope(snapshot: true, for: handle))
  }

  public func drainEncodedEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    try encodeEventEnvelope(await eventEnvelope(snapshot: false, for: handle))
  }

  private func eventEnvelope(
    snapshot: Bool,
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async -> PraxisFFIEventEnvelope {
    let events = snapshot
      ? await runtimeInterfaceRegistry.snapshotEvents(for: handle)
      : await runtimeInterfaceRegistry.drainEvents(for: handle)

    guard let events else {
      return .failure(
        handle: handle,
        error: .init(
          code: .sessionNotFound,
          message: "Runtime interface session handle \(handle.rawValue) was not found."
        )
      )
    }

    return .success(handle: handle, events: events)
  }

  private func encodeEventEnvelope(_ envelope: PraxisFFIEventEnvelope) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return try encoder.encode(envelope)
  }
}
