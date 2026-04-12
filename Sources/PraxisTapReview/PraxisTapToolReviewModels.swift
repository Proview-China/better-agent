import PraxisCapabilityContracts
import PraxisCapabilityResults
import PraxisTapTypes

public enum PraxisToolReviewGovernanceKind: String, Sendable, Codable {
  case provisionRequest
  case activation
  case delivery
  case lifecycle
  case humanGate
  case replay
}

public enum PraxisToolReviewActionStatus: String, Sendable, Codable {
  case recorded
  case readyForHandoff
  case waitingHuman
  case blocked
  case completed
}

public enum PraxisToolReviewSessionStatus: String, Sendable, Codable {
  case open
  case waitingHuman
  case blocked
  case completed
}

public enum PraxisToolReviewGovernanceSignalKind: String, Sendable, Codable {
  case governanceSnapshot = "governance_snapshot"
}

public struct PraxisToolReviewTrace: Sendable, Equatable, Codable {
  public let actionID: String
  public let actorID: String
  public let reason: String
  public let createdAt: String

  public init(actionID: String, actorID: String, reason: String, createdAt: String) {
    self.actionID = actionID
    self.actorID = actorID
    self.reason = reason
    self.createdAt = createdAt
  }
}

public struct PraxisToolReviewActionLedgerEntry: Sendable, Equatable, Codable {
  public let reviewID: String
  public let sessionID: String
  public let governanceKind: PraxisToolReviewGovernanceKind
  public let capabilityID: PraxisCapabilityID?
  public let status: PraxisToolReviewActionStatus
  public let summary: String
  public let recordedAt: String

  public init(
    reviewID: String,
    sessionID: String,
    governanceKind: PraxisToolReviewGovernanceKind,
    capabilityID: PraxisCapabilityID? = nil,
    status: PraxisToolReviewActionStatus,
    summary: String,
    recordedAt: String
  ) {
    self.reviewID = reviewID
    self.sessionID = sessionID
    self.governanceKind = governanceKind
    self.capabilityID = capabilityID
    self.status = status
    self.summary = summary
    self.recordedAt = recordedAt
  }
}

public struct PraxisToolReviewSessionSnapshot: Sendable, Equatable, Codable {
  public let sessionID: String
  public let status: PraxisToolReviewSessionStatus
  public let actions: [PraxisToolReviewActionLedgerEntry]

  public init(
    sessionID: String,
    status: PraxisToolReviewSessionStatus,
    actions: [PraxisToolReviewActionLedgerEntry]
  ) {
    self.sessionID = sessionID
    self.status = status
    self.actions = actions
  }
}

public struct PraxisToolReviewGovernanceSignal: Sendable, Equatable, Codable {
  public let kind: PraxisToolReviewGovernanceSignalKind
  public let active: Bool
  public let summary: String

  public init(kind: PraxisToolReviewGovernanceSignalKind, active: Bool, summary: String) {
    self.kind = kind
    self.active = active
    self.summary = summary
  }
}

public struct PraxisToolReviewAdvisory: Sendable, Equatable, Codable {
  public let code: String
  public let severity: PraxisTapRiskLevel
  public let summary: String

  public init(code: String, severity: PraxisTapRiskLevel, summary: String) {
    self.code = code
    self.severity = severity
    self.summary = summary
  }
}

public struct PraxisToolReviewReport: Sendable, Equatable, Codable {
  public let session: PraxisToolReviewSessionSnapshot
  public let latestDecision: PraxisReviewDecision?
  public let latestResult: PraxisCapabilityResultEnvelope?
  public let signals: [PraxisToolReviewGovernanceSignal]
  public let advisories: [PraxisToolReviewAdvisory]

  public init(
    session: PraxisToolReviewSessionSnapshot,
    latestDecision: PraxisReviewDecision? = nil,
    latestResult: PraxisCapabilityResultEnvelope? = nil,
    signals: [PraxisToolReviewGovernanceSignal],
    advisories: [PraxisToolReviewAdvisory]
  ) {
    self.session = session
    self.latestDecision = latestDecision
    self.latestResult = latestResult
    self.signals = signals
    self.advisories = advisories
  }
}
