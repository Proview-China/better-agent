import PraxisCoreTypes

public typealias PraxisStateRecord = [String: PraxisValue]

public let PraxisForbiddenStateTopLevelKeys: Set<String> = [
  "history",
  "events",
  "journal",
]

public enum PraxisAgentStatus: String, Sendable, Codable, CaseIterable {
  case created
  case idle
  case deciding
  case acting
  case waiting
  case paused
  case completed
  case failed
  case cancelled
}

public enum PraxisAgentPhase: String, Sendable, Codable, CaseIterable {
  case decision
  case execution
  case commit
  case recovery
}

public struct PraxisAgentControlState: Sendable, Equatable, Codable {
  public let status: PraxisAgentStatus
  public let phase: PraxisAgentPhase
  public let retryCount: Int
  public let pendingIntentID: String?
  public let pendingCheckpointReason: String?

  public init(
    status: PraxisAgentStatus,
    phase: PraxisAgentPhase,
    retryCount: Int,
    pendingIntentID: String? = nil,
    pendingCheckpointReason: String? = nil
  ) {
    self.status = status
    self.phase = phase
    self.retryCount = retryCount
    self.pendingIntentID = pendingIntentID
    self.pendingCheckpointReason = pendingCheckpointReason
  }
}

public struct PraxisAgentObservedState: Sendable, Equatable, Codable {
  public let lastObservationRef: String?
  public let lastResultID: String?
  public let lastResultStatus: String?
  public let artifactRefs: [String]

  public init(
    lastObservationRef: String? = nil,
    lastResultID: String? = nil,
    lastResultStatus: String? = nil,
    artifactRefs: [String] = []
  ) {
    self.lastObservationRef = lastObservationRef
    self.lastResultID = lastResultID
    self.lastResultStatus = lastResultStatus
    self.artifactRefs = artifactRefs
  }
}

public struct PraxisAgentRecoveryState: Sendable, Equatable, Codable {
  public let lastCheckpointRef: String?
  public let resumePointer: String?
  public let lastErrorCode: String?
  public let lastErrorMessage: String?

  public init(
    lastCheckpointRef: String? = nil,
    resumePointer: String? = nil,
    lastErrorCode: String? = nil,
    lastErrorMessage: String? = nil
  ) {
    self.lastCheckpointRef = lastCheckpointRef
    self.resumePointer = resumePointer
    self.lastErrorCode = lastErrorCode
    self.lastErrorMessage = lastErrorMessage
  }
}

public struct PraxisAgentControlDelta: Sendable, Equatable, Codable {
  public let status: PraxisAgentStatus?
  public let phase: PraxisAgentPhase?
  public let retryCount: Int?
  public let pendingIntentID: String?
  public let pendingCheckpointReason: String?

  public init(
    status: PraxisAgentStatus? = nil,
    phase: PraxisAgentPhase? = nil,
    retryCount: Int? = nil,
    pendingIntentID: String? = nil,
    pendingCheckpointReason: String? = nil
  ) {
    self.status = status
    self.phase = phase
    self.retryCount = retryCount
    self.pendingIntentID = pendingIntentID
    self.pendingCheckpointReason = pendingCheckpointReason
  }
}

public struct PraxisAgentObservedDelta: Sendable, Equatable, Codable {
  public let lastObservationRef: String?
  public let lastResultID: String?
  public let lastResultStatus: String?
  public let artifactRefs: [String]?

  public init(
    lastObservationRef: String? = nil,
    lastResultID: String? = nil,
    lastResultStatus: String? = nil,
    artifactRefs: [String]? = nil
  ) {
    self.lastObservationRef = lastObservationRef
    self.lastResultID = lastResultID
    self.lastResultStatus = lastResultStatus
    self.artifactRefs = artifactRefs
  }
}

public struct PraxisAgentRecoveryDelta: Sendable, Equatable, Codable {
  public let lastCheckpointRef: String?
  public let resumePointer: String?
  public let lastErrorCode: String?
  public let lastErrorMessage: String?

  public init(
    lastCheckpointRef: String? = nil,
    resumePointer: String? = nil,
    lastErrorCode: String? = nil,
    lastErrorMessage: String? = nil
  ) {
    self.lastCheckpointRef = lastCheckpointRef
    self.resumePointer = resumePointer
    self.lastErrorCode = lastErrorCode
    self.lastErrorMessage = lastErrorMessage
  }
}

