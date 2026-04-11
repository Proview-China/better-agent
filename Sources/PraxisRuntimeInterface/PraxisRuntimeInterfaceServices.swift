import Foundation
import PraxisGoal
import PraxisCoreTypes
import PraxisRuntimeFacades
import PraxisRun
import PraxisSession
import PraxisTransition

private func requireRuntimeInterfaceField(
  _ value: String,
  named field: String
) throws -> String {
  guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    throw PraxisRuntimeInterfaceError.missingRequiredField(field)
  }
  return value
}

private func requireRuntimeInterfaceText(
  _ value: String,
  named field: String
) throws -> String {
  guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    throw PraxisError.invalidInput("Field \(field) must not be empty.")
  }
  return value
}

private func requireRuntimeInterfaceElements<Element>(
  _ value: [Element],
  named field: String
) throws -> [Element] {
  guard !value.isEmpty else {
    throw PraxisError.invalidInput("Field \(field) must not be empty.")
  }
  return value
}

private func requireRuntimeInterfaceIdentifierElements(
  _ value: [String],
  named field: String
) throws -> [String] {
  let elements = try requireRuntimeInterfaceElements(value, named: field)
  guard elements.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
    throw PraxisError.invalidInput("Field \(field) must not contain blank identifiers.")
  }
  return elements
}

private func runtimeInterfaceDecodingPath(from codingPath: [CodingKey]) -> String {
  let path = codingPath.map(\.stringValue).filter { !$0.isEmpty }
  return path.isEmpty ? "request" : path.joined(separator: ".")
}

private func runtimeInterfaceInvalidRequestError(from error: DecodingError) -> PraxisError {
  let message: String
  switch error {
  case .typeMismatch(_, let context):
    message = "Failed to decode runtime interface request at \(runtimeInterfaceDecodingPath(from: context.codingPath)): \(context.debugDescription)"
  case .valueNotFound(_, let context):
    message = "Failed to decode runtime interface request at \(runtimeInterfaceDecodingPath(from: context.codingPath)): \(context.debugDescription)"
  case .keyNotFound(let key, let context):
    let path = runtimeInterfaceDecodingPath(from: context.codingPath + [key])
    message = "Failed to decode runtime interface request at \(path): \(context.debugDescription)"
  case .dataCorrupted(let context):
    message = "Failed to decode runtime interface request at \(runtimeInterfaceDecodingPath(from: context.codingPath)): \(context.debugDescription)"
  @unknown default:
    message = "Failed to decode runtime interface request."
  }
  return .invalidInput(message)
}

public protocol PraxisRuntimeInterfaceServing: Sendable {
  /// Returns the baseline architecture snapshot without mutating runtime state.
  ///
  /// - Returns: A host-neutral snapshot describing the current runtime topology.
  func bootstrapSnapshot() -> PraxisRuntimeInterfaceSnapshot

  /// Handles one host-neutral runtime request and returns a neutral response envelope.
  ///
  /// - Parameter request: The request to execute against the runtime surface.
  /// - Returns: A host-neutral response containing the latest snapshot and newly emitted events.
  func handle(_ request: PraxisRuntimeInterfaceRequest) async -> PraxisRuntimeInterfaceResponse

  /// Returns all accumulated runtime interface events without clearing them.
  ///
  /// - Returns: The current buffered event list.
  func snapshotEvents() async -> [PraxisRuntimeInterfaceEvent]

  /// Returns and clears all accumulated runtime interface events.
  ///
  /// - Returns: The drained event list.
  func drainEvents() async -> [PraxisRuntimeInterfaceEvent]
}

public protocol PraxisRuntimeInterfaceCoding: Sendable {
  /// Encodes a runtime interface request.
  ///
  /// - Parameter request: The request to encode.
  /// - Returns: Serialized request data.
  /// - Throws: Any encoding error produced by the codec.
  func encode(_ request: PraxisRuntimeInterfaceRequest) throws -> Data

  /// Decodes a runtime interface request.
  ///
  /// - Parameter data: Serialized request data.
  /// - Returns: The decoded request envelope.
  /// - Throws: Any decoding error produced by the codec.
  func decodeRequest(_ data: Data) throws -> PraxisRuntimeInterfaceRequest

  /// Encodes a runtime interface response.
  ///
  /// - Parameter response: The response to encode.
  /// - Returns: Serialized response data.
  /// - Throws: Any encoding error produced by the codec.
  func encode(_ response: PraxisRuntimeInterfaceResponse) throws -> Data

  /// Decodes a runtime interface response.
  ///
  /// - Parameter data: Serialized response data.
  /// - Returns: The decoded response envelope.
  /// - Throws: Any decoding error produced by the codec.
  func decodeResponse(_ data: Data) throws -> PraxisRuntimeInterfaceResponse
}

public struct PraxisJSONRuntimeInterfaceCodec: Sendable, PraxisRuntimeInterfaceCoding {
  public init() {}

