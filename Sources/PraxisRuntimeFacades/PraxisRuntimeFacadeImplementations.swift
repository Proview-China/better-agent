import PraxisGoal
import PraxisCoreTypes
import PraxisMpMemory
import PraxisRuntimeComposition
import PraxisRuntimeUseCases
import PraxisRun

private struct PraxisUnsupportedSearchMpUseCase: PraxisSearchMpUseCaseProtocol {
  func execute(_ command: PraxisSearchMpCommand) async throws -> PraxisMpSearchResult {
    throw PraxisError.unsupportedOperation("MP search is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedReadbackMpUseCase: PraxisReadbackMpUseCaseProtocol {
  func execute(_ command: PraxisReadbackMpCommand) async throws -> PraxisMpReadback {
    throw PraxisError.unsupportedOperation("MP readback is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedSmokeMpUseCase: PraxisSmokeMpUseCaseProtocol {
  func execute(_ command: PraxisSmokeMpCommand) async throws -> PraxisMpSmoke {
    throw PraxisError.unsupportedOperation("MP smoke is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedIngestMpUseCase: PraxisIngestMpUseCaseProtocol {
  func execute(_ command: PraxisIngestMpCommand) async throws -> PraxisMpIngestResult {
    throw PraxisError.unsupportedOperation("MP ingest is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedAlignMpUseCase: PraxisAlignMpUseCaseProtocol {
  func execute(_ command: PraxisAlignMpCommand) async throws -> PraxisMpAlignResult {
    throw PraxisError.unsupportedOperation("MP align is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedResolveMpUseCase: PraxisResolveMpUseCaseProtocol {
  func execute(_ command: PraxisResolveMpCommand) async throws -> PraxisMpResolveResult {
    throw PraxisError.unsupportedOperation("MP resolve is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedRequestMpHistoryUseCase: PraxisRequestMpHistoryUseCaseProtocol {
  func execute(_ command: PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistoryResult {
    throw PraxisError.unsupportedOperation("MP history is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedPromoteMpUseCase: PraxisPromoteMpUseCaseProtocol {
  func execute(_ command: PraxisPromoteMpCommand) async throws -> PraxisMpPromoteResult {
    throw PraxisError.unsupportedOperation("MP promote is not available in this facade profile.")
  }
}

private struct PraxisUnsupportedArchiveMpUseCase: PraxisArchiveMpUseCaseProtocol {
  func execute(_ command: PraxisArchiveMpCommand) async throws -> PraxisMpArchiveResult {
    throw PraxisError.unsupportedOperation("MP archive is not available in this facade profile.")
  }
}

private func mapSmokeResult(_ checks: [PraxisRuntimeSmokeCheckRecord], summary: String) -> PraxisRuntimeSmokeResult {
  PraxisRuntimeSmokeResult(
    summary: summary,
    checks: checks.map {
      PraxisRuntimeSmokeCheck(
        id: $0.id,
        gate: $0.gate,
        status: $0.status,
        summary: $0.summary
      )
    }
  )
}

private func mapRerankComposition(_ composition: PraxisMpRerankComposition) -> PraxisMpRerankCompositionSnapshot {
  PraxisMpRerankCompositionSnapshot(
    fresh: composition.fresh,
    aging: composition.aging,
    stale: composition.stale,
    superseded: composition.superseded,
    aligned: composition.aligned,
    unreviewed: composition.unreviewed,
    drifted: composition.drifted
  )
}

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
      mpFacade: .init(
        inspectMpUseCase: inspectionFacade.inspectMpUseCase,
        searchMpUseCase: PraxisUnsupportedSearchMpUseCase(),
        readbackMpUseCase: PraxisUnsupportedReadbackMpUseCase(),
        smokeMpUseCase: PraxisUnsupportedSmokeMpUseCase(),
        ingestMpUseCase: PraxisUnsupportedIngestMpUseCase(),
        alignMpUseCase: PraxisUnsupportedAlignMpUseCase(),
        resolveMpUseCase: PraxisUnsupportedResolveMpUseCase(),
        requestMpHistoryUseCase: PraxisUnsupportedRequestMpHistoryUseCase(),
        promoteMpUseCase: PraxisUnsupportedPromoteMpUseCase(),
        archiveMpUseCase: PraxisUnsupportedArchiveMpUseCase()
      ),
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
    let searchMpUseCase = PraxisSearchMpUseCase(dependencies: dependencies)
    let readbackMpUseCase = PraxisReadbackMpUseCase(dependencies: dependencies)
    let smokeMpUseCase = PraxisSmokeMpUseCase(dependencies: dependencies)
    let ingestMpUseCase = PraxisIngestMpUseCase(dependencies: dependencies)
    let alignMpUseCase = PraxisAlignMpUseCase(dependencies: dependencies)
    let resolveMpUseCase = PraxisResolveMpUseCase(dependencies: dependencies)
    let requestMpHistoryUseCase = PraxisRequestMpHistoryUseCase(dependencies: dependencies)
    let promoteMpUseCase = PraxisPromoteMpUseCase(dependencies: dependencies)
    let archiveMpUseCase = PraxisArchiveMpUseCase(dependencies: dependencies)
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
      mpFacade: .init(
        inspectMpUseCase: inspectMpUseCase,
        searchMpUseCase: searchMpUseCase,
        readbackMpUseCase: readbackMpUseCase,
        smokeMpUseCase: smokeMpUseCase,
        ingestMpUseCase: ingestMpUseCase,
        alignMpUseCase: alignMpUseCase,
        resolveMpUseCase: resolveMpUseCase,
        requestMpHistoryUseCase: requestMpHistoryUseCase,
        promoteMpUseCase: promoteMpUseCase,
        archiveMpUseCase: archiveMpUseCase
      ),
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
  public let searchMpUseCase: any PraxisSearchMpUseCaseProtocol
  public let readbackMpUseCase: any PraxisReadbackMpUseCaseProtocol
  public let smokeMpUseCase: any PraxisSmokeMpUseCaseProtocol
  public let ingestMpUseCase: any PraxisIngestMpUseCaseProtocol
  public let alignMpUseCase: any PraxisAlignMpUseCaseProtocol
  public let resolveMpUseCase: any PraxisResolveMpUseCaseProtocol
  public let requestMpHistoryUseCase: any PraxisRequestMpHistoryUseCaseProtocol
  public let promoteMpUseCase: any PraxisPromoteMpUseCaseProtocol
  public let archiveMpUseCase: any PraxisArchiveMpUseCaseProtocol

  public init(
    inspectMpUseCase: any PraxisInspectMpUseCaseProtocol,
    searchMpUseCase: any PraxisSearchMpUseCaseProtocol,
    readbackMpUseCase: any PraxisReadbackMpUseCaseProtocol,
    smokeMpUseCase: any PraxisSmokeMpUseCaseProtocol,
    ingestMpUseCase: any PraxisIngestMpUseCaseProtocol,
    alignMpUseCase: any PraxisAlignMpUseCaseProtocol,
    resolveMpUseCase: any PraxisResolveMpUseCaseProtocol,
    requestMpHistoryUseCase: any PraxisRequestMpHistoryUseCaseProtocol,
    promoteMpUseCase: any PraxisPromoteMpUseCaseProtocol,
    archiveMpUseCase: any PraxisArchiveMpUseCaseProtocol
  ) {
    self.inspectMpUseCase = inspectMpUseCase
    self.searchMpUseCase = searchMpUseCase
    self.readbackMpUseCase = readbackMpUseCase
    self.smokeMpUseCase = smokeMpUseCase
    self.ingestMpUseCase = ingestMpUseCase
    self.alignMpUseCase = alignMpUseCase
    self.resolveMpUseCase = resolveMpUseCase
    self.requestMpHistoryUseCase = requestMpHistoryUseCase
    self.promoteMpUseCase = promoteMpUseCase
    self.archiveMpUseCase = archiveMpUseCase
  }

  public convenience init(dependencies: PraxisDependencyGraph) {
    self.init(
      inspectMpUseCase: PraxisInspectMpUseCase(dependencies: dependencies),
      searchMpUseCase: PraxisSearchMpUseCase(dependencies: dependencies),
      readbackMpUseCase: PraxisReadbackMpUseCase(dependencies: dependencies),
      smokeMpUseCase: PraxisSmokeMpUseCase(dependencies: dependencies),
      ingestMpUseCase: PraxisIngestMpUseCase(dependencies: dependencies),
      alignMpUseCase: PraxisAlignMpUseCase(dependencies: dependencies),
      resolveMpUseCase: PraxisResolveMpUseCase(dependencies: dependencies),
      requestMpHistoryUseCase: PraxisRequestMpHistoryUseCase(dependencies: dependencies),
      promoteMpUseCase: PraxisPromoteMpUseCase(dependencies: dependencies),
      archiveMpUseCase: PraxisArchiveMpUseCase(dependencies: dependencies)
    )
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

  /// Searches MP memory records through the host-neutral facade.
  ///
  /// - Parameter command: MP search request parameters.
  /// - Returns: Ranked host-neutral MP search results.
  /// - Throws: Propagates runtime search failures from the underlying use case.
  public func search(_ command: PraxisSearchMpCommand) async throws -> PraxisMpSearchSnapshot {
    let result = try await searchMpUseCase.execute(command)
    return PraxisMpSearchSnapshot(
      projectID: result.projectID,
      query: result.query,
      summary: result.summary,
      hits: result.hits.map {
        PraxisMpSearchHitSnapshot(
          memoryID: $0.memoryID,
          agentID: $0.agentID,
          scopeLevel: $0.scopeLevel,
          memoryKind: $0.memoryKind,
          freshnessStatus: $0.freshnessStatus,
          alignmentStatus: $0.alignmentStatus,
          summary: $0.summary,
          storageKey: $0.storageKey,
          semanticScore: $0.semanticScore,
          finalScore: $0.finalScore,
          rankExplanation: $0.rankExplanation
        )
      },
      issues: result.issues
    )
  }

  /// Reads back MP memory distribution and governance status.
  ///
  /// - Parameter command: MP readback request parameters.
  /// - Returns: A host-neutral MP readback snapshot.
  /// - Throws: Propagates runtime readback failures from the underlying use case.
  public func readback(_ command: PraxisReadbackMpCommand) async throws -> PraxisMpReadbackSnapshot {
    let readback = try await readbackMpUseCase.execute(command)
    return PraxisMpReadbackSnapshot(
      projectID: readback.projectID,
      summary: readback.summary,
      totalMemoryCount: readback.totalMemoryCount,
      primaryCount: readback.primaryCount,
      supportingCount: readback.supportingCount,
      omittedSupersededCount: readback.omittedSupersededCount,
      freshnessBreakdown: readback.freshnessBreakdown,
      alignmentBreakdown: readback.alignmentBreakdown,
      scopeBreakdown: readback.scopeBreakdown,
      issues: readback.issues
    )
  }

  /// Runs MP smoke checks against the currently wired host adapters.
  ///
  /// - Parameter command: MP smoke request parameters.
  /// - Returns: A host-neutral MP smoke snapshot.
  /// - Throws: Propagates runtime smoke failures from the underlying use case.
  public func smoke(_ command: PraxisSmokeMpCommand) async throws -> PraxisMpSmokeSnapshot {
    let smoke = try await smokeMpUseCase.execute(command)
    return PraxisMpSmokeSnapshot(
      projectID: smoke.projectID,
      summary: smoke.summary,
      smokeResult: mapSmokeResult(smoke.checks, summary: smoke.summary)
    )
  }

  /// Ingests one MP candidate memory through the host-neutral facade.
  ///
  /// - Parameter command: MP ingest request parameters.
  /// - Returns: A host-neutral MP ingest snapshot.
  /// - Throws: Propagates runtime ingest failures from the underlying use case.
  public func ingest(_ command: PraxisIngestMpCommand) async throws -> PraxisMpIngestSnapshot {
    let ingest = try await ingestMpUseCase.execute(command)
    return PraxisMpIngestSnapshot(
      projectID: ingest.projectID,
      agentID: ingest.agentID,
      sessionID: ingest.sessionID,
      summary: ingest.summary,
      primaryMemoryID: ingest.primaryMemoryID,
      storageKey: ingest.storageKey,
      updatedMemoryIDs: ingest.updatedMemoryIDs,
      supersededMemoryIDs: ingest.supersededMemoryIDs,
      staleMemoryIDs: ingest.staleMemoryIDs,
      decision: ingest.decision,
      freshnessStatus: ingest.freshnessStatus,
      alignmentStatus: ingest.alignmentStatus,
      issues: ingest.issues
    )
  }

  /// Re-aligns one persisted MP memory through the host-neutral facade.
  ///
  /// - Parameter command: MP align request parameters.
  /// - Returns: A host-neutral MP align snapshot.
  /// - Throws: Propagates runtime align failures from the underlying use case.
  public func align(_ command: PraxisAlignMpCommand) async throws -> PraxisMpAlignSnapshot {
    let align = try await alignMpUseCase.execute(command)
    return PraxisMpAlignSnapshot(
      projectID: align.projectID,
      memoryID: align.memoryID,
      summary: align.summary,
      primaryMemoryID: align.primaryMemoryID,
      updatedMemoryIDs: align.updatedMemoryIDs,
      supersededMemoryIDs: align.supersededMemoryIDs,
      staleMemoryIDs: align.staleMemoryIDs,
      decision: align.decision,
      freshnessStatus: align.freshnessStatus,
      alignmentStatus: align.alignmentStatus,
      issues: align.issues
    )
  }

  /// Resolves one MP workflow bundle through the host-neutral facade.
  ///
  /// - Parameter command: MP resolve request parameters.
  /// - Returns: A host-neutral MP resolve snapshot.
  /// - Throws: Propagates runtime resolve failures from the underlying use case.
  public func resolve(_ command: PraxisResolveMpCommand) async throws -> PraxisMpResolveSnapshot {
    let resolve = try await resolveMpUseCase.execute(command)
    return PraxisMpResolveSnapshot(
      projectID: resolve.projectID,
      query: resolve.query,
      summary: resolve.summary,
      primaryMemoryIDs: resolve.primaryMemoryIDs,
      supportingMemoryIDs: resolve.supportingMemoryIDs,
      omittedSupersededMemoryIDs: resolve.omittedSupersededMemoryIDs,
      rerankComposition: mapRerankComposition(resolve.rerankComposition),
      roleCounts: resolve.roleCounts,
      roleStages: resolve.roleStages,
      issues: resolve.issues
    )
  }

  /// Requests MP history bundle reconstruction through the host-neutral facade.
  ///
  /// - Parameter command: MP history request parameters.
  /// - Returns: A host-neutral MP history snapshot.
  /// - Throws: Propagates runtime history failures from the underlying use case.
  public func requestHistory(_ command: PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistorySnapshot {
    let history = try await requestMpHistoryUseCase.execute(command)
    return PraxisMpHistorySnapshot(
      projectID: history.projectID,
      requesterAgentID: history.requesterAgentID,
      query: history.query,
      reason: history.reason,
      summary: history.summary,
      primaryMemoryIDs: history.primaryMemoryIDs,
      supportingMemoryIDs: history.supportingMemoryIDs,
      omittedSupersededMemoryIDs: history.omittedSupersededMemoryIDs,
      rerankComposition: mapRerankComposition(history.rerankComposition),
      roleCounts: history.roleCounts,
      roleStages: history.roleStages,
      issues: history.issues
    )
  }

  /// Promotes one MP memory record through the host-neutral facade.
  ///
  /// - Parameter command: MP promote request parameters.
  /// - Returns: A host-neutral MP promote snapshot.
  /// - Throws: Propagates runtime promotion failures from the underlying use case.
  public func promote(_ command: PraxisPromoteMpCommand) async throws -> PraxisMpPromoteSnapshot {
    let promote = try await promoteMpUseCase.execute(command)
    return PraxisMpPromoteSnapshot(
      projectID: promote.projectID,
      memoryID: promote.memoryID,
      summary: promote.summary,
      scopeLevel: promote.scopeLevel,
      sessionID: promote.sessionID,
      sessionMode: promote.sessionMode,
      visibilityState: promote.visibilityState,
      promotionState: promote.promotionState,
      updatedAt: promote.updatedAt,
      issues: promote.issues
    )
  }

  /// Archives one MP memory record through the host-neutral facade.
  ///
  /// - Parameter command: MP archive request parameters.
  /// - Returns: A host-neutral MP archive snapshot.
  /// - Throws: Propagates runtime archive failures from the underlying use case.
  public func archive(_ command: PraxisArchiveMpCommand) async throws -> PraxisMpArchiveSnapshot {
    let archive = try await archiveMpUseCase.execute(command)
    return PraxisMpArchiveSnapshot(
      projectID: archive.projectID,
      memoryID: archive.memoryID,
      summary: archive.summary,
      scopeLevel: archive.scopeLevel,
      sessionID: archive.sessionID,
      sessionMode: archive.sessionMode,
      visibilityState: archive.visibilityState,
      promotionState: archive.promotionState,
      updatedAt: archive.updatedAt,
      issues: archive.issues
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
