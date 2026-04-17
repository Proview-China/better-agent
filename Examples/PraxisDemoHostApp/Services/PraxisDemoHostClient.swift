import Foundation
import PraxisFFI
import PraxisRuntimeInterface

private enum PraxisDemoHostClientError: LocalizedError {
  case missingArchitectureSnapshot
  case missingNegotiatedSchemaVersions
  case missingRunSnapshot
  case missingSessionID
  case failedRunResponse(String)
  case failedEventDrain(String)

  var errorDescription: String? {
    switch self {
    case .missingArchitectureSnapshot:
      return "Architecture negotiation did not return a snapshot."
    case .missingNegotiatedSchemaVersions:
      return "Architecture negotiation did not report the full request/response/event schema baseline."
    case .missingRunSnapshot:
      return "The demo goal completed without returning a runtime snapshot."
    case .missingSessionID:
      return "The demo goal completed without a session identifier in the returned snapshot."
    case .failedRunResponse(let message):
      return message
    case .failedEventDrain(let message):
      return message
    }
  }
}

private struct DemoHostNegotiatedSchemaBaseline {
  let request: PraxisRuntimeInterfaceSchemaVersion
  let response: PraxisRuntimeInterfaceSchemaVersion
  let event: PraxisRuntimeInterfaceSchemaVersion
}

/// Drives the narrow FFI-backed flow used by the native demo host window.
///
/// The client intentionally owns only four steps: open a bridge session, negotiate the exported
/// architecture baseline, execute one fixed demo goal, and drain the resulting event buffer.
final class PraxisDemoHostClient: Sendable {
  private let bridgeFactory: @Sendable () -> PraxisFFIBridge

  init(bridgeFactory: @escaping @Sendable () -> PraxisFFIBridge = { PraxisFFIFactory.makeFFIBridge() }) {
    self.bridgeFactory = bridgeFactory
  }

  /// Executes one complete demo-host run and returns a UI-facing snapshot.
  ///
  /// - Returns: The minimal snapshot the SwiftUI surface renders after one successful run.
  /// - Throws: Any architecture negotiation, runtime response, or event-drain failure.
  func runDemo() async throws -> DemoHostRunSnapshot {
    let bridge = bridgeFactory()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await bridge.openRuntimeSession()

    do {
      let negotiatedSchema = try await inspectArchitecture(using: bridge, codec: codec, handle: handle)
      let response = try await runGoal(using: bridge, codec: codec, handle: handle)
      let eventEnvelope = try await drainEvents(using: bridge, handle: handle)

      guard let snapshot = response.snapshot else {
        throw PraxisDemoHostClientError.missingRunSnapshot
      }
      guard let sessionID = snapshot.sessionID?.rawValue else {
        throw PraxisDemoHostClientError.missingSessionID
      }

      _ = await bridge.closeRuntimeSession(handle)

      return DemoHostRunSnapshot(
        negotiatedRequestSchemaVersion: negotiatedSchema.request.rawValue,
        negotiatedResponseSchemaVersion: negotiatedSchema.response.rawValue,
        negotiatedEventSchemaVersion: negotiatedSchema.event.rawValue,
        sessionHandle: handle.rawValue,
        responseStatus: response.status.rawValue,
        snapshotKind: snapshot.kind.rawValue,
        sessionID: sessionID,
        drainedEventNames: eventEnvelope.events.map(\.name.rawValue)
      )
    } catch {
      _ = await bridge.closeRuntimeSession(handle)
      throw error
    }
  }

  private func inspectArchitecture(
    using bridge: PraxisFFIBridge,
    codec: PraxisJSONRuntimeInterfaceCodec,
    handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> DemoHostNegotiatedSchemaBaseline {
    let responseData = try await bridge.handleEncodedRequest(try codec.encode(.inspectArchitecture), on: handle)
    let response = try codec.decodeResponse(responseData)

    guard response.status == .success, let snapshot = response.snapshot else {
      throw PraxisDemoHostClientError.missingArchitectureSnapshot
    }
    guard let requestSchemaVersion = snapshot.supportedRequestSchemaVersion,
          let responseSchemaVersion = snapshot.supportedResponseSchemaVersion,
          let eventSchemaVersion = snapshot.supportedEventSchemaVersion else {
      throw PraxisDemoHostClientError.missingNegotiatedSchemaVersions
    }

    return DemoHostNegotiatedSchemaBaseline(
      request: requestSchemaVersion,
      response: responseSchemaVersion,
      event: eventSchemaVersion
    )
  }

  private func runGoal(
    using bridge: PraxisFFIBridge,
    codec: PraxisJSONRuntimeInterfaceCodec,
    handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> PraxisRuntimeInterfaceResponse {
    let request = PraxisRuntimeInterfaceRequest.runGoal(
      .init(
        payloadSummary: "Run one native demo host goal",
        goalID: "goal.native-demo-host",
        goalTitle: "Native Demo Host Goal",
        sessionID: "session.native-demo-host"
      )
    )
    let responseData = try await bridge.handleEncodedRequest(try codec.encode(request), on: handle)
    let response = try codec.decodeResponse(responseData)

    guard response.status == .success else {
      throw PraxisDemoHostClientError.failedRunResponse(
        response.error?.message ?? "The runtime returned an unknown runGoal failure."
      )
    }

    return response
  }

  private func drainEvents(
    using bridge: PraxisFFIBridge,
    handle: PraxisRuntimeInterfaceSessionHandle
  ) async throws -> PraxisFFIEventEnvelope {
    let eventData = try await bridge.drainEncodedEvents(for: handle)
    let eventEnvelope = try JSONDecoder().decode(PraxisFFIEventEnvelope.self, from: eventData)

    guard eventEnvelope.status == .success else {
      throw PraxisDemoHostClientError.failedEventDrain(
        eventEnvelope.error?.message ?? "The runtime returned an unknown event-drain failure."
      )
    }

    return eventEnvelope
  }
}
