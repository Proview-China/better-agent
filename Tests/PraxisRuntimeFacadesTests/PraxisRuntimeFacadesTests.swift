import Foundation
import Testing
import PraxisCapabilityContracts
import PraxisCmpFiveAgent
import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisCapabilityResults
import PraxisGoal
import PraxisInfraContracts
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpTypes
import PraxisProviderContracts
import PraxisRuntimeComposition
import PraxisRuntimeFacades
import PraxisRuntimeGateway
import PraxisRuntimeUseCases
import PraxisSession
import PraxisTapReview
import PraxisTapTypes
import PraxisToolingContracts

private func capabilityID(_ rawValue: String) -> PraxisCapabilityID {
  PraxisCapabilityID(rawValue: rawValue)
}

private struct StubSemanticMemoryStore: PraxisSemanticMemoryStoreContract {
  let bundleResult: PraxisSemanticMemoryBundle
  let searchResults: [PraxisSemanticMemoryRecord]

  init(
    bundleResult: PraxisSemanticMemoryBundle,
    searchResults: [PraxisSemanticMemoryRecord] = []
  ) {
    self.bundleResult = bundleResult
    self.searchResults = searchResults
  }

  func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt {
    PraxisSemanticMemoryWriteReceipt(memoryID: record.id, storageKey: record.storageKey)
  }

  func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord? {
    nil
  }

  func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord] {
    Array(searchResults.prefix(request.limit))
  }

  func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle {
    bundleResult
  }
}

private enum FacadeTestJSONError: Error {
  case invalidUTF8
}

private func encodeFacadeTestJSON<T: Encodable>(_ value: T) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  guard let string = String(data: try encoder.encode(value), encoding: .utf8) else {
    throw FacadeTestJSONError.invalidUTF8
  }
  return string
}

private func decodeFacadeTestJSON<T: Decodable>(_ type: T.Type, from string: String) throws -> T {
  guard let data = string.data(using: .utf8) else {
    throw FacadeTestJSONError.invalidUTF8
  }
  return try JSONDecoder().decode(type, from: data)
}

