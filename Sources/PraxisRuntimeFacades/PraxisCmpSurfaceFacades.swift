import PraxisCmpTypes
import PraxisCoreTypes
import PraxisRuntimeComposition
import PraxisRuntimeUseCases

private func mapCmpHostProfile(_ profile: PraxisCmpProjectHostProfile) -> PraxisLocalRuntimeHostProfile {
  .init(
    executionStyle: profile.executionStyle,
    structuredStore: profile.structuredStore,
    deliveryStore: profile.deliveryStore,
    messageTransport: profile.messageTransport,
    gitAccess: profile.gitAccess,
    semanticIndex: profile.semanticIndex
  )
}

/// Hosts the neutral CMP session surface exposed to runtime callers.
public final class PraxisCmpSessionFacade: Sendable {
  public let openCmpSessionUseCase: any PraxisOpenCmpSessionUseCaseProtocol

  public init(openCmpSessionUseCase: any PraxisOpenCmpSessionUseCaseProtocol) {
    self.openCmpSessionUseCase = openCmpSessionUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(openCmpSessionUseCase: PraxisOpenCmpSessionUseCase(dependencies: dependencies))
  }

  public func openSession(_ command: PraxisOpenCmpSessionCommand) async throws -> PraxisCmpSessionSnapshot {
    let session = try await openCmpSessionUseCase.execute(command)
    return PraxisCmpSessionSnapshot(
      sessionID: session.sessionID,
      projectID: session.projectID,
      summary: session.summary,
      createdAt: session.createdAt,
      hostProfile: mapCmpHostProfile(session.hostProfile),
      issues: session.issues
    )
  }
}

/// Hosts the neutral CMP project surface exposed to runtime callers.
public final class PraxisCmpProjectFacade: Sendable {
  public let readbackCmpProjectUseCase: any PraxisReadbackCmpProjectUseCaseProtocol
  public let bootstrapCmpProjectUseCase: any PraxisBootstrapCmpProjectUseCaseProtocol
  public let recoverCmpProjectUseCase: (any PraxisRecoverCmpProjectUseCaseProtocol)?
  public let smokeCmpProjectUseCase: any PraxisSmokeCmpProjectUseCaseProtocol

