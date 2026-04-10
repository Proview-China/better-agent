import PraxisCheckpoint
import PraxisCmpTypes
import PraxisJournal

/// Persists and reloads checkpoint snapshots for recovery.
public protocol PraxisCheckpointStoreContract: Sendable {
  /// Stores a checkpoint snapshot.
  ///
  /// - Parameter record: Checkpoint snapshot to persist.
  /// - Returns: A receipt describing the persisted pointer and tier.
  func save(_ record: PraxisCheckpointRecord) async throws -> PraxisCheckpointSaveReceipt

  /// Loads a checkpoint snapshot by pointer.
  ///
  /// - Parameter pointer: Pointer identifying the checkpoint.
  /// - Returns: The persisted record when present; otherwise `nil`.
  func load(pointer: PraxisCheckpointPointer) async throws -> PraxisCheckpointRecord?
}

/// Appends and slices the persistent journal stream.
public protocol PraxisJournalStoreContract: Sendable {
  /// Appends a batch of journal events.
  ///
  /// - Parameter batch: Events to append.
  /// - Returns: A receipt describing the append window.
  func append(_ batch: PraxisJournalRecordBatch) async throws -> PraxisJournalAppendReceipt

  /// Reads a deterministic journal slice from the persistent stream.
  ///
  /// - Parameter request: Slice request describing the session, cursor, and limit.
  /// - Returns: A journal slice ready for replay.
  func read(_ request: PraxisJournalSliceRequest) async throws -> PraxisJournalSlice
}

/// Stores projection descriptors that HostRuntime can inspect or recover.
public protocol PraxisProjectionStoreContract: Sendable {
  /// Persists a projection descriptor.
  ///
  /// - Parameter descriptor: Projection descriptor to persist.
  /// - Returns: A receipt describing the write target.
  func save(_ descriptor: PraxisProjectionRecordDescriptor) async throws -> PraxisProjectionStoreWriteReceipt

  /// Returns the latest projection descriptor for a project.
  ///
  /// - Parameter projectId: Project identifier that scopes the lookup.
  /// - Returns: The latest descriptor known for the project.
  func describe(projectId: String) async throws -> PraxisProjectionRecordDescriptor

  /// Returns projection descriptors that match the supplied query.
  ///
  /// - Parameter query: Structured projection lookup query.
  /// - Returns: Matching descriptors ordered by recency.
  func describe(_ query: PraxisProjectionDescriptorQuery) async throws -> [PraxisProjectionRecordDescriptor]
}

/// Publishes messages onto the host message bus.
public protocol PraxisMessageBusContract: Sendable {
  /// Publishes a message.
  ///
  /// - Parameter message: Message to publish.
  /// - Returns: A publication receipt acknowledging that the host accepted the message.
  func publish(_ message: PraxisPublishedMessage) async throws -> PraxisMessagePublicationReceipt

  /// Registers a lightweight subscription with the host bus.
  ///
  /// - Parameters:
  ///   - topic: Topic to subscribe to.
  ///   - consumerID: Stable consumer identifier.
  /// - Returns: A subscription descriptor.
  func subscribe(topic: String, consumerID: String) async throws -> PraxisMessageSubscription
}

/// Persists delivery truth updates emitted by the transport layer.
public protocol PraxisDeliveryTruthStoreContract: Sendable {
  /// Saves or updates a delivery truth record.
  ///
  /// - Parameter record: Delivery truth state to upsert.
  /// - Returns: A receipt describing the resulting stored state.
  func save(_ record: PraxisDeliveryTruthRecord) async throws -> PraxisDeliveryTruthUpsertReceipt

  /// Looks up a single truth record by delivery identifier.
  ///
  /// - Parameter deliveryID: Delivery identifier to look up.
  /// - Returns: The matching truth record when present; otherwise `nil`.
  func lookup(deliveryID: String) async throws -> PraxisDeliveryTruthRecord?

  /// Searches truth records using a structured query.
  ///
  /// - Parameter query: Structured delivery truth query.
  /// - Returns: Matching truth records.
  func lookup(_ query: PraxisDeliveryTruthQuery) async throws -> [PraxisDeliveryTruthRecord]
}

/// Persists embedding metadata and storage references.
public protocol PraxisEmbeddingStoreContract: Sendable {
  /// Saves embedding metadata.
  ///
  /// - Parameter record: Embedding record to persist.
  /// - Returns: A receipt describing the stored embedding.
  func save(_ record: PraxisEmbeddingRecord) async throws -> PraxisEmbeddingStoreWriteReceipt

  /// Loads embedding metadata by identifier.
  ///
  /// - Parameter embeddingID: Embedding identifier to load.
  /// - Returns: The embedding record when present; otherwise `nil`.
  func load(embeddingID: String) async throws -> PraxisEmbeddingRecord?
}

/// Queries the local semantic search index.
public protocol PraxisSemanticSearchIndexContract: Sendable {
  /// Executes a semantic search request.
  ///
  /// - Parameter request: Structured semantic search query.
  /// - Returns: Ranked semantic matches.
  func search(_ request: PraxisSemanticSearchRequest) async throws -> [PraxisSemanticSearchMatch]
}

/// Persists semantic memory records and builds memory bundles for runtime recall.
public protocol PraxisSemanticMemoryStoreContract: Sendable {
  /// Saves a semantic memory record.
  ///
  /// - Parameter record: Semantic memory record to persist.
  /// - Returns: A receipt describing the stored record.
  func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt

  /// Loads a semantic memory record by identifier.
  ///
  /// - Parameter memoryID: Memory identifier to load.
  /// - Returns: The semantic memory record when present; otherwise `nil`.
  func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord?

  /// Searches semantic memory records.
  ///
  /// - Parameter request: Structured memory search request.
  /// - Returns: Matching semantic memory records.
  func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord]

  /// Builds a compact runtime memory bundle.
  ///
  /// - Parameter request: Bundle request describing scope and supersession policy.
  /// - Returns: A memory bundle suitable for runtime recall.
  func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle
}

/// Resolves lineage descriptors from host persistence.
public protocol PraxisLineageStoreContract: Sendable {
  /// Returns a human-readable lineage summary.
  ///
  /// - Parameter lineageID: Lineage identifier to describe.
  /// - Returns: A short summary string.
  func describe(lineageID: PraxisCmpLineageID) async throws -> String

  /// Returns a structured lineage descriptor.
  ///
  /// - Parameter request: Structured lineage lookup request.
  /// - Returns: The lineage descriptor when present; otherwise `nil`.
  func describe(_ request: PraxisLineageLookupRequest) async throws -> PraxisLineageDescriptor?
}
