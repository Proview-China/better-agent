import Foundation
import PraxisCheckpoint
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisJournal

public struct PraxisCheckpointRecord: Sendable, Equatable, Codable {
  public let pointer: PraxisCheckpointPointer
  public let snapshot: PraxisCheckpointSnapshot

  public init(pointer: PraxisCheckpointPointer, snapshot: PraxisCheckpointSnapshot) {
    self.pointer = pointer
    self.snapshot = snapshot
  }
}

public struct PraxisCheckpointSaveReceipt: Sendable, Equatable, Codable {
  public let pointer: PraxisCheckpointPointer
  public let tier: PraxisCheckpointTier
  public let storedAt: String?

  public init(pointer: PraxisCheckpointPointer, tier: PraxisCheckpointTier, storedAt: String? = nil) {
    self.pointer = pointer
    self.tier = tier
    self.storedAt = storedAt
  }
}

public struct PraxisJournalRecordBatch: Sendable, Equatable, Codable {
  public let events: [PraxisJournalEvent]

  public init(events: [PraxisJournalEvent]) {
    self.events = events
  }
}

public struct PraxisJournalAppendReceipt: Sendable, Equatable, Codable {
  public let appendedCount: Int
  public let lastCursor: PraxisJournalCursor?

  public init(appendedCount: Int, lastCursor: PraxisJournalCursor?) {
    self.appendedCount = appendedCount
    self.lastCursor = lastCursor
  }
}

public struct PraxisJournalSliceRequest: Sendable, Equatable, Codable {
  public let sessionID: String
  public let afterCursor: PraxisJournalCursor?
  public let limit: Int
  public let runReference: String?

  public init(
    sessionID: String,
    afterCursor: PraxisJournalCursor? = nil,
    limit: Int = 50,
    runReference: String? = nil
  ) {
    self.sessionID = sessionID
    self.afterCursor = afterCursor
    self.limit = limit
    self.runReference = runReference
  }
}

public struct PraxisProjectionRecordDescriptor: Sendable, Equatable, Codable {
  public let projectID: String
  public let projectionID: PraxisCmpProjectionID
  public let lineageID: PraxisCmpLineageID?
  public let agentID: String?
  public let visibilityLevel: PraxisCmpProjectionVisibilityLevel?
  public let storageKey: String?
  public let updatedAt: String?
  public let summary: String
  public let metadata: [String: PraxisValue]

  public init(
    projectID: String,
    projectionID: PraxisCmpProjectionID,
    lineageID: PraxisCmpLineageID? = nil,
    agentID: String? = nil,
    visibilityLevel: PraxisCmpProjectionVisibilityLevel? = nil,
    storageKey: String? = nil,
    updatedAt: String? = nil,
    summary: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.projectID = projectID
    self.projectionID = projectionID
    self.lineageID = lineageID
    self.agentID = agentID
    self.visibilityLevel = visibilityLevel
    self.storageKey = storageKey
    self.updatedAt = updatedAt
    self.summary = summary
    self.metadata = metadata
  }
}

public struct PraxisProjectionDescriptorQuery: Sendable, Equatable, Codable {
  public let projectID: String
  public let projectionID: PraxisCmpProjectionID?
  public let lineageID: PraxisCmpLineageID?
  public let agentID: String?

  public init(
    projectID: String,
    projectionID: PraxisCmpProjectionID? = nil,
    lineageID: PraxisCmpLineageID? = nil,
    agentID: String? = nil
  ) {
    self.projectID = projectID
    self.projectionID = projectionID
    self.lineageID = lineageID
    self.agentID = agentID
  }
}

public struct PraxisProjectionStoreWriteReceipt: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let storageKey: String?
  public let storedAt: String?

  public init(
    projectionID: PraxisCmpProjectionID,
    storageKey: String? = nil,
    storedAt: String? = nil
  ) {
    self.projectionID = projectionID
    self.storageKey = storageKey
    self.storedAt = storedAt
  }
}

