import PraxisTapTypes
import PraxisCoreTypes
import PraxisCmpTypes

public enum PraxisCmpRoleLiveMode: String, Sendable, Codable {
  case rulesOnly
  case llmAssisted
  case llmRequired
}

public enum PraxisCmpRoleLiveStatus: String, Sendable, Codable {
  case rulesOnly
  case succeeded
  case fallback
  case failed
}

public struct PraxisCmpRoleLiveRequest: Sendable, Equatable, Codable {
  public let requestID: String
  public let role: PraxisFiveAgentRole
  public let stage: String
  public let mode: PraxisCmpRoleLiveMode
  public let promptSummary: String
  public let outputContract: [String]
  public let metadata: [String: PraxisValue]

  public init(
    requestID: String,
    role: PraxisFiveAgentRole,
    stage: String,
    mode: PraxisCmpRoleLiveMode,
    promptSummary: String,
    outputContract: [String] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.requestID = requestID
    self.role = role
    self.stage = stage
    self.mode = mode
    self.promptSummary = promptSummary
    self.outputContract = outputContract
    self.metadata = metadata
  }
}

public struct PraxisCmpRoleLiveTrace: Sendable, Equatable, Codable {
  public let attemptID: String
  public let role: PraxisFiveAgentRole
  public let mode: PraxisCmpRoleLiveMode
  public let status: PraxisCmpRoleLiveStatus
  public let provider: String?
  public let model: String?
  public let createdAt: String
  public let completedAt: String?
  public let requestID: String?
  public let fallbackApplied: Bool
  public let errorMessage: String?
  public let metadata: [String: PraxisValue]

  public init(
    attemptID: String,
    role: PraxisFiveAgentRole,
    mode: PraxisCmpRoleLiveMode,
    status: PraxisCmpRoleLiveStatus,
    provider: String? = nil,
    model: String? = nil,
    createdAt: String,
    completedAt: String? = nil,
    requestID: String? = nil,
    fallbackApplied: Bool = false,
    errorMessage: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.attemptID = attemptID
    self.role = role
    self.mode = mode
    self.status = status
    self.provider = provider
    self.model = model
    self.createdAt = createdAt
    self.completedAt = completedAt
    self.requestID = requestID
    self.fallbackApplied = fallbackApplied
    self.errorMessage = errorMessage
    self.metadata = metadata
  }
}

public struct PraxisCmpFiveAgentTapBridgePayload: Sendable, Equatable, Codable {
  public let role: PraxisFiveAgentRole
  public let capabilityKey: String
  public let reason: String
  public let packageID: PraxisCmpPackageID?
  public let sourceSnapshotID: PraxisCmpSnapshotID?
  public let humanGateState: PraxisHumanGateState?

  public init(
    role: PraxisFiveAgentRole,
    capabilityKey: String,
    reason: String,
    packageID: PraxisCmpPackageID? = nil,
    sourceSnapshotID: PraxisCmpSnapshotID? = nil,
    humanGateState: PraxisHumanGateState? = nil
  ) {
    self.role = role
    self.capabilityKey = capabilityKey
    self.reason = reason
    self.packageID = packageID
    self.sourceSnapshotID = sourceSnapshotID
    self.humanGateState = humanGateState
  }
}
