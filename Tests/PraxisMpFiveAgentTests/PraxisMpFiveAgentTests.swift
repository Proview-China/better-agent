import Foundation
import Testing
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes

struct PraxisMpFiveAgentTests {
  @Test
  func roleStageMapRejectsManualInvalidRoleStageCombination() throws {
    #expect(throws: PraxisMpRoleStageMap.ValidationError.self) {
      _ = try PraxisMpRoleStageMap(validating: [.dispatcher: .capture])
    }
  }

  @Test
  func roleStageMapRoundTripsOnlyValidRoleStageCombinations() throws {
    let map = try PraxisMpRoleStageMap(validating: [.dispatcher: .assembleBundle])
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]

    let encoded = try #require(String(data: try encoder.encode(map), encoding: .utf8))
    let decoded = try JSONDecoder().decode(PraxisMpRoleStageMap.self, from: Data(encoded.utf8))

    #expect(encoded == #"{"dispatcher":"assemble_bundle"}"#)
    #expect(decoded[.dispatcher] == .assembleBundle)
  }

  @Test
  func fiveAgentRuntimeStateRoundTripsTypedLatestStagesAndRejectsInvalidPayload() throws {
    let state = PraxisMpFiveAgentRuntimeState(
      roleCounts: [.dispatcher: 1],
      latestStages: try PraxisMpRoleStageMap(validating: [.dispatcher: .search]),
      latestRoleMetadata: [:],
      pendingAlignmentCount: 0,
      pendingSupersedeCount: 0,
      passiveReturnCount: 0,
      records: [],
      dedupeDecisionCount: 0,
      ingestCount: 0,
      rerankComposition: PraxisMpRerankComposition()
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]

    let encodedData = try encoder.encode(state)
    let decoded = try JSONDecoder().decode(PraxisMpFiveAgentRuntimeState.self, from: encodedData)
    let encoded = try #require(String(data: encodedData, encoding: .utf8))
    let invalid = encoded.replacingOccurrences(of: "\"search\"", with: "\"capture\"")

    #expect(decoded.latestStages[.dispatcher] == .search)
    #expect(throws: DecodingError.self) {
      _ = try JSONDecoder().decode(
        PraxisMpFiveAgentRuntimeState.self,
        from: Data(invalid.utf8)
      )
    }
  }

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
    let state = await runtime.state()

    let typedSummaryStages: PraxisMpRoleStageMap = summary.latestStages
    let typedStateStages: PraxisMpRoleStageMap = state.latestStages

    #expect(oldResult.records.first?.freshness.status == .fresh)
    #expect(newResult.alignment.supersededMemoryIDs == ["memory.old"])
    #expect(resolved.bundle.primary.first?.id == "memory.new")
    #expect(summary.quality.supersededMemoryCount == 1)
    #expect(summary.roleCounts[.dispatcher] == 1)
    #expect(typedSummaryStages[.dispatcher] == .assembleBundle)
    #expect(typedStateStages[.checker] == .judgeAlignment)
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
