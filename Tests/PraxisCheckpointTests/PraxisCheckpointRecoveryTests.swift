import Foundation
import Testing
@testable import PraxisCheckpoint
@testable import PraxisCoreTypes
@testable import PraxisJournal
@testable import PraxisSession

struct PraxisCheckpointRecoveryTests {
  @Test
  func jsonCheckpointCodecRoundTripsSnapshot() throws {
    let snapshot = PraxisCheckpointSnapshot(
      id: .init(rawValue: "checkpoint-1"),
      sessionID: .init(rawValue: "session-1"),
      tier: .durable,
      createdAt: "2026-04-10T10:00:00.000Z",
      lastCursor: .init(sequence: 3),
      payload: [
        "mode": "resume",
      ]
    )

    let codec = PraxisJSONCheckpointCodec()
    let data = try codec.encode(snapshot)
    let decoded = try codec.decode(data)

    #expect(decoded == snapshot)
  }

  @Test
  func recoveryReplaysEventsAfterCheckpointCursor() async throws {
    let sessionID = PraxisSessionID(rawValue: "session-1")
    let journal = PraxisInMemoryJournalBuffer()
    _ = try await journal.append(
      .init(sequence: 1, sessionID: sessionID, runReference: "run-1", summary: "created")
    )
    _ = try await journal.append(
      .init(sequence: 2, sessionID: sessionID, runReference: "run-1", summary: "queued")
    )
    _ = try await journal.append(
      .init(sequence: 3, sessionID: sessionID, runReference: "run-1", summary: "completed")
    )

    let snapshot = PraxisCheckpointSnapshot(
      id: .init(rawValue: "checkpoint-2"),
      sessionID: sessionID,
      lastCursor: .init(sequence: 1)
    )

    let recovery = try await PraxisCheckpointRecoveryService().recover(
      from: snapshot,
      journal: journal
    )

    #expect(recovery.pointer.checkpointID == snapshot.id)
    #expect(recovery.replayedEvents.map(\.summary) == ["queued", "completed"])
    #expect(recovery.resumeCursor == .init(sequence: 3))
  }
}
