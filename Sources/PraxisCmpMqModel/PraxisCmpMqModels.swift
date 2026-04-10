import PraxisCmpDelivery
import PraxisCmpTypes

public enum PraxisCmpMqChannelKind: String, Sendable, Codable {
  case local
  case toParent
  case peer
  case toChildren
  case promotion
  case criticalEscalation
}

public enum PraxisCmpMqLaneKind: String, Sendable, Codable {
  case actorBus
  case stream
  case queue
}

public enum PraxisCmpMqDeliveryTruthStatus: String, Sendable, Codable {
  case published
  case acknowledged
  case retryScheduled
  case expired
}

public struct PraxisTopicTopology: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let channel: PraxisCmpMqChannelKind
  public let topicName: String
  public let neighborhoods: [PraxisCmpNeighborhoodRelation]

  public init(
    projectID: String,
    agentID: String,
    channel: PraxisCmpMqChannelKind,
    topicName: String,
    neighborhoods: [PraxisCmpNeighborhoodRelation]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.channel = channel
    self.topicName = topicName
    self.neighborhoods = neighborhoods
  }
}

public struct PraxisRoutingPlan: Sendable, Equatable, Codable {
  public let deliveryPlan: PraxisDeliveryPlan
  public let destinationTopics: [PraxisTopicTopology]

  public init(deliveryPlan: PraxisDeliveryPlan, destinationTopics: [PraxisTopicTopology]) {
    self.deliveryPlan = deliveryPlan
    self.destinationTopics = destinationTopics
  }
}

public struct PraxisNeighborhoodGraph: Sendable, Equatable, Codable {
  public let nodes: [String]
  public let edges: [String: [String]]

  public init(nodes: [String], edges: [String: [String]]) {
    self.nodes = nodes
    self.edges = edges
  }
}

public struct PraxisEscalationPlan: Sendable, Equatable, Codable {
  public let targetAncestorID: String
  public let severity: PraxisCmpEscalationSeverity
  public let summary: String

  public init(targetAncestorID: String, severity: PraxisCmpEscalationSeverity, summary: String) {
    self.targetAncestorID = targetAncestorID
    self.severity = severity
    self.summary = summary
  }
}

public struct PraxisCmpMqDeliveryStateRecord: Sendable, Equatable, Codable {
  public let deliveryID: String
  public let dispatchID: PraxisCmpDispatchReceiptID
  public let packageID: PraxisCmpPackageID
  public let sourceAgentID: String
  public let targetAgentID: String
  public let status: PraxisCmpMqDeliveryTruthStatus
  public let currentAttempt: Int
  public let maxAttempts: Int
  public let publishedAt: String
  public let ackDeadlineAt: String
  public let acknowledgedAt: String?

  public init(
    deliveryID: String,
    dispatchID: PraxisCmpDispatchReceiptID,
    packageID: PraxisCmpPackageID,
    sourceAgentID: String,
    targetAgentID: String,
    status: PraxisCmpMqDeliveryTruthStatus,
    currentAttempt: Int,
    maxAttempts: Int,
    publishedAt: String,
    ackDeadlineAt: String,
    acknowledgedAt: String? = nil
  ) {
    self.deliveryID = deliveryID
    self.dispatchID = dispatchID
    self.packageID = packageID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.status = status
    self.currentAttempt = currentAttempt
    self.maxAttempts = maxAttempts
    self.publishedAt = publishedAt
    self.ackDeadlineAt = ackDeadlineAt
    self.acknowledgedAt = acknowledgedAt
  }
}
