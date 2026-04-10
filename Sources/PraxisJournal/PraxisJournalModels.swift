import PraxisCoreTypes
import PraxisSession

/// Single append-only journal event used by recovery and read models.
public struct PraxisJournalEvent: Sendable, Equatable, Codable {
  public let sequence: Int
  public let sessionID: PraxisSessionID
  public let runReference: String?
  public let correlationID: String?
  public let type: String?
  public let summary: String
  public let metadata: [String: PraxisValue]?

  /// Creates a journal event.
  ///
  /// - Parameters:
  ///   - sequence: Monotonic sequence number. In-memory buffers may normalize this value.
  ///   - sessionID: Session owning the event.
  ///   - runReference: Optional run reference associated with the event.
  ///   - correlationID: Optional correlation identifier shared across related work.
  ///   - type: Optional event type label.
  ///   - summary: Human-readable event summary.
  ///   - metadata: Extra plain-data metadata preserved with the event.
  public init(
    sequence: Int,
    sessionID: PraxisSessionID,
    runReference: String? = nil,
    correlationID: String? = nil,
    type: String? = nil,
    summary: String,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.sequence = sequence
    self.sessionID = sessionID
    self.runReference = runReference
    self.correlationID = correlationID
    self.type = type
    self.summary = summary
    self.metadata = metadata
  }
}

/// Opaque cursor into the append-only journal stream.
public struct PraxisJournalCursor: Sendable, Equatable, Codable {
  public let sequence: Int

  /// Creates a journal cursor.
  ///
  /// - Parameter sequence: Monotonic sequence number into the stream.
  public init(sequence: Int) {
    self.sequence = sequence
  }
}

/// Flush trigger reason emitted by the in-memory journal.
public enum PraxisJournalFlushReason: String, Sendable, Equatable, Codable {
  case threshold
  case manual
}

/// Pending flush signal emitted when the journal decides the buffer should be drained.
public struct PraxisJournalFlushSignal: Sendable, Equatable, Codable {
  public let reason: PraxisJournalFlushReason
  public let uptoCursor: PraxisJournalCursor
  public let pendingEvents: Int

  /// Creates a flush signal.
  ///
  /// - Parameters:
  ///   - reason: The reason the flush was requested.
  ///   - uptoCursor: The highest cursor that should be considered flushed.
  ///   - pendingEvents: Number of buffered events included in the request.
  public init(
    reason: PraxisJournalFlushReason,
    uptoCursor: PraxisJournalCursor,
    pendingEvents: Int
  ) {
    self.reason = reason
    self.uptoCursor = uptoCursor
    self.pendingEvents = pendingEvents
  }
}

/// Slice of journal events returned from a cursor-based read.
public struct PraxisJournalSlice: Sendable, Equatable, Codable {
  public let events: [PraxisJournalEvent]
  public let nextCursor: PraxisJournalCursor?

  /// Creates a journal slice.
  ///
  /// - Parameters:
  ///   - events: Events included in the current read window.
  ///   - nextCursor: Cursor to resume from on the next read, if any.
  public init(events: [PraxisJournalEvent], nextCursor: PraxisJournalCursor?) {
    self.events = events
    self.nextCursor = nextCursor
  }
}
