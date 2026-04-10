import PraxisCoreTypes
import PraxisState

public enum PraxisTransitionPath: String, Sendable, Equatable, Codable {
  case hot
  case rare
}

public enum PraxisStepActionKind: String, Sendable, Equatable, Codable {
  case none
  case internalStep = "internal_step"
  case modelInference = "model_inference"
  case capabilityCall = "capability_call"
  case cmpAction = "cmp_action"
  case wait
  case pause
  case complete
  case fail
  case cancel
  case checkpoint
}

public enum PraxisTransitionIntentKind: String, Sendable, Equatable, Codable {
  case internalStep = "internal_step"
  case modelInference = "model_inference"
  case capabilityCall = "capability_call"
  case cmpAction = "cmp_action"
}

public enum PraxisTransitionPriority: String, Sendable, Equatable, Codable {
  case low
  case normal
  case high
  case critical
}

public struct PraxisTransitionIntent: Sendable, Equatable, Codable {
  public let intentID: String
  public let sessionID: String
  public let runID: String
  public let kind: PraxisTransitionIntentKind
  public let createdAt: String
  public let priority: PraxisTransitionPriority
  public let correlationID: String?
  public let instruction: String?
  public let capabilityKey: String?
  public let capabilityInput: PraxisStateRecord?
  public let cmpAction: String?
  public let cmpInput: PraxisStateRecord?

  public init(
    intentID: String,
    sessionID: String,
    runID: String,
    kind: PraxisTransitionIntentKind,
    createdAt: String,
    priority: PraxisTransitionPriority,
    correlationID: String? = nil,
    instruction: String? = nil,
    capabilityKey: String? = nil,
    capabilityInput: PraxisStateRecord? = nil,
    cmpAction: String? = nil,
    cmpInput: PraxisStateRecord? = nil
  ) {
    self.intentID = intentID
    self.sessionID = sessionID
    self.runID = runID
    self.kind = kind
    self.createdAt = createdAt
    self.priority = priority
    self.correlationID = correlationID
    self.instruction = instruction
    self.capabilityKey = capabilityKey
    self.capabilityInput = capabilityInput
    self.cmpAction = cmpAction
    self.cmpInput = cmpInput
  }
}

public struct PraxisNextActionDecision: Sendable, Equatable, Codable {
  public let kind: PraxisStepActionKind
  public let reason: String
  public let intent: PraxisTransitionIntent?
  public let metadata: [String: PraxisValue]

  public init(
    kind: PraxisStepActionKind,
    reason: String,
    intent: PraxisTransitionIntent? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.kind = kind
    self.reason = reason
    self.intent = intent
    self.metadata = metadata
  }
}

public struct PraxisTransitionDecision: Sendable, Equatable, Codable {
  public let fromStatus: PraxisAgentStatus
  public let toStatus: PraxisAgentStatus
  public let nextPhase: PraxisAgentPhase?
  public let reason: String
  public let stateDelta: PraxisStateDelta?
  public let nextAction: PraxisNextActionDecision?
  public let eventID: String?

  public init(
    fromStatus: PraxisAgentStatus,
    toStatus: PraxisAgentStatus,
    nextPhase: PraxisAgentPhase? = nil,
    reason: String,
    stateDelta: PraxisStateDelta? = nil,
    nextAction: PraxisNextActionDecision? = nil,
    eventID: String? = nil
  ) {
    self.fromStatus = fromStatus
    self.toStatus = toStatus
    self.nextPhase = nextPhase
    self.reason = reason
    self.stateDelta = stateDelta
    self.nextAction = nextAction
    self.eventID = eventID
  }
}

public struct PraxisTransitionRule: Sendable, Equatable, Codable {
  public let name: String
  public let path: PraxisTransitionPath
  public let eventType: PraxisKernelEventType
  public let fromStatuses: [PraxisAgentStatus]
  public let toStatus: PraxisAgentStatus
  public let nextPhase: PraxisAgentPhase?
  public let summary: String

  public init(
    name: String,
    path: PraxisTransitionPath,
    eventType: PraxisKernelEventType,
    fromStatuses: [PraxisAgentStatus],
    toStatus: PraxisAgentStatus,
    nextPhase: PraxisAgentPhase?,
    summary: String
  ) {
    self.name = name
    self.path = path
    self.eventType = eventType
    self.fromStatuses = fromStatuses
    self.toStatus = toStatus
    self.nextPhase = nextPhase
    self.summary = summary
  }
}

public struct PraxisTransitionTable: Sendable, Equatable, Codable {
  public let rules: [PraxisTransitionRule]

  public init(rules: [PraxisTransitionRule]) {
    self.rules = rules
  }
}

public struct PraxisInvalidTransitionError: Error, Sendable, Equatable {
  public let fromStatus: PraxisAgentStatus
  public let eventType: PraxisKernelEventType
  public let message: String

  public init(
    fromStatus: PraxisAgentStatus,
    eventType: PraxisKernelEventType,
    message: String
  ) {
    self.fromStatus = fromStatus
    self.eventType = eventType
    self.message = message
  }
}
