import PraxisCheckpoint
import PraxisCmpTypes
import PraxisJournal

/// In-memory fake checkpoint store for HostContracts and HostRuntime tests.
public actor PraxisFakeCheckpointStore: PraxisCheckpointStoreContract {
  private var records: [PraxisCheckpointRecord]

  public init(seedRecords: [PraxisCheckpointRecord] = []) {
    self.records = seedRecords
  }

  public func save(_ record: PraxisCheckpointRecord) async throws -> PraxisCheckpointSaveReceipt {
    records.removeAll { $0.pointer == record.pointer }
    records.append(record)
    return PraxisCheckpointSaveReceipt(pointer: record.pointer, tier: record.snapshot.tier, storedAt: record.snapshot.createdAt)
  }

  public func load(pointer: PraxisCheckpointPointer) async throws -> PraxisCheckpointRecord? {
    records.last { $0.pointer == pointer }
  }

  public func allRecords() async -> [PraxisCheckpointRecord] {
    records
  }
}

/// In-memory fake journal store that supports deterministic cursor slicing.
public actor PraxisFakeJournalStore: PraxisJournalStoreContract {
  private var events: [PraxisJournalEvent]

  public init(seedEvents: [PraxisJournalEvent] = []) {
    self.events = seedEvents
  }

  public func append(_ batch: PraxisJournalRecordBatch) async throws -> PraxisJournalAppendReceipt {
    events.append(contentsOf: batch.events)
    return PraxisJournalAppendReceipt(
      appendedCount: batch.events.count,
      lastCursor: batch.events.last.map { PraxisJournalCursor(sequence: $0.sequence) }
    )
  }

  public func read(_ request: PraxisJournalSliceRequest) async throws -> PraxisJournalSlice {
    let filtered = events.filter { event in
      guard event.sessionID.rawValue == request.sessionID else {
        return false
      }
      if let runReference = request.runReference, event.runReference != runReference {
        return false
      }
      if let afterCursor = request.afterCursor, event.sequence <= afterCursor.sequence {
        return false
      }
      return true
    }
    let sliceEvents = Array(filtered.prefix(request.limit))
    let nextCursor = sliceEvents.last.map { PraxisJournalCursor(sequence: $0.sequence) }
    return PraxisJournalSlice(events: sliceEvents, nextCursor: nextCursor)
  }

  public func allEvents() async -> [PraxisJournalEvent] {
    events
  }
}

