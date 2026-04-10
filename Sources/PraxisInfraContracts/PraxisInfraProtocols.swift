import PraxisCmpTypes

public protocol PraxisCheckpointStoreContract: Sendable {
  func save(_ record: PraxisCheckpointRecord) async throws
}

public protocol PraxisJournalStoreContract: Sendable {
  func append(_ batch: PraxisJournalRecordBatch) async throws
}

public protocol PraxisProjectionStoreContract: Sendable {
  func describe(projectId: String) async throws -> PraxisProjectionRecordDescriptor
}

public protocol PraxisMessageBusContract: Sendable {
  func publish(_ message: PraxisPublishedMessage) async throws
}

public protocol PraxisDeliveryTruthStoreContract: Sendable {
  func save(_ record: PraxisDeliveryTruthRecord) async throws
  func lookup(deliveryID: String) async throws -> PraxisDeliveryTruthRecord?
}

public protocol PraxisEmbeddingStoreContract: Sendable {
  func save(_ record: PraxisEmbeddingRecord) async throws
  func load(embeddingID: String) async throws -> PraxisEmbeddingRecord?
}

public protocol PraxisSemanticSearchIndexContract: Sendable {
  func search(_ request: PraxisSemanticSearchRequest) async throws -> [PraxisSemanticSearchMatch]
}

public protocol PraxisLineageStoreContract: Sendable {
  func describe(lineageID: PraxisCmpLineageID) async throws -> String
}
