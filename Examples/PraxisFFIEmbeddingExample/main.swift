import Foundation
import PraxisFFI
import PraxisRuntimeInterface

@main
struct PraxisFFIEmbeddingExample {
  static func main() async throws {
    let bridge = PraxisFFIFactory.makeFFIBridge()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await bridge.openRuntimeSession()

    let request = PraxisRuntimeInterfaceRequest.runGoal(
      .init(
        payloadSummary: "Run one embedded FFI demo goal",
        goalID: "goal.ffi-embedding",
        goalTitle: "FFI Embedding Demo",
        sessionID: "session.ffi-embedding"
      )
    )

    let requestData = try codec.encode(request)
    let responseData = try await bridge.handleEncodedRequest(requestData, on: handle)
    let response = try codec.decodeResponse(responseData)
    let eventData = try await bridge.drainEncodedEvents(for: handle)
    let eventEnvelope = try JSONDecoder().decode(PraxisFFIEventEnvelope.self, from: eventData)

    print("Praxis FFI Embedding Example")
    print("requestSchemaVersion: \(request.requestSchemaVersion.rawValue)")
    print("responseSchemaVersion: \(response.responseSchemaVersion.rawValue)")
    print("eventSchemaVersion: \(eventEnvelope.eventSchemaVersion.rawValue)")
    print("handle: \(handle.rawValue)")
    print("response.status: \(response.status.rawValue)")
    print("response.snapshot.kind: \(response.snapshot?.kind.rawValue ?? "none")")
    print("response.snapshot.sessionID: \(response.snapshot?.sessionID?.rawValue ?? "none")")
    print("response.events: \(response.events.map { $0.name.rawValue }.joined(separator: ", "))")
    print("drained.events: \(eventEnvelope.events.map { $0.name.rawValue }.joined(separator: ", "))")

    _ = await bridge.closeRuntimeSession(handle)
  }
}