/// In-memory fake projection descriptor store.
public actor PraxisFakeProjectionStore: PraxisProjectionStoreContract {
  private var descriptors: [PraxisProjectionRecordDescriptor]

  public init(seedDescriptors: [PraxisProjectionRecordDescriptor] = []) {
    self.descriptors = seedDescriptors
  }

  public func save(_ descriptor: PraxisProjectionRecordDescriptor) async throws -> PraxisProjectionStoreWriteReceipt {
    descriptors.removeAll { $0.projectID == descriptor.projectID && $0.projectionID == descriptor.projectionID }
    descriptors.append(descriptor)
    return PraxisProjectionStoreWriteReceipt(
      projectionID: descriptor.projectionID,
      storageKey: descriptor.storageKey,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(projectId: String) async throws -> PraxisProjectionRecordDescriptor {
    guard let descriptor = descriptors.last(where: { $0.projectID == projectId }) else {
      throw PraxisCmpValidationError.invalid("Projection descriptor for project \(projectId) is missing.")
    }
    return descriptor
  }

  public func describe(_ query: PraxisProjectionDescriptorQuery) async throws -> [PraxisProjectionRecordDescriptor] {
    descriptors
      .filter { descriptor in
        guard descriptor.projectID == query.projectID else {
          return false
        }
        if let projectionID = query.projectionID, descriptor.projectionID != projectionID {
          return false
        }
        if let lineageID = query.lineageID, descriptor.lineageID != lineageID {
          return false
        }
        if let agentID = query.agentID, descriptor.agentID != agentID {
          return false
        }
        return true
      }
      .sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }
  }
}

/// Spy bus that records every published message for assertions.
public actor PraxisSpyMessageBus: PraxisMessageBusContract {
  private var publishedMessages: [PraxisPublishedMessage] = []
  private var subscriptions: [PraxisMessageSubscription] = []

  public init() {}

  public func publish(_ message: PraxisPublishedMessage) async throws -> PraxisMessagePublicationReceipt {
    publishedMessages.append(message)
    return PraxisMessagePublicationReceipt(messageID: message.messageID, topic: message.topic, acceptedAt: message.publishedAt)
  }

  public func subscribe(topic: String, consumerID: String) async throws -> PraxisMessageSubscription {
    let subscription = PraxisMessageSubscription(topic: topic, consumerID: consumerID)
    subscriptions.append(subscription)
    return subscription
  }

  public func allPublishedMessages() async -> [PraxisPublishedMessage] {
    publishedMessages
  }

  public func allSubscriptions() async -> [PraxisMessageSubscription] {
    subscriptions
  }
}

/// In-memory fake store for delivery truth records.
public actor PraxisFakeDeliveryTruthStore: PraxisDeliveryTruthStoreContract {
  private var records: [PraxisDeliveryTruthRecord]

  public init(seedRecords: [PraxisDeliveryTruthRecord] = []) {
    self.records = seedRecords
  }

  public func save(_ record: PraxisDeliveryTruthRecord) async throws -> PraxisDeliveryTruthUpsertReceipt {
    records.removeAll { $0.id == record.id }
    records.append(record)
    return PraxisDeliveryTruthUpsertReceipt(deliveryID: record.id, status: record.status, updatedAt: record.updatedAt)
  }

  public func lookup(deliveryID: String) async throws -> PraxisDeliveryTruthRecord? {
    records.last { $0.id == deliveryID }
  }

  public func lookup(_ query: PraxisDeliveryTruthQuery) async throws -> [PraxisDeliveryTruthRecord] {
    records.filter { record in
      if let deliveryID = query.deliveryID, record.id != deliveryID {
        return false
      }
      if let packageID = query.packageID, record.packageID != packageID {
        return false
      }
      if let topic = query.topic, record.topic != topic {
        return false
      }
      if let targetAgentID = query.targetAgentID, record.targetAgentID != targetAgentID {
        return false
      }
      return true
    }
  }
}

/// In-memory fake embedding store.
public actor PraxisFakeEmbeddingStore: PraxisEmbeddingStoreContract {
  private var records: [PraxisEmbeddingRecord]

  public init(seedRecords: [PraxisEmbeddingRecord] = []) {
    self.records = seedRecords
  }

  public func save(_ record: PraxisEmbeddingRecord) async throws -> PraxisEmbeddingStoreWriteReceipt {
    records.removeAll { $0.id == record.id }
    records.append(record)
    return PraxisEmbeddingStoreWriteReceipt(embeddingID: record.id, storageKey: record.storageKey)
  }

  public func load(embeddingID: String) async throws -> PraxisEmbeddingRecord? {
    records.last { $0.id == embeddingID }
  }
}

/// Stub semantic search index that returns deterministic canned results.
public struct PraxisStubSemanticSearchIndex: PraxisSemanticSearchIndexContract, Sendable {
  public let cannedResults: [String: [PraxisSemanticSearchMatch]]

  public init(cannedResults: [String: [PraxisSemanticSearchMatch]] = [:]) {
    self.cannedResults = cannedResults
  }

  public func search(_ request: PraxisSemanticSearchRequest) async throws -> [PraxisSemanticSearchMatch] {
    Array((cannedResults[request.query] ?? []).prefix(request.limit))
  }
}

/// In-memory fake semantic memory store with simple scope-aware search.
public actor PraxisFakeSemanticMemoryStore: PraxisSemanticMemoryStoreContract {
  private var records: [PraxisSemanticMemoryRecord]

  public init(seedRecords: [PraxisSemanticMemoryRecord] = []) {
    self.records = seedRecords
  }

  public func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt {
    records.removeAll { $0.id == record.id }
    records.append(record)
    return PraxisSemanticMemoryWriteReceipt(memoryID: record.id, storageKey: record.storageKey)
  }

  public func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord? {
    records.last { $0.id == memoryID }
  }

  public func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord] {
    let filtered = records.filter { record in
      guard record.projectID == request.projectID else {
        return false
      }
      guard request.scopeLevels.contains(record.scopeLevel) else {
        return false
      }
      if let agentID = request.agentID, record.agentID != agentID {
        return false
      }
      if let sessionID = request.sessionID {
        if record.scopeLevel == .session,
           !record.storageKey.contains(sessionID) {
          return false
        }
      }
      return record.summary.lowercased().contains(request.query.lowercased())
    }
    return Array(filtered.prefix(request.limit))
  }

  public func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle {
    let searchRequest = PraxisSemanticMemorySearchRequest(
      projectID: request.projectID,
      query: request.query,
      scopeLevels: request.scopeLevels,
      limit: request.limit,
      agentID: request.agentID,
      sessionID: request.sessionID
    )
    let matches = try await search(searchRequest)
    let primary = matches
      .filter { request.includeSuperseded || $0.freshnessStatus != .superseded }
      .map(\.id)
    let omitted = matches
      .filter { !request.includeSuperseded && $0.freshnessStatus == .superseded }
      .map(\.id)
    return PraxisSemanticMemoryBundle(
      primaryMemoryIDs: primary,
      supportingMemoryIDs: [],
      omittedSupersededMemoryIDs: omitted
    )
  }
}

/// Stub lineage store that resolves preloaded lineage descriptors.
public struct PraxisStubLineageStore: PraxisLineageStoreContract, Sendable {
  public let descriptors: [PraxisLineageDescriptor]

  public init(descriptors: [PraxisLineageDescriptor] = []) {
    self.descriptors = descriptors
  }

  public func describe(lineageID: PraxisCmpLineageID) async throws -> String {
    descriptors.first { $0.lineageID == lineageID }?.summary ?? "Unknown lineage \(lineageID.rawValue)"
  }

  public func describe(_ request: PraxisLineageLookupRequest) async throws -> PraxisLineageDescriptor? {
    descriptors.first { $0.lineageID == request.lineageID }
  }
}
