public enum PraxisPresentationIntent: String, Sendable, Codable {
  case inspectArchitecture
  case runGoal
  case resumeRun
  case inspectTap
  case inspectCmp
  case inspectMp
  case buildCapabilityCatalog
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
  public let pendingIntentID: String?
  public let events: [PraxisPresentationEvent]

  public init(
    title: String,
    summary: String,
    pendingIntentID: String? = nil,
    events: [PraxisPresentationEvent] = []
  ) {
    self.title = title
    self.summary = summary
    self.pendingIntentID = pendingIntentID
    self.events = events
  }
}

public struct PraxisPresentationEvent: Sendable, Equatable, Codable {
  public let name: String
  public let detail: String
  public let runID: String?
  public let sessionID: String?
  public let intentID: String?

  public init(
    name: String,
    detail: String,
    runID: String? = nil,
    sessionID: String? = nil,
    intentID: String? = nil
  ) {
    self.name = name
    self.detail = detail
    self.runID = runID
    self.sessionID = sessionID
    self.intentID = intentID
  }
}
