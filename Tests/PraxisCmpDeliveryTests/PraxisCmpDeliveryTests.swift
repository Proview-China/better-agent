import Testing
@testable import PraxisCoreTypes
@testable import PraxisCmpDelivery
@testable import PraxisCmpTypes

struct PraxisCmpDeliveryTests {
  @Test
  func deliveryPlannerRejectsBackwardActiveLineAndPrefersPackagesForHistory() throws {
    let planner = PraxisDeliveryPlanner()
    let line = PraxisCmpActiveLineRecord(
      lineageID: .init(rawValue: "lineage-1"),
      stage: .checkedReady,
      updatedAt: "2026-04-10T00:00:00Z"
    )

    var didThrow = false
    do {
      _ = try planner.advance(line, to: .captured, updatedAt: "2026-04-10T00:01:00Z")
    } catch {
      didThrow = true
    }
    #expect(didThrow)

    let package = PraxisCmpContextPackage(
      id: .init(rawValue: "package-1"),
      sourceProjectionID: .init(rawValue: "projection-1"),
      sourceSnapshotID: .init(rawValue: "snapshot-1"),
      sourceAgentID: "agent-1",
      targetAgentID: "agent-2",
      kind: .historicalReply,
      packageRef: "pkg://1",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-10T00:02:00Z"
    )
    let snapshot = PraxisCmpCheckedSnapshot(
      id: .init(rawValue: "snapshot-1"),
      lineageID: .init(rawValue: "lineage-1"),
      agentID: "agent-1",
      branchRef: "cmp/agent-1",
      commitRef: "abc123",
      checkedAt: "2026-04-10T00:01:00Z",
      qualityLabel: .usable,
      promotable: true,
      sourceDeltaRefs: [.init(rawValue: "delta-1")]
    )
    let response = planner.requestHistoricalContext(
      .init(
        requesterAgentID: "agent-2",
        projectID: "project-1",
        reason: "Need parent summary",
        query: .init(snapshotID: .init(rawValue: "snapshot-1"), packageKindHint: .historicalReply)
      ),
      snapshots: [snapshot],
      packages: [package]
    )

    #expect(response.found)
    #expect(response.contextPackage?.id == package.id)
  }

  @Test
  func historicalContextRespectsLineageBranchAndVisibilityHints() {
    let planner = PraxisDeliveryPlanner()
    let matchingSnapshot = PraxisCmpCheckedSnapshot(
      id: .init(rawValue: "snapshot-matching"),
      lineageID: .init(rawValue: "lineage-1"),
      agentID: "agent-1",
      branchRef: "cmp/agent-1",
      commitRef: "abc123",
      checkedAt: "2026-04-10T00:01:00Z",
      qualityLabel: .highSignal,
      promotable: true,
      sourceDeltaRefs: [.init(rawValue: "delta-1")]
    )
    let unrelatedSnapshot = PraxisCmpCheckedSnapshot(
      id: .init(rawValue: "snapshot-unrelated"),
      lineageID: .init(rawValue: "lineage-2"),
      agentID: "agent-1",
      branchRef: "cmp/agent-1-other",
      commitRef: "def456",
      checkedAt: "2026-04-10T00:02:00Z",
      qualityLabel: .highSignal,
      promotable: true,
      sourceDeltaRefs: [.init(rawValue: "delta-2")]
    )
    let unrelatedPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "package-unrelated"),
      sourceProjectionID: .init(rawValue: "projection-2"),
      sourceSnapshotID: unrelatedSnapshot.id,
      sourceAgentID: "agent-1",
      targetAgentID: "agent-2",
      kind: .historicalReply,
      packageRef: "pkg://2",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-10T00:03:00Z",
      metadata: [
        "projection_visibility": .string(PraxisCmpProjectionVisibilityLevel.promotedByParent.rawValue),
      ]
    )
    let matchingPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "package-matching"),
      sourceProjectionID: .init(rawValue: "projection-1"),
      sourceSnapshotID: matchingSnapshot.id,
      sourceAgentID: "agent-1",
      targetAgentID: "agent-2",
      kind: .historicalReply,
      packageRef: "pkg://1",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-10T00:04:00Z",
      metadata: [
        "projection_visibility": .string(PraxisCmpProjectionVisibilityLevel.promotedByParent.rawValue),
      ]
    )

    let resolved = planner.requestHistoricalContext(
      .init(
        requesterAgentID: "agent-2",
        projectID: "project-1",
        reason: "Need parent lineage summary",
        query: .init(
          lineageID: .init(rawValue: "lineage-1"),
          branchRef: "cmp/agent-1",
          packageKindHint: .historicalReply,
          projectionVisibilityHint: .promotedByParent
        )
      ),
      snapshots: [matchingSnapshot, unrelatedSnapshot],
      packages: [unrelatedPackage, matchingPackage]
    )

    let missingVisibilityMetadata = planner.requestHistoricalContext(
      .init(
        requesterAgentID: "agent-2",
        projectID: "project-1",
        reason: "Need parent lineage summary",
        query: .init(
          lineageID: .init(rawValue: "lineage-1"),
          branchRef: "cmp/agent-1",
          packageKindHint: .historicalReply,
          projectionVisibilityHint: .promotedByParent
        )
      ),
      snapshots: [matchingSnapshot],
      packages: [
        PraxisCmpContextPackage(
          id: .init(rawValue: "package-no-visibility"),
          sourceProjectionID: .init(rawValue: "projection-3"),
          sourceSnapshotID: matchingSnapshot.id,
          sourceAgentID: "agent-1",
          targetAgentID: "agent-2",
          kind: .historicalReply,
          packageRef: "pkg://3",
          fidelityLabel: .highSignal,
          createdAt: "2026-04-10T00:05:00Z"
        )
      ]
    )

    #expect(resolved.contextPackage?.id == matchingPackage.id)
    #expect(resolved.snapshot?.id == matchingSnapshot.id)
    #expect(missingVisibilityMetadata.contextPackage == nil)
    #expect(missingVisibilityMetadata.snapshot?.id == matchingSnapshot.id)
  }
}
