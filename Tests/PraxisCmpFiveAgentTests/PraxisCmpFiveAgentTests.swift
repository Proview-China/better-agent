import Testing
@testable import PraxisCmpFiveAgent
@testable import PraxisCmpSections
@testable import PraxisCmpTypes

struct PraxisCmpFiveAgentTests {
  @Test
  func plannerBuildsCanonicalProtocolAndSummary() async {
    let planner = PraxisCmpFiveAgentPlanner()
    let definition = planner.defaultProtocolDefinition()
    let snapshot = planner.runtimeSnapshot(
      records: [
        .init(role: .icma, stage: "capture"),
        .init(role: .dbAgent, stage: "materialize", sourceSnapshotID: .init(rawValue: "snapshot-1")),
      ],
      handOffs: definition.handOffRules,
      traces: [
        .init(
          attemptID: "attempt-1",
          role: .icma,
          mode: .llmAssisted,
          status: .fallback,
          provider: "openai",
          model: "gpt-5.4",
          createdAt: "2026-04-10T00:00:00Z",
          fallbackApplied: true
        )
      ]
    )
    let summary = planner.summarize(snapshot)
    let coordinator = PraxisFiveAgentCoordinator(protocolDefinition: definition)

    await coordinator.assign(.init(role: .icma, sectionIDs: [.init(rawValue: "section-1")]))
    let accepts = await coordinator.accepts(definition.handOffRules[0])

    #expect(definition.roles.count == 5)
    #expect(summary.liveSummary[.icma]?.fallbackApplied == true)
    #expect(accepts)
  }
}
