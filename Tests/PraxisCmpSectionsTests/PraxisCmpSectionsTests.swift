import Testing
@testable import PraxisCmpSections
@testable import PraxisCmpTypes

struct PraxisCmpSectionsTests {
  @Test
  func builderCreatesOneSectionPerMaterialAndLowersToGit() {
    let lineage = PraxisCmpAgentLineage(
      id: .init(rawValue: "lineage-1"),
      projectID: "project-1",
      agentID: "agent-1",
      depth: 0,
      branchFamily: .init(
        workBranch: "work/agent-1",
        cmpBranch: "cmp/agent-1",
        mpBranch: "mp/agent-1",
        tapBranch: "tap/agent-1"
      )
    )
    let input = PraxisIngestRuntimeContextInput(
      agentID: "agent-1",
      projectID: "project-1",
      sessionID: "session-1",
      lineage: lineage,
      taskSummary: "Ingest a pair of materials",
      materials: [
        .init(kind: .userInput, ref: "payload:user"),
        .init(kind: .contextPackage, ref: "payload:package"),
      ]
    )
    let builder = PraxisSectionBuilder()

    let ingress = builder.buildIngressRecord(
      from: input,
      requestID: .init(rawValue: "request-1"),
      createdAt: "2026-04-10T00:00:00Z"
    )
    let lowered = builder.lower(ingress, with: builder.defaultRulePack())

    #expect(ingress.sections.count == 2)
    #expect(lowered.first?.storedSection?.plane == .git)
    #expect(lowered.last?.storedSection?.plane == .db)
  }
}