struct PraxisRuntimeFacadesTests {
  @Test
  func runtimeFacadeKeepsCmpCompatibilityWrapperBoundToSplitSurfaces() throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-facades-identity-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    #expect(facade.cmpFacade.sessionFacade === facade.cmpSessionFacade)
    #expect(facade.cmpFacade.projectFacade === facade.cmpProjectFacade)
    #expect(facade.cmpFacade.flowFacade === facade.cmpFlowFacade)
    #expect(facade.cmpFacade.rolesFacade === facade.cmpRolesFacade)
    #expect(facade.cmpFacade.controlFacade === facade.cmpControlFacade)
    #expect(facade.cmpFacade.readbackFacade === facade.cmpReadbackFacade)
  }

  @Test
  func splitCmpSubfacadesDriveNeutralHostWorkflow() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-facades-workflow-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let session = try await facade.cmpSessionFacade.openSession(
      PraxisOpenCmpSessionCommand(projectID: "cmp.local-runtime", sessionID: "cmp.session.split")
    )
    let bootstrap = try await facade.cmpProjectFacade.bootstrapProject(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let projectReadback = try await facade.cmpProjectFacade.readbackProject(
      PraxisReadbackCmpProjectCommand(projectID: "cmp.local-runtime")
    )
    let ingest = try await facade.cmpFlowFacade.ingestFlow(
      PraxisIngestCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.split",
        taskSummary: "Capture one split-facade material",
        materials: [
          PraxisCmpRuntimeContextMaterial(kind: .userInput, ref: "payload:user:split")
        ],
        requiresActiveSync: true
      )
    )
    let commit = try await facade.cmpFlowFacade.commitFlow(
      PraxisCommitCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.split",
        eventIDs: [.init(rawValue: "evt.split.1")],
        changeSummary: "Commit one split-facade event",
        syncIntent: .toParent
      )
    )
    _ = try await facade.runFacade.runGoal(
      PraxisRunGoalCommand(
        goal: .init(
          normalizedGoal: .init(
            id: .init(rawValue: "goal.cmp-facades-resolve"),
            title: "CMP Facade Resolve Seed",
            summary: "Seed projection for facade resolve coverage"
          ),
          intentSummary: "Seed projection for facade resolve coverage"
        ),
        sessionID: .init(rawValue: "session.cmp-facades-resolve")
      )
    )
    let resolve = try await facade.cmpFlowFacade.resolveFlow(
      PraxisResolveCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local"
      )
    )
    let materialize = try await facade.cmpFlowFacade.materializeFlow(
      PraxisMaterializeCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal
      )
    )
    let dispatch = try await facade.cmpFlowFacade.dispatchFlow(
      PraxisDispatchCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: PraxisCmpContextPackage(
          id: materialize.packageID,
          sourceProjectionID: .init(rawValue: "projection.runtime.local"),
          sourceSnapshotID: try #require(resolve.snapshotID),
          sourceAgentID: "runtime.local",
          targetAgentID: "checker.local",
          kind: .runtimeFill,
          packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
          fidelityLabel: .highSignal,
          createdAt: "2026-04-11T00:00:00Z",
          sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")]
        ),
        targetKind: .peer,
        reason: "Dispatch runtime fill to checker"
      )
    )
    let controlUpdate = try await facade.cmpControlFacade.updateControl(
      PraxisUpdateCmpControlCommand(
        projectID: "cmp.local-runtime",
        executionStyle: .guided,
        fallbackPolicy: .registryOnly,
        recoveryPreference: .resumeLatest,
        automation: .init(values: [.autoDispatch: false])
      )
    )
    let controlReadback = try await facade.cmpControlFacade.readbackControl(
      PraxisReadbackCmpControlCommand(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )
    let rolesReadback = try await facade.cmpRolesFacade.readbackRoles(
      PraxisReadbackCmpRolesCommand(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )
    let requestedApproval = try await facade.cmpRolesFacade.requestPeerApproval(
      PraxisRequestCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: .init(rawValue: "tool.shell.exec"),
        requestedTier: .b2,
        summary: "Need shell execution for split facade test"
      )
    )
    let approvalReadback = try await facade.cmpReadbackFacade.readbackPeerApproval(
      PraxisReadbackCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: .init(rawValue: "tool.shell.exec")
      )
    )
    let statusReadback = try await facade.cmpReadbackFacade.readbackStatus(
      PraxisReadbackCmpStatusCommand(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )
    let checkerRolesReadback = try await facade.cmpRolesFacade.readbackRoles(
      PraxisReadbackCmpRolesCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let checkerControlReadback = try await facade.cmpControlFacade.readbackControl(
      PraxisReadbackCmpControlCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    #expect(session.projectID == "cmp.local-runtime")
    #expect(session.sessionID == "cmp.session.split")
    #expect(bootstrap.projectSummary.projectID == "cmp.local-runtime")
    #expect(bootstrap.projectSummary.hostProfile.executionStyle == .localFirst)
    #expect(bootstrap.projectSummary.componentStatuses[.gitProbe] == .ready)
    #expect(bootstrap.projectSummary.componentStatuses[.gitExecutor] == .ready)
    #expect(projectReadback.projectSummary.projectID == "cmp.local-runtime")
    #expect(projectReadback.projectSummary.hostProfile.semanticIndex == .localSemanticIndex)
    #expect(projectReadback.projectSummary.componentStatuses[.structuredStore] == .ready)
    #expect(projectReadback.projectSummary.componentStatuses[.gitExecutor] != .missing)
    #expect(projectReadback.persistenceSummary.isEmpty == false)
    #expect(ingest.projectID == "cmp.local-runtime")
    #expect(ingest.acceptedEventCount == 1)
    #expect(ingest.nextAction == .commitContextDelta)
    #expect(commit.projectID == "cmp.local-runtime")
    #expect(commit.deltaID.rawValue.hasPrefix("delta."))
    #expect(commit.snapshotCandidateID?.rawValue.isEmpty == false)
    #expect(commit.activeLineStage == .candidateReady)
    #expect(resolve.found)
    #expect(resolve.snapshotID?.rawValue.isEmpty == false)
    #expect(resolve.qualityLabel == .usable)
    #expect(materialize.packageKind == .runtimeFill)
    #expect(materialize.packageID.rawValue.contains("checker.local"))
    #expect(dispatch.targetKind == .peer)
    #expect(dispatch.status == .delivered)
    #expect(dispatch.dispatchID.rawValue.contains(materialize.packageID.rawValue))
    #expect(controlUpdate.executionStyle == .guided)
    #expect(controlUpdate.fallbackPolicy == .registryOnly)
    #expect(controlUpdate.recoveryPreference == .resumeLatest)
    #expect(controlReadback.executionStyle == .guided)
    #expect(controlReadback.fallbackPolicy == .registryOnly)
    #expect(controlReadback.recoveryPreference == .resumeLatest)
    #expect(controlReadback.automation[.autoDispatch] == false)
    #expect(controlReadback.latestPackageID == materialize.packageID)
    #expect(rolesReadback.projectID == "cmp.local-runtime")
    #expect(rolesReadback.latestPackageID == materialize.packageID)
    #expect(!rolesReadback.summary.contains("CLI"))
    #expect(!rolesReadback.summary.contains("GUI"))
    #expect(requestedApproval.capabilityKey == PraxisCapabilityID(rawValue: "tool.shell.exec"))
    #expect(requestedApproval.requestedTier == .b2)
    #expect(requestedApproval.route == .toolReview)
    #expect(requestedApproval.outcome == .redirectedToProvisioning)
    #expect(requestedApproval.humanGateState == .waitingApproval)
    #expect(approvalReadback.found)
    #expect(approvalReadback.capabilityKey == PraxisCapabilityID(rawValue: "tool.shell.exec"))
    #expect(approvalReadback.requestedTier == .b2)
    #expect(approvalReadback.route == .toolReview)
    #expect(approvalReadback.outcome == .redirectedToProvisioning)
    #expect(approvalReadback.humanGateState == .waitingApproval)
    #expect(statusReadback.projectID == "cmp.local-runtime")
    #expect(statusReadback.executionStyle == .guided)
    #expect(statusReadback.latestDispatchStatus == .delivered)
    #expect(statusReadback.latestPackageID == materialize.packageID)
    #expect(statusReadback.roleCounts.isEmpty == false)
    #expect(statusReadback.packageStatusCounts[.dispatched] == 1)
    #expect(statusReadback.roleCounts[.dispatcher] == 1)
    #expect(statusReadback.roleStages[.dispatcher] == .delivered)
    #expect(checkerRolesReadback.latestDispatchStatus == .delivered)
    #expect(checkerRolesReadback.roleStages[.dispatcher] == .delivered)
    #expect(checkerControlReadback.latestDispatchStatus == .delivered)
    #expect(!checkerControlReadback.summary.contains("CLI"))
    #expect(!checkerControlReadback.summary.contains("GUI"))
  }

  @Test
  func cmpControlSnapshotsRoundTripTypedAutomationMapsAndRejectUnknownAutomationKeys() throws {
    let automation = PraxisCmpAutomationMap(values: [.autoDispatch: false, .autoResolve: true])
    let panelSnapshot = PraxisCmpControlPanelSnapshot(
      summary: "CMP control panel",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      executionStyle: .manual,
      mode: .peerReview,
      readbackPriority: .packageFirst,
      fallbackPolicy: .registryOnly,
      recoveryPreference: .resumeLatest,
      automation: automation,
      latestPackageID: .init(rawValue: "package.runtime"),
      latestDispatchStatus: .delivered,
      latestTargetAgentID: "checker.local"
    )
    let updateSnapshot = PraxisCmpControlUpdateSnapshot(
      summary: "CMP control update",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      executionStyle: .manual,
      mode: .peerReview,
      readbackPriority: .packageFirst,
      fallbackPolicy: .registryOnly,
      recoveryPreference: .resumeLatest,
      automation: automation,
      storedAt: "2026-04-12T00:00:00Z"
    )

    let encodedPanel = try encodeFacadeTestJSON(panelSnapshot)
    let encodedUpdate = try encodeFacadeTestJSON(updateSnapshot)
    let decodedPanel = try decodeFacadeTestJSON(PraxisCmpControlPanelSnapshot.self, from: encodedPanel)
    let decodedUpdate = try decodeFacadeTestJSON(PraxisCmpControlUpdateSnapshot.self, from: encodedUpdate)

    #expect(encodedPanel.contains(#""automation":{"autoDispatch":false,"autoResolve":true}"#))
    #expect(encodedPanel.contains(#""latestPackageID":"package.runtime""#))
    #expect(encodedUpdate.contains(#""automation":{"autoDispatch":false,"autoResolve":true}"#))
    #expect(decodedPanel == panelSnapshot)
    #expect(decodedUpdate == updateSnapshot)
    #expect(decodedPanel.latestPackageID == .init(rawValue: "package.runtime"))
    #expect(decodedPanel.automation[.autoDispatch] == false)
    #expect(decodedUpdate.automation[.autoResolve] == true)

    let invalidPanelJSON =
      #"{"agentID":"checker.local","automation":{"ghost":true},"executionStyle":"manual","fallbackPolicy":"registry_only","latestDispatchStatus":"delivered","latestPackageID":"package.runtime","latestTargetAgentID":"checker.local","mode":"peer_review","projectID":"cmp.local-runtime","readbackPriority":"package_first","recoveryPreference":"resume_latest","summary":"CMP control panel"}"#
    let invalidUpdateJSON =
      #"{"agentID":"checker.local","automation":{"ghost":true},"executionStyle":"manual","fallbackPolicy":"registry_only","mode":"peer_review","projectID":"cmp.local-runtime","readbackPriority":"package_first","recoveryPreference":"resume_latest","storedAt":"2026-04-12T00:00:00Z","summary":"CMP control update"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpControlPanelSnapshot.self, from: invalidPanelJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpControlUpdateSnapshot.self, from: invalidUpdateJSON)
    }
  }

  @Test
  func cmpFacadeReadbacksPreserveRetryScheduledLatestDispatchStatus() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-facades-retry-scheduled-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )
    let packageID = PraxisCmpPackageID(rawValue: "projection.runtime.local:checker.local:runtimeFill")

    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: packageID,
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:10:00Z",
        metadata: [
          "last_dispatch_status": .string(PraxisCmpDispatchStatus.rejected.rawValue),
          "last_dispatch_updated_at": .string("2026-04-11T00:00:00Z"),
        ]
      )
    )
    _ = try await registry.deliveryTruthStore?.save(
      .init(
        id: "delivery.retry.projection.runtime.local:checker.local:runtimeFill",
        packageID: packageID,
        topic: "cmp.dispatch.checker.local",
        targetAgentID: "checker.local",
        status: .retryScheduled,
        payloadSummary: "Retry dispatch runtime fill to checker",
        updatedAt: "2026-04-11T00:05:00Z"
      )
    )

    let rolesReadback = try await facade.cmpRolesFacade.readbackRoles(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let controlReadback = try await facade.cmpControlFacade.readbackControl(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let statusReadback = try await facade.cmpReadbackFacade.readbackStatus(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    #expect(rolesReadback.latestDispatchStatus == .retryScheduled)
    #expect(controlReadback.latestDispatchStatus == .retryScheduled)
    #expect(statusReadback.latestDispatchStatus == .retryScheduled)
    #expect(rolesReadback.roleCounts[.dispatcher] == 1)
    #expect(statusReadback.roleCounts[.dispatcher] == 1)
    #expect(rolesReadback.roleStages[.dispatcher] == .retryScheduled)
    #expect(statusReadback.roleStages[.dispatcher] == .retryScheduled)
  }

  @Test
  func cmpFacadePreservesExplicitPeerApprovalDecisionOutcomesAcrossReadback() async throws {
    let scenarios: [(
      label: String,
      decision: PraxisCmpPeerApprovalDecision,
      expectedOutcome: PraxisCmpPeerApprovalOutcome,
      expectedHumanGateState: PraxisHumanGateState,
      expectedDecisionSummary: String
    )] = [
      ("approve", .approve, .approvedByHuman, .approved, "Approved git access for checker"),
      ("reject", .reject, .rejectedByHuman, .rejected, "Rejected git access for checker"),
      ("release", .release, .gateReleased, .approved, "Released git access gate for checker"),
    ]

    for scenario in scenarios {
      let rootDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("praxis-runtime-facades-peer-approval-\(scenario.label)-\(UUID().uuidString)", isDirectory: true)
      defer { try? FileManager.default.removeItem(at: rootDirectory) }

      let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
        hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory),
        blueprint: PraxisRuntimeGatewayModule.bootstrap
      )

      _ = try await facade.cmpRolesFacade.requestPeerApproval(
        PraxisRequestCmpPeerApprovalCommand(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: .init(rawValue: "tool.git"),
          requestedTier: .b1,
          summary: "Escalate git access to checker"
        )
      )
      let decisionSnapshot = try await facade.cmpRolesFacade.decidePeerApproval(
        PraxisDecideCmpPeerApprovalCommand(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: .init(rawValue: "tool.git"),
          decision: scenario.decision,
          reviewerAgentID: "reviewer.local",
          decisionSummary: scenario.expectedDecisionSummary
        )
      )
      let readbackSnapshot = try await facade.cmpReadbackFacade.readbackPeerApproval(
        PraxisReadbackCmpPeerApprovalCommand(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: .init(rawValue: "tool.git")
        )
      )

      #expect(decisionSnapshot.outcome == scenario.expectedOutcome)
      #expect(decisionSnapshot.humanGateState == scenario.expectedHumanGateState)
      #expect(decisionSnapshot.decisionSummary == scenario.expectedDecisionSummary)

      #expect(readbackSnapshot.found)
      #expect(readbackSnapshot.outcome == scenario.expectedOutcome)
      #expect(readbackSnapshot.humanGateState == scenario.expectedHumanGateState)
      #expect(readbackSnapshot.decisionSummary == scenario.expectedDecisionSummary)
    }
  }

  @Test
  func cmpRoleCountMapsRoundTripTypedRoleKeys() throws {
    let roleCounts = PraxisCmpRoleCountMap(
      counts: [
        .dispatcher: 1,
        .checker: 2,
      ]
    )
    let rolesSnapshot = PraxisCmpRolesPanelSnapshot(
      summary: "CMP roles snapshot",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      roleCounts: roleCounts,
      roleStages: .init(stages: [.dispatcher: .retryScheduled]),
      latestPackageID: .init(rawValue: "package.runtime"),
      latestDispatchStatus: .retryScheduled
    )
    let statusSnapshot = PraxisCmpStatusPanelSnapshot(
      summary: "CMP status snapshot",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      executionStyle: .automatic,
      readbackPriority: .gitFirst,
      packageCount: 1,
      packageStatusCounts: .init(counts: [.dispatched: 1]),
      latestPackageID: .init(rawValue: "package.runtime"),
      latestDispatchStatus: .retryScheduled,
      roleCounts: roleCounts,
      roleStages: .init(stages: [.dispatcher: .retryScheduled])
    )

    let encodedRoles = try encodeFacadeTestJSON(rolesSnapshot)
    let encodedStatus = try encodeFacadeTestJSON(statusSnapshot)
    let decodedRoles = try decodeFacadeTestJSON(PraxisCmpRolesPanelSnapshot.self, from: encodedRoles)
    let decodedStatus = try decodeFacadeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: encodedStatus)

    #expect(encodedRoles.contains(#""roleCounts":{"checker":2,"dispatcher":1}"#))
    #expect(encodedStatus.contains(#""roleCounts":{"checker":2,"dispatcher":1}"#))
    #expect(encodedStatus.contains(#""packageStatusCounts":{"dispatched":1}"#))
    #expect(encodedRoles.contains(#""latestPackageID":"package.runtime""#))
    #expect(encodedStatus.contains(#""latestPackageID":"package.runtime""#))
    #expect(decodedRoles.latestPackageID == .init(rawValue: "package.runtime"))
    #expect(decodedStatus.latestPackageID == .init(rawValue: "package.runtime"))
    #expect(decodedRoles.roleCounts[.dispatcher] == 1)
    #expect(decodedRoles.roleCounts[.checker] == 2)
    #expect(decodedStatus.packageStatusCounts[.dispatched] == 1)
    #expect(decodedStatus.roleCounts[.dispatcher] == 1)
    #expect(decodedStatus.roleCounts[.checker] == 2)
  }

  @Test
  func cmpRoleCountMapsRejectUnknownRoleKeys() throws {
    let invalidRolesJSON =
      #"{"agentID":"checker.local","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","projectID":"cmp.local-runtime","roleCounts":{"ghost":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP roles snapshot"}"#
    let invalidStatusJSON =
      #"{"agentID":"checker.local","executionStyle":"automatic","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","packageCount":1,"packageStatusCounts":{"dispatched":1},"projectID":"cmp.local-runtime","readbackPriority":"gitFirst","roleCounts":{"ghost":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP status snapshot"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpRolesPanelSnapshot.self, from: invalidRolesJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func cmpStatusSnapshotRejectsUnknownPackageStatusCountKeys() throws {
    let invalidStatusJSON =
      #"{"agentID":"checker.local","executionStyle":"automatic","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","packageCount":1,"packageStatusCounts":{"broken_status":1},"projectID":"cmp.local-runtime","readbackPriority":"gitFirst","roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP status snapshot"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func tapSnapshotsRoundTripTypedStatusWhileHistoryStaysDisplayOriented() throws {
    let statusSnapshot = PraxisTapStatusSnapshot(
      summary: "TAP status snapshot",
      readinessSummary: "One approval is waiting.",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      tapMode: .restricted,
      riskLevel: .dangerous,
      humanGateState: .waitingApproval,
      availableCapabilityCount: 2,
      availableCapabilityIDs: [capabilityID("tool.git"), capabilityID("tool.shell.exec")],
      pendingApprovalCount: 1,
      approvedApprovalCount: 0,
      latestCapabilityKey: .init(rawValue: "tool.shell.exec"),
      latestDecisionSummary: "Waiting on explicit approval."
    )
    let historySnapshot = PraxisTapHistorySnapshot(
      summary: "TAP history snapshot",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      totalCount: 2,
      entries: [
        .init(
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: .init(rawValue: "tool.shell.exec"),
          requestedTier: .b2,
          route: .humanReview,
          outcome: .escalatedToHuman,
          humanGateState: .waitingApproval,
          updatedAt: "2026-04-12T00:00:00Z",
          decisionSummary: "Waiting on human review."
        ),
        .init(
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: .init(rawValue: "dispatch_released"),
          requestedTier: .b0,
          route: .autoApprove,
          outcome: .baselineApproved,
          humanGateState: .notRequired,
          updatedAt: "2026-04-12T00:05:00Z",
          decisionSummary: "Dispatch released."
        ),
      ]
    )

    let encodedStatus = try encodeFacadeTestJSON(statusSnapshot)
    let encodedHistory = try encodeFacadeTestJSON(historySnapshot)
    let decodedStatus = try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: encodedStatus)
    let decodedHistory = try decodeFacadeTestJSON(PraxisTapHistorySnapshot.self, from: encodedHistory)

    #expect(encodedStatus.contains(#""tapMode":"restricted""#))
    #expect(encodedStatus.contains(#""riskLevel":"dangerous""#))
    #expect(encodedStatus.contains(#""humanGateState":"waitingApproval""#))
    #expect(encodedStatus.contains(#""availableCapabilityIDs":["tool.git","tool.shell.exec"]"#))
    #expect(encodedHistory.contains(#""requestedTier":"B2""#))
    #expect(encodedHistory.contains(#""route":"humanReview""#))
    #expect(encodedHistory.contains(#""outcome":"escalated_to_human""#))
    #expect(decodedStatus.tapMode == .restricted)
    #expect(decodedStatus.riskLevel == .dangerous)
    #expect(decodedStatus.humanGateState == .waitingApproval)
    #expect(decodedStatus.availableCapabilityIDs == [capabilityID("tool.git"), capabilityID("tool.shell.exec")])
    #expect(decodedHistory.entries.first?.requestedTier == .b2)
    #expect(decodedHistory.entries.first?.route == .humanReview)
    #expect(decodedHistory.entries.first?.outcome == .escalatedToHuman)

    let invalidStatusJSON =
      #"{"agentID":"checker.local","approvedApprovalCount":0,"availableCapabilityCount":2,"availableCapabilityIDs":["tool.git"],"humanGateState":"waitingApproval","latestCapabilityKey":"tool.git","latestDecisionSummary":"Waiting","pendingApprovalCount":1,"projectID":"cmp.local-runtime","readinessSummary":"One approval is waiting.","riskLevel":"dangerous","summary":"TAP status snapshot","tapMode":"not_a_real_mode"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func cmpPeerApprovalSnapshotsRoundTripTypedEnumsAndRejectInvalidRawValues() throws {
    let approvalSnapshot = PraxisCmpPeerApprovalSnapshot(
      summary: "CMP peer approval snapshot",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      capabilityKey: .init(rawValue: "tool.shell.exec"),
      requestedTier: .b2,
      route: .humanReview,
      outcome: .escalatedToHuman,
      tapMode: .restricted,
      riskLevel: .risky,
      humanGateState: .waitingApproval,
      requestedAt: "2026-04-12T00:00:00Z",
      decisionSummary: "Waiting on human review."
    )
    let readbackSnapshot = PraxisCmpPeerApprovalReadbackSnapshot(
      summary: "CMP peer approval readback snapshot",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      capabilityKey: .init(rawValue: "tool.shell.exec"),
      requestedTier: .b2,
      route: .humanReview,
      outcome: .escalatedToHuman,
      tapMode: .restricted,
      riskLevel: .risky,
      humanGateState: .waitingApproval,
      requestedAt: "2026-04-12T00:00:00Z",
      decisionSummary: "Waiting on human review.",
      found: true
    )

    let encodedApproval = try encodeFacadeTestJSON(approvalSnapshot)
    let encodedReadback = try encodeFacadeTestJSON(readbackSnapshot)
    let decodedApproval = try decodeFacadeTestJSON(PraxisCmpPeerApprovalSnapshot.self, from: encodedApproval)
    let decodedReadback = try decodeFacadeTestJSON(PraxisCmpPeerApprovalReadbackSnapshot.self, from: encodedReadback)

    #expect(encodedApproval.contains(#""requestedTier":"B2""#))
    #expect(encodedApproval.contains(#""route":"humanReview""#))
    #expect(encodedApproval.contains(#""outcome":"escalated_to_human""#))
    #expect(encodedApproval.contains(#""tapMode":"restricted""#))
    #expect(encodedApproval.contains(#""riskLevel":"risky""#))
    #expect(decodedApproval.requestedTier == .b2)
    #expect(decodedApproval.route == .humanReview)
    #expect(decodedApproval.outcome == .escalatedToHuman)
    #expect(decodedApproval.tapMode == .restricted)
    #expect(decodedApproval.riskLevel == .risky)
    #expect(decodedReadback.humanGateState == .waitingApproval)

    let invalidApprovalJSON =
      #"{"agentID":"runtime.local","capabilityKey":"tool.shell.exec","decisionSummary":"Waiting","humanGateState":"waitingApproval","outcome":"escalated_to_human","projectID":"cmp.local-runtime","requestedAt":"2026-04-12T00:00:00Z","requestedTier":"B2","riskLevel":"risky","route":"not_a_real_route","summary":"CMP peer approval snapshot","tapMode":"restricted","targetAgentID":"checker.local"}"#
    let invalidReadbackJSON =
      #"{"agentID":"runtime.local","capabilityKey":"tool.shell.exec","decisionSummary":"Waiting","found":true,"humanGateState":"waitingApproval","outcome":"escalated_to_human","projectID":"cmp.local-runtime","requestedAt":"2026-04-12T00:00:00Z","requestedTier":"B2","riskLevel":"risky","route":"humanReview","summary":"CMP peer approval readback snapshot","tapMode":"not_a_real_mode","targetAgentID":"checker.local"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpPeerApprovalSnapshot.self, from: invalidApprovalJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpPeerApprovalReadbackSnapshot.self, from: invalidReadbackJSON)
    }
  }

  @Test
  func cmpPeerApprovalAndTapStatusSnapshotsRoundTripTypedFields() throws {
    let approval = PraxisCmpPeerApprovalSnapshot(
      summary: "CMP peer approval snapshot",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      capabilityKey: .init(rawValue: "tool.git"),
      requestedTier: .b1,
      route: .humanReview,
      outcome: .baselineApproved,
      tapMode: .restricted,
      riskLevel: .dangerous,
      humanGateState: .approved,
      requestedAt: "2026-04-12T00:00:00Z",
      decisionSummary: "Approved git access for checker"
    )
    let readback = PraxisCmpPeerApprovalReadbackSnapshot(
      summary: "CMP peer approval readback snapshot",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      capabilityKey: .init(rawValue: "tool.shell.exec"),
      requestedTier: .b2,
      route: .humanReview,
      outcome: .escalatedToHuman,
      tapMode: .restricted,
      riskLevel: .risky,
      humanGateState: .waitingApproval,
      requestedAt: "2026-04-12T00:05:00Z",
      decisionSummary: "Waiting for approval",
      found: true
    )
    let status = PraxisTapStatusSnapshot(
      summary: "TAP status snapshot",
      readinessSummary: "1 capability, 1 pending approval.",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      tapMode: .restricted,
      riskLevel: .risky,
      humanGateState: .waitingApproval,
      availableCapabilityCount: 1,
      availableCapabilityIDs: [capabilityID("tool.shell.exec")],
      pendingApprovalCount: 1,
      approvedApprovalCount: 0,
      latestCapabilityKey: .init(rawValue: "tool.shell.exec"),
      latestDecisionSummary: "Waiting for approval"
    )

    let encodedApproval = try encodeFacadeTestJSON(approval)
    let encodedReadback = try encodeFacadeTestJSON(readback)
    let encodedStatus = try encodeFacadeTestJSON(status)
    let decodedApproval = try decodeFacadeTestJSON(PraxisCmpPeerApprovalSnapshot.self, from: encodedApproval)
    let decodedReadback = try decodeFacadeTestJSON(PraxisCmpPeerApprovalReadbackSnapshot.self, from: encodedReadback)
    let decodedStatus = try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: encodedStatus)

    #expect(encodedApproval.contains(#""requestedTier":"B1""#))
    #expect(encodedApproval.contains(#""route":"humanReview""#))
    #expect(encodedApproval.contains(#""outcome":"baseline_approved""#))
    #expect(encodedReadback.contains(#""outcome":"escalated_to_human""#))
    #expect(encodedStatus.contains(#""tapMode":"restricted""#))
    #expect(encodedStatus.contains(#""riskLevel":"risky""#))
    #expect(encodedStatus.contains(#""humanGateState":"waitingApproval""#))
    #expect(decodedApproval.requestedTier == .b1)
    #expect(decodedApproval.route == .humanReview)
    #expect(decodedApproval.outcome == .baselineApproved)
    #expect(decodedApproval.tapMode == .restricted)
    #expect(decodedApproval.riskLevel == .dangerous)
    #expect(decodedApproval.humanGateState == .approved)
    #expect(decodedReadback.requestedTier == .b2)
    #expect(decodedReadback.route == .humanReview)
    #expect(decodedReadback.outcome == .escalatedToHuman)
    #expect(decodedReadback.tapMode == .restricted)
    #expect(decodedReadback.riskLevel == .risky)
    #expect(decodedReadback.humanGateState == .waitingApproval)
    #expect(decodedStatus.tapMode == .restricted)
    #expect(decodedStatus.riskLevel == .risky)
    #expect(decodedStatus.humanGateState == .waitingApproval)
    #expect(decodedStatus.availableCapabilityIDs == [capabilityID("tool.shell.exec")])
  }

  @Test
  func cmpPeerApprovalAndTapStatusSnapshotsRejectUnknownTypedRawValues() throws {
    let invalidApprovalRouteJSON =
      #"{"agentID":"runtime.local","capabilityKey":"tool.git","decisionSummary":"Approved git access for checker","humanGateState":"approved","outcome":"baseline_approved","projectID":"cmp.local-runtime","requestedAt":"2026-04-12T00:00:00Z","requestedTier":"B1","riskLevel":"dangerous","route":"not_a_real_route","summary":"CMP peer approval snapshot","tapMode":"restricted","targetAgentID":"checker.local"}"#
    let invalidApprovalOutcomeJSON =
      #"{"agentID":"runtime.local","capabilityKey":"tool.git","decisionSummary":"Approved git access for checker","humanGateState":"approved","outcome":"not_a_real_outcome","projectID":"cmp.local-runtime","requestedAt":"2026-04-12T00:00:00Z","requestedTier":"B1","riskLevel":"dangerous","route":"humanReview","summary":"CMP peer approval snapshot","tapMode":"restricted","targetAgentID":"checker.local"}"#
    let invalidStatusTapModeJSON =
      #"{"agentID":"checker.local","approvedApprovalCount":0,"availableCapabilityCount":1,"availableCapabilityIDs":["tool.shell.exec"],"humanGateState":"waitingApproval","latestCapabilityKey":"tool.shell.exec","latestDecisionSummary":"Waiting for approval","pendingApprovalCount":1,"projectID":"cmp.local-runtime","readinessSummary":"1 capability, 1 pending approval.","riskLevel":"risky","summary":"TAP status snapshot","tapMode":"not_a_real_mode"}"#
    let invalidStatusRiskLevelJSON =
      #"{"agentID":"checker.local","approvedApprovalCount":0,"availableCapabilityCount":1,"availableCapabilityIDs":["tool.shell.exec"],"humanGateState":"waitingApproval","latestCapabilityKey":"tool.shell.exec","latestDecisionSummary":"Waiting for approval","pendingApprovalCount":1,"projectID":"cmp.local-runtime","readinessSummary":"1 capability, 1 pending approval.","riskLevel":"not_a_real_risk","summary":"TAP status snapshot","tapMode":"restricted"}"#
    let invalidStatusHumanGateStateJSON =
      #"{"agentID":"checker.local","approvedApprovalCount":0,"availableCapabilityCount":1,"availableCapabilityIDs":["tool.shell.exec"],"humanGateState":"not_a_real_gate_state","latestCapabilityKey":"tool.shell.exec","latestDecisionSummary":"Waiting for approval","pendingApprovalCount":1,"projectID":"cmp.local-runtime","readinessSummary":"1 capability, 1 pending approval.","riskLevel":"risky","summary":"TAP status snapshot","tapMode":"restricted"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpPeerApprovalSnapshot.self, from: invalidApprovalRouteJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpPeerApprovalSnapshot.self, from: invalidApprovalOutcomeJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: invalidStatusTapModeJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: invalidStatusRiskLevelJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: invalidStatusHumanGateStateJSON)
    }
  }

  @Test
  func tapStatusSnapshotRejectsNonStringCapabilityListPayloads() throws {
    let invalidStatusJSON =
      #"{"agentID":"checker.local","approvedApprovalCount":0,"availableCapabilityCount":1,"availableCapabilityIDs":[42],"humanGateState":"waitingApproval","latestCapabilityKey":"tool.shell.exec","latestDecisionSummary":"Waiting for approval","pendingApprovalCount":1,"projectID":"cmp.local-runtime","readinessSummary":"1 capability, 1 pending approval.","riskLevel":"risky","summary":"TAP status snapshot","tapMode":"restricted"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisTapStatusSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func cmpProjectHostProfileMapsRoundTripTypedProfiles() throws {
    let summary = PraxisCmpProjectLocalRuntimeSummary(
      projectID: "cmp.local-runtime",
      hostProfile: .init(
        executionStyle: .localFirst,
        structuredStore: .sqlite,
        deliveryStore: .sqlite,
        messageTransport: .inProcessActorBus,
        gitAccess: .systemGit,
        semanticIndex: .localSemanticIndex
      ),
      componentStatuses: .init(statuses: [
        .structuredStore: .ready,
        .gitExecutor: .degraded,
        .messageBus: .missing,
      ]),
      issues: []
    )
    let encoded = try encodeFacadeTestJSON(summary)
    let decoded = try decodeFacadeTestJSON(PraxisCmpProjectLocalRuntimeSummary.self, from: encoded)

    #expect(encoded.contains(#""executionStyle":"local-first""#))
    #expect(encoded.contains(#""messageTransport":"in_process_actor_bus""#))
    #expect(encoded.contains(#""componentStatuses":{"gitExecutor":"degraded","messageBus":"missing","structuredStore":"ready"}"#))
    #expect(decoded.hostProfile.executionStyle == .localFirst)
    #expect(decoded.hostProfile.structuredStore == .sqlite)
    #expect(decoded.hostProfile.deliveryStore == .sqlite)
    #expect(decoded.hostProfile.messageTransport == .inProcessActorBus)
    #expect(decoded.hostProfile.gitAccess == .systemGit)
    #expect(decoded.hostProfile.semanticIndex == .localSemanticIndex)
    #expect(decoded.componentStatuses[.structuredStore] == .ready)
    #expect(decoded.componentStatuses[.gitExecutor] == .degraded)
    #expect(decoded.componentStatuses[.messageBus] == .missing)
  }

  @Test
  func cmpProjectHostProfileRejectsUnknownTypedProfileValues() throws {
    let invalidJSON =
      #"{"componentStatuses":{"structuredStore":"ready"},"hostProfile":{"deliveryStore":"sqlite","executionStyle":"broken_style","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"issues":[],"projectID":"cmp.local-runtime"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpProjectLocalRuntimeSummary.self, from: invalidJSON)
    }
  }

  @Test
  func cmpProjectComponentStatusesRejectUnknownKeysAndValues() throws {
    let invalidKeyJSON =
      #"{"componentStatuses":{"ghost":"ready"},"hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"issues":[],"projectID":"cmp.local-runtime"}"#
    let invalidValueJSON =
      #"{"componentStatuses":{"structuredStore":"broken"},"hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"issues":[],"projectID":"cmp.local-runtime"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpProjectLocalRuntimeSummary.self, from: invalidKeyJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpProjectLocalRuntimeSummary.self, from: invalidValueJSON)
    }
  }

  @Test
  func cmpProjectSmokeSnapshotRoundTripsTypedGateAndStatusAndRejectsUnknownValues() throws {
    let snapshot = PraxisCmpProjectSmokeSnapshot(
      projectID: "cmp.local-runtime",
      smokeResult: .init(
        summary: "CMP smoke summary",
        checks: [
          .init(
            id: "cmp.project.workspace",
            gate: .workspace,
            status: .ready,
            summary: "Workspace readiness is ready."
          ),
          .init(
            id: "cmp.project.lineage",
            gate: .lineage,
            status: .missing,
            summary: "Lineage readiness is degraded."
          ),
        ]
      )
    )

    let encoded = try encodeFacadeTestJSON(snapshot)
    let decoded = try decodeFacadeTestJSON(PraxisCmpProjectSmokeSnapshot.self, from: encoded)

    #expect(encoded.contains(#""gate":"workspace""#))
    #expect(encoded.contains(#""status":"ready""#))
    #expect(encoded.contains(#""status":"missing""#))
    #expect(decoded.smokeResult.checks.first?.gate == .workspace)
    #expect(decoded.smokeResult.checks.last?.status == .missing)

    let invalidGateJSON =
      #"{"projectID":"cmp.local-runtime","smokeResult":{"checks":[{"gate":"broken_gate","id":"cmp.project.workspace","status":"ready","summary":"Workspace readiness is ready."}],"summary":"CMP smoke summary"}}"#
    let invalidStatusJSON =
      #"{"projectID":"cmp.local-runtime","smokeResult":{"checks":[{"gate":"workspace","id":"cmp.project.workspace","status":"broken_status","summary":"Workspace readiness is ready."}],"summary":"CMP smoke summary"}}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpProjectSmokeSnapshot.self, from: invalidGateJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpProjectSmokeSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func cmpFlowIngestSnapshotRoundTripsTypedNextActionAndRejectsUnknownValues() throws {
    let snapshot = PraxisCmpFlowIngestSnapshot(
      summary: "CMP ingest summary",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      sessionID: "cmp.flow.snapshot",
      requestID: .init(rawValue: "req.flow.snapshot"),
      acceptedEventCount: 1,
      sectionCount: 1,
      storedSectionCount: 1,
      nextAction: .commitContextDelta
    )

    let encoded = try encodeFacadeTestJSON(snapshot)
    let decoded = try decodeFacadeTestJSON(PraxisCmpFlowIngestSnapshot.self, from: encoded)

    #expect(encoded.contains(#""nextAction":"commit_context_delta""#))
    #expect(encoded.contains(#""requestID":"req.flow.snapshot""#))
    #expect(decoded.nextAction == .commitContextDelta)
    #expect(decoded.requestID == .init(rawValue: "req.flow.snapshot"))

    let invalidJSON =
      #"{"acceptedEventCount":1,"agentID":"runtime.local","nextAction":"broken_action","projectID":"cmp.local-runtime","requestID":"req.flow.snapshot","sectionCount":1,"sessionID":"cmp.flow.snapshot","storedSectionCount":1,"summary":"CMP ingest summary"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisCmpFlowIngestSnapshot.self, from: invalidJSON)
    }
  }

  @Test
  func mpFacadeOwnsTheNeutralMpSurfaceWhileInspectionFacadeRemainsCompatible() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: ["memory.primary"],
        supportingMemoryIDs: [],
        omittedSupersededMemoryIDs: []
      )
    )

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
          PraxisProviderInferenceResponse(
            output: .init(summary: "stubbed inference"),
            receipt: .init(
              capabilityKey: "provider.infer",
              backend: "stub-provider",
              status: .succeeded,
              summary: "Inference is stubbed for MP facade tests."
            )
          )
        },
        semanticSearchIndex: PraxisStubSemanticSearchIndex(
          cannedResults: [
            "host runtime": [
              .init(id: "match-1", score: 0.9, contentSummary: "Host runtime memory hit", storageKey: "memory/primary")
            ]
          ]
        ),
        semanticMemoryStore: memoryStore,
        providerInferenceSurfaceProvenance: .composed
      ),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let inspection = try await facade.mpFacade.inspect()
    let compatibilityInspection = try await facade.inspectionFacade.inspectMp()

    #expect(inspection.summary == "MP workflow surface is reading HostRuntime memory and current adapter provenance.")
    #expect(inspection.workflowSummary == "ICMA / Iterator / Checker / DbAgent / Dispatcher lanes have a composed provider inference surface available.")
    #expect(inspection.memoryStoreSummary.contains("1 primary records and omits 0 superseded records"))
    #expect(inspection.memoryStoreSummary.contains("Semantic search matches for inspection query: 1."))
    #expect(inspection.multimodalSummary == "No multimodal host chips are currently registered.")
    #expect(compatibilityInspection == inspection)
  }

  @Test
  func mpFacadeSearchReadbackAndSmokeExposeDedicatedNeutralSnapshots() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: ["memory.primary"],
        supportingMemoryIDs: ["memory.supporting"],
        omittedSupersededMemoryIDs: ["memory.superseded"]
      ),
      searchResults: [
        PraxisSemanticMemoryRecord(
          id: "memory.primary",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .agent,
          memoryKind: .semantic,
          summary: "Host runtime onboarding note",
          storageKey: "memory/primary",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          embeddingStorageKey: "embed/primary"
        ),
        PraxisSemanticMemoryRecord(
          id: "memory.supporting",
          projectID: "mp.local-runtime",
          agentID: "checker.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "Shared onboarding summary",
          storageKey: "memory/supporting",
          freshnessStatus: .aging,
          alignmentStatus: .unreviewed,
          embeddingStorageKey: "embed/supporting"
        ),
      ]
    )

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
          PraxisProviderInferenceResponse(
            output: .init(summary: "stubbed inference"),
            receipt: .init(
              capabilityKey: "provider.infer",
              backend: "stub-provider",
              status: .succeeded,
              summary: "Inference is stubbed for MP facade tests."
            )
          )
        },
        browserGroundingCollector: PraxisStubBrowserGroundingCollector { _ in
          PraxisBrowserGroundingEvidenceBundle(
            pages: [
              .init(role: .verifiedSource, url: "https://example.com/mp")
            ],
            facts: [
              .init(name: "mp-smoke", status: .verified, value: "reachable")
            ]
          )
        },
        semanticSearchIndex: PraxisStubSemanticSearchIndex(
          cannedResults: [
            "onboarding": [
              .init(id: "match-1", score: 0.91, contentSummary: "Host runtime onboarding note", storageKey: "memory/primary"),
              .init(id: "match-2", score: 0.63, contentSummary: "Shared onboarding summary", storageKey: "memory/supporting"),
            ]
          ]
        ),
        semanticMemoryStore: memoryStore,
        providerInferenceSurfaceProvenance: .composed,
        browserGroundingSurfaceProvenance: .composed
      ),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let search = try await facade.mpFacade.search(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        scopeLevels: [.agentIsolated, .project],
        limit: 5
      )
    )
    let readback = try await facade.mpFacade.readback(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        scopeLevels: [.agentIsolated, .project],
        limit: 5
      )
    )
    let smoke = try await facade.mpFacade.smoke(.init(projectID: "mp.local-runtime"))

    #expect(search.projectID == "mp.local-runtime")
    #expect(search.hits.map(\.memoryID) == ["memory.primary", "memory.supporting"])
    #expect(search.hits.first?.scopeLevel == .agentIsolated)
    #expect(search.hits.first?.memoryKind == .semantic)
    #expect(search.hits.first?.freshnessStatus == .fresh)
    #expect(search.hits.first?.alignmentStatus == .aligned)
    #expect(readback.totalMemoryCount == 2)
    #expect(readback.primaryCount == 1)
    #expect(readback.supportingCount == 1)
    #expect(readback.omittedSupersededCount == 1)
    #expect(readback.freshnessBreakdown[.fresh] == 1)
    #expect(readback.scopeBreakdown[.agentIsolated] == 1)
    #expect(readback.scopeBreakdown[.project] == 1)
    #expect(smoke.projectID == "mp.local-runtime")
    #expect(smoke.smokeResult.checks.count == 4)
    #expect(smoke.smokeResult.checks.map(\.gate).contains(.browserGrounding))
    #expect(smoke.smokeResult.checks.map(\.status).contains(.ready))
    #expect(smoke.smokeResult.checks.first { $0.gate == .semanticSearch }?.status == .ready)
  }

  @Test
  func mpFacadeSearchReadbackAndSmokeProjectStableNeutralBoundarySemanticsWithoutHostPresentationKeys() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: [" memory.primary "],
        supportingMemoryIDs: [" memory.supporting "],
        omittedSupersededMemoryIDs: []
      ),
      searchResults: [
        PraxisSemanticMemoryRecord(
          id: " memory.primary ",
          projectID: " mp.local-runtime ",
          agentID: "runtime.local",
          sessionID: " session.search ",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "Boundary-preserving primary memory",
          storageKey: " memory/primary ",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          embeddingStorageKey: " embed/primary "
        ),
        PraxisSemanticMemoryRecord(
          id: " memory.supporting ",
          projectID: " mp.local-runtime ",
          agentID: "runtime.local",
          sessionID: " session.search ",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "Boundary-preserving supporting memory",
          storageKey: " memory/supporting ",
          freshnessStatus: .aging,
          alignmentStatus: .unreviewed,
          embeddingStorageKey: " embed/supporting "
        ),
      ]
    )

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: PraxisStubProviderInferenceExecutor { _ in
          PraxisProviderInferenceResponse(
            output: .init(summary: "stubbed inference"),
            receipt: .init(
              capabilityKey: "provider.infer",
              backend: "stub-provider",
              status: .succeeded,
              summary: "Inference is stubbed for MP facade boundary tests."
            )
          )
        },
        browserGroundingCollector: PraxisStubBrowserGroundingCollector { _ in
          PraxisBrowserGroundingEvidenceBundle(
            pages: [
              .init(role: .verifiedSource, url: "https://example.com/mp-boundary")
            ],
            facts: [
              .init(name: "mp-boundary", status: .verified, value: "reachable")
            ]
          )
        },
        semanticSearchIndex: PraxisStubSemanticSearchIndex(
          cannedResults: [
            "onboarding": [
              .init(id: "match-1", score: 0.95, contentSummary: "Boundary-preserving primary memory", storageKey: " memory/primary "),
              .init(id: "match-2", score: 0.74, contentSummary: "Boundary-preserving supporting memory", storageKey: " memory/supporting "),
            ]
          ]
        ),
        semanticMemoryStore: memoryStore
      ),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let search = try await facade.mpFacade.search(
      .init(
        projectID: " mp.local-runtime ",
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5,
        agentID: "runtime.local",
        sessionID: " session.search ",
        includeSuperseded: true
      )
    )
    let readback = try await facade.mpFacade.readback(
      .init(
        projectID: " mp.local-runtime ",
        query: "",
        scopeLevels: [.project],
        limit: 5,
        agentID: "runtime.local",
        sessionID: " session.search ",
        includeSuperseded: true
      )
    )
    let smoke = try await facade.mpFacade.smoke(.init(projectID: " mp.local-runtime "))

    let encodedSearch = try encodeFacadeTestJSON(search)
    let encodedReadback = try encodeFacadeTestJSON(readback)
    let encodedSmoke = try encodeFacadeTestJSON(smoke)

    #expect(encodedSearch.contains(#""projectID":"mp.local-runtime""#))
    #expect(encodedSearch.contains(#""memoryID":"memory.primary""#))
    #expect(encodedSearch.contains(#""storageKey":"memory\/primary""#))
    #expect(encodedReadback.contains(#""projectID":"mp.local-runtime""#))
    #expect(encodedSmoke.contains(#""projectID":" mp.local-runtime ""#))

    for encoded in [encodedSearch, encodedReadback, encodedSmoke] {
      for forbiddenKey in ["\"title\":", "\"kind\":", "\"terminal\"", "\"screen\"", "\"viewState\"", "\"buttonLabel\""] {
        #expect(!encoded.contains(forbiddenKey))
      }
    }

    #expect(search.projectID == "mp.local-runtime")
    #expect(search.hits.map(\.memoryID) == ["memory.primary", "memory.supporting"])
    #expect(search.hits.map(\.storageKey) == ["memory/primary", "memory/supporting"])
    #expect(readback.projectID == "mp.local-runtime")
    #expect(readback.totalMemoryCount == 2)
    #expect(readback.primaryCount == 1)
    #expect(readback.supportingCount == 1)
    #expect(smoke.projectID == " mp.local-runtime ")
    #expect(smoke.smokeResult.checks.map(\.gate).contains(.semanticSearch))
  }

  @Test
  func mpFacadeWorkflowSnapshotsProjectHostNeutralMpRuntimeState() async throws {
    let memoryStore = PraxisFakeSemanticMemoryStore()

    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry(
        semanticMemoryStore: memoryStore
      ),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let ingest = try await facade.mpFacade.ingest(
      .init(
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: "mp.session",
        summary: "Host runtime onboarding note",
        checkedSnapshotRef: .init(rawValue: "snapshot.mp.1"),
        branchRef: "main",
        observedAt: "2026-04-11T10:00:00Z"
      )
    )
    let align = try await facade.mpFacade.align(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        alignedAt: "2026-04-11T10:05:00Z"
      )
    )
    let submitted = try await facade.mpFacade.promote(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .submittedToParent,
        targetSessionID: "mp.session",
        promotedAt: "2026-04-11T10:06:00Z"
      )
    )
    let accepted = try await facade.mpFacade.promote(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .acceptedByParent,
        targetSessionID: "mp.session",
        promotedAt: "2026-04-11T10:07:00Z"
      )
    )
    let promote = try await facade.mpFacade.promote(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        targetPromotionState: .promotedToProject,
        promotedAt: "2026-04-11T10:08:00Z",
        reason: "Stabilized as project truth"
      )
    )
    let resolve = try await facade.mpFacade.resolve(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        requesterAgentID: "runtime.local",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await facade.mpFacade.requestHistory(
      .init(
        projectID: "mp.local-runtime",
        requesterAgentID: "runtime.local",
        reason: "Need historical context",
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let archive = try await facade.mpFacade.archive(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        archivedAt: "2026-04-11T10:09:00Z",
        reason: "Superseded by canonical project brief"
      )
    )

    #expect(ingest.projectID == "mp.local-runtime")
    #expect(ingest.agentID == "runtime.local")
    #expect(ingest.sessionID == "mp.session")
    #expect(ingest.decision == .keep)
    #expect(ingest.freshnessStatus == .fresh)
    #expect(ingest.alignmentStatus == .aligned)
    #expect(ingest.updatedMemoryIDs == [ingest.primaryMemoryID])
    #expect(align.projectID == "mp.local-runtime")
    #expect(align.memoryID == ingest.primaryMemoryID)
    #expect(align.decision == .keep)
    #expect(align.freshnessStatus == .fresh)
    #expect(align.alignmentStatus == .aligned)
    #expect(submitted.promotionState == .submittedToParent)
    #expect(submitted.sessionID == "mp.session")
    #expect(accepted.promotionState == .acceptedByParent)
    #expect(promote.projectID == "mp.local-runtime")
    #expect(promote.memoryID == ingest.primaryMemoryID)
    #expect(promote.scopeLevel == .project)
    #expect(promote.sessionMode == .shared)
    #expect(promote.visibilityState == .projectShared)
    #expect(promote.promotionState == .promotedToProject)
    #expect(resolve.projectID == "mp.local-runtime")
    #expect(resolve.primaryMemoryIDs == [ingest.primaryMemoryID])
    #expect(resolve.rerankComposition.superseded == 0)
    #expect(resolve.roleCounts[.dispatcher] == 1)
    #expect(resolve.roleStages[.dispatcher] == .assembleBundle)
    #expect(history.projectID == "mp.local-runtime")
    #expect(history.requesterAgentID == "runtime.local")
    #expect(history.reason == "Need historical context")
    #expect(history.primaryMemoryIDs == [ingest.primaryMemoryID])
    #expect(history.roleCounts[.dispatcher] == 1)
    #expect(history.roleStages[.dispatcher] == .assembleBundle)
    #expect(archive.projectID == "mp.local-runtime")
    #expect(archive.memoryID == ingest.primaryMemoryID)
    #expect(archive.scopeLevel == .project)
    #expect(archive.sessionMode == .shared)
    #expect(archive.visibilityState == .archived)
    #expect(archive.promotionState == .archived)
  }

  @Test
  func mpIngestAlignPromoteArchiveSnapshotsRoundTripTypedEnums() throws {
    let ingest = PraxisMpIngestSnapshot(
      projectID: "mp.local-runtime",
      agentID: "runtime.local",
      sessionID: "mp.session",
      summary: "MP ingest kept 1 aligned memory record.",
      primaryMemoryID: "memory.primary",
      storageKey: "memory://primary",
      updatedMemoryIDs: ["memory.primary"],
      supersededMemoryIDs: [],
      staleMemoryIDs: [],
      decision: .keep,
      freshnessStatus: .fresh,
      alignmentStatus: .aligned,
      issues: []
    )
    let promote = PraxisMpPromoteSnapshot(
      projectID: "mp.local-runtime",
      memoryID: "memory.primary",
      summary: "MP promote moved memory.primary into project scope.",
      scopeLevel: .project,
      sessionID: "mp.session",
      sessionMode: .shared,
      visibilityState: .projectShared,
      promotionState: .promotedToProject,
      updatedAt: "2026-04-11T10:08:00Z",
      issues: []
    )
    let encodedIngest = try encodeFacadeTestJSON(ingest)
    let encodedPromote = try encodeFacadeTestJSON(promote)
    let decodedIngest = try decodeFacadeTestJSON(PraxisMpIngestSnapshot.self, from: encodedIngest)
    let decodedPromote = try decodeFacadeTestJSON(PraxisMpPromoteSnapshot.self, from: encodedPromote)

    #expect(encodedIngest.contains(#""decision":"keep""#))
    #expect(encodedIngest.contains(#""freshnessStatus":"fresh""#))
    #expect(encodedIngest.contains(#""alignmentStatus":"aligned""#))
    #expect(encodedPromote.contains(#""scopeLevel":"project""#))
    #expect(encodedPromote.contains(#""sessionMode":"shared""#))
    #expect(encodedPromote.contains(#""visibilityState":"project_shared""#))
    #expect(encodedPromote.contains(#""promotionState":"promoted_to_project""#))
    #expect(decodedIngest.decision == .keep)
    #expect(decodedIngest.freshnessStatus == .fresh)
    #expect(decodedIngest.alignmentStatus == .aligned)
    #expect(decodedPromote.scopeLevel == PraxisMpScopeLevel.project)
    #expect(decodedPromote.sessionMode == PraxisMpSessionMode.shared)
    #expect(decodedPromote.visibilityState == PraxisMpVisibilityState.projectShared)
    #expect(decodedPromote.promotionState == PraxisMpPromotionState.promotedToProject)
  }

  @Test
  func mpTypedFacadeSnapshotsRejectUnknownEnumRawValues() throws {
    let invalidAlignJSON =
      #"{"alignmentStatus":"aligned","decision":"keep","freshnessStatus":"not_a_real_freshness","issues":[],"memoryID":"memory.primary","primaryMemoryID":"memory.primary","projectID":"mp.local-runtime","staleMemoryIDs":[],"summary":"MP align kept 1 aligned memory record.","supersededMemoryIDs":[],"updatedMemoryIDs":["memory.primary"]}"#
    let invalidArchiveJSON =
      #"{"issues":[],"memoryID":"memory.primary","projectID":"mp.local-runtime","promotionState":"archived","scopeLevel":"project","sessionID":"mp.session","sessionMode":"not_a_real_session_mode","summary":"MP archive marked memory.primary archived.","updatedAt":"2026-04-11T10:09:00Z","visibilityState":"archived"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisMpAlignSnapshot.self, from: invalidAlignJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisMpArchiveSnapshot.self, from: invalidArchiveJSON)
    }
  }

  @Test
  func mpSearchHitSnapshotsRoundTripTypedEnums() throws {
    let hit = PraxisMpSearchHitSnapshot(
      memoryID: "memory.primary",
      agentID: "runtime.local",
      scopeLevel: .project,
      memoryKind: .summary,
      freshnessStatus: .aging,
      alignmentStatus: .unreviewed,
      summary: "Shared onboarding summary",
      storageKey: "memory/supporting",
      semanticScore: 0.62,
      finalScore: 0.78,
      rankExplanation: "Project summary ranked after semantic score adjustment."
    )
    let encoded = try encodeFacadeTestJSON(hit)
    let decoded = try decodeFacadeTestJSON(PraxisMpSearchHitSnapshot.self, from: encoded)

    #expect(encoded.contains(#""scopeLevel":"project""#))
    #expect(encoded.contains(#""memoryKind":"summary""#))
    #expect(encoded.contains(#""freshnessStatus":"aging""#))
    #expect(encoded.contains(#""alignmentStatus":"unreviewed""#))
    #expect(decoded.scopeLevel == .project)
    #expect(decoded.memoryKind == .summary)
    #expect(decoded.freshnessStatus == .aging)
    #expect(decoded.alignmentStatus == .unreviewed)
  }

  @Test
  func mpSearchHitSnapshotsRejectUnknownEnumRawValues() throws {
    let invalidSearchHitJSON =
      #"{"agentID":"runtime.local","alignmentStatus":"aligned","finalScore":0.92,"freshnessStatus":"fresh","memoryID":"memory.primary","memoryKind":"not_a_real_memory_kind","rankExplanation":"Primary search hit.","scopeLevel":"project","semanticScore":0.88,"storageKey":"memory/primary","summary":"Host runtime onboarding note"}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisMpSearchHitSnapshot.self, from: invalidSearchHitJSON)
    }
  }

  @Test
  func mpReadbackSnapshotRoundTripsTypedBreakdownMapsAndRejectsUnknownKeys() throws {
    let snapshot = PraxisMpReadbackSnapshot(
      projectID: "mp.local-runtime",
      summary: "MP readback reconstructed 3 memory record(s).",
      totalMemoryCount: 3,
      primaryCount: 1,
      supportingCount: 2,
      omittedSupersededCount: 1,
      freshnessBreakdown: .init(counts: [.fresh: 2, .aging: 1]),
      alignmentBreakdown: .init(counts: [.aligned: 2, .unreviewed: 1]),
      scopeBreakdown: .init(counts: [.project: 2, .agentIsolated: 1]),
      issues: []
    )
    let encoded = try encodeFacadeTestJSON(snapshot)
    let decoded = try decodeFacadeTestJSON(PraxisMpReadbackSnapshot.self, from: encoded)

    #expect(encoded.contains(#""freshnessBreakdown":{"aging":1,"fresh":2}"#))
    #expect(encoded.contains(#""alignmentBreakdown":{"aligned":2,"unreviewed":1}"#))
    #expect(encoded.contains(#""scopeBreakdown":{"agent_isolated":1,"project":2}"#))
    #expect(decoded.freshnessBreakdown == PraxisMpFreshnessBreakdownMap(counts: [.fresh: 2, .aging: 1]))
    #expect(decoded.alignmentBreakdown == PraxisMpAlignmentBreakdownMap(counts: [.aligned: 2, .unreviewed: 1]))
    #expect(decoded.scopeBreakdown == PraxisMpScopeBreakdownMap(counts: [.project: 2, .agentIsolated: 1]))

    let invalidSnapshotJSON =
      #"{"alignmentBreakdown":{"aligned":2},"freshnessBreakdown":{"fresh":2},"issues":[],"omittedSupersededCount":0,"primaryCount":1,"projectID":"mp.local-runtime","scopeBreakdown":{"not_a_real_scope":1},"summary":"MP readback reconstructed 1 memory record(s).","supportingCount":0,"totalMemoryCount":1}"#

    do {
      _ = try decodeFacadeTestJSON(PraxisMpReadbackSnapshot.self, from: invalidSnapshotJSON)
      Issue.record("Expected MP readback snapshot to reject unknown typed breakdown keys.")
    } catch {}
  }

  @Test
  func mpResolveAndHistorySnapshotsRoundTripTypedRoleTelemetry() throws {
    let resolve = PraxisMpResolveSnapshot(
      projectID: "mp.local-runtime",
      query: "onboarding",
      summary: "MP resolve assembled 1 primary and 0 supporting memory record(s) for query onboarding.",
      primaryMemoryIDs: ["memory.primary"],
      supportingMemoryIDs: [],
      omittedSupersededMemoryIDs: [],
      rerankComposition: .init(fresh: 1, aging: 0, stale: 0, superseded: 0, aligned: 1, unreviewed: 0, drifted: 0),
      roleCounts: .init(counts: [.dispatcher: 1]),
      roleStages: .init(stages: [.dispatcher: .assembleBundle]),
      issues: []
    )
    let history = PraxisMpHistorySnapshot(
      projectID: "mp.local-runtime",
      requesterAgentID: "runtime.local",
      query: "onboarding",
      reason: "Need historical context",
      summary: "MP history returned 1 primary and 0 supporting memory record(s) for runtime.local.",
      primaryMemoryIDs: ["memory.primary"],
      supportingMemoryIDs: [],
      omittedSupersededMemoryIDs: [],
      rerankComposition: .init(fresh: 1, aging: 0, stale: 0, superseded: 0, aligned: 1, unreviewed: 0, drifted: 0),
      roleCounts: .init(counts: [.dispatcher: 1]),
      roleStages: .init(stages: [.dispatcher: .assembleBundle]),
      issues: []
    )

    let encodedResolve = try encodeFacadeTestJSON(resolve)
    let encodedHistory = try encodeFacadeTestJSON(history)
    let decodedResolve = try decodeFacadeTestJSON(PraxisMpResolveSnapshot.self, from: encodedResolve)
    let decodedHistory = try decodeFacadeTestJSON(PraxisMpHistorySnapshot.self, from: encodedHistory)

    #expect(encodedResolve.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(encodedResolve.contains(#""roleStages":{"dispatcher":"assemble_bundle"}"#))
    #expect(encodedHistory.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(encodedHistory.contains(#""roleStages":{"dispatcher":"assemble_bundle"}"#))
    #expect(decodedResolve.roleCounts[.dispatcher] == 1)
    #expect(decodedResolve.roleStages[.dispatcher] == .assembleBundle)
    #expect(decodedHistory.roleCounts[.dispatcher] == 1)
    #expect(decodedHistory.roleStages[.dispatcher] == .assembleBundle)
  }

  @Test
  func mpResolveAndHistorySnapshotsRejectUnknownTypedRoleTelemetryRawValues() throws {
    let invalidResolveJSON =
      #"{"issues":[],"omittedSupersededMemoryIDs":[],"primaryMemoryIDs":["memory.primary"],"projectID":"mp.local-runtime","query":"onboarding","rerankComposition":{"aging":0,"aligned":1,"drifted":0,"fresh":1,"stale":0,"superseded":0,"unreviewed":0},"roleCounts":{"ghost":1},"roleStages":{"dispatcher":"assemble_bundle"},"summary":"MP resolve assembled 1 primary and 0 supporting memory record(s) for query onboarding.","supportingMemoryIDs":[]}"#
    let invalidHistoryJSON =
      #"{"issues":[],"omittedSupersededMemoryIDs":[],"primaryMemoryIDs":["memory.primary"],"projectID":"mp.local-runtime","query":"onboarding","reason":"Need historical context","requesterAgentID":"runtime.local","rerankComposition":{"aging":0,"aligned":1,"drifted":0,"fresh":1,"stale":0,"superseded":0,"unreviewed":0},"roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"broken_stage"},"summary":"MP history returned 1 primary and 0 supporting memory record(s) for runtime.local.","supportingMemoryIDs":[]}"#

    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisMpResolveSnapshot.self, from: invalidResolveJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeFacadeTestJSON(PraxisMpHistorySnapshot.self, from: invalidHistoryJSON)
    }
  }

  @Test
  func mpFacadeWorkflowSnapshotsPreserveBoundaryIDsWithoutHostPresentationFields() async throws {
    let memoryStore = PraxisFakeSemanticMemoryStore(
      seedRecords: [
        PraxisSemanticMemoryRecord(
          id: " memory.primary ",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .semantic,
          summary: "onboarding primary memory",
          storageKey: " memory/primary ",
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-13T10:02:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: " memory.supporting ",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "onboarding supporting memory",
          storageKey: " memory/supporting ",
          freshnessStatus: .aging,
          alignmentStatus: .unreviewed,
          updatedAt: "2026-04-13T10:01:00Z"
        ),
        PraxisSemanticMemoryRecord(
          id: " memory.superseded ",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          scopeLevel: .project,
          memoryKind: .summary,
          summary: "onboarding superseded memory",
          storageKey: " memory/superseded ",
          freshnessStatus: .superseded,
          alignmentStatus: .aligned,
          updatedAt: "2026-04-13T10:00:00Z"
        ),
      ]
    )
    let facade = try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: PraxisHostAdapterRegistry(semanticMemoryStore: memoryStore),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let ingest = try await facade.mpFacade.ingest(
      .init(
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: " session.ingest ",
        summary: "Persist host-neutral memory state",
        checkedSnapshotRef: .init(rawValue: "snapshot.mp.runtime"),
        branchRef: "main",
        storageKey: "memory/created"
      )
    )
    let resolve = try await facade.mpFacade.resolve(
      .init(
        projectID: "mp.local-runtime",
        query: "onboarding",
        requesterAgentID: "runtime.local",
        requesterSessionID: "session.resolve",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await facade.mpFacade.requestHistory(
      .init(
        projectID: "mp.local-runtime",
        requesterAgentID: "runtime.local",
        requesterSessionID: "history.session",
        reason: "Need historical context",
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let align = try await facade.mpFacade.align(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        alignedAt: "2026-04-13T10:06:00Z",
        queryText: "verify onboarding summary"
      )
    )
    let archive = try await facade.mpFacade.archive(
      .init(
        projectID: "mp.local-runtime",
        memoryID: ingest.primaryMemoryID,
        archivedAt: "2026-04-13T10:08:00Z",
        reason: "Archive superseded onboarding memory"
      )
    )

    let encodedIngest = try encodeFacadeTestJSON(ingest)
    let encodedAlign = try encodeFacadeTestJSON(align)
    let encodedArchive = try encodeFacadeTestJSON(archive)
    let encodedResolve = try encodeFacadeTestJSON(resolve)
    let encodedHistory = try encodeFacadeTestJSON(history)

    #expect(encodedIngest.contains(#""sessionID":" session.ingest ""#))
    #expect(encodedIngest.contains(#""storageKey":"memory\/created""#))
    #expect(encodedAlign.contains(#""updatedMemoryIDs":["\#(ingest.primaryMemoryID)"]"#))
    #expect(encodedAlign.contains(#""supersededMemoryIDs":[]"#))
    #expect(encodedAlign.contains(#""staleMemoryIDs":[]"#))
    #expect(encodedArchive.contains(#""memoryID":"\#(ingest.primaryMemoryID)""#))
    #expect(encodedResolve.contains(#""primaryMemoryIDs":["memory.primary"]"#))
    #expect(encodedResolve.contains(#""supportingMemoryIDs":["memory.supporting"]"#))
    #expect(encodedResolve.contains(#""omittedSupersededMemoryIDs":["memory.superseded"]"#))
    #expect(encodedHistory.contains(#""primaryMemoryIDs":["memory.primary"]"#))
    #expect(encodedHistory.contains(#""supportingMemoryIDs":["memory.supporting"]"#))
    #expect(encodedHistory.contains(#""omittedSupersededMemoryIDs":["memory.superseded"]"#))

    for encoded in [
      encodedIngest,
      encodedAlign,
      encodedArchive,
      encodedResolve,
      encodedHistory,
    ] {
      for forbiddenKey in ["\"title\":", "\"kind\":", "\"terminal\"", "\"screen\"", "\"viewState\"", "\"buttonLabel\""] {
        #expect(!encoded.contains(forbiddenKey))
      }
    }

    #expect(ingest.sessionID == " session.ingest ")
    #expect(align.updatedMemoryIDs == [ingest.primaryMemoryID])
    #expect(align.supersededMemoryIDs.isEmpty)
    #expect(align.staleMemoryIDs.isEmpty)
    #expect(archive.memoryID == ingest.primaryMemoryID)
    #expect(resolve.primaryMemoryIDs == ["memory.primary"])
    #expect(resolve.supportingMemoryIDs == ["memory.supporting"])
    #expect(resolve.omittedSupersededMemoryIDs == ["memory.superseded"])
    #expect(history.primaryMemoryIDs == ["memory.primary"])
    #expect(history.supportingMemoryIDs == ["memory.supporting"])
    #expect(history.omittedSupersededMemoryIDs == ["memory.superseded"])
  }
}