public struct PraxisPublishedMessage: Sendable, Equatable, Codable {
  public let messageID: String
  public let topic: String
  public let payloadSummary: String
  public let projectID: String?
  public let publishedAt: String?
  public let metadata: [String: PraxisValue]

  public init(
    messageID: String = UUID().uuidString,
    topic: String,
    payloadSummary: String,
    projectID: String? = nil,
    publishedAt: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.messageID = messageID
    self.topic = topic
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.publishedAt = publishedAt
    self.metadata = metadata
  }
}

public struct PraxisMessagePublicationReceipt: Sendable, Equatable, Codable {
  public let messageID: String
  public let topic: String
  public let acceptedAt: String?

  public init(messageID: String, topic: String, acceptedAt: String? = nil) {
    self.messageID = messageID
    self.topic = topic
    self.acceptedAt = acceptedAt
  }
}

public struct PraxisMessageSubscription: Sendable, Equatable, Codable {
  public let topic: String
  public let consumerID: String
  public let startedAt: String?

  public init(topic: String, consumerID: String, startedAt: String? = nil) {
    self.topic = topic
    self.consumerID = consumerID
    self.startedAt = startedAt
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
  public let packageID: PraxisCmpPackageID?
  public let topic: String
  public let targetAgentID: String?
  public let status: PraxisDeliveryTruthStatus
  public let payloadSummary: String
  public let lastErrorSummary: String?
  public let updatedAt: String

  public init(
    id: String,
    packageID: PraxisCmpPackageID? = nil,
    topic: String,
    targetAgentID: String? = nil,
    status: PraxisDeliveryTruthStatus,
    payloadSummary: String,
    lastErrorSummary: String? = nil,
    updatedAt: String
  ) {
    self.id = id
    self.packageID = packageID
    self.topic = topic
    self.targetAgentID = targetAgentID
    self.status = status
    self.payloadSummary = payloadSummary
    self.lastErrorSummary = lastErrorSummary
    self.updatedAt = updatedAt
  }
}

public struct PraxisDeliveryTruthQuery: Sendable, Equatable, Codable {
  public let deliveryID: String?
  public let packageID: PraxisCmpPackageID?
  public let topic: String?
  public let targetAgentID: String?

  public init(
    deliveryID: String? = nil,
    packageID: PraxisCmpPackageID? = nil,
    topic: String? = nil,
    targetAgentID: String? = nil
  ) {
    self.deliveryID = deliveryID
    self.packageID = packageID
    self.topic = topic
    self.targetAgentID = targetAgentID
  }
}

public struct PraxisDeliveryTruthUpsertReceipt: Sendable, Equatable, Codable {
  public let deliveryID: String
  public let status: PraxisDeliveryTruthStatus
  public let updatedAt: String

  public init(deliveryID: String, status: PraxisDeliveryTruthStatus, updatedAt: String) {
    self.deliveryID = deliveryID
    self.status = status
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

public struct PraxisEmbeddingStoreWriteReceipt: Sendable, Equatable, Codable {
  public let embeddingID: String
  public let storageKey: String

  public init(embeddingID: String, storageKey: String) {
    self.embeddingID = embeddingID
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

public struct PraxisLineageDescriptor: Sendable, Equatable, Codable {
  public let lineageID: PraxisCmpLineageID
  public let branchRef: String
  public let parentLineageID: PraxisCmpLineageID?
  public let summary: String

  public init(
    lineageID: PraxisCmpLineageID,
    branchRef: String,
    parentLineageID: PraxisCmpLineageID? = nil,
    summary: String
  ) {
    self.lineageID = lineageID
    self.branchRef = branchRef
    self.parentLineageID = parentLineageID
    self.summary = summary
  }
}

public struct PraxisLineageLookupRequest: Sendable, Equatable, Codable {
  public let lineageID: PraxisCmpLineageID

  public init(lineageID: PraxisCmpLineageID) {
    self.lineageID = lineageID
  }
}
