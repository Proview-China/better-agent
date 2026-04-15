import PraxisTapTypes
import PraxisTapProvision

public enum PraxisActivationAttemptStatus: String, Sendable, Codable {
  case pending
  case running
  case failed
  case completed
}

public struct PraxisActivationAttemptRecord: Sendable, Equatable, Codable {
  public let attemptID: String
  public let capabilityKey: String
  public let status: PraxisActivationAttemptStatus
  public let createdAt: String

  public init(
    attemptID: String,
    capabilityKey: String,
    status: PraxisActivationAttemptStatus,
    createdAt: String
  ) {
    self.attemptID = attemptID
    self.capabilityKey = capabilityKey
    self.status = status
    self.createdAt = createdAt
  }
}

public struct PraxisActivationFailure: Sendable, Equatable, Codable {
  public let code: String
  public let message: String

  public init(code: String, message: String) {
    self.code = code
    self.message = message
  }
}

public struct PraxisActivationReceipt: Sendable, Equatable, Codable {
  public let capabilityKey: String
  public let bindingKey: String
  public let activatedAt: String

  public init(capabilityKey: String, bindingKey: String, activatedAt: String) {
    self.capabilityKey = capabilityKey
    self.bindingKey = bindingKey
    self.activatedAt = activatedAt
  }
}

public struct PraxisHumanGateEvent: Sendable, Equatable, Codable {
  public let eventID: String
  public let state: PraxisHumanGateState
  public let summary: String
  public let createdAt: String

  public init(eventID: String, state: PraxisHumanGateState, summary: String, createdAt: String) {
    self.eventID = eventID
    self.state = state
    self.summary = summary
    self.createdAt = createdAt
  }
}

public enum PraxisReplayStatus: String, Sendable, Codable {
  case pending
  case ready
  case consumed
  case skipped
}

public enum PraxisReplayNextAction: String, Sendable, Codable {
  case none
  case manual
  case verifyThenAuto = "verify_then_auto"
  case reReviewThenDispatch = "re_review_then_dispatch"
}

public struct PraxisPendingReplay: Sendable, Equatable, Codable {
  public let replayID: String
  public let capabilityKey: String
  public let policy: PraxisProvisionReplayPolicy
  public let status: PraxisReplayStatus
  public let nextAction: PraxisReplayNextAction
  public let summary: String
  public let recommendedAction: String

  public init(
    replayID: String,
    capabilityKey: String = "",
    policy: PraxisProvisionReplayPolicy = .reReviewThenDispatch,
    status: PraxisReplayStatus = .pending,
    nextAction: PraxisReplayNextAction = .reReviewThenDispatch,
    summary: String,
    recommendedAction: String
  ) {
    self.replayID = replayID
    self.capabilityKey = capabilityKey
    self.policy = policy
    self.status = status
    self.nextAction = nextAction
    self.summary = summary
    self.recommendedAction = recommendedAction
  }
}