  public init(
    readbackCmpProjectUseCase: any PraxisReadbackCmpProjectUseCaseProtocol,
    bootstrapCmpProjectUseCase: any PraxisBootstrapCmpProjectUseCaseProtocol,
    recoverCmpProjectUseCase: (any PraxisRecoverCmpProjectUseCaseProtocol)? = nil,
    smokeCmpProjectUseCase: any PraxisSmokeCmpProjectUseCaseProtocol
  ) {
    self.readbackCmpProjectUseCase = readbackCmpProjectUseCase
    self.bootstrapCmpProjectUseCase = bootstrapCmpProjectUseCase
    self.recoverCmpProjectUseCase = recoverCmpProjectUseCase
    self.smokeCmpProjectUseCase = smokeCmpProjectUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      readbackCmpProjectUseCase: PraxisReadbackCmpProjectUseCase(dependencies: dependencies),
      bootstrapCmpProjectUseCase: PraxisBootstrapCmpProjectUseCase(dependencies: dependencies),
      recoverCmpProjectUseCase: PraxisRecoverCmpProjectUseCase(dependencies: dependencies),
      smokeCmpProjectUseCase: PraxisSmokeCmpProjectUseCase(dependencies: dependencies)
    )
  }

  public func readbackProject(_ command: PraxisReadbackCmpProjectCommand) async throws -> PraxisCmpProjectReadbackSnapshot {
    let readback = try await readbackCmpProjectUseCase.execute(command)
    return PraxisCmpProjectReadbackSnapshot(
      summary: readback.summary,
      projectSummary: .init(
        projectID: readback.projectID,
        hostProfile: mapCmpHostProfile(readback.hostProfile),
        componentStatuses: readback.componentStatuses,
        issues: readback.issues
      ),
      persistenceSummary: readback.persistenceSummary,
      coordinationSummary: readback.coordinationSummary
    )
  }

  public func bootstrapProject(_ command: PraxisBootstrapCmpProjectCommand) async throws -> PraxisCmpProjectBootstrapSnapshot {
    let bootstrap = try await bootstrapCmpProjectUseCase.execute(command)
    let gitStatus: PraxisTruthLayerStatus
    switch bootstrap.gitReceipt.status {
    case .bootstrapped, .alreadyExists:
      gitStatus = .ready
    case .conflicted:
      gitStatus = .degraded
    }
    let gitComponentStatus: PraxisCmpProjectComponentStatus = gitStatus == .ready ? .ready : .degraded

    return PraxisCmpProjectBootstrapSnapshot(
      summary: bootstrap.summary,
      projectSummary: .init(
        projectID: bootstrap.projectID,
        hostProfile: mapCmpHostProfile(bootstrap.hostProfile),
        componentStatuses: .init(statuses: [
          .gitProbe: gitComponentStatus,
          .gitExecutor: gitComponentStatus,
          .structuredStore: bootstrap.dbReceipt.missingTargetCount == 0 ? .ready : .degraded,
          .messageBus: bootstrap.mqReceipts.isEmpty ? .missing : .ready,
          .lineageStore: bootstrap.lineages.isEmpty ? .missing : .ready,
        ]),
        issues: bootstrap.issues
      ),
      gitSummary: "Git bootstrap \(bootstrap.gitReceipt.status.rawValue) with \(bootstrap.gitBranchRuntimes.count) branch runtimes and \(bootstrap.gitReceipt.createdBranches.count) created branch refs.",
      persistenceSummary: bootstrap.persistenceSummary,
      coordinationSummary: bootstrap.coordinationSummary
    )
  }

  public func recoverProject(_ command: PraxisRecoverCmpProjectCommand) async throws -> PraxisCmpProjectRecoverySnapshot {
    guard let recoverCmpProjectUseCase else {
      throw PraxisError.dependencyMissing("CMP project recover use case is not wired in this runtime facade.")
    }

    let recovery = try await recoverCmpProjectUseCase.execute(command)
    return PraxisCmpProjectRecoverySnapshot(
      summary: recovery.summary,
      projectID: recovery.projectID,
      sourceAgentID: recovery.sourceAgentID,
      targetAgentID: recovery.targetAgentID,
      status: recovery.status,
      recoverySource: recovery.recoverySource,
      foundHistoricalContext: recovery.foundHistoricalContext,
      snapshotID: recovery.snapshotID,
      packageID: recovery.packageID,
      packageKind: recovery.packageKind,
      projectionRecoverySummary: recovery.projectionRecoverySummary,
      hydratedRecoverySummary: recovery.hydratedRecoverySummary,
      resumableProjectionCount: recovery.resumableProjectionCount,
      missingProjectionCount: recovery.missingProjectionCount,
      issues: recovery.issues
    )
  }

  public func smokeProject(_ command: PraxisSmokeCmpProjectCommand) async throws -> PraxisCmpProjectSmokeSnapshot {
    let smoke = try await smokeCmpProjectUseCase.execute(command)
    return PraxisCmpProjectSmokeSnapshot(
      projectID: smoke.projectID,
      smokeResult: .init(
        summary: smoke.summary,
        checks: smoke.checks.map { check in
          .init(
            id: check.id,
            gate: check.gate,
            status: check.status,
            summary: check.summary
          )
        }
      )
    )
  }
}

/// Hosts the neutral CMP flow surface exposed to runtime callers.
public final class PraxisCmpFlowFacade: Sendable {
  public let ingestCmpFlowUseCase: any PraxisIngestCmpFlowUseCaseProtocol
  public let commitCmpFlowUseCase: any PraxisCommitCmpFlowUseCaseProtocol
  public let resolveCmpFlowUseCase: any PraxisResolveCmpFlowUseCaseProtocol
  public let materializeCmpFlowUseCase: any PraxisMaterializeCmpFlowUseCaseProtocol
  public let dispatchCmpFlowUseCase: any PraxisDispatchCmpFlowUseCaseProtocol
  public let retryCmpDispatchUseCase: any PraxisRetryCmpDispatchUseCaseProtocol
  public let requestCmpHistoryUseCase: any PraxisRequestCmpHistoryUseCaseProtocol

