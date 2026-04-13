import PraxisRuntimeInterface

/// Encodes one FFI-visible event buffer response for an opaque runtime session handle.
///
/// This envelope mirrors the runtime interface success/failure shape without adding host-specific
/// presentation semantics.
public struct PraxisFFIEventEnvelope: Sendable, Equatable, Codable {
  public let status: PraxisRuntimeInterfaceResponseStatus
  public let handle: PraxisRuntimeInterfaceSessionHandle
  public let events: [PraxisRuntimeInterfaceEvent]
  public let error: PraxisRuntimeInterfaceErrorEnvelope?

  public init(
    status: PraxisRuntimeInterfaceResponseStatus,
    handle: PraxisRuntimeInterfaceSessionHandle,
    events: [PraxisRuntimeInterfaceEvent] = [],
    error: PraxisRuntimeInterfaceErrorEnvelope? = nil
  ) {
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
      status: .failure,
      handle: handle,
      events: [],
      error: error
    )
  }
}