public struct PraxisStateSnapshot: Sendable, Equatable, Codable {
  public let control: PraxisAgentControlState
  public let working: PraxisStateRecord
  public let observed: PraxisAgentObservedState
  public let recovery: PraxisAgentRecoveryState
  public let derived: PraxisStateRecord?

  public init(
    control: PraxisAgentControlState,
    working: PraxisStateRecord,
    observed: PraxisAgentObservedState,
    recovery: PraxisAgentRecoveryState,
    derived: PraxisStateRecord? = nil
  ) {
    self.control = control
    self.working = working
    self.observed = observed
    self.recovery = recovery
    self.derived = derived
  }
}

public struct PraxisStateDelta: Sendable, Equatable, Codable {
  public let control: PraxisAgentControlDelta?
  public let working: PraxisStateRecord?
  public let clearWorkingKeys: [String]
  public let observed: PraxisAgentObservedDelta?
  public let recovery: PraxisAgentRecoveryDelta?
  public let derived: PraxisStateRecord?
  public let clearDerivedKeys: [String]

  public init(
    control: PraxisAgentControlDelta? = nil,
    working: PraxisStateRecord? = nil,
    clearWorkingKeys: [String] = [],
    observed: PraxisAgentObservedDelta? = nil,
    recovery: PraxisAgentRecoveryDelta? = nil,
    derived: PraxisStateRecord? = nil,
    clearDerivedKeys: [String] = []
  ) {
    self.control = control
    self.working = working
    self.clearWorkingKeys = clearWorkingKeys
    self.observed = observed
    self.recovery = recovery
    self.derived = derived
    self.clearDerivedKeys = clearDerivedKeys
  }
}

public enum PraxisStateInvariantViolation: Sendable, Equatable, Codable {
  case missingValue(String)
  case invalidValue(String)
}

public enum PraxisKernelEventType: String, Sendable, Equatable, Codable {
  case runCreated = "run.created"
  case runResumed = "run.resumed"
  case runPaused = "run.paused"
  case runCompleted = "run.completed"
  case runFailed = "run.failed"
  case stateDeltaApplied = "state.delta_applied"
  case intentQueued = "intent.queued"
  case intentDispatched = "intent.dispatched"
  case capabilityResultReceived = "capability.result_received"
  case checkpointCreated = "checkpoint.created"
}

public enum PraxisKernelEventPayload: Sendable, Equatable {
  case runCreated(goalID: String)
  case runResumed(checkpointID: String?)
  case runPaused(reason: String)
  case runCompleted(resultID: String?)
  case runFailed(code: String, message: String)
  case stateDeltaApplied(
    delta: PraxisStateDelta,
    previousStatus: PraxisAgentStatus?,
    nextStatus: PraxisAgentStatus?
  )
  case intentQueued(intentID: String, kind: String, priority: String)
  case intentDispatched(intentID: String, dispatchTarget: String)
  case capabilityResultReceived(requestID: String, resultID: String, status: String)
  case checkpointCreated(checkpointID: String, tier: String)
}

public extension PraxisKernelEventPayload {
  var type: PraxisKernelEventType {
    switch self {
    case .runCreated:
      .runCreated
    case .runResumed:
      .runResumed
    case .runPaused:
      .runPaused
    case .runCompleted:
      .runCompleted
    case .runFailed:
      .runFailed
    case .stateDeltaApplied:
      .stateDeltaApplied
    case .intentQueued:
      .intentQueued
    case .intentDispatched:
      .intentDispatched
    case .capabilityResultReceived:
      .capabilityResultReceived
    case .checkpointCreated:
      .checkpointCreated
    }
  }
}

public struct PraxisKernelEvent: Sendable, Equatable {
  public let eventID: String
  public let sessionID: String
  public let runID: String
  public let createdAt: String
  public let correlationID: String?
  public let causationID: String?
  public let payload: PraxisKernelEventPayload
  public let metadata: [String: PraxisValue]?

  public init(
    eventID: String,
    sessionID: String,
    runID: String,
    createdAt: String,
    correlationID: String? = nil,
    causationID: String? = nil,
    payload: PraxisKernelEventPayload,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.eventID = eventID
    self.sessionID = sessionID
    self.runID = runID
    self.createdAt = createdAt
    self.correlationID = correlationID
    self.causationID = causationID
    self.payload = payload
    self.metadata = metadata
  }
}

public extension PraxisKernelEvent {
  var type: PraxisKernelEventType {
    payload.type
  }
}
