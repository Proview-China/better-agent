import PraxisGoal
import PraxisCoreTypes
import PraxisRuntimeComposition
import PraxisRuntimeUseCases
import PraxisRun

public final class PraxisRuntimeFacade: Sendable {
  public let runFacade: PraxisRunFacade
  public let inspectionFacade: PraxisInspectionFacade
  public let mpFacade: PraxisMpFacade
  public let cmpSessionFacade: PraxisCmpSessionFacade
  public let cmpProjectFacade: PraxisCmpProjectFacade
  public let cmpFlowFacade: PraxisCmpFlowFacade
  public let cmpRolesFacade: PraxisCmpRolesFacade
  public let cmpControlFacade: PraxisCmpControlFacade
  public let cmpReadbackFacade: PraxisCmpReadbackFacade
  public let cmpFacade: PraxisCmpFacade

  public init(
    runFacade: PraxisRunFacade,
    inspectionFacade: PraxisInspectionFacade,
    mpFacade: PraxisMpFacade,
    cmpSessionFacade: PraxisCmpSessionFacade,
    cmpProjectFacade: PraxisCmpProjectFacade,
    cmpFlowFacade: PraxisCmpFlowFacade,
    cmpRolesFacade: PraxisCmpRolesFacade,
    cmpControlFacade: PraxisCmpControlFacade,
    cmpReadbackFacade: PraxisCmpReadbackFacade
  ) {
    self.runFacade = runFacade
    self.inspectionFacade = inspectionFacade
    self.mpFacade = mpFacade
    self.cmpSessionFacade = cmpSessionFacade
    self.cmpProjectFacade = cmpProjectFacade
    self.cmpFlowFacade = cmpFlowFacade
    self.cmpRolesFacade = cmpRolesFacade
    self.cmpControlFacade = cmpControlFacade
    self.cmpReadbackFacade = cmpReadbackFacade
    self.cmpFacade = .init(
      sessionFacade: cmpSessionFacade,
      projectFacade: cmpProjectFacade,
      flowFacade: cmpFlowFacade,
      rolesFacade: cmpRolesFacade,
      controlFacade: cmpControlFacade,
      readbackFacade: cmpReadbackFacade
    )
  }

  public convenience init(
    runFacade: PraxisRunFacade,
    inspectionFacade: PraxisInspectionFacade,
    cmpFacade: PraxisCmpFacade
  ) {
    self.init(
      runFacade: runFacade,
      inspectionFacade: inspectionFacade,
      mpFacade: .init(inspectMpUseCase: inspectionFacade.inspectMpUseCase),
      cmpSessionFacade: cmpFacade.sessionFacade,
      cmpProjectFacade: cmpFacade.projectFacade,
      cmpFlowFacade: cmpFacade.flowFacade,
      cmpRolesFacade: cmpFacade.rolesFacade,
      cmpControlFacade: cmpFacade.controlFacade,
      cmpReadbackFacade: cmpFacade.readbackFacade
    )
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    let cmpSessionFacade = PraxisCmpSessionFacade(dependencies: dependencies)
    let cmpProjectFacade = PraxisCmpProjectFacade(dependencies: dependencies)
    let cmpFlowFacade = PraxisCmpFlowFacade(dependencies: dependencies)
    let cmpRolesFacade = PraxisCmpRolesFacade(dependencies: dependencies)
    let cmpControlFacade = PraxisCmpControlFacade(dependencies: dependencies)
    let cmpReadbackFacade = PraxisCmpReadbackFacade(dependencies: dependencies)
    let inspectMpUseCase = PraxisInspectMpUseCase(dependencies: dependencies)
    self.init(
      runFacade: .init(dependencies: dependencies),
      inspectionFacade: .init(
        inspectTapUseCase: PraxisInspectTapUseCase(dependencies: dependencies),
        readbackTapStatusUseCase: PraxisReadbackTapStatusUseCase(dependencies: dependencies),
        readbackTapHistoryUseCase: PraxisReadbackTapHistoryUseCase(dependencies: dependencies),
        inspectCmpUseCase: PraxisInspectCmpUseCase(dependencies: dependencies),
        inspectMpUseCase: inspectMpUseCase,
        buildCapabilityCatalogUseCase: PraxisBuildCapabilityCatalogUseCase(dependencies: dependencies)
      ),
      mpFacade: .init(inspectMpUseCase: inspectMpUseCase),
      cmpSessionFacade: cmpSessionFacade,
      cmpProjectFacade: cmpProjectFacade,
      cmpFlowFacade: cmpFlowFacade,
      cmpRolesFacade: cmpRolesFacade,
      cmpControlFacade: cmpControlFacade,
      cmpReadbackFacade: cmpReadbackFacade
    )
  }
}

/// Stable host-neutral facade for the current MP runtime surface.
///
/// This facade owns MP-facing snapshots so CLI, GUI, and FFI hosts do not need to
/// tunnel through the generic inspection bucket while the wider MP command surface
/// is still being migrated.
public final class PraxisMpFacade: Sendable {
  public let inspectMpUseCase: any PraxisInspectMpUseCaseProtocol

