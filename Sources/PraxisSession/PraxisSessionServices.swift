import PraxisCoreTypes

/// Pure lifecycle rules for creating and updating session headers.
public struct PraxisSessionLifecycleService: Sendable {
  /// Creates the default session lifecycle service.
  public init() {}

  /// Creates a new session header with empty run bindings.
  ///
  /// - Parameters:
  ///   - id: Stable session identifier.
  ///   - title: Human-readable session title.
  ///   - temperature: Initial session temperature. Defaults to `.hot`.
  ///   - metadata: Optional plain-data metadata stored with the session.
  /// - Returns: A newly initialized session header.
  public func createHeader(
    id: PraxisSessionID,
    title: String,
    temperature: PraxisSessionTemperature = .hot,
    metadata: [String: PraxisValue]? = nil
  ) -> PraxisSessionHeader {
    PraxisSessionHeader(
      id: id,
      title: title,
      temperature: temperature,
      metadata: metadata
    )
  }

  /// Attaches a run to the session and optionally makes it active.
  ///
  /// - Parameters:
  ///   - runReference: The run reference to attach.
  ///   - header: The current session header.
  ///   - makeActive: Whether the run should become the active run.
  /// - Returns: An updated session header with the run attached.
  public func attachRun(
    _ runReference: String,
    to header: PraxisSessionHeader,
    makeActive: Bool = true
  ) -> PraxisSessionHeader {
    let runReferences = header.runReferences.contains(runReference)
      ? header.runReferences
      : header.runReferences + [runReference]

    return PraxisSessionHeader(
      id: header.id,
      title: header.title,
      temperature: header.temperature,
      activeRunReference: makeActive ? runReference : header.activeRunReference,
      runReferences: runReferences,
      lastCheckpointReference: header.lastCheckpointReference,
      lastJournalSequence: header.lastJournalSequence,
      coldStorageReference: header.coldStorageReference,
      metadata: header.metadata
    )
  }

  /// Clears the active run binding without removing the historical run references.
  ///
  /// - Parameter header: The current session header.
  /// - Returns: An updated session header without an active run.
  public func clearActiveRun(from header: PraxisSessionHeader) -> PraxisSessionHeader {
    PraxisSessionHeader(
      id: header.id,
      title: header.title,
      temperature: header.temperature,
      activeRunReference: nil,
      runReferences: header.runReferences,
      lastCheckpointReference: header.lastCheckpointReference,
      lastJournalSequence: header.lastJournalSequence,
      coldStorageReference: header.coldStorageReference,
      metadata: header.metadata
    )
  }

  /// Stores the latest checkpoint and journal position on the session.
  ///
  /// - Parameters:
  ///   - checkpointReference: The checkpoint reference to remember.
  ///   - header: The current session header.
  ///   - journalSequence: Optional journal sequence associated with the checkpoint.
  /// - Returns: An updated session header carrying the recovery pointers.
  public func markCheckpoint(
    _ checkpointReference: String,
    on header: PraxisSessionHeader,
    journalSequence: Int? = nil
  ) -> PraxisSessionHeader {
    PraxisSessionHeader(
      id: header.id,
      title: header.title,
      temperature: header.temperature,
      activeRunReference: header.activeRunReference,
      runReferences: header.runReferences,
      lastCheckpointReference: checkpointReference,
      lastJournalSequence: journalSequence ?? header.lastJournalSequence,
      coldStorageReference: header.coldStorageReference,
      metadata: header.metadata
    )
  }

  /// Moves a session between hot, warm, and cold temperature tiers.
  ///
  /// - Parameters:
  ///   - header: The current session header.
  ///   - temperature: The next session temperature.
  ///   - coldStorageReference: Optional explicit cold-storage reference. When omitted for
  ///     `.cold`, a stable local reference derived from the session identifier is used.
  /// - Returns: An updated session header with the requested temperature.
  public func transition(
    _ header: PraxisSessionHeader,
    to temperature: PraxisSessionTemperature,
    coldStorageReference: String? = nil
  ) -> PraxisSessionHeader {
    let resolvedColdReference: String?
    switch temperature {
    case .cold:
      resolvedColdReference = coldStorageReference ?? header.coldStorageReference ?? "cold:\(header.id.rawValue)"
    case .hot, .warm:
      resolvedColdReference = header.coldStorageReference
    }

    return PraxisSessionHeader(
      id: header.id,
      title: header.title,
      temperature: temperature,
      activeRunReference: header.activeRunReference,
      runReferences: header.runReferences,
      lastCheckpointReference: header.lastCheckpointReference,
      lastJournalSequence: header.lastJournalSequence,
      coldStorageReference: resolvedColdReference,
      metadata: header.metadata
    )
  }
}