  public init(
    ingestCmpFlowUseCase: any PraxisIngestCmpFlowUseCaseProtocol,
    commitCmpFlowUseCase: any PraxisCommitCmpFlowUseCaseProtocol,
    resolveCmpFlowUseCase: any PraxisResolveCmpFlowUseCaseProtocol,
    materializeCmpFlowUseCase: any PraxisMaterializeCmpFlowUseCaseProtocol,
    dispatchCmpFlowUseCase: any PraxisDispatchCmpFlowUseCaseProtocol,
    retryCmpDispatchUseCase: any PraxisRetryCmpDispatchUseCaseProtocol,
    requestCmpHistoryUseCase: any PraxisRequestCmpHistoryUseCaseProtocol
  ) {
    self.ingestCmpFlowUseCase = ingestCmpFlowUseCase
    self.commitCmpFlowUseCase = commitCmpFlowUseCase
    self.resolveCmpFlowUseCase = resolveCmpFlowUseCase
    self.materializeCmpFlowUseCase = materializeCmpFlowUseCase
    self.dispatchCmpFlowUseCase = dispatchCmpFlowUseCase
    self.retryCmpDispatchUseCase = retryCmpDispatchUseCase
    self.requestCmpHistoryUseCase = requestCmpHistoryUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      ingestCmpFlowUseCase: PraxisIngestCmpFlowUseCase(dependencies: dependencies),
      commitCmpFlowUseCase: PraxisCommitCmpFlowUseCase(dependencies: dependencies),
      resolveCmpFlowUseCase: PraxisResolveCmpFlowUseCase(dependencies: dependencies),
      materializeCmpFlowUseCase: PraxisMaterializeCmpFlowUseCase(dependencies: dependencies),
      dispatchCmpFlowUseCase: PraxisDispatchCmpFlowUseCase(dependencies: dependencies),
      retryCmpDispatchUseCase: PraxisRetryCmpDispatchUseCase(dependencies: dependencies),
      requestCmpHistoryUseCase: PraxisRequestCmpHistoryUseCase(dependencies: dependencies)
    )
  }

  public func ingestFlow(_ command: PraxisIngestCmpFlowCommand) async throws -> PraxisCmpFlowIngestSnapshot {
    let ingest = try await ingestCmpFlowUseCase.execute(command)
    return PraxisCmpFlowIngestSnapshot(
      summary: ingest.summary,
      projectID: ingest.projectID,
      agentID: ingest.agentID,
      sessionID: ingest.sessionID,
      requestID: ingest.requestID,
      acceptedEventCount: ingest.result.acceptedEventIDs.count,
      sectionCount: ingest.ingress.sections.count,
      storedSectionCount: ingest.loweredSections.compactMap(\.storedSection).count,
      nextAction: ingest.result.nextAction
    )
  }

  public func commitFlow(_ command: PraxisCommitCmpFlowCommand) async throws -> PraxisCmpFlowCommitSnapshot {
    let commit = try await commitCmpFlowUseCase.execute(command)
    return PraxisCmpFlowCommitSnapshot(
      summary: commit.summary,
      projectID: commit.projectID,
      agentID: commit.agentID,
      deltaID: commit.result.delta.id,
      snapshotCandidateID: commit.result.snapshotCandidateID,
      activeLineStage: commit.activeLine.stage,
      branchRef: commit.snapshotCandidate.branchRef
    )
  }

  public func resolveFlow(_ command: PraxisResolveCmpFlowCommand) async throws -> PraxisCmpFlowResolveSnapshot {
    let resolve = try await resolveCmpFlowUseCase.execute(command)
    return PraxisCmpFlowResolveSnapshot(
      summary: resolve.summary,
      projectID: resolve.projectID,
      agentID: resolve.agentID,
      found: resolve.result.found,
      snapshotID: resolve.snapshot?.id,
      branchRef: resolve.snapshot?.branchRef,
      qualityLabel: resolve.snapshot?.qualityLabel
    )
  }

  public func materializeFlow(_ command: PraxisMaterializeCmpFlowCommand) async throws -> PraxisCmpFlowMaterializeSnapshot {
    let materialize = try await materializeCmpFlowUseCase.execute(command)
    return PraxisCmpFlowMaterializeSnapshot(
      summary: materialize.summary,
      projectID: materialize.projectID,
      agentID: materialize.agentID,
      packageID: materialize.result.contextPackage.id,
      targetAgentID: materialize.result.contextPackage.targetAgentID,
      packageKind: materialize.result.contextPackage.kind,
      selectedSectionCount: materialize.materializationPlan.selectedSectionIDs.count
    )
  }

  public func dispatchFlow(_ command: PraxisDispatchCmpFlowCommand) async throws -> PraxisCmpFlowDispatchSnapshot {
    let dispatch = try await dispatchCmpFlowUseCase.execute(command)
    return PraxisCmpFlowDispatchSnapshot(
      summary: dispatch.summary,
      projectID: dispatch.projectID,
      agentID: dispatch.agentID,
      dispatchID: dispatch.result.receipt.id,
      targetAgentID: dispatch.result.receipt.targetAgentID,
      targetKind: dispatch.result.receipt.targetKind,
      status: dispatch.result.receipt.status
    )
  }

  public func retryDispatch(_ command: PraxisRetryCmpDispatchCommand) async throws -> PraxisCmpFlowDispatchSnapshot {
    let dispatch = try await retryCmpDispatchUseCase.execute(command)
    return PraxisCmpFlowDispatchSnapshot(
      summary: dispatch.summary,
      projectID: dispatch.projectID,
      agentID: dispatch.agentID,
      dispatchID: dispatch.result.receipt.id,
      targetAgentID: dispatch.result.receipt.targetAgentID,
      targetKind: dispatch.result.receipt.targetKind,
      status: dispatch.result.receipt.status
    )
  }

  public func requestHistory(_ command: PraxisRequestCmpHistoryCommand) async throws -> PraxisCmpFlowHistorySnapshot {
    let history = try await requestCmpHistoryUseCase.execute(command)
    return PraxisCmpFlowHistorySnapshot(
      summary: history.summary,
      projectID: history.projectID,
      requesterAgentID: history.requesterAgentID,
      found: history.result.found,
      snapshotID: history.result.snapshot?.id,
      packageID: history.result.contextPackage?.id
    )
  }
}

