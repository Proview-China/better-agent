import Testing
import PraxisMpMemory
import PraxisMpTypes

struct PraxisMpMemoryTests {
  @Test
  func alignmentServiceSupersedesOlderRelatedRecords() {
    let scope = PraxisMpScopeDescriptor(
      projectID: "project.mp.memory",
      agentID: "main",
      scopeLevel: .project
    )
    let older = PraxisMpMemoryRecord(
      id: "memory.old",
      scope: scope,
      summary: "team sync status",
      storageKey: "memory/old",
      freshness: .init(status: .fresh),
      alignment: .init(status: .aligned),
      semanticGroupID: "semantic:sync-status",
      createdAt: "2026-04-08T00:00:00Z",
      updatedAt: "2026-04-08T00:00:00Z"
    )
    let candidate = PraxisMpMemoryRecord(
      id: "memory.new",
      scope: scope,
      summary: "team sync status",
      storageKey: "memory/new",
      freshness: .init(status: .fresh),
      alignment: .init(status: .unreviewed),
      semanticGroupID: "semantic:sync-status",
      createdAt: "2026-04-09T00:00:00Z",
      updatedAt: "2026-04-09T00:00:00Z"
    )

    let result = PraxisMpMemoryAlignmentService().align(
      candidate: candidate,
      relatedRecords: [older],
      alignedAt: "2026-04-09T00:05:00Z"
    )

    #expect(result.primary.id == "memory.new")
    #expect(result.supersededMemoryIDs == ["memory.old"])
    #expect(result.updatedRecords.contains { $0.id == "memory.old" && $0.freshness.status == .superseded })
    #expect(result.decisionOutput.decision == .supersedeExisting)
  }

  @Test
  func workflowBundleServiceOmitsSupersededRecordsAndTracksRerankComposition() {
    let scope = PraxisMpScopeDescriptor(projectID: "project.mp.memory", agentID: "main")
    let fresh = PraxisMpMemoryRecord(
      id: "memory.fresh",
      scope: scope,
      summary: "fresh record",
      storageKey: "memory/fresh",
      freshness: .init(status: .fresh),
      alignment: .init(status: .aligned)
    )
    let aging = PraxisMpMemoryRecord(
      id: "memory.aging",
      scope: scope,
      summary: "aging record",
      storageKey: "memory/aging",
      freshness: .init(status: .aging),
      alignment: .init(status: .unreviewed)
    )
    let superseded = PraxisMpMemoryRecord(
      id: "memory.superseded",
      scope: scope,
      summary: "superseded record",
      storageKey: "memory/superseded",
      freshness: .init(status: .superseded),
      alignment: .init(status: .aligned)
    )

    let bundle = PraxisMpWorkflowBundleService().assemble(
      scope: scope,
      orderedRecords: [fresh, aging, superseded],
      limit: 5
    )

    #expect(bundle.primary.map(\.id) == ["memory.fresh"])
    #expect(bundle.supporting.map(\.id) == ["memory.aging"])
    #expect(bundle.diagnostics.omittedSupersededMemoryIDs == ["memory.superseded"])
    #expect(bundle.diagnostics.rerankComposition.fresh == 1)
    #expect(bundle.diagnostics.rerankComposition.superseded == 1)
  }

  @Test
  func governanceServicePromotesScopedMemoryAcrossParentAndProjectStates() throws {
    let scope = PraxisMpScopeDescriptor(
      projectID: "project.mp.memory",
      agentID: "main",
      sessionID: "session.main",
      scopeLevel: .agentIsolated,
      sessionMode: .bridged,
      visibilityState: .sessionBridged,
      promotionState: .submittedToParent,
      lineagePath: ["agent.main"]
    )
    let record = PraxisMpMemoryRecord(
      id: "memory.promote",
      scope: scope,
      summary: "promotable record",
      storageKey: "memory/promote",
      memoryKind: .semantic,
      metadata: ["seed": .string("true")]
    )

    let accepted = try PraxisMpMemoryGovernanceService().promote(
      record: record,
      targetPromotionState: .acceptedByParent,
      targetSessionID: "session.main",
      changedAt: "2026-04-11T10:05:00Z",
      reason: "Parent accepted this memory."
    )
    let project = try PraxisMpMemoryGovernanceService().promote(
      record: accepted,
      targetPromotionState: .promotedToProject,
      changedAt: "2026-04-11T10:10:00Z",
      reason: "Project summary stabilized."
    )

    #expect(accepted.scope.scopeLevel == .agentIsolated)
    #expect(accepted.scope.sessionMode == .bridged)
    #expect(accepted.scope.visibilityState == .sessionBridged)
    #expect(accepted.scope.promotionState == .acceptedByParent)
    #expect(accepted.metadata["lastPromotionState"] == .string("submitted_to_parent"))
    #expect(accepted.metadata["promotionTargetState"] == .string("accepted_by_parent"))
    #expect(project.scope.scopeLevel == .project)
    #expect(project.scope.sessionMode == .shared)
    #expect(project.scope.visibilityState == .projectShared)
    #expect(project.scope.promotionState == .promotedToProject)
    #expect(project.updatedAt == "2026-04-11T10:10:00Z")
    #expect(project.metadata["lastPromotionState"] == .string("accepted_by_parent"))
  }

