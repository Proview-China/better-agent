import Foundation
import PraxisRuntimeGateway
import PraxisRuntimeInterface

/// Encodes the host-neutral runtime interface behind opaque session handles for FFI consumers.
///
/// This bridge does not define new runtime semantics. It reuses the gateway and runtime interface
/// contracts so future non-Swift hosts can share the same request/response/event surface.
public final class PraxisFFIBridge {
  public let runtimeInterfaceRegistry: PraxisRuntimeInterfaceRegistry
  public let runtimeInterfaceCodec: any PraxisRuntimeInterfaceCoding

  public init(
    runtimeInterfaceRegistry: PraxisRuntimeInterfaceRegistry,
    runtimeInterfaceCodec: any PraxisRuntimeInterfaceCoding = PraxisJSONRuntimeInterfaceCodec()
  ) {
    self.runtimeInterfaceRegistry = runtimeInterfaceRegistry
    self.runtimeInterfaceCodec = runtimeInterfaceCodec
  }

  /// Exports the host-neutral runtime topology that the FFI bridge routes through.
  ///
  /// - Returns: The gateway bootstrap snapshot used by encoded FFI callers.
  public func exportArchitectureSnapshot() -> PraxisRuntimeGatewayBlueprint {
    PraxisRuntimeGatewayModule.bootstrap
  }

  /// Opens a new runtime interface session and returns its opaque handle.
  ///
  /// - Returns: A new session handle managed by the runtime interface registry.
  /// - Throws: Any registry error raised while materializing the underlying runtime session.
  public func openRuntimeSession() async throws -> PraxisRuntimeInterfaceSessionHandle {
    try await runtimeInterfaceRegistry.openSession()
  }

  /// Lists the active opaque session handles owned by this bridge.
  ///
  /// - Returns: The currently active handles in registry order.
  public func activeRuntimeSessionHandles() async -> [PraxisRuntimeInterfaceSessionHandle] {
    await runtimeInterfaceRegistry.activeHandles()
  }

  /// Closes one runtime interface session by opaque handle.
  ///
  /// - Parameter handle: The opaque handle to close.
  /// - Returns: `true` when the handle existed and was closed; otherwise `false`.
  public func closeRuntimeSession(_ handle: PraxisRuntimeInterfaceSessionHandle) async -> Bool {
    await runtimeInterfaceRegistry.closeSession(handle)
  }

  /// Handles one encoded runtime interface request for an existing opaque session.
  ///
  /// - Parameters:
  ///   - requestData: The encoded runtime interface request payload.
  ///   - handle: The opaque session handle that should receive the request.
  /// - Returns: The encoded runtime interface response payload.
  /// - Throws: Any encoding failure raised while materializing the response envelope.
  public func handleEncodedRequest(
    _ requestData: Data,
    on handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    let request: PraxisRuntimeInterfaceRequest
    do {
      request = try runtimeInterfaceCodec.decodeRequest(requestData)
    } catch {
      return try runtimeInterfaceCodec.encode(
        .failure(
          error: .init(
            code: .invalidInput,
            message: "Failed to decode runtime interface request payload: \(error)"
          )
        )
      )
    }

    let response = await runtimeInterfaceRegistry.handle(request, on: handle)
    return try runtimeInterfaceCodec.encode(response)
  }

  /// Snapshots the encoded event buffer for one opaque session without draining it.
  ///
  /// - Parameter handle: The opaque session handle to inspect.
  /// - Returns: A JSON-encoded event envelope for that session.
  /// - Throws: Any JSON encoding failure raised while materializing the envelope.
  public func snapshotEncodedEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    try encodeEventEnvelope(await eventEnvelope(snapshot: true, for: handle))
  }

  /// Drains the encoded event buffer for one opaque session.
  ///
  /// - Parameter handle: The opaque session handle to drain.
  /// - Returns: A JSON-encoded event envelope for that session.
  /// - Throws: Any JSON encoding failure raised while materializing the envelope.
  public func drainEncodedEvents(
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> Data {
    try encodeEventEnvelope(await eventEnvelope(snapshot: false, for: handle))
  }

  private func eventEnvelope(
    snapshot: Bool,
    for handle: PraxisRuntimeInterfaceSessionHandle
  ) async -> PraxisFFIEventEnvelope {
    let events = snapshot
      ? await runtimeInterfaceRegistry.snapshotEvents(for: handle)
      : await runtimeInterfaceRegistry.drainEvents(for: handle)

    guard let events else {
      return .failure(
        handle: handle,
        error: .init(
          code: .sessionNotFound,
          message: "Runtime interface session handle \(handle.rawValue) was not found."
        )
      )
    }

    return .success(handle: handle, events: events)
  }

  private func encodeEventEnvelope(_ envelope: PraxisFFIEventEnvelope) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return try encoder.encode(envelope)
  }
}
