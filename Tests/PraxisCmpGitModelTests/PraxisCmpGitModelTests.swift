import Testing
@testable import PraxisCmpGitModel
@testable import PraxisCmpTypes

struct PraxisCmpGitModelTests {
  @Test
  func gitPlannerBuildsBranchFamilyAndDirectParentPromotion() throws {
    let parent = PraxisCmpAgentLineage(
      id: .init(rawValue: "lineage-parent"),
      projectID: "project-1",
      agentID: "agent-parent",
      depth: 0,
      branchFamily: .init(
        workBranch: "work/agent-parent",
        cmpBranch: "cmp/agent-parent",
        mpBranch: "mp/agent-parent",
        tapBranch: "tap/agent-parent"
      )
    )
    let child = PraxisCmpAgentLineage(
      id: .init(rawValue: "lineage-child"),
      projectID: "project-1",
      agentID: "agent-child",
      parentAgentID: "agent-parent",
      depth: 1,
      branchFamily: .init(
        workBranch: "work/agent-child",
        cmpBranch: "cmp/agent-child",
        mpBranch: "mp/agent-child",
        tapBranch: "tap/agent-child"
      )
    )
    let delta = PraxisCmpContextDelta(
      id: .init(rawValue: "delta-1"),
      agentID: "agent-child",
      eventRefs: [.init(rawValue: "event-1")],
      changeSummary: "Captured new context",
      createdAt: "2026-04-10T00:00:00Z",
      syncIntent: .toParent
    )
    let planner = PraxisCmpGitPlanner()

    let family = planner.branchFamily(for: child)
    let candidate = planner.makeSnapshotCandidate(
      lineage: child,
      delta: delta,
      commitSha: "abc123",
      createdAt: "2026-04-10T00:01:00Z"
    )
    let pullRequest = try planner.openPromotionPullRequest(
      candidate: candidate,
      source: child,
      parent: parent,
      createdAt: "2026-04-10T00:02:00Z"
    )

    #expect(family.branches.count == 4)
    #expect(pullRequest.targetAgentID == "agent-parent")
  }

  @Test
  func gitPlannerRejectsNonPeerExchange() {
    let root = PraxisCmpAgentLineage(
      id: .init(rawValue: "root"),
      projectID: "project-1",
      agentID: "root-agent",
      depth: 0,
      branchFamily: .init(workBranch: "work/root", cmpBranch: "cmp/root", mpBranch: "mp/root", tapBranch: "tap/root")
    )
    let child = PraxisCmpAgentLineage(
      id: .init(rawValue: "child"),
      projectID: "project-1",
      agentID: "child-agent",
      parentAgentID: "root-agent",
      depth: 1,
      branchFamily: .init(workBranch: "work/child", cmpBranch: "cmp/child", mpBranch: "mp/child", tapBranch: "tap/child")
    )
    let planner = PraxisCmpGitPlanner()
    var didThrow = false

    do {
      try planner.assertPeerExchangeStaysLocal(source: root, peer: child)
    } catch {
      didThrow = true
    }
    #expect(didThrow)
  }
}
