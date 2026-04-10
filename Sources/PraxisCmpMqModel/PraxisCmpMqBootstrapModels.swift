public struct PraxisCmpMqNamespace: Sendable, Equatable, Codable {
  public let namespaceRoot: String
  public let keyPrefix: String
  public let queuePrefix: String
  public let streamPrefix: String

  public init(namespaceRoot: String, keyPrefix: String, queuePrefix: String, streamPrefix: String) {
    self.namespaceRoot = namespaceRoot
    self.keyPrefix = keyPrefix
    self.queuePrefix = queuePrefix
    self.streamPrefix = streamPrefix
  }
}

public struct PraxisCmpMqTopicBinding: Sendable, Equatable, Codable {
  public let topicName: String
  public let channel: String
  public let transportKey: String

  public init(topicName: String, channel: String, transportKey: String) {
    self.topicName = topicName
    self.channel = channel
    self.transportKey = transportKey
  }
}

public struct PraxisCmpMqBootstrapReceipt: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let namespace: PraxisCmpMqNamespace
  public let bindings: [PraxisCmpMqTopicBinding]

  public init(
    projectID: String,
    agentID: String,
    namespace: PraxisCmpMqNamespace,
    bindings: [PraxisCmpMqTopicBinding]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.namespace = namespace
    self.bindings = bindings
  }
}
