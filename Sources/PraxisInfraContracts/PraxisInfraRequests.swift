import PraxisCheckpoint
import PraxisCmpTypes
import PraxisJournal

public struct PraxisCheckpointRecord: Sendable, Equatable, Codable {
  public let pointer: PraxisCheckpointPointer
  public let snapshot: PraxisCheckpointSnapshot

  public init(pointer: PraxisCheckpointPointer, snapshot: PraxisCheckpointSnapshot) {
    self.pointer = pointer
    self.snapshot = snapshot
  }
}

public struct PraxisJournalRecordBatch: Sendable, Equatable, Codable {
  public let events: [PraxisJournalEvent]

  public init(events: [PraxisJournalEvent]) {
    self.events = events
  }
}

public struct PraxisProjectionRecordDescriptor: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let summary: String

  public init(projectionID: PraxisCmpProjectionID, summary: String) {
    self.projectionID = projectionID
    self.summary = summary
  }
}

public struct PraxisPublishedMessage: Sendable, Equatable, Codable {
  public let topic: String
  public let payloadSummary: String

  public init(topic: String, payloadSummary: String) {
    self.topic = topic
    self.payloadSummary = payloadSummary
  }
}

public enum PraxisDeliveryTruthStatus: String, Sendable, Codable {
  case pending
  case published
  case acknowledged
  case retryScheduled
  case expired
}

public struct PraxisDeliveryTruthRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let topic: String
  public let status: PraxisDeliveryTruthStatus
  public let payloadSummary: String
  public let updatedAt: String

  public init(
    id: String,
    topic: String,
    status: PraxisDeliveryTruthStatus,
    payloadSummary: String,
    updatedAt: String
  ) {
    self.id = id
    self.topic = topic
    self.status = status
    self.payloadSummary = payloadSummary
    self.updatedAt = updatedAt
  }
}

public struct PraxisEmbeddingRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let contentSummary: String
  public let vectorLength: Int
  public let storageKey: String

  public init(
    id: String,
    contentSummary: String,
    vectorLength: Int,
    storageKey: String
  ) {
    self.id = id
    self.contentSummary = contentSummary
    self.vectorLength = vectorLength
    self.storageKey = storageKey
  }
}

public struct PraxisSemanticSearchRequest: Sendable, Equatable, Codable {
  public let query: String
  public let limit: Int
  public let candidateStorageKeys: [String]?

  public init(
    query: String,
    limit: Int = 5,
    candidateStorageKeys: [String]? = nil
  ) {
    self.query = query
    self.limit = limit
    self.candidateStorageKeys = candidateStorageKeys
  }
}

public struct PraxisSemanticSearchMatch: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let score: Double
  public let contentSummary: String
  public let storageKey: String

  public init(
    id: String,
    score: Double,
    contentSummary: String,
    storageKey: String
  ) {
    self.id = id
    self.score = score
    self.contentSummary = contentSummary
    self.storageKey = storageKey
  }
}
