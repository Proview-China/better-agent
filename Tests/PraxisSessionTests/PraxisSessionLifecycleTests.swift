import Testing
@testable import PraxisCoreTypes
@testable import PraxisSession

struct PraxisSessionLifecycleTests {
  @Test
  func attachRunAndMarkCheckpointUpdateSessionHeader() {
    let service = PraxisSessionLifecycleService()
    let header = service.createHeader(
      id: .init(rawValue: "session-1"),
      title: "Main Session",
      metadata: ["entry": "cli"]
    )

    let attached = service.attachRun("run-1", to: header)
    let checkpointed = service.markCheckpoint(
      "checkpoint-1",
      on: attached,
      journalSequence: 12
    )

    #expect(checkpointed.activeRunReference == "run-1")
    #expect(checkpointed.runReferences == ["run-1"])
    #expect(checkpointed.lastCheckpointReference == "checkpoint-1")
    #expect(checkpointed.lastJournalSequence == 12)
    #expect(checkpointed.metadata?["entry"]?.stringValue == "cli")
  }

  @Test
  func registryPersistsTemperatureTransitions() async {
    let registry = PraxisSessionRegistry()
    let created = await registry.create(
      id: .init(rawValue: "session-2"),
      title: "Archivable Session"
    )

    #expect(created.temperature == .hot)

    let cooled = await registry.transitionSession(
      id: created.id,
      to: .cold,
      coldStorageReference: "cold:session-2"
    )

    #expect(cooled?.temperature == .cold)
    #expect(cooled?.coldStorageReference == "cold:session-2")
    #expect(await registry.session(id: created.id)?.temperature == .cold)
  }
}