/// Hosts the neutral CMP roles surface exposed to runtime callers.
public final class PraxisCmpRolesFacade: Sendable {
  public let readbackCmpRolesUseCase: any PraxisReadbackCmpRolesUseCaseProtocol
  public let requestCmpPeerApprovalUseCase: any PraxisRequestCmpPeerApprovalUseCaseProtocol
  public let decideCmpPeerApprovalUseCase: any PraxisDecideCmpPeerApprovalUseCaseProtocol

  public init(
    readbackCmpRolesUseCase: any PraxisReadbackCmpRolesUseCaseProtocol,
    requestCmpPeerApprovalUseCase: any PraxisRequestCmpPeerApprovalUseCaseProtocol,
    decideCmpPeerApprovalUseCase: any PraxisDecideCmpPeerApprovalUseCaseProtocol
  ) {
    self.readbackCmpRolesUseCase = readbackCmpRolesUseCase
    self.requestCmpPeerApprovalUseCase = requestCmpPeerApprovalUseCase
    self.decideCmpPeerApprovalUseCase = decideCmpPeerApprovalUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      readbackCmpRolesUseCase: PraxisReadbackCmpRolesUseCase(dependencies: dependencies),
      requestCmpPeerApprovalUseCase: PraxisRequestCmpPeerApprovalUseCase(dependencies: dependencies),
      decideCmpPeerApprovalUseCase: PraxisDecideCmpPeerApprovalUseCase(dependencies: dependencies)
    )
  }

  public func readbackRoles(_ command: PraxisReadbackCmpRolesCommand) async throws -> PraxisCmpRolesPanelSnapshot {
    let roles = try await readbackCmpRolesUseCase.execute(command)
    return PraxisCmpRolesPanelSnapshot(
      summary: roles.summary,
      projectID: roles.projectID,
      agentID: roles.agentID,
      roleCounts: .init(
        counts: Dictionary(uniqueKeysWithValues: roles.roles.map { ($0.role, $0.assignmentCount) })
      ),
      roleStages: .init(
        stages: Dictionary(uniqueKeysWithValues: roles.roles.compactMap { role in
          guard let latestStage = role.latestStage else {
            return nil
          }
          return (role.role, latestStage)
        })
      ),
      latestPackageID: roles.latestPackageID,
      latestDispatchStatus: roles.latestDispatchStatus
    )
  }

  public func requestPeerApproval(_ command: PraxisRequestCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalSnapshot {
    let approval = try await requestCmpPeerApprovalUseCase.execute(command)
    return PraxisCmpPeerApprovalSnapshot(
      summary: approval.summary,
      projectID: approval.projectID,
      agentID: approval.agentID,
      targetAgentID: approval.targetAgentID,
      capabilityKey: approval.capabilityKey,
      requestedTier: approval.requestedTier,
      route: approval.route,
      outcome: approval.outcome,
      tapMode: approval.tapMode,
      riskLevel: approval.riskLevel,
      humanGateState: approval.humanGateState,
      requestedAt: approval.requestedAt,
      decisionSummary: approval.decisionSummary
    )
  }

  public func decidePeerApproval(_ command: PraxisDecideCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalSnapshot {
    let approval = try await decideCmpPeerApprovalUseCase.execute(command)
    return PraxisCmpPeerApprovalSnapshot(
      summary: approval.summary,
      projectID: approval.projectID,
      agentID: approval.agentID,
      targetAgentID: approval.targetAgentID,
      capabilityKey: approval.capabilityKey,
      requestedTier: approval.requestedTier,
      route: approval.route,
      outcome: approval.outcome,
      tapMode: approval.tapMode,
      riskLevel: approval.riskLevel,
      humanGateState: approval.humanGateState,
      requestedAt: approval.requestedAt,
      decisionSummary: approval.decisionSummary
    )
  }
}

/// Hosts the neutral CMP control surface exposed to runtime callers.
public final class PraxisCmpControlFacade: Sendable {
  public let readbackCmpControlUseCase: any PraxisReadbackCmpControlUseCaseProtocol
  public let updateCmpControlUseCase: any PraxisUpdateCmpControlUseCaseProtocol

  public init(
    readbackCmpControlUseCase: any PraxisReadbackCmpControlUseCaseProtocol,
    updateCmpControlUseCase: any PraxisUpdateCmpControlUseCaseProtocol
  ) {
    self.readbackCmpControlUseCase = readbackCmpControlUseCase
    self.updateCmpControlUseCase = updateCmpControlUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      readbackCmpControlUseCase: PraxisReadbackCmpControlUseCase(dependencies: dependencies),
      updateCmpControlUseCase: PraxisUpdateCmpControlUseCase(dependencies: dependencies)
    )
  }

  public func readbackControl(_ command: PraxisReadbackCmpControlCommand) async throws -> PraxisCmpControlPanelSnapshot {
    let control = try await readbackCmpControlUseCase.execute(command)
    return PraxisCmpControlPanelSnapshot(
      summary: control.summary,
      projectID: control.projectID,
      agentID: control.agentID,
      executionStyle: control.control.executionStyle,
      mode: control.control.mode,
      readbackPriority: control.control.readbackPriority,
      fallbackPolicy: control.control.fallbackPolicy,
      recoveryPreference: control.control.recoveryPreference,
      automation: control.control.automation,
      latestPackageID: control.latestPackageID,
      latestDispatchStatus: control.latestDispatchStatus,
      latestTargetAgentID: control.latestTargetAgentID
    )
  }

  public func updateControl(_ command: PraxisUpdateCmpControlCommand) async throws -> PraxisCmpControlUpdateSnapshot {
    let update = try await updateCmpControlUseCase.execute(command)
    return PraxisCmpControlUpdateSnapshot(
      summary: update.summary,
      projectID: update.projectID,
      agentID: update.agentID,
      executionStyle: update.control.executionStyle,
      mode: update.control.mode,
      readbackPriority: update.control.readbackPriority,
      fallbackPolicy: update.control.fallbackPolicy,
      recoveryPreference: update.control.recoveryPreference,
      automation: update.control.automation,
      storedAt: update.storedAt
    )
  }
}