  public init(inspectMpUseCase: any PraxisInspectMpUseCaseProtocol) {
    self.inspectMpUseCase = inspectMpUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(inspectMpUseCase: PraxisInspectMpUseCase(dependencies: dependencies))
  }

  /// Reads the current reserved MP host-runtime surface.
  ///
  /// - Returns: A host-neutral MP inspection snapshot backed by the runtime adapters.
  /// - Throws: Propagates runtime inspection failures from the underlying use case.
  public func inspect() async throws -> PraxisMpInspectionSnapshot {
    let inspection = try await inspectMpUseCase.execute()
    return PraxisMpInspectionSnapshot(
      summary: inspection.summary,
      workflowSummary: inspection.workflowSummary,
      memoryStoreSummary: inspection.memoryStoreSummary,
      multimodalSummary: inspection.multimodalSummary
    )
  }
}

public final class PraxisRunFacade: Sendable {
  public let runGoalUseCase: any PraxisRunGoalUseCaseProtocol
  public let resumeRunUseCase: any PraxisResumeRunUseCaseProtocol

  public init(
    runGoalUseCase: any PraxisRunGoalUseCaseProtocol,
    resumeRunUseCase: any PraxisResumeRunUseCaseProtocol
  ) {
    self.runGoalUseCase = runGoalUseCase
    self.resumeRunUseCase = resumeRunUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      runGoalUseCase: PraxisRunGoalUseCase(dependencies: dependencies),
      resumeRunUseCase: PraxisResumeRunUseCase(dependencies: dependencies)
    )
  }

  public func runGoal(_ command: PraxisRunGoalCommand) async throws -> PraxisRunSummary {
    let execution = try await runGoalUseCase.execute(command)
    let journalSummary = execution.journalSequence.map { "journal \($0)" } ?? "journal unavailable"
    let checkpointSummary = execution.checkpointReference ?? "no checkpoint"
    let followUpSummary = execution.followUpAction.map {
      "Next action \($0.kind.rawValue): \($0.reason)"
    } ?? "No follow-up action emitted."
    return PraxisRunSummary(
      runID: execution.runID,
      sessionID: execution.sessionID,
      phase: execution.phase,
      tickCount: execution.tickCount,
      lifecycleDisposition: .started,
      journalSequence: execution.journalSequence,
      checkpointReference: execution.checkpointReference,
      recoveredEventCount: execution.recoveredEventCount,
      followUpAction: execution.followUpAction,
      phaseSummary: "Started \(execution.phase.rawValue) run for \(command.goal.normalizedGoal.title) in session \(execution.sessionID.rawValue); \(journalSummary); \(checkpointSummary). \(followUpSummary)"
    )
  }

  public func resumeRun(_ command: PraxisResumeRunCommand) async throws -> PraxisRunSummary {
    let execution = try await resumeRunUseCase.execute(command)
    let journalSummary = execution.journalSequence.map { "journal \($0)" } ?? "journal unavailable"
    let checkpointSummary = execution.checkpointReference ?? "no checkpoint"
    let followUpSummary = execution.followUpAction.map {
      "Next action \($0.kind.rawValue): \($0.reason)"
    } ?? "No follow-up action emitted."
    let lifecycleSummary: String
    if execution.resumeIssued {
      lifecycleSummary = "Resumed \(execution.phase.rawValue) run \(execution.runID.rawValue) in session \(execution.sessionID.rawValue)"
    } else {
      lifecycleSummary = "Recovered \(execution.phase.rawValue) run \(execution.runID.rawValue) from replayed journal in session \(execution.sessionID.rawValue) without issuing a new resume event"
    }
    return PraxisRunSummary(
      runID: execution.runID,
      sessionID: execution.sessionID,
      phase: execution.phase,
      tickCount: execution.tickCount,
      lifecycleDisposition: execution.resumeIssued ? .resumed : .recoveredWithoutResume,
      journalSequence: execution.journalSequence,
      checkpointReference: execution.checkpointReference,
      recoveredEventCount: execution.recoveredEventCount,
      followUpAction: execution.followUpAction,
      phaseSummary: "\(lifecycleSummary); replayed \(execution.recoveredEventCount) events; \(journalSummary); \(checkpointSummary). \(followUpSummary)"
    )
  }
}

public final class PraxisInspectionFacade: Sendable {
  public let inspectTapUseCase: any PraxisInspectTapUseCaseProtocol
  public let readbackTapStatusUseCase: any PraxisReadbackTapStatusUseCaseProtocol
  public let readbackTapHistoryUseCase: any PraxisReadbackTapHistoryUseCaseProtocol
  public let inspectCmpUseCase: any PraxisInspectCmpUseCaseProtocol
  public let inspectMpUseCase: any PraxisInspectMpUseCaseProtocol
  public let buildCapabilityCatalogUseCase: any PraxisBuildCapabilityCatalogUseCaseProtocol