  @Test
  func governanceServiceArchivesMemoryWithoutDroppingScopeIdentity() throws {
    let scope = PraxisMpScopeDescriptor(
      projectID: "project.mp.memory",
      agentID: "main",
      scopeLevel: .project,
      sessionMode: .shared,
      visibilityState: .projectShared,
      promotionState: .promotedToProject,
      lineagePath: ["agent.main", "project"]
    )
    let record = PraxisMpMemoryRecord(
      id: "memory.archive",
      scope: scope,
      summary: "archive me",
      storageKey: "memory/archive",
      memoryKind: .summary
    )

    let archived = try PraxisMpMemoryGovernanceService().archive(
      record: record,
      archivedAt: "2026-04-11T10:20:00Z",
      reason: "Superseded by a newer summary."
    )

    #expect(archived.scope.scopeLevel == .project)
    #expect(archived.scope.sessionMode == .shared)
    #expect(archived.scope.visibilityState == .archived)
    #expect(archived.scope.promotionState == .archived)
    #expect(archived.scope.lineagePath == ["agent.main", "project"])
    #expect(archived.updatedAt == "2026-04-11T10:20:00Z")
    #expect(archived.metadata["lastPromotionState"] == .string("promoted_to_project"))
    #expect(archived.metadata["promotionTargetState"] == .string("archived"))
  }

  @Test
  func maintenanceServiceSplitsOneMemoryIntoDerivedChunksWithAncestry() throws {
    let scope = PraxisMpScopeDescriptor(
      projectID: "project.mp.memory",
      agentID: "main",
      scopeLevel: .agentIsolated
    )
    let source = PraxisMpMemoryRecord(
      id: "memory.source",
      scope: scope,
      summary: "source memory",
      storageKey: "memory/source",
      memoryKind: .semantic,
      sourceRefs: ["payload-a", "payload-b", "payload-c"],
      tags: ["history"],
      ancestry: .init(parentMemoryID: "memory.root", mergedFromIDs: ["memory.peer"]),
      createdAt: "2026-04-11T10:00:00Z",
      updatedAt: "2026-04-11T10:00:00Z",
      metadata: ["seed": .string("true")]
    )

    let split = try PraxisMpMemoryMaintenanceService().split(
      sourceRecord: source,
      split: .init(
        sourceMemoryID: "memory.source",
        sourceAgentID: "main",
        targetChunkCount: 2,
        splitReason: "Need smaller semantic chunks.",
        createdAt: "2026-04-11T10:05:00Z"
      )
    )

    #expect(split.records.count == 2)
    #expect(split.result.sourceMemoryID == "memory.source")
    #expect(split.result.derivedMemoryIDs == ["memory.source:split:0", "memory.source:split:1"])
    #expect(split.records[0].ancestry?.parentMemoryID == "memory.source")
    #expect(split.records[0].ancestry?.derivedFromIDs == ["memory.source"])
    #expect(split.records[1].ancestry?.splitFromIDs == ["memory.source"])
    #expect(split.records[0].ancestry?.mergedFromIDs == ["memory.peer"])
    #expect(split.records[0].metadata["splitReason"] == .string("Need smaller semantic chunks."))
    #expect(split.records[0].sourceRefs.isEmpty == false)
    #expect(split.records[1].sourceRefs.isEmpty == false)
    #expect(split.records[0].storageKey == "memory/source#chunk-0")
    #expect(split.records[1].storageKey == "memory/source#chunk-1")
  }

