import PraxisCoreTypes
import PraxisJournal
import PraxisSession

/// Stable identifier for a checkpoint.
public struct PraxisCheckpointID: PraxisIdentifier {
  public let rawValue: String

  /// Creates a stable checkpoint identifier.
  ///
  /// - Parameter rawValue: The persisted string form of the identifier.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }
}

/// Storage tier used by a checkpoint implementation.
public enum PraxisCheckpointTier: String, Sendable, Equatable, Codable {
  case fast
  case durable
}

/// Pointer used to reopen a checkpoint for a specific session.
public struct PraxisCheckpointPointer: Sendable, Equatable, Codable {
  public let checkpointID: PraxisCheckpointID
  public let sessionID: PraxisSessionID

  /// Creates a checkpoint pointer.
  ///
  /// - Parameters:
  ///   - checkpointID: Stable checkpoint identifier.
  ///   - sessionID: Session that owns the checkpoint.
  public init(checkpointID: PraxisCheckpointID, sessionID: PraxisSessionID) {
    self.checkpointID = checkpointID
    self.sessionID = sessionID
  }
}

/// Serializable checkpoint snapshot used as a recovery starting point.
public struct PraxisCheckpointSnapshot: Sendable, Equatable, Codable {
  public let id: PraxisCheckpointID
  public let sessionID: PraxisSessionID
  public let tier: PraxisCheckpointTier
  public let createdAt: String?
  public let lastCursor: PraxisJournalCursor?
  public let payload: [String: PraxisValue]?

  /// Creates a checkpoint snapshot.
  ///
  /// - Parameters:
  ///   - id: Stable checkpoint identifier.
  ///   - sessionID: Session that owns the checkpoint.
  ///   - tier: Storage tier used by the snapshot.
  ///   - createdAt: Optional snapshot creation timestamp string.
  ///   - lastCursor: Optional latest journal cursor included in the snapshot.
  ///   - payload: Optional plain-data payload preserved with the snapshot.
  public init(
    id: PraxisCheckpointID,
    sessionID: PraxisSessionID,
    tier: PraxisCheckpointTier = .fast,
    createdAt: String? = nil,
    lastCursor: PraxisJournalCursor? = nil,
    payload: [String: PraxisValue]? = nil
  ) {
    self.id = id
    self.sessionID = sessionID
    self.tier = tier
    self.createdAt = createdAt
    self.lastCursor = lastCursor
    self.payload = payload
  }
}

/// Recovery result that pairs a checkpoint snapshot with replayed journal events.
public struct PraxisRecoveryEnvelope: Sendable, Equatable, Codable {
  public let pointer: PraxisCheckpointPointer
  public let snapshot: PraxisCheckpointSnapshot
  public let replayedEvents: [PraxisJournalEvent]
  public let resumeCursor: PraxisJournalCursor?

  /// Creates a recovery envelope.
  ///
  /// - Parameters:
  ///   - pointer: Pointer used to resolve the checkpoint.
  ///   - snapshot: Snapshot loaded from checkpoint storage.
  ///   - replayedEvents: Journal events replayed after the snapshot cursor.
  ///   - resumeCursor: Cursor a resumed reader should continue from.
  public init(
    pointer: PraxisCheckpointPointer,
    snapshot: PraxisCheckpointSnapshot,
    replayedEvents: [PraxisJournalEvent] = [],
    resumeCursor: PraxisJournalCursor? = nil
  ) {
    self.pointer = pointer
    self.snapshot = snapshot
    self.replayedEvents = replayedEvents
    self.resumeCursor = resumeCursor
  }
}
