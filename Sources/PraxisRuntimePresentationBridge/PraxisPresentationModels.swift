public enum PraxisPresentationIntent: String, Sendable, Codable {
  case inspectArchitecture
  case runGoal
  case resumeRun
  case inspectTap
  case inspectCmp
  case inspectMp
}

public struct PraxisPresentationCommand: Sendable, Equatable, Codable {
  public let intent: PraxisPresentationIntent
  public let payloadSummary: String

  public init(intent: PraxisPresentationIntent, payloadSummary: String) {
    self.intent = intent
    self.payloadSummary = payloadSummary
  }
}

public struct PraxisPresentationState: Sendable, Equatable, Codable {
  public let title: String
  public let summary: String

  public init(title: String, summary: String) {
    self.title = title
    self.summary = summary
  }
}

public struct PraxisPresentationEvent: Sendable, Equatable, Codable {
  public let name: String
  public let detail: String

  public init(name: String, detail: String) {
    self.name = name
    self.detail = detail
  }
}
