import PraxisGoal
import PraxisRuntimeUseCases
import PraxisRun

public final class PraxisRuntimeFacade: Sendable {
  public let runFacade: PraxisRunFacade
  public let inspectionFacade: PraxisInspectionFacade

  public init(
    runFacade: PraxisRunFacade,
    inspectionFacade: PraxisInspectionFacade
  ) {
    self.runFacade = runFacade
    self.inspectionFacade = inspectionFacade
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

  public func runGoal(_ command: PraxisRunGoalCommand) async throws -> PraxisRunSummary {
    let runID = try await runGoalUseCase.execute(command)
    return PraxisRunSummary(
      runID: runID,
      phaseSummary: "Created placeholder run for \(command.goal.normalizedGoal.title)"
    )
  }

  public func resumeRun(_ command: PraxisResumeRunCommand) async throws -> PraxisRunSummary {
    let runID = try await resumeRunUseCase.execute(command)
    return PraxisRunSummary(
      runID: runID,
      phaseSummary: "Resumed placeholder run \(runID.rawValue)"
    )
  }
}

public final class PraxisInspectionFacade: Sendable {
  public let inspectTapUseCase: any PraxisInspectTapUseCaseProtocol
  public let inspectCmpUseCase: any PraxisInspectCmpUseCaseProtocol
  public let inspectMpUseCase: any PraxisInspectMpUseCaseProtocol
  public let buildCapabilityCatalogUseCase: any PraxisBuildCapabilityCatalogUseCaseProtocol

  public init(
    inspectTapUseCase: any PraxisInspectTapUseCaseProtocol,
    inspectCmpUseCase: any PraxisInspectCmpUseCaseProtocol,
    inspectMpUseCase: any PraxisInspectMpUseCaseProtocol,
    buildCapabilityCatalogUseCase: any PraxisBuildCapabilityCatalogUseCaseProtocol
  ) {
    self.inspectTapUseCase = inspectTapUseCase
    self.inspectCmpUseCase = inspectCmpUseCase
    self.inspectMpUseCase = inspectMpUseCase
    self.buildCapabilityCatalogUseCase = buildCapabilityCatalogUseCase
  }

  public func inspectTap() async throws -> PraxisTapInspectionSnapshot {
    let inspection = try await inspectTapUseCase.execute()
    return PraxisTapInspectionSnapshot(
      summary: inspection.summary,
      governanceSummary: inspection.governanceSnapshot.summary,
      reviewSummary: inspection.toolReviewReport.session.actions.first?.summary ?? inspection.reviewContext.riskSummary.plainLanguageSummary
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