  @Test
  func maintenanceServiceMergesSiblingMemoriesIntoBundleWithoutArchivingSources() throws {
    let scope = PraxisMpScopeDescriptor(
      projectID: "project.mp.memory",
      agentID: "main",
      scopeLevel: .project
    )
    let sourceA = PraxisMpMemoryRecord(
      id: "memory.a",
      scope: scope,
      summary: "alpha summary",
      storageKey: "memory/a",
      memoryKind: .summary,
      confidence: .medium,
      sourceRefs: ["payload-a"],
      tags: ["history"],
      ancestry: .init(splitFromIDs: ["memory.root"]),
      createdAt: "2026-04-11T10:00:00Z",
      updatedAt: "2026-04-11T10:00:00Z",
      metadata: ["seed": .string("true")]
    )
    let sourceB = PraxisMpMemoryRecord(
      id: "memory.b",
      scope: scope,
      summary: "beta summary",
      storageKey: "memory/b",
      memoryKind: .summary,
      confidence: .high,
      sourceRefs: ["payload-b"],
      tags: ["shared"],
      ancestry: .init(splitFromIDs: ["memory.root"]),
      createdAt: "2026-04-11T10:01:00Z",
      updatedAt: "2026-04-11T10:01:00Z"
    )

    let merge = try PraxisMpMemoryMaintenanceService().merge(
      sourceRecords: [sourceA, sourceB],
      merge: .init(
        sourceMemoryIDs: ["memory.a", "memory.b"],
        mergedMemoryID: "memory.merged",
        targetAgentID: "main",
        mergeReason: "Collapse sibling memories.",
        createdAt: "2026-04-11T10:10:00Z"
      )
    )

    #expect(merge.record.id == "memory.merged")
    #expect(merge.record.storageKey == "bundle:memory.merged")
    #expect(merge.record.confidence == .high)
    #expect(merge.record.sourceRefs == ["payload-a", "payload-b"])
    #expect(merge.record.tags == ["history", "shared"])
    #expect(merge.record.ancestry?.parentMemoryID == "memory.a")
    #expect(merge.record.ancestry?.mergedFromIDs == ["memory.a", "memory.b"])
    #expect(merge.record.ancestry?.splitFromIDs == ["memory.root"])
    #expect(merge.record.metadata["mergeReason"] == .string("Collapse sibling memories."))
    #expect(merge.bundle.bundleID == "bundle:memory.merged")
    #expect(merge.bundle.memberMemoryIDs == ["memory.a", "memory.b"])
    #expect(merge.bundle.scope == scope)
    #expect(merge.result.mergedMemoryID == "memory.merged")
    #expect(merge.result.sourceMemoryIDs == ["memory.a", "memory.b"])
  }

  @Test
  func readbackProjectionServiceBuildsBreakdownsFromMpRecords() {
    let localScope = PraxisMpScopeDescriptor(projectID: "project.mp.memory", agentID: "main")
    let projectScope = PraxisMpScopeDescriptor(projectID: "project.mp.memory", agentID: "main", scopeLevel: .project)
    let records = [
      PraxisMpMemoryRecord(
        id: "memory.fresh",
        scope: localScope,
        summary: "fresh",
        storageKey: "memory/fresh",
        freshness: .init(status: .fresh),
        alignment: .init(status: .aligned)
      ),
      PraxisMpMemoryRecord(
        id: "memory.aging",
        scope: projectScope,
        summary: "aging",
        storageKey: "memory/aging",
        freshness: .init(status: .aging),
        alignment: .init(status: .unreviewed)
      ),
    ]

    let projection = PraxisMpReadbackProjectionService().project(
      records: records,
      primaryCount: 1,
      supportingCount: 1,
      omittedSupersededCount: 2
    )

    #expect(projection.summary == "MP readback reconstructed 2 memory record(s), 1 primary bundle members, and 2 omitted superseded record(s).")
    #expect(projection.totalMemoryCount == 2)
    #expect(projection.freshnessBreakdown["fresh"] == 1)
    #expect(projection.freshnessBreakdown["aging"] == 1)
    #expect(projection.alignmentBreakdown["aligned"] == 1)
    #expect(projection.alignmentBreakdown["unreviewed"] == 1)
    #expect(projection.scopeBreakdown["agent_isolated"] == 1)
    #expect(projection.scopeBreakdown["project"] == 1)
  }
}