  public func encode(_ request: PraxisRuntimeInterfaceRequest) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return try encoder.encode(request)
  }

  public func decodeRequest(_ data: Data) throws -> PraxisRuntimeInterfaceRequest {
    do {
      return try JSONDecoder().decode(PraxisRuntimeInterfaceRequest.self, from: data)
    } catch let error as DecodingError {
      throw runtimeInterfaceInvalidRequestError(from: error)
    }
  }

  public func encode(_ response: PraxisRuntimeInterfaceResponse) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return try encoder.encode(response)
  }

  public func decodeResponse(_ data: Data) throws -> PraxisRuntimeInterfaceResponse {
    try JSONDecoder().decode(PraxisRuntimeInterfaceResponse.self, from: data)
  }
}

public actor PraxisRuntimeInterfaceRegistry {
  public typealias SessionFactory =
    @Sendable (PraxisRuntimeInterfaceSessionHandle) async throws -> any PraxisRuntimeInterfaceServing

  private var sessions: [PraxisRuntimeInterfaceSessionHandle: any PraxisRuntimeInterfaceServing]
  private var nextHandleSequence: Int
  private let sessionFactory: SessionFactory

  /// Creates a registry that owns host-neutral runtime interface sessions by opaque handle.
  ///
  /// - Parameters:
  ///   - sessions: Seed sessions keyed by existing handles.
  ///   - nextHandleSequence: Sequence used to derive the next generated handle identifier.
  ///   - sessionFactory: Factory that materializes a new serving session for each opened handle.
  public init(
    sessions: [PraxisRuntimeInterfaceSessionHandle: any PraxisRuntimeInterfaceServing] = [:],
    nextHandleSequence: Int = 1,
    sessionFactory: @escaping SessionFactory
  ) {
    self.sessions = sessions
    self.nextHandleSequence = nextHandleSequence
    self.sessionFactory = sessionFactory
  }

  /// Opens a new interface session and returns its stable opaque handle.
  ///
  /// - Returns: A newly allocated runtime interface session handle.
  /// - Throws: Any error raised while materializing the underlying session.
  public func openSession() async throws -> PraxisRuntimeInterfaceSessionHandle {
    let handle = makeNextHandle()
    sessions[handle] = try await sessionFactory(handle)
    return handle
  }

  /// Returns the currently active interface session handles.
  ///
  /// - Returns: Stable handles sorted by their opaque raw value.
  public func activeHandles() -> [PraxisRuntimeInterfaceSessionHandle] {
    sessions.keys.sorted { $0.rawValue < $1.rawValue }
  }

  /// Reports whether the registry still owns the given session handle.
  ///
  /// - Parameter handle: The opaque handle to look up.
  /// - Returns: `true` when the session is still active.
  public func containsSession(_ handle: PraxisRuntimeInterfaceSessionHandle) -> Bool {
    sessions[handle] != nil
  }

  /// Closes and removes one interface session from the registry.
  ///
  /// - Parameter handle: The opaque handle to close.
  /// - Returns: `true` when a live handle was removed.
  public func closeSession(_ handle: PraxisRuntimeInterfaceSessionHandle) -> Bool {
    sessions.removeValue(forKey: handle) != nil
  }

  /// Returns the architecture bootstrap snapshot for a live handle.
  ///
  /// - Parameter handle: The opaque session handle to inspect.
  /// - Returns: The bootstrap snapshot when the handle exists, otherwise `nil`.
  public func bootstrapSnapshot(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) -> PraxisRuntimeInterfaceSnapshot? {
    guard let session = sessions[handle] else {
      return nil
    }
    return session.bootstrapSnapshot()
  }

  /// Routes one runtime request to the interface session identified by the handle.
  ///
  /// - Parameters:
  ///   - request: The host-neutral runtime request to execute.
  ///   - handle: The opaque session handle that owns the event buffer for this request.
  /// - Returns: A neutral response envelope. Missing handles map to `session_not_found`.
  public func handle(
    _ request: PraxisRuntimeInterfaceRequest,
    on handle: PraxisRuntimeInterfaceSessionHandle
  ) async -> PraxisRuntimeInterfaceResponse {
    guard let session = sessions[handle] else {
      return .failure(
        error: .init(
          code: .sessionNotFound,
          message: "Runtime interface session handle \(handle.rawValue) was not found."
        )
      )
    }
    return await session.handle(request)
  }

  /// Returns buffered events for a live handle without clearing them.
  ///
  /// - Parameter handle: The opaque session handle to inspect.
  /// - Returns: Buffered events when the handle exists, otherwise `nil`.
  public func snapshotEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async -> [PraxisRuntimeInterfaceEvent]? {
    guard let session = sessions[handle] else {
      return nil
    }
    return await session.snapshotEvents()
  }

  /// Returns and clears buffered events for a live handle.
  ///
  /// - Parameter handle: The opaque session handle to drain.
  /// - Returns: Drained events when the handle exists, otherwise `nil`.
  public func drainEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async -> [PraxisRuntimeInterfaceEvent]? {
    guard let session = sessions[handle] else {
      return nil
    }
    return await session.drainEvents()
  }

  private func makeNextHandle() -> PraxisRuntimeInterfaceSessionHandle {
    while true {
      let handle = PraxisRuntimeInterfaceSessionHandle(
        rawValue: "runtime-interface-session-\(nextHandleSequence)"
      )
      nextHandleSequence += 1
      if sessions[handle] == nil {
        return handle
      }
    }
  }
}

