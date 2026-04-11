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
    let startingSequence = (events.last?.sequence ?? 0) + 1
    let normalizedEvents = batch.events.enumerated().map { offset, event in
      PraxisJournalEvent(
        sequence: startingSequence + offset,
        sessionID: event.sessionID,
        runReference: event.runReference,
        correlationID: event.correlationID,
        type: event.type,
        summary: event.summary,
        metadata: event.metadata
      )
    }
    events.append(contentsOf: normalizedEvents)
    return PraxisJournalAppendReceipt(
      appendedCount: normalizedEvents.count,
      lastCursor: normalizedEvents.last.map { PraxisJournalCursor(sequence: $0.sequence) }
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

/// In-memory fake CMP context package descriptor store.
public actor PraxisFakeCmpContextPackageStore: PraxisCmpContextPackageStoreContract {
  private var descriptors: [PraxisCmpContextPackageDescriptor]

  public init(seedDescriptors: [PraxisCmpContextPackageDescriptor] = []) {
    self.descriptors = seedDescriptors
  }

  public func save(_ descriptor: PraxisCmpContextPackageDescriptor) async throws -> PraxisCmpContextPackageStoreWriteReceipt {
    descriptors.removeAll { $0.projectID == descriptor.projectID && $0.packageID == descriptor.packageID }
    descriptors.append(descriptor)
    return PraxisCmpContextPackageStoreWriteReceipt(
      packageID: descriptor.packageID,
      status: descriptor.status,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpContextPackageQuery) async throws -> [PraxisCmpContextPackageDescriptor] {
    descriptors
      .filter { descriptor in
        guard descriptor.projectID == query.projectID else {
          return false
        }
        if let packageID = query.packageID, descriptor.packageID != packageID {
          return false
        }
        if let sourceAgentID = query.sourceAgentID, descriptor.sourceAgentID != sourceAgentID {
          return false
        }
        if let targetAgentID = query.targetAgentID, descriptor.targetAgentID != targetAgentID {
          return false
        }
        if let sourceSnapshotID = query.sourceSnapshotID, descriptor.sourceSnapshotID != sourceSnapshotID {
          return false
        }
        if let packageKind = query.packageKind, descriptor.packageKind != packageKind {
          return false
        }
        return true
      }
      .sorted { $0.updatedAt > $1.updatedAt }
  }
}

/// In-memory fake CMP control descriptor store.
public actor PraxisFakeCmpControlStore: PraxisCmpControlStoreContract {
  private var descriptors: [PraxisCmpControlDescriptor]

  public init(seedDescriptors: [PraxisCmpControlDescriptor] = []) {
    self.descriptors = seedDescriptors
  }

  public func save(_ descriptor: PraxisCmpControlDescriptor) async throws -> PraxisCmpControlStoreWriteReceipt {
    descriptors.removeAll { $0.projectID == descriptor.projectID && $0.agentID == descriptor.agentID }
    descriptors.append(descriptor)
    return PraxisCmpControlStoreWriteReceipt(
      projectID: descriptor.projectID,
      agentID: descriptor.agentID,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpControlQuery) async throws -> PraxisCmpControlDescriptor? {
    descriptors
      .filter { descriptor in
        descriptor.projectID == query.projectID && descriptor.agentID == query.agentID
      }
      .sorted { $0.updatedAt > $1.updatedAt }
      .first
  }
}

/// In-memory fake CMP peer-approval descriptor store.
public actor PraxisFakeCmpPeerApprovalStore: PraxisCmpPeerApprovalStoreContract {
  private var descriptors: [PraxisCmpPeerApprovalDescriptor]

  public init(seedDescriptors: [PraxisCmpPeerApprovalDescriptor] = []) {
    self.descriptors = seedDescriptors
  }

  public func save(_ descriptor: PraxisCmpPeerApprovalDescriptor) async throws -> PraxisCmpPeerApprovalStoreWriteReceipt {
    descriptors.removeAll {
      $0.projectID == descriptor.projectID &&
      $0.agentID == descriptor.agentID &&
      $0.targetAgentID == descriptor.targetAgentID &&
      $0.capabilityKey == descriptor.capabilityKey
    }
    descriptors.append(descriptor)
    return PraxisCmpPeerApprovalStoreWriteReceipt(
      projectID: descriptor.projectID,
      agentID: descriptor.agentID,
      targetAgentID: descriptor.targetAgentID,
      capabilityKey: descriptor.capabilityKey,
      storedAt: descriptor.updatedAt
    )
  }

  public func describe(_ query: PraxisCmpPeerApprovalQuery) async throws -> PraxisCmpPeerApprovalDescriptor? {
    try await describeAll(query).first
  }

  public func describeAll(_ query: PraxisCmpPeerApprovalQuery) async throws -> [PraxisCmpPeerApprovalDescriptor] {
    descriptors
      .filter { descriptor in
        guard descriptor.projectID == query.projectID else {
          return false
        }
        if let agentID = query.agentID, descriptor.agentID != agentID {
          return false
        }
        if let targetAgentID = query.targetAgentID, descriptor.targetAgentID != targetAgentID {
          return false
        }
        if let capabilityKey = query.capabilityKey, descriptor.capabilityKey != capabilityKey {
          return false
        }
        return true
      }
      .sorted { lhs, rhs in
        if lhs.updatedAt != rhs.updatedAt {
          return lhs.updatedAt > rhs.updatedAt
        }
        if lhs.agentID != rhs.agentID {
          return lhs.agentID < rhs.agentID
        }
        if lhs.targetAgentID != rhs.targetAgentID {
          return lhs.targetAgentID < rhs.targetAgentID
        }
        return lhs.capabilityKey < rhs.capabilityKey
      }
  }
}

/// In-memory append-only store for TAP runtime audit events.
public actor PraxisFakeTapRuntimeEventStore: PraxisTapRuntimeEventStoreContract {
  private var records: [PraxisTapRuntimeEventRecord]

  public init(seedRecords: [PraxisTapRuntimeEventRecord] = []) {
    self.records = seedRecords
  }

  public func append(_ record: PraxisTapRuntimeEventRecord) async throws -> PraxisTapRuntimeEventStoreWriteReceipt {
    records.append(record)
    return PraxisTapRuntimeEventStoreWriteReceipt(
      eventID: record.eventID,
      projectID: record.projectID,
      createdAt: record.createdAt
    )
  }

  public func read(_ query: PraxisTapRuntimeEventQuery) async throws -> [PraxisTapRuntimeEventRecord] {
    let clampedLimit = max(0, min(query.limit, 200))
    return records
      .filter { record in
        guard record.projectID == query.projectID else {
          return false
        }
        if let agentID = query.agentID, record.agentID != agentID {
          return false
        }
        if let targetAgentID = query.targetAgentID, record.targetAgentID != targetAgentID {
          return false
        }
        return true
      }
      .sorted { lhs, rhs in
        if lhs.createdAt != rhs.createdAt {
          return lhs.createdAt > rhs.createdAt
        }
        return lhs.eventID > rhs.eventID
      }
      .prefix(clampedLimit)
      .map { $0 }
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
      guard record.visibilityState != .archived else {
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
           record.sessionID != sessionID {
          return false
        }
      }
      if request.query.isEmpty {
        return true
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

  public func save(_ descriptor: PraxisLineageDescriptor) async throws {
    _ = descriptor
  }

  public func describe(lineageID: PraxisCmpLineageID) async throws -> String {
    descriptors.first { $0.lineageID == lineageID }?.summary ?? "Unknown lineage \(lineageID.rawValue)"
  }

  public func describe(_ request: PraxisLineageLookupRequest) async throws -> PraxisLineageDescriptor? {
    descriptors.first { $0.lineageID == request.lineageID }
  }
}
