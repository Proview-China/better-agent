import Testing
@testable import PraxisCmpDelivery
@testable import PraxisCmpMqModel
@testable import PraxisCmpTypes

struct PraxisCmpMqModelTests {
  @Test
  func mqPlannerBuildsRoutingAndGuardsSubscriptions() throws {
    let planner = PraxisCmpMqPlanner()
    let source = PraxisCmpAgentLineage(
      id: .init(rawValue: "source"),
      projectID: "project-1",
      agentID: "agent-1",
      parentAgentID: "root",
      depth: 1,
      branchFamily: .init(workBranch: "work/a1", cmpBranch: "cmp/a1", mpBranch: "mp/a1", tapBranch: "tap/a1"),
      peerAgentIDs: ["agent-2"]
    )
    let peer = PraxisCmpAgentLineage(
      id: .init(rawValue: "peer"),
      projectID: "project-1",
      agentID: "agent-2",
      parentAgentID: "root",
      depth: 1,
      branchFamily: .init(workBranch: "work/a2", cmpBranch: "cmp/a2", mpBranch: "mp/a2", tapBranch: "tap/a2"),
      peerAgentIDs: ["agent-1"]
    )
    let package = PraxisCmpContextPackage(
      id: .init(rawValue: "package-1"),
      sourceProjectionID: .init(rawValue: "projection-1"),
      sourceAgentID: "agent-1",
      targetAgentID: "agent-2",
      kind: .peerExchange,
      packageRef: "pkg://peer",
      fidelityLabel: .summary,
      createdAt: "2026-04-10T00:00:00Z"
    )
    let plan = PraxisDeliveryPlan(
      contextPackage: package,
      instructions: [
        .init(
          packageID: package.id,
          sourceAgentID: "agent-1",
          targetAgentID: "agent-2",
          targetKind: .peer,
          reason: "share peer summary",
          summary: "share peer summary"
        )
      ]
    )
    let routing = planner.routingPlan(for: plan, projectID: "project-1")

    try planner.validateSubscription(source: source, target: peer, relation: .peer)
    #expect(routing.destinationTopics.first?.channel == .peer)
    #expect(routing.destinationTopics.first?.neighborhoods == [.peer])
  }
}