/// In-memory registry for session headers used by tests and local orchestration.
public actor PraxisSessionRegistry {
  public private(set) var sessions: [PraxisSessionHeader]
  private let lifecycle: PraxisSessionLifecycleService

  /// Creates a session registry.
  ///
  /// - Parameters:
  ///   - sessions: Seed session headers.
  ///   - lifecycle: Lifecycle helper used for updates.
  public init(
    sessions: [PraxisSessionHeader] = [],
    lifecycle: PraxisSessionLifecycleService = .init()
  ) {
    self.sessions = sessions
    self.lifecycle = lifecycle
  }

  /// Inserts or replaces a session header by identifier.
  ///
  /// - Parameter header: The session header to store.
  public func upsert(_ header: PraxisSessionHeader) {
    if let index = sessions.firstIndex(where: { $0.id == header.id }) {
      sessions[index] = header
    } else {
      sessions.append(header)
    }
  }

  /// Loads a session header by identifier.
  ///
  /// - Parameter id: The session identifier to look up.
  /// - Returns: The stored session header, if present.
  public func session(id: PraxisSessionID) -> PraxisSessionHeader? {
    sessions.first(where: { $0.id == id })
  }

  /// Creates and stores a new session header.
  ///
  /// - Parameters:
  ///   - id: Stable session identifier.
  ///   - title: Human-readable session title.
  ///   - temperature: Initial session temperature.
  ///   - metadata: Optional plain-data metadata.
  /// - Returns: The stored session header.
  public func create(
    id: PraxisSessionID,
    title: String,
    temperature: PraxisSessionTemperature = .hot,
    metadata: [String: PraxisValue]? = nil
  ) -> PraxisSessionHeader {
    let header = lifecycle.createHeader(
      id: id,
      title: title,
      temperature: temperature,
      metadata: metadata
    )
    upsert(header)
    return header
  }

  /// Attaches a run to a stored session.
  ///
  /// - Parameters:
  ///   - runReference: The run reference to attach.
  ///   - id: The session identifier to update.
  ///   - makeActive: Whether the run should become the active run.
  /// - Returns: The updated session header, or `nil` when the session does not exist.
  public func attachRun(
    _ runReference: String,
    to id: PraxisSessionID,
    makeActive: Bool = true
  ) -> PraxisSessionHeader? {
    guard let header = session(id: id) else {
      return nil
    }
    let updated = lifecycle.attachRun(runReference, to: header, makeActive: makeActive)
    upsert(updated)
    return updated
  }

  /// Stores checkpoint recovery pointers on a session.
  ///
  /// - Parameters:
  ///   - checkpointReference: The checkpoint reference to store.
  ///   - id: The session identifier to update.
  ///   - journalSequence: Optional journal sequence associated with the checkpoint.
  /// - Returns: The updated session header, or `nil` when the session does not exist.
  public func markCheckpoint(
    _ checkpointReference: String,
    on id: PraxisSessionID,
    journalSequence: Int? = nil
  ) -> PraxisSessionHeader? {
    guard let header = session(id: id) else {
      return nil
    }
    let updated = lifecycle.markCheckpoint(
      checkpointReference,
      on: header,
      journalSequence: journalSequence
    )
    upsert(updated)
    return updated
  }

  /// Transitions a stored session to another temperature tier.
  ///
  /// - Parameters:
  ///   - id: The session identifier to update.
  ///   - temperature: The target temperature.
  ///   - coldStorageReference: Optional explicit cold-storage reference.
  /// - Returns: The updated session header, or `nil` when the session does not exist.
  public func transitionSession(
    id: PraxisSessionID,
    to temperature: PraxisSessionTemperature,
    coldStorageReference: String? = nil
  ) -> PraxisSessionHeader? {
    guard let header = session(id: id) else {
      return nil
    }
    let updated = lifecycle.transition(
      header,
      to: temperature,
      coldStorageReference: coldStorageReference
    )
    upsert(updated)
    return updated
  }
}
