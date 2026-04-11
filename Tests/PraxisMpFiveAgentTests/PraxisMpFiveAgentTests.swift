import Testing
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes

struct PraxisMpFiveAgentTests {
  @Test
  func fiveAgentRuntimeIngestsAndResolvesFresherMemoryFirst() async {
    let runtime = PraxisMpFiveAgentRuntime()
    let projectID = "project.mp.five-agent"
    let scope = PraxisMpScopeDescriptor(
      projectID: projectID,
      agentID: "main",
      scopeLevel: .project
    )

    let oldResult = await runtime.ingest(
      .init(
        projectID: projectID,
        artifact: .init(
          id: "old",
          projectID: projectID,
          agentID: "main",
          storageRef: "memory/old",
          persistedAt: "2026-04-08T00:00:00Z",
          summary: "team sync status",
          semanticGroupID: "semantic:sync-status",
          tags: ["sync", "status"]
        ),
        checkedSnapshotRef: "snapshot-old",
        branchRef: "mp/main",
        scope: scope,
        observedAt: "2026-04-08T00:00:00Z",
        sourceRefs: ["source:sync-status"]
      )
    )
    let newResult = await runtime.ingest(
      .init(
        projectID: projectID,
        artifact: .init(
          id: "new",
          projectID: projectID,
          agentID: "main",
          storageRef: "memory/new",
          persistedAt: "2026-04-09T00:00:00Z",
          summary: "team sync status",
          semanticGroupID: "semantic:sync-status",
          tags: ["sync", "status"]
        ),
        checkedSnapshotRef: "snapshot-new",
        branchRef: "mp/main",
        scope: scope,
        observedAt: "2026-04-09T00:00:00Z",
        sourceRefs: ["source:sync-status"]
      )
    )

    let resolved = await runtime.resolve(
      .init(
        projectID: projectID,
        queryText: "sync status",
        requesterLineage: .init(projectID: projectID, agentID: "main", depth: 0),
        sourceLineages: [
          "main": .init(projectID: projectID, agentID: "main", depth: 0)
        ]
      )
    )
    let summary = await runtime.summary()

    #expect(oldResult.records.first?.freshness.status == .fresh)
    #expect(newResult.alignment.supersededMemoryIDs == ["memory.old"])
    #expect(resolved.bundle.primary.first?.id == "memory.new")
    #expect(summary.quality.supersededMemoryCount == 1)
    #expect(summary.roleCounts[.dispatcher] == 1)
  }

  @Test
  func fiveAgentRuntimeHistoryIncrementsPassiveReturnCount() async {
    let runtime = PraxisMpFiveAgentRuntime()
    let projectID = "project.mp.history"
    let scope = PraxisMpScopeDescriptor(projectID: projectID, agentID: "main")

    _ = await runtime.ingest(
      .init(
        projectID: projectID,
        artifact: .init(
          id: "history",
          projectID: projectID,
          agentID: "main",
          storageRef: "memory/history",
          persistedAt: "2026-04-08T00:00:00Z",
          summary: "history answer"
        ),
        checkedSnapshotRef: "snapshot-history",
        branchRef: "mp/main",
        scope: scope
      )
    )

    let history = await runtime.requestHistory(
      .init(
        projectID: projectID,
        queryText: "history answer",
        requesterLineage: .init(projectID: projectID, agentID: "main", depth: 0),
        sourceLineages: [
          "main": .init(projectID: projectID, agentID: "main", depth: 0)
        ]
      )
    )
    let summary = await runtime.summary()

    #expect(history.bundle.primary.first?.id == "memory.history")
    #expect(summary.flow.passiveReturnCount == 1)
    #expect(summary.capabilityMatrix.retrievalOwners == [.dispatcher])
  }
}
