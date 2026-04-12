import Testing
import Foundation
import PraxisCheckpoint
import PraxisCmpFiveAgent
import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisGoal
import PraxisInfraContracts
import PraxisJournal
import PraxisRun
import PraxisSession
import PraxisState
import PraxisTapReview
import PraxisTapTypes
import PraxisToolingContracts
import PraxisWorkspaceContracts
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimeInterface
@testable import PraxisRuntimePresentationBridge

private func encodeTestJSON<T: Encodable>(_ value: T) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  guard let string = String(data: try encoder.encode(value), encoding: .utf8) else {
    throw PraxisError.invariantViolation("Failed to encode test runtime payload as UTF-8 JSON.")
  }
  return string
}

private func decodeTestJSON<T: Decodable>(_ type: T.Type, from string: String) throws -> T {
  guard let data = string.data(using: .utf8) else {
    throw PraxisError.invalidInput("Failed to decode test runtime payload from UTF-8 JSON.")
  }
  return try JSONDecoder().decode(type, from: data)
}

private func runHostTestProcess(
  executablePath: String,
  arguments: [String],
  currentDirectoryURL: URL? = nil
) throws -> (stdout: String, stderr: String, exitCode: Int32) {
  let process = Process()
  let stdoutPipe = Pipe()
  let stderrPipe = Pipe()
  process.executableURL = URL(fileURLWithPath: executablePath, isDirectory: false)
  process.arguments = arguments
  process.currentDirectoryURL = currentDirectoryURL
  process.standardOutput = stdoutPipe
  process.standardError = stderrPipe
  try process.run()
  process.waitUntilExit()
  return (
    stdout: String(decoding: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self),
    stderr: String(decoding: stderrPipe.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self),
    exitCode: process.terminationStatus
  )
}

private func seedRecoverProjectionDescriptor(
  in registry: PraxisHostAdapterRegistry,
  projectID: String = "cmp.local-runtime",
  projectionID: String = "projection.recover.runtime",
  lineageID: String = "lineage.cmp.local-runtime.runtime.local",
  agentID: String = "runtime.local",
  updatedAt: String = "2026-04-11T04:00:00Z"
) async throws -> PraxisProjectionRecordDescriptor {
  let descriptor = PraxisProjectionRecordDescriptor(
    projectID: projectID,
    projectionID: .init(rawValue: projectionID),
    lineageID: .init(rawValue: lineageID),
    agentID: agentID,
    visibilityLevel: .submittedToParent,
    storageKey: "sqlite://cmp/\(projectionID)",
    updatedAt: updatedAt,
    summary: "Recover projection seed \(projectionID)",
    metadata: [
      "branchRef": .string("cmp/\(agentID)"),
      "selectedSectionIDs": .array([.string("\(projectionID):section")]),
    ]
  )
  _ = try await registry.projectionStore?.save(descriptor)
  return descriptor
}

private func makeCheckpointRecord(
  status: PraxisAgentStatus,
  sessionID: PraxisSessionID,
  runID: PraxisRunID,
  tickCount: Int,
  lastCursor: PraxisJournalCursor?,
  lastErrorCode: String? = nil,
  lastErrorMessage: String? = nil
) throws -> PraxisCheckpointRecord {
  let phase: PraxisRunPhase
  switch status {
  case .paused:
    phase = .paused
  case .failed:
    phase = .failed
  case .waiting, .acting:
    phase = .running
  case .idle, .deciding:
    phase = .queued
  case .created:
    phase = .created
  case .completed:
    phase = .completed
  case .cancelled:
    phase = .cancelled
  }

  let checkpointID = PraxisCheckpointID(rawValue: "checkpoint.\(runID.rawValue)")
  let state = PraxisStateSnapshot(
    control: .init(status: status, phase: .recovery, retryCount: status == .failed ? 1 : 0),
    working: [:],
    observed: .init(),
    recovery: .init(
      lastCheckpointRef: checkpointID.rawValue,
      resumePointer: lastCursor.map { "cursor.\($0.sequence)" },
      lastErrorCode: lastErrorCode,
      lastErrorMessage: lastErrorMessage
    )
  )
  let aggregate = PraxisRunAggregate(
    id: runID,
    phase: phase,
    tickCount: tickCount,
    lastEventID: "evt.seed.\(runID.rawValue)",
    lastCheckpointReference: checkpointID.rawValue,
    failure: status == .failed ? .init(summary: lastErrorMessage ?? "Run failed.", code: lastErrorCode) : nil,
    latestState: state
  )
  let header = PraxisSessionHeader(
    id: sessionID,
    title: "Restored \(status.rawValue) run",
    temperature: .warm,
    activeRunReference: runID.rawValue,
    runReferences: [runID.rawValue],
    lastCheckpointReference: checkpointID.rawValue,
    lastJournalSequence: lastCursor?.sequence
  )
  let snapshot = PraxisCheckpointSnapshot(
    id: checkpointID,
    sessionID: sessionID,
    tier: .fast,
    createdAt: "2026-04-10T20:00:00Z",
    lastCursor: lastCursor,
    payload: [
      "runAggregateJSON": .string(try encodeTestJSON(aggregate)),
      "sessionHeaderJSON": .string(try encodeTestJSON(header)),
      "goalTitle": .string("Restored \(status.rawValue) run"),
    ]
  )
  return PraxisCheckpointRecord(
    pointer: .init(checkpointID: checkpointID, sessionID: sessionID),
    snapshot: snapshot
  )
}

struct HostRuntimeSurfaceTests {
  @Test
  func runtimeSurfaceModelsCaptureLocalHostProfileAndSmokeViews() {
    let hostProfile = PraxisLocalRuntimeHostProfile(
      executionStyle: .localFirst,
      structuredStore: .sqlite,
      deliveryStore: .sqlite,
      messageTransport: .inProcessActorBus,
      gitAccess: .systemGit,
      semanticIndex: .partial
    )
    let runtimeSummary = PraxisCmpProjectLocalRuntimeSummary(
      projectID: "project-1",
      hostProfile: hostProfile,
      componentStatuses: .init(statuses: [
        .structuredStore: .ready,
        .messageBus: .ready,
        .gitExecutor: .degraded,
      ]),
      issues: ["system git may require Command Line Tools installation"]
    )
    let smoke = PraxisRuntimeSmokeResult(
      summary: "local runtime mostly ready",
      checks: [
        .init(id: "cmp.host.sqlite", gate: "host", status: .ready, summary: "SQLite host profile ready"),
        .init(id: "cmp.host.git", gate: "host", status: .degraded, summary: "git may still need first-run installation")
      ]
    )

    #expect(runtimeSummary.hostProfile.executionStyle == .localFirst)
    #expect(runtimeSummary.componentStatuses[.gitExecutor] == .degraded)
    #expect(smoke.checks.count == 2)
  }

  @Test
  func cmpSmokeSurfaceModelsPreserveMissingStatus() {
    let smoke = PraxisCmpProjectSmokeResult(
      summary: "CMP smoke summary",
      checks: [
        .init(
          id: "cmp.project.delivery",
          gate: .delivery,
          status: .missing,
          summary: "Delivery coordination summary: store is missing."
        )
      ]
    )

    #expect(smoke.checks.count == 1)
    #expect(smoke.checks.first?.gate == .delivery)
    #expect(smoke.checks.first?.status == .missing)
  }

  @Test
  func runtimeFacadeAndBridgeExposeHostBackedInspectionFlow() async throws {
    let hostAdapters = PraxisHostAdapterRegistry.scaffoldDefaults()
    let compositionRoot = PraxisRuntimeBridgeFactory.makeCompositionRoot(hostAdapters: hostAdapters)
    let dependencies = try compositionRoot.makeDependencyGraph()
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)
    let bridge = try PraxisRuntimeBridgeFactory.makeCLICommandBridge(hostAdapters: hostAdapters)