  public init(
    inspectTapUseCase: any PraxisInspectTapUseCaseProtocol,
    readbackTapStatusUseCase: any PraxisReadbackTapStatusUseCaseProtocol,
    readbackTapHistoryUseCase: any PraxisReadbackTapHistoryUseCaseProtocol,
    inspectCmpUseCase: any PraxisInspectCmpUseCaseProtocol,
    inspectMpUseCase: any PraxisInspectMpUseCaseProtocol,
    buildCapabilityCatalogUseCase: any PraxisBuildCapabilityCatalogUseCaseProtocol
  ) {
    self.inspectTapUseCase = inspectTapUseCase
    self.readbackTapStatusUseCase = readbackTapStatusUseCase
    self.readbackTapHistoryUseCase = readbackTapHistoryUseCase
    self.inspectCmpUseCase = inspectCmpUseCase
    self.inspectMpUseCase = inspectMpUseCase
    self.buildCapabilityCatalogUseCase = buildCapabilityCatalogUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      inspectTapUseCase: PraxisInspectTapUseCase(dependencies: dependencies),
      readbackTapStatusUseCase: PraxisReadbackTapStatusUseCase(dependencies: dependencies),
      readbackTapHistoryUseCase: PraxisReadbackTapHistoryUseCase(dependencies: dependencies),
      inspectCmpUseCase: PraxisInspectCmpUseCase(dependencies: dependencies),
      inspectMpUseCase: PraxisInspectMpUseCase(dependencies: dependencies),
      buildCapabilityCatalogUseCase: PraxisBuildCapabilityCatalogUseCase(dependencies: dependencies)
    )
  }

  public func inspectTap() async throws -> PraxisTapInspectionSnapshot {
    let inspection = try await inspectTapUseCase.execute()
    return PraxisTapInspectionSnapshot(
      summary: inspection.summary,
      governanceSummary: inspection.governanceSnapshot.summary,
      reviewSummary: inspection.toolReviewReport.session.actions.first?.summary ?? inspection.reviewContext.riskSummary.plainLanguageSummary
    )
  }

  public func readbackTapStatus(_ command: PraxisReadbackTapStatusCommand) async throws -> PraxisTapStatusSnapshot {
    let status = try await readbackTapStatusUseCase.execute(command)
    return PraxisTapStatusSnapshot(
      summary: status.summary,
      readinessSummary: status.readinessSummary,
      projectID: status.projectID,
      agentID: status.agentID,
      tapMode: status.tapMode,
      riskLevel: status.riskLevel,
      humanGateState: status.humanGateState,
      availableCapabilityCount: status.availableCapabilityCount,
      availableCapabilityIDs: status.availableCapabilityIDs,
      pendingApprovalCount: status.pendingApprovalCount,
      approvedApprovalCount: status.approvedApprovalCount,
      latestCapabilityKey: status.latestCapabilityKey,
      latestDecisionSummary: status.latestDecisionSummary
    )
  }

  public func readbackTapHistory(_ command: PraxisReadbackTapHistoryCommand) async throws -> PraxisTapHistorySnapshot {
    let history = try await readbackTapHistoryUseCase.execute(command)
    return PraxisTapHistorySnapshot(
      summary: history.summary,
      projectID: history.projectID,
      agentID: history.agentID,
      totalCount: history.totalCount,
      entries: history.entries.map { entry in
        .init(
          agentID: entry.agentID,
          targetAgentID: entry.targetAgentID,
          capabilityKey: entry.capabilityKey,
          requestedTier: entry.requestedTier,
          route: entry.route,
          outcome: entry.outcome,
          humanGateState: entry.humanGateState,
          updatedAt: entry.updatedAt,
          decisionSummary: entry.decisionSummary
        )
      }
    )
  }

  public func inspectCmp() async throws -> PraxisCmpInspectionSnapshot {
    let inspection = try await inspectCmpUseCase.execute()
    return PraxisCmpInspectionSnapshot(
      summary: inspection.summary,
      projectID: inspection.projectID,
      hostRuntimeSummary: inspection.hostSummary,
      persistenceSummary: inspection.runtimeProfile.structuredStoreSummary,
      coordinationSummary: inspection.runtimeProfile.messageBusSummary
    )
  }

  public func inspectMp() async throws -> PraxisMpInspectionSnapshot {
    let inspection = try await inspectMpUseCase.execute()
    return PraxisMpInspectionSnapshot(
      summary: inspection.summary,
      workflowSummary: inspection.workflowSummary,
      memoryStoreSummary: inspection.memoryStoreSummary,
      multimodalSummary: inspection.multimodalSummary
    )
  }

  public func buildCapabilityCatalogSnapshot() async throws -> PraxisInspectionSnapshot {
    PraxisInspectionSnapshot(summary: try await buildCapabilityCatalogUseCase.execute())
  }
}
