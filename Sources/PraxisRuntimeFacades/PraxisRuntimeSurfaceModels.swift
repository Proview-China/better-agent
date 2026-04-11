import PraxisCmpTypes

public enum PraxisTruthLayerStatus: String, Sendable, Codable {
  case ready
  case degraded
  case failed
}

public struct PraxisLocalRuntimeHostProfile: Sendable, Equatable, Codable {
  public let executionStyle: PraxisCmpProjectExecutionStyle
  public let structuredStore: PraxisCmpProjectStructuredStoreProfile
  public let deliveryStore: PraxisCmpProjectDeliveryStoreProfile
  public let messageTransport: PraxisCmpProjectMessageTransportProfile
  public let gitAccess: PraxisCmpProjectGitAccessProfile
  public let semanticIndex: PraxisCmpProjectSemanticIndexProfile

  public init(
    executionStyle: PraxisCmpProjectExecutionStyle,
    structuredStore: PraxisCmpProjectStructuredStoreProfile,
    deliveryStore: PraxisCmpProjectDeliveryStoreProfile,
    messageTransport: PraxisCmpProjectMessageTransportProfile,
    gitAccess: PraxisCmpProjectGitAccessProfile,
    semanticIndex: PraxisCmpProjectSemanticIndexProfile
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
  public let componentStatuses: PraxisCmpProjectComponentStatusMap
  public let issues: [String]

  public init(
    projectID: String,
    hostProfile: PraxisLocalRuntimeHostProfile,
    componentStatuses: PraxisCmpProjectComponentStatusMap,
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
