import PraxisRuntimeInterface

private func decodeFFIEventSchemaVersion<Key: CodingKey>(
  from container: KeyedDecodingContainer<Key>,
  forKey key: Key
) throws -> PraxisRuntimeInterfaceSchemaVersion {
  guard container.contains(key) else {
    return .v1
  }
  guard let rawValue = try container.decodeIfPresent(String.self, forKey: key) else {
    throw DecodingError.dataCorruptedError(
      forKey: key,
      in: container,
      debugDescription: "FFI event schema version must be omitted or set to a supported string value."
    )
  }
  guard let version = PraxisRuntimeInterfaceSchemaVersion(rawValue: rawValue) else {
    throw DecodingError.dataCorruptedError(
      forKey: key,
      in: container,
      debugDescription: "Unsupported FFI event schema version '\(rawValue)'."
    )
  }
  return version
}

/// Encodes one FFI-visible event buffer response for an opaque runtime session handle.
///
/// This envelope mirrors the runtime interface success/failure shape without adding host-specific
/// presentation semantics.
public struct PraxisFFIEventEnvelope: Sendable, Equatable, Codable {
  public let eventSchemaVersion: PraxisRuntimeInterfaceSchemaVersion
  public let status: PraxisRuntimeInterfaceResponseStatus
  public let handle: PraxisRuntimeInterfaceSessionHandle
  public let events: [PraxisRuntimeInterfaceEvent]
  public let error: PraxisRuntimeInterfaceErrorEnvelope?

  public init(
    eventSchemaVersion: PraxisRuntimeInterfaceSchemaVersion = .v1,
    status: PraxisRuntimeInterfaceResponseStatus,
    handle: PraxisRuntimeInterfaceSessionHandle,
    events: [PraxisRuntimeInterfaceEvent] = [],
    error: PraxisRuntimeInterfaceErrorEnvelope? = nil
  ) {
    self.eventSchemaVersion = eventSchemaVersion
    self.status = status
    self.handle = handle
    self.events = events
    self.error = error
  }

  /// Builds a successful event envelope.
  ///
  /// - Parameters:
  ///   - handle: The opaque session handle that produced these events.
  ///   - events: The drained or snapshotted runtime interface events.
  /// - Returns: A success envelope for the requested session.
  public static func success(
    handle: PraxisRuntimeInterfaceSessionHandle,
    events: [PraxisRuntimeInterfaceEvent]
  ) -> PraxisFFIEventEnvelope {
    .init(
      eventSchemaVersion: .v1,
      status: .success,
      handle: handle,
      events: events,
      error: nil
    )
  }

  /// Builds a failed event envelope.
  ///
  /// - Parameters:
  ///   - handle: The opaque session handle that could not be resolved.
  ///   - error: The structured runtime interface error for the failed lookup.
  /// - Returns: A failure envelope for the requested session.
  public static func failure(
    handle: PraxisRuntimeInterfaceSessionHandle,
    error: PraxisRuntimeInterfaceErrorEnvelope
  ) -> PraxisFFIEventEnvelope {
    .init(
      eventSchemaVersion: .v1,
      status: .failure,
      handle: handle,
      events: [],
      error: error
    )
  }

  private enum CodingKeys: String, CodingKey {
    case eventSchemaVersion
    case status
    case handle
    case events
    case error
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    eventSchemaVersion = try decodeFFIEventSchemaVersion(from: container, forKey: .eventSchemaVersion)
    status = try container.decode(PraxisRuntimeInterfaceResponseStatus.self, forKey: .status)
    handle = try container.decode(PraxisRuntimeInterfaceSessionHandle.self, forKey: .handle)
    events = try container.decodeIfPresent([PraxisRuntimeInterfaceEvent].self, forKey: .events) ?? []
    error = try container.decodeIfPresent(PraxisRuntimeInterfaceErrorEnvelope.self, forKey: .error)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(eventSchemaVersion, forKey: .eventSchemaVersion)
    try container.encode(status, forKey: .status)
    try container.encode(handle, forKey: .handle)
    try container.encode(events, forKey: .events)
    try container.encodeIfPresent(error, forKey: .error)
  }
}
