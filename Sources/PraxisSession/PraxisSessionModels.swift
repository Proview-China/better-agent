import PraxisCoreTypes

/// Stable identifier for a runtime session.
public struct PraxisSessionID: PraxisIdentifier {
  public let rawValue: String

  /// Creates a stable session identifier.
  ///
  /// - Parameter rawValue: The persisted string form of the identifier.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }
}

/// Hotness of a session in local memory and storage.
public enum PraxisSessionTemperature: String, Sendable, Codable {
  case hot
  case warm
  case cold
}

/// Session header that tracks the current run binding and recovery pointers.
public struct PraxisSessionHeader: Sendable, Equatable, Codable {
  public let id: PraxisSessionID
  public let title: String
  public let temperature: PraxisSessionTemperature
  public let activeRunReference: String?
  public let runReferences: [String]
  public let lastCheckpointReference: String?
  public let lastJournalSequence: Int?
  public let coldStorageReference: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a session header.
  ///
  /// - Parameters:
  ///   - id: Stable session identifier.
  ///   - title: Human-readable session title.
  ///   - temperature: Current memory/storage temperature.
  ///   - activeRunReference: Optional active run reference.
  ///   - runReferences: All run references associated with the session.
  ///   - lastCheckpointReference: Optional latest checkpoint reference.
  ///   - lastJournalSequence: Optional latest journal sequence persisted for the session.
  ///   - coldStorageReference: Optional cold-storage reference used after eviction.
  ///   - metadata: Extra plain-data metadata preserved with the header.
  public init(
    id: PraxisSessionID,
    title: String,
    temperature: PraxisSessionTemperature,
    activeRunReference: String? = nil,
    runReferences: [String] = [],
    lastCheckpointReference: String? = nil,
    lastJournalSequence: Int? = nil,
    coldStorageReference: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.id = id
    self.title = title
    self.temperature = temperature
    self.activeRunReference = activeRunReference
    self.runReferences = runReferences
    self.lastCheckpointReference = lastCheckpointReference
    self.lastJournalSequence = lastJournalSequence
    self.coldStorageReference = coldStorageReference
    self.metadata = metadata
  }
}

/// Lightweight attachment view from a session to a specific run.
public struct PraxisSessionAttachment: Sendable, Equatable, Codable {
  public let sessionID: PraxisSessionID
  public let runReference: String?
  public let isActive: Bool

  /// Creates a session attachment.
  ///
  /// - Parameters:
  ///   - sessionID: Session owning the attachment.
  ///   - runReference: Optional bound run reference.
  ///   - isActive: Whether the bound run is the current active run.
  public init(
    sessionID: PraxisSessionID,
    runReference: String?,
    isActive: Bool = true
  ) {
    self.sessionID = sessionID
    self.runReference = runReference
    self.isActive = isActive
  }
}
