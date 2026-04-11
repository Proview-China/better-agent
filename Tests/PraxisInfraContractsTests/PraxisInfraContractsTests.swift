import Testing
@testable import PraxisCheckpoint
@testable import PraxisCmpTypes
@testable import PraxisInfraContracts
@testable import PraxisJournal
@testable import PraxisMpTypes
@testable import PraxisSession

struct PraxisInfraContractsTests {
  @Test
  func fakeStoresRoundTripCheckpointJournalAndProjectionContracts() async throws {
    let sessionID = PraxisSessionID(rawValue: "session-1")
    let checkpointPointer = PraxisCheckpointPointer(
      checkpointID: .init(rawValue: "checkpoint-1"),
      sessionID: sessionID
    )
    let checkpointRecord = PraxisCheckpointRecord(
      pointer: checkpointPointer,
      snapshot: .init(
        id: checkpointPointer.checkpointID,
        sessionID: sessionID,
        tier: .durable,
        createdAt: "2026-04-10T20:00:00Z",
        payload: ["mode": "recovery"]
      )
    )

    let checkpointStore = PraxisFakeCheckpointStore()
    let checkpointReceipt = try await checkpointStore.save(checkpointRecord)
    let loadedCheckpoint = try await checkpointStore.load(pointer: checkpointPointer)

    #expect(checkpointReceipt.pointer == checkpointPointer)
    #expect(loadedCheckpoint == checkpointRecord)

    let journalStore = PraxisFakeJournalStore()
    let appendReceipt = try await journalStore.append(
      .init(events: [
        .init(sequence: 1, sessionID: sessionID, runReference: "run-1", summary: "ingest"),
        .init(sequence: 2, sessionID: sessionID, runReference: "run-1", summary: "materialize"),
      ])
    )
    let journalSlice = try await journalStore.read(
      .init(sessionID: sessionID.rawValue, afterCursor: .init(sequence: 1), limit: 10)
    )

    #expect(appendReceipt.appendedCount == 2)
    #expect(journalSlice.events.map(\.sequence) == [2])

    let projectionStore = PraxisFakeProjectionStore()
    _ = try await projectionStore.save(
      .init(
        projectID: "project-1",
        projectionID: .init(rawValue: "projection-1"),
        lineageID: .init(rawValue: "lineage-1"),
        agentID: "agent-1",
        visibilityLevel: .submittedToParent,
        storageKey: "sqlite://cmp/projection-1",
        updatedAt: "2026-04-10T20:01:00Z",
        summary: "Submitted parent projection"
      )
    )
    _ = try await projectionStore.save(
      .init(
        projectID: "project-1",
        projectionID: .init(rawValue: "projection-2"),
        lineageID: .init(rawValue: "lineage-2"),
        agentID: "agent-2",
        visibilityLevel: .localOnly,
        storageKey: "sqlite://cmp/projection-2",
        updatedAt: "2026-04-10T20:02:00Z",
        summary: "Local projection"
      )
    )
    let queriedDescriptors = try await projectionStore.describe(
      .init(projectID: "project-1", agentID: "agent-1")
    )

    #expect(queriedDescriptors.count == 1)
    #expect(queriedDescriptors.first?.projectionID == .init(rawValue: "projection-1"))
  }