/// Hosts the neutral CMP readback surface exposed to runtime callers.
public final class PraxisCmpReadbackFacade: Sendable {
  public let readbackCmpPeerApprovalUseCase: any PraxisReadbackCmpPeerApprovalUseCaseProtocol
  public let readbackCmpStatusUseCase: any PraxisReadbackCmpStatusUseCaseProtocol

  public init(
    readbackCmpPeerApprovalUseCase: any PraxisReadbackCmpPeerApprovalUseCaseProtocol,
    readbackCmpStatusUseCase: any PraxisReadbackCmpStatusUseCaseProtocol
  ) {
    self.readbackCmpPeerApprovalUseCase = readbackCmpPeerApprovalUseCase
    self.readbackCmpStatusUseCase = readbackCmpStatusUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      readbackCmpPeerApprovalUseCase: PraxisReadbackCmpPeerApprovalUseCase(dependencies: dependencies),
      readbackCmpStatusUseCase: PraxisReadbackCmpStatusUseCase(dependencies: dependencies)
    )
  }

  public func readbackPeerApproval(_ command: PraxisReadbackCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalReadbackSnapshot {
    let readback = try await readbackCmpPeerApprovalUseCase.execute(command)
    return PraxisCmpPeerApprovalReadbackSnapshot(
      summary: readback.summary,
      projectID: readback.projectID,
      agentID: readback.agentID,
      targetAgentID: readback.targetAgentID,
      capabilityKey: readback.capabilityKey,
      requestedTier: readback.requestedTier,
      route: readback.route,
      outcome: readback.outcome,
      tapMode: readback.tapMode,
      riskLevel: readback.riskLevel,
      humanGateState: readback.humanGateState,
      requestedAt: readback.requestedAt,
      decisionSummary: readback.decisionSummary,
      found: readback.found
    )
  }

  public func readbackStatus(_ command: PraxisReadbackCmpStatusCommand) async throws -> PraxisCmpStatusPanelSnapshot {
    let status = try await readbackCmpStatusUseCase.execute(command)
    return PraxisCmpStatusPanelSnapshot(
      summary: status.summary,
      projectID: status.projectID,
      agentID: status.agentID,
      executionStyle: status.control.executionStyle,
      readbackPriority: status.control.readbackPriority,
      packageCount: status.objectModel.packageCount,
      packageStatusCounts: status.objectModel.packageStatusCounts,
      latestPackageID: status.latestPackageID,
      latestDispatchStatus: status.latestDispatchStatus,
      roleCounts: .init(
        counts: Dictionary(uniqueKeysWithValues: status.roles.map { ($0.role, $0.assignmentCount) })
      ),
      roleStages: .init(
        stages: Dictionary(uniqueKeysWithValues: status.roles.compactMap { role in
          guard let latestStage = role.latestStage else {
            return nil
          }
          return (role.role, latestStage)
        })
      )
    )
  }
}

