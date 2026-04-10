import Foundation
import PraxisJournal
import PraxisSession

/// Encodes and decodes checkpoint snapshots.
public protocol PraxisCheckpointCoding: Sendable {
  /// Encodes a checkpoint snapshot.
  ///
  /// - Parameter snapshot: The checkpoint snapshot to encode.
  /// - Returns: Encoded checkpoint data.
  /// - Throws: Any encoding error produced by the codec.
  func encode(_ snapshot: PraxisCheckpointSnapshot) throws -> Data
  /// Decodes a checkpoint snapshot.
  ///
  /// - Parameter data: Encoded checkpoint data.
  /// - Returns: The decoded checkpoint snapshot.
  /// - Throws: Any decoding error produced by the codec.
  func decode(_ data: Data) throws -> PraxisCheckpointSnapshot
}

/// Stores checkpoint snapshots keyed by session and checkpoint identifier.
public protocol PraxisCheckpointStoring: Sendable {
  /// Writes a checkpoint snapshot to storage.
  ///
  /// - Parameter snapshot: The snapshot to store.
  /// - Throws: Any implementation-specific storage failure.
  func write(_ snapshot: PraxisCheckpointSnapshot) async throws
  /// Loads a checkpoint by identifier.
  ///
  /// - Parameter id: The checkpoint identifier to load.
  /// - Returns: The stored checkpoint snapshot, if present.
  /// - Throws: Any implementation-specific storage failure.
  func load(id: PraxisCheckpointID) async throws -> PraxisCheckpointSnapshot?
  /// Loads the latest checkpoint for a session.
  ///
  /// - Parameter sessionID: The session identifier to look up.
  /// - Returns: The latest checkpoint snapshot for the session, if present.
  /// - Throws: Any implementation-specific storage failure.
  func latest(sessionID: PraxisSessionID) async throws -> PraxisCheckpointSnapshot?
}

/// JSON codec for checkpoint snapshots.
public struct PraxisJSONCheckpointCodec: Sendable, PraxisCheckpointCoding {
  /// Creates the default JSON checkpoint codec.
  public init() {}

  public func encode(_ snapshot: PraxisCheckpointSnapshot) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return try encoder.encode(snapshot)
  }

  public func decode(_ data: Data) throws -> PraxisCheckpointSnapshot {
    try JSONDecoder().decode(PraxisCheckpointSnapshot.self, from: data)
  }
}

/// In-memory checkpoint store used by tests and local orchestration.
public actor PraxisInMemoryCheckpointStore: PraxisCheckpointStoring {
  public private(set) var snapshotsByID: [PraxisCheckpointID: PraxisCheckpointSnapshot]
  public private(set) var latestBySession: [PraxisSessionID: PraxisCheckpointID]

  /// Creates an in-memory checkpoint store.
  ///
  /// - Parameter snapshots: Seed snapshots for the store.
  public init(snapshots: [PraxisCheckpointSnapshot] = []) {
    self.snapshotsByID = Dictionary(
      uniqueKeysWithValues: snapshots.map { ($0.id, $0) }
    )
    self.latestBySession = Dictionary(
      uniqueKeysWithValues: snapshots.map { ($0.sessionID, $0.id) }
    )
  }

  public func write(_ snapshot: PraxisCheckpointSnapshot) async throws {
    snapshotsByID[snapshot.id] = snapshot
    latestBySession[snapshot.sessionID] = snapshot.id
  }

  public func load(id: PraxisCheckpointID) async throws -> PraxisCheckpointSnapshot? {
    snapshotsByID[id]
  }

  public func latest(sessionID: PraxisSessionID) async throws -> PraxisCheckpointSnapshot? {
    guard let checkpointID = latestBySession[sessionID] else {
      return nil
    }
    return snapshotsByID[checkpointID]
  }
}

/// Recovers replay context from checkpoints plus journal slices.
public struct PraxisCheckpointRecoveryService: Sendable {
  /// Creates the default recovery service.
  public init() {}

  /// Recovers replay context from a specific checkpoint snapshot.
  ///
  /// - Parameters:
  ///   - snapshot: The checkpoint snapshot to recover from.
  ///   - journal: Journal reader used to replay events after the checkpoint cursor.
  /// - Returns: A recovery envelope containing the snapshot and replayed events.
  /// - Throws: Any error thrown while reading the journal.
  public func recover(
    from snapshot: PraxisCheckpointSnapshot,
    journal: any PraxisJournalReading
  ) async throws -> PraxisRecoveryEnvelope {
    let replay = try await journal.read(
      sessionID: snapshot.sessionID,
      after: snapshot.lastCursor,
      limit: nil
    )
    return PraxisRecoveryEnvelope(
      pointer: .init(checkpointID: snapshot.id, sessionID: snapshot.sessionID),
      snapshot: snapshot,
      replayedEvents: replay.events,
      resumeCursor: replay.nextCursor ?? snapshot.lastCursor
    )
  }

  /// Loads the latest checkpoint for a session and recovers replay context from it.
  ///
  /// - Parameters:
  ///   - sessionID: Session identifier to recover.
  ///   - store: Checkpoint store used to load the latest snapshot.
  ///   - journal: Journal reader used to replay events after the checkpoint cursor.
  /// - Returns: A recovery envelope, or `nil` when no checkpoint exists for the session.
  /// - Throws: Any error thrown while loading the checkpoint or reading the journal.
  public func recoverLatest(
    for sessionID: PraxisSessionID,
    store: any PraxisCheckpointStoring,
    journal: any PraxisJournalReading
  ) async throws -> PraxisRecoveryEnvelope? {
    guard let snapshot = try await store.latest(sessionID: sessionID) else {
      return nil
    }
    return try await recover(from: snapshot, journal: journal)
  }
}
