import Foundation
import PraxisFFI
import PraxisRuntimeInterface

private enum AppleHostEmbeddingError: Error, LocalizedError {
  case missingArchitectureSnapshot
  case unsupportedSchemaVersion(String)
  case failedResponse(String)

  var errorDescription: String? {
    switch self {
    case .missingArchitectureSnapshot:
      return "Architecture negotiation did not return a snapshot."
    case .unsupportedSchemaVersion(let message):
      return message
    case .failedResponse(let message):
      return message
    }
  }
}

private struct NegotiatedSchemaBaseline {
  let request: PraxisRuntimeInterfaceSchemaVersion
  let response: PraxisRuntimeInterfaceSchemaVersion
  let event: PraxisRuntimeInterfaceSchemaVersion
  let acceptsLegacyVersionlessPayloads: Bool
}

private final class PraxisAppleHostEmbeddingClient {
  let bridge: PraxisFFIBridge
  let codec: PraxisJSONRuntimeInterfaceCodec
  let handle: PraxisRuntimeInterfaceSessionHandle
  let negotiatedSchema: NegotiatedSchemaBaseline

  private init(
    bridge: PraxisFFIBridge,
    codec: PraxisJSONRuntimeInterfaceCodec,
    handle: PraxisRuntimeInterfaceSessionHandle,
    negotiatedSchema: NegotiatedSchemaBaseline
  ) {
    self.bridge = bridge
    self.codec = codec
    self.handle = handle
    self.negotiatedSchema = negotiatedSchema
  }

  static func connect() async throws -> PraxisAppleHostEmbeddingClient {
    let bridge = PraxisFFIFactory.makeFFIBridge()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await bridge.openRuntimeSession()
    do {
      let requestData = try codec.encode(.inspectArchitecture)
      let responseData = try await bridge.handleEncodedRequest(requestData, on: handle)
      let response = try codec.decodeResponse(responseData)

      guard response.status == .success, let snapshot = response.snapshot else {
        throw AppleHostEmbeddingError.missingArchitectureSnapshot
      }
      guard snapshot.supportedRequestSchemaVersion == .v1,
            snapshot.supportedResponseSchemaVersion == .v1,
            snapshot.supportedEventSchemaVersion == .v1 else {
        throw AppleHostEmbeddingError.unsupportedSchemaVersion(
          "Host expected schema v1, but architecture negotiation reported request=\(snapshot.supportedRequestSchemaVersion?.rawValue ?? "nil") response=\(snapshot.supportedResponseSchemaVersion?.rawValue ?? "nil") event=\(snapshot.supportedEventSchemaVersion?.rawValue ?? "nil")."
        )
      }

      return PraxisAppleHostEmbeddingClient(
        bridge: bridge,
        codec: codec,
        handle: handle,
        negotiatedSchema: .init(
          request: .v1,
          response: .v1,
          event: .v1,
          acceptsLegacyVersionlessPayloads: snapshot.acceptsLegacyVersionlessPayloads ?? false
        )
      )
    } catch {
      _ = await bridge.closeRuntimeSession(handle)
      throw error
    }
  }

  func runGoal() async throws -> (PraxisRuntimeInterfaceResponse, PraxisFFIEventEnvelope) {
    let request = PraxisRuntimeInterfaceRequest.runGoal(
      .init(
        payloadSummary: "Run one Apple host embedding demo goal",
        goalID: "goal.apple-host-embedding",
        goalTitle: "Apple Host Embedding Demo",
        sessionID: "session.apple-host-embedding"
      )
    )
    let responseData = try await bridge.handleEncodedRequest(try codec.encode(request), on: handle)
    let response = try codec.decodeResponse(responseData)
    if response.status == .failure {
      throw AppleHostEmbeddingError.failedResponse(response.error?.message ?? "Unknown runtime interface failure.")
    }

    let eventData = try await bridge.drainEncodedEvents(for: handle)
    let eventEnvelope = try JSONDecoder().decode(PraxisFFIEventEnvelope.self, from: eventData)
    return (response, eventEnvelope)
  }

  func close() async {
    _ = await bridge.closeRuntimeSession(handle)
  }
}

@main
struct PraxisAppleHostEmbeddingExample {
  static func main() async throws {
    let client = try await PraxisAppleHostEmbeddingClient.connect()
    let (response, eventEnvelope) = try await client.runGoal()

    print("Praxis Apple Host Embedding Example")
    print("handle: \(client.handle.rawValue)")
    print("negotiated.requestSchemaVersion: \(client.negotiatedSchema.request.rawValue)")
    print("negotiated.responseSchemaVersion: \(client.negotiatedSchema.response.rawValue)")
    print("negotiated.eventSchemaVersion: \(client.negotiatedSchema.event.rawValue)")
    print("acceptsLegacyVersionlessPayloads: \(client.negotiatedSchema.acceptsLegacyVersionlessPayloads)")
    print("response.status: \(response.status.rawValue)")
    print("response.snapshot.kind: \(response.snapshot?.kind.rawValue ?? "none")")
    print("response.snapshot.sessionID: \(response.snapshot?.sessionID?.rawValue ?? "none")")
    print("response.events: \(response.events.map { $0.name.rawValue }.joined(separator: ", "))")
    print("drained.events: \(eventEnvelope.events.map { $0.name.rawValue }.joined(separator: ", "))")

    await client.close()
  }
}
