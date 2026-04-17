import Foundation

/// Captures the minimal UI-facing evidence returned by one demo host run.
///
/// This snapshot is limited to contract-level fields the demo window needs to prove:
/// negotiated schema versions, session/session-handle identity, response status, and drained
/// event names. It does not expose the full runtime interface payload surface.
struct DemoHostRunSnapshot: Sendable, Equatable {
  let negotiatedRequestSchemaVersion: String
  let negotiatedResponseSchemaVersion: String
  let negotiatedEventSchemaVersion: String
  let sessionHandle: String
  let responseStatus: String
  let snapshotKind: String
  let sessionID: String
  let drainedEventNames: [String]
}