/// Preserves the existing aggregate CMP facade while delegating to stable subfacades.
public final class PraxisCmpFacade: Sendable {
  public let sessionFacade: PraxisCmpSessionFacade
  public let projectFacade: PraxisCmpProjectFacade
  public let flowFacade: PraxisCmpFlowFacade
  public let rolesFacade: PraxisCmpRolesFacade
  public let controlFacade: PraxisCmpControlFacade
  public let readbackFacade: PraxisCmpReadbackFacade

  public init(
    sessionFacade: PraxisCmpSessionFacade,
    projectFacade: PraxisCmpProjectFacade,
    flowFacade: PraxisCmpFlowFacade,
    rolesFacade: PraxisCmpRolesFacade,
    controlFacade: PraxisCmpControlFacade,
    readbackFacade: PraxisCmpReadbackFacade
  ) {
    self.sessionFacade = sessionFacade
    self.projectFacade = projectFacade
    self.flowFacade = flowFacade
    self.rolesFacade = rolesFacade
    self.controlFacade = controlFacade
    self.readbackFacade = readbackFacade
  }

  public convenience init(
    openCmpSessionUseCase: any PraxisOpenCmpSessionUseCaseProtocol,
    readbackCmpProjectUseCase: any PraxisReadbackCmpProjectUseCaseProtocol,
    bootstrapCmpProjectUseCase: any PraxisBootstrapCmpProjectUseCaseProtocol,
    recoverCmpProjectUseCase: (any PraxisRecoverCmpProjectUseCaseProtocol)? = nil,
    ingestCmpFlowUseCase: any PraxisIngestCmpFlowUseCaseProtocol,
    commitCmpFlowUseCase: any PraxisCommitCmpFlowUseCaseProtocol,
    resolveCmpFlowUseCase: any PraxisResolveCmpFlowUseCaseProtocol,
    materializeCmpFlowUseCase: any PraxisMaterializeCmpFlowUseCaseProtocol,
    dispatchCmpFlowUseCase: any PraxisDispatchCmpFlowUseCaseProtocol,
    retryCmpDispatchUseCase: any PraxisRetryCmpDispatchUseCaseProtocol,
    requestCmpHistoryUseCase: any PraxisRequestCmpHistoryUseCaseProtocol,
    readbackCmpRolesUseCase: any PraxisReadbackCmpRolesUseCaseProtocol,
    readbackCmpControlUseCase: any PraxisReadbackCmpControlUseCaseProtocol,
    updateCmpControlUseCase: any PraxisUpdateCmpControlUseCaseProtocol,
    requestCmpPeerApprovalUseCase: any PraxisRequestCmpPeerApprovalUseCaseProtocol,
    decideCmpPeerApprovalUseCase: any PraxisDecideCmpPeerApprovalUseCaseProtocol,
    readbackCmpPeerApprovalUseCase: any PraxisReadbackCmpPeerApprovalUseCaseProtocol,
    readbackCmpStatusUseCase: any PraxisReadbackCmpStatusUseCaseProtocol,
    smokeCmpProjectUseCase: any PraxisSmokeCmpProjectUseCaseProtocol
  ) {
    self.init(
      sessionFacade: PraxisCmpSessionFacade(openCmpSessionUseCase: openCmpSessionUseCase),
      projectFacade: PraxisCmpProjectFacade(
        readbackCmpProjectUseCase: readbackCmpProjectUseCase,
        bootstrapCmpProjectUseCase: bootstrapCmpProjectUseCase,
        recoverCmpProjectUseCase: recoverCmpProjectUseCase,
        smokeCmpProjectUseCase: smokeCmpProjectUseCase
      ),
      flowFacade: PraxisCmpFlowFacade(
        ingestCmpFlowUseCase: ingestCmpFlowUseCase,
        commitCmpFlowUseCase: commitCmpFlowUseCase,
        resolveCmpFlowUseCase: resolveCmpFlowUseCase,
        materializeCmpFlowUseCase: materializeCmpFlowUseCase,
        dispatchCmpFlowUseCase: dispatchCmpFlowUseCase,
        retryCmpDispatchUseCase: retryCmpDispatchUseCase,
        requestCmpHistoryUseCase: requestCmpHistoryUseCase
      ),
      rolesFacade: PraxisCmpRolesFacade(
        readbackCmpRolesUseCase: readbackCmpRolesUseCase,
        requestCmpPeerApprovalUseCase: requestCmpPeerApprovalUseCase,
        decideCmpPeerApprovalUseCase: decideCmpPeerApprovalUseCase
      ),
      controlFacade: PraxisCmpControlFacade(
        readbackCmpControlUseCase: readbackCmpControlUseCase,
        updateCmpControlUseCase: updateCmpControlUseCase
      ),
      readbackFacade: PraxisCmpReadbackFacade(
        readbackCmpPeerApprovalUseCase: readbackCmpPeerApprovalUseCase,
        readbackCmpStatusUseCase: readbackCmpStatusUseCase
      )
    )
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      sessionFacade: PraxisCmpSessionFacade(dependencies: dependencies),
      projectFacade: PraxisCmpProjectFacade(dependencies: dependencies),
      flowFacade: PraxisCmpFlowFacade(dependencies: dependencies),
      rolesFacade: PraxisCmpRolesFacade(dependencies: dependencies),
      controlFacade: PraxisCmpControlFacade(dependencies: dependencies),
      readbackFacade: PraxisCmpReadbackFacade(dependencies: dependencies)
    )
  }

  public func openSession(_ command: PraxisOpenCmpSessionCommand) async throws -> PraxisCmpSessionSnapshot {
    try await sessionFacade.openSession(command)
  }

  public func readbackProject(_ command: PraxisReadbackCmpProjectCommand) async throws -> PraxisCmpProjectReadbackSnapshot {
    try await projectFacade.readbackProject(command)
  }

  public func bootstrapProject(_ command: PraxisBootstrapCmpProjectCommand) async throws -> PraxisCmpProjectBootstrapSnapshot {
    try await projectFacade.bootstrapProject(command)
  }

  public func recoverCmpProject(_ command: PraxisRecoverCmpProjectCommand) async throws -> PraxisCmpProjectRecoverySnapshot {
    try await projectFacade.recoverProject(command)
  }

  public func ingestFlow(_ command: PraxisIngestCmpFlowCommand) async throws -> PraxisCmpFlowIngestSnapshot {
    try await flowFacade.ingestFlow(command)
  }

  public func commitFlow(_ command: PraxisCommitCmpFlowCommand) async throws -> PraxisCmpFlowCommitSnapshot {
    try await flowFacade.commitFlow(command)
  }

  public func resolveFlow(_ command: PraxisResolveCmpFlowCommand) async throws -> PraxisCmpFlowResolveSnapshot {
    try await flowFacade.resolveFlow(command)
  }

  public func materializeFlow(_ command: PraxisMaterializeCmpFlowCommand) async throws -> PraxisCmpFlowMaterializeSnapshot {
    try await flowFacade.materializeFlow(command)
  }

  public func dispatchFlow(_ command: PraxisDispatchCmpFlowCommand) async throws -> PraxisCmpFlowDispatchSnapshot {
    try await flowFacade.dispatchFlow(command)
  }

  public func retryDispatch(_ command: PraxisRetryCmpDispatchCommand) async throws -> PraxisCmpFlowDispatchSnapshot {
    try await flowFacade.retryDispatch(command)
  }

  public func requestHistory(_ command: PraxisRequestCmpHistoryCommand) async throws -> PraxisCmpFlowHistorySnapshot {
    try await flowFacade.requestHistory(command)
  }

  public func readbackRoles(_ command: PraxisReadbackCmpRolesCommand) async throws -> PraxisCmpRolesPanelSnapshot {
    try await rolesFacade.readbackRoles(command)
  }

  public func readbackControl(_ command: PraxisReadbackCmpControlCommand) async throws -> PraxisCmpControlPanelSnapshot {
    try await controlFacade.readbackControl(command)
  }

  public func updateControl(_ command: PraxisUpdateCmpControlCommand) async throws -> PraxisCmpControlUpdateSnapshot {
    try await controlFacade.updateControl(command)
  }

  public func requestPeerApproval(_ command: PraxisRequestCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalSnapshot {
    try await rolesFacade.requestPeerApproval(command)
  }

  public func decidePeerApproval(_ command: PraxisDecideCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalSnapshot {
    try await rolesFacade.decidePeerApproval(command)
  }

  public func readbackPeerApproval(_ command: PraxisReadbackCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalReadbackSnapshot {
    try await readbackFacade.readbackPeerApproval(command)
  }

  public func readbackStatus(_ command: PraxisReadbackCmpStatusCommand) async throws -> PraxisCmpStatusPanelSnapshot {
    try await readbackFacade.readbackStatus(command)
  }

  public func smokeProject(_ command: PraxisSmokeCmpProjectCommand) async throws -> PraxisCmpProjectSmokeSnapshot {
    try await projectFacade.smokeProject(command)
  }
}