    let architectureState = try await bridge.handle(.init(intent: .inspectArchitecture, payloadSummary: ""))
    let tapState = try await bridge.handle(.init(intent: .inspectTap, payloadSummary: ""))
    let cmpState = try await bridge.handle(.init(intent: .inspectCmp, payloadSummary: ""))
    let mpState = try await bridge.handle(.init(intent: .inspectMp, payloadSummary: ""))
    let catalog = try await runtimeFacade.inspectionFacade.buildCapabilityCatalogSnapshot()
    let tapStatus = try await runtimeFacade.inspectionFacade.readbackTapStatus(
      .init(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )
    let tapHistory = try await runtimeFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "runtime.local", limit: 5)
    )

    #expect(architectureState.title == "Praxis Architecture")
    #expect(tapState.title == "TAP Inspection")
    #expect(cmpState.title == "CMP Inspection")
    #expect(mpState.title == "MP Inspection")
    #expect(tapState.summary.contains("checkpoint snapshot"))
    #expect(cmpState.summary.contains("sqlite persistence"))
    #expect(cmpState.summary.contains("install_prompt_expected"))
    #expect(mpState.summary.contains("Store:"))
    #expect(mpState.summary.contains("0 primary records"))
    #expect(catalog.summary.contains("Capability catalog assembled from current boundaries:"))
    #expect(catalog.summary.contains("Registered host capability surfaces:"))
    #expect(catalog.summary.contains("PraxisCmpFiveAgent"))
    #expect(tapStatus.projectID == "cmp.local-runtime")
    #expect(tapStatus.agentID == "runtime.local")
    #expect(tapStatus.availableCapabilityCount > 0)
    #expect(tapHistory.projectID == "cmp.local-runtime")
    #expect(tapHistory.agentID == "runtime.local")
    #expect(tapHistory.totalCount == 0)
    #expect(dependencies.hostAdapters.providerInferenceExecutor != nil)
    #expect(dependencies.hostAdapters.checkpointStore != nil)

    let runState = try await bridge.handle(.init(intent: .runGoal, payloadSummary: "Bridge next action smoke"))
    let bridgeEvents = await bridge.snapshotEvents()

    #expect(runState.title == "Run run:session.cli.goal:cli.goal")
    #expect(runState.summary.contains("Next action model_inference"))
    #expect(runState.pendingIntentID == "evt.created.run:session.cli.goal:cli.goal:model")
    #expect(runState.events.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(bridgeEvents.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(bridgeEvents.last?.intentID == "evt.created.run:session.cli.goal:cli.goal:model")
  }

  @Test
  func cmpFacadeExposesNeutralSessionBootstrapReadbackAndSmokeSnapshots() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-cmp-facade-surface-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let hostAdapters = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(
      hostAdapters: hostAdapters
    )

    let session = try await runtimeFacade.cmpFacade.openSession(
      .init(projectID: "cmp.local-runtime", sessionID: "cmp.session.surface")
    )
    let bootstrap = try await runtimeFacade.cmpFacade.bootstrapProject(
      .init(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let ingest = try await runtimeFacade.cmpFacade.ingestFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.session",
        taskSummary: "Capture one runtime material",
        materials: [
          .init(kind: .userInput, ref: "payload:user:cmp")
        ],
        requiresActiveSync: true
      )
    )
    let commit = try await runtimeFacade.cmpFacade.commitFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.session",
        eventIDs: ["evt.cmp.1"],
        changeSummary: "Commit one flow event",
        syncIntent: .toParent
      )
    )
    _ = try await runtimeFacade.runFacade.runGoal(
      .init(
        goal: .init(
          normalizedGoal: .init(
            id: .init(rawValue: "goal.cmp-flow-surface"),
            title: "CMP Flow Surface Goal",
            summary: "Seed projection for flow resolve"
          ),
          intentSummary: "Seed projection for flow resolve"
        ),
        sessionID: .init(rawValue: "session.cmp-flow-surface")
      )
    )
    let resolve = try await runtimeFacade.cmpFacade.resolveFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local"
      )
    )
    let resolvedSnapshotID = try #require(resolve.snapshotID)
    let materialize = try await runtimeFacade.cmpFacade.materializeFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        snapshotID: resolvedSnapshotID,
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal
      )
    )
    let dispatchPackage = PraxisCmpContextPackage(
      id: .init(rawValue: materialize.packageID),
      sourceProjectionID: .init(rawValue: "projection.runtime.local"),
      sourceSnapshotID: .init(rawValue: resolvedSnapshotID),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")]
    )
    let dispatch = try await runtimeFacade.cmpFacade.dispatchFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: dispatchPackage,
        targetKind: .peer,
        reason: "Forward runtime fill to checker"
      )
    )
    let history = try await runtimeFacade.cmpFacade.requestHistory(
      .init(
        projectID: "cmp.local-runtime",
        requesterAgentID: "checker.local",
        reason: "Recover runtime fill",
        query: .init(
          snapshotID: .init(rawValue: resolvedSnapshotID),
          packageKindHint: .runtimeFill
        )
      )
    )
    let controlUpdate = try await runtimeFacade.cmpFacade.updateControl(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        readbackPriority: .packageFirst,
        fallbackPolicy: .registryOnly,
        recoveryPreference: .resumeLatest,
        automation: ["autoDispatch": false]
      )
    )
    let rolesPanel = try await runtimeFacade.cmpFacade.readbackRoles(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let controlPanel = try await runtimeFacade.cmpFacade.readbackControl(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let peerApproval = try await runtimeFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let approvalReadback = try await runtimeFacade.cmpFacade.readbackPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )
    _ = try await runtimeFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.shell",
        requestedTier: .b2,
        summary: "Escalate shell access to checker"
      )
    )
    let tapStatus = try await runtimeFacade.inspectionFacade.readbackTapStatus(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let tapHistory = try await runtimeFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
    )
    let statusPanel = try await runtimeFacade.cmpFacade.readbackStatus(
      .init(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )
    let checkerStatusPanel = try await runtimeFacade.cmpFacade.readbackStatus(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let readback = try await runtimeFacade.cmpFacade.readbackProject(.init(projectID: "cmp.local-runtime"))
    let smoke = try await runtimeFacade.cmpFacade.smokeProject(.init(projectID: "cmp.local-runtime"))

    #expect(session.projectID == "cmp.local-runtime")
    #expect(session.hostProfile.executionStyle == .localFirst)
    #expect(session.summary.contains("host-neutral CMP session"))
    #expect(bootstrap.projectSummary.projectID == "cmp.local-runtime")
    #expect(bootstrap.projectSummary.componentStatuses[.gitProbe] == .ready)
    #expect(bootstrap.projectSummary.componentStatuses[.gitExecutor] == .ready)
    #expect(bootstrap.gitSummary.contains("2 branch runtimes"))
    #expect(bootstrap.persistenceSummary.contains("bootstrap statements"))
    #expect(ingest.projectID == "cmp.local-runtime")
    #expect(ingest.sessionID == "cmp.flow.session")
    #expect(ingest.acceptedEventCount == 1)
    #expect(ingest.nextAction == .commitContextDelta)
    #expect(commit.projectID == "cmp.local-runtime")
    #expect(commit.activeLineStage == .candidateReady)
    #expect(commit.snapshotCandidateID != nil)
    #expect(resolve.projectID == "cmp.local-runtime")
    #expect(resolve.found)
    #expect(resolve.snapshotID != nil)
    #expect(resolve.qualityLabel == .usable)
    #expect(materialize.projectID == "cmp.local-runtime")
    #expect(materialize.targetAgentID == "checker.local")
    #expect(materialize.packageKind == .runtimeFill)
    #expect(materialize.selectedSectionCount > 0)
    #expect(dispatch.projectID == "cmp.local-runtime")
    #expect(dispatch.targetAgentID == "checker.local")
    #expect(dispatch.targetKind == .peer)
    #expect(dispatch.status == .delivered)
    #expect(history.projectID == "cmp.local-runtime")
    #expect(history.requesterAgentID == "checker.local")
    #expect(history.found)
    #expect(history.packageID != nil)
    #expect(controlUpdate.projectID == "cmp.local-runtime")
    #expect(controlUpdate.agentID == "checker.local")
    #expect(controlUpdate.executionStyle == .manual)
    #expect(controlUpdate.mode == .peerReview)
    #expect(controlUpdate.fallbackPolicy == .registryOnly)
    #expect(controlUpdate.recoveryPreference == .resumeLatest)
    #expect(controlUpdate.automation["autoDispatch"] == false)
    #expect(rolesPanel.projectID == "cmp.local-runtime")
    #expect(rolesPanel.agentID == "checker.local")
    #expect(rolesPanel.roleCounts[.dispatcher] == 1)
    #expect(rolesPanel.roleStages[.dispatcher] == .delivered)
    #expect(rolesPanel.latestPackageID == materialize.packageID)
    #expect(!rolesPanel.summary.contains("CLI"))
    #expect(!rolesPanel.summary.contains("GUI"))
    #expect(controlPanel.projectID == "cmp.local-runtime")
    #expect(controlPanel.agentID == "checker.local")
    #expect(controlPanel.executionStyle == .manual)
    #expect(controlPanel.mode == .peerReview)
    #expect(controlPanel.readbackPriority == .packageFirst)
    #expect(controlPanel.fallbackPolicy == .registryOnly)
    #expect(controlPanel.recoveryPreference == .resumeLatest)
    #expect(controlPanel.automation["autoDispatch"] == false)
    #expect(controlPanel.latestDispatchStatus == .delivered)
    #expect(controlPanel.latestTargetAgentID == "checker.local")
    #expect(!controlPanel.summary.contains("CLI"))
    #expect(!controlPanel.summary.contains("GUI"))
    #expect(peerApproval.projectID == "cmp.local-runtime")
    #expect(peerApproval.targetAgentID == "checker.local")
    #expect(peerApproval.capabilityKey == "tool.git")
    #expect(peerApproval.requestedTier == .b1)
    #expect(peerApproval.tapMode == .restricted)
    #expect(peerApproval.route == .humanReview)
    #expect(peerApproval.outcome == .escalatedToHuman)
    #expect(peerApproval.humanGateState == .waitingApproval)
    #expect(approvalReadback.projectID == "cmp.local-runtime")
    #expect(approvalReadback.found)
    #expect(approvalReadback.capabilityKey == "tool.git")
    #expect(approvalReadback.requestedTier == .b1)
    #expect(approvalReadback.route == .humanReview)
    #expect(approvalReadback.outcome == .escalatedToHuman)
    #expect(tapStatus.projectID == "cmp.local-runtime")
    #expect(tapStatus.agentID == "checker.local")
    #expect(tapStatus.tapMode == .restricted)
    #expect(tapStatus.humanGateState == .waitingApproval)
    #expect(tapStatus.pendingApprovalCount == 2)
    #expect(["tool.git", "tool.shell"].contains(tapStatus.latestCapabilityKey ?? ""))
    #expect(tapHistory.projectID == "cmp.local-runtime")
    #expect(tapHistory.agentID == "checker.local")
    #expect(tapHistory.totalCount == 6)
    #expect(tapHistory.entries.count == 6)
    #expect(Set(tapHistory.entries.map(\.capabilityKey)) == Set(["tool.git", "tool.shell", "control_updated", "dispatch_released"]))
    #expect(tapHistory.entries.contains { $0.route == .humanReview })
    #expect(tapHistory.entries.contains { $0.route == .autoApprove })
    #expect(tapHistory.entries.contains { $0.humanGateState == .waitingApproval })
    #expect(tapHistory.entries.contains { $0.humanGateState == .notRequired })
    #expect(statusPanel.projectID == "cmp.local-runtime")
    #expect(statusPanel.agentID == "runtime.local")
    #expect(statusPanel.executionStyle == .automatic)
    #expect(statusPanel.readbackPriority == .gitFirst)
    #expect(statusPanel.packageCount >= 1)
    #expect(statusPanel.packageStatusCounts[.dispatched] == 1)
    #expect(statusPanel.roleCounts[.dispatcher] == 1)
    #expect(statusPanel.latestPackageID != nil)
    #expect(checkerStatusPanel.projectID == "cmp.local-runtime")
    #expect(checkerStatusPanel.agentID == "checker.local")
    #expect(checkerStatusPanel.packageCount >= 1)
    #expect(checkerStatusPanel.latestPackageID == materialize.packageID)
    #expect(checkerStatusPanel.latestDispatchStatus == .delivered)
    #expect(checkerStatusPanel.roleStages[.dispatcher] == .delivered)
    #expect(readback.projectSummary.projectID == "cmp.local-runtime")
    #expect(readback.projectSummary.hostProfile.structuredStore == .sqlite)
    #expect(readback.persistenceSummary.contains("Checkpoint and journal persistence"))
    #expect(smoke.projectID == "cmp.local-runtime")
    #expect(smoke.smokeResult.checks.count == 5)
    let gitSmokeStatus = try #require(smoke.smokeResult.checks.first { $0.gate == .git }?.status)
    let expectedGitSmokeStatus: PraxisCmpProjectComponentStatus
    switch readback.projectSummary.componentStatuses[.gitExecutor] {
    case .ready:
      expectedGitSmokeStatus = .ready
    case .degraded:
      expectedGitSmokeStatus = .degraded
    case .missing, nil:
      expectedGitSmokeStatus = .missing
    }
    #expect(gitSmokeStatus == expectedGitSmokeStatus)
    #expect(smoke.smokeResult.checks.map(\.gate).contains(.workspace))

    let runtimeLineage = try await hostAdapters.lineageStore?.describe(
      .init(lineageID: .init(rawValue: "lineage.cmp.local-runtime.runtime.local"))
    )
    let deliveryTruth = try await hostAdapters.deliveryTruthStore?.lookup(
      .init(packageID: .init(rawValue: materialize.packageID))
    ) ?? []
    #expect(runtimeLineage?.summary == "CMP bootstrap lineage runtime.local at depth 0.")
    #expect(deliveryTruth.count == 1)
    #expect(deliveryTruth.first?.status == .published)
  }

  @Test
  func cmpFacadeBootstrapUsesDefaultAgentIDWhenExplicitAgentsAreMissing() async throws {
    let hostAdapters = PraxisHostAdapterRegistry.localDefaults()
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(
      hostAdapters: hostAdapters
    )

    let bootstrap = try await runtimeFacade.cmpFacade.bootstrapProject(
      .init(
        projectID: "cmp.default-agent-only",
        agentIDs: [],
        defaultAgentID: "checker.local"
      )
    )

    let checkerLineage = try await hostAdapters.lineageStore?.describe(
      .init(lineageID: .init(rawValue: "lineage.cmp.default-agent-only.checker.local"))
    )
    let runtimeLineage = try await hostAdapters.lineageStore?.describe(
      .init(lineageID: .init(rawValue: "lineage.cmp.default-agent-only.runtime.local"))
    )

    #expect(bootstrap.projectSummary.projectID == "cmp.default-agent-only")
    #expect(bootstrap.gitSummary.contains("1 branch runtimes"))
    #expect(checkerLineage?.summary == "CMP bootstrap lineage checker.local at depth 0.")
    #expect(runtimeLineage == nil)
  }

  @Test
  func recoverCmpProjectUsesHistoricalContextForPackageOnlyHitAndBackfillsIdentifiers() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-recover-package-only-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let packageStore = try #require(registry.cmpContextPackageStore)

    _ = try await packageStore.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "package.package-only"),
        sourceProjectionID: .init(rawValue: "projection.package-only"),
        sourceSnapshotID: .init(rawValue: "snapshot.package-only"),
        sourceAgentID: "archivist.local",
        targetAgentID: "checker.local",
        packageKind: .historicalReply,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.package-only/checker.local/historicalReply",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "projection.package-only:section")],
        createdAt: "2026-04-11T04:10:00Z",
        updatedAt: "2026-04-11T04:10:00Z"
      )
    )

    let recovery = try await runtimeFacade.cmpFacade.recoverCmpProject(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        reason: "Recover package-only historical context",
        snapshotID: "snapshot.package-only"
      )
    )

    #expect(recovery.recoverySource == "historical_context")
    #expect(recovery.foundHistoricalContext)
    #expect(recovery.sourceAgentID == "archivist.local")
    #expect(recovery.targetAgentID == "checker.local")
    #expect(recovery.snapshotID == "snapshot.package-only")
    #expect(recovery.packageID == "package.package-only")
    #expect(recovery.packageKind == .historicalReply)
    #expect(recovery.status == .aligned)
    #expect(recovery.missingProjectionCount == 0)
    #expect(recovery.issues.isEmpty)
  }

  @Test
  func recoverCmpProjectScopesRecoveryStatsToRequestedLineageWhenStoredPackageCannotSatisfyFilter() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-recover-historical-snapshot-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let descriptor = try await seedRecoverProjectionDescriptor(
      in: registry,
      projectionID: "projection.recover.snapshot",
      lineageID: "lineage.cmp.local-runtime.runtime.local"
    )
    _ = try await seedRecoverProjectionDescriptor(
      in: registry,
      projectionID: "projection.recover.other",
      lineageID: "lineage.cmp.local-runtime.other.local"
    )
    let packageStore = try #require(registry.cmpContextPackageStore)

    _ = try await packageStore.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "package.stale-history"),
        sourceProjectionID: descriptor.projectionID,
        sourceSnapshotID: nil,
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .historicalReply,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/\(descriptor.projectionID.rawValue)/checker.local/historicalReply",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "\(descriptor.projectionID.rawValue):section")],
        createdAt: "2026-04-11T04:20:00Z",
        updatedAt: "2026-04-11T04:20:00Z"
      )
    )

    let recovery = try await runtimeFacade.cmpFacade.recoverCmpProject(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        reason: "Recover from reusable snapshot",
        lineageID: "lineage.cmp.local-runtime.runtime.local"
      )
    )

    #expect(recovery.recoverySource == "historical_snapshot")
    #expect(recovery.foundHistoricalContext)
    #expect(recovery.sourceAgentID == "runtime.local")
    #expect(recovery.snapshotID == "\(descriptor.projectionID.rawValue):checked")
    #expect(recovery.packageID == "\(descriptor.projectionID.rawValue):checker.local:historicalReply")
    #expect(recovery.packageKind == .historicalReply)
    #expect(recovery.status == .aligned)
    #expect(recovery.resumableProjectionCount == 1)
    #expect(recovery.missingProjectionCount == 0)
    #expect(recovery.issues.isEmpty)
  }

  @Test
  func recoverCmpProjectRejectsRequestedSnapshotWhenHistoryMissesIt() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-recover-materialize-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    _ = try await seedRecoverProjectionDescriptor(
      in: registry,
      projectionID: "projection.recover.materialize"
    )

    do {
      _ = try await runtimeFacade.cmpFacade.recoverCmpProject(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Reject exact snapshot miss",
          snapshotID: "snapshot.missing"
        )
      )
      Issue.record("Recovering an exact snapshot miss should fail instead of materializing a different checked snapshot.")
    } catch let error as PraxisError {
      guard case .invalidInput(let message) = error else {
        Issue.record("Expected invalidInput but received \(error).")
        return
      }
      #expect(message.contains("snapshot.missing"))
      #expect(message.contains("without falling back to a different checked snapshot"))
    }
  }

  @Test
  func cmpProjectRecoverySnapshotCodecRoundTripsTypedStatusAndPackageKind() throws {
    let snapshot = PraxisCmpProjectRecoverySnapshot(
      summary: "Recovered CMP project context.",
      projectID: "cmp.local-runtime",
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      status: .aligned,
      recoverySource: "historical_context",
      foundHistoricalContext: true,
      snapshotID: "snapshot.recovery.codec",
      packageID: "package.recovery.codec",
      packageKind: .historicalReply,
      projectionRecoverySummary: "Projection is resumable.",
      hydratedRecoverySummary: "Hydrated recovery can resume 1 projection(s).",
      resumableProjectionCount: 1,
      missingProjectionCount: 0,
      issues: []
    )

    let encoded = try encodeTestJSON(snapshot)
    let decoded = try decodeTestJSON(PraxisCmpProjectRecoverySnapshot.self, from: encoded)

    #expect(encoded.contains(#""status":"aligned""#))
    #expect(encoded.contains(#""packageKind":"historicalReply""#))
    #expect(decoded.status == .aligned)
    #expect(decoded.packageKind == .historicalReply)
  }

  @Test
  func cmpProjectRecoverySnapshotDecodeRejectsUnknownTypedFields() throws {
    let cases = [
      #"{"foundHistoricalContext":true,"hydratedRecoverySummary":"Hydrated recovery can resume 1 projection(s).","issues":[],"missingProjectionCount":0,"packageID":"package.recovery.codec","packageKind":"historicalReply","projectID":"cmp.local-runtime","projectionRecoverySummary":"Projection is resumable.","recoverySource":"historical_context","resumableProjectionCount":1,"snapshotID":"snapshot.recovery.codec","sourceAgentID":"runtime.local","status":"broken_status","summary":"Recovered CMP project context.","targetAgentID":"checker.local"}"#,
      #"{"foundHistoricalContext":true,"hydratedRecoverySummary":"Hydrated recovery can resume 1 projection(s).","issues":[],"missingProjectionCount":0,"packageID":"package.recovery.codec","packageKind":"broken_kind","projectID":"cmp.local-runtime","projectionRecoverySummary":"Projection is resumable.","recoverySource":"historical_context","resumableProjectionCount":1,"snapshotID":"snapshot.recovery.codec","sourceAgentID":"runtime.local","status":"aligned","summary":"Recovered CMP project context.","targetAgentID":"checker.local"}"#
    ]

    for json in cases {
      #expect(throws: DecodingError.self) {
        try decodeTestJSON(PraxisCmpProjectRecoverySnapshot.self, from: json)
      }
    }
  }

  @Test
  func cmpRolesAndStatusSnapshotsRoundTripTypedRoleFields() throws {
    let rolesSnapshot = PraxisCmpRolesPanelSnapshot(
      summary: "CMP roles snapshot",
      projectID: "cmp.local-runtime",
      agentID: "checker.local",
      roleCounts: .init(counts: [.dispatcher: 1]),
      roleStages: .init(stages: [.dispatcher: .retryScheduled]),
      latestPackageID: "package.runtime",
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
      latestPackageID: "package.runtime",
      latestDispatchStatus: .retryScheduled,
      roleCounts: .init(counts: [.dispatcher: 1]),
      roleStages: .init(stages: [.dispatcher: .retryScheduled])
    )

    let encodedRoles = try encodeTestJSON(rolesSnapshot)
    let encodedStatus = try encodeTestJSON(statusSnapshot)
    let decodedRoles = try decodeTestJSON(PraxisCmpRolesPanelSnapshot.self, from: encodedRoles)
    let decodedStatus = try decodeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: encodedStatus)

    #expect(encodedRoles.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(encodedStatus.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(encodedStatus.contains(#""packageStatusCounts":{"dispatched":1}"#))
    #expect(encodedRoles.contains(#""roleStages":{"dispatcher":"retryScheduled"}"#))
    #expect(encodedStatus.contains(#""roleStages":{"dispatcher":"retryScheduled"}"#))
    #expect(decodedRoles.roleCounts[.dispatcher] == 1)
    #expect(decodedStatus.packageStatusCounts[.dispatched] == 1)
    #expect(decodedStatus.roleCounts[.dispatcher] == 1)
    #expect(decodedRoles.roleStages[.dispatcher] == .retryScheduled)
    #expect(decodedStatus.roleStages[.dispatcher] == .retryScheduled)
  }

  @Test
  func cmpRolesAndStatusSnapshotsRejectUnknownTypedRoleFields() throws {
    let invalidRolesJSON =
      #"{"agentID":"checker.local","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","projectID":"cmp.local-runtime","roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"broken_stage"},"summary":"CMP roles snapshot"}"#
    let invalidStatusJSON =
      #"{"agentID":"checker.local","executionStyle":"automatic","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","packageCount":1,"packageStatusCounts":{"dispatched":1},"projectID":"cmp.local-runtime","readbackPriority":"gitFirst","roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"broken_stage"},"summary":"CMP status snapshot"}"#
    let invalidRoleCountKeyJSON =
      #"{"agentID":"checker.local","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","projectID":"cmp.local-runtime","roleCounts":{"ghost":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP roles snapshot"}"#
    let invalidStatusRoleCountKeyJSON =
      #"{"agentID":"checker.local","executionStyle":"automatic","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","packageCount":1,"packageStatusCounts":{"dispatched":1},"projectID":"cmp.local-runtime","readbackPriority":"gitFirst","roleCounts":{"ghost":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP status snapshot"}"#
    #expect(throws: DecodingError.self) {
      try decodeTestJSON(PraxisCmpRolesPanelSnapshot.self, from: invalidRolesJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: invalidStatusJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeTestJSON(PraxisCmpRolesPanelSnapshot.self, from: invalidRoleCountKeyJSON)
    }
    #expect(throws: DecodingError.self) {
      try decodeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: invalidStatusRoleCountKeyJSON)
    }
  }

  @Test
  func cmpStatusSnapshotsRejectUnknownPackageStatusCountKeys() throws {
    let invalidStatusJSON =
      #"{"agentID":"checker.local","executionStyle":"automatic","latestDispatchStatus":"retryScheduled","latestPackageID":"package.runtime","packageCount":1,"packageStatusCounts":{"broken_status":1},"projectID":"cmp.local-runtime","readbackPriority":"gitFirst","roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"CMP status snapshot"}"#

    #expect(throws: DecodingError.self) {
      try decodeTestJSON(PraxisCmpStatusPanelSnapshot.self, from: invalidStatusJSON)
    }
  }

  @Test
  func ffiBridgeRoutesEncodedRuntimeInterfaceRequestsAcrossSessionHandles() async throws {
    let ffiBridge = try PraxisRuntimeBridgeFactory.makeFFIBridge()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await ffiBridge.openRuntimeSession()

    let request = PraxisRuntimeInterfaceRequest.runGoal(
      .init(
        payloadSummary: "FFI bridge smoke test",
        goalID: "goal.ffi-smoke",
        goalTitle: "FFI Smoke Goal",
        sessionID: "session.ffi-smoke"
      )
    )
    let responseData = try await ffiBridge.handleEncodedRequest(
      codec.encode(request),
      on: handle
    )
    let response = try codec.decodeResponse(responseData)
    let eventData = try await ffiBridge.drainEncodedEvents(for: handle)
    let eventEnvelope = try JSONDecoder().decode(PraxisFFIEventEnvelope.self, from: eventData)

    #expect(response.status == .success)
    #expect(response.snapshot?.sessionID?.rawValue == "session.ffi-smoke")
    #expect(response.events.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(eventEnvelope.status == .success)
    #expect(eventEnvelope.handle == handle)
    #expect(eventEnvelope.events.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(eventEnvelope.error == nil)
    #expect(await ffiBridge.activeRuntimeSessionHandles() == [handle])
  }

  @Test
  func ffiBridgeReturnsStructuredFailuresForInvalidPayloadAndClosedHandle() async throws {
    let ffiBridge = try PraxisRuntimeBridgeFactory.makeFFIBridge()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await ffiBridge.openRuntimeSession()

    let invalidResponseData = try await ffiBridge.handleEncodedRequest(
      Data("not-json".utf8),
      on: handle
    )
    let invalidResponse = try codec.decodeResponse(invalidResponseData)

    #expect(invalidResponse.status == .failure)
    #expect(invalidResponse.error?.code == .invalidInput)
    #expect(invalidResponse.error?.message.contains("Failed to decode runtime interface request payload") == true)

    let invalidEnumResponseData = try await ffiBridge.handleEncodedRequest(
      Data(
        #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"not_a_real_execution_style","mode":"peer_review","automation":{"autoDispatch":false}}}"#
          .utf8
      ),
      on: handle
    )
    let invalidEnumResponse = try codec.decodeResponse(invalidEnumResponseData)

    #expect(invalidEnumResponse.status == .failure)
    #expect(invalidEnumResponse.error?.code == .invalidInput)
    #expect(invalidEnumResponse.error?.message.contains("executionStyle") == true)

    #expect(await ffiBridge.closeRuntimeSession(handle))

    let closedResponseData = try await ffiBridge.handleEncodedRequest(
      codec.encode(.inspectArchitecture),
      on: handle
    )
    let closedResponse = try codec.decodeResponse(closedResponseData)
    let closedEventData = try await ffiBridge.snapshotEncodedEvents(for: handle)
    let closedEventEnvelope = try JSONDecoder().decode(PraxisFFIEventEnvelope.self, from: closedEventData)

    #expect(closedResponse.status == .failure)
    #expect(closedResponse.error?.code == .sessionNotFound)
    #expect(closedEventEnvelope.status == .failure)
    #expect(closedEventEnvelope.error?.code == .sessionNotFound)
    #expect(closedEventEnvelope.handle == handle)
  }

  @Test
  func ffiBridgeAcceptsLegacyFlatRuntimeInterfaceRequests() async throws {
    let ffiBridge = try PraxisRuntimeBridgeFactory.makeFFIBridge()
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let handle = try await ffiBridge.openRuntimeSession()
    let legacyRunGoalJSON = """
    {"kind":"runGoal","payloadSummary":"Legacy flat FFI request","goalID":"goal.legacy-ffi","goalTitle":"Legacy FFI Goal","sessionID":"session.legacy-ffi"}
    """

    let responseData = try await ffiBridge.handleEncodedRequest(
      Data(legacyRunGoalJSON.utf8),
      on: handle
    )
    let response = try codec.decodeResponse(responseData)

    #expect(response.status == .success)
    #expect(response.snapshot?.runID?.rawValue == "run:session.legacy-ffi:goal.legacy-ffi")
    #expect(response.snapshot?.sessionID?.rawValue == "session.legacy-ffi")
    #expect(response.events.map(\.name) == ["run.started", "run.follow_up_ready"])
  }

  @Test
  func runFacadePersistsCheckpointedLifecycleForResume() async throws {
    let checkpointStore = PraxisFakeCheckpointStore()
    let journalStore = PraxisFakeJournalStore()
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: checkpointStore,
      journalStore: journalStore
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let started = try await runtimeFacade.runFacade.runGoal(
      .init(
        goal: .init(
          normalizedGoal: .init(
            id: .init(rawValue: "goal.host-runtime"),
            title: "Host Runtime Goal",
            summary: "Verify Wave6 run orchestration"
          ),
          intentSummary: "Verify Wave6 run orchestration"
        ),
        sessionID: .init(rawValue: "session.host-runtime")
      )
    )

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: started.runID))
    let resumedCheckpoint = try await checkpointStore.load(
      pointer: .init(
        checkpointID: .init(rawValue: "checkpoint.\(started.runID.rawValue)"),
        sessionID: started.sessionID
      )
    )
    let resumedAggregate = try decodeTestJSON(
      PraxisRunAggregate.self,
      from: resumedCheckpoint?.snapshot.payload?["runAggregateJSON"]?.stringValue ?? ""
    )

    #expect(started.runID.rawValue == "run:session.host-runtime:goal.host-runtime")
    #expect(started.sessionID.rawValue == "session.host-runtime")
    #expect(started.phase == .running)
    #expect(started.tickCount == 1)
    #expect(started.checkpointReference == "checkpoint.run:session.host-runtime:goal.host-runtime")
    #expect(started.phaseSummary.contains("journal 1"))
    #expect(started.phaseSummary.contains("Next action model_inference"))
    #expect(started.followUpAction?.kind.rawValue == "model_inference")
    #expect(started.followUpAction?.intentKind?.rawValue == "model_inference")
    #expect(resumed.runID == started.runID)
    #expect(resumed.sessionID == started.sessionID)
    #expect(resumed.phase == .running)
    #expect(resumed.tickCount == 2)
    #expect(resumed.recoveredEventCount == 0)
    #expect(resumed.phaseSummary.contains("replayed 0 events"))
    #expect(resumed.phaseSummary.contains("journal 2"))
    #expect(resumed.phaseSummary.contains("Next action internal_step"))
    #expect(resumed.followUpAction?.kind.rawValue == "internal_step")
    #expect(resumed.followUpAction?.intentKind?.rawValue == "internal_step")
    #expect(resumedCheckpoint?.snapshot.lastCursor == .init(sequence: 2))
    #expect(resumedAggregate.phase == .running)
    #expect(resumedAggregate.pendingIntentID == "evt.resumed.run:session.host-runtime:goal.host-runtime:resume")
  }

  @Test
  func resumeFacadeRecoversPausedCheckpointAndBridgeExposesEventStream() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.paused")
    let runID = PraxisRunID(rawValue: "run:session.paused:goal.paused")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 3,
      lastCursor: .init(sequence: 4)
    )
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore()
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)
    let bridge = try PraxisRuntimeBridgeFactory.makeCLICommandBridge(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))
    let state = try await bridge.handle(.init(intent: .resumeRun, payloadSummary: runID.rawValue))
    let events = await bridge.drainEvents()

    #expect(resumed.phase == .running)
    #expect(resumed.tickCount == 4)
    #expect(resumed.recoveredEventCount == 0)
    #expect(resumed.followUpAction?.intentID == "evt.resumed.run:session.paused:goal.paused:resume")
    #expect(state.pendingIntentID == "evt.resumed.run:session.paused:goal.paused:resume")
    #expect(state.events.map(\.name) == ["run.resumed", "run.follow_up_ready"])
    #expect(events.map(\.name) == ["run.resumed", "run.follow_up_ready"])
  }

  @Test
  func resumeFacadeRecoversFailedCheckpointAndPreservesReplayEvidence() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.failed")
    let runID = PraxisRunID(rawValue: "run:session.failed:goal.failed")
    let checkpointRecord = try makeCheckpointRecord(
      status: .failed,
      sessionID: sessionID,
      runID: runID,
      tickCount: 5,
      lastCursor: .init(sequence: 1),
      lastErrorCode: "tool_failure",
      lastErrorMessage: "Provider timed out"
    )
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore(seedEvents: [
        .init(
          sequence: 2,
          sessionID: sessionID,
          runReference: runID.rawValue,
          type: "capability.result_received",
          summary: "Late replay evidence"
        )
      ])
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))

    #expect(resumed.phase == .running)
    #expect(resumed.tickCount == 6)
    #expect(resumed.recoveredEventCount == 1)
    #expect(resumed.checkpointReference == "checkpoint.run:session.failed:goal.failed")
    #expect(resumed.followUpAction?.kind.rawValue == "internal_step")
    #expect(resumed.phaseSummary.contains("replayed 1 events"))
  }

  @Test
  func resumeFacadeUsesReplayedTerminalJournalStateBeforeIssuingResume() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.replayed-terminal")
    let runID = PraxisRunID(rawValue: "run:session.replayed-terminal:goal.replayed-terminal")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 2,
      lastCursor: .init(sequence: 1)
    )
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore(seedEvents: [
        .init(
          sequence: 2,
          sessionID: sessionID,
          runReference: runID.rawValue,
          type: "run.completed",
          summary: "Run completed with result result-terminal",
          metadata: [
            "kernelEventType": .string("run.completed"),
            "kernelEventID": .string("evt.completed.\(runID.rawValue)"),
            "createdAt": .string("2026-04-10T21:00:00Z"),
            "resultID": .string("result-terminal"),
          ]
        )
      ])
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))

    #expect(resumed.phase == .completed)
    #expect(resumed.recoveredEventCount == 1)
    #expect(resumed.followUpAction == nil)
    #expect(resumed.phaseSummary.contains("Recovered completed run"))
    #expect(!resumed.phaseSummary.contains("Next action internal_step"))
  }

  @Test
  func resumeFacadeReplaysCheckpointJournalBeyondSinglePageLimit() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.replayed-many-events")
    let runID = PraxisRunID(rawValue: "run:session.replayed-many-events:goal.replayed-many-events")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 2,
      lastCursor: .init(sequence: 1)
    )

    var replayEvents: [PraxisJournalEvent] = (2...60).map { sequence in
      PraxisJournalEvent(
        sequence: sequence,
        sessionID: sessionID,
        runReference: runID.rawValue,
        type: "checkpoint.created",
        summary: "Checkpoint replay-\(sequence) created in fast tier",
        metadata: [
          "kernelEventType": .string("checkpoint.created"),
          "kernelEventID": .string("evt.replayed.\(sequence).\(runID.rawValue)"),
          "createdAt": .string("2026-04-10T21:\(String(format: "%02d", sequence)):00Z"),
          "checkpointID": .string("checkpoint.replayed.\(sequence)"),
          "tier": .string("fast"),
        ]
      )
    }
    replayEvents.append(
      PraxisJournalEvent(
        sequence: 61,
        sessionID: sessionID,
        runReference: runID.rawValue,
        type: "run.completed",
        summary: "Run completed with result result-many-events",
        metadata: [
          "kernelEventType": .string("run.completed"),
          "kernelEventID": .string("evt.completed.\(runID.rawValue)"),
          "createdAt": .string("2026-04-10T22:01:00Z"),
          "resultID": .string("result-many-events"),
        ]
      )
    )

    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore(seedEvents: replayEvents)
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))

    #expect(resumed.phase == .completed)
    #expect(resumed.recoveredEventCount == 60)
    #expect(resumed.followUpAction == nil)
    #expect(resumed.phaseSummary.contains("replayed 60 events"))
    #expect(resumed.phaseSummary.contains("Recovered completed run"))
  }

  @Test
  func resumeFacadeSupportsLegacyDotSeparatedRunIDsWithDottedSessionIDs() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.host-runtime")
    let runID = PraxisRunID(rawValue: "run.session.host-runtime.goal.host-runtime")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 2,
      lastCursor: .init(sequence: 3)
    )
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore()
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))

    #expect(resumed.sessionID == sessionID)
    #expect(resumed.phase == .running)
    #expect(resumed.checkpointReference == "checkpoint.run.session.host-runtime.goal.host-runtime")
  }

  @Test
  func resumeFacadePreservesLegacyColonRunIDsWithPercentEscapedLiteralSessions() async throws {
    let sessionID = PraxisSessionID(rawValue: "team%3Aalpha")
    let runID = PraxisRunID(rawValue: "run:team%3Aalpha:goal.percent-literal")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 2,
      lastCursor: .init(sequence: 3)
    )
    let hostAdapters = PraxisHostAdapterRegistry(
      checkpointStore: PraxisFakeCheckpointStore(seedRecords: [checkpointRecord]),
      journalStore: PraxisFakeJournalStore()
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: hostAdapters)

    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: runID))

    #expect(resumed.sessionID == sessionID)
    #expect(resumed.phase == .running)
    #expect(resumed.checkpointReference == "checkpoint.run:team%3Aalpha:goal.percent-literal")
  }

  @Test
  func localDefaultsPersistCheckpointAndJournalAcrossIndependentRegistries() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-defaults-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let sessionID = PraxisSessionID(rawValue: "session.local-defaults")
    let runID = PraxisRunID(rawValue: "run:session.local-defaults:goal.local-defaults")
    let checkpointRecord = try makeCheckpointRecord(
      status: .paused,
      sessionID: sessionID,
      runID: runID,
      tickCount: 2,
      lastCursor: .init(sequence: 1)
    )

    let firstRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let secondRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let journalEvent = PraxisJournalEvent(
      sequence: 0,
      sessionID: sessionID,
      runReference: runID.rawValue,
      type: "run.created",
      summary: "Local defaults wrote one journal event"
    )

    _ = try await firstRegistry.checkpointStore?.save(checkpointRecord)
    _ = try await firstRegistry.journalStore?.append(.init(events: [journalEvent]))

    let loadedCheckpoint = try await secondRegistry.checkpointStore?.load(pointer: checkpointRecord.pointer)
    let loadedJournal = try await secondRegistry.journalStore?.read(
      .init(sessionID: sessionID.rawValue, limit: 10)
    )
    let gitReport = await secondRegistry.gitAvailabilityProbe?.probeGitReadiness()

    #expect(loadedCheckpoint?.snapshot.id == checkpointRecord.snapshot.id)
    #expect(loadedJournal?.events.count == 1)
    #expect(loadedJournal?.events.first?.summary == "Local defaults wrote one journal event")
    #expect(gitReport != nil)
    #expect(gitReport?.notes.isEmpty == false)
  }

  @Test
  func localRuntimeRunAndResumePersistCmpProjectionDeliveryAndLineageTruth() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-runtime-truth-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let goal = PraxisCompiledGoal(
      normalizedGoal: .init(
        id: .init(rawValue: "goal.local-runtime-truth"),
        title: "Local Runtime Truth",
        summary: "Persist local runtime CMP facts"
      ),
      intentSummary: "Persist local runtime CMP facts"
    )

    let started = try await runtimeFacade.runFacade.runGoal(
      .init(
        goal: goal,
        sessionID: .init(rawValue: "session.local-runtime-truth")
      )
    )
    let resumed = try await runtimeFacade.runFacade.resumeRun(.init(runID: started.runID))
    let projectionDescriptors = try await registry.projectionStore?.describe(
      .init(projectID: "cmp.local-runtime")
    ) ?? []
    let deliveryTruthRecords = try await registry.deliveryTruthStore?.lookup(
      .init(topic: "cmp.delivery")
    ) ?? []
    let lineageDescriptor = try await registry.lineageStore?.describe(
      .init(lineageID: .init(rawValue: "lineage.session.local-runtime-truth"))
    )
    let cmpSnapshot = try await runtimeFacade.inspectionFacade.inspectCmp()

    #expect(started.followUpAction?.kind.rawValue == "model_inference")
    #expect(resumed.followUpAction?.kind.rawValue == "internal_step")
    #expect(projectionDescriptors.count == 1)
    #expect(projectionDescriptors.first?.projectionID == .init(rawValue: "projection.\(started.runID.rawValue)"))
    #expect(projectionDescriptors.first?.storageKey == "sqlite://cmp.local-runtime/\(started.runID.rawValue)")
    #expect(deliveryTruthRecords.count == 1)
    #expect(deliveryTruthRecords.first?.status == .published)
    #expect(deliveryTruthRecords.first?.packageID == .init(rawValue: "package.\(started.runID.rawValue)"))
    #expect(lineageDescriptor?.branchRef == "local/session.local-runtime-truth")
    #expect(cmpSnapshot.hostRuntimeSummary.contains("sqlite persistence (1 projections, 0 packages)"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("sqlite delivery truth (1 records)"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("lineage store (ready)"))
  }

  @Test
  func localDefaultsPersistTapRuntimeEventsAcrossIndependentRegistries() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-tap-events-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let firstRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let secondRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let firstFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: firstRegistry)
    let secondFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: secondRegistry)

    _ = try await firstFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    _ = try await firstFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.shell",
        requestedTier: .b2,
        summary: "Escalate shell access to checker"
      )
    )

    let history = try await secondFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 5)
    )

    #expect(history.totalCount == 4)
    #expect(history.entries.count == 4)
    #expect(Set(history.entries.map(\.capabilityKey)) == Set(["tool.git", "tool.shell"]))
    #expect(history.entries.contains { $0.requestedTier == .b2 })
    #expect(history.entries.contains { $0.route == .toolReview })
  }

  @Test
  func dispatchFlowRespectsAutoDispatchGateAndRecordsTapBlockedEvent() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-dispatch-blocked-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    _ = try await runtimeFacade.cmpFacade.updateControl(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        automation: ["autoDispatch": false]
      )
    )

    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
      sourceProjectionID: .init(rawValue: "projection.runtime.local"),
      sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")]
    )
    let dispatch = try await runtimeFacade.cmpFacade.dispatchFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: contextPackage,
        targetKind: .peer,
        reason: "Attempt gated dispatch"
      )
    )
    let tapHistory = try await runtimeFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
    )
    let deliveryTruth = try await registry.deliveryTruthStore?.lookup(
      .init(packageID: contextPackage.id)
    ) ?? []

    #expect(dispatch.status == .rejected)
    #expect(dispatch.targetAgentID == "checker.local")
    #expect(tapHistory.entries.contains { $0.capabilityKey == "dispatch_blocked" })
    #expect(tapHistory.entries.contains {
      $0.route == .toolReview && $0.outcome == .reviewRequired
    })
    #expect(deliveryTruth.first?.status == .pending)
    #expect(deliveryTruth.first?.lastErrorSummary?.contains("autoDispatch is disabled") == true)
  }

  @Test
  func retryDispatchReplaysBlockedPackageAfterControlGateClears() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-dispatch-retry-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    _ = try await runtimeFacade.cmpFacade.updateControl(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        automation: ["autoDispatch": false]
      )
    )

    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
      sourceProjectionID: .init(rawValue: "projection.runtime.local"),
      sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")]
    )
    let blockedDispatch = try await runtimeFacade.cmpFacade.dispatchFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: contextPackage,
        targetKind: .peer,
        reason: "Attempt gated dispatch"
      )
    )
    _ = try await runtimeFacade.cmpFacade.updateControl(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        automation: ["autoDispatch": true]
      )
    )
    let retryDispatch = try await runtimeFacade.cmpFacade.retryDispatch(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        packageID: contextPackage.id.rawValue
      )
    )
    let storedPackage = try await registry.cmpContextPackageStore?.describe(
      .init(
        projectID: "cmp.local-runtime",
        packageID: contextPackage.id
      )
    ).first
    let deliveryTruth = try await registry.deliveryTruthStore?.lookup(
      .init(packageID: contextPackage.id)
    ) ?? []
    let tapHistory = try await runtimeFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
    )

    #expect(blockedDispatch.status == .rejected)
    #expect(retryDispatch.status == .delivered)
    #expect(storedPackage?.status == .dispatched)
    #expect(storedPackage?.metadata["dispatch_target_kind"] == .string("peer"))
    #expect(storedPackage?.metadata["dispatch_reason"] == .string("Attempt gated dispatch"))
    #expect(storedPackage?.metadata["dispatch_attempt_count"] == .number(2))
    #expect(deliveryTruth.first?.status == .published)
    #expect(tapHistory.entries.contains { $0.capabilityKey == "dispatch_retry_requested" })
    #expect(tapHistory.entries.contains { $0.outcome == .baselineApproved })
  }

  @Test
  func retryDispatchRejectsAlreadyDispatchedPackage() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-dispatch-retry-rejects-dispatched-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
      sourceProjectionID: .init(rawValue: "projection.runtime.local"),
      sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")]
    )
    let dispatched = try await runtimeFacade.cmpFacade.dispatchFlow(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        contextPackage: contextPackage,
        targetKind: .peer,
        reason: "Dispatch once"
      )
    )

    do {
      _ = try await runtimeFacade.cmpFacade.retryDispatch(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: contextPackage.id.rawValue
        )
      )
      Issue.record("Retrying an already dispatched package should fail.")
    } catch let error as PraxisError {
      guard case .invalidInput(let message) = error else {
        Issue.record("Expected invalidInput but received \(error).")
        return
      }
      #expect(message.contains("CMP dispatch retry is not available"))
    }
    #expect(dispatched.status == .delivered)
  }

  @Test
  func retryDispatchRejectsCorruptedPersistedTargetKindMetadata() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-dispatch-retry-corrupted-target-kind-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    _ = try await registry.cmpContextPackageStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "projection.runtime.local:checker.local:runtimeFill"),
        sourceProjectionID: .init(rawValue: "projection.runtime.local"),
        sourceSnapshotID: .init(rawValue: "projection.runtime.local:checked"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.runtime.local/checker.local/runtimeFill",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "blocked_by_tap_gate": .bool(true),
          "dispatch_target_kind": .string("broken_target_kind"),
          "last_dispatch_status": .string(PraxisCmpDispatchStatus.rejected.rawValue),
        ]
      )
    )

    do {
      _ = try await runtimeFacade.cmpFacade.retryDispatch(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: "projection.runtime.local:checker.local:runtimeFill"
        )
      )
      Issue.record("Retrying a package with corrupted persisted dispatch target metadata should fail.")
    } catch let error as PraxisError {
      guard case .invalidInput(let message) = error else {
        Issue.record("Expected invalidInput but received \(error).")
        return
      }
      #expect(message.contains("dispatch_target_kind"))
      #expect(message.contains("broken_target_kind"))
    }
  }

  @Test
  func localPeerApprovalStoreAppliesScopeBeforeProjectWideCap() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-peer-approval-cap-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let store = try #require(registry.cmpPeerApprovalStore)
    _ = try await store.save(
      .init(
        projectID: "project-1",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: "B1",
        tapMode: "restricted",
        riskLevel: "normal",
        route: "humanReview",
        outcome: "escalated_to_human",
        humanGateState: "waitingApproval",
        summary: "Old matching approval",
        decisionSummary: "Old matching approval should survive scoped reads.",
        requestedAt: "2026-04-10T00:00:00Z",
        updatedAt: "2026-04-10T00:00:00Z"
      )
    )
    for offset in 0..<205 {
      _ = try await store.save(
        .init(
          projectID: "project-1",
          agentID: "agent.\(offset)",
          targetAgentID: "other.local",
          capabilityKey: "tool.\(offset)",
          requestedTier: "B1",
          tapMode: "restricted",
          riskLevel: "normal",
          route: "humanReview",
          outcome: "escalated_to_human",
          humanGateState: "waitingApproval",
          summary: "Newer unrelated approval \(offset)",
          decisionSummary: "Unrelated approval \(offset)",
          requestedAt: String(format: "2026-04-11T00:%02d:00Z", offset % 60),
          updatedAt: String(format: "2026-04-11T00:%02d:00Z", offset % 60)
        )
      )
    }

    let scopedApprovals = try await store.describeAll(
      .init(projectID: "project-1", targetAgentID: "checker.local")
    )

    #expect(scopedApprovals.count == 1)
    #expect(scopedApprovals.first?.capabilityKey == "tool.git")
  }

  @Test
  func localTapRuntimeEventStoreAppliesScopeBeforeLimit() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-tap-event-limit-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let store = try #require(registry.tapRuntimeEventStore)
    _ = try await store.append(
      .init(
        eventID: "tap-event-old-checker",
        projectID: "project-1",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        eventKind: "peer_approval_requested",
        capabilityKey: "tool.git",
        summary: "Old checker event",
        detail: "This should still be returned for checker scope.",
        createdAt: "2026-04-10T00:00:00Z"
      )
    )
    for offset in 0..<20 {
      _ = try await store.append(
        .init(
          eventID: "tap-event-other-\(offset)",
          projectID: "project-1",
          agentID: "agent.\(offset)",
          targetAgentID: "other.local",
          eventKind: "peer_approval_requested",
          capabilityKey: "tool.\(offset)",
          summary: "Unrelated event \(offset)",
          detail: "Unrelated event \(offset)",
          createdAt: String(format: "2026-04-11T00:%02d:00Z", offset)
        )
      )
    }

    let scopedRecords = try await store.read(
      .init(projectID: "project-1", targetAgentID: "checker.local", limit: 1)
    )

    #expect(scopedRecords.count == 1)
    #expect(scopedRecords.first?.eventID == "tap-event-old-checker")
  }

  @Test
  func peerApprovalPersistsNormalizedCapabilityKey() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-peer-approval-normalized-key-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)

    let requested = try await runtimeFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "  tool.git  ",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decided = try await runtimeFacade.cmpFacade.decidePeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved normalized git access"
      )
    )
    let readback = try await runtimeFacade.cmpFacade.readbackPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )
    let storedDescriptor = try await registry.cmpPeerApprovalStore?.describe(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )

    #expect(requested.capabilityKey == "tool.git")
    #expect(decided.capabilityKey == "tool.git")
    #expect(readback.found)
    #expect(readback.capabilityKey == "tool.git")
    #expect(storedDescriptor?.capabilityKey == "tool.git")
  }

  @Test
  func explicitPeerApprovalDecisionClearsPendingGateAndUpdatesTapReadback() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-peer-approval-decision-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)

    _ = try await runtimeFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decision = try await runtimeFacade.cmpFacade.decidePeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let readback = try await runtimeFacade.cmpFacade.readbackPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )
    let tapStatus = try await runtimeFacade.inspectionFacade.readbackTapStatus(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let tapHistory = try await runtimeFacade.inspectionFacade.readbackTapHistory(
      .init(projectID: "cmp.local-runtime", agentID: "checker.local", limit: 10)
    )

    #expect(decision.outcome == .approvedByHuman)
    #expect(decision.humanGateState == .approved)
    #expect(decision.decisionSummary == "Approved git access for checker")
    #expect(readback.found)
    #expect(readback.outcome == .approvedByHuman)
    #expect(readback.humanGateState == .approved)
    #expect(readback.decisionSummary == "Approved git access for checker")
    #expect(tapStatus.pendingApprovalCount == 0)
    #expect(tapStatus.approvedApprovalCount == 1)
    #expect(tapStatus.humanGateState == .approved)
    #expect(tapHistory.entries.contains {
      $0.capabilityKey == "tool.git" && $0.outcome == .approvedByHuman
    })
  }

  @Test
  func explicitPeerApprovalDecisionRejectsDuplicateResolution() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-peer-approval-duplicate-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)

    _ = try await runtimeFacade.cmpFacade.requestPeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    _ = try await runtimeFacade.cmpFacade.decidePeerApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )

    await #expect(throws: PraxisError.self) {
      try await runtimeFacade.cmpFacade.decidePeerApproval(
        .init(
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: "tool.git",
          decision: .reject,
          reviewerAgentID: "reviewer.local",
          decisionSummary: "Reject duplicate decision"
        )
      )
    }
  }

  @Test
  func localDefaultsProvideRealWorkspaceAndLineageAdapters() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-workspace-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let firstRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let secondRegistry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)

    _ = try await firstRegistry.workspaceWriter?.apply(
      .init(
        changes: [
          .init(
            kind: .createFile,
            path: "Package.swift",
            content: "// swift-tools-version: 6.0\n"
          ),
          .init(
            kind: .createFile,
            path: "SWIFT_REFACTOR_PLAN.md",
            content: "# Local Test Plan\n"
          ),
          .init(
            kind: .createFile,
            path: "notes/runtime.txt",
            content: "alpha\nbeta\n"
          ),
        ],
        changeSummary: "Seed local workspace files"
      )
    )
    let initialRead = try await secondRegistry.workspaceReader?.read(
      .init(path: "notes/runtime.txt", includeRevisionToken: true)
    )
    _ = try await secondRegistry.workspaceWriter?.apply(
      .init(
        changes: [
          .init(
            kind: .updateFile,
            path: "notes/runtime.txt",
            content: "alpha\nbeta\nrelease\n",
            expectedRevisionToken: initialRead?.revisionToken
          )
        ],
        changeSummary: "Update workspace note"
      )
    )

    let rangedRead = try await secondRegistry.workspaceReader?.read(
      .init(path: "notes/runtime.txt", range: .init(startLine: 2, endLine: 3), includeRevisionToken: true)
    )
    let searchMatches = try await secondRegistry.workspaceSearcher?.search(
      .init(query: "release", kind: .fullText, maxResults: 5)
    )

    let lineageStore = PraxisLocalLineageStore(fileURL: rootDirectory.appendingPathComponent("runtime.sqlite3", isDirectory: false))
    try await lineageStore.save(
      .init(
        lineageID: .init(rawValue: "lineage.local"),
        branchRef: "cmp/local",
        summary: "Local lineage descriptor"
      )
    )
    let lineageDescriptor = try await secondRegistry.lineageStore?.describe(
      .init(lineageID: .init(rawValue: "lineage.local"))
    )
    let packageStore = PraxisLocalCmpContextPackageStore(fileURL: rootDirectory.appendingPathComponent("runtime.sqlite3", isDirectory: false))
    _ = try await packageStore.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "package.local"),
        sourceProjectionID: .init(rawValue: "projection.local"),
        sourceSnapshotID: .init(rawValue: "snapshot.local"),
        sourceAgentID: "runtime.local",
        targetAgentID: "checker.local",
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.local/checker.local/runtimeFill",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "section.local")],
        createdAt: "2026-04-11T03:00:00Z",
        updatedAt: "2026-04-11T03:00:00Z"
      )
    )
    let packageDescriptors = try await secondRegistry.cmpContextPackageStore?.describe(
      .init(projectID: "cmp.local-runtime", targetAgentID: "checker.local")
    )
    let runningProcessUpdate = try await secondRegistry.processSupervisor?.poll(
      handle: .init(
        identifier: "pid:\(ProcessInfo.processInfo.processIdentifier)",
        origin: .shell,
        startedAt: "2026-04-11T03:00:00Z"
      )
    )
    let invalidProcessUpdate = try await secondRegistry.processSupervisor?.poll(
      handle: .init(identifier: "not-a-pid", origin: .shell)
    )
    let inferenceResponse = try await secondRegistry.providerInferenceExecutor?.infer(
      .init(
        systemPrompt: "Be precise",
        prompt: "Summarize the local runtime baseline and next action",
        contextSummary: "Workspace and lineage adapters are already persisted locally.",
        preferredModel: "local-smoke-model",
        temperature: 0.1,
        requiredCapabilities: ["workspace.read", "tool.git"],
        metadata: ["traceID": .string("local-inference-test")]
      )
    )
    let mcpReceipt = try await secondRegistry.providerMCPExecutor?.callTool(
      .init(
        toolName: "web.search",
        summary: "Find Swift runtime interface docs",
        serverName: "local-provider"
      )
    )
    let groundingBundle = try await secondRegistry.browserGroundingCollector?.collectEvidence(
      .init(
        taskSummary: "Verify runtime docs page",
        exampleURL: "https://example.com/runtime/docs?lang=swift",
        requestedFacts: ["final_url", "host", "page_title", "release_notes"],
        locale: "en-US",
        maxPages: 2
      )
    )
    let capabilityReceipt = try await secondRegistry.capabilityExecutor?.execute(
      .init(capabilityKey: "workspace.read", payloadSummary: "Read local runtime note")
    )
    let embeddingResponse = try await secondRegistry.providerEmbeddingExecutor?.embed(
      .init(content: "local runtime semantic search baseline", preferredModel: "local-embed-smoke")
    )
    let fileReceipt = try await secondRegistry.providerFileStore?.upload(
      .init(summary: "runtime local transcript", purpose: "analysis")
    )
    let batchReceipt = try await secondRegistry.providerBatchExecutor?.enqueue(
      .init(summary: "runtime local batch", itemCount: 3)
    )
    let skillKeys = try await secondRegistry.providerSkillRegistry?.listSkillKeys()
    let skillActivationReceipt = try await secondRegistry.providerSkillActivator?.activate(
      .init(skillKey: "runtime.inspect", reason: "Local smoke")
    )
    let browserReceipt = try await secondRegistry.browserExecutor?.navigate(
      .init(
        url: "https://example.com/runtime/docs?lang=swift",
        waitPolicy: .domReady,
        timeoutSeconds: 2,
        preferredTitle: "Runtime Docs",
        captureSnapshot: true
      )
    )
    let promptResponse = try await secondRegistry.userInputDriver?.prompt(
      .init(
        summary: "Choose mode",
        kind: .choice,
        defaultValue: "review",
        choices: [
          .init(id: "review", label: "Review"),
          .init(id: "run", label: "Run")
        ]
      )
    )
    let permissionDecision = try await secondRegistry.permissionDriver?.request(
      .init(scope: "workspace.read", summary: "Read workspace", urgency: .medium)
    )
    let deniedPermissionDecision = try await secondRegistry.permissionDriver?.request(
      .init(scope: "git.push", summary: "Push branch", urgency: .high)
    )
    await secondRegistry.terminalPresenter?.present(
      .init(title: "Sync", detail: "local baseline", kind: .progress)
    )
    await secondRegistry.conversationPresenter?.present(
      .init(summary: "Runtime ready", kind: .status, chips: [.init(kind: .audioTranscribe, label: "Audio", summary: "Local audio")])
    )
    let audioResponse = try await secondRegistry.audioTranscriptionDriver?.transcribe(
      .init(sourceRef: "file://meeting.m4a", locale: "en-US", hint: "runtime sync", diarizationEnabled: true)
    )
    let speechResponse = try await secondRegistry.speechSynthesisDriver?.synthesize(
      .init(text: "Runtime ready", voice: "alloy", locale: "en-US", format: "wav")
    )
    let imageResponse = try await secondRegistry.imageGenerationDriver?.generate(
      .init(prompt: "runtime architecture diagram", style: "technical", size: "1024x1024", transparentBackground: true)
    )
    let terminalEvents = await (secondRegistry.terminalPresenter as? PraxisLocalTerminalPresenter)?.allEvents()
    let conversationPresentations = await (secondRegistry.conversationPresenter as? PraxisLocalConversationPresenter)?.allPresentations()

    #expect(rangedRead?.content == "beta\nrelease")
    #expect(rangedRead?.revisionToken != nil)
    #expect(searchMatches?.first?.path == "notes/runtime.txt")
    #expect(lineageDescriptor?.branchRef == "cmp/local")
    #expect(packageDescriptors?.first?.packageID == .init(rawValue: "package.local"))
    #expect(runningProcessUpdate?.status == .running)
    #expect(runningProcessUpdate?.stdoutTail != nil)
    #expect(invalidProcessUpdate?.status == .failed)
    #expect(inferenceResponse?.receipt.backend == "local-runtime")
    #expect(inferenceResponse?.output.summary.contains("local runtime baseline") == true)
    #expect(inferenceResponse?.output.structuredFields["inferenceMode"]?.stringValue == "heuristic_baseline")
    #expect(inferenceResponse?.output.structuredFields["effectiveModel"]?.stringValue == "local-smoke-model")
    #expect(mcpReceipt?.status == .succeeded)
    #expect(mcpReceipt?.summary.contains("Local MCP baseline") == true)
    #expect(groundingBundle?.pages.count == 1)
    #expect(groundingBundle?.pages.first?.url == "https://example.com/runtime/docs?lang=swift")
    #expect(groundingBundle?.facts.first(where: { $0.name == "final_url" })?.status == .candidate)
    #expect(groundingBundle?.facts.first(where: { $0.name == "host" })?.value == "example.com")
    #expect(groundingBundle?.facts.first(where: { $0.name == "page_title" })?.status == .candidate)
    #expect(groundingBundle?.facts.first(where: { $0.name == "release_notes" })?.status == .candidate)
    #expect(
      groundingBundle?.pages.first?.snapshotPath.map { FileManager.default.fileExists(atPath: $0) } == true
    )
    #expect(groundingBundle?.blockedReason == nil)
    #expect(capabilityReceipt?.backend == "local-runtime")
    #expect(embeddingResponse?.model == "local-embed-smoke")
    #expect(embeddingResponse?.vectorLength == 5)
    #expect(fileReceipt?.backend == "local-runtime")
    #expect(fileReceipt?.fileID.contains("provider-files") == true)
    #expect(batchReceipt?.backend == "local-runtime")
    #expect(skillKeys?.contains("runtime.inspect") == true)
    #expect(skillActivationReceipt?.activated == true)
    #expect(browserReceipt?.title == "Runtime Docs")
    #expect(browserReceipt?.snapshotPath?.contains("browser-snapshots") == true)
    #expect(browserReceipt?.snapshotPath.map { FileManager.default.fileExists(atPath: $0) } == true)
    #expect(promptResponse?.selectedChoiceID == "review")
    #expect(promptResponse?.acceptedDefault == true)
    #expect(permissionDecision?.granted == true)
    #expect(deniedPermissionDecision?.granted == false)
    #expect(terminalEvents?.first?.title == "Sync")
    #expect(conversationPresentations?.first?.chips.first?.kind == .audioTranscribe)
    #expect(audioResponse?.language == "en-US")
    #expect(audioResponse?.transcript.contains("runtime sync") == true)
    #expect(speechResponse?.format == "wav")
    #expect(speechResponse?.audioAssetRef.contains("speech") == true)
    #expect(imageResponse?.mimeType == "image/png")
    #expect(imageResponse?.assetRef.contains("images") == true)
  }

  @Test
  func localGitExecutorVerifiesRepositoryAndCmpInspectionReportsLocalAdapters() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-git-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let gitInit = try runHostTestProcess(
      executablePath: "/usr/bin/git",
      arguments: ["init", "-q"],
      currentDirectoryURL: rootDirectory
    )
    #expect(gitInit.exitCode == 0)

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    _ = try await registry.projectionStore?.save(
      .init(
        projectID: "cmp.local-runtime",
        projectionID: .init(rawValue: "projection.local"),
        lineageID: .init(rawValue: "lineage.local"),
        agentID: "agent.local",
        visibilityLevel: .localOnly,
        storageKey: "sqlite://cmp/projection.local",
        updatedAt: "2026-04-11T02:00:00Z",
        summary: "Local runtime projection"
      )
    )
    let lineageStore = PraxisLocalLineageStore(fileURL: rootDirectory.appendingPathComponent("runtime.sqlite3", isDirectory: false))
    try await lineageStore.save(
      .init(
        lineageID: .init(rawValue: "lineage.local"),
        branchRef: "cmp/agent.local",
        summary: "Resolved local lineage"
      )
    )

    let gitReceipt = try await registry.gitExecutor?.apply(
      .init(
        operationID: "host-runtime.git.verify",
        repositoryRoot: rootDirectory.path,
        steps: [
          .init(kind: .verifyRepository, summary: "Verify local temp repository")
        ],
        summary: "Verify local git repository"
      )
    )
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let cmpSnapshot = try await runtimeFacade.inspectionFacade.inspectCmp()

    #expect(gitReceipt?.status == .applied)
    #expect(cmpSnapshot.summary.contains("workspace, git, and lineage state"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("workspace (ready)"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("lineage store (ready)"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("system git executor (ready)"))
    #expect(cmpSnapshot.persistenceSummary.contains("Lineage persistence resolved 1 of 1 projected lineages"))
  }

  @Test
  func localProcessSupervisorPreservesEncodedTerminalStatusForExitedProcesses() async throws {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/sh", isDirectory: false)
    process.arguments = ["-c", "exit 7"]
    try process.run()
    let processID = process.processIdentifier
    process.waitUntilExit()

    let supervisor = PraxisLocalProcessSupervisor()
    let failedHandle = PraxisLongRunningTaskHandle(
      identifier: "pid:\(processID):status=failed:exit=7",
      origin: .shell,
      startedAt: "2026-04-11T03:00:00Z"
    )
    let failedUpdate = try await supervisor.poll(handle: failedHandle)
    let bareHandle = PraxisLongRunningTaskHandle(
      identifier: "pid:\(processID)",
      origin: .shell,
      startedAt: "2026-04-11T03:00:00Z"
    )
    let bareUpdate = try await supervisor.poll(handle: bareHandle)

    #expect(failedUpdate.status == .failed)
    #expect(failedUpdate.exitCode == 7)
    #expect(failedUpdate.stderrTail?.contains("preserved terminal metadata") == true)
    #expect(bareUpdate.status == .failed)
    #expect(bareUpdate.exitCode == nil)
    #expect(bareUpdate.stderrTail?.contains("did not preserve a terminal status") == true)
  }

  @Test
  func cmpInspectionDoesNotRequirePraxisSentinelFilesForWorkspaceReadiness() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-workspace-health-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let cmpSnapshot = try await runtimeFacade.inspectionFacade.inspectCmp()

    #expect(cmpSnapshot.hostRuntimeSummary.contains("workspace (ready)"))
    #expect(cmpSnapshot.hostRuntimeSummary.contains("system git executor (degraded)"))
    #expect(cmpSnapshot.persistenceSummary.contains("Lineage store is wired"))
  }

  @Test
  func cmpInspectionVerifiesGitAgainstConfiguredWorkspaceRoot() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-git-root-mismatch-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let runtimeFacade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade(hostAdapters: registry)
    let cmpSnapshot = try await runtimeFacade.inspectionFacade.inspectCmp()

    #expect(cmpSnapshot.hostRuntimeSummary.contains("system git executor (degraded)"))
    #expect(cmpSnapshot.summary.contains("workspace, git, and lineage state"))
  }

  @Test
  func defaultBridgeFactoryReusesSharedLocalHostAdaptersAcrossBridgeInstances() async throws {
    let facade = try PraxisRuntimeBridgeFactory.makeRuntimeFacade()
    let goal = PraxisCompiledGoal(
      normalizedGoal: .init(
        id: .init(rawValue: "goal.shared-factory"),
        title: "Shared Factory Goal",
        summary: "Verify shared local adapters"
      ),
      intentSummary: "Verify shared local adapters"
    )
    let started = try await facade.runFacade.runGoal(
      .init(
        goal: goal,
        sessionID: .init(rawValue: "session.shared-factory")
      )
    )

    let bridge = try PraxisRuntimeBridgeFactory.makeCLICommandBridge()
    let resumedState = try await bridge.handle(
      .init(intent: .resumeRun, payloadSummary: started.runID.rawValue)
    )

    #expect(resumedState.title == "Run \(started.runID.rawValue)")
    #expect(resumedState.summary.contains("Resumed running run"))
    #expect(resumedState.pendingIntentID == "evt.resumed.\(started.runID.rawValue):resume")
  }
}