  @Test
  func semanticMemoryStoreRoundTripsMpNativeFieldsAndFiltersBySessionID() async throws {
    let semanticMemoryStore = PraxisFakeSemanticMemoryStore()
    let sessionRecord = PraxisSemanticMemoryRecord(
      id: "memory-session",
      projectID: "project-1",
      agentID: "agent-main",
      sessionID: "session-1",
      scopeLevel: .session,
      sessionMode: .bridged,
      visibilityState: .sessionBridged,
      promotionState: .submittedToParent,
      memoryKind: .semantic,
      summary: "Session scoped workflow baseline",
      storageKey: "sqlite://mp/memory-session",
      freshnessStatus: .fresh,
      alignmentStatus: .aligned,
      sourceRefs: ["workspace://note.md"],
      tags: ["workflow", "session"],
      semanticGroupID: "group-1",
      confidence: .high,
      lineagePath: ["agent-main", "agent-parent"],
      createdAt: "2026-04-11T12:00:00Z",
      updatedAt: "2026-04-11T12:05:00Z",
      metadata: ["lane": .string("session")]
    )
    let archivedRecord = PraxisSemanticMemoryRecord(
      id: "memory-archived",
      projectID: "project-1",
      agentID: "agent-main",
      scopeLevel: .project,
      visibilityState: .archived,
      promotionState: .archived,
      memoryKind: .summary,
      summary: "Archived workflow baseline",
      storageKey: "sqlite://mp/memory-archived",
      freshnessStatus: .superseded,
      alignmentStatus: .aligned
    )

    _ = try await semanticMemoryStore.save(sessionRecord)
    _ = try await semanticMemoryStore.save(archivedRecord)

    let loaded = try await semanticMemoryStore.load(memoryID: "memory-session")
    let sessionSearch = try await semanticMemoryStore.search(
      .init(
        projectID: "project-1",
        query: "workflow baseline",
        scopeLevels: [.session, .project],
        limit: 10,
        sessionID: "session-1"
      )
    )

    #expect(loaded?.sessionID == "session-1")
    #expect(loaded?.visibilityState == .sessionBridged)
    #expect(loaded?.promotionState == .submittedToParent)
    #expect(loaded?.tags == ["session", "workflow"])
    #expect(loaded?.sourceRefs == ["workspace://note.md"])
    #expect(loaded?.confidence == .high)
    #expect(loaded?.metadata["lane"] == .string("session"))
    #expect(sessionSearch.map(\.id) == ["memory-session"])
  }

  @Test
  func projectionStoreDescribeProjectUsesLastWriteWinsSemantics() async throws {
    let projectionStore = PraxisFakeProjectionStore()
    _ = try await projectionStore.save(
      .init(
        projectID: "project-1",
        projectionID: .init(rawValue: "projection-1"),
        lineageID: .init(rawValue: "lineage-1"),
        agentID: "agent-1",
        visibilityLevel: .localOnly,
        storageKey: "sqlite://cmp/projection-1",
        summary: "Original projection"
      )
    )
    _ = try await projectionStore.save(
      .init(
        projectID: "project-1",
        projectionID: .init(rawValue: "projection-2"),
        lineageID: .init(rawValue: "lineage-2"),
        agentID: "agent-2",
        visibilityLevel: .submittedToParent,
        storageKey: "sqlite://cmp/projection-2",
        updatedAt: "2026-04-10T20:02:00Z",
        summary: "Replacement projection"
      )
    )
    _ = try await projectionStore.save(
      .init(
        projectID: "project-1",
        projectionID: .init(rawValue: "projection-3"),
        lineageID: .init(rawValue: "lineage-3"),
        agentID: "agent-3",
        visibilityLevel: .acceptedByParent,
        storageKey: "sqlite://cmp/projection-3",
        updatedAt: "2026-04-10T20:02:00Z",
        summary: "Last write should win"
      )
    )

    let latestDescriptor = try await projectionStore.describe(projectId: "project-1")

    #expect(latestDescriptor.projectionID == .init(rawValue: "projection-3"))
    #expect(latestDescriptor.summary == "Last write should win")
  }

