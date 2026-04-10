public enum PraxisTruthLayerStatus: String, Sendable, Codable {
  case ready
  case degraded
  case failed
}

public struct PraxisLocalRuntimeHostProfile: Sendable, Equatable, Codable {
  public let executionStyle: String
  public let structuredStore: String
  public let deliveryStore: String
  public let messageTransport: String
  public let gitAccess: String
  public let semanticIndex: String

  public init(
    executionStyle: String,
    structuredStore: String,
    deliveryStore: String,
    messageTransport: String,
    gitAccess: String,
    semanticIndex: String
  ) {
    self.executionStyle = executionStyle
    self.structuredStore = structuredStore
    self.deliveryStore = deliveryStore
    self.messageTransport = messageTransport
    self.gitAccess = gitAccess
    self.semanticIndex = semanticIndex
  }
}

public struct PraxisCmpProjectLocalRuntimeSummary: Sendable, Equatable, Codable {
  public let projectID: String
  public let hostProfile: PraxisLocalRuntimeHostProfile
  public let componentStatuses: [String: PraxisTruthLayerStatus]
  public let issues: [String]

  public init(
    projectID: String,
    hostProfile: PraxisLocalRuntimeHostProfile,
    componentStatuses: [String: PraxisTruthLayerStatus],
    issues: [String]
  ) {
    self.projectID = projectID
    self.hostProfile = hostProfile
    self.componentStatuses = componentStatuses
    self.issues = issues
  }
}

public struct PraxisRuntimeSmokeCheck: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let gate: String
  public let status: PraxisTruthLayerStatus
  public let summary: String

  public init(id: String, gate: String, status: PraxisTruthLayerStatus, summary: String) {
    self.id = id
    self.gate = gate
    self.status = status
    self.summary = summary
  }
}

public struct PraxisRuntimeSmokeResult: Sendable, Equatable, Codable {
  public let summary: String
  public let checks: [PraxisRuntimeSmokeCheck]

  public init(summary: String, checks: [PraxisRuntimeSmokeCheck]) {
    self.summary = summary
    self.checks = checks
  }
}