public actor PraxisRuntimeInterfaceSession: PraxisRuntimeInterfaceServing {
  public let runtimeFacade: PraxisRuntimeFacade
  public let blueprint: PraxisRuntimeBlueprint

  private var events: [PraxisRuntimeInterfaceEvent]

  public init(
    runtimeFacade: PraxisRuntimeFacade,
    blueprint: PraxisRuntimeBlueprint,
    events: [PraxisRuntimeInterfaceEvent] = []
  ) {
    self.runtimeFacade = runtimeFacade
    self.blueprint = blueprint
    self.events = events
  }

  public nonisolated func bootstrapSnapshot() -> PraxisRuntimeInterfaceSnapshot {
    PraxisRuntimeInterfaceSnapshot(
      kind: .architecture,
      title: "Praxis Architecture",
      summary: "Foundation \(blueprint.foundationModules.count) / Domain \(blueprint.functionalDomainModules.count) / Host \(blueprint.hostContractModules.count + blueprint.runtimeModules.count)"
    )
  }

  public func handle(_ request: PraxisRuntimeInterfaceRequest) async -> PraxisRuntimeInterfaceResponse {
    do {
      let response = try await handleThrowing(request)
      if response.isSuccess {
        events.append(contentsOf: response.events)
      }
      return response
    } catch {
      return failureResponse(for: error, request: request)
    }
  }

  public func snapshotEvents() async -> [PraxisRuntimeInterfaceEvent] {
    events
  }

  public func drainEvents() async -> [PraxisRuntimeInterfaceEvent] {
    let snapshot = events
    events = []
    return snapshot
  }

  private func response(from summary: PraxisRunSummary) -> PraxisRuntimeInterfaceResponse {
    let snapshot = PraxisRuntimeInterfaceSnapshot(
      kind: .run,
      title: "Run \(summary.runID.rawValue)",
      summary: summary.phaseSummary,
      runID: summary.runID,
      sessionID: summary.sessionID,
      phase: summary.phase,
      tickCount: summary.tickCount,
      lifecycleDisposition: summary.lifecycleDisposition,
      checkpointReference: summary.checkpointReference,
      pendingIntentID: summary.followUpAction?.intentID,
      recoveredEventCount: summary.recoveredEventCount
    )
    return .success(snapshot: snapshot, events: makeEvents(from: summary))
  }

  private func response(from session: PraxisCmpSessionSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpSession,
        title: "CMP Session \(session.sessionID)",
        summary: session.summary,
        projectID: session.projectID,
        sessionID: .init(rawValue: session.sessionID)
      ),
      events: [
        .init(
          name: "cmp.session.opened",
          detail: session.summary,
          sessionID: .init(rawValue: session.sessionID)
        )
      ]
    )
  }

  private func response(from status: PraxisTapStatusSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .tapStatus,
        title: "TAP Status \(status.projectID)",
        summary: "\(status.summary) \(status.readinessSummary)",
        projectID: status.projectID
      ),
      events: [
        .init(
          name: "tap.status.readback",
          detail: status.readinessSummary
        )
      ]
    )
  }

  private func response(from history: PraxisTapHistorySnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .tapHistory,
        title: "TAP History \(history.projectID)",
        summary: history.summary,
        projectID: history.projectID
      ),
      events: [
        .init(
          name: "tap.history.readback",
          detail: history.summary
        )
      ]
    )
  }

  private func response(from readback: PraxisCmpProjectReadbackSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpProject,
        title: "CMP Project \(readback.projectSummary.projectID)",
        summary: readback.summary,
        projectID: readback.projectSummary.projectID
      )
    )
  }

  private func response(from roles: PraxisCmpRolesPanelSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpRoles,
        title: "CMP Roles \(roles.projectID)",
        summary: roles.summary,
        projectID: roles.projectID
      ),
      events: [
        .init(
          name: "cmp.roles.readback",
          detail: roles.summary
        )
      ]
    )
  }

  private func response(from control: PraxisCmpControlPanelSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpControl,
        title: "CMP Control \(control.projectID)",
        summary: control.summary,
        projectID: control.projectID
      ),
      events: [
        .init(
          name: "cmp.control.readback",
          detail: control.summary
        )
      ]
    )
  }

  private func response(from update: PraxisCmpControlUpdateSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpControl,
        title: "CMP Control \(update.projectID)",
        summary: update.summary,
        projectID: update.projectID
      ),
      events: [
        .init(
          name: "cmp.control.updated",
          detail: update.summary
        )
      ]
    )
  }

  private func response(from approval: PraxisCmpPeerApprovalSnapshot) -> PraxisRuntimeInterfaceResponse {
    response(from: approval, eventName: "cmp.peer_approval.requested")
  }

  private func response(
    from approval: PraxisCmpPeerApprovalSnapshot,
    eventName: String
  ) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpApproval,
        title: "CMP Approval \(approval.projectID)",
        summary: approval.summary,
        projectID: approval.projectID
      ),
      events: [
        .init(
          name: eventName,
          detail: approval.decisionSummary
        )
      ]
    )
  }

  private func response(from readback: PraxisCmpPeerApprovalReadbackSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpApproval,
        title: "CMP Approval \(readback.projectID)",
        summary: readback.summary,
        projectID: readback.projectID
      ),
      events: [
        .init(
          name: "cmp.peer_approval.readback",
          detail: readback.summary
        )
      ]
    )
  }

  private func response(from status: PraxisCmpStatusPanelSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpStatus,
        title: "CMP Status \(status.projectID)",
        summary: status.summary,
        projectID: status.projectID
      ),
      events: [
        .init(
          name: "cmp.status.readback",
          detail: status.summary
        )
      ]
    )
  }

  private func response(from bootstrap: PraxisCmpProjectBootstrapSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpBootstrap,
        title: "CMP Bootstrap \(bootstrap.projectSummary.projectID)",
        summary: bootstrap.summary,
        projectID: bootstrap.projectSummary.projectID
      ),
      events: [
        .init(
          name: "cmp.project.bootstrapped",
          detail: bootstrap.summary
        )
      ]
    )
  }

  private func response(from recovery: PraxisCmpProjectRecoverySnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpRecover,
        title: "CMP Recover \(recovery.projectID)",
        summary: recovery.summary,
        projectID: recovery.projectID
      ),
      events: [
        .init(
          name: "cmp.project.recovered",
          detail: recovery.summary,
          intentID: recovery.packageID
        )
      ]
    )
  }

  private func response(from ingest: PraxisCmpFlowIngestSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Ingest \(ingest.projectID)",
        summary: ingest.summary,
        projectID: ingest.projectID,
        sessionID: .init(rawValue: ingest.sessionID)
      ),
      events: [
        .init(
          name: "cmp.flow.ingested",
          detail: ingest.summary,
          sessionID: .init(rawValue: ingest.sessionID)
        )
      ]
    )
  }

  private func response(from commit: PraxisCmpFlowCommitSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Commit \(commit.projectID)",
        summary: commit.summary,
        projectID: commit.projectID
      ),
      events: [
        .init(
          name: "cmp.flow.committed",
          detail: commit.summary,
          intentID: commit.deltaID
        )
      ]
    )
  }

  private func response(from resolve: PraxisCmpFlowResolveSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Resolve \(resolve.projectID)",
        summary: resolve.summary,
        projectID: resolve.projectID
      ),
      events: [
        .init(
          name: "cmp.flow.resolved",
          detail: resolve.summary,
          intentID: resolve.snapshotID
        )
      ]
    )
  }

  private func response(from materialize: PraxisCmpFlowMaterializeSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Materialize \(materialize.projectID)",
        summary: materialize.summary,
        projectID: materialize.projectID
      ),
      events: [
        .init(
          name: "cmp.flow.materialized",
          detail: materialize.summary,
          intentID: materialize.packageID
        )
      ]
    )
  }

  private func response(
    from dispatch: PraxisCmpFlowDispatchSnapshot,
    titlePrefix: String = "CMP Dispatch",
    eventName: String = "cmp.flow.dispatched"
  ) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "\(titlePrefix) \(dispatch.projectID)",
        summary: dispatch.summary,
        projectID: dispatch.projectID
      ),
      events: [
        .init(
          name: eventName,
          detail: dispatch.summary,
          intentID: dispatch.dispatchID
        )
      ]
    )
  }

  private func response(from history: PraxisCmpFlowHistorySnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP History \(history.projectID)",
        summary: history.summary,
        projectID: history.projectID
      ),
      events: [
        .init(
          name: "cmp.flow.history_requested",
          detail: history.summary,
          intentID: history.packageID ?? history.snapshotID
        )
      ]
    )
  }

  private func response(from smoke: PraxisCmpProjectSmokeSnapshot) -> PraxisRuntimeInterfaceResponse {
    .success(
      snapshot: .init(
        kind: .smoke,
        title: "CMP Smoke \(smoke.projectID)",
        summary: smoke.smokeResult.summary,
        projectID: smoke.projectID
      )
    )
  }

  private func makeEvents(from summary: PraxisRunSummary) -> [PraxisRuntimeInterfaceEvent] {
    let lifecycleEventName: String
    switch summary.lifecycleDisposition {
    case .started:
      lifecycleEventName = "run.started"
    case .resumed:
      lifecycleEventName = "run.resumed"
    case .recoveredWithoutResume:
      lifecycleEventName = "run.recovered"
    }

    var mapped: [PraxisRuntimeInterfaceEvent] = [
      .init(
        name: lifecycleEventName,
        detail: summary.phaseSummary,
        runID: summary.runID,
        sessionID: summary.sessionID,
        intentID: summary.followUpAction?.intentID
      )
    ]

    if let followUpAction = summary.followUpAction {
      mapped.append(
        .init(
          name: "run.follow_up_ready",
          detail: "\(followUpAction.kind.rawValue): \(followUpAction.reason)",
          runID: summary.runID,
          sessionID: summary.sessionID,
          intentID: followUpAction.intentID
        )
      )
    }

    return mapped
  }

  private func handleThrowing(_ request: PraxisRuntimeInterfaceRequest) async throws -> PraxisRuntimeInterfaceResponse {
    switch request {
    case .inspectArchitecture:
      return .success(snapshot: bootstrapSnapshot())
    case .runGoal(let payload):
      let goal = PraxisCompiledGoal(
        normalizedGoal: .init(
          id: .init(rawValue: payload.goalID),
          title: payload.goalTitle,
          summary: payload.payloadSummary
        ),
        intentSummary: payload.payloadSummary
      )
      let summary = try await runtimeFacade.runFacade.runGoal(
        .init(
          goal: goal,
          sessionID: payload.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
      return response(from: summary)
    case .resumeRun(let payload):
      guard !payload.runID.isEmpty else {
        throw PraxisRuntimeInterfaceError.missingRequiredField("runID")
      }
      let summary = try await runtimeFacade.runFacade.resumeRun(
        .init(runID: .init(rawValue: payload.runID))
      )
      return response(from: summary)
    case .inspectTap:
      let inspection = try await runtimeFacade.inspectionFacade.inspectTap()
      return .success(
        snapshot: .init(
          kind: .inspection,
          title: "TAP Inspection",
          summary: "\(inspection.summary) Governance: \(inspection.governanceSummary)"
        )
      )
    case .readbackTapStatus(let payload):
      guard !payload.projectID.isEmpty else {
        throw PraxisRuntimeInterfaceError.missingRequiredField("projectID")
      }
      let status = try await runtimeFacade.inspectionFacade.readbackTapStatus(
        .init(projectID: payload.projectID, agentID: payload.agentID)
      )
      return response(from: status)
    case .readbackTapHistory(let payload):
      guard !payload.projectID.isEmpty else {
        throw PraxisRuntimeInterfaceError.missingRequiredField("projectID")
      }
      let history = try await runtimeFacade.inspectionFacade.readbackTapHistory(
        .init(projectID: payload.projectID, agentID: payload.agentID, limit: payload.limit)
      )
      return response(from: history)
    case .openCmpSession(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let session = try await runtimeFacade.cmpSessionFacade.openSession(
        .init(projectID: projectID, sessionID: payload.sessionID)
      )
      return response(from: session)
    case .readbackCmpProject(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let readback = try await runtimeFacade.cmpProjectFacade.readbackProject(
        .init(projectID: projectID)
      )
      return response(from: readback)
    case .readbackCmpRoles(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let roles = try await runtimeFacade.cmpRolesFacade.readbackRoles(
        .init(projectID: projectID, agentID: payload.agentID)
      )
      return response(from: roles)
    case .readbackCmpControl(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let control = try await runtimeFacade.cmpControlFacade.readbackControl(
        .init(projectID: projectID, agentID: payload.agentID)
      )
      return response(from: control)
    case .updateCmpControl(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let update = try await runtimeFacade.cmpControlFacade.updateControl(
        .init(
          projectID: projectID,
          agentID: payload.agentID,
          executionStyle: payload.executionStyle,
          mode: payload.mode,
          readbackPriority: payload.readbackPriority,
          fallbackPolicy: payload.fallbackPolicy,
          recoveryPreference: payload.recoveryPreference,
          automation: payload.automation
        )
      )
      return response(from: update)
    case .requestCmpPeerApproval(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let targetAgentID = try requireRuntimeInterfaceField(payload.targetAgentID, named: "targetAgentID")
      let capabilityKey = try requireRuntimeInterfaceField(payload.capabilityKey, named: "capabilityKey")
      let summary = try requireRuntimeInterfaceText(payload.summary, named: "summary")
      let approval = try await runtimeFacade.cmpRolesFacade.requestPeerApproval(
        .init(
          projectID: projectID,
          agentID: agentID,
          targetAgentID: targetAgentID,
          capabilityKey: capabilityKey,
          requestedTier: payload.requestedTier,
          summary: summary
        )
      )
      return response(from: approval)
    case .decideCmpPeerApproval(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let targetAgentID = try requireRuntimeInterfaceField(payload.targetAgentID, named: "targetAgentID")
      let capabilityKey = try requireRuntimeInterfaceField(payload.capabilityKey, named: "capabilityKey")
      let decisionSummary = try requireRuntimeInterfaceText(payload.decisionSummary, named: "decisionSummary")
      let approval = try await runtimeFacade.cmpRolesFacade.decidePeerApproval(
        .init(
          projectID: projectID,
          agentID: agentID,
          targetAgentID: targetAgentID,
          capabilityKey: capabilityKey,
          decision: payload.decision,
          reviewerAgentID: payload.reviewerAgentID,
          decisionSummary: decisionSummary
        )
      )
      return response(from: approval, eventName: "cmp.peer_approval.decided")
    case .readbackCmpPeerApproval(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let readback = try await runtimeFacade.cmpReadbackFacade.readbackPeerApproval(
        .init(
          projectID: projectID,
          agentID: payload.agentID,
          targetAgentID: payload.targetAgentID,
          capabilityKey: payload.capabilityKey
        )
      )
      return response(from: readback)
    case .readbackCmpStatus(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let status = try await runtimeFacade.cmpReadbackFacade.readbackStatus(
        .init(projectID: projectID, agentID: payload.agentID)
      )
      return response(from: status)
    case .bootstrapCmpProject(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let bootstrap = try await runtimeFacade.cmpProjectFacade.bootstrapProject(
        .init(
          projectID: projectID,
          agentIDs: payload.agentIDs,
          defaultAgentID: payload.defaultAgentID,
          repoName: payload.repoName,
          repoRootPath: payload.repoRootPath,
          defaultBranchName: payload.defaultBranchName,
          databaseName: payload.databaseName,
          namespaceRoot: payload.namespaceRoot
        )
      )
      return response(from: bootstrap)
    case .recoverCmpProject(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let targetAgentID = try requireRuntimeInterfaceField(payload.targetAgentID, named: "targetAgentID")
      let reason = try requireRuntimeInterfaceText(payload.reason, named: "reason")
      let recovery = try await runtimeFacade.cmpProjectFacade.recoverProject(
        .init(
          projectID: projectID,
          agentID: agentID,
          targetAgentID: targetAgentID,
          reason: reason,
          lineageID: payload.lineageID,
          branchRef: payload.branchRef,
          snapshotID: payload.snapshotID,
          packageKind: payload.packageKind,
          fidelityLabel: payload.fidelityLabel
        )
      )
      return response(from: recovery)
    case .ingestCmpFlow(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let sessionID = try requireRuntimeInterfaceField(payload.sessionID, named: "sessionID")
      let taskSummary = try requireRuntimeInterfaceText(payload.taskSummary, named: "taskSummary")
      let materials = try requireRuntimeInterfaceElements(payload.materials, named: "materials")
      let ingest = try await runtimeFacade.cmpFlowFacade.ingestFlow(
        .init(
          projectID: projectID,
          agentID: agentID,
          sessionID: sessionID,
          runID: payload.runID,
          lineageID: payload.lineageID,
          parentAgentID: payload.parentAgentID,
          taskSummary: taskSummary,
          materials: materials,
          requiresActiveSync: payload.requiresActiveSync
        )
      )
      return response(from: ingest)
    case .commitCmpFlow(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let sessionID = try requireRuntimeInterfaceField(payload.sessionID, named: "sessionID")
      let eventIDs = try requireRuntimeInterfaceIdentifierElements(payload.eventIDs, named: "eventIDs")
      let changeSummary = try requireRuntimeInterfaceText(payload.changeSummary, named: "changeSummary")
      let commit = try await runtimeFacade.cmpFlowFacade.commitFlow(
        .init(
          projectID: projectID,
          agentID: agentID,
          sessionID: sessionID,
          runID: payload.runID,
          lineageID: payload.lineageID,
          parentAgentID: payload.parentAgentID,
          eventIDs: eventIDs,
          baseRef: payload.baseRef,
          changeSummary: changeSummary,
          syncIntent: payload.syncIntent
        )
      )
      return response(from: commit)
    case .resolveCmpFlow(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let resolve = try await runtimeFacade.cmpFlowFacade.resolveFlow(
        .init(
          projectID: projectID,
          agentID: agentID,
          lineageID: payload.lineageID,
          branchRef: payload.branchRef
        )
      )
      return response(from: resolve)
    case .materializeCmpFlow(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let targetAgentID = try requireRuntimeInterfaceField(payload.targetAgentID, named: "targetAgentID")
      let materialize = try await runtimeFacade.cmpFlowFacade.materializeFlow(
        .init(
          projectID: projectID,
          agentID: agentID,
          targetAgentID: targetAgentID,
          snapshotID: payload.snapshotID,
          projectionID: payload.projectionID,
          packageKind: payload.packageKind,
          fidelityLabel: payload.fidelityLabel
        )
      )
      return response(from: materialize)
    case .dispatchCmpFlow(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let reason = try requireRuntimeInterfaceText(payload.reason, named: "reason")
      let dispatch = try await runtimeFacade.cmpFlowFacade.dispatchFlow(
        .init(
          projectID: projectID,
          agentID: agentID,
          contextPackage: payload.contextPackage,
          targetKind: payload.targetKind,
          reason: reason
        )
      )
      return response(from: dispatch)
    case .retryCmpDispatch(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let packageID = try requireRuntimeInterfaceField(payload.packageID, named: "packageID")
      let dispatch = try await runtimeFacade.cmpFlowFacade.retryDispatch(
        .init(
          projectID: projectID,
          agentID: agentID,
          packageID: packageID,
          reason: payload.reason
        )
      )
      return response(
        from: dispatch,
        titlePrefix: "CMP Retry Dispatch",
        eventName: "cmp.flow.dispatch_retried"
      )
    case .requestCmpHistory(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let requesterAgentID = try requireRuntimeInterfaceField(payload.requesterAgentID, named: "requesterAgentID")
      let reason = try requireRuntimeInterfaceText(payload.reason, named: "reason")
      let history = try await runtimeFacade.cmpFlowFacade.requestHistory(
        .init(
          projectID: projectID,
          requesterAgentID: requesterAgentID,
          reason: reason,
          query: payload.query
        )
      )
      return response(from: history)
    case .smokeCmpProject(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let smoke = try await runtimeFacade.cmpProjectFacade.smokeProject(
        .init(projectID: projectID)
      )
      return response(from: smoke)
    case .inspectCmp:
      let inspection = try await runtimeFacade.inspectionFacade.inspectCmp()
      return .success(
        snapshot: .init(
          kind: .inspection,
          title: "CMP Inspection",
          summary: "\(inspection.projectID): \(inspection.hostRuntimeSummary)",
          projectID: inspection.projectID
        )
      )
    case .inspectMp:
      let inspection = try await runtimeFacade.mpFacade.inspect()
      return .success(
        snapshot: .init(
          kind: .inspection,
          title: "MP Inspection",
          summary: "\(inspection.summary) Store: \(inspection.memoryStoreSummary)"
        )
      )
    case .searchMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let query = try requireRuntimeInterfaceText(payload.query, named: "query")
      let search = try await runtimeFacade.mpFacade.search(
        .init(
          projectID: projectID,
          query: query,
          scopeLevels: payload.scopeLevels,
          limit: payload.limit,
          agentID: payload.agentID,
          sessionID: payload.sessionID,
          includeSuperseded: payload.includeSuperseded
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpSearch,
          title: "MP Search",
          summary: search.summary,
          projectID: search.projectID
        )
      )
    case .readbackMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let readback = try await runtimeFacade.mpFacade.readback(
        .init(
          projectID: projectID,
          query: payload.query,
          scopeLevels: payload.scopeLevels,
          limit: payload.limit,
          agentID: payload.agentID,
          sessionID: payload.sessionID,
          includeSuperseded: payload.includeSuperseded
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpReadback,
          title: "MP Readback",
          summary: readback.summary,
          projectID: readback.projectID
        )
      )
    case .smokeMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let smoke = try await runtimeFacade.mpFacade.smoke(
        .init(projectID: projectID)
      )
      return .success(
        snapshot: .init(
          kind: .mpSmoke,
          title: "MP Smoke",
          summary: smoke.summary,
          projectID: smoke.projectID
        )
      )
    case .ingestMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let agentID = try requireRuntimeInterfaceField(payload.agentID, named: "agentID")
      let summary = try requireRuntimeInterfaceText(payload.summary, named: "summary")
      let checkedSnapshotRef = try requireRuntimeInterfaceText(payload.checkedSnapshotRef, named: "checkedSnapshotRef")
      let branchRef = try requireRuntimeInterfaceText(payload.branchRef, named: "branchRef")
      let ingest = try await runtimeFacade.mpFacade.ingest(
        .init(
          projectID: projectID,
          agentID: agentID,
          sessionID: payload.sessionID,
          scopeLevel: payload.scopeLevel,
          summary: summary,
          checkedSnapshotRef: checkedSnapshotRef,
          branchRef: branchRef,
          storageKey: payload.storageKey,
          memoryKind: payload.memoryKind,
          observedAt: payload.observedAt,
          capturedAt: payload.capturedAt,
          semanticGroupID: payload.semanticGroupID,
          tags: payload.tags,
          sourceRefs: payload.sourceRefs,
          confidence: payload.confidence
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpIngest,
          title: "MP Ingest",
          summary: ingest.summary,
          projectID: ingest.projectID,
          sessionID: ingest.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
    case .alignMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let memoryID = try requireRuntimeInterfaceField(payload.memoryID, named: "memoryID")
      let align = try await runtimeFacade.mpFacade.align(
        .init(
          projectID: projectID,
          memoryID: memoryID,
          alignedAt: payload.alignedAt,
          queryText: payload.queryText
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpAlign,
          title: "MP Align",
          summary: align.summary,
          projectID: align.projectID
        )
      )
    case .promoteMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let memoryID = try requireRuntimeInterfaceField(payload.memoryID, named: "memoryID")
      let promote = try await runtimeFacade.mpFacade.promote(
        .init(
          projectID: projectID,
          memoryID: memoryID,
          targetPromotionState: payload.targetPromotionState,
          targetSessionID: payload.targetSessionID,
          promotedAt: payload.promotedAt,
          reason: payload.reason
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpPromote,
          title: "MP Promote",
          summary: promote.summary,
          projectID: promote.projectID,
          sessionID: promote.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
    case .archiveMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let memoryID = try requireRuntimeInterfaceField(payload.memoryID, named: "memoryID")
      let archive = try await runtimeFacade.mpFacade.archive(
        .init(
          projectID: projectID,
          memoryID: memoryID,
          archivedAt: payload.archivedAt,
          reason: payload.reason
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpArchive,
          title: "MP Archive",
          summary: archive.summary,
          projectID: archive.projectID,
          sessionID: archive.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
    case .resolveMp(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let requesterAgentID = try requireRuntimeInterfaceField(payload.requesterAgentID, named: "requesterAgentID")
      let query = try requireRuntimeInterfaceText(payload.query, named: "query")
      let resolve = try await runtimeFacade.mpFacade.resolve(
        .init(
          projectID: projectID,
          query: query,
          requesterAgentID: requesterAgentID,
          requesterSessionID: payload.sessionID,
          scopeLevels: payload.scopeLevels,
          limit: payload.limit
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpResolve,
          title: "MP Resolve",
          summary: resolve.summary,
          projectID: resolve.projectID,
          sessionID: payload.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
    case .requestMpHistory(let payload):
      let projectID = try requireRuntimeInterfaceField(payload.projectID, named: "projectID")
      let requesterAgentID = try requireRuntimeInterfaceField(payload.requesterAgentID, named: "requesterAgentID")
      let reason = try requireRuntimeInterfaceText(payload.reason, named: "reason")
      let query = try requireRuntimeInterfaceText(payload.query, named: "query")
      let history = try await runtimeFacade.mpFacade.requestHistory(
        .init(
          projectID: projectID,
          requesterAgentID: requesterAgentID,
          requesterSessionID: payload.sessionID,
          reason: reason,
          query: query,
          scopeLevels: payload.scopeLevels,
          limit: payload.limit
        )
      )
      return .success(
        snapshot: .init(
          kind: .mpHistory,
          title: "MP History",
          summary: history.summary,
          projectID: history.projectID,
          sessionID: payload.sessionID.map(PraxisSessionID.init(rawValue:))
        )
      )
    case .buildCapabilityCatalog:
      let inspection = try await runtimeFacade.inspectionFacade.buildCapabilityCatalogSnapshot()
      return .success(
        snapshot: .init(
          kind: .catalog,
          title: "Capability Catalog",
          summary: inspection.summary
        )
      )
    }
  }

  private func failureResponse(
    for error: Error,
    request: PraxisRuntimeInterfaceRequest
  ) -> PraxisRuntimeInterfaceResponse {
    let runID: PraxisRunID?
    if let rawRunID = request.runID, !rawRunID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      runID = PraxisRunID(rawValue: rawRunID)
    } else {
      runID = nil
    }

    let sessionID: PraxisSessionID?
    if let rawSessionID = request.sessionID, !rawSessionID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      sessionID = PraxisSessionID(rawValue: rawSessionID)
    } else if let runID {
      sessionID = PraxisSessionID(rawValue: PraxisRunIdentityCodec().sessionRawValue(from: runID))
    } else {
      sessionID = nil
    }

    let envelope: PraxisRuntimeInterfaceErrorEnvelope
    switch error {
    case let interfaceError as PraxisRuntimeInterfaceError:
      switch interfaceError {
      case .missingRequiredField(let field):
        envelope = .init(
          code: .missingRequiredField,
          message: "Required field \(field) is missing.",
          missingField: field,
          runID: runID,
          sessionID: sessionID
        )
      }
    case let praxisError as PraxisError:
      envelope = errorEnvelope(from: praxisError, runID: runID, sessionID: sessionID)
    case let transitionError as PraxisInvalidTransitionError:
      envelope = .init(
        code: .invalidTransition,
        message: transitionError.message,
        runID: runID,
        sessionID: sessionID
      )
    default:
      envelope = .init(
        code: .unknown,
        message: String(describing: error),
        retryable: true,
        runID: runID,
        sessionID: sessionID
      )
    }

    return .failure(error: envelope)
  }

  private func errorEnvelope(
    from error: PraxisError,
    runID: PraxisRunID?,
    sessionID: PraxisSessionID?
  ) -> PraxisRuntimeInterfaceErrorEnvelope {
    switch error {
    case .invalidInput(let message):
      let code: PraxisRuntimeInterfaceErrorCode =
        if message.hasPrefix("No checkpoint record found for run ") {
          .checkpointNotFound
        } else if message.hasPrefix("CMP peer approval request was not found for ") {
          .cmpPeerApprovalNotFound
        } else if message.hasPrefix("CMP peer approval gate is already resolved for ") {
          .cmpPeerApprovalAlreadyResolved
        } else if message.hasPrefix("CMP package was not found for ") {
          .cmpPackageNotFound
        } else if message.hasPrefix("CMP dispatch retry is not available for ") {
          .cmpDispatchNotRetryable
        } else {
          .invalidInput
        }
      return .init(
        code: code,
        message: message,
        runID: runID,
        sessionID: sessionID
      )
    case .invariantViolation(let message):
      return .init(
        code: .invariantViolation,
        message: message,
        runID: runID,
        sessionID: sessionID
      )
    case .dependencyMissing(let message):
      return .init(
        code: .dependencyMissing,
        message: message,
        runID: runID,
        sessionID: sessionID
      )
    case .unsupportedOperation(let message):
      return .init(
        code: .unsupportedOperation,
        message: message,
        runID: runID,
        sessionID: sessionID
      )
    }
  }
}

public enum PraxisRuntimeInterfaceError: Error, Sendable, Equatable {
  case missingRequiredField(String)
}
