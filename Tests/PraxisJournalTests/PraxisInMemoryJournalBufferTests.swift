import Testing
@testable import PraxisJournal
@testable import PraxisSession

struct PraxisInMemoryJournalBufferTests {
  @Test
  func appendNormalizesSequenceAndReadsByRunReference() async throws {
    let buffer = PraxisInMemoryJournalBuffer(flushThreshold: 2)
    let sessionID = PraxisSessionID(rawValue: "session-1")

    let cursor1 = try await buffer.append(
      .init(
        sequence: 99,
        sessionID: sessionID,
        runReference: "run-1",
        type: "run.created",
        summary: "Run created"
      )
    )
    let cursor2 = try await buffer.append(
      .init(
        sequence: 3,
        sessionID: sessionID,
        runReference: "run-1",
        type: "intent.queued",
        summary: "Intent queued"
      )
    )

    #expect(cursor1 == .init(sequence: 1))
    #expect(cursor2 == .init(sequence: 2))

    let slice = try await buffer.read(
      runReference: "run-1",
      after: .init(sequence: 1),
      limit: nil
    )

    #expect(slice.events.map(\.sequence) == [2])
    #expect(slice.events.first?.summary == "Intent queued")
    #expect(await buffer.latestEvent(runReference: "run-1")?.sequence == 2)
    #expect(await buffer.drainRequestedFlushes().count == 1)
  }
}