  @Test
  func messageBusAndDeliveryTruthDoublesCaptureTraffic() async throws {
    let bus = PraxisSpyMessageBus()
    let subscription = try await bus.subscribe(topic: "cmp.peer.sync", consumerID: "dispatcher")
    let publicationReceipt = try await bus.publish(
      .init(
        messageID: "message-1",
        topic: "cmp.peer.sync",
        payloadSummary: "dispatch package-1",
        projectID: "project-1",
        publishedAt: "2026-04-10T20:10:00Z"
      )
    )

    #expect(subscription.topic == "cmp.peer.sync")
    #expect(publicationReceipt.messageID == "message-1")
    #expect(await bus.allPublishedMessages().count == 1)

    let truthStore = PraxisFakeDeliveryTruthStore()
    _ = try await truthStore.save(
      .init(
        id: "delivery-1",
        packageID: .init(rawValue: "package-1"),
        topic: "cmp.peer.sync",
        targetAgentID: "agent-2",
        status: .published,
        payloadSummary: "high-signal package",
        updatedAt: "2026-04-10T20:10:01Z"
      )
    )
    let queriedTruth = try await truthStore.lookup(
      .init(packageID: .init(rawValue: "package-1"), targetAgentID: "agent-2")
    )

    #expect(queriedTruth.count == 1)
    #expect(queriedTruth.first?.status == .published)

    let packageStore = PraxisFakeCmpContextPackageStore()
    _ = try await packageStore.save(
      .init(
        projectID: "project-1",
        packageID: .init(rawValue: "package-1"),
        sourceProjectionID: .init(rawValue: "projection-1"),
        sourceSnapshotID: .init(rawValue: "snapshot-1"),
        sourceAgentID: "agent-1",
        targetAgentID: "agent-2",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://project-1/projection-1/agent-2/runtimeFill",
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "section-1")],
        createdAt: "2026-04-10T20:10:00Z",
        updatedAt: "2026-04-10T20:10:01Z"
      )
    )
    let queriedPackages = try await packageStore.describe(
      .init(projectID: "project-1", targetAgentID: "agent-2")
    )

    #expect(queriedPackages.count == 1)
    #expect(queriedPackages.first?.status == .dispatched)

    let controlStore = PraxisFakeCmpControlStore()
    _ = try await controlStore.save(
      .init(
        projectID: "project-1",
        agentID: "agent-2",
        executionStyle: "manual",
        mode: "peer_review",
        readbackPriority: "package_first",
        fallbackPolicy: "registry_only",
        recoveryPreference: "resume_latest",
        automation: ["autoDispatch": false],
        updatedAt: "2026-04-10T20:10:02Z"
      )
    )
    let queriedControl = try await controlStore.describe(
      .init(projectID: "project-1", agentID: "agent-2")
    )

    #expect(queriedControl?.executionStyle == "manual")
    #expect(queriedControl?.automation["autoDispatch"] == false)

    let peerApprovalStore = PraxisFakeCmpPeerApprovalStore()
    _ = try await peerApprovalStore.save(
      .init(
        projectID: "project-1",
        agentID: "agent-1",
        targetAgentID: "agent-2",
        capabilityKey: "tool.git",
        requestedTier: "B1",
        tapMode: "restricted",
        riskLevel: "normal",
        route: "humanReview",
        outcome: "escalated_to_human",
        humanGateState: "waitingApproval",
        summary: "Request peer approval for tool.git",
        decisionSummary: "Capability tool.git requires human approval in restricted mode.",
        requestedAt: "2026-04-10T20:10:03Z",
        updatedAt: "2026-04-10T20:10:03Z",
        metadata: [:]
      )
    )
    let queriedPeerApproval = try await peerApprovalStore.describe(
      .init(
        projectID: "project-1",
        agentID: "agent-1",
        targetAgentID: "agent-2",
        capabilityKey: "tool.git"
      )
    )
    let allPeerApprovals = try await peerApprovalStore.describeAll(
      .init(projectID: "project-1", targetAgentID: "agent-2")
    )

    #expect(queriedPeerApproval?.route == "humanReview")
    #expect(queriedPeerApproval?.humanGateState == "waitingApproval")
    #expect(allPeerApprovals.count == 1)

    let tapEventStore = PraxisFakeTapRuntimeEventStore()
    _ = try await tapEventStore.append(
      .init(
        eventID: "tap-event-1",
        projectID: "project-1",
        agentID: "agent-1",
        targetAgentID: "agent-2",
        eventKind: "peer_approval_requested",
        capabilityKey: "tool.git",
        summary: "Peer approval requested",
        detail: "tool.git requires human review",
        createdAt: "2026-04-10T20:10:04Z",
        metadata: [
          "requestedTier": .string("B1"),
          "route": .string("humanReview"),
          "outcome": .string("escalated_to_human"),
          "humanGateState": .string("waitingApproval"),
        ]
      )
    )
    _ = try await tapEventStore.append(
      .init(
        eventID: "tap-event-2",
        projectID: "project-1",
        agentID: "agent-3",
        targetAgentID: "agent-2",
        eventKind: "peer_approval_requested",
        capabilityKey: "tool.shell",
        summary: "Peer approval requested",
        detail: "tool.shell requires human review",
        createdAt: "2026-04-10T20:10:05Z"
      )
    )
    let queriedTapEvents = try await tapEventStore.read(
      .init(projectID: "project-1", targetAgentID: "agent-2", limit: 5)
    )

    #expect(queriedTapEvents.count == 2)
    #expect(queriedTapEvents.first?.eventID == "tap-event-2")
    #expect(queriedTapEvents.last?.capabilityKey == "tool.git")
  }

  @Test
  func semanticMemoryEmbeddingAndLineageDoublesRemainDeterministic() async throws {
    let embeddingStore = PraxisFakeEmbeddingStore()
    let embeddingRecord = PraxisEmbeddingRecord(
      id: "embedding-1",
      contentSummary: "CMP delivery history",
      vectorLength: 1536,
      storageKey: "sqlite://embeddings/1"
    )
    let embeddingReceipt = try await embeddingStore.save(embeddingRecord)
    let loadedEmbedding = try await embeddingStore.load(embeddingID: "embedding-1")

    #expect(embeddingReceipt.storageKey == embeddingRecord.storageKey)
    #expect(loadedEmbedding == embeddingRecord)

    let semanticMemoryStore = PraxisFakeSemanticMemoryStore()
    _ = try await semanticMemoryStore.save(
      .init(
        id: "memory-1",
        projectID: "project-1",
        agentID: "agent-1",
        scopeLevel: .project,
        memoryKind: .semantic,
        summary: "CMP delivery baseline",
        storageKey: "sqlite://memory/1",
        freshnessStatus: .fresh,
        alignmentStatus: .aligned,
        embeddingStorageKey: embeddingRecord.storageKey
      )
    )
    _ = try await semanticMemoryStore.save(
      .init(
        id: "memory-2",
        projectID: "project-1",
        agentID: "agent-1",
        scopeLevel: .project,
        memoryKind: .summary,
        summary: "CMP delivery superseded snapshot",
        storageKey: "sqlite://memory/2",
        freshnessStatus: .superseded,
        alignmentStatus: .aligned
      )
    )
    _ = try await semanticMemoryStore.save(
      .init(
        id: "memory-3",
        projectID: "project-1",
        agentID: "agent-1",
        scopeLevel: .session,
        memoryKind: .semantic,
        summary: "CMP delivery active session details",
        storageKey: "sqlite://memory/session-1/current",
        freshnessStatus: .fresh,
        alignmentStatus: .aligned
      )
    )
    _ = try await semanticMemoryStore.save(
      .init(
        id: "memory-4",
        projectID: "project-1",
        agentID: "agent-1",
        scopeLevel: .session,
        memoryKind: .semantic,
        summary: "CMP delivery other session details",
        storageKey: "sqlite://memory/session-2/current",
        freshnessStatus: .fresh,
        alignmentStatus: .aligned
      )
    )

    let searchMatches = try await semanticMemoryStore.search(
      .init(projectID: "project-1", query: "delivery", scopeLevels: [.project], limit: 10)
    )
    let scopedMatches = try await semanticMemoryStore.search(
      .init(
        projectID: "project-1",
        query: "delivery",
        scopeLevels: [.project, .session],
        limit: 10,
        sessionID: "session-1"
      )
    )
    let bundle = try await semanticMemoryStore.bundle(
      .init(projectID: "project-1", query: "delivery", scopeLevels: [.project], limit: 10)
    )

    #expect(searchMatches.count == 2)
    #expect(scopedMatches.map(\.id) == ["memory-1", "memory-2"])
    #expect(bundle.primaryMemoryIDs == ["memory-1"])
    #expect(bundle.omittedSupersededMemoryIDs == ["memory-2"])

    let searchIndex = PraxisStubSemanticSearchIndex(
      cannedResults: [
        "delivery": [
          .init(id: "match-1", score: 0.98, contentSummary: "CMP delivery baseline", storageKey: "sqlite://memory/1")
        ]
      ]
    )
    let searchResults = try await searchIndex.search(.init(query: "delivery", limit: 5))
    #expect(searchResults.first?.id == "match-1")

    let lineageStore = PraxisStubLineageStore(
      descriptors: [
        .init(
          lineageID: .init(rawValue: "lineage-1"),
          branchRef: "cmp/agent-1",
          summary: "Primary CMP lineage"
        )
      ]
    )
    let lineageDescriptor = try await lineageStore.describe(.init(lineageID: .init(rawValue: "lineage-1")))
    #expect(lineageDescriptor?.branchRef == "cmp/agent-1")
  }
}
