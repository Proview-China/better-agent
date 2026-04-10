import Testing
@testable import PraxisCmpTypes

struct PraxisCmpTypesTests {
  @Test
  func validatorAcceptsStableIngressAndLineageContract() throws {
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
      taskSummary: "Summarize current runtime input",
      materials: [
        .init(kind: .userInput, ref: "payload:user:1"),
        .init(kind: .toolResult, ref: "payload:tool:1"),
      ],
      requiresActiveSync: true
    )

    try PraxisCmpInterfaceValidator().validate(lineage)
    try PraxisCmpInterfaceValidator().validate(input)
    #expect(input.materials.count == 2)
    #expect(lineage.branchFamily.cmpBranch == "cmp/agent-1")
  }

  @Test
  func validatorRejectsNonRootLineageWithoutParent() {
    let lineage = PraxisCmpAgentLineage(
      id: .init(rawValue: "lineage-2"),
      projectID: "project-1",
      agentID: "agent-2",
      depth: 1,
      branchFamily: .init(
        workBranch: "work/agent-2",
        cmpBranch: "cmp/agent-2",
        mpBranch: "mp/agent-2",
        tapBranch: "tap/agent-2"
      )
    )

    var didThrow = false
    do {
      try PraxisCmpInterfaceValidator().validate(lineage)
    } catch {
      didThrow = true
    }
    #expect(didThrow)
  }
}
