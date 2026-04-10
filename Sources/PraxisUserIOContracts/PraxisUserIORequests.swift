import PraxisCoreTypes

public enum PraxisPromptKind: String, Sendable, Codable {
  case freeform
  case confirmation
  case choice
}

public struct PraxisPromptChoice: Sendable, Equatable, Codable {
  public let id: String
  public let label: String
  public let description: String?

  public init(id: String, label: String, description: String? = nil) {
    self.id = id
    self.label = label
    self.description = description
  }
}

public struct PraxisPromptRequest: Sendable, Equatable, Codable {
  public let summary: String
  public let detail: String?
  public let kind: PraxisPromptKind
  public let defaultValue: String?
  public let choices: [PraxisPromptChoice]
  public let metadata: [String: PraxisValue]

  public init(
    summary: String,
    detail: String? = nil,
    kind: PraxisPromptKind = .freeform,
    defaultValue: String? = nil,
    choices: [PraxisPromptChoice] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.summary = summary
    self.detail = detail
    self.kind = kind
    self.defaultValue = defaultValue
    self.choices = choices
    self.metadata = metadata
  }
}

public struct PraxisPromptResponse: Sendable, Equatable, Codable {
  public let content: String
  public let selectedChoiceID: String?
  public let acceptedDefault: Bool

  public init(content: String, selectedChoiceID: String? = nil, acceptedDefault: Bool = false) {
    self.content = content
    self.selectedChoiceID = selectedChoiceID
    self.acceptedDefault = acceptedDefault
  }
}

public enum PraxisPermissionUrgency: String, Sendable, Codable {
  case low
  case medium
  case high
}

public struct PraxisPermissionRequest: Sendable, Equatable, Codable {
  public let scope: String
  public let summary: String?
  public let urgency: PraxisPermissionUrgency
  public let metadata: [String: PraxisValue]

  public init(
    scope: String,
    summary: String? = nil,
    urgency: PraxisPermissionUrgency = .medium,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.scope = scope
    self.summary = summary
    self.urgency = urgency
    self.metadata = metadata
  }
}

public struct PraxisPermissionDecision: Sendable, Equatable, Codable {
  public let granted: Bool
  public let reason: String?

  public init(granted: Bool, reason: String? = nil) {
    self.granted = granted
    self.reason = reason
  }
}

public enum PraxisTerminalEventKind: String, Sendable, Codable {
  case info
  case progress
  case warning
  case error
}

public struct PraxisTerminalEvent: Sendable, Equatable, Codable {
  public let title: String
  public let detail: String
  public let kind: PraxisTerminalEventKind
  public let command: String?
  public let metadata: [String: PraxisValue]

  public init(
    title: String,
    detail: String,
    kind: PraxisTerminalEventKind = .info,
    command: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.title = title
    self.detail = detail
    self.kind = kind
    self.command = command
    self.metadata = metadata
  }
}

public enum PraxisConversationPresentationKind: String, Sendable, Codable {
  case summary
  case status
  case question
  case result
}

public struct PraxisConversationPresentation: Sendable, Equatable, Codable {
  public let summary: String
  public let detail: String?
  public let kind: PraxisConversationPresentationKind
  public let chips: [PraxisMultimodalChip]
  public let metadata: [String: PraxisValue]

  public init(
    summary: String,
    detail: String? = nil,
    kind: PraxisConversationPresentationKind = .summary,
    chips: [PraxisMultimodalChip] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.summary = summary
    self.detail = detail
    self.kind = kind
    self.chips = chips
    self.metadata = metadata
  }
}
