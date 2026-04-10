import PraxisSession

/// Appends journal events into an append-only stream.
public protocol PraxisJournalAppending: Sendable {
  /// Appends an event and returns the cursor assigned to it.
  ///
  /// - Parameter event: The event to append.
  /// - Returns: The cursor assigned to the stored event.
  /// - Throws: Any implementation-specific append failure.
  func append(_ event: PraxisJournalEvent) async throws -> PraxisJournalCursor
}

/// Reads journal events from an append-only stream.
public protocol PraxisJournalReading: Sendable {
  /// Reads a global event slice after the given cursor.
  ///
  /// - Parameters:
  ///   - cursor: Optional cursor to resume from.
  ///   - limit: Optional maximum number of events to return.
  /// - Returns: A journal slice ordered by sequence.
  /// - Throws: Any implementation-specific read failure.
  func read(after cursor: PraxisJournalCursor?, limit: Int?) async throws -> PraxisJournalSlice

  /// Reads events for a specific session after the given cursor.
  ///
  /// - Parameters:
  ///   - sessionID: Session identifier to filter by.
  ///   - cursor: Optional cursor to resume from.
  ///   - limit: Optional maximum number of events to return.
  /// - Returns: A journal slice ordered by sequence for the selected session.
  /// - Throws: Any implementation-specific read failure.
  func read(
    sessionID: PraxisSessionID,
    after cursor: PraxisJournalCursor?,
    limit: Int?
  ) async throws -> PraxisJournalSlice

  /// Reads events for a specific run reference after the given cursor.
  ///
  /// - Parameters:
  ///   - runReference: Run reference to filter by.
  ///   - cursor: Optional cursor to resume from.
  ///   - limit: Optional maximum number of events to return.
  /// - Returns: A journal slice ordered by sequence for the selected run.
  /// - Throws: Any implementation-specific read failure.
  func read(
    runReference: String,
    after cursor: PraxisJournalCursor?,
    limit: Int?
  ) async throws -> PraxisJournalSlice

  /// Returns the latest event associated with a run reference.
  ///
  /// - Parameter runReference: Run reference to filter by.
  /// - Returns: The latest matching event, if any.
  func latestEvent(runReference: String) async -> PraxisJournalEvent?
}

/// In-memory append-only journal used by tests and local orchestration.
public actor PraxisInMemoryJournalBuffer {
  public private(set) var events: [PraxisJournalEvent]
  public private(set) var requestedFlushes: [PraxisJournalFlushSignal]
  public let flushThreshold: Int

  /// Creates an in-memory journal buffer.
  ///
  /// - Parameters:
  ///   - events: Seed events for the buffer.
  ///   - flushThreshold: Number of buffered events that triggers an automatic flush request.
  public init(
    events: [PraxisJournalEvent] = [],
    flushThreshold: Int = 256
  ) {
    self.events = events.enumerated().map { index, event in
      PraxisJournalEvent(
        sequence: index + 1,
        sessionID: event.sessionID,
        runReference: event.runReference,
        correlationID: event.correlationID,
        type: event.type,
        summary: event.summary,
        metadata: event.metadata
      )
    }
    self.requestedFlushes = []
    self.flushThreshold = max(1, flushThreshold)
  }
}

extension PraxisInMemoryJournalBuffer: PraxisJournalAppending, PraxisJournalReading {
  public func append(_ event: PraxisJournalEvent) async throws -> PraxisJournalCursor {
    let nextSequence = events.count + 1
    let normalized = PraxisJournalEvent(
      sequence: nextSequence,
      sessionID: event.sessionID,
      runReference: event.runReference,
      correlationID: event.correlationID,
      type: event.type,
      summary: event.summary,
      metadata: event.metadata
    )
    events.append(normalized)

    let cursor = PraxisJournalCursor(sequence: normalized.sequence)
    if nextSequence % flushThreshold == 0 {
      requestedFlushes.append(
        PraxisJournalFlushSignal(
          reason: .threshold,
          uptoCursor: cursor,
          pendingEvents: nextSequence
        )
      )
    }
    return cursor
  }

  public func read(
    after cursor: PraxisJournalCursor?,
    limit: Int? = nil
  ) async throws -> PraxisJournalSlice {
    makeSlice(
      from: events,
      after: cursor,
      limit: limit
    )
  }

  public func read(
    sessionID: PraxisSessionID,
    after cursor: PraxisJournalCursor?,
    limit: Int? = nil
  ) async throws -> PraxisJournalSlice {
    makeSlice(
      from: events.filter { $0.sessionID == sessionID },
      after: cursor,
      limit: limit
    )
  }

  public func read(
    runReference: String,
    after cursor: PraxisJournalCursor?,
    limit: Int? = nil
  ) async throws -> PraxisJournalSlice {
    makeSlice(
      from: events.filter { $0.runReference == runReference },
      after: cursor,
      limit: limit
    )
  }

  public func latestEvent(runReference: String) async -> PraxisJournalEvent? {
    events.last(where: { $0.runReference == runReference })
  }

  /// Requests a manual flush signal at the latest cursor.
  ///
  /// - Returns: The created flush signal, or `nil` when the journal is empty.
  public func requestFlush() -> PraxisJournalFlushSignal? {
    guard let lastEvent = events.last else {
      return nil
    }
    let signal = PraxisJournalFlushSignal(
      reason: .manual,
      uptoCursor: .init(sequence: lastEvent.sequence),
      pendingEvents: events.count
    )
    requestedFlushes.append(signal)
    return signal
  }

  /// Drains and returns all pending flush requests.
  ///
  /// - Returns: Pending flush signals in FIFO order.
  public func drainRequestedFlushes() -> [PraxisJournalFlushSignal] {
    let drained = requestedFlushes
    requestedFlushes.removeAll()
    return drained
  }

  private func makeSlice(
    from source: [PraxisJournalEvent],
    after cursor: PraxisJournalCursor?,
    limit: Int?
  ) -> PraxisJournalSlice {
    let filtered = source.filter {
      guard let cursor else {
        return true
      }
      return $0.sequence > cursor.sequence
    }
    let limited: [PraxisJournalEvent]
    if let limit {
      limited = Array(filtered.prefix(max(0, limit)))
    } else {
      limited = filtered
    }
    return PraxisJournalSlice(
      events: limited,
      nextCursor: limited.last.map { .init(sequence: $0.sequence) }
    )
  }
}
