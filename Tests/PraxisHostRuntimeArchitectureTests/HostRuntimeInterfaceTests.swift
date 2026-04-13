import Foundation
import Testing
import PraxisCapabilityContracts
import PraxisCheckpoint
import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisInfraContracts
import PraxisJournal
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpTypes
import PraxisRun
import PraxisSession
import PraxisState
import PraxisTapReview
import PraxisTapTypes
@testable import PraxisFFI
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimeGateway
@testable import PraxisRuntimeInterface
@testable import PraxisRuntimePresentationBridge
import PraxisRuntimeUseCases
import PraxisTransition

private func capabilityID(_ rawValue: String) -> PraxisCapabilityID {
  PraxisCapabilityID(rawValue: rawValue)
}

private func runtimeInterfaceReferenceID(_ rawValue: String) -> PraxisRuntimeInterfaceReferenceID {
  PraxisRuntimeInterfaceReferenceID(rawValue: rawValue)
}

private func encodeRuntimeInterfaceTestJSON<T: Encodable>(_ value: T) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  guard let string = String(data: try encoder.encode(value), encoding: .utf8) else {
    throw PraxisError.invariantViolation("Failed to encode runtime interface test payload as UTF-8 JSON.")
  }
  return string
}

private func makeRuntimeInterfaceCheckpointRecord(
  status: PraxisAgentStatus,
  sessionID: PraxisSessionID,
  runID: PraxisRunID,
  tickCount: Int,
  lastCursor: PraxisJournalCursor?
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
  let aggregate = PraxisRunAggregate(
    id: runID,
    phase: phase,
    tickCount: tickCount,
    lastEventID: "evt.seed.\(runID.rawValue)",
    lastCheckpointReference: checkpointID.rawValue,
    latestState: .init(
      control: .init(status: status, phase: .recovery, retryCount: 0),
      working: [:],
      observed: .init(),
      recovery: .init(
        lastCheckpointRef: checkpointID.rawValue,
        resumePointer: lastCursor.map { "cursor.\($0.sequence)" }
      )
    )
  )
  let header = PraxisSessionHeader(
    id: sessionID,
    title: "Recovered Interface Run",
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
    createdAt: "2026-04-10T22:00:00Z",
    lastCursor: lastCursor,
    payload: [
      "runAggregateJSON": .string(try encodeRuntimeInterfaceTestJSON(aggregate)),
      "sessionHeaderJSON": .string(try encodeRuntimeInterfaceTestJSON(header)),
      "goalTitle": .string("Recovered Interface Run"),
    ]
  )
  return PraxisCheckpointRecord(
    pointer: .init(checkpointID: checkpointID, sessionID: sessionID),
    snapshot: snapshot
  )
}

private struct RuntimeInterfaceUnexpectedInvocationError: Error, Sendable, Equatable {
  let operation: String
}

private struct RuntimeInterfaceUnknownSmokeError: Error, Sendable, Equatable {
  let summary: String
}

private struct StubRunGoalUseCase: PraxisRunGoalUseCaseProtocol {
  let executeBody: @Sendable (PraxisRunGoalCommand) async throws -> PraxisRunExecution

  func execute(_ command: PraxisRunGoalCommand) async throws -> PraxisRunExecution {
    try await executeBody(command)
  }
}

private struct StubResumeRunUseCase: PraxisResumeRunUseCaseProtocol {
  let executeBody: @Sendable (PraxisResumeRunCommand) async throws -> PraxisRunExecution

  func execute(_ command: PraxisResumeRunCommand) async throws -> PraxisRunExecution {
    try await executeBody(command)
  }
}

private struct StubInspectTapUseCase: PraxisInspectTapUseCaseProtocol {
  let executeBody: @Sendable () async throws -> PraxisTapInspection

  func execute() async throws -> PraxisTapInspection {
    try await executeBody()
  }
}

private struct StubReadbackTapStatusUseCase: PraxisReadbackTapStatusUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackTapStatusCommand) async throws -> PraxisTapStatusReadback

  func execute(_ command: PraxisReadbackTapStatusCommand) async throws -> PraxisTapStatusReadback {
    try await executeBody(command)
  }
}

private struct StubReadbackTapHistoryUseCase: PraxisReadbackTapHistoryUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackTapHistoryCommand) async throws -> PraxisTapHistoryReadback

  func execute(_ command: PraxisReadbackTapHistoryCommand) async throws -> PraxisTapHistoryReadback {
    try await executeBody(command)
  }
}

private struct StubInspectCmpUseCase: PraxisInspectCmpUseCaseProtocol {
  let executeBody: @Sendable () async throws -> PraxisCmpInspection

  func execute() async throws -> PraxisCmpInspection {
    try await executeBody()
  }
}

private struct StubSearchMpUseCase: PraxisSearchMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisSearchMpCommand) async throws -> PraxisMpSearchResult

  func execute(_ command: PraxisSearchMpCommand) async throws -> PraxisMpSearchResult {
    try await executeBody(command)
  }
}

private struct StubReadbackMpUseCase: PraxisReadbackMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackMpCommand) async throws -> PraxisMpReadback

  func execute(_ command: PraxisReadbackMpCommand) async throws -> PraxisMpReadback {
    try await executeBody(command)
  }
}

private struct StubSmokeMpUseCase: PraxisSmokeMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisSmokeMpCommand) async throws -> PraxisMpSmoke

  func execute(_ command: PraxisSmokeMpCommand) async throws -> PraxisMpSmoke {
    try await executeBody(command)
  }
}

private struct StubIngestMpUseCase: PraxisIngestMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisIngestMpCommand) async throws -> PraxisMpIngestResult

  func execute(_ command: PraxisIngestMpCommand) async throws -> PraxisMpIngestResult {
    try await executeBody(command)
  }
}

private struct StubAlignMpUseCase: PraxisAlignMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisAlignMpCommand) async throws -> PraxisMpAlignResult

  func execute(_ command: PraxisAlignMpCommand) async throws -> PraxisMpAlignResult {
    try await executeBody(command)
  }
}

private struct StubResolveMpUseCase: PraxisResolveMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisResolveMpCommand) async throws -> PraxisMpResolveResult

  func execute(_ command: PraxisResolveMpCommand) async throws -> PraxisMpResolveResult {
    try await executeBody(command)
  }
}

private struct StubRequestMpHistoryUseCase: PraxisRequestMpHistoryUseCaseProtocol {
  let executeBody: @Sendable (PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistoryResult

  func execute(_ command: PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistoryResult {
    try await executeBody(command)
  }
}

private struct StubPromoteMpUseCase: PraxisPromoteMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisPromoteMpCommand) async throws -> PraxisMpPromoteResult

  func execute(_ command: PraxisPromoteMpCommand) async throws -> PraxisMpPromoteResult {
    try await executeBody(command)
  }
}

private struct StubArchiveMpUseCase: PraxisArchiveMpUseCaseProtocol {
  let executeBody: @Sendable (PraxisArchiveMpCommand) async throws -> PraxisMpArchiveResult

  func execute(_ command: PraxisArchiveMpCommand) async throws -> PraxisMpArchiveResult {
    try await executeBody(command)
  }
}

private struct StubOpenCmpSessionUseCase: PraxisOpenCmpSessionUseCaseProtocol {
  let executeBody: @Sendable (PraxisOpenCmpSessionCommand) async throws -> PraxisCmpSession

  func execute(_ command: PraxisOpenCmpSessionCommand) async throws -> PraxisCmpSession {
    try await executeBody(command)
  }
}

private struct StubReadbackCmpProjectUseCase: PraxisReadbackCmpProjectUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackCmpProjectCommand) async throws -> PraxisCmpProjectReadback

  func execute(_ command: PraxisReadbackCmpProjectCommand) async throws -> PraxisCmpProjectReadback {
    try await executeBody(command)
  }
}

private struct StubBootstrapCmpProjectUseCase: PraxisBootstrapCmpProjectUseCaseProtocol {
  let executeBody: @Sendable (PraxisBootstrapCmpProjectCommand) async throws -> PraxisCmpProjectBootstrap

  func execute(_ command: PraxisBootstrapCmpProjectCommand) async throws -> PraxisCmpProjectBootstrap {
    try await executeBody(command)
  }
}

private struct StubRecoverCmpProjectUseCase: PraxisRecoverCmpProjectUseCaseProtocol {
  let executeBody: @Sendable (PraxisRecoverCmpProjectCommand) async throws -> PraxisCmpProjectRecovery

  func execute(_ command: PraxisRecoverCmpProjectCommand) async throws -> PraxisCmpProjectRecovery {
    try await executeBody(command)
  }
}

private struct StubIngestCmpFlowUseCase: PraxisIngestCmpFlowUseCaseProtocol {
  let executeBody: @Sendable (PraxisIngestCmpFlowCommand) async throws -> PraxisCmpFlowIngest

  func execute(_ command: PraxisIngestCmpFlowCommand) async throws -> PraxisCmpFlowIngest {
    try await executeBody(command)
  }
}

private struct StubCommitCmpFlowUseCase: PraxisCommitCmpFlowUseCaseProtocol {
  let executeBody: @Sendable (PraxisCommitCmpFlowCommand) async throws -> PraxisCmpFlowCommit

  func execute(_ command: PraxisCommitCmpFlowCommand) async throws -> PraxisCmpFlowCommit {
    try await executeBody(command)
  }
}

private struct StubResolveCmpFlowUseCase: PraxisResolveCmpFlowUseCaseProtocol {
  let executeBody: @Sendable (PraxisResolveCmpFlowCommand) async throws -> PraxisCmpFlowResolve

  func execute(_ command: PraxisResolveCmpFlowCommand) async throws -> PraxisCmpFlowResolve {
    try await executeBody(command)
  }
}

private struct StubMaterializeCmpFlowUseCase: PraxisMaterializeCmpFlowUseCaseProtocol {
  let executeBody: @Sendable (PraxisMaterializeCmpFlowCommand) async throws -> PraxisCmpFlowMaterialize

  func execute(_ command: PraxisMaterializeCmpFlowCommand) async throws -> PraxisCmpFlowMaterialize {
    try await executeBody(command)
  }
}

private struct StubDispatchCmpFlowUseCase: PraxisDispatchCmpFlowUseCaseProtocol {
  let executeBody: @Sendable (PraxisDispatchCmpFlowCommand) async throws -> PraxisCmpFlowDispatch

  func execute(_ command: PraxisDispatchCmpFlowCommand) async throws -> PraxisCmpFlowDispatch {
    try await executeBody(command)
  }
}

private struct StubRetryCmpDispatchUseCase: PraxisRetryCmpDispatchUseCaseProtocol {
  let executeBody: @Sendable (PraxisRetryCmpDispatchCommand) async throws -> PraxisCmpFlowDispatch

  func execute(_ command: PraxisRetryCmpDispatchCommand) async throws -> PraxisCmpFlowDispatch {
    try await executeBody(command)
  }
}

private struct StubRequestCmpHistoryUseCase: PraxisRequestCmpHistoryUseCaseProtocol {
  let executeBody: @Sendable (PraxisRequestCmpHistoryCommand) async throws -> PraxisCmpFlowHistory

  func execute(_ command: PraxisRequestCmpHistoryCommand) async throws -> PraxisCmpFlowHistory {
    try await executeBody(command)
  }
}

private struct StubReadbackCmpRolesUseCase: PraxisReadbackCmpRolesUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackCmpRolesCommand) async throws -> PraxisCmpRolesReadback

  func execute(_ command: PraxisReadbackCmpRolesCommand) async throws -> PraxisCmpRolesReadback {
    try await executeBody(command)
  }
}

private struct StubReadbackCmpControlUseCase: PraxisReadbackCmpControlUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackCmpControlCommand) async throws -> PraxisCmpControlReadback

  func execute(_ command: PraxisReadbackCmpControlCommand) async throws -> PraxisCmpControlReadback {
    try await executeBody(command)
  }
}

private struct StubUpdateCmpControlUseCase: PraxisUpdateCmpControlUseCaseProtocol {
  let executeBody: @Sendable (PraxisUpdateCmpControlCommand) async throws -> PraxisCmpControlUpdate

  func execute(_ command: PraxisUpdateCmpControlCommand) async throws -> PraxisCmpControlUpdate {
    try await executeBody(command)
  }
}

private struct StubRequestCmpPeerApprovalUseCase: PraxisRequestCmpPeerApprovalUseCaseProtocol {
  let executeBody: @Sendable (PraxisRequestCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval

  func execute(_ command: PraxisRequestCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval {
    try await executeBody(command)
  }
}

private struct StubDecideCmpPeerApprovalUseCase: PraxisDecideCmpPeerApprovalUseCaseProtocol {
  let executeBody: @Sendable (PraxisDecideCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval

  func execute(_ command: PraxisDecideCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval {
    try await executeBody(command)
  }
}

private struct StubReadbackCmpPeerApprovalUseCase: PraxisReadbackCmpPeerApprovalUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalReadback

  func execute(_ command: PraxisReadbackCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalReadback {
    try await executeBody(command)
  }
}

private struct StubReadbackCmpStatusUseCase: PraxisReadbackCmpStatusUseCaseProtocol {
  let executeBody: @Sendable (PraxisReadbackCmpStatusCommand) async throws -> PraxisCmpStatusReadback

  func execute(_ command: PraxisReadbackCmpStatusCommand) async throws -> PraxisCmpStatusReadback {
    try await executeBody(command)
  }
}

private struct StubSmokeCmpProjectUseCase: PraxisSmokeCmpProjectUseCaseProtocol {
  let executeBody: @Sendable (PraxisSmokeCmpProjectCommand) async throws -> PraxisCmpProjectSmoke

  func execute(_ command: PraxisSmokeCmpProjectCommand) async throws -> PraxisCmpProjectSmoke {
    try await executeBody(command)
  }
}

private struct StubInspectMpUseCase: PraxisInspectMpUseCaseProtocol {
  let executeBody: @Sendable () async throws -> PraxisMpInspection

  func execute() async throws -> PraxisMpInspection {
    try await executeBody()
  }
}

private struct StubBuildCapabilityCatalogUseCase: PraxisBuildCapabilityCatalogUseCaseProtocol {
  let executeBody: @Sendable () async throws -> String

  func execute() async throws -> String {
    try await executeBody()
  }
}

private func makeThrowingRuntimeInterface(
  runGoalError: Error? = nil,
  resumeRunError: Error? = nil,
  inspectTapError: Error? = nil,
  readbackTapStatusError: Error? = nil,
  readbackTapHistoryError: Error? = nil,
  inspectCmpError: Error? = nil,
  openCmpSessionError: Error? = nil,
  readbackCmpProjectError: Error? = nil,
  bootstrapCmpProjectError: Error? = nil,
  ingestCmpFlowError: Error? = nil,
  commitCmpFlowError: Error? = nil,
  resolveCmpFlowError: Error? = nil,
  materializeCmpFlowError: Error? = nil,
  dispatchCmpFlowError: Error? = nil,
  retryCmpDispatchError: Error? = nil,
  requestCmpHistoryError: Error? = nil,
  readbackCmpRolesError: Error? = nil,
  readbackCmpControlError: Error? = nil,
  updateCmpControlError: Error? = nil,
  requestCmpPeerApprovalError: Error? = nil,
  decideCmpPeerApprovalError: Error? = nil,
  readbackCmpPeerApprovalError: Error? = nil,
  readbackCmpStatusError: Error? = nil,
  smokeCmpProjectError: Error? = nil,
  inspectMpError: Error? = nil,
  buildCapabilityCatalogError: Error? = nil
) -> PraxisRuntimeInterfaceSession {
  let runFacade = PraxisRunFacade(
    runGoalUseCase: StubRunGoalUseCase { _ in
      if let runGoalError {
        throw runGoalError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "runGoal")
    },
    resumeRunUseCase: StubResumeRunUseCase { _ in
      if let resumeRunError {
        throw resumeRunError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "resumeRun")
    }
  )
  let inspectionFacade = PraxisInspectionFacade(
    inspectTapUseCase: StubInspectTapUseCase {
      if let inspectTapError {
        throw inspectTapError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectTap")
    },
    readbackTapStatusUseCase: StubReadbackTapStatusUseCase { _ in
      if let readbackTapStatusError {
        throw readbackTapStatusError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackTapStatus")
    },
    readbackTapHistoryUseCase: StubReadbackTapHistoryUseCase { _ in
      if let readbackTapHistoryError {
        throw readbackTapHistoryError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackTapHistory")
    },
    inspectCmpUseCase: StubInspectCmpUseCase {
      if let inspectCmpError {
        throw inspectCmpError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectCmp")
    },
    inspectMpUseCase: StubInspectMpUseCase {
      if let inspectMpError {
        throw inspectMpError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectMp")
    },
    buildCapabilityCatalogUseCase: StubBuildCapabilityCatalogUseCase {
      if let buildCapabilityCatalogError {
        throw buildCapabilityCatalogError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "buildCapabilityCatalog")
    }
  )
  let cmpFacade = PraxisCmpFacade(
    openCmpSessionUseCase: StubOpenCmpSessionUseCase { _ in
      if let openCmpSessionError {
        throw openCmpSessionError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "openCmpSession")
    },
    readbackCmpProjectUseCase: StubReadbackCmpProjectUseCase { _ in
      if let readbackCmpProjectError {
        throw readbackCmpProjectError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpProject")
    },
    bootstrapCmpProjectUseCase: StubBootstrapCmpProjectUseCase { _ in
      if let bootstrapCmpProjectError {
        throw bootstrapCmpProjectError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "bootstrapCmpProject")
    },
    ingestCmpFlowUseCase: StubIngestCmpFlowUseCase { _ in
      if let ingestCmpFlowError {
        throw ingestCmpFlowError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "ingestCmpFlow")
    },
    commitCmpFlowUseCase: StubCommitCmpFlowUseCase { _ in
      if let commitCmpFlowError {
        throw commitCmpFlowError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "commitCmpFlow")
    },
    resolveCmpFlowUseCase: StubResolveCmpFlowUseCase { _ in
      if let resolveCmpFlowError {
        throw resolveCmpFlowError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "resolveCmpFlow")
    },
    materializeCmpFlowUseCase: StubMaterializeCmpFlowUseCase { _ in
      if let materializeCmpFlowError {
        throw materializeCmpFlowError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "materializeCmpFlow")
    },
    dispatchCmpFlowUseCase: StubDispatchCmpFlowUseCase { _ in
      if let dispatchCmpFlowError {
        throw dispatchCmpFlowError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "dispatchCmpFlow")
    },
    retryCmpDispatchUseCase: StubRetryCmpDispatchUseCase { _ in
      if let retryCmpDispatchError {
        throw retryCmpDispatchError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "retryCmpDispatch")
    },
    requestCmpHistoryUseCase: StubRequestCmpHistoryUseCase { _ in
      if let requestCmpHistoryError {
        throw requestCmpHistoryError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestCmpHistory")
    },
    readbackCmpRolesUseCase: StubReadbackCmpRolesUseCase { _ in
      if let readbackCmpRolesError {
        throw readbackCmpRolesError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpRoles")
    },
    readbackCmpControlUseCase: StubReadbackCmpControlUseCase { _ in
      if let readbackCmpControlError {
        throw readbackCmpControlError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpControl")
    },
    updateCmpControlUseCase: StubUpdateCmpControlUseCase { _ in
      if let updateCmpControlError {
        throw updateCmpControlError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "updateCmpControl")
    },
    requestCmpPeerApprovalUseCase: StubRequestCmpPeerApprovalUseCase { _ in
      if let requestCmpPeerApprovalError {
        throw requestCmpPeerApprovalError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestCmpPeerApproval")
    },
    decideCmpPeerApprovalUseCase: StubDecideCmpPeerApprovalUseCase { _ in
      if let decideCmpPeerApprovalError {
        throw decideCmpPeerApprovalError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "decideCmpPeerApproval")
    },
    readbackCmpPeerApprovalUseCase: StubReadbackCmpPeerApprovalUseCase { _ in
      if let readbackCmpPeerApprovalError {
        throw readbackCmpPeerApprovalError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpPeerApproval")
    },
    readbackCmpStatusUseCase: StubReadbackCmpStatusUseCase { _ in
      if let readbackCmpStatusError {
        throw readbackCmpStatusError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpStatus")
    },
    smokeCmpProjectUseCase: StubSmokeCmpProjectUseCase { _ in
      if let smokeCmpProjectError {
        throw smokeCmpProjectError
      }
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "smokeCmpProject")
    }
  )

  return PraxisRuntimeInterfaceSession(
    runtimeFacade: .init(runFacade: runFacade, inspectionFacade: inspectionFacade, cmpFacade: cmpFacade),
    blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
  )
}

private func makeUnexpectedRunFacade() -> PraxisRunFacade {
  PraxisRunFacade(
    runGoalUseCase: StubRunGoalUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "runGoal")
    },
    resumeRunUseCase: StubResumeRunUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "resumeRun")
    }
  )
}

private func makeUnexpectedInspectionFacade() -> PraxisInspectionFacade {
  PraxisInspectionFacade(
    inspectTapUseCase: StubInspectTapUseCase {
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectTap")
    },
    readbackTapStatusUseCase: StubReadbackTapStatusUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackTapStatus")
    },
    readbackTapHistoryUseCase: StubReadbackTapHistoryUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackTapHistory")
    },
    inspectCmpUseCase: StubInspectCmpUseCase {
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectCmp")
    },
    inspectMpUseCase: StubInspectMpUseCase {
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectMp")
    },
    buildCapabilityCatalogUseCase: StubBuildCapabilityCatalogUseCase {
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "buildCapabilityCatalog")
    }
  )
}

private func makeUnexpectedMpFacade() -> PraxisMpFacade {
  PraxisMpFacade(
    inspectMpUseCase: StubInspectMpUseCase {
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectMp")
    },
    searchMpUseCase: StubSearchMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "searchMp")
    },
    readbackMpUseCase: StubReadbackMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackMp")
    },
    smokeMpUseCase: StubSmokeMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "smokeMp")
    },
    ingestMpUseCase: StubIngestMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "ingestMp")
    },
    alignMpUseCase: StubAlignMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "alignMp")
    },
    resolveMpUseCase: StubResolveMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "resolveMp")
    },
    requestMpHistoryUseCase: StubRequestMpHistoryUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestMpHistory")
    },
    promoteMpUseCase: StubPromoteMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "promoteMp")
    },
    archiveMpUseCase: StubArchiveMpUseCase { _ in
      throw RuntimeInterfaceUnexpectedInvocationError(operation: "archiveMp")
    }
  )
}

private func makeStubMpFacade(
  inspectMp: @escaping @Sendable () async throws -> PraxisMpInspection = {
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectMp")
  },
  searchMp: @escaping @Sendable (PraxisSearchMpCommand) async throws -> PraxisMpSearchResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "searchMp")
  },
  readbackMp: @escaping @Sendable (PraxisReadbackMpCommand) async throws -> PraxisMpReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackMp")
  },
  smokeMp: @escaping @Sendable (PraxisSmokeMpCommand) async throws -> PraxisMpSmoke = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "smokeMp")
  },
  ingestMp: @escaping @Sendable (PraxisIngestMpCommand) async throws -> PraxisMpIngestResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "ingestMp")
  },
  alignMp: @escaping @Sendable (PraxisAlignMpCommand) async throws -> PraxisMpAlignResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "alignMp")
  },
  resolveMp: @escaping @Sendable (PraxisResolveMpCommand) async throws -> PraxisMpResolveResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "resolveMp")
  },
  requestMpHistory: @escaping @Sendable (PraxisRequestMpHistoryCommand) async throws -> PraxisMpHistoryResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestMpHistory")
  },
  promoteMp: @escaping @Sendable (PraxisPromoteMpCommand) async throws -> PraxisMpPromoteResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "promoteMp")
  },
  archiveMp: @escaping @Sendable (PraxisArchiveMpCommand) async throws -> PraxisMpArchiveResult = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "archiveMp")
  }
) -> PraxisMpFacade {
  PraxisMpFacade(
    inspectMpUseCase: StubInspectMpUseCase(executeBody: inspectMp),
    searchMpUseCase: StubSearchMpUseCase(executeBody: searchMp),
    readbackMpUseCase: StubReadbackMpUseCase(executeBody: readbackMp),
    smokeMpUseCase: StubSmokeMpUseCase(executeBody: smokeMp),
    ingestMpUseCase: StubIngestMpUseCase(executeBody: ingestMp),
    alignMpUseCase: StubAlignMpUseCase(executeBody: alignMp),
    resolveMpUseCase: StubResolveMpUseCase(executeBody: resolveMp),
    requestMpHistoryUseCase: StubRequestMpHistoryUseCase(executeBody: requestMpHistory),
    promoteMpUseCase: StubPromoteMpUseCase(executeBody: promoteMp),
    archiveMpUseCase: StubArchiveMpUseCase(executeBody: archiveMp)
  )
}

private func makeStubCmpFacade(
  openCmpSession: @escaping @Sendable (PraxisOpenCmpSessionCommand) async throws -> PraxisCmpSession = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "openCmpSession")
  },
  readbackCmpProject: @escaping @Sendable (PraxisReadbackCmpProjectCommand) async throws -> PraxisCmpProjectReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpProject")
  },
  bootstrapCmpProject: @escaping @Sendable (PraxisBootstrapCmpProjectCommand) async throws -> PraxisCmpProjectBootstrap = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "bootstrapCmpProject")
  },
  recoverCmpProject: @escaping @Sendable (PraxisRecoverCmpProjectCommand) async throws -> PraxisCmpProjectRecovery = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "recoverCmpProject")
  },
  ingestCmpFlow: @escaping @Sendable (PraxisIngestCmpFlowCommand) async throws -> PraxisCmpFlowIngest = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "ingestCmpFlow")
  },
  commitCmpFlow: @escaping @Sendable (PraxisCommitCmpFlowCommand) async throws -> PraxisCmpFlowCommit = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "commitCmpFlow")
  },
  resolveCmpFlow: @escaping @Sendable (PraxisResolveCmpFlowCommand) async throws -> PraxisCmpFlowResolve = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "resolveCmpFlow")
  },
  materializeCmpFlow: @escaping @Sendable (PraxisMaterializeCmpFlowCommand) async throws -> PraxisCmpFlowMaterialize = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "materializeCmpFlow")
  },
  dispatchCmpFlow: @escaping @Sendable (PraxisDispatchCmpFlowCommand) async throws -> PraxisCmpFlowDispatch = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "dispatchCmpFlow")
  },
  retryCmpDispatch: @escaping @Sendable (PraxisRetryCmpDispatchCommand) async throws -> PraxisCmpFlowDispatch = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "retryCmpDispatch")
  },
  requestCmpHistory: @escaping @Sendable (PraxisRequestCmpHistoryCommand) async throws -> PraxisCmpFlowHistory = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestCmpHistory")
  },
  readbackCmpRoles: @escaping @Sendable (PraxisReadbackCmpRolesCommand) async throws -> PraxisCmpRolesReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpRoles")
  },
  readbackCmpControl: @escaping @Sendable (PraxisReadbackCmpControlCommand) async throws -> PraxisCmpControlReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpControl")
  },
  updateCmpControl: @escaping @Sendable (PraxisUpdateCmpControlCommand) async throws -> PraxisCmpControlUpdate = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "updateCmpControl")
  },
  requestCmpPeerApproval: @escaping @Sendable (PraxisRequestCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestCmpPeerApproval")
  },
  decideCmpPeerApproval: @escaping @Sendable (PraxisDecideCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApproval = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "decideCmpPeerApproval")
  },
  readbackCmpPeerApproval: @escaping @Sendable (PraxisReadbackCmpPeerApprovalCommand) async throws -> PraxisCmpPeerApprovalReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpPeerApproval")
  },
  readbackCmpStatus: @escaping @Sendable (PraxisReadbackCmpStatusCommand) async throws -> PraxisCmpStatusReadback = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackCmpStatus")
  },
  smokeCmpProject: @escaping @Sendable (PraxisSmokeCmpProjectCommand) async throws -> PraxisCmpProjectSmoke = { _ in
    throw RuntimeInterfaceUnexpectedInvocationError(operation: "smokeCmpProject")
  }
) -> PraxisCmpFacade {
  PraxisCmpFacade(
    openCmpSessionUseCase: StubOpenCmpSessionUseCase(executeBody: openCmpSession),
    readbackCmpProjectUseCase: StubReadbackCmpProjectUseCase(executeBody: readbackCmpProject),
    bootstrapCmpProjectUseCase: StubBootstrapCmpProjectUseCase(executeBody: bootstrapCmpProject),
    recoverCmpProjectUseCase: StubRecoverCmpProjectUseCase(executeBody: recoverCmpProject),
    ingestCmpFlowUseCase: StubIngestCmpFlowUseCase(executeBody: ingestCmpFlow),
    commitCmpFlowUseCase: StubCommitCmpFlowUseCase(executeBody: commitCmpFlow),
    resolveCmpFlowUseCase: StubResolveCmpFlowUseCase(executeBody: resolveCmpFlow),
    materializeCmpFlowUseCase: StubMaterializeCmpFlowUseCase(executeBody: materializeCmpFlow),
    dispatchCmpFlowUseCase: StubDispatchCmpFlowUseCase(executeBody: dispatchCmpFlow),
    retryCmpDispatchUseCase: StubRetryCmpDispatchUseCase(executeBody: retryCmpDispatch),
    requestCmpHistoryUseCase: StubRequestCmpHistoryUseCase(executeBody: requestCmpHistory),
    readbackCmpRolesUseCase: StubReadbackCmpRolesUseCase(executeBody: readbackCmpRoles),
    readbackCmpControlUseCase: StubReadbackCmpControlUseCase(executeBody: readbackCmpControl),
    updateCmpControlUseCase: StubUpdateCmpControlUseCase(executeBody: updateCmpControl),
    requestCmpPeerApprovalUseCase: StubRequestCmpPeerApprovalUseCase(executeBody: requestCmpPeerApproval),
    decideCmpPeerApprovalUseCase: StubDecideCmpPeerApprovalUseCase(executeBody: decideCmpPeerApproval),
    readbackCmpPeerApprovalUseCase: StubReadbackCmpPeerApprovalUseCase(executeBody: readbackCmpPeerApproval),
    readbackCmpStatusUseCase: StubReadbackCmpStatusUseCase(executeBody: readbackCmpStatus),
    smokeCmpProjectUseCase: StubSmokeCmpProjectUseCase(executeBody: smokeCmpProject)
  )
}

private func makeStubbedRuntimeInterface(cmpFacade: PraxisCmpFacade) -> PraxisRuntimeInterfaceSession {
  PraxisRuntimeInterfaceSession(
    runtimeFacade: .init(
      runFacade: makeUnexpectedRunFacade(),
      inspectionFacade: makeUnexpectedInspectionFacade(),
      cmpFacade: cmpFacade
    ),
    blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
  )
}

private func makeStubbedRuntimeInterface(inspectionFacade: PraxisInspectionFacade) -> PraxisRuntimeInterfaceSession {
  PraxisRuntimeInterfaceSession(
    runtimeFacade: .init(
      runFacade: makeUnexpectedRunFacade(),
      inspectionFacade: inspectionFacade,
      cmpFacade: makeStubCmpFacade()
    ),
    blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
  )
}

private func makeStubbedRuntimeInterface(mpFacade: PraxisMpFacade) -> PraxisRuntimeInterfaceSession {
  let cmpFacade = makeStubCmpFacade()
  return PraxisRuntimeInterfaceSession(
    runtimeFacade: .init(
      runFacade: makeUnexpectedRunFacade(),
      inspectionFacade: makeUnexpectedInspectionFacade(),
      mpFacade: mpFacade,
      cmpSessionFacade: cmpFacade.sessionFacade,
      cmpProjectFacade: cmpFacade.projectFacade,
      cmpFlowFacade: cmpFacade.flowFacade,
      cmpRolesFacade: cmpFacade.rolesFacade,
      cmpControlFacade: cmpFacade.controlFacade,
      cmpReadbackFacade: cmpFacade.readbackFacade
    ),
    blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
  )
}

struct HostRuntimeInterfaceTests {
  @Test
  func runtimeInterfaceBuildsNeutralRunResponseAndBuffersEvents() async throws {
    let hostAdapters = PraxisHostAdapterRegistry.scaffoldDefaults()
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: hostAdapters,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .runGoal(
        .init(
          payloadSummary: "Drive host-neutral runtime interface",
          goalID: "goal.runtime-interface",
          goalTitle: "Runtime Interface Goal",
          sessionID: "session.runtime-interface"
        )
      )
    )
    let bufferedEvents = await runtimeInterface.snapshotEvents()

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.snapshot?.kind == .run)
    #expect(response.snapshot?.title == "Run run:session.runtime-interface:goal.runtime-interface")
    #expect(response.snapshot?.sessionID?.rawValue == "session.runtime-interface")
    #expect(response.snapshot?.phase == .running)
    #expect(response.snapshot?.lifecycleDisposition == .started)
    #expect(
      response.snapshot?.checkpointReference ==
        runtimeInterfaceReferenceID("checkpoint.run:session.runtime-interface:goal.runtime-interface")
    )
    #expect(
      response.snapshot?.pendingIntentID ==
        runtimeInterfaceReferenceID("evt.created.run:session.runtime-interface:goal.runtime-interface:model")
    )
    #expect(response.events.map(\.name) == [.runStarted, .runFollowUpReady])
    #expect(
      response.events.last?.intentID ==
        runtimeInterfaceReferenceID("evt.created.run:session.runtime-interface:goal.runtime-interface:model")
    )
    #expect(bufferedEvents.map(\.name) == [.runStarted, .runFollowUpReady])
  }

  @Test
  func runtimeInterfacePreservesOpaqueOutgoingReferenceIDsWithoutTrimming() async throws {
    let runFacade = PraxisRunFacade(
      runGoalUseCase: StubRunGoalUseCase { command in
        PraxisRunExecution(
          runID: .init(rawValue: "run:\(command.sessionID?.rawValue ?? "session.blank-reference"):\(command.goal.normalizedGoal.id.rawValue)"),
          sessionID: command.sessionID ?? .init(rawValue: "session.blank-reference"),
          phase: .running,
          tickCount: 1,
          journalSequence: 1,
          checkpointReference: "   ",
          followUpAction: .init(
            kind: .modelInference,
            reason: "Continue with normalized blank reference.",
            intentID: "   "
          )
        )
      },
      resumeRunUseCase: StubResumeRunUseCase { _ in
        throw RuntimeInterfaceUnexpectedInvocationError(operation: "resumeRun")
      }
    )
    let runtimeInterface = PraxisRuntimeInterfaceSession(
      runtimeFacade: .init(
        runFacade: runFacade,
        inspectionFacade: makeUnexpectedInspectionFacade(),
        cmpFacade: makeStubCmpFacade()
      ),
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .runGoal(
        .init(
          payloadSummary: "Normalize blank interface reference",
          goalID: "goal.blank-reference",
          goalTitle: "Blank Reference Goal",
          sessionID: "session.blank-reference"
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.snapshot?.checkpointReference == runtimeInterfaceReferenceID("   "))
    #expect(response.snapshot?.pendingIntentID == runtimeInterfaceReferenceID("   "))
    #expect(response.events.map(\.name) == [.runStarted, .runFollowUpReady])
    #expect(response.events.last?.intentID == runtimeInterfaceReferenceID("   "))
  }

  @Test
  func runtimeInterfaceExposesReplayAwareResumeDisposition() async throws {
    let sessionID = PraxisSessionID(rawValue: "session.interface-terminal")
    let runID = PraxisRunID(rawValue: "run:session.interface-terminal:goal.interface-terminal")
    let checkpointRecord = try makeRuntimeInterfaceCheckpointRecord(
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
          summary: "Run completed with result interface-terminal",
          metadata: [
            "kernelEventType": .string("run.completed"),
            "kernelEventID": .string("evt.completed.\(runID.rawValue)"),
            "createdAt": .string("2026-04-10T22:10:00Z"),
            "resultID": .string("interface-terminal"),
          ]
        )
      ])
    )
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: hostAdapters,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Replay and reconcile",
          runID: runID.rawValue
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.snapshot?.phase == .completed)
    #expect(response.snapshot?.lifecycleDisposition == .recoveredWithoutResume)
    #expect(response.snapshot?.recoveredEventCount == 1)
    #expect(response.snapshot?.pendingIntentID == nil)
    #expect(response.events.map(\.name) == [.runRecovered])
  }

  @Test
  func runtimeInterfaceRoutesCmpSessionAndProjectRequests() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.localDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let sessionResponse = await runtimeInterface.handle(
      .openCmpSession(
        .init(
          payloadSummary: "Open local CMP session",
          projectID: "cmp.local-runtime",
          sessionID: "cmp.session.test"
        )
      )
    )
    let readbackResponse = await runtimeInterface.handle(
      .readbackCmpProject(
        .init(
          payloadSummary: "Read back local CMP project",
          projectID: "cmp.local-runtime"
        )
      )
    )
    let tapStatusResponse = await runtimeInterface.handle(
      .readbackTapStatus(
        .init(
          payloadSummary: "Read back TAP status",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let tapHistoryResponse = await runtimeInterface.handle(
      .readbackTapHistory(
        .init(
          payloadSummary: "Read back TAP history",
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          limit: 5
        )
      )
    )
    let rolesReadbackResponse = await runtimeInterface.handle(
      .readbackCmpRoles(
        .init(
          payloadSummary: "Read back CMP roles",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let controlReadbackResponse = await runtimeInterface.handle(
      .readbackCmpControl(
        .init(
          payloadSummary: "Read back CMP control",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let controlUpdateResponse = await runtimeInterface.handle(
      .updateCmpControl(
        .init(
          payloadSummary: "Update CMP control",
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          executionStyle: .manual,
          mode: .peerReview,
          readbackPriority: .packageFirst,
          fallbackPolicy: .registryOnly,
          recoveryPreference: .resumeLatest,
          automation: .init(values: [.autoDispatch: false])
        )
      )
    )
    let approvalRequestResponse = await runtimeInterface.handle(
      .requestCmpPeerApproval(
        .init(
          payloadSummary: "Request CMP peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          requestedTier: .b1,
          summary: "Escalate git access to checker"
        )
      )
    )
    let approvalDecisionResponse = await runtimeInterface.handle(
      .decideCmpPeerApproval(
        .init(
          payloadSummary: "Approve CMP peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          decision: .approve,
          reviewerAgentID: "reviewer.local",
          decisionSummary: "Approved git access for checker"
        )
      )
    )
    let approvalReadbackResponse = await runtimeInterface.handle(
      .readbackCmpPeerApproval(
        .init(
          payloadSummary: "Read back CMP peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git")
        )
      )
    )
    let statusReadbackResponse = await runtimeInterface.handle(
      .readbackCmpStatus(
        .init(
          payloadSummary: "Read back CMP status",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local"
        )
      )
    )
    let bootstrapResponse = await runtimeInterface.handle(
      .bootstrapCmpProject(
        .init(
          payloadSummary: "Bootstrap local CMP project",
          projectID: "cmp.local-runtime",
          agentIDs: ["runtime.local", "checker.local"]
        )
      )
    )
    let ingestResponse = await runtimeInterface.handle(
      .ingestCmpFlow(
        .init(
          payloadSummary: "Ingest local CMP flow",
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
    )
    let commitResponse = await runtimeInterface.handle(
      .commitCmpFlow(
        .init(
          payloadSummary: "Commit local CMP flow",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          sessionID: "cmp.flow.session",
          eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
          changeSummary: "Commit accepted flow event",
          syncIntent: .toParent
        )
      )
    )
    _ = await runtimeInterface.handle(
      .runGoal(
        .init(
          payloadSummary: "Seed projection for resolve",
          goalID: "goal.cmp-flow-resolve",
          goalTitle: "CMP Flow Resolve Seed",
          sessionID: "session.cmp-flow-resolve"
        )
      )
    )
    let resolveResponse = await runtimeInterface.handle(
      .resolveCmpFlow(
        .init(
          payloadSummary: "Resolve local CMP flow",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local"
        )
      )
    )
    let materializeResponse = await runtimeInterface.handle(
      .materializeCmpFlow(
        .init(
          payloadSummary: "Materialize local CMP flow",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          packageKind: .runtimeFill,
          fidelityLabel: .highSignal
        )
      )
    )
    let materializeSnapshot = try #require(materializeResponse.snapshot)
    let materializePackageID = try #require(materializeResponse.events.first?.intentID?.rawValue)
    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: materializePackageID),
      sourceProjectionID: .init(rawValue: "projection.seed.runtime.local"),
      sourceSnapshotID: .init(rawValue: "projection.seed.runtime.local:checked"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.seed.runtime.local/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.seed.runtime.local:section")]
    )
    let dispatchResponse = await runtimeInterface.handle(
      .dispatchCmpFlow(
        .init(
          payloadSummary: "Dispatch local CMP flow",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          contextPackage: contextPackage,
          targetKind: .peer,
          reason: "Forward runtime fill to checker"
        )
      )
    )
    let checkerRolesAfterDispatchResponse = await runtimeInterface.handle(
      .readbackCmpRoles(
        .init(
          payloadSummary: "Read back CMP roles after dispatch",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let checkerControlAfterDispatchResponse = await runtimeInterface.handle(
      .readbackCmpControl(
        .init(
          payloadSummary: "Read back CMP control after dispatch",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let checkerStatusAfterDispatchResponse = await runtimeInterface.handle(
      .readbackCmpStatus(
        .init(
          payloadSummary: "Read back CMP status after dispatch",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let historyResponse = await runtimeInterface.handle(
      .requestCmpHistory(
        .init(
          payloadSummary: "Request local CMP history",
          projectID: "cmp.local-runtime",
          requesterAgentID: "checker.local",
          reason: "Recover high-signal context",
          query: .init(
            snapshotID: .init(rawValue: "projection.seed.runtime.local:checked"),
            packageKindHint: .historicalReply
          )
        )
      )
    )
    let smokeResponse = await runtimeInterface.handle(
      .smokeCmpProject(
        .init(
          payloadSummary: "Smoke local CMP project",
          projectID: "cmp.local-runtime"
        )
      )
    )

    #expect(sessionResponse.status == .success)
    #expect(sessionResponse.snapshot?.kind == .cmpSession)
    #expect(sessionResponse.snapshot?.projectID == "cmp.local-runtime")
    #expect(sessionResponse.events.map(\.name) == [.cmpSessionOpened])
    #expect(readbackResponse.status == .success)
    #expect(readbackResponse.snapshot?.kind == .cmpProject)
    #expect(readbackResponse.snapshot?.projectID == "cmp.local-runtime")
    #expect(readbackResponse.snapshot?.hostProfile?.executionStyle == .localFirst)
    #expect(readbackResponse.snapshot?.hostProfile?.semanticIndex == .localSemanticIndex)
    #expect(readbackResponse.snapshot?.componentStatuses?[.structuredStore] == .ready)
    #expect(readbackResponse.snapshot?.componentStatuses?[.gitExecutor] == .ready)
    #expect(tapStatusResponse.status == .success)
    #expect(tapStatusResponse.snapshot?.kind == .tapStatus)
    #expect(tapStatusResponse.snapshot?.title == "TAP Status cmp.local-runtime")
    #expect(tapStatusResponse.snapshot?.tapMode == .restricted)
    #expect(tapStatusResponse.snapshot?.riskLevel == .risky)
    #expect(tapStatusResponse.snapshot?.humanGateState == .waitingApproval)
    #expect(tapStatusResponse.events.map(\.name) == [.tapStatusReadback])
    #expect(tapHistoryResponse.status == .success)
    #expect(tapHistoryResponse.snapshot?.kind == .tapHistory)
    #expect(tapHistoryResponse.snapshot?.title == "TAP History cmp.local-runtime")
    #expect(tapHistoryResponse.snapshot?.tapHistoryTotalCount == 5)
    #expect(tapHistoryResponse.snapshot?.tapHistoryEntries?.count == 5)
    #expect(tapHistoryResponse.snapshot?.tapHistoryEntries?.first?.requestedTier == .b1)
    #expect(tapHistoryResponse.snapshot?.tapHistoryEntries?.first?.route == .humanReview)
    #expect(tapHistoryResponse.snapshot?.tapHistoryEntries?.first?.outcome == .escalatedToHuman)
    #expect(tapHistoryResponse.snapshot?.tapHistoryEntries?.first?.humanGateState == .waitingApproval)
    #expect(tapHistoryResponse.events.map(\.name) == [.tapHistoryReadback])
    #expect(rolesReadbackResponse.status == .success)
    #expect(rolesReadbackResponse.snapshot?.kind == .cmpRoles)
    #expect(rolesReadbackResponse.snapshot?.title == "CMP Roles cmp.local-runtime")
    #expect(rolesReadbackResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(rolesReadbackResponse.snapshot?.roleStages?[.dispatcher] == .rejected)
    #expect(rolesReadbackResponse.events.map(\.name) == [.cmpRolesReadback])
    #expect(controlReadbackResponse.status == .success)
    #expect(controlReadbackResponse.snapshot?.kind == .cmpControl)
    #expect(controlReadbackResponse.snapshot?.title == "CMP Control cmp.local-runtime")
    #expect(controlReadbackResponse.events.map(\.name) == [.cmpControlReadback])
    #expect(controlUpdateResponse.status == .success)
    #expect(controlUpdateResponse.snapshot?.kind == .cmpControl)
    #expect(controlUpdateResponse.snapshot?.title == "CMP Control cmp.local-runtime")
    #expect(controlUpdateResponse.events.map(\.name) == [.cmpControlUpdated])
    #expect(approvalRequestResponse.status == .success)
    #expect(approvalRequestResponse.snapshot?.kind == .cmpApproval)
    #expect(approvalRequestResponse.snapshot?.title == "CMP Approval cmp.local-runtime")
    #expect(approvalRequestResponse.snapshot?.requestedTier == .b1)
    #expect(approvalRequestResponse.snapshot?.route == .humanReview)
    #expect(approvalRequestResponse.snapshot?.outcome == .escalatedToHuman)
    #expect(approvalRequestResponse.snapshot?.tapMode == .restricted)
    #expect(approvalRequestResponse.snapshot?.riskLevel == .normal)
    #expect(approvalRequestResponse.snapshot?.humanGateState == .waitingApproval)
    #expect(approvalRequestResponse.events.map(\.name) == [.cmpPeerApprovalRequested])
    #expect(approvalDecisionResponse.status == .success)
    #expect(approvalDecisionResponse.snapshot?.kind == .cmpApproval)
    #expect(approvalDecisionResponse.snapshot?.title == "CMP Approval cmp.local-runtime")
    #expect(approvalDecisionResponse.snapshot?.requestedTier == .b1)
    #expect(approvalDecisionResponse.snapshot?.route == .humanReview)
    #expect(approvalDecisionResponse.snapshot?.outcome == .approvedByHuman)
    #expect(approvalDecisionResponse.snapshot?.tapMode == .restricted)
    #expect(approvalDecisionResponse.snapshot?.riskLevel == .normal)
    #expect(approvalDecisionResponse.snapshot?.humanGateState == .approved)
    #expect(approvalDecisionResponse.events.map(\.name) == [.cmpPeerApprovalDecided])
    #expect(approvalReadbackResponse.status == .success)
    #expect(approvalReadbackResponse.snapshot?.kind == .cmpApproval)
    #expect(approvalReadbackResponse.snapshot?.title == "CMP Approval cmp.local-runtime")
    #expect(approvalReadbackResponse.snapshot?.requestedTier == .b1)
    #expect(approvalReadbackResponse.snapshot?.route == .humanReview)
    #expect(approvalReadbackResponse.snapshot?.outcome == .approvedByHuman)
    #expect(approvalReadbackResponse.snapshot?.tapMode == .restricted)
    #expect(approvalReadbackResponse.snapshot?.riskLevel == .normal)
    #expect(approvalReadbackResponse.snapshot?.humanGateState == .approved)
    #expect(approvalReadbackResponse.events.map(\.name) == [.cmpPeerApprovalReadback])
    #expect(statusReadbackResponse.status == .success)
    #expect(statusReadbackResponse.snapshot?.kind == .cmpStatus)
    #expect(statusReadbackResponse.snapshot?.title == "CMP Status cmp.local-runtime")
    let statusDispatchedCount = try #require(statusReadbackResponse.snapshot?.packageStatusCounts?[.dispatched])
    #expect(statusDispatchedCount > 0)
    #expect(statusReadbackResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(statusReadbackResponse.snapshot?.roleStages?[.dispatcher] == .rejected)
    #expect(statusReadbackResponse.events.map(\.name) == [.cmpStatusReadback])
    #expect(bootstrapResponse.status == .success)
    #expect(bootstrapResponse.snapshot?.kind == .cmpBootstrap)
    #expect(bootstrapResponse.snapshot?.title == "CMP Bootstrap cmp.local-runtime")
    #expect(bootstrapResponse.snapshot?.hostProfile?.executionStyle == .localFirst)
    #expect(bootstrapResponse.snapshot?.hostProfile?.messageTransport == .inProcessActorBus)
    #expect(bootstrapResponse.snapshot?.componentStatuses?[.gitProbe] == .ready)
    #expect(bootstrapResponse.snapshot?.componentStatuses?[.lineageStore] == .ready)
    #expect(bootstrapResponse.events.map(\.name) == [.cmpProjectBootstrapped])
    #expect(ingestResponse.status == .success)
    #expect(ingestResponse.snapshot?.kind == .cmpFlow)
    #expect(ingestResponse.snapshot?.title == "CMP Ingest cmp.local-runtime")
    #expect(ingestResponse.snapshot?.sessionID == .init(rawValue: "cmp.flow.session"))
    #expect(ingestResponse.snapshot?.nextAction == .commitContextDelta)
    #expect(ingestResponse.events.map(\.name) == [.cmpFlowIngested])
    #expect(ingestResponse.events.first?.sessionID == .init(rawValue: "cmp.flow.session"))
    #expect(commitResponse.status == .success)
    #expect(commitResponse.snapshot?.kind == .cmpFlow)
    #expect(commitResponse.snapshot?.title == "CMP Commit cmp.local-runtime")
    #expect(commitResponse.snapshot?.activeLineStage == .candidateReady)
    #expect(commitResponse.events.map(\.name) == [.cmpFlowCommitted])
    #expect(resolveResponse.status == .success)
    #expect(resolveResponse.snapshot?.kind == .cmpFlow)
    #expect(resolveResponse.snapshot?.title == "CMP Resolve cmp.local-runtime")
    #expect(resolveResponse.snapshot?.qualityLabel == .usable)
    #expect(resolveResponse.events.map(\.name) == [.cmpFlowResolved])
    #expect(materializeResponse.status == .success)
    #expect(materializeSnapshot.kind == .cmpFlow)
    #expect(materializeSnapshot.title == "CMP Materialize cmp.local-runtime")
    #expect(materializeSnapshot.packageKind == .runtimeFill)
    #expect(materializeResponse.events.map(\.name) == [.cmpFlowMaterialized])
    #expect(dispatchResponse.status == .success)
    #expect(dispatchResponse.snapshot?.kind == .cmpFlow)
    #expect(dispatchResponse.snapshot?.title == "CMP Dispatch cmp.local-runtime")
    #expect(dispatchResponse.snapshot?.targetKind == .peer)
    #expect(dispatchResponse.snapshot?.dispatchStatus == .rejected)
    #expect(dispatchResponse.events.map(\.name) == [.cmpFlowDispatched])
    #expect(dispatchResponse.events.first?.detail == dispatchResponse.snapshot?.summary)
    #expect(dispatchResponse.events.first?.intentID != nil)
    #expect(checkerRolesAfterDispatchResponse.snapshot?.kind == .cmpRoles)
    #expect(checkerRolesAfterDispatchResponse.snapshot?.latestDispatchStatus == .rejected)
    #expect(checkerRolesAfterDispatchResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(checkerRolesAfterDispatchResponse.snapshot?.roleStages?[.dispatcher] == .rejected)
    #expect(checkerControlAfterDispatchResponse.snapshot?.kind == .cmpControl)
    #expect(checkerControlAfterDispatchResponse.snapshot?.latestDispatchStatus == .rejected)
    #expect(checkerStatusAfterDispatchResponse.snapshot?.kind == .cmpStatus)
    #expect(checkerStatusAfterDispatchResponse.snapshot?.latestDispatchStatus == .rejected)
    let checkerStatusDispatchedCount = try #require(
      checkerStatusAfterDispatchResponse.snapshot?.packageStatusCounts?[.dispatched]
    )
    #expect(checkerStatusDispatchedCount > 0)
    #expect(checkerStatusAfterDispatchResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(checkerStatusAfterDispatchResponse.snapshot?.roleStages?[.dispatcher] == .rejected)
    #expect(historyResponse.status == .success)
    #expect(historyResponse.snapshot?.kind == .cmpFlow)
    #expect(historyResponse.snapshot?.title == "CMP History cmp.local-runtime")
    #expect(historyResponse.events.map(\.name) == [.cmpFlowHistoryRequested])
    #expect(historyResponse.events.first?.detail == historyResponse.snapshot?.summary)
    #expect(historyResponse.events.first?.intentID == nil)
    #expect(historyResponse.snapshot?.summary.contains("did not find reusable context") == true)
    #expect(smokeResponse.status == .success)
    #expect(smokeResponse.snapshot?.kind == .smoke)
    #expect(smokeResponse.snapshot?.title == "CMP Smoke cmp.local-runtime")
  }

  @Test
  func runtimeInterfacePreservesRejectAndReleasePeerApprovalOutcomesAcrossReadback() async throws {
    let scenarios: [(
      label: String,
      decision: PraxisCmpPeerApprovalDecision,
      expectedOutcome: PraxisCmpPeerApprovalOutcome,
      expectedHumanGateState: PraxisHumanGateState,
      expectedDecisionSummary: String
    )] = [
      ("reject", .reject, .rejectedByHuman, .rejected, "Rejected git access for checker"),
      ("release", .release, .gateReleased, .approved, "Released git access gate for checker"),
    ]

    for scenario in scenarios {
      let rootDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("praxis-runtime-interface-peer-approval-\(scenario.label)-\(UUID().uuidString)", isDirectory: true)
      defer { try? FileManager.default.removeItem(at: rootDirectory) }

      let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
      let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
        hostAdapters: registry,
        blueprint: PraxisRuntimeGatewayModule.bootstrap
      )
      let expectedDecisionSummary = scenario.expectedDecisionSummary

      let requestResponse = await runtimeInterface.handle(
        .requestCmpPeerApproval(
          .init(
            payloadSummary: "Request CMP peer approval",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: .init(rawValue: "tool.git"),
            requestedTier: .b1,
            summary: "Escalate git access to checker"
          )
        )
      )
      let decideResponse = await runtimeInterface.handle(
        .decideCmpPeerApproval(
          .init(
            payloadSummary: "\(scenario.label.capitalized) CMP peer approval",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: .init(rawValue: "tool.git"),
            decision: scenario.decision,
            reviewerAgentID: "reviewer.local",
            decisionSummary: expectedDecisionSummary
          )
        )
      )
      let readbackResponse = await runtimeInterface.handle(
        .readbackCmpPeerApproval(
          .init(
            payloadSummary: "Read back CMP peer approval",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: .init(rawValue: "tool.git")
          )
        )
      )
      let tapStatusResponse = await runtimeInterface.handle(
        .readbackTapStatus(
          .init(
            payloadSummary: "Read back TAP status",
            projectID: "cmp.local-runtime",
            agentID: "checker.local"
          )
        )
      )
      let tapHistoryResponse = await runtimeInterface.handle(
        .readbackTapHistory(
          .init(
            payloadSummary: "Read back TAP history",
            projectID: "cmp.local-runtime",
            agentID: "checker.local",
            limit: 10
          )
        )
      )

      let expectedRoute = requestResponse.snapshot?.route

      #expect(requestResponse.status == .success)
      #expect(requestResponse.snapshot?.humanGateState == .waitingApproval)
      #expect(expectedRoute != nil)

      #expect(decideResponse.status == .success)
      #expect(decideResponse.snapshot?.kind == .cmpApproval)
      #expect(decideResponse.snapshot?.outcome == scenario.expectedOutcome)
      #expect(decideResponse.snapshot?.humanGateState == scenario.expectedHumanGateState)
      #expect(decideResponse.snapshot?.route == expectedRoute)

      #expect(readbackResponse.status == .success)
      #expect(readbackResponse.snapshot?.kind == .cmpApproval)
      #expect(readbackResponse.snapshot?.outcome == scenario.expectedOutcome)
      #expect(readbackResponse.snapshot?.humanGateState == scenario.expectedHumanGateState)
      #expect(readbackResponse.snapshot?.route == expectedRoute)

      #expect(tapStatusResponse.status == .success)
      #expect(tapStatusResponse.snapshot?.kind == .tapStatus)
      #expect(tapStatusResponse.snapshot?.humanGateState == scenario.expectedHumanGateState)

      #expect(tapHistoryResponse.status == .success)
      #expect(tapHistoryResponse.snapshot?.kind == .tapHistory)
      let matchingHistoryEntry = tapHistoryResponse.snapshot?.tapHistoryEntries?.contains {
        $0.capabilityKey == .init(rawValue: "tool.git")
          && $0.route == expectedRoute
          && $0.outcome == scenario.expectedOutcome
          && $0.humanGateState == scenario.expectedHumanGateState
          && $0.decisionSummary == expectedDecisionSummary
      }
      #expect(matchingHistoryEntry == true)
    }
  }

  @Test
  func runtimeInterfaceRecoverCmpProjectReturnsCmpRecoverSnapshotAndRecoveredEvent() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-recover-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let packageStore = try #require(registry.cmpContextPackageStore)
    _ = try await packageStore.save(
      .init(
        projectID: "cmp.local-runtime",
        packageID: .init(rawValue: "package.interface.package-only"),
        sourceProjectionID: .init(rawValue: "projection.interface.package-only"),
        sourceSnapshotID: .init(rawValue: "snapshot.interface.package-only"),
        sourceAgentID: "archivist.local",
        targetAgentID: "checker.local",
        packageKind: .historicalReply,
        fidelityLabel: .highSignal,
        packageRef: "context://cmp.local-runtime/projection.interface.package-only/checker.local/historicalReply",
        status: .materialized,
        sourceSectionIDs: [.init(rawValue: "projection.interface.package-only:section")],
        createdAt: "2026-04-11T04:30:00Z",
        updatedAt: "2026-04-11T04:30:00Z"
      )
    )
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .recoverCmpProject(
        .init(
          payloadSummary: "Recover local CMP project",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Recover package-only history",
          snapshotID: runtimeInterfaceReferenceID("snapshot.interface.package-only")
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.snapshot?.kind == .cmpRecover)
    #expect(response.snapshot?.projectID == "cmp.local-runtime")
    #expect(response.snapshot?.recoveryStatus == .aligned)
    #expect(response.snapshot?.packageKind == .historicalReply)
    #expect(response.events.map(\.name) == [.cmpProjectRecovered])
    #expect(response.events.first?.detail == response.snapshot?.summary)
    #expect(response.events.first?.intentID == runtimeInterfaceReferenceID("package.interface.package-only"))
  }

  @Test
  func runtimeInterfaceRecoverCmpProjectPreservesBlankOptionalSnapshotReference() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      cmpFacade: makeStubCmpFacade(
        recoverCmpProject: { command in
          guard command.snapshotID == .init(rawValue: "   ") else {
            throw PraxisError.invalidInput("recoverCmpProject snapshotID was normalized unexpectedly.")
          }
          throw PraxisError.invalidInput("recoverCmpProject preserved blank snapshotID.")
        }
      )
    )

    let response = await runtimeInterface.handle(
      .recoverCmpProject(
        .init(
          payloadSummary: "Recover CMP project with explicit blank reference",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Preserve blank snapshot selector",
          snapshotID: runtimeInterfaceReferenceID("   ")
        )
      )
    )

    #expect(response.status == .failure)
    #expect(response.error?.code == .invalidInput)
    #expect(response.error?.message == "recoverCmpProject preserved blank snapshotID.")
  }

  @Test
  func runtimeInterfaceMaterializeCmpFlowPreservesBlankOptionalContinuationReferences() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      cmpFacade: makeStubCmpFacade(
        materializeCmpFlow: { command in
          guard command.snapshotID == .init(rawValue: "   ") else {
            throw PraxisError.invalidInput("materializeCmpFlow snapshotID was normalized unexpectedly.")
          }
          guard command.projectionID == .init(rawValue: "\t") else {
            throw PraxisError.invalidInput("materializeCmpFlow projectionID was normalized unexpectedly.")
          }
          throw PraxisError.invalidInput("materializeCmpFlow preserved blank continuation references.")
        }
      )
    )

    let response = await runtimeInterface.handle(
      .materializeCmpFlow(
        .init(
          payloadSummary: "Materialize CMP flow with explicit blank selectors",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          snapshotID: runtimeInterfaceReferenceID("   "),
          projectionID: runtimeInterfaceReferenceID("\t"),
          packageKind: .runtimeFill,
          fidelityLabel: .highSignal
        )
      )
    )

    #expect(response.status == .failure)
    #expect(response.error?.code == .invalidInput)
    #expect(response.error?.message == "materializeCmpFlow preserved blank continuation references.")
  }

  @Test
  func runtimeInterfaceReadbacksPreserveRetryScheduledLatestDispatchStatus() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-retry-scheduled-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
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
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let rolesResponse = await runtimeInterface.handle(
      .readbackCmpRoles(
        .init(
          payloadSummary: "Read CMP roles after retry scheduling",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let controlResponse = await runtimeInterface.handle(
      .readbackCmpControl(
        .init(
          payloadSummary: "Read CMP control after retry scheduling",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let statusResponse = await runtimeInterface.handle(
      .readbackCmpStatus(
        .init(
          payloadSummary: "Read CMP status after retry scheduling",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )

    #expect(rolesResponse.status == .success)
    #expect(rolesResponse.snapshot?.kind == .cmpRoles)
    #expect(rolesResponse.snapshot?.latestDispatchStatus == .retryScheduled)
    #expect(rolesResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(rolesResponse.snapshot?.roleStages?[.dispatcher] == .retryScheduled)
    #expect(controlResponse.status == .success)
    #expect(controlResponse.snapshot?.kind == .cmpControl)
    #expect(controlResponse.snapshot?.latestDispatchStatus == .retryScheduled)
    #expect(statusResponse.status == .success)
    #expect(statusResponse.snapshot?.kind == .cmpStatus)
    #expect(statusResponse.snapshot?.latestDispatchStatus == .retryScheduled)
    #expect(statusResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(statusResponse.snapshot?.roleStages?[.dispatcher] == .retryScheduled)
  }

  @Test
  func runtimeInterfaceRetriesBlockedCmpDispatchThroughNeutralSurface() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-retry-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    _ = await runtimeInterface.handle(
      .updateCmpControl(
        .init(
          payloadSummary: "Disable auto dispatch",
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          executionStyle: .manual,
          mode: .peerReview,
          automation: .init(values: [.autoDispatch: false])
        )
      )
    )
    let packageID = "projection.retry.runtime.local:checker.local:runtimeFill"
    let blockedDispatchResponse = await runtimeInterface.handle(
      .dispatchCmpFlow(
        .init(
          payloadSummary: "Dispatch local CMP flow",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          contextPackage: .init(
            id: .init(rawValue: packageID),
            sourceProjectionID: .init(rawValue: "projection.retry.runtime.local"),
            sourceSnapshotID: .init(rawValue: "projection.retry.runtime.local:checked"),
            sourceAgentID: "runtime.local",
            targetAgentID: "checker.local",
            kind: .runtimeFill,
            packageRef: "context://cmp.local-runtime/projection.retry.runtime.local/checker.local/runtimeFill",
            fidelityLabel: .highSignal,
            createdAt: "2026-04-11T00:00:00Z",
            sourceSectionIDs: [.init(rawValue: "projection.retry.runtime.local:section")]
          ),
          targetKind: .peer,
          reason: "Initial gated dispatch"
        )
      )
    )
    _ = await runtimeInterface.handle(
      .updateCmpControl(
        .init(
          payloadSummary: "Enable auto dispatch",
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          automation: .init(values: [.autoDispatch: true])
        )
      )
    )
    let retryResponse = await runtimeInterface.handle(
      .retryCmpDispatch(
        .init(
          payloadSummary: "Retry blocked dispatch",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID(packageID)
        )
      )
    )

    #expect(blockedDispatchResponse.status == .success)
    #expect(blockedDispatchResponse.snapshot?.kind == .cmpFlow)
    #expect(blockedDispatchResponse.snapshot?.title == "CMP Dispatch cmp.local-runtime")
    #expect(blockedDispatchResponse.snapshot?.targetKind == .peer)
    #expect(blockedDispatchResponse.snapshot?.dispatchStatus == .rejected)
    #expect(blockedDispatchResponse.snapshot?.summary.contains("held package") == true)
    #expect(retryResponse.status == .success)
    #expect(retryResponse.snapshot?.kind == .cmpFlow)
    #expect(retryResponse.snapshot?.title == "CMP Retry Dispatch cmp.local-runtime")
    #expect(retryResponse.snapshot?.targetKind == .peer)
    #expect(retryResponse.snapshot?.dispatchStatus == .delivered)
    #expect(retryResponse.events.map(\.name) == [.cmpFlowDispatchRetried])
    #expect(retryResponse.events.first?.detail == retryResponse.snapshot?.summary)
    #expect(retryResponse.events.first?.intentID != nil)
  }

  @Test
  func runtimeInterfacePreservesOpaqueIncomingReferencesWithoutTrimming() async throws {
    let cmpFacade = makeStubCmpFacade(
      commitCmpFlow: { command in
        guard command.eventIDs == [
          .init(rawValue: " evt.cmp.1 "),
          .init(rawValue: "\tevt.cmp.2\t"),
        ] else {
          throw PraxisError.invalidInput("commitCmpFlow eventIDs were normalized unexpectedly.")
        }
        throw PraxisError.invalidInput("commitCmpFlow preserved padded eventIDs.")
      },
      retryCmpDispatch: { command in
        guard command.packageID == .init(rawValue: " package.retry ") else {
          throw PraxisError.invalidInput("retryCmpDispatch packageID was normalized unexpectedly.")
        }
        throw PraxisError.invalidInput("retryCmpDispatch preserved padded packageID.")
      }
    )
    let runtimeInterface = PraxisRuntimeInterfaceSession(
      runtimeFacade: .init(
        runFacade: makeUnexpectedRunFacade(),
        inspectionFacade: makeUnexpectedInspectionFacade(),
        mpFacade: makeStubMpFacade(
          ingestMp: { command in
            guard command.checkedSnapshotRef == .init(rawValue: " snapshot.mp.runtime ") else {
              throw PraxisError.invalidInput("ingestMp checkedSnapshotRef was normalized unexpectedly.")
            }
            throw PraxisError.invalidInput("ingestMp preserved padded checkedSnapshotRef.")
          }
        ),
        cmpSessionFacade: cmpFacade.sessionFacade,
        cmpProjectFacade: cmpFacade.projectFacade,
        cmpFlowFacade: cmpFacade.flowFacade,
        cmpRolesFacade: cmpFacade.rolesFacade,
        cmpControlFacade: cmpFacade.controlFacade,
        cmpReadbackFacade: cmpFacade.readbackFacade
      ),
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
    )

    let commitResponse = await runtimeInterface.handle(
      .commitCmpFlow(
        .init(
          payloadSummary: "Commit CMP flow with padded event IDs",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          sessionID: "cmp.flow.session",
          eventIDs: [
            runtimeInterfaceReferenceID(" evt.cmp.1 "),
            runtimeInterfaceReferenceID("\tevt.cmp.2\t"),
          ],
          changeSummary: "Preserve raw event IDs",
          syncIntent: .toParent
        )
      )
    )
    let retryResponse = await runtimeInterface.handle(
      .retryCmpDispatch(
        .init(
          payloadSummary: "Retry CMP dispatch with padded package ID",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID(" package.retry ")
        )
      )
    )
    let ingestResponse = await runtimeInterface.handle(
      .ingestMp(
        .init(
          payloadSummary: "Ingest MP with padded snapshot reference",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          summary: "Preserve raw checked snapshot reference",
          checkedSnapshotRef: runtimeInterfaceReferenceID(" snapshot.mp.runtime "),
          branchRef: "main"
        )
      )
    )

    #expect(commitResponse.status == .failure)
    #expect(commitResponse.error?.code == .invalidInput)
    #expect(commitResponse.error?.message == "commitCmpFlow preserved padded eventIDs.")
    #expect(retryResponse.status == .failure)
    #expect(retryResponse.error?.code == .invalidInput)
    #expect(retryResponse.error?.message == "retryCmpDispatch preserved padded packageID.")
    #expect(ingestResponse.status == .failure)
    #expect(ingestResponse.error?.code == .invalidInput)
    #expect(ingestResponse.error?.message == "ingestMp preserved padded checkedSnapshotRef.")
  }

  @Test
  func runtimeInterfacePreservesMpSessionLikeFieldsWithoutCanonicalizingAndRejectsBlankCheckedSnapshotRef() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: makeStubMpFacade(
        resolveMp: { command in
          #expect(command.projectID == " mp.local-runtime ")
          #expect(command.requesterSessionID == " session.resolve ")
          return PraxisMpResolveResult(
            projectID: command.projectID,
            query: command.query,
            summary: "MP resolve preserved raw session boundary values.",
            primaryMemoryIDs: [" memory.primary "],
            supportingMemoryIDs: [" memory.supporting "],
            omittedSupersededMemoryIDs: [" memory.superseded "],
            rerankComposition: .init(
              fresh: 1,
              aging: 0,
              stale: 0,
              superseded: 1,
              aligned: 1,
              unreviewed: 0,
              drifted: 0
            ),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        },
        requestMpHistory: { command in
          #expect(command.requesterSessionID == "\thistory.session\t")
          return PraxisMpHistoryResult(
            projectID: command.projectID,
            requesterAgentID: command.requesterAgentID,
            query: command.query,
            reason: command.reason,
            summary: "MP history preserved raw requester session identifiers.",
            primaryMemoryIDs: [" history.primary "],
            supportingMemoryIDs: [" history.supporting "],
            omittedSupersededMemoryIDs: [],
            rerankComposition: .init(
              fresh: 1,
              aging: 0,
              stale: 0,
              superseded: 0,
              aligned: 1,
              unreviewed: 0,
              drifted: 0
            ),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        }
      )
    )

    let blankSnapshotResponse = await runtimeInterface.handle(
      .ingestMp(
        .init(
          payloadSummary: "Reject blank checked snapshot reference",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          summary: "This request should fail before reaching MP ingest.",
          checkedSnapshotRef: runtimeInterfaceReferenceID("   "),
          branchRef: "main"
        )
      )
    )
    let resolveResponse = await runtimeInterface.handle(
      .resolveMp(
        .init(
          payloadSummary: "Preserve padded resolve session identifier",
          projectID: " mp.local-runtime ",
          query: "onboarding",
          requesterAgentID: "runtime.local",
          sessionID: " session.resolve ",
          scopeLevels: [.project],
          limit: 3
        )
      )
    )
    let historyResponse = await runtimeInterface.handle(
      .requestMpHistory(
        .init(
          payloadSummary: "Preserve padded history session identifier",
          projectID: "mp.local-runtime",
          requesterAgentID: "runtime.local",
          sessionID: "\thistory.session\t",
          reason: "Need historical memory trace",
          query: "onboarding",
          scopeLevels: [.project],
          limit: 3
        )
      )
    )

    #expect(blankSnapshotResponse.status == .failure)
    #expect(blankSnapshotResponse.error?.code == .invalidInput)
    #expect(blankSnapshotResponse.error?.message == "Field checkedSnapshotRef must not be empty.")

    #expect(resolveResponse.status == .success)
    #expect(resolveResponse.snapshot?.kind == .mpResolve)
    #expect(resolveResponse.snapshot?.projectID == " mp.local-runtime ")
    #expect(resolveResponse.snapshot?.sessionID?.rawValue == " session.resolve ")

    #expect(historyResponse.status == .success)
    #expect(historyResponse.snapshot?.kind == .mpHistory)
    #expect(historyResponse.snapshot?.sessionID?.rawValue == "\thistory.session\t")
  }

  @Test
  func runtimeInterfacePreservesExactMpMutationIdentifiersWithoutCanonicalizing() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: makeStubMpFacade(
        alignMp: { command in
          guard command.memoryID == " memory.align " else {
            throw PraxisError.invalidInput("alignMp memoryID was normalized unexpectedly.")
          }
          throw PraxisError.invalidInput("alignMp preserved padded memoryID.")
        },
        promoteMp: { command in
          guard command.memoryID == " memory.promote " else {
            throw PraxisError.invalidInput("promoteMp memoryID was normalized unexpectedly.")
          }
          guard command.targetSessionID == " session.promote " else {
            throw PraxisError.invalidInput("promoteMp targetSessionID was normalized unexpectedly.")
          }
          throw PraxisError.invalidInput("promoteMp preserved padded memoryID and targetSessionID.")
        },
        archiveMp: { command in
          guard command.memoryID == "\tmemory.archive\t" else {
            throw PraxisError.invalidInput("archiveMp memoryID was normalized unexpectedly.")
          }
          throw PraxisError.invalidInput("archiveMp preserved padded memoryID.")
        }
      )
    )

    let alignResponse = await runtimeInterface.handle(
      .alignMp(
        .init(
          payloadSummary: "Align MP with padded memory ID",
          projectID: "mp.local-runtime",
          memoryID: " memory.align "
        )
      )
    )
    let promoteResponse = await runtimeInterface.handle(
      .promoteMp(
        .init(
          payloadSummary: "Promote MP with padded identifiers",
          projectID: "mp.local-runtime",
          memoryID: " memory.promote ",
          targetPromotionState: .acceptedByParent,
          targetSessionID: " session.promote "
        )
      )
    )
    let archiveResponse = await runtimeInterface.handle(
      .archiveMp(
        .init(
          payloadSummary: "Archive MP with padded memory ID",
          projectID: "mp.local-runtime",
          memoryID: "\tmemory.archive\t"
        )
      )
    )

    #expect(alignResponse.status == .failure)
    #expect(alignResponse.error?.code == .invalidInput)
    #expect(alignResponse.error?.message == "alignMp preserved padded memoryID.")

    #expect(promoteResponse.status == .failure)
    #expect(promoteResponse.error?.code == .invalidInput)
    #expect(promoteResponse.error?.message == "promoteMp preserved padded memoryID and targetSessionID.")

    #expect(archiveResponse.status == .failure)
    #expect(archiveResponse.error?.code == .invalidInput)
    #expect(archiveResponse.error?.message == "archiveMp preserved padded memoryID.")
  }

  @Test
  func runtimeInterfaceRejectsBlankMpMutationAndRequesterIdentifiersBeforeDispatch() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: makeStubMpFacade()
    )

    let blankCheckedSnapshotResponse = await runtimeInterface.handle(
      .ingestMp(
        .init(
          payloadSummary: "Reject empty checked snapshot reference",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          summary: "This request should fail before reaching MP ingest.",
          checkedSnapshotRef: runtimeInterfaceReferenceID(""),
          branchRef: "main"
        )
      )
    )
    let blankAlignMemoryResponse = await runtimeInterface.handle(
      .alignMp(
        .init(
          payloadSummary: "Reject blank align memory identifier",
          projectID: "mp.local-runtime",
          memoryID: "   "
        )
      )
    )
    let blankPromoteMemoryResponse = await runtimeInterface.handle(
      .promoteMp(
        .init(
          payloadSummary: "Reject blank promote memory identifier",
          projectID: "mp.local-runtime",
          memoryID: "",
          targetPromotionState: .acceptedByParent
        )
      )
    )
    let blankArchiveMemoryResponse = await runtimeInterface.handle(
      .archiveMp(
        .init(
          payloadSummary: "Reject blank archive memory identifier",
          projectID: "mp.local-runtime",
          memoryID: "\t\t"
        )
      )
    )
    let blankResolveRequesterResponse = await runtimeInterface.handle(
      .resolveMp(
        .init(
          payloadSummary: "Reject blank resolve requester identifier",
          projectID: "mp.local-runtime",
          query: "onboarding",
          requesterAgentID: "   "
        )
      )
    )
    let blankHistoryRequesterResponse = await runtimeInterface.handle(
      .requestMpHistory(
        .init(
          payloadSummary: "Reject blank history requester identifier",
          projectID: "mp.local-runtime",
          requesterAgentID: "",
          reason: "Need historical memory trace",
          query: "onboarding"
        )
      )
    )

    #expect(blankCheckedSnapshotResponse.status == .failure)
    #expect(blankCheckedSnapshotResponse.error?.code == .invalidInput)
    #expect(blankCheckedSnapshotResponse.error?.message == "Field checkedSnapshotRef must not be empty.")

    for response in [blankAlignMemoryResponse, blankPromoteMemoryResponse, blankArchiveMemoryResponse] {
      #expect(response.status == .failure)
      #expect(response.error?.code == .missingRequiredField)
      #expect(response.error?.message == "Required field memoryID is missing.")
    }

    for response in [blankResolveRequesterResponse, blankHistoryRequesterResponse] {
      #expect(response.status == .failure)
      #expect(response.error?.code == .missingRequiredField)
      #expect(response.error?.message == "Required field requesterAgentID is missing.")
    }
  }

  @Test
  func runtimeInterfacePreservesMpRequesterIdentityAndScopeOrderingWithoutCanonicalizing() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: makeStubMpFacade(
        resolveMp: { command in
          guard command.requesterAgentID == " runtime.resolve " else {
            throw PraxisError.invalidInput("resolveMp requesterAgentID was normalized unexpectedly.")
          }
          guard command.requesterSessionID == " session.resolve " else {
            throw PraxisError.invalidInput("resolveMp requesterSessionID was normalized unexpectedly.")
          }
          guard command.scopeLevels == [.agentIsolated, .project] else {
            throw PraxisError.invalidInput("resolveMp scopeLevels were normalized unexpectedly.")
          }
          return PraxisMpResolveResult(
            projectID: command.projectID,
            query: command.query,
            summary: "MP resolve preserved requester and scope ordering boundary values.",
            primaryMemoryIDs: ["memory.primary"],
            supportingMemoryIDs: ["memory.supporting"],
            omittedSupersededMemoryIDs: [],
            rerankComposition: .init(
              fresh: 1,
              aging: 1,
              stale: 0,
              superseded: 0,
              aligned: 1,
              unreviewed: 1,
              drifted: 0
            ),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        },
        requestMpHistory: { command in
          guard command.requesterAgentID == "\thistory.agent\t" else {
            throw PraxisError.invalidInput("requestMpHistory requesterAgentID was normalized unexpectedly.")
          }
          guard command.requesterSessionID == " history.session " else {
            throw PraxisError.invalidInput("requestMpHistory requesterSessionID was normalized unexpectedly.")
          }
          guard command.scopeLevels == [.project, .agentIsolated] else {
            throw PraxisError.invalidInput("requestMpHistory scopeLevels were normalized unexpectedly.")
          }
          return PraxisMpHistoryResult(
            projectID: command.projectID,
            requesterAgentID: command.requesterAgentID,
            query: command.query,
            reason: command.reason,
            summary: "MP history preserved requester and scope ordering boundary values.",
            primaryMemoryIDs: ["history.primary"],
            supportingMemoryIDs: ["history.supporting"],
            omittedSupersededMemoryIDs: [],
            rerankComposition: .init(
              fresh: 1,
              aging: 1,
              stale: 0,
              superseded: 0,
              aligned: 1,
              unreviewed: 1,
              drifted: 0
            ),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        }
      )
    )

    let resolveResponse = await runtimeInterface.handle(
      .resolveMp(
        .init(
          payloadSummary: "Preserve MP resolve requester boundary fields",
          projectID: "mp.local-runtime",
          query: "onboarding",
          requesterAgentID: " runtime.resolve ",
          sessionID: " session.resolve ",
          scopeLevels: [.agentIsolated, .project],
          limit: 4
        )
      )
    )
    let historyResponse = await runtimeInterface.handle(
      .requestMpHistory(
        .init(
          payloadSummary: "Preserve MP history requester boundary fields",
          projectID: "mp.local-runtime",
          requesterAgentID: "\thistory.agent\t",
          sessionID: " history.session ",
          reason: "Need historical memory trace",
          query: "onboarding",
          scopeLevels: [.project, .agentIsolated],
          limit: 4
        )
      )
    )

    #expect(resolveResponse.status == .success)
    #expect(resolveResponse.snapshot?.kind == .mpResolve)
    #expect(resolveResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(resolveResponse.snapshot?.sessionID?.rawValue == " session.resolve ")
    #expect(resolveResponse.snapshot?.summary == "MP resolve preserved requester and scope ordering boundary values.")

    #expect(historyResponse.status == .success)
    #expect(historyResponse.snapshot?.kind == .mpHistory)
    #expect(historyResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(historyResponse.snapshot?.sessionID?.rawValue == " history.session ")
    #expect(historyResponse.snapshot?.summary == "MP history preserved requester and scope ordering boundary values.")
  }

  @Test
  func runtimeInterfacePreservesMpSearchReadbackAndSmokeBoundaryFieldsWithoutCanonicalizing() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: makeStubMpFacade(
        searchMp: { command in
          guard command.projectID == " mp.local-runtime " else {
            throw PraxisError.invalidInput("searchMp projectID was normalized unexpectedly.")
          }
          guard command.sessionID == " session.search " else {
            throw PraxisError.invalidInput("searchMp sessionID was normalized unexpectedly.")
          }
          guard command.scopeLevels == [.project, .agentIsolated] else {
            throw PraxisError.invalidInput("searchMp scopeLevels were normalized unexpectedly.")
          }
          guard command.includeSuperseded else {
            throw PraxisError.invalidInput("searchMp includeSuperseded changed unexpectedly.")
          }
          return PraxisMpSearchResult(
            projectID: command.projectID,
            query: command.query,
            summary: "MP search preserved raw boundary values.",
            hits: [
              .init(
                memoryID: " memory.primary ",
                agentID: "runtime.local",
                scopeLevel: .project,
                memoryKind: .semantic,
                freshnessStatus: .fresh,
                alignmentStatus: .aligned,
                summary: "Host-neutral memory result",
                storageKey: " memory/primary ",
                semanticScore: 0.94,
                finalScore: 1.0,
                rankExplanation: "freshness=fresh"
              )
            ],
            issues: []
          )
        },
        readbackMp: { command in
          guard command.projectID == "\tmp.local-runtime\t" else {
            throw PraxisError.invalidInput("readbackMp projectID was normalized unexpectedly.")
          }
          guard command.sessionID == " readback.session " else {
            throw PraxisError.invalidInput("readbackMp sessionID was normalized unexpectedly.")
          }
          guard command.query.isEmpty else {
            throw PraxisError.invalidInput("readbackMp blank query baseline changed unexpectedly.")
          }
          guard command.scopeLevels == [.project] else {
            throw PraxisError.invalidInput("readbackMp scopeLevels were normalized unexpectedly.")
          }
          guard command.includeSuperseded else {
            throw PraxisError.invalidInput("readbackMp includeSuperseded changed unexpectedly.")
          }
          return PraxisMpReadback(
            projectID: command.projectID,
            summary: "MP readback preserved raw boundary values.",
            totalMemoryCount: 2,
            primaryCount: 1,
            supportingCount: 1,
            omittedSupersededCount: 0,
            freshnessBreakdown: .init(counts: [.fresh: 1, .aging: 1]),
            alignmentBreakdown: .init(counts: [.aligned: 1, .unreviewed: 1]),
            scopeBreakdown: .init(counts: [.project: 2]),
            issues: []
          )
        },
        smokeMp: { command in
          guard command.projectID == " smoke.project " else {
            throw PraxisError.invalidInput("smokeMp projectID was normalized unexpectedly.")
          }
          return PraxisMpSmoke(
            projectID: command.projectID,
            summary: "MP smoke preserved raw boundary values.",
            checks: [
              .init(id: "semantic_memory_store", gate: .memoryStore, status: .ready, summary: "ok")
            ]
          )
        }
      )
    )

    let blankSearchProjectResponse = await runtimeInterface.handle(
      .searchMp(
        .init(
          payloadSummary: "Reject blank MP search project",
          projectID: "   ",
          query: "onboarding"
        )
      )
    )
    let blankSearchQueryResponse = await runtimeInterface.handle(
      .searchMp(
        .init(
          payloadSummary: "Reject blank MP search query",
          projectID: "mp.local-runtime",
          query: "   "
        )
      )
    )
    let searchResponse = await runtimeInterface.handle(
      .searchMp(
        .init(
          payloadSummary: "Preserve MP search boundary fields",
          projectID: " mp.local-runtime ",
          query: "onboarding",
          scopeLevels: [.project, .agentIsolated],
          limit: 4,
          agentID: "runtime.local",
          sessionID: " session.search ",
          includeSuperseded: true
        )
      )
    )
    let readbackResponse = await runtimeInterface.handle(
      .readbackMp(
        .init(
          payloadSummary: "Preserve MP readback boundary fields",
          projectID: "\tmp.local-runtime\t",
          query: "",
          scopeLevels: [.project],
          limit: 6,
          agentID: "runtime.local",
          sessionID: " readback.session ",
          includeSuperseded: true
        )
      )
    )
    let smokeResponse = await runtimeInterface.handle(
      .smokeMp(
        .init(
          payloadSummary: "Preserve MP smoke project field",
          projectID: " smoke.project "
        )
      )
    )

    #expect(blankSearchProjectResponse.status == .failure)
    #expect(blankSearchProjectResponse.error?.code == .missingRequiredField)
    #expect(blankSearchProjectResponse.error?.message == "Required field projectID is missing.")
    #expect(blankSearchQueryResponse.status == .failure)
    #expect(blankSearchQueryResponse.error?.code == .invalidInput)
    #expect(blankSearchQueryResponse.error?.message == "Field query must not be empty.")

    #expect(searchResponse.status == .success)
    #expect(searchResponse.snapshot?.kind == .mpSearch)
    #expect(searchResponse.snapshot?.projectID == " mp.local-runtime ")
    #expect(searchResponse.snapshot?.summary == "MP search preserved raw boundary values.")

    #expect(readbackResponse.status == .success)
    #expect(readbackResponse.snapshot?.kind == .mpReadback)
    #expect(readbackResponse.snapshot?.projectID == "\tmp.local-runtime\t")
    #expect(readbackResponse.snapshot?.summary == "MP readback preserved raw boundary values.")

    #expect(smokeResponse.status == .success)
    #expect(smokeResponse.snapshot?.kind == .mpSmoke)
    #expect(smokeResponse.snapshot?.projectID == " smoke.project ")
    #expect(smokeResponse.snapshot?.summary == "MP smoke preserved raw boundary values.")
  }

  @Test
  func runtimeInterfaceResolveCmpFlowNotFoundKeepsSuccessEnvelopeAndNilIntentID() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      cmpFacade: makeStubCmpFacade(
        resolveCmpFlow: { command in
          PraxisCmpFlowResolve(
            projectID: command.projectID,
            agentID: command.agentID,
            summary: "CMP resolve did not find a checked snapshot for agent \(command.agentID) in project \(command.projectID).",
            result: .init(
              status: .notFound,
              found: false,
              snapshot: nil
            ),
            snapshot: nil
          )
        }
      )
    )

    let response = await runtimeInterface.handle(
      .resolveCmpFlow(
        .init(
          payloadSummary: "Resolve missing CMP flow snapshot",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local"
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.snapshot?.kind == .cmpFlow)
    #expect(response.snapshot?.title == "CMP Resolve cmp.local-runtime")
    #expect(response.snapshot?.summary == "CMP resolve did not find a checked snapshot for agent runtime.local in project cmp.local-runtime.")
    #expect(response.events.map(\.name) == [.cmpFlowResolved])
    #expect(response.events.first?.detail == response.snapshot?.summary)
    #expect(response.events.first?.intentID == nil)
  }

  @Test
  func runtimeInterfaceCmpApprovalEventDetailsFollowDecisionSummaryContract() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      cmpFacade: makeStubCmpFacade(
        requestCmpPeerApproval: { command in
          PraxisCmpPeerApproval(
            projectID: command.projectID,
            agentID: command.agentID,
            targetAgentID: command.targetAgentID,
            capabilityKey: command.capabilityKey,
            requestedTier: command.requestedTier,
            summary: "Approval snapshot summary for \(command.capabilityKey.rawValue).",
            route: .humanReview,
            outcome: .escalatedToHuman,
            tapMode: .restricted,
            riskLevel: .normal,
            humanGateState: .waitingApproval,
            requestedAt: "2026-04-11T12:00:00Z",
            decisionSummary: "Escalated \(command.capabilityKey.rawValue) to human review."
          )
        },
        decideCmpPeerApproval: { command in
          PraxisCmpPeerApproval(
            projectID: command.projectID,
            agentID: command.agentID,
            targetAgentID: command.targetAgentID,
            capabilityKey: command.capabilityKey,
            requestedTier: .b1,
            summary: "Approval decision snapshot for \(command.capabilityKey.rawValue).",
            route: .humanReview,
            outcome: .approvedByHuman,
            tapMode: .restricted,
            riskLevel: .normal,
            humanGateState: .approved,
            requestedAt: "2026-04-11T12:05:00Z",
            decisionSummary: command.decisionSummary
          )
        },
        readbackCmpPeerApproval: { command in
          PraxisCmpPeerApprovalReadback(
            projectID: command.projectID,
            agentID: command.agentID,
            targetAgentID: command.targetAgentID,
            capabilityKey: command.capabilityKey,
            requestedTier: .b1,
            summary: "Approval readback summary for \(command.capabilityKey?.rawValue ?? "unknown").",
            route: .humanReview,
            outcome: .approvedByHuman,
            tapMode: .restricted,
            riskLevel: .normal,
            humanGateState: .approved,
            requestedAt: "2026-04-11T12:05:00Z",
            decisionSummary: "Approved by reviewer.local.",
            found: true,
            issues: []
          )
        }
      )
    )

    let requestResponse = await runtimeInterface.handle(
      .requestCmpPeerApproval(
        .init(
          payloadSummary: "Request peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          requestedTier: .b1,
          summary: "Escalate git access"
        )
      )
    )
    let decideResponse = await runtimeInterface.handle(
      .decideCmpPeerApproval(
        .init(
          payloadSummary: "Approve peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          decision: .approve,
          reviewerAgentID: "reviewer.local",
          decisionSummary: "Approved by reviewer.local."
        )
      )
    )
    let readbackResponse = await runtimeInterface.handle(
      .readbackCmpPeerApproval(
        .init(
          payloadSummary: "Read back peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git")
        )
      )
    )

    #expect(requestResponse.status == .success)
    #expect(requestResponse.snapshot?.kind == .cmpApproval)
    #expect(requestResponse.snapshot?.summary == "Approval snapshot summary for tool.git.")
    #expect(requestResponse.snapshot?.requestedTier == .b1)
    #expect(requestResponse.snapshot?.route == .humanReview)
    #expect(requestResponse.snapshot?.outcome == .escalatedToHuman)
    #expect(requestResponse.snapshot?.tapMode == .restricted)
    #expect(requestResponse.snapshot?.riskLevel == .normal)
    #expect(requestResponse.snapshot?.humanGateState == .waitingApproval)
    #expect(requestResponse.events.map(\.name) == [.cmpPeerApprovalRequested])
    #expect(requestResponse.events.first?.detail == "Escalated tool.git to human review.")
    #expect(requestResponse.events.first?.detail != requestResponse.snapshot?.summary)

    #expect(decideResponse.status == .success)
    #expect(decideResponse.snapshot?.kind == .cmpApproval)
    #expect(decideResponse.snapshot?.summary == "Approval decision snapshot for tool.git.")
    #expect(decideResponse.snapshot?.requestedTier == .b1)
    #expect(decideResponse.snapshot?.route == .humanReview)
    #expect(decideResponse.snapshot?.outcome == .approvedByHuman)
    #expect(decideResponse.snapshot?.tapMode == .restricted)
    #expect(decideResponse.snapshot?.riskLevel == .normal)
    #expect(decideResponse.snapshot?.humanGateState == .approved)
    #expect(decideResponse.events.map(\.name) == [.cmpPeerApprovalDecided])
    #expect(decideResponse.events.first?.detail == "Approved by reviewer.local.")
    #expect(decideResponse.events.first?.detail != decideResponse.snapshot?.summary)

    #expect(readbackResponse.status == .success)
    #expect(readbackResponse.snapshot?.kind == .cmpApproval)
    #expect(readbackResponse.snapshot?.summary == "Approval readback summary for tool.git.")
    #expect(readbackResponse.snapshot?.requestedTier == .b1)
    #expect(readbackResponse.snapshot?.route == .humanReview)
    #expect(readbackResponse.snapshot?.outcome == .approvedByHuman)
    #expect(readbackResponse.snapshot?.tapMode == .restricted)
    #expect(readbackResponse.snapshot?.riskLevel == .normal)
    #expect(readbackResponse.snapshot?.humanGateState == .approved)
    #expect(readbackResponse.events.map(\.name) == [.cmpPeerApprovalReadback])
    #expect(readbackResponse.events.first?.detail == readbackResponse.snapshot?.summary)
  }

  @Test
  func runtimeInterfaceReadbackCmpPeerApprovalTreatsBlankOptionalCapabilityKeyAsOmittedFilter() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      cmpFacade: makeStubCmpFacade(
        readbackCmpPeerApproval: { command in
          #expect(command.capabilityKey == nil)
          return PraxisCmpPeerApprovalReadback(
            projectID: command.projectID,
            agentID: command.agentID,
            targetAgentID: command.targetAgentID,
            capabilityKey: capabilityID("tool.git"),
            requestedTier: .b1,
            summary: "Approval readback summary for tool.git.",
            route: .humanReview,
            outcome: .approvedByHuman,
            tapMode: .restricted,
            riskLevel: .normal,
            humanGateState: .approved,
            requestedAt: "2026-04-11T12:05:00Z",
            decisionSummary: "Approved by reviewer.local.",
            found: true,
            issues: []
          )
        }
      )
    )

    let response = await runtimeInterface.handle(
      .readbackCmpPeerApproval(
        .init(
          payloadSummary: "Read back peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("   ")
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.snapshot?.capabilityKey == capabilityID("tool.git"))
  }

  @Test
  func runtimeInterfaceInspectMpReturnsInspectionSnapshotContract() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: PraxisMpFacade(
        inspectMpUseCase: StubInspectMpUseCase {
          PraxisMpInspection(
            summary: "MP workflow surface is reading HostRuntime memory and current adapter provenance.",
            workflowSummary: "ICMA / Iterator / Checker / DbAgent / Dispatcher lanes have a composed provider inference surface available.",
            memoryStoreSummary: "Semantic memory bundle exposes 1 primary records and omits 0 superseded records. Semantic search matches for inspection query: 1.",
            multimodalSummary: "No multimodal host chips are currently registered.",
            issues: []
          )
        },
        searchMpUseCase: StubSearchMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "searchMp")
        },
        readbackMpUseCase: StubReadbackMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "readbackMp")
        },
        smokeMpUseCase: StubSmokeMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "smokeMp")
        },
        ingestMpUseCase: StubIngestMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "ingestMp")
        },
        alignMpUseCase: StubAlignMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "alignMp")
        },
        resolveMpUseCase: StubResolveMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "resolveMp")
        },
        requestMpHistoryUseCase: StubRequestMpHistoryUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "requestMpHistory")
        },
        promoteMpUseCase: StubPromoteMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "promoteMp")
        },
        archiveMpUseCase: StubArchiveMpUseCase { _ in
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "archiveMp")
        }
      )
    )

    let response = await runtimeInterface.handle(.inspectMp)

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.events.isEmpty)
    #expect(response.snapshot?.kind == .inspection)
    #expect(response.snapshot?.title == "MP Inspection")
    #expect(response.snapshot?.summary == "MP workflow surface is reading HostRuntime memory and current adapter provenance. Store: Semantic memory bundle exposes 1 primary records and omits 0 superseded records. Semantic search matches for inspection query: 1.")
    #expect(response.snapshot?.projectID == nil)
  }

  @Test
  func runtimeInterfaceRoutesDedicatedMpCommandsIntoStableSnapshotKinds() async throws {
    let runtimeInterface = makeStubbedRuntimeInterface(
      mpFacade: PraxisMpFacade(
        inspectMpUseCase: StubInspectMpUseCase {
          throw RuntimeInterfaceUnexpectedInvocationError(operation: "inspectMp")
        },
        searchMpUseCase: StubSearchMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.query == "onboarding")
          return PraxisMpSearchResult(
            projectID: command.projectID,
            query: command.query,
            summary: "MP search ranked 1 hit(s) from 2 candidate memory record(s) across 2 scope level(s).",
            hits: [
              .init(
                memoryID: "memory.primary",
                agentID: "runtime.local",
                scopeLevel: .agentIsolated,
                memoryKind: .semantic,
                freshnessStatus: .fresh,
                alignmentStatus: .aligned,
                summary: "Host runtime onboarding note",
                storageKey: "memory/primary",
                semanticScore: 0.91,
                finalScore: 1.0,
                rankExplanation: "freshness=fresh"
              )
            ],
            issues: []
          )
        },
        readbackMpUseCase: StubReadbackMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          return PraxisMpReadback(
            projectID: command.projectID,
            summary: "MP readback bundled 1 primary and 1 supporting record(s) while omitting 1 superseded record(s).",
            totalMemoryCount: 2,
            primaryCount: 1,
            supportingCount: 1,
            omittedSupersededCount: 1,
            freshnessBreakdown: .init(counts: [.fresh: 1, .aging: 1]),
            alignmentBreakdown: .init(counts: [.aligned: 1, .unreviewed: 1]),
            scopeBreakdown: .init(counts: [.agentIsolated: 1, .project: 1]),
            issues: []
          )
        },
        smokeMpUseCase: StubSmokeMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          return PraxisMpSmoke(
            projectID: command.projectID,
            summary: "MP smoke checks passed for semantic memory, semantic search, provider inference, and browser grounding.",
            checks: [
              .init(id: "semantic_memory_store", gate: .memoryStore, status: .ready, summary: "ok"),
              .init(id: "semantic_search", gate: .semanticSearch, status: .ready, summary: "ok"),
              .init(id: "provider_inference", gate: .providerInference, status: .ready, summary: "ok"),
              .init(id: "browser_grounding", gate: .browserGrounding, status: .ready, summary: "ok"),
            ]
          )
        },
        ingestMpUseCase: StubIngestMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.agentID == "runtime.local")
          return PraxisMpIngestResult(
            projectID: command.projectID,
            agentID: command.agentID,
            sessionID: command.sessionID,
            summary: "MP ingest stored 1 record update(s) and finished with keep for memory.primary.",
            primaryMemoryID: "memory.primary",
            storageKey: "memory/primary",
            updatedMemoryIDs: ["memory.primary"],
            supersededMemoryIDs: [],
            staleMemoryIDs: [],
            decision: .keep,
            freshnessStatus: .fresh,
            alignmentStatus: .aligned,
            issues: []
          )
        },
        alignMpUseCase: StubAlignMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.memoryID == "memory.primary")
          return PraxisMpAlignResult(
            projectID: command.projectID,
            memoryID: command.memoryID,
            summary: "MP align updated 1 record(s) and produced keep for memory.primary.",
            primaryMemoryID: "memory.primary",
            updatedMemoryIDs: ["memory.primary"],
            supersededMemoryIDs: [],
            staleMemoryIDs: [],
            decision: .keep,
            freshnessStatus: .fresh,
            alignmentStatus: .aligned,
            issues: []
          )
        },
        resolveMpUseCase: StubResolveMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.requesterAgentID == "runtime.local")
          return PraxisMpResolveResult(
            projectID: command.projectID,
            query: command.query,
            summary: "MP resolve assembled 1 primary and 1 supporting memory record(s) for query onboarding.",
            primaryMemoryIDs: ["memory.primary"],
            supportingMemoryIDs: ["memory.supporting"],
            omittedSupersededMemoryIDs: ["memory.superseded"],
            rerankComposition: .init(fresh: 1, aging: 1, stale: 0, superseded: 1, aligned: 1, unreviewed: 1, drifted: 0),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        },
        requestMpHistoryUseCase: StubRequestMpHistoryUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.requesterAgentID == "runtime.local")
          return PraxisMpHistoryResult(
            projectID: command.projectID,
            requesterAgentID: command.requesterAgentID,
            query: command.query,
            reason: command.reason,
            summary: "MP history returned 1 primary and 0 supporting memory record(s) for runtime.local.",
            primaryMemoryIDs: ["memory.primary"],
            supportingMemoryIDs: [],
            omittedSupersededMemoryIDs: [],
            rerankComposition: .init(fresh: 1, aging: 0, stale: 0, superseded: 0, aligned: 1, unreviewed: 0, drifted: 0),
            roleCounts: .init(counts: [.dispatcher: 1]),
            roleStages: .init(stages: [.dispatcher: .assembleBundle]),
            issues: []
          )
        },
        promoteMpUseCase: StubPromoteMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.memoryID == "memory.primary")
          #expect(command.targetPromotionState == .promotedToProject)
          return PraxisMpPromoteResult(
            projectID: command.projectID,
            memoryID: command.memoryID,
            summary: "MP promotion moved memory.primary to promoted_to_project with project_shared visibility.",
            scopeLevel: .project,
            sessionID: nil,
            sessionMode: .shared,
            visibilityState: .projectShared,
            promotionState: .promotedToProject,
            updatedAt: "2026-04-11T10:10:00Z",
            issues: []
          )
        },
        archiveMpUseCase: StubArchiveMpUseCase { command in
          #expect(command.projectID == "mp.local-runtime")
          #expect(command.memoryID == "memory.primary")
          return PraxisMpArchiveResult(
            projectID: command.projectID,
            memoryID: command.memoryID,
            summary: "MP archive marked memory.primary archived while preserving persisted memory truth.",
            scopeLevel: .project,
            sessionID: nil,
            sessionMode: .shared,
            visibilityState: .archived,
            promotionState: .archived,
            updatedAt: "2026-04-11T10:15:00Z",
            issues: []
          )
        }
      )
    )

    let searchResponse = await runtimeInterface.handle(
      .searchMp(
        .init(
          payloadSummary: "Search MP memory",
          projectID: "mp.local-runtime",
          query: "onboarding",
          scopeLevels: [.agentIsolated, .project],
          limit: 5
        )
      )
    )
    let readbackResponse = await runtimeInterface.handle(
      .readbackMp(
        .init(
          payloadSummary: "Read back MP memory",
          projectID: "mp.local-runtime",
          query: "onboarding",
          scopeLevels: [.agentIsolated, .project],
          limit: 5
        )
      )
    )
    let smokeResponse = await runtimeInterface.handle(
      .smokeMp(
        .init(
          payloadSummary: "Smoke MP host wiring",
          projectID: "mp.local-runtime"
        )
      )
    )
    let ingestResponse = await runtimeInterface.handle(
      .ingestMp(
        .init(
          payloadSummary: "Ingest MP memory",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          sessionID: "mp.session",
          summary: "Host runtime onboarding note",
          checkedSnapshotRef: runtimeInterfaceReferenceID("snapshot.mp.1"),
          branchRef: "main"
        )
      )
    )
    let alignResponse = await runtimeInterface.handle(
      .alignMp(
        .init(
          payloadSummary: "Align MP memory",
          projectID: "mp.local-runtime",
          memoryID: "memory.primary"
        )
      )
    )
    let promoteResponse = await runtimeInterface.handle(
      .promoteMp(
        .init(
          payloadSummary: "Promote MP memory",
          projectID: "mp.local-runtime",
          memoryID: "memory.primary",
          targetPromotionState: .promotedToProject
        )
      )
    )
    let archiveResponse = await runtimeInterface.handle(
      .archiveMp(
        .init(
          payloadSummary: "Archive MP memory",
          projectID: "mp.local-runtime",
          memoryID: "memory.primary",
          reason: "Superseded by project summary"
        )
      )
    )
    let resolveResponse = await runtimeInterface.handle(
      .resolveMp(
        .init(
          payloadSummary: "Resolve MP bundle",
          projectID: "mp.local-runtime",
          query: "onboarding",
          requesterAgentID: "runtime.local",
          sessionID: "mp.session"
        )
      )
    )
    let historyResponse = await runtimeInterface.handle(
      .requestMpHistory(
        .init(
          payloadSummary: "Request MP history",
          projectID: "mp.local-runtime",
          requesterAgentID: "runtime.local",
          sessionID: "mp.session",
          reason: "Need historical context",
          query: "onboarding"
        )
      )
    )

    #expect(searchResponse.status == .success)
    #expect(searchResponse.snapshot?.kind == .mpSearch)
    #expect(searchResponse.snapshot?.title == "MP Search")
    #expect(searchResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(readbackResponse.status == .success)
    #expect(readbackResponse.snapshot?.kind == .mpReadback)
    #expect(readbackResponse.snapshot?.title == "MP Readback")
    #expect(readbackResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(smokeResponse.status == .success)
    #expect(smokeResponse.snapshot?.kind == .mpSmoke)
    #expect(smokeResponse.snapshot?.title == "MP Smoke")
    #expect(smokeResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(ingestResponse.status == .success)
    #expect(ingestResponse.snapshot?.kind == .mpIngest)
    #expect(ingestResponse.snapshot?.title == "MP Ingest")
    #expect(ingestResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(ingestResponse.snapshot?.sessionID?.rawValue == "mp.session")
    #expect(alignResponse.status == .success)
    #expect(alignResponse.snapshot?.kind == .mpAlign)
    #expect(alignResponse.snapshot?.title == "MP Align")
    #expect(promoteResponse.status == .success)
    #expect(promoteResponse.snapshot?.kind == .mpPromote)
    #expect(promoteResponse.snapshot?.title == "MP Promote")
    #expect(promoteResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(archiveResponse.status == .success)
    #expect(archiveResponse.snapshot?.kind == .mpArchive)
    #expect(archiveResponse.snapshot?.title == "MP Archive")
    #expect(archiveResponse.snapshot?.projectID == "mp.local-runtime")
    #expect(resolveResponse.status == .success)
    #expect(resolveResponse.snapshot?.kind == .mpResolve)
    #expect(resolveResponse.snapshot?.title == "MP Resolve")
    #expect(resolveResponse.snapshot?.sessionID?.rawValue == "mp.session")
    #expect(historyResponse.status == .success)
    #expect(historyResponse.snapshot?.kind == .mpHistory)
    #expect(historyResponse.snapshot?.title == "MP History")
    #expect(historyResponse.snapshot?.sessionID?.rawValue == "mp.session")
  }

  @Test
  func runtimeInterfaceRoundTripsColonContainingSessionIDsAcrossRunAndResume() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let started = await runtimeInterface.handle(
      .runGoal(
        .init(
          payloadSummary: "Lossless session identifier roundtrip",
          goalID: "goal.lossless-session",
          goalTitle: "Lossless Session Goal",
          sessionID: "team:alpha"
        )
      )
    )
    let resumed = await runtimeInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Resume lossless session run",
          runID: started.snapshot?.runID?.rawValue ?? ""
        )
      )
    )

    #expect(started.status == .success)
    #expect(resumed.status == .success)
    #expect(started.snapshot?.sessionID?.rawValue == "team:alpha")
    #expect(resumed.snapshot?.sessionID?.rawValue == "team:alpha")
    #expect(resumed.snapshot?.phase == .running)
    #expect(resumed.snapshot?.lifecycleDisposition == .resumed)
    #expect(resumed.events.map(\.name) == [.runResumed, .runFollowUpReady])
  }

  @Test
  func runtimeInterfaceReturnsStructuredMissingFieldErrorEnvelope() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Missing run ID",
          runID: ""
        )
      )
    )

    #expect(response.status == .failure)
    #expect(response.snapshot == nil)
    #expect(response.events.isEmpty)
    #expect(response.error?.code == .missingRequiredField)
    #expect(response.error?.missingField == "runID")
    #expect(response.error?.retryable == false)
  }

  @Test
  func runtimeInterfaceRecoverCmpProjectReturnsStructuredMissingFieldErrors() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )
    let cases: [(String, PraxisRuntimeInterfaceRequest)] = [
      (
        "projectID",
        .recoverCmpProject(
          .init(
            payloadSummary: "Missing project ID",
            projectID: "",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            reason: "Recover context"
          )
        )
      ),
      (
        "agentID",
        .recoverCmpProject(
          .init(
            payloadSummary: "Missing agent ID",
            projectID: "cmp.local-runtime",
            agentID: "",
            targetAgentID: "checker.local",
            reason: "Recover context"
          )
        )
      ),
      (
        "targetAgentID",
        .recoverCmpProject(
          .init(
            payloadSummary: "Missing target agent ID",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "",
            reason: "Recover context"
          )
        )
      ),
    ]

    for (missingField, request) in cases {
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .missingRequiredField)
      #expect(response.error?.missingField == missingField)
      #expect(response.error?.retryable == false)
    }
  }

  @Test
  func runtimeInterfaceReturnsStructuredCmpApprovalMissingFieldErrors() async throws {
    let runtimeInterface = makeThrowingRuntimeInterface()
    let cases: [(String, PraxisRuntimeInterfaceRequest)] = [
      (
        "agentID",
        .requestCmpPeerApproval(
          .init(
            payloadSummary: "Missing approval requester",
            projectID: "cmp.local-runtime",
            agentID: "",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID("tool.git"),
            requestedTier: .b1,
            summary: "Escalate git access"
          )
        )
      ),
      (
        "targetAgentID",
        .requestCmpPeerApproval(
          .init(
            payloadSummary: "Missing approval target",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "   ",
            capabilityKey: capabilityID("tool.git"),
            requestedTier: .b1,
            summary: "Escalate git access"
          )
        )
      ),
      (
        "capabilityKey",
        .requestCmpPeerApproval(
          .init(
            payloadSummary: "Missing capability key",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID(""),
            requestedTier: .b1,
            summary: "Escalate git access"
          )
        )
      ),
      (
        "agentID",
        .decideCmpPeerApproval(
          .init(
            payloadSummary: "Missing approval decision requester",
            projectID: "cmp.local-runtime",
            agentID: "   ",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID("tool.git"),
            decision: .approve,
            reviewerAgentID: "reviewer.local",
            decisionSummary: "Approved git access"
          )
        )
      ),
      (
        "targetAgentID",
        .decideCmpPeerApproval(
          .init(
            payloadSummary: "Missing approval decision target",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "",
            capabilityKey: capabilityID("tool.git"),
            decision: .approve,
            reviewerAgentID: "reviewer.local",
            decisionSummary: "Approved git access"
          )
        )
      ),
      (
        "capabilityKey",
        .decideCmpPeerApproval(
          .init(
            payloadSummary: "Missing approval decision capability key",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID(""),
            decision: .approve,
            reviewerAgentID: "reviewer.local",
            decisionSummary: "Approved git access"
          )
        )
      ),
    ]

    for (missingField, request) in cases {
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .missingRequiredField)
      #expect(response.error?.missingField == missingField)
      #expect(response.error?.retryable == false)
      #expect(response.error?.runID == nil)
      #expect(response.error?.sessionID == nil)
    }
  }

  @Test
  func runtimeInterfaceReturnsStructuredCmpFlowMissingFieldErrors() async throws {
    let runtimeInterface = makeThrowingRuntimeInterface()
    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "package.interface.missing-fields"),
      sourceProjectionID: .init(rawValue: "projection.interface.missing-fields"),
      sourceSnapshotID: .init(rawValue: "snapshot.interface.missing-fields"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.interface.missing-fields/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.interface.missing-fields:section")]
    )
    let historyQuery = PraxisRuntimeInterfaceCmpHistoryQuery(
      snapshotID: .init(rawValue: "snapshot.interface.missing-fields"),
      packageKindHint: .historicalReply
    )
    let cases: [(String, String?, PraxisRuntimeInterfaceRequest)] = [
      (
        "agentID",
        "cmp.flow.session",
        .ingestCmpFlow(
          .init(
            payloadSummary: "Missing ingest agent",
            projectID: "cmp.local-runtime",
            agentID: "",
            sessionID: "cmp.flow.session",
            taskSummary: "Capture one runtime material",
            materials: [.init(kind: .userInput, ref: "payload:user:cmp")]
          )
        )
      ),
      (
        "sessionID",
        nil,
        .ingestCmpFlow(
          .init(
            payloadSummary: "Missing ingest session",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "   ",
            taskSummary: "Capture one runtime material",
            materials: [.init(kind: .userInput, ref: "payload:user:cmp")]
          )
        )
      ),
      (
        "agentID",
        "cmp.flow.session",
        .commitCmpFlow(
          .init(
            payloadSummary: "Missing commit agent",
            projectID: "cmp.local-runtime",
            agentID: "",
            sessionID: "cmp.flow.session",
            eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
            changeSummary: "Commit accepted flow event",
            syncIntent: .toParent
          )
        )
      ),
      (
        "sessionID",
        nil,
        .commitCmpFlow(
          .init(
            payloadSummary: "Missing commit session",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "",
            eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
            changeSummary: "Commit accepted flow event",
            syncIntent: .toParent
          )
        )
      ),
      (
        "agentID",
        nil,
        .resolveCmpFlow(
          .init(
            payloadSummary: "Missing resolve agent",
            projectID: "cmp.local-runtime",
            agentID: ""
          )
        )
      ),
      (
        "agentID",
        nil,
        .materializeCmpFlow(
          .init(
            payloadSummary: "Missing materialize agent",
            projectID: "cmp.local-runtime",
            agentID: "",
            targetAgentID: "checker.local",
            packageKind: .runtimeFill
          )
        )
      ),
      (
        "targetAgentID",
        nil,
        .materializeCmpFlow(
          .init(
            payloadSummary: "Missing materialize target",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "",
            packageKind: .runtimeFill
          )
        )
      ),
      (
        "agentID",
        nil,
        .dispatchCmpFlow(
          .init(
            payloadSummary: "Missing dispatch agent",
            projectID: "cmp.local-runtime",
            agentID: "",
            contextPackage: contextPackage,
            targetKind: .peer,
            reason: "Dispatch runtime fill"
          )
        )
      ),
      (
        "agentID",
        nil,
        .retryCmpDispatch(
          .init(
            payloadSummary: "Missing retry agent",
            projectID: "cmp.local-runtime",
            agentID: "",
            packageID: runtimeInterfaceReferenceID("package.retry")
          )
        )
      ),
      (
        "packageID",
        nil,
        .retryCmpDispatch(
          .init(
            payloadSummary: "Missing retry package",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            packageID: runtimeInterfaceReferenceID("   ")
          )
        )
      ),
      (
        "requesterAgentID",
        nil,
        .requestCmpHistory(
          .init(
            payloadSummary: "Missing history requester",
            projectID: "cmp.local-runtime",
            requesterAgentID: "",
            reason: "Recover high-signal context",
            query: historyQuery
          )
        )
      ),
    ]

    for (missingField, expectedSessionID, request) in cases {
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .missingRequiredField)
      #expect(response.error?.missingField == missingField)
      #expect(response.error?.retryable == false)
      #expect(response.error?.runID == nil)
      #expect(response.error?.sessionID?.rawValue == expectedSessionID)
    }
  }

  @Test
  func runtimeInterfaceReturnsStructuredCmpInvalidInputForEmptyTextAndCollections() async throws {
    let runtimeInterface = makeThrowingRuntimeInterface()
    let contextPackage = PraxisCmpContextPackage(
      id: .init(rawValue: "package.interface.invalid-input"),
      sourceProjectionID: .init(rawValue: "projection.interface.invalid-input"),
      sourceSnapshotID: .init(rawValue: "snapshot.interface.invalid-input"),
      sourceAgentID: "runtime.local",
      targetAgentID: "checker.local",
      kind: .runtimeFill,
      packageRef: "context://cmp.local-runtime/projection.interface.invalid-input/checker.local/runtimeFill",
      fidelityLabel: .highSignal,
      createdAt: "2026-04-11T00:00:00Z",
      sourceSectionIDs: [.init(rawValue: "projection.interface.invalid-input:section")]
    )
    let historyQuery = PraxisRuntimeInterfaceCmpHistoryQuery(
      snapshotID: .init(rawValue: "snapshot.interface.invalid-input"),
      packageKindHint: .historicalReply
    )
    let cases: [(String, String?, PraxisRuntimeInterfaceRequest)] = [
      (
        "Field summary must not be empty.",
        nil,
        .requestCmpPeerApproval(
          .init(
            payloadSummary: "Empty approval summary",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID("tool.git"),
            requestedTier: .b1,
            summary: "   "
          )
        )
      ),
      (
        "Field decisionSummary must not be empty.",
        nil,
        .decideCmpPeerApproval(
          .init(
            payloadSummary: "Empty decision summary",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID("tool.git"),
            decision: .approve,
            reviewerAgentID: "reviewer.local",
            decisionSummary: "   "
          )
        )
      ),
      (
        "Field reason must not be empty.",
        nil,
        .recoverCmpProject(
          .init(
            payloadSummary: "Empty recover reason",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            reason: "   "
          )
        )
      ),
      (
        "Field taskSummary must not be empty.",
        "cmp.flow.session",
        .ingestCmpFlow(
          .init(
            payloadSummary: "Empty ingest task summary",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "cmp.flow.session",
            taskSummary: "   ",
            materials: [.init(kind: .userInput, ref: "payload:user:cmp")]
          )
        )
      ),
      (
        "Field materials must not be empty.",
        "cmp.flow.session",
        .ingestCmpFlow(
          .init(
            payloadSummary: "Empty ingest materials",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "cmp.flow.session",
            taskSummary: "Capture one runtime material",
            materials: []
          )
        )
      ),
      (
        "Field eventIDs must not be empty.",
        "cmp.flow.session",
        .commitCmpFlow(
          .init(
            payloadSummary: "Empty commit event ids",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "cmp.flow.session",
            eventIDs: [],
            changeSummary: "Commit accepted flow event",
            syncIntent: .toParent
          )
        )
      ),
      (
        "Field eventIDs must not contain blank identifiers.",
        "cmp.flow.session",
        .commitCmpFlow(
          .init(
            payloadSummary: "Blank commit event id",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "cmp.flow.session",
            eventIDs: [runtimeInterfaceReferenceID("   ")],
            changeSummary: "Commit accepted flow event",
            syncIntent: .toParent
          )
        )
      ),
      (
        "Field changeSummary must not be empty.",
        "cmp.flow.session",
        .commitCmpFlow(
          .init(
            payloadSummary: "Empty commit change summary",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            sessionID: "cmp.flow.session",
            eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
            changeSummary: "   ",
            syncIntent: .toParent
          )
        )
      ),
      (
        "Field reason must not be empty.",
        nil,
        .dispatchCmpFlow(
          .init(
            payloadSummary: "Empty dispatch reason",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            contextPackage: contextPackage,
            targetKind: .peer,
            reason: "   "
          )
        )
      ),
      (
        "Field checkedSnapshotRef must not be empty.",
        nil,
        .ingestMp(
          .init(
            payloadSummary: "Empty MP checked snapshot reference",
            projectID: "mp.local-runtime",
            agentID: "runtime.local",
            summary: "Capture MP note",
            checkedSnapshotRef: runtimeInterfaceReferenceID("   "),
            branchRef: "main"
          )
        )
      ),
      (
        "Field reason must not be empty.",
        nil,
        .requestCmpHistory(
          .init(
            payloadSummary: "Empty history reason",
            projectID: "cmp.local-runtime",
            requesterAgentID: "checker.local",
            reason: "   ",
            query: historyQuery
          )
        )
      ),
    ]

    for (message, expectedSessionID, request) in cases {
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .invalidInput)
      #expect(response.error?.message == message)
      #expect(response.error?.retryable == false)
      #expect(response.error?.runID == nil)
      #expect(response.error?.sessionID?.rawValue == expectedSessionID)
    }
  }

  @Test
  func runtimeInterfaceLegacyBlankCmpRefInitializersCollapseToNil() {
    let recoverPayload = PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload(
      payloadSummary: "Recover through legacy blank branch ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      reason: "Recover focused context",
      branchRef: "   "
    )
    let commitPayload = PraxisRuntimeInterfaceCommitCmpFlowRequestPayload(
      payloadSummary: "Commit through legacy blank base ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      sessionID: "cmp.flow.session",
      eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
      baseRef: "   ",
      changeSummary: "Commit accepted flow event",
      syncIntent: .toParent
    )
    let resolvePayload = PraxisRuntimeInterfaceResolveCmpFlowRequestPayload(
      payloadSummary: "Resolve through legacy blank branch ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      branchRef: "   "
    )
    let historyQuery = PraxisRuntimeInterfaceCmpHistoryQuery(branchRef: "   ")

    #expect(recoverPayload.branchRef == nil)
    #expect(commitPayload.baseRef == nil)
    #expect(resolvePayload.branchRef == nil)
    #expect(historyQuery.branchRef == nil)
  }

  @Test
  func runtimeInterfaceTypedBlankCmpRefInitializersCollapseToNil() {
    let blankTypedRef = PraxisCmpRefName(rawValue: "   ")
    let recoverPayload = PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload(
      payloadSummary: "Recover through typed blank branch ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      reason: "Recover focused context",
      branchRef: blankTypedRef
    )
    let commitPayload = PraxisRuntimeInterfaceCommitCmpFlowRequestPayload(
      payloadSummary: "Commit through typed blank base ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      sessionID: "cmp.flow.session",
      eventIDs: [runtimeInterfaceReferenceID("evt.cmp.1")],
      baseRef: blankTypedRef,
      changeSummary: "Commit accepted flow event",
      syncIntent: .toParent
    )
    let resolvePayload = PraxisRuntimeInterfaceResolveCmpFlowRequestPayload(
      payloadSummary: "Resolve through typed blank branch ref",
      projectID: "cmp.local-runtime",
      agentID: "runtime.local",
      branchRef: blankTypedRef
    )
    let historyQuery = PraxisRuntimeInterfaceCmpHistoryQuery(branchRef: blankTypedRef)

    #expect(blankTypedRef.rawValue.isEmpty)
    #expect(recoverPayload.branchRef == nil)
    #expect(commitPayload.baseRef == nil)
    #expect(resolvePayload.branchRef == nil)
    #expect(historyQuery.branchRef == nil)
  }

  @Test
  func runtimeInterfaceRejectsDecodedBlankCmpRefWrappersFromJSONString() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let cases: [(String, String)] = [
      (
        #"{"kind":"recoverCmpProject","recoverCmpProject":{"payloadSummary":"Blank decoded recover branch ref","projectID":"cmp.local-runtime","agentID":"runtime.local","targetAgentID":"checker.local","reason":"Recover focused context","branchRef":"   ","packageKind":"historicalReply"}}"#,
        "Field branchRef must not be empty."
      ),
      (
        #"{"kind":"commitCmpFlow","commitCmpFlow":{"payloadSummary":"Blank decoded commit base ref","projectID":"cmp.local-runtime","agentID":"runtime.local","sessionID":"cmp.flow.session","eventIDs":["evt.cmp.1"],"baseRef":"   ","changeSummary":"Commit accepted flow event","syncIntent":"toParent"}}"#,
        "Field baseRef must not be empty."
      ),
      (
        #"{"kind":"resolveCmpFlow","resolveCmpFlow":{"payloadSummary":"Blank decoded resolve branch ref","projectID":"cmp.local-runtime","agentID":"runtime.local","branchRef":"   "}}"#,
        "Field branchRef must not be empty."
      ),
      (
        #"{"kind":"requestCmpHistory","requestCmpHistory":{"payloadSummary":"Blank decoded history branch ref","projectID":"cmp.local-runtime","requesterAgentID":"checker.local","reason":"Recover focused context","query":{"branchRef":"   ","metadata":{}}}}"#,
        "Field query.branchRef must not be empty."
      ),
    ]

    for (json, message) in cases {
      let request = try codec.decodeRequest(Data(json.utf8))
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.error?.code == .invalidInput)
      #expect(response.error?.message == message)
    }
  }

  @Test
  func runtimeInterfaceReturnsStructuredCheckpointNotFoundErrorEnvelope() async throws {
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )
    let runID = "run:pct~team%3Aalpha:goal.missing-checkpoint"

    let response = await runtimeInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Resume missing checkpoint",
          runID: runID
        )
      )
    )

    #expect(response.status == .failure)
    #expect(response.snapshot == nil)
    #expect(response.events.isEmpty)
    #expect(response.error?.code == .checkpointNotFound)
    #expect(response.error?.runID?.rawValue == runID)
    #expect(response.error?.sessionID?.rawValue == "team:alpha")
    #expect(response.error?.retryable == false)
  }

  @Test
  func runtimeInterfaceMapsInvalidInputAndDependencyMissingIntoStableErrorCodes() async throws {
    let invalidInputInterface = makeThrowingRuntimeInterface(
      inspectTapError: PraxisError.invalidInput("TAP inspection arguments are invalid.")
    )
    let dependencyMissingInterface = makeThrowingRuntimeInterface(
      inspectCmpError: PraxisError.dependencyMissing("CMP structured store adapter is unavailable.")
    )
    let approvalNotFoundInterface = makeThrowingRuntimeInterface(
      decideCmpPeerApprovalError: PraxisError.invalidInput(
        "CMP peer approval request was not found for cmp.local-runtime, runtime.local, checker.local, tool.git."
      )
    )
    let approvalResolvedInterface = makeThrowingRuntimeInterface(
      decideCmpPeerApprovalError: PraxisError.invalidInput(
        "CMP peer approval gate is already resolved for cmp.local-runtime, runtime.local, checker.local, tool.git."
      )
    )
    let packageNotFoundInterface = makeThrowingRuntimeInterface(
      retryCmpDispatchError: PraxisError.invalidInput(
        "CMP package was not found for project cmp.local-runtime and package package.missing."
      )
    )
    let dispatchNotRetryableInterface = makeThrowingRuntimeInterface(
      retryCmpDispatchError: PraxisError.invalidInput(
        "CMP dispatch retry is not available for package package.archived with status archived."
      )
    )

    let invalidInputResponse = await invalidInputInterface.handle(.inspectTap)
    let dependencyMissingResponse = await dependencyMissingInterface.handle(.inspectCmp)
    let approvalNotFoundResponse = await approvalNotFoundInterface.handle(
      .decideCmpPeerApproval(
        .init(
          payloadSummary: "Approve missing peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          decision: .approve,
          reviewerAgentID: "reviewer.local",
          decisionSummary: "Approve missing approval"
        )
      )
    )
    let approvalResolvedResponse = await approvalResolvedInterface.handle(
      .decideCmpPeerApproval(
        .init(
          payloadSummary: "Approve resolved peer approval",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          capabilityKey: capabilityID("tool.git"),
          decision: .approve,
          reviewerAgentID: "reviewer.local",
          decisionSummary: "Approve resolved approval"
        )
      )
    )
    let packageNotFoundResponse = await packageNotFoundInterface.handle(
      .retryCmpDispatch(
        .init(
          payloadSummary: "Retry missing package",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID("package.missing")
        )
      )
    )
    let dispatchNotRetryableResponse = await dispatchNotRetryableInterface.handle(
      .retryCmpDispatch(
        .init(
          payloadSummary: "Retry archived package",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID("package.archived")
        )
      )
    )

    #expect(invalidInputResponse.status == .failure)
    #expect(invalidInputResponse.error?.code == .invalidInput)
    #expect(invalidInputResponse.error?.message == "TAP inspection arguments are invalid.")
    #expect(invalidInputResponse.error?.retryable == false)
    #expect(invalidInputResponse.events.isEmpty)

    #expect(dependencyMissingResponse.status == .failure)
    #expect(dependencyMissingResponse.error?.code == .dependencyMissing)
    #expect(dependencyMissingResponse.error?.message == "CMP structured store adapter is unavailable.")
    #expect(dependencyMissingResponse.error?.retryable == false)
    #expect(dependencyMissingResponse.events.isEmpty)

    #expect(approvalNotFoundResponse.status == .failure)
    #expect(approvalNotFoundResponse.error?.code == .cmpPeerApprovalNotFound)
    #expect(approvalNotFoundResponse.error?.runID == nil)
    #expect(approvalNotFoundResponse.error?.sessionID == nil)
    #expect(approvalNotFoundResponse.error?.retryable == false)

    #expect(approvalResolvedResponse.status == .failure)
    #expect(approvalResolvedResponse.error?.code == .cmpPeerApprovalAlreadyResolved)
    #expect(approvalResolvedResponse.error?.runID == nil)
    #expect(approvalResolvedResponse.error?.sessionID == nil)
    #expect(approvalResolvedResponse.error?.retryable == false)

    #expect(packageNotFoundResponse.status == .failure)
    #expect(packageNotFoundResponse.error?.code == .cmpPackageNotFound)
    #expect(packageNotFoundResponse.error?.runID == nil)
    #expect(packageNotFoundResponse.error?.sessionID == nil)
    #expect(packageNotFoundResponse.error?.retryable == false)

    #expect(dispatchNotRetryableResponse.status == .failure)
    #expect(dispatchNotRetryableResponse.error?.code == .cmpDispatchNotRetryable)
    #expect(dispatchNotRetryableResponse.error?.runID == nil)
    #expect(dispatchNotRetryableResponse.error?.sessionID == nil)
    #expect(dispatchNotRetryableResponse.error?.retryable == false)
  }

  @Test
  func runtimeInterfaceSurfacesCorruptedPersistedCmpControlDescriptorsAsInvalidInput() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-corrupted-control-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    _ = try await registry.cmpControlStore?.save(
      PraxisCmpControlDescriptor(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: PraxisCmpExecutionStyle.manual.rawValue,
        mode: PraxisCmpControlMode.peerReview.rawValue,
        readbackPriority: PraxisCmpReadbackPriority.packageFirst.rawValue,
        fallbackPolicy: "broken_fallback",
        recoveryPreference: PraxisCmpRecoveryPreference.resumeLatest.rawValue,
        automation: ["autoDispatch": false],
        updatedAt: "2026-04-12T00:00:00Z"
      )
    )
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let readbackResponse = await runtimeInterface.handle(
      .readbackCmpControl(
        .init(
          payloadSummary: "Read corrupted CMP control",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let updateResponse = await runtimeInterface.handle(
      .updateCmpControl(
        .init(
          payloadSummary: "Update corrupted CMP control",
          projectID: "cmp.local-runtime",
          agentID: "checker.local",
          automation: .init(values: [.autoDispatch: true])
        )
      )
    )

    #expect(readbackResponse.status == .failure)
    #expect(readbackResponse.snapshot == nil)
    #expect(readbackResponse.events.isEmpty)
    #expect(readbackResponse.error?.code == .invalidInput)
    #expect(readbackResponse.error?.message.contains("fallbackPolicy") == true)
    #expect(readbackResponse.error?.message.contains("broken_fallback") == true)

    #expect(updateResponse.status == .failure)
    #expect(updateResponse.snapshot == nil)
    #expect(updateResponse.events.isEmpty)
    #expect(updateResponse.error?.code == .invalidInput)
    #expect(updateResponse.error?.message.contains("fallbackPolicy") == true)
    #expect(updateResponse.error?.message.contains("broken_fallback") == true)
  }

  @Test
  func runtimeInterfaceSurfacesCorruptedPersistedCmpDispatchMetadataAsInvalidInput() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-corrupted-dispatch-metadata-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
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
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let response = await runtimeInterface.handle(
      .retryCmpDispatch(
        .init(
          payloadSummary: "Retry corrupted dispatch metadata",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID("projection.runtime.local:checker.local:runtimeFill")
        )
      )
    )

    #expect(response.status == .failure)
    #expect(response.snapshot == nil)
    #expect(response.events.isEmpty)
    #expect(response.error?.code == .invalidInput)
    #expect(response.error?.message.contains("dispatch_target_kind") == true)
    #expect(response.error?.message.contains("broken_target_kind") == true)
  }

  @Test
  func runtimeInterfaceSurfacesCorruptedPersistedCmpReadbackDispatchStatusAsInvalidInput() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-interface-corrupted-readback-dispatch-status-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let registry = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
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
        status: .dispatched,
        sourceSectionIDs: [.init(rawValue: "projection.runtime.local:section")],
        createdAt: "2026-04-11T00:00:00Z",
        updatedAt: "2026-04-11T00:00:00Z",
        metadata: [
          "last_dispatch_status": .string("broken_dispatch_status"),
        ]
      )
    )
    let runtimeInterface = try PraxisRuntimeGatewayFactory.makeRuntimeInterface(
      hostAdapters: registry,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let rolesResponse = await runtimeInterface.handle(
      .readbackCmpRoles(
        .init(
          payloadSummary: "Read corrupted CMP roles",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )
    let statusResponse = await runtimeInterface.handle(
      .readbackCmpStatus(
        .init(
          payloadSummary: "Read corrupted CMP status",
          projectID: "cmp.local-runtime",
          agentID: "checker.local"
        )
      )
    )

    for response in [rolesResponse, statusResponse] {
      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .invalidInput)
      #expect(response.error?.message.contains("last_dispatch_status") == true)
      #expect(response.error?.message.contains("broken_dispatch_status") == true)
    }
  }

  @Test
  func runtimeInterfaceMapsUnsupportedOperationAndInvariantViolationIntoStableErrorCodes() async throws {
    let unsupportedInterface = makeThrowingRuntimeInterface(
      inspectMpError: PraxisError.unsupportedOperation("MP inspection is not available in this host profile.")
    )
    let invariantInterface = makeThrowingRuntimeInterface(
      runGoalError: PraxisError.invariantViolation("Run goal fixture entered an impossible state."),
    )

    let unsupportedResponse = await unsupportedInterface.handle(.inspectMp)
    let invariantResponse = await invariantInterface.handle(
      .runGoal(
        .init(
          payloadSummary: "Invariant smoke test",
          goalID: "goal.invariant-smoke",
          goalTitle: "Invariant Smoke Goal",
          sessionID: "session.invariant-smoke"
        )
      )
    )

    #expect(unsupportedResponse.status == .failure)
    #expect(unsupportedResponse.error?.code == .unsupportedOperation)
    #expect(unsupportedResponse.error?.message == "MP inspection is not available in this host profile.")
    #expect(unsupportedResponse.error?.retryable == false)

    #expect(invariantResponse.status == .failure)
    #expect(invariantResponse.error?.code == .invariantViolation)
    #expect(invariantResponse.error?.message == "Run goal fixture entered an impossible state.")
    #expect(invariantResponse.error?.sessionID?.rawValue == "session.invariant-smoke")
    #expect(invariantResponse.error?.runID == nil)
  }

  @Test
  func runtimeInterfaceMapsInvalidTransitionAndUnknownErrorsIntoStableErrorCodes() async throws {
    let invalidTransitionRunID = "run:pct~team%3Aalpha:goal.invalid-transition"
    let invalidTransitionInterface = makeThrowingRuntimeInterface(
      resumeRunError: PraxisInvalidTransitionError(
        fromStatus: .deciding,
        eventType: .runResumed,
        message: "Cannot resume a run while the state machine is still deciding."
      )
    )
    let unknownInterface = makeThrowingRuntimeInterface(
      resumeRunError: RuntimeInterfaceUnknownSmokeError(summary: "bridge exploded")
    )

    let invalidTransitionResponse = await invalidTransitionInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Invalid transition smoke test",
          runID: invalidTransitionRunID
        )
      )
    )
    let unknownResponse = await unknownInterface.handle(
      .resumeRun(
        .init(
          payloadSummary: "Unknown failure smoke test",
          runID: invalidTransitionRunID
        )
      )
    )

    #expect(invalidTransitionResponse.status == .failure)
    #expect(invalidTransitionResponse.error?.code == .invalidTransition)
    #expect(invalidTransitionResponse.error?.message == "Cannot resume a run while the state machine is still deciding.")
    #expect(invalidTransitionResponse.error?.runID?.rawValue == invalidTransitionRunID)
    #expect(invalidTransitionResponse.error?.sessionID?.rawValue == "team:alpha")
    #expect(invalidTransitionResponse.error?.retryable == false)

    #expect(unknownResponse.status == .failure)
    #expect(unknownResponse.error?.code == .unknown)
    #expect(unknownResponse.error?.message.contains("RuntimeInterfaceUnknownSmokeError") == true)
    #expect(unknownResponse.error?.runID?.rawValue == invalidTransitionRunID)
    #expect(unknownResponse.error?.sessionID?.rawValue == "team:alpha")
    #expect(unknownResponse.error?.retryable == true)
  }

  @Test
  func runtimeInterfaceRegistryRoutesRequestsAcrossIndependentHandles() async throws {
    let hostAdapters = PraxisHostAdapterRegistry.scaffoldDefaults()
    let registry = PraxisRuntimeGatewayFactory.makeRuntimeInterfaceRegistry(
      hostAdapters: hostAdapters,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )

    let firstHandle = try await registry.openSession()
    let secondHandle = try await registry.openSession()

    #expect(firstHandle != secondHandle)
    #expect(await registry.activeHandles() == [firstHandle, secondHandle])
    #expect(await registry.containsSession(firstHandle))
    #expect(await registry.containsSession(secondHandle))
    #expect(await registry.bootstrapSnapshot(for: firstHandle)?.kind == .architecture)

    let started = await registry.handle(
      .runGoal(
        .init(
          payloadSummary: "Registry first handle run",
          goalID: "goal.registry-shared",
          goalTitle: "Registry Shared Goal",
          sessionID: "session.registry-shared"
        )
      ),
      on: firstHandle
    )
    let resumed = await registry.handle(
      .resumeRun(
        .init(
          payloadSummary: "Registry second handle resume",
          runID: started.snapshot?.runID?.rawValue ?? ""
        )
      ),
      on: secondHandle
    )

    let firstEvents = await registry.snapshotEvents(for: firstHandle)
    let secondEvents = await registry.snapshotEvents(for: secondHandle)

    #expect(started.status == .success)
    #expect(resumed.status == .success)
    #expect(resumed.snapshot?.runID == started.snapshot?.runID)
    #expect(firstEvents?.map(\.name) == [.runStarted, .runFollowUpReady])
    #expect(secondEvents?.map(\.name) == [.runResumed, .runFollowUpReady])

    #expect(await registry.closeSession(firstHandle))
    #expect(!(await registry.containsSession(firstHandle)))
    #expect(await registry.containsSession(secondHandle))
    #expect(await registry.activeHandles() == [secondHandle])
  }

  @Test
  func runtimeInterfaceRegistryReturnsSessionNotFoundForClosedHandles() async throws {
    let registry = PraxisRuntimeGatewayFactory.makeRuntimeInterfaceRegistry(
      hostAdapters: PraxisHostAdapterRegistry.scaffoldDefaults(),
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    )
    let handle = try await registry.openSession()

    #expect(await registry.closeSession(handle))
    #expect(await registry.bootstrapSnapshot(for: handle) == nil)
    #expect(await registry.snapshotEvents(for: handle) == nil)
    #expect(await registry.drainEvents(for: handle) == nil)

    let response = await registry.handle(.inspectArchitecture, on: handle)

    #expect(response.status == .failure)
    #expect(response.snapshot == nil)
    #expect(response.events.isEmpty)
    #expect(response.error?.code == .sessionNotFound)
    #expect(response.error?.message == "Runtime interface session handle \(handle.rawValue) was not found.")
    #expect(response.error?.retryable == false)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsRequestAndResponse() async throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.commitCmpFlow(
      .init(
        payloadSummary: "Commit interface flow",
        projectID: "cmp.codec.project",
        agentID: "runtime.codec",
        sessionID: "cmp.flow.codec",
        eventIDs: [
          runtimeInterfaceReferenceID("evt.codec.1"),
          runtimeInterfaceReferenceID("evt.codec.2")
        ],
        changeSummary: "Commit typed interface event references",
        syncIntent: .toParent
      )
    )
    let response = PraxisRuntimeInterfaceResponse(
      status: .success,
      snapshot: .init(
        kind: .run,
        title: "Run run:session.codec:goal.codec",
        summary: "Resumed running run run:session.codec:goal.codec.",
        runID: .init(rawValue: "run:session.codec:goal.codec"),
        sessionID: .init(rawValue: "session.codec"),
        phase: .running,
        tickCount: 2,
        lifecycleDisposition: .resumed,
        checkpointReference: runtimeInterfaceReferenceID("checkpoint.run:session.codec:goal.codec"),
        pendingIntentID: runtimeInterfaceReferenceID("evt.resumed.run:session.codec:goal.codec:resume"),
        recoveredEventCount: 1
      ),
      events: [
        .init(
          name: .runResumed,
          detail: "Resumed running run run:session.codec:goal.codec.",
          runID: .init(rawValue: "run:session.codec:goal.codec"),
          sessionID: .init(rawValue: "session.codec"),
          intentID: runtimeInterfaceReferenceID("evt.resumed.run:session.codec:goal.codec:resume")
        )
      ],
      error: nil
    )

    let requestData = try codec.encode(request)
    let requestJSON = String(decoding: requestData, as: UTF8.self)
    let decodedRequest = try codec.decodeRequest(requestData)
    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(
      requestJSON ==
        #"{"commitCmpFlow":{"agentID":"runtime.codec","changeSummary":"Commit typed interface event references","eventIDs":["evt.codec.1","evt.codec.2"],"payloadSummary":"Commit interface flow","projectID":"cmp.codec.project","sessionID":"cmp.flow.codec","syncIntent":"toParent"},"kind":"commitCmpFlow"}"#
    )
    #expect(responseJSON.contains(#""status":"success""#))
    #expect(!responseJSON.contains(#""error":"#))
    #expect(responseJSON.contains(#""snapshot":{"#))
    #expect(responseJSON.contains(#""checkpointReference":"checkpoint.run:session.codec:goal.codec""#))
    #expect(responseJSON.contains(#""pendingIntentID":"evt.resumed.run:session.codec:goal.codec:resume""#))
    #expect(responseJSON.contains(#""intentID":"evt.resumed.run:session.codec:goal.codec:resume""#))
    #expect(decodedResponse.snapshot?.checkpointReference == runtimeInterfaceReferenceID("checkpoint.run:session.codec:goal.codec"))
    #expect(decodedRequest == request)
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsTypedReferenceContinuationRequestsAsStableStrings() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let recoverRequest = PraxisRuntimeInterfaceRequest.recoverCmpProject(
      .init(
        payloadSummary: "Recover typed snapshot reference",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        reason: "Recover from typed reference",
        snapshotID: runtimeInterfaceReferenceID("snapshot.runtime.recover")
      )
    )
    let materializeRequest = PraxisRuntimeInterfaceRequest.materializeCmpFlow(
      .init(
        payloadSummary: "Materialize typed references",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        snapshotID: runtimeInterfaceReferenceID("snapshot.runtime.materialize"),
        projectionID: runtimeInterfaceReferenceID("projection.runtime.materialize"),
        packageKind: .runtimeFill,
        fidelityLabel: .highSignal
      )
    )
    let ingestRequest = PraxisRuntimeInterfaceRequest.ingestMp(
      .init(
        payloadSummary: "Ingest typed snapshot reference",
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: "mp.session",
        summary: "Store typed reference memory",
        checkedSnapshotRef: runtimeInterfaceReferenceID("snapshot.mp.runtime"),
        branchRef: "main"
      )
    )

    let recoverData = try codec.encode(recoverRequest)
    let materializeData = try codec.encode(materializeRequest)
    let ingestData = try codec.encode(ingestRequest)
    let recoverJSON = String(decoding: recoverData, as: UTF8.self)
    let materializeJSON = String(decoding: materializeData, as: UTF8.self)
    let ingestJSON = String(decoding: ingestData, as: UTF8.self)
    let decodedRecover = try codec.decodeRequest(recoverData)
    let decodedMaterialize = try codec.decodeRequest(materializeData)
    let decodedIngest = try codec.decodeRequest(ingestData)

    #expect(
      recoverJSON ==
        #"{"kind":"recoverCmpProject","recoverCmpProject":{"agentID":"runtime.local","packageKind":"historicalReply","payloadSummary":"Recover typed snapshot reference","projectID":"cmp.local-runtime","reason":"Recover from typed reference","snapshotID":"snapshot.runtime.recover","targetAgentID":"checker.local"}}"#
    )
    #expect(
      materializeJSON ==
        #"{"kind":"materializeCmpFlow","materializeCmpFlow":{"agentID":"runtime.local","fidelityLabel":"highSignal","packageKind":"runtimeFill","payloadSummary":"Materialize typed references","projectID":"cmp.local-runtime","projectionID":"projection.runtime.materialize","snapshotID":"snapshot.runtime.materialize","targetAgentID":"checker.local"}}"#
    )
    #expect(
      ingestJSON ==
        #"{"ingestMp":{"agentID":"runtime.local","branchRef":"main","checkedSnapshotRef":"snapshot.mp.runtime","confidence":"medium","memoryKind":"semantic","payloadSummary":"Ingest typed snapshot reference","projectID":"mp.local-runtime","scopeLevel":"agent_isolated","sessionID":"mp.session","sourceRefs":[],"summary":"Store typed reference memory","tags":[]},"kind":"ingestMp"}"#
    )
    #expect(decodedRecover == recoverRequest)
    #expect(decodedMaterialize == materializeRequest)
    #expect(decodedIngest == ingestRequest)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsMpWorkflowRequestsAsStableStrings() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let ingestRequest = PraxisRuntimeInterfaceRequest.ingestMp(
      .init(
        payloadSummary: "Ingest MP workflow memory",
        projectID: "mp.local-runtime",
        agentID: "runtime.local",
        sessionID: "mp.session",
        scopeLevel: .project,
        summary: "Store host-neutral MP workflow memory",
        checkedSnapshotRef: runtimeInterfaceReferenceID("snapshot.mp.runtime"),
        branchRef: "main",
        storageKey: "memory/primary",
        memoryKind: .summary,
        observedAt: "2026-04-13T10:00:00Z",
        capturedAt: "2026-04-13T10:01:00Z",
        semanticGroupID: "semantic.group.runtime",
        tags: ["host-neutral", "wire-shape"],
        sourceRefs: ["cmp://snapshot/runtime", "doc://memory/runtime"],
        confidence: .high
      )
    )
    let alignRequest = PraxisRuntimeInterfaceRequest.alignMp(
      .init(
        payloadSummary: "Align MP workflow memory",
        projectID: "mp.local-runtime",
        memoryID: "memory.primary",
        alignedAt: "2026-04-13T10:05:00Z",
        queryText: "verify onboarding summary"
      )
    )
    let promoteRequest = PraxisRuntimeInterfaceRequest.promoteMp(
      .init(
        payloadSummary: "Promote MP workflow memory",
        projectID: "mp.local-runtime",
        memoryID: "memory.primary",
        targetPromotionState: .acceptedByParent,
        targetSessionID: "mp.session",
        promotedAt: "2026-04-13T10:06:00Z",
        reason: "Promote stable onboarding memory"
      )
    )
    let archiveRequest = PraxisRuntimeInterfaceRequest.archiveMp(
      .init(
        payloadSummary: "Archive MP workflow memory",
        projectID: "mp.local-runtime",
        memoryID: "memory.primary",
        archivedAt: "2026-04-13T10:07:00Z",
        reason: "Superseded by project memory"
      )
    )
    let resolveRequest = PraxisRuntimeInterfaceRequest.resolveMp(
      .init(
        payloadSummary: "Resolve MP workflow bundle",
        projectID: "mp.local-runtime",
        query: "onboarding",
        requesterAgentID: "runtime.local",
        sessionID: "mp.session",
        scopeLevels: [.global, .project],
        limit: 7
      )
    )
    let historyRequest = PraxisRuntimeInterfaceRequest.requestMpHistory(
      .init(
        payloadSummary: "Request MP workflow history",
        projectID: "mp.local-runtime",
        requesterAgentID: "runtime.local",
        sessionID: "mp.session",
        reason: "Need historical MP context",
        query: "onboarding",
        scopeLevels: [.project, .agentIsolated],
        limit: 4
      )
    )

    let ingestData = try codec.encode(ingestRequest)
    let alignData = try codec.encode(alignRequest)
    let promoteData = try codec.encode(promoteRequest)
    let archiveData = try codec.encode(archiveRequest)
    let resolveData = try codec.encode(resolveRequest)
    let historyData = try codec.encode(historyRequest)

    let ingestJSON = String(decoding: ingestData, as: UTF8.self)
    let alignJSON = String(decoding: alignData, as: UTF8.self)
    let promoteJSON = String(decoding: promoteData, as: UTF8.self)
    let archiveJSON = String(decoding: archiveData, as: UTF8.self)
    let resolveJSON = String(decoding: resolveData, as: UTF8.self)
    let historyJSON = String(decoding: historyData, as: UTF8.self)

    let decodedIngest = try codec.decodeRequest(ingestData)
    let decodedAlign = try codec.decodeRequest(alignData)
    let decodedPromote = try codec.decodeRequest(promoteData)
    let decodedArchive = try codec.decodeRequest(archiveData)
    let decodedResolve = try codec.decodeRequest(resolveData)
    let decodedHistory = try codec.decodeRequest(historyData)

    #expect(
      ingestJSON ==
        #"{"ingestMp":{"agentID":"runtime.local","branchRef":"main","capturedAt":"2026-04-13T10:01:00Z","checkedSnapshotRef":"snapshot.mp.runtime","confidence":"high","memoryKind":"summary","observedAt":"2026-04-13T10:00:00Z","payloadSummary":"Ingest MP workflow memory","projectID":"mp.local-runtime","scopeLevel":"project","semanticGroupID":"semantic.group.runtime","sessionID":"mp.session","sourceRefs":["cmp:\/\/snapshot\/runtime","doc:\/\/memory\/runtime"],"storageKey":"memory\/primary","summary":"Store host-neutral MP workflow memory","tags":["host-neutral","wire-shape"]},"kind":"ingestMp"}"#
    )
    #expect(
      alignJSON ==
        #"{"alignMp":{"alignedAt":"2026-04-13T10:05:00Z","memoryID":"memory.primary","payloadSummary":"Align MP workflow memory","projectID":"mp.local-runtime","queryText":"verify onboarding summary"},"kind":"alignMp"}"#
    )
    #expect(
      promoteJSON ==
        #"{"kind":"promoteMp","promoteMp":{"memoryID":"memory.primary","payloadSummary":"Promote MP workflow memory","projectID":"mp.local-runtime","promotedAt":"2026-04-13T10:06:00Z","reason":"Promote stable onboarding memory","targetPromotionState":"accepted_by_parent","targetSessionID":"mp.session"}}"#
    )
    #expect(
      archiveJSON ==
        #"{"archiveMp":{"archivedAt":"2026-04-13T10:07:00Z","memoryID":"memory.primary","payloadSummary":"Archive MP workflow memory","projectID":"mp.local-runtime","reason":"Superseded by project memory"},"kind":"archiveMp"}"#
    )
    #expect(
      resolveJSON ==
        #"{"kind":"resolveMp","resolveMp":{"limit":7,"payloadSummary":"Resolve MP workflow bundle","projectID":"mp.local-runtime","query":"onboarding","requesterAgentID":"runtime.local","scopeLevels":["global","project"],"sessionID":"mp.session"}}"#
    )
    #expect(
      historyJSON ==
        #"{"kind":"requestMpHistory","requestMpHistory":{"limit":4,"payloadSummary":"Request MP workflow history","projectID":"mp.local-runtime","query":"onboarding","reason":"Need historical MP context","requesterAgentID":"runtime.local","scopeLevels":["project","agent_isolated"],"sessionID":"mp.session"}}"#
    )

    #expect(decodedIngest == ingestRequest)
    #expect(decodedAlign == alignRequest)
    #expect(decodedPromote == promoteRequest)
    #expect(decodedArchive == archiveRequest)
    #expect(decodedResolve == resolveRequest)
    #expect(decodedHistory == historyRequest)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsMpSearchReadbackAndSmokeRequestsAsStableStrings() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let searchRequest = PraxisRuntimeInterfaceRequest.searchMp(
      .init(
        payloadSummary: "Search MP neutral memory",
        projectID: " mp.local-runtime ",
        query: "onboarding",
        scopeLevels: [.project, .agentIsolated],
        limit: 7,
        agentID: "runtime.local",
        sessionID: " session.search ",
        includeSuperseded: true
      )
    )
    let readbackRequest = PraxisRuntimeInterfaceRequest.readbackMp(
      .init(
        payloadSummary: "Read back MP neutral memory",
        projectID: "\tmp.local-runtime\t",
        query: "",
        scopeLevels: [.project],
        limit: 8,
        agentID: "runtime.local",
        sessionID: " readback.session ",
        includeSuperseded: true
      )
    )
    let smokeRequest = PraxisRuntimeInterfaceRequest.smokeMp(
      .init(
        payloadSummary: "Smoke MP neutral surface",
        projectID: " smoke.project "
      )
    )

    let searchData = try codec.encode(searchRequest)
    let readbackData = try codec.encode(readbackRequest)
    let smokeData = try codec.encode(smokeRequest)

    let searchJSON = String(decoding: searchData, as: UTF8.self)
    let readbackJSON = String(decoding: readbackData, as: UTF8.self)
    let smokeJSON = String(decoding: smokeData, as: UTF8.self)

    let decodedSearch = try codec.decodeRequest(searchData)
    let decodedReadback = try codec.decodeRequest(readbackData)
    let decodedSmoke = try codec.decodeRequest(smokeData)

    #expect(
      searchJSON ==
        #"{"kind":"searchMp","searchMp":{"agentID":"runtime.local","includeSuperseded":true,"limit":7,"payloadSummary":"Search MP neutral memory","projectID":" mp.local-runtime ","query":"onboarding","scopeLevels":["project","agent_isolated"],"sessionID":" session.search "}}"#
    )
    #expect(
      readbackJSON ==
        #"{"kind":"readbackMp","readbackMp":{"agentID":"runtime.local","includeSuperseded":true,"limit":8,"payloadSummary":"Read back MP neutral memory","projectID":"\tmp.local-runtime\t","query":"","scopeLevels":["project"],"sessionID":" readback.session "}}"#
    )
    #expect(
      smokeJSON ==
        #"{"kind":"smokeMp","smokeMp":{"payloadSummary":"Smoke MP neutral surface","projectID":" smoke.project "}}"#
    )
    #expect(decodedSearch == searchRequest)
    #expect(decodedReadback == readbackRequest)
    #expect(decodedSmoke == smokeRequest)
  }

  @Test
  func runtimeInterfaceMapsOpaqueReferencesIntoTypedCmpAndMpDomainIDs() async throws {
    let recoverSnapshotID = PraxisCmpSnapshotID(rawValue: "snapshot.runtime.recover")
    let materializeSnapshotID = PraxisCmpSnapshotID(rawValue: "snapshot.runtime.materialize")
    let materializeProjectionID = PraxisCmpProjectionID(rawValue: "projection.runtime.materialize")
    let retryPackageID = PraxisCmpPackageID(rawValue: "package.runtime.retry")
    let checkedSnapshotRef = PraxisCmpSnapshotID(rawValue: "snapshot.mp.runtime")
    let committedEventIDs: [PraxisCmpEventID] = [
      .init(rawValue: "evt.runtime.1"),
      .init(rawValue: "evt.runtime.2"),
    ]

    let cmpFacade = makeStubCmpFacade(
      recoverCmpProject: { command in
        #expect(command.snapshotID == recoverSnapshotID)
        return PraxisCmpProjectRecovery(
          projectID: command.projectID,
          sourceAgentID: command.agentID,
          targetAgentID: command.targetAgentID,
          summary: "Recovered CMP project context.",
          status: .aligned,
          recoverySource: .historicalContext,
          foundHistoricalContext: true,
          snapshotID: command.snapshotID,
          packageID: .init(rawValue: "package.runtime.recover"),
          packageKind: command.packageKind,
          hydratedRecoverySummary: "Hydrated recovery can resume 1 projection(s).",
          resumableProjectionCount: 1,
          missingProjectionCount: 0,
          issues: []
        )
      },
      commitCmpFlow: { command in
        #expect(command.eventIDs == committedEventIDs)
        let delta = PraxisCmpContextDelta(
          id: .init(rawValue: "delta.runtime.commit"),
          agentID: command.agentID,
          eventRefs: command.eventIDs,
          changeSummary: command.changeSummary,
          createdAt: "2026-04-13T00:00:00Z",
          syncIntent: command.syncIntent
        )
        return PraxisCmpFlowCommit(
          projectID: command.projectID,
          agentID: command.agentID,
          summary: "Committed CMP flow delta.",
          result: .init(
            status: .accepted,
            delta: delta,
            snapshotCandidateID: .init(rawValue: "snapshot.runtime.candidate")
          ),
          snapshotCandidate: .init(
            id: .init(rawValue: "snapshot.runtime.candidate"),
            lineageID: .init(rawValue: "lineage.runtime"),
            agentID: command.agentID,
            branchRef: "cmp/runtime.local",
            commitRef: "commit.runtime",
            deltaRefs: [delta.id],
            createdAt: "2026-04-13T00:00:00Z",
            status: .pending
          ),
          activeLine: .init(
            lineageID: .init(rawValue: "lineage.runtime"),
            stage: .candidateReady,
            latestEventID: command.eventIDs.last,
            deltaID: delta.id,
            updatedAt: "2026-04-13T00:00:00Z"
          )
        )
      },
      materializeCmpFlow: { command in
        #expect(command.snapshotID == materializeSnapshotID)
        #expect(command.projectionID == materializeProjectionID)
        let contextPackage = PraxisCmpContextPackage(
          id: .init(rawValue: "package.runtime.materialize"),
          sourceProjectionID: try #require(command.projectionID),
          sourceSnapshotID: command.snapshotID,
          sourceAgentID: command.agentID,
          targetAgentID: command.targetAgentID,
          kind: command.packageKind,
          packageRef: "context://cmp.local-runtime/projection.runtime.materialize/checker.local/runtimeFill",
          fidelityLabel: command.fidelityLabel ?? .highSignal,
          createdAt: "2026-04-13T00:00:00Z",
          sourceSectionIDs: [.init(rawValue: "projection.runtime.materialize:section")]
        )
        return PraxisCmpFlowMaterialize(
          projectID: command.projectID,
          agentID: command.agentID,
          summary: "Materialized CMP flow package.",
          result: .init(status: .materialized, contextPackage: contextPackage),
          materializationPlan: .init(
            projectionID: try #require(command.projectionID),
            targetAgentID: command.targetAgentID,
            packageKind: command.packageKind,
            selectedSectionIDs: [.init(rawValue: "projection.runtime.materialize:section")],
            summary: "Selected one section."
          )
        )
      },
      retryCmpDispatch: { command in
        #expect(command.packageID == retryPackageID)
        return PraxisCmpFlowDispatch(
          projectID: command.projectID,
          agentID: command.agentID,
          summary: "Retried CMP dispatch.",
          result: .init(
            status: .dispatched,
            receipt: .init(
              id: .init(rawValue: "dispatch.runtime.retry"),
              packageID: command.packageID,
              sourceAgentID: command.agentID,
              targetAgentID: "checker.local",
              targetKind: .peer,
              status: .delivered,
              createdAt: "2026-04-13T00:00:00Z",
              deliveredAt: "2026-04-13T00:00:01Z"
            )
          ),
          deliveryPlan: .init(
            contextPackage: .init(
              id: command.packageID,
              sourceProjectionID: .init(rawValue: "projection.runtime.materialize"),
              sourceSnapshotID: .init(rawValue: "snapshot.runtime.materialize"),
              sourceAgentID: command.agentID,
              targetAgentID: "checker.local",
              kind: .runtimeFill,
              packageRef: "context://cmp.local-runtime/projection.runtime.materialize/checker.local/runtimeFill",
              fidelityLabel: .highSignal,
              createdAt: "2026-04-13T00:00:00Z",
              sourceSectionIDs: [.init(rawValue: "projection.runtime.materialize:section")]
            ),
            instructions: [
              .init(
                packageID: command.packageID,
                sourceAgentID: command.agentID,
                targetAgentID: "checker.local",
                targetKind: .peer,
                reason: command.reason ?? "Retry dispatch.",
                summary: "Retry dispatch."
              )
            ]
          )
        )
      }
    )
    let mpFacade = makeStubMpFacade(
      ingestMp: { command in
        #expect(command.checkedSnapshotRef == checkedSnapshotRef)
        return PraxisMpIngestResult(
          projectID: command.projectID,
          agentID: command.agentID,
          sessionID: command.sessionID,
          summary: "MP ingest stored 1 record update(s).",
          primaryMemoryID: "memory.primary",
          storageKey: "memory/primary",
          updatedMemoryIDs: ["memory.primary"],
          supersededMemoryIDs: [],
          staleMemoryIDs: [],
          decision: .keep,
          freshnessStatus: .fresh,
          alignmentStatus: .aligned,
          issues: []
        )
      }
    )
    let runtimeInterface = PraxisRuntimeInterfaceSession(
      runtimeFacade: .init(
        runFacade: makeUnexpectedRunFacade(),
        inspectionFacade: makeUnexpectedInspectionFacade(),
        mpFacade: mpFacade,
        cmpSessionFacade: cmpFacade.sessionFacade,
        cmpProjectFacade: cmpFacade.projectFacade,
        cmpFlowFacade: cmpFacade.flowFacade,
        cmpRolesFacade: cmpFacade.rolesFacade,
        cmpControlFacade: cmpFacade.controlFacade,
        cmpReadbackFacade: cmpFacade.readbackFacade
      ),
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
    )

    let recoverResponse = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.recoverCmpProject(
        PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload(
          payloadSummary: "Recover typed snapshot reference",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Recover from typed reference",
          snapshotID: runtimeInterfaceReferenceID(recoverSnapshotID.rawValue)
        )
      )
    )
    let commitResponse = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.commitCmpFlow(
        PraxisRuntimeInterfaceCommitCmpFlowRequestPayload(
          payloadSummary: "Commit typed interface event references",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          sessionID: "cmp.flow.runtime",
          eventIDs: committedEventIDs.map { runtimeInterfaceReferenceID($0.rawValue) },
          changeSummary: "Commit interface flow",
          syncIntent: PraxisCmpContextSyncIntent.toParent
        )
      )
    )
    let materializeResponse = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.materializeCmpFlow(
        PraxisRuntimeInterfaceMaterializeCmpFlowRequestPayload(
          payloadSummary: "Materialize typed references",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          snapshotID: runtimeInterfaceReferenceID(materializeSnapshotID.rawValue),
          projectionID: runtimeInterfaceReferenceID(materializeProjectionID.rawValue),
          packageKind: PraxisCmpContextPackageKind.runtimeFill,
          fidelityLabel: PraxisCmpContextPackageFidelityLabel.highSignal
        )
      )
    )
    let retryResponse = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.retryCmpDispatch(
        PraxisRuntimeInterfaceRetryCmpDispatchRequestPayload(
          payloadSummary: "Retry typed dispatch package",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          packageID: runtimeInterfaceReferenceID(retryPackageID.rawValue)
        )
      )
    )
    let ingestResponse = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.ingestMp(
        PraxisRuntimeInterfaceMpIngestRequestPayload(
          payloadSummary: "Ingest typed snapshot reference",
          projectID: "mp.local-runtime",
          agentID: "runtime.local",
          sessionID: "mp.session",
          summary: "Store typed reference memory",
          checkedSnapshotRef: runtimeInterfaceReferenceID(checkedSnapshotRef.rawValue),
          branchRef: "main"
        )
      )
    )

    #expect(recoverResponse.status == .success)
    #expect(recoverResponse.events.first?.intentID == runtimeInterfaceReferenceID("package.runtime.recover"))
    #expect(commitResponse.status == .success)
    #expect(commitResponse.events.first?.intentID == runtimeInterfaceReferenceID("delta.runtime.commit"))
    #expect(materializeResponse.status == .success)
    #expect(materializeResponse.events.first?.intentID == runtimeInterfaceReferenceID("package.runtime.materialize"))
    #expect(retryResponse.status == .success)
    #expect(retryResponse.events.first?.intentID == runtimeInterfaceReferenceID("dispatch.runtime.retry"))
    #expect(ingestResponse.status == .success)
  }

  @Test
  func runtimeInterfaceMapsCmpHistoryBoundaryQueryIntoDomainQuery() async throws {
    let expectedQuery = PraxisCmpHistoricalContextQuery(
      snapshotID: .init(rawValue: "snapshot.history.runtime"),
      lineageID: .init(rawValue: "lineage.history.runtime"),
      branchRef: .init(rawValue: "cmp/runtime"),
      packageKindHint: .historicalReply,
      projectionVisibilityHint: .acceptedByParent,
      metadata: [
        "reason": .string("recover"),
        "attempt": .number(2),
      ]
    )
    let cmpFacade = makeStubCmpFacade(
      requestCmpHistory: { command in
        #expect(command.projectID == "cmp.local-runtime")
        #expect(command.requesterAgentID == "checker.local")
        #expect(command.reason == "Recover focused context")
        #expect(command.query == expectedQuery)
        return PraxisCmpFlowHistory(
          projectID: command.projectID,
          requesterAgentID: command.requesterAgentID,
          summary: "Requested CMP history.",
          result: .init(status: .accepted, found: false, metadata: command.query.metadata)
        )
      }
    )
    let runtimeInterface = makeStubbedRuntimeInterface(cmpFacade: cmpFacade)

    let response = await runtimeInterface.handle(
      .requestCmpHistory(
        .init(
          payloadSummary: "Request history",
          projectID: "cmp.local-runtime",
          requesterAgentID: "checker.local",
          reason: "Recover focused context",
          query: .init(
            snapshotID: runtimeInterfaceReferenceID("snapshot.history.runtime"),
            lineageID: runtimeInterfaceReferenceID("lineage.history.runtime"),
            branchRef: "cmp/runtime",
            packageKindHint: .historicalReply,
            projectionVisibilityHint: .acceptedByParent,
            metadata: [
              "reason": .string("recover"),
              "attempt": .number(2),
            ]
          )
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.snapshot?.kind == .cmpFlow)
    #expect(response.snapshot?.projectID == "cmp.local-runtime")
  }

  @Test
  func runtimeInterfaceMapsCmpLineageReferencePayloadsIntoDomainIDsWithoutCanonicalizing() async throws {
    let expectedLineage = PraxisCmpLineageID(rawValue: "  lineage.runtime  ")
    let cmpFacade = makeStubCmpFacade(
      recoverCmpProject: { command in
        #expect(command.lineageID == expectedLineage)
        return PraxisCmpProjectRecovery(
          projectID: command.projectID,
          sourceAgentID: command.agentID,
          targetAgentID: command.targetAgentID,
          summary: "Recovered CMP project.",
          status: .aligned,
          recoverySource: .historicalContext,
          foundHistoricalContext: true,
          snapshotID: .init(rawValue: "snapshot.runtime.recover"),
          packageID: .init(rawValue: "package.runtime.recover"),
          packageKind: command.packageKind,
          hydratedRecoverySummary: "Hydrated one projection.",
          resumableProjectionCount: 1,
          missingProjectionCount: 0,
          issues: []
        )
      }
    )
    let runtimeInterface = makeStubbedRuntimeInterface(cmpFacade: cmpFacade)

    let response = await runtimeInterface.handle(
      PraxisRuntimeInterfaceRequest.recoverCmpProject(
        PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload(
          payloadSummary: "Recover lineage reference",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Preserve opaque lineage reference",
          lineageID: runtimeInterfaceReferenceID(expectedLineage.rawValue)
        )
      )
    )

    #expect(response.status == .success)
    #expect(response.error == nil)
    #expect(response.snapshot?.kind == .cmpRecover)
  }

  @Test
  func runtimeInterfaceRoutesCmpLineagePayloadsThroughUnifiedOptionalTypedInitializers() async throws {
    let expectedRecoverLineage = PraxisCmpLineageID(rawValue: "lineage.recover.runtime")
    let expectedCommitLineage = PraxisCmpLineageID(rawValue: "lineage.commit.runtime")
    let expectedRecoverBranchRef = PraxisCmpRefName(rawValue: "cmp/recover.runtime")
    let expectedCommitBaseRef = PraxisCmpRefName(rawValue: "main")
    let expectedResolveBranchRef = PraxisCmpRefName(rawValue: "cmp/resolve.runtime")
    let commitEventID = PraxisCmpEventID(rawValue: "event.runtime.1")
    let cmpFacade = makeStubCmpFacade(
      recoverCmpProject: { command in
        #expect(command.lineageID == expectedRecoverLineage)
        #expect(command.branchRef == expectedRecoverBranchRef)
        return PraxisCmpProjectRecovery(
          projectID: command.projectID,
          sourceAgentID: command.agentID,
          targetAgentID: command.targetAgentID,
          summary: "Recovered CMP project.",
          status: .aligned,
          recoverySource: .historicalContext,
          foundHistoricalContext: true,
          packageID: .init(rawValue: "package.runtime.recover"),
          packageKind: command.packageKind,
          hydratedRecoverySummary: "Hydrated one projection.",
          resumableProjectionCount: 1,
          missingProjectionCount: 0,
          issues: []
        )
      },
      ingestCmpFlow: { command in
        #expect(command.lineageID == nil)
        return PraxisCmpFlowIngest(
          projectID: command.projectID,
          agentID: command.agentID,
          sessionID: command.sessionID,
          summary: "Ingested CMP flow.",
          requestID: .init(rawValue: "request.runtime.ingest"),
          result: .init(
            status: .accepted,
            acceptedEventIDs: [commitEventID],
            nextAction: .noop
          ),
          ingress: .init(
            request: .init(
              requestID: .init(rawValue: "request.runtime.ingest"),
              lineageID: .init(rawValue: "lineage.runtime.ingest"),
              taskSummary: command.taskSummary,
              createdAt: "2026-04-13T00:00:00Z"
            ),
            sections: [],
            requiresActiveSync: command.requiresActiveSync
          ),
          loweredSections: [],
          roleAssignments: []
        )
      },
      commitCmpFlow: { command in
        #expect(command.lineageID == expectedCommitLineage)
        #expect(command.baseRef == expectedCommitBaseRef)
        let delta = PraxisCmpContextDelta(
          id: .init(rawValue: "delta.runtime.commit"),
          agentID: command.agentID,
          eventRefs: command.eventIDs,
          changeSummary: command.changeSummary,
          createdAt: "2026-04-13T00:00:00Z",
          syncIntent: command.syncIntent
        )
        return PraxisCmpFlowCommit(
          projectID: command.projectID,
          agentID: command.agentID,
          summary: "Committed CMP flow delta.",
          result: .init(
            status: .accepted,
            delta: delta,
            snapshotCandidateID: .init(rawValue: "snapshot.runtime.candidate")
          ),
          snapshotCandidate: .init(
            id: .init(rawValue: "snapshot.runtime.candidate"),
            lineageID: expectedCommitLineage,
            agentID: command.agentID,
            branchRef: "cmp/runtime.local",
            commitRef: "commit.runtime",
            deltaRefs: [delta.id],
            createdAt: "2026-04-13T00:00:00Z",
            status: .pending
          ),
          activeLine: .init(
            lineageID: expectedCommitLineage,
            stage: .candidateReady,
            latestEventID: command.eventIDs.last,
            deltaID: delta.id,
            updatedAt: "2026-04-13T00:00:00Z"
          )
        )
      },
      resolveCmpFlow: { command in
        #expect(command.lineageID == nil)
        #expect(command.branchRef == expectedResolveBranchRef)
        return PraxisCmpFlowResolve(
          projectID: command.projectID,
          agentID: command.agentID,
          summary: "Resolved CMP flow.",
          result: .init(
            status: .notFound,
            found: false
          ),
          snapshot: nil
        )
      }
    )
    let runtimeInterface = makeStubbedRuntimeInterface(cmpFacade: cmpFacade)

    let recoverResponse = await runtimeInterface.handle(
      .recoverCmpProject(
        .init(
          payloadSummary: "Recover typed optional lineage",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          targetAgentID: "checker.local",
          reason: "Recover through unified initializer",
          lineageID: runtimeInterfaceReferenceID(expectedRecoverLineage.rawValue),
          branchRef: expectedRecoverBranchRef.rawValue
        )
      )
    )
    let ingestResponse = await runtimeInterface.handle(
      .ingestCmpFlow(
        .init(
          payloadSummary: "Ingest omitted lineage",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          sessionID: "cmp.session.runtime",
          taskSummary: "Ingest through unified initializer",
          materials: [
            .init(kind: .userInput, ref: "payload:user:runtime-interface")
          ]
        )
      )
    )
    let commitResponse = await runtimeInterface.handle(
      .commitCmpFlow(
        .init(
          payloadSummary: "Commit typed optional lineage",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          sessionID: "cmp.session.runtime",
          lineageID: runtimeInterfaceReferenceID(expectedCommitLineage.rawValue),
          eventIDs: [runtimeInterfaceReferenceID(commitEventID.rawValue)],
          baseRef: expectedCommitBaseRef.rawValue,
          changeSummary: "Commit through unified initializer",
          syncIntent: .toParent
        )
      )
    )
    let resolveResponse = await runtimeInterface.handle(
      .resolveCmpFlow(
        .init(
          payloadSummary: "Resolve omitted lineage",
          projectID: "cmp.local-runtime",
          agentID: "runtime.local",
          branchRef: expectedResolveBranchRef.rawValue
        )
      )
    )

    #expect(recoverResponse.status == .success)
    #expect(recoverResponse.error == nil)
    #expect(ingestResponse.status == .success)
    #expect(ingestResponse.error == nil)
    #expect(commitResponse.status == .success)
    #expect(commitResponse.error == nil)
    #expect(resolveResponse.status == .success)
    #expect(resolveResponse.error == nil)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsTypedEventNamesAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse(
      status: .success,
      snapshot: .init(
        kind: .inspection,
        title: "Runtime Event Names",
        summary: "Verify typed runtime interface event names preserve raw JSON values."
      ),
      events: [
        .init(
          name: .cmpSessionOpened,
          detail: "Opened CMP session.",
          sessionID: .init(rawValue: "cmp.session.codec")
        ),
        .init(
          name: .runFollowUpReady,
          detail: "model_inference: next",
          runID: .init(rawValue: "run:session.codec:goal.codec"),
          sessionID: .init(rawValue: "session.codec"),
          intentID: runtimeInterfaceReferenceID("evt.follow-up")
        )
      ]
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""name":"cmp.session.opened""#))
    #expect(responseJSON.contains(#""name":"run.follow_up_ready""#))
    #expect(responseJSON.contains(#""intentID":"evt.follow-up""#))
    #expect(decodedResponse.events.map(\.name) == [.cmpSessionOpened, .runFollowUpReady])
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedEventNames() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[{"detail":"Unknown runtime event.","name":"run.unknown","runID":"run:session.codec:goal.codec","sessionID":"session.codec"}],"snapshot":{"kind":"inspection","summary":"Verify typed runtime interface event name decoding rejects unknown raw values.","title":"Runtime Event Names"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRoundTripsTypedCmpSnapshotFieldsAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Dispatch cmp.local-runtime",
        summary: "Typed CMP flow snapshot",
        projectID: "cmp.local-runtime",
        nextAction: .commitContextDelta,
        activeLineStage: .candidateReady,
        qualityLabel: .usable,
        packageKind: .runtimeFill,
        targetKind: .peer,
        dispatchStatus: .delivered,
        latestDispatchStatus: .retryScheduled,
        roleCounts: .init(counts: [.dispatcher: 1]),
        roleStages: .init(stages: [.dispatcher: .retryScheduled])
      )
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""nextAction":"commit_context_delta""#))
    #expect(responseJSON.contains(#""activeLineStage":"candidateReady""#))
    #expect(responseJSON.contains(#""qualityLabel":"usable""#))
    #expect(responseJSON.contains(#""packageKind":"runtimeFill""#))
    #expect(responseJSON.contains(#""targetKind":"peer""#))
    #expect(responseJSON.contains(#""dispatchStatus":"delivered""#))
    #expect(responseJSON.contains(#""latestDispatchStatus":"retryScheduled""#))
    #expect(responseJSON.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(responseJSON.contains(#""roleStages":{"dispatcher":"retryScheduled"}"#))
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsTypedTapAndApprovalSnapshotFieldsAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let tapStatusResponse = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .tapStatus,
        title: "TAP Status cmp.local-runtime",
        summary: "Typed TAP status snapshot",
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        capabilityKey: capabilityID("tool.shell.exec"),
        tapMode: .restricted,
        riskLevel: .risky,
        humanGateState: .waitingApproval,
        decisionSummary: "Waiting for approval."
      )
    )
    let tapHistoryResponse = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .tapHistory,
        title: "TAP History cmp.local-runtime",
        summary: "Typed TAP history snapshot",
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        tapHistoryTotalCount: 1,
        tapHistoryEntries: [
          .init(
            agentID: "checker.local",
            targetAgentID: "runtime.local",
            capabilityKey: capabilityID("tool.shell.exec"),
            requestedTier: .b2,
            route: .humanReview,
            outcome: .escalatedToHuman,
            humanGateState: .waitingApproval,
            updatedAt: "2026-04-12T00:00:00Z",
            decisionSummary: "Escalated for review."
          )
        ]
      )
    )
    let approvalResponse = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpApproval,
        title: "CMP Approval cmp.local-runtime",
        summary: "Typed CMP approval snapshot",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: capabilityID("tool.shell.exec"),
        requestedTier: .b2,
        route: .humanReview,
        outcome: .approvedByHuman,
        tapMode: .restricted,
        riskLevel: .risky,
        humanGateState: .approved,
        requestedAt: "2026-04-12T00:05:00Z",
        decisionSummary: "Approved by reviewer.local."
      )
    )

    let encodedTapStatus = try codec.encode(tapStatusResponse)
    let encodedTapHistory = try codec.encode(tapHistoryResponse)
    let encodedApproval = try codec.encode(approvalResponse)
    let tapStatusJSON = String(decoding: encodedTapStatus, as: UTF8.self)
    let tapHistoryJSON = String(decoding: encodedTapHistory, as: UTF8.self)
    let approvalJSON = String(decoding: encodedApproval, as: UTF8.self)
    let decodedTapStatus = try codec.decodeResponse(encodedTapStatus)
    let decodedTapHistory = try codec.decodeResponse(encodedTapHistory)
    let decodedApproval = try codec.decodeResponse(encodedApproval)

    #expect(tapStatusJSON.contains(#""tapMode":"restricted""#))
    #expect(tapStatusJSON.contains(#""riskLevel":"risky""#))
    #expect(tapStatusJSON.contains(#""humanGateState":"waitingApproval""#))
    #expect(decodedTapStatus.snapshot?.tapMode == .restricted)
    #expect(decodedTapStatus.snapshot?.riskLevel == .risky)
    #expect(decodedTapStatus.snapshot?.humanGateState == .waitingApproval)

    #expect(tapHistoryJSON.contains(#""tapHistoryEntries":[{"agentID":"checker.local","capabilityKey":"tool.shell.exec","decisionSummary":"Escalated for review.","humanGateState":"waitingApproval","outcome":"escalated_to_human","requestedTier":"B2","route":"humanReview","targetAgentID":"runtime.local","updatedAt":"2026-04-12T00:00:00Z"}]"#))
    #expect(decodedTapHistory.snapshot?.tapHistoryTotalCount == 1)
    #expect(decodedTapHistory.snapshot?.tapHistoryEntries?.first?.requestedTier == .b2)
    #expect(decodedTapHistory.snapshot?.tapHistoryEntries?.first?.route == .humanReview)
    #expect(decodedTapHistory.snapshot?.tapHistoryEntries?.first?.outcome == .escalatedToHuman)

    #expect(approvalJSON.contains(#""requestedTier":"B2""#))
    #expect(approvalJSON.contains(#""route":"humanReview""#))
    #expect(approvalJSON.contains(#""outcome":"approved_by_human""#))
    #expect(approvalJSON.contains(#""tapMode":"restricted""#))
    #expect(approvalJSON.contains(#""riskLevel":"risky""#))
    #expect(approvalJSON.contains(#""humanGateState":"approved""#))
    #expect(decodedApproval.snapshot?.requestedTier == .b2)
    #expect(decodedApproval.snapshot?.route == .humanReview)
    #expect(decodedApproval.snapshot?.outcome == .approvedByHuman)
    #expect(decodedApproval.snapshot?.tapMode == .restricted)
    #expect(decodedApproval.snapshot?.riskLevel == .risky)
    #expect(decodedApproval.snapshot?.humanGateState == .approved)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsNoopCmpFlowNextActionAsStableRawValue() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpFlow,
        title: "CMP Ingest cmp.local-runtime",
        summary: "Typed CMP flow snapshot",
        projectID: "cmp.local-runtime",
        nextAction: .noop
      )
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""nextAction":"noop""#))
    #expect(decodedResponse.snapshot?.nextAction == .noop)
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsTypedCmpProjectSurfaceAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpProject,
        title: "CMP Project cmp.local-runtime",
        summary: "Typed CMP project snapshot",
        projectID: "cmp.local-runtime",
        hostProfile: .init(
          executionStyle: .localFirst,
          structuredStore: .sqlite,
          deliveryStore: .sqlite,
          messageTransport: .inProcessActorBus,
          gitAccess: .systemGit,
          semanticIndex: .localSemanticIndex
        ),
        componentStatuses: .init(
          statuses: [
            .structuredStore: .ready,
            .gitExecutor: .degraded,
          ]
        )
      )
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"in_process_actor_bus","semanticIndex":"local_semantic_index","structuredStore":"sqlite"}"#))
    #expect(responseJSON.contains(#""componentStatuses":{"gitExecutor":"degraded","structuredStore":"ready"}"#))
    #expect(decodedResponse.snapshot?.kind == .cmpProject)
    #expect(decodedResponse.snapshot?.hostProfile?.executionStyle == .localFirst)
    #expect(decodedResponse.snapshot?.hostProfile?.gitAccess == .systemGit)
    #expect(decodedResponse.snapshot?.componentStatuses?[.structuredStore] == .ready)
    #expect(decodedResponse.snapshot?.componentStatuses?[.gitExecutor] == .degraded)
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedCmpRoleStageFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[],"snapshot":{"kind":"cmpRoles","projectID":"cmp.local-runtime","roleStages":{"dispatcher":"broken_stage"},"summary":"Typed CMP roles snapshot","title":"CMP Roles cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedCmpFlowNextActionFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[],"snapshot":{"kind":"cmpFlow","nextAction":"broken_action","projectID":"cmp.local-runtime","summary":"Typed CMP flow snapshot","title":"CMP Ingest cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedCmpProjectHostProfileFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[],"snapshot":{"componentStatuses":{"structuredStore":"ready"},"hostProfile":{"deliveryStore":"sqlite","executionStyle":"local-first","gitAccess":"system_git","messageTransport":"broken_transport","semanticIndex":"local_semantic_index","structuredStore":"sqlite"},"kind":"cmpProject","projectID":"cmp.local-runtime","summary":"Typed CMP project snapshot","title":"CMP Project cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedApprovalAndTapFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let invalidApprovalRouteJSON =
      #"{"error":null,"events":[],"snapshot":{"capabilityKey":"tool.shell.exec","humanGateState":"approved","kind":"cmpApproval","outcome":"approved_by_human","projectID":"cmp.local-runtime","requestedTier":"B2","riskLevel":"risky","route":"not_a_real_route","summary":"Typed CMP approval snapshot","tapMode":"restricted","title":"CMP Approval cmp.local-runtime"},"status":"success"}"#
    let invalidTapHistoryRouteJSON =
      #"{"error":null,"events":[],"snapshot":{"kind":"tapHistory","projectID":"cmp.local-runtime","summary":"Typed TAP history snapshot","tapHistoryEntries":[{"agentID":"checker.local","capabilityKey":"tool.shell.exec","decisionSummary":"Escalated for review.","humanGateState":"waitingApproval","outcome":"escalated_to_human","requestedTier":"B2","route":"not_a_real_route","targetAgentID":"runtime.local","updatedAt":"2026-04-12T00:00:00Z"}],"tapHistoryTotalCount":1,"title":"TAP History cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(invalidApprovalRouteJSON.utf8))
    }
    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(invalidTapHistoryRouteJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRoundTripsCmpRoleCountParityFieldsAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpStatus,
        title: "CMP Status cmp.local-runtime",
        summary: "Typed CMP status snapshot",
        projectID: "cmp.local-runtime",
        latestDispatchStatus: .retryScheduled,
        packageStatusCounts: .init(counts: [.dispatched: 1]),
        roleCounts: .init(counts: [.dispatcher: 1]),
        roleStages: .init(stages: [.dispatcher: .retryScheduled])
      )
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""packageStatusCounts":{"dispatched":1}"#))
    #expect(responseJSON.contains(#""roleCounts":{"dispatcher":1}"#))
    #expect(responseJSON.contains(#""roleStages":{"dispatcher":"retryScheduled"}"#))
    #expect(decodedResponse.snapshot?.kind == .cmpStatus)
    #expect(decodedResponse.snapshot?.packageStatusCounts?[.dispatched] == 1)
    #expect(decodedResponse.snapshot?.roleCounts?[.dispatcher] == 1)
    #expect(decodedResponse.snapshot?.roleStages?[.dispatcher] == .retryScheduled)
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedCmpRoleCountFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[],"snapshot":{"kind":"cmpStatus","packageStatusCounts":{"dispatched":1},"projectID":"cmp.local-runtime","roleCounts":{"ghost":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"Typed CMP status snapshot","title":"CMP Status cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRejectsUnknownTypedCmpPackageStatusCountFields() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let responseJSON =
      #"{"error":null,"events":[],"snapshot":{"kind":"cmpStatus","packageStatusCounts":{"broken_status":1},"projectID":"cmp.local-runtime","roleCounts":{"dispatcher":1},"roleStages":{"dispatcher":"retryScheduled"},"summary":"Typed CMP status snapshot","title":"CMP Status cmp.local-runtime"},"status":"success"}"#

    #expect(throws: DecodingError.self) {
      _ = try codec.decodeResponse(Data(responseJSON.utf8))
    }
  }

  @Test
  func runtimeInterfaceCodecRoundTripsCmpRecoveryTypedSnapshotFieldsAsStableRawValues() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let response = PraxisRuntimeInterfaceResponse.success(
      snapshot: .init(
        kind: .cmpRecover,
        title: "CMP Recover cmp.local-runtime",
        summary: "Typed CMP recovery snapshot",
        projectID: "cmp.local-runtime",
        packageKind: .historicalReply,
        recoveryStatus: .aligned
      )
    )

    let responseData = try codec.encode(response)
    let responseJSON = String(decoding: responseData, as: UTF8.self)
    let decodedResponse = try codec.decodeResponse(responseData)

    #expect(responseJSON.contains(#""packageKind":"historicalReply""#))
    #expect(responseJSON.contains(#""recoveryStatus":"aligned""#))
    #expect(decodedResponse == response)
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpProjectRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.readbackCmpProject(
      .init(
        payloadSummary: "Read back project",
        projectID: "cmp.local-runtime"
      )
    )

    let requestData = try codec.encode(request)
    let requestJSON = String(decoding: requestData, as: UTF8.self)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(
      requestJSON ==
        #"{"kind":"readbackCmpProject","readbackCmpProject":{"payloadSummary":"Read back project","projectID":"cmp.local-runtime"}}"#
    )
    #expect(decodedRequest == request)
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpBootstrapRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.bootstrapCmpProject(
      .init(
        payloadSummary: "Bootstrap project",
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local",
        repoName: "praxis",
        defaultBranchName: "main",
        databaseName: "cmp_local_runtime",
        namespaceRoot: "cmp/cmp.local-runtime"
      )
    )

    let requestData = try codec.encode(request)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(decodedRequest == request)
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpFlowRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let ingestRequest = PraxisRuntimeInterfaceRequest.ingestCmpFlow(
      .init(
        payloadSummary: "Ingest flow",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.session",
        taskSummary: "Capture input",
        materials: [
          .init(kind: .userInput, ref: "payload:user:cmp")
        ],
        requiresActiveSync: true
      )
    )
    let historyRequest = PraxisRuntimeInterfaceRequest.requestCmpHistory(
      .init(
        payloadSummary: "Request history",
        projectID: "cmp.local-runtime",
        requesterAgentID: "checker.local",
        reason: "Recover context",
        query: .init(
          snapshotID: .init(rawValue: "projection.runtime.local:checked"),
          packageKindHint: .historicalReply
        )
      )
    )
    let retryRequest = PraxisRuntimeInterfaceRequest.retryCmpDispatch(
      .init(
        payloadSummary: "Retry dispatch",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        packageID: runtimeInterfaceReferenceID("projection.runtime.local:checker.local:runtimeFill"),
        reason: "Retry after approval"
      )
    )

    let ingestData = try codec.encode(ingestRequest)
    let historyData = try codec.encode(historyRequest)
    let retryData = try codec.encode(retryRequest)
    let historyJSON = String(decoding: historyData, as: UTF8.self)
    let retryJSON = String(decoding: retryData, as: UTF8.self)
    let decodedIngestRequest = try codec.decodeRequest(ingestData)
    let decodedHistoryRequest = try codec.decodeRequest(historyData)
    let decodedRetryRequest = try codec.decodeRequest(retryData)

    #expect(
      historyJSON ==
        #"{"kind":"requestCmpHistory","requestCmpHistory":{"payloadSummary":"Request history","projectID":"cmp.local-runtime","query":{"metadata":{},"packageKindHint":"historicalReply","snapshotID":"projection.runtime.local:checked"},"reason":"Recover context","requesterAgentID":"checker.local"}}"#
    )
    #expect(
      retryJSON ==
        #"{"kind":"retryCmpDispatch","retryCmpDispatch":{"agentID":"runtime.local","packageID":"projection.runtime.local:checker.local:runtimeFill","payloadSummary":"Retry dispatch","projectID":"cmp.local-runtime","reason":"Retry after approval"}}"#
    )
    #expect(decodedIngestRequest == ingestRequest)
    #expect(decodedHistoryRequest == historyRequest)
    #expect(decodedRetryRequest == retryRequest)
  }

  @Test
  func runtimeInterfaceCodecRoundTripsCmpHistoryBoundaryQueryAsStableStrings() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.requestCmpHistory(
      .init(
        payloadSummary: "Request history boundary",
        projectID: "cmp.local-runtime",
        requesterAgentID: "checker.local",
        reason: "Recover boundary context",
        query: .init(
          snapshotID: runtimeInterfaceReferenceID("snapshot.history.runtime"),
          lineageID: runtimeInterfaceReferenceID("lineage.history.runtime"),
          branchRef: "cmp/runtime",
          packageKindHint: .historicalReply,
          projectionVisibilityHint: .acceptedByParent,
          metadata: [
            "reason": .string("recover"),
            "attempt": .number(2),
          ]
        )
      )
    )

    let requestData = try codec.encode(request)
    let requestJSON = String(decoding: requestData, as: UTF8.self)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(
      requestJSON ==
        #"{"kind":"requestCmpHistory","requestCmpHistory":{"payloadSummary":"Request history boundary","projectID":"cmp.local-runtime","query":{"branchRef":"cmp\/runtime","lineageID":"lineage.history.runtime","metadata":{"attempt":2,"reason":"recover"},"packageKindHint":"historicalReply","projectionVisibilityHint":"acceptedByParent","snapshotID":"snapshot.history.runtime"},"reason":"Recover boundary context","requesterAgentID":"checker.local"}}"#
    )
    #expect(decodedRequest == request)
    if case .requestCmpHistory(let payload) = decodedRequest {
      #expect(
        payload.query ==
          .init(
            snapshotID: runtimeInterfaceReferenceID("snapshot.history.runtime"),
            lineageID: runtimeInterfaceReferenceID("lineage.history.runtime"),
            branchRef: .init(rawValue: "cmp/runtime"),
            packageKindHint: .historicalReply,
            projectionVisibilityHint: .acceptedByParent,
            metadata: [
              "reason": .string("recover"),
              "attempt": .number(2),
            ]
          )
      )
    } else {
      Issue.record("Expected requestCmpHistory payload.")
    }
  }

  @Test
  func runtimeInterfaceCodecRoundTripsCmpLineageReferencePayloadsAsStableStrings() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let recoverRequest = PraxisRuntimeInterfaceRequest.recoverCmpProject(
      .init(
        payloadSummary: "Recover lineage payload",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        reason: "Recover lineage state",
        lineageID: runtimeInterfaceReferenceID("lineage.recover.runtime"),
        branchRef: "cmp/recover",
        snapshotID: runtimeInterfaceReferenceID("snapshot.recover.runtime"),
        packageKind: .historicalReply,
        fidelityLabel: .highSignal
      )
    )
    let ingestRequest = PraxisRuntimeInterfaceRequest.ingestCmpFlow(
      .init(
        payloadSummary: "Ingest lineage payload",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.session.runtime",
        runID: "run.runtime",
        lineageID: runtimeInterfaceReferenceID("lineage.ingest.runtime"),
        parentAgentID: "planner.local",
        taskSummary: "Ingest runtime context",
        materials: [],
        requiresActiveSync: true
      )
    )
    let commitRequest = PraxisRuntimeInterfaceRequest.commitCmpFlow(
      .init(
        payloadSummary: "Commit lineage payload",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.session.runtime",
        runID: "run.runtime",
        lineageID: runtimeInterfaceReferenceID("lineage.commit.runtime"),
        parentAgentID: "planner.local",
        eventIDs: [runtimeInterfaceReferenceID("event.runtime.1")],
        baseRef: "main",
        changeSummary: "Commit runtime change",
        syncIntent: .toParent
      )
    )
    let resolveRequest = PraxisRuntimeInterfaceRequest.resolveCmpFlow(
      .init(
        payloadSummary: "Resolve lineage payload",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        lineageID: runtimeInterfaceReferenceID("lineage.resolve.runtime"),
        branchRef: "cmp/resolve"
      )
    )

    let recoverData = try codec.encode(recoverRequest)
    let ingestData = try codec.encode(ingestRequest)
    let commitData = try codec.encode(commitRequest)
    let resolveData = try codec.encode(resolveRequest)
    let recoverJSON = String(decoding: recoverData, as: UTF8.self)
    let ingestJSON = String(decoding: ingestData, as: UTF8.self)
    let commitJSON = String(decoding: commitData, as: UTF8.self)
    let resolveJSON = String(decoding: resolveData, as: UTF8.self)
    let decodedRecoverRequest = try codec.decodeRequest(recoverData)
    let decodedIngestRequest = try codec.decodeRequest(ingestData)
    let decodedCommitRequest = try codec.decodeRequest(commitData)
    let decodedResolveRequest = try codec.decodeRequest(resolveData)

    #expect(recoverJSON.contains(#""lineageID":"lineage.recover.runtime""#))
    #expect(recoverJSON.contains(#""branchRef":"cmp\/recover""#))
    #expect(ingestJSON.contains(#""lineageID":"lineage.ingest.runtime""#))
    #expect(commitJSON.contains(#""lineageID":"lineage.commit.runtime""#))
    #expect(commitJSON.contains(#""baseRef":"main""#))
    #expect(resolveJSON.contains(#""lineageID":"lineage.resolve.runtime""#))
    #expect(resolveJSON.contains(#""branchRef":"cmp\/resolve""#))
    #expect(decodedRecoverRequest == recoverRequest)
    #expect(decodedIngestRequest == ingestRequest)
    #expect(decodedCommitRequest == commitRequest)
    #expect(decodedResolveRequest == resolveRequest)
    if case .recoverCmpProject(let payload) = decodedRecoverRequest {
      #expect(payload.branchRef == .init(rawValue: "cmp/recover"))
    } else {
      Issue.record("Expected recoverCmpProject payload.")
    }
    if case .commitCmpFlow(let payload) = decodedCommitRequest {
      #expect(payload.baseRef == .init(rawValue: "main"))
    } else {
      Issue.record("Expected commitCmpFlow payload.")
    }
    if case .resolveCmpFlow(let payload) = decodedResolveRequest {
      #expect(payload.branchRef == .init(rawValue: "cmp/resolve"))
    } else {
      Issue.record("Expected resolveCmpFlow payload.")
    }
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpStatusRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.readbackCmpStatus(
      .init(
        payloadSummary: "Read back status",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local"
      )
    )

    let requestData = try codec.encode(request)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(decodedRequest == request)
  }

  @Test
  func runtimeInterfaceCodecEncodesTapStatusRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.readbackTapStatus(
      .init(
        payloadSummary: "Read back TAP status",
        projectID: "cmp.local-runtime",
        agentID: "checker.local"
      )
    )

    let requestData = try codec.encode(request)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(decodedRequest == request)
  }

  @Test
  func runtimeInterfaceCodecEncodesTapHistoryRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.readbackTapHistory(
      .init(
        payloadSummary: "Read back TAP history",
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        limit: 5
      )
    )

    let requestData = try codec.encode(request)
    let decodedRequest = try codec.decodeRequest(requestData)

    #expect(decodedRequest == request)
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpRolesAndControlRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let rolesRequest = PraxisRuntimeInterfaceRequest.readbackCmpRoles(
      .init(
        payloadSummary: "Read back roles",
        projectID: "cmp.local-runtime",
        agentID: "checker.local"
      )
    )
    let controlRequest = PraxisRuntimeInterfaceRequest.readbackCmpControl(
      .init(
        payloadSummary: "Read back control",
        projectID: "cmp.local-runtime",
        agentID: "checker.local"
      )
    )
    let updateRequest = PraxisRuntimeInterfaceRequest.updateCmpControl(
      .init(
        payloadSummary: "Update control",
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: .manual,
        mode: .peerReview,
        readbackPriority: .packageFirst,
        fallbackPolicy: .registryOnly,
        recoveryPreference: .resumeLatest,
        automation: .init(values: [.autoDispatch: false])
      )
    )

    let rolesData = try codec.encode(rolesRequest)
    let controlData = try codec.encode(controlRequest)
    let updateData = try codec.encode(updateRequest)
    let decodedRolesRequest = try codec.decodeRequest(rolesData)
    let decodedControlRequest = try codec.decodeRequest(controlData)
    let decodedUpdateRequest = try codec.decodeRequest(updateData)
    let updateJSON = try #require(String(data: updateData, encoding: .utf8))

    #expect(decodedRolesRequest == rolesRequest)
    #expect(decodedControlRequest == controlRequest)
    #expect(decodedUpdateRequest == updateRequest)
    #expect(updateJSON.contains(#""executionStyle":"manual""#))
    #expect(updateJSON.contains(#""mode":"peer_review""#))
    #expect(updateJSON.contains(#""readbackPriority":"package_first""#))
    #expect(updateJSON.contains(#""fallbackPolicy":"registry_only""#))
    #expect(updateJSON.contains(#""recoveryPreference":"resume_latest""#))
    #expect(updateJSON.contains(#""automation":{"autoDispatch":false}"#))
  }

  @Test
  func runtimeInterfaceCodecRejectsInvalidCmpControlEnumValuesAsInvalidInput() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let invalidPayloads = [
      (
        fieldName: "executionStyle",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"not_a_real_execution_style","mode":"peer_review","automation":{"autoDispatch":false}}}"#
      ),
      (
        fieldName: "mode",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"manual","mode":"not_a_real_mode","automation":{"autoDispatch":false}}}"#
      ),
      (
        fieldName: "readbackPriority",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"manual","mode":"peer_review","readbackPriority":"not_a_real_priority","automation":{"autoDispatch":false}}}"#
      ),
      (
        fieldName: "fallbackPolicy",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"manual","mode":"peer_review","fallbackPolicy":"not_a_real_fallback","automation":{"autoDispatch":false}}}"#
      ),
      (
        fieldName: "recoveryPreference",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"manual","mode":"peer_review","recoveryPreference":"not_a_real_recovery","automation":{"autoDispatch":false}}}"#
      ),
      (
        fieldName: "ghost",
        json:
          #"{"kind":"updateCmpControl","updateCmpControl":{"payloadSummary":"Invalid control update","projectID":"cmp.local-runtime","agentID":"checker.local","executionStyle":"manual","mode":"peer_review","automation":{"ghost":false}}}"#
      ),
    ]

    for invalidPayload in invalidPayloads {
      do {
        _ = try codec.decodeRequest(Data(invalidPayload.json.utf8))
        Issue.record("Expected invalid input decoding failure for illegal CMP control enum \(invalidPayload.fieldName).")
      } catch let error as PraxisError {
        guard case let .invalidInput(message) = error else {
          Issue.record("Expected invalidInput, got \(error).")
          return
        }
        #expect(message.contains(invalidPayload.fieldName))
      } catch {
        Issue.record("Expected PraxisError.invalidInput, got \(error).")
      }
    }
  }

  @Test
  func runtimeInterfaceCodecEncodesCmpPeerApprovalRequestsAsNestedPayloads() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let request = PraxisRuntimeInterfaceRequest.requestCmpPeerApproval(
      .init(
        payloadSummary: "Request peer approval",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: capabilityID("tool.git"),
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decision = PraxisRuntimeInterfaceRequest.decideCmpPeerApproval(
      .init(
        payloadSummary: "Approve peer approval",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: capabilityID("tool.git"),
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access"
      )
    )
    let readback = PraxisRuntimeInterfaceRequest.readbackCmpPeerApproval(
      .init(
        payloadSummary: "Read back peer approval",
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: capabilityID("tool.git")
      )
    )

    let requestData = try codec.encode(request)
    let decisionData = try codec.encode(decision)
    let readbackData = try codec.encode(readback)
    let decodedRequest = try codec.decodeRequest(requestData)
    let decodedDecision = try codec.decodeRequest(decisionData)
    let decodedReadback = try codec.decodeRequest(readbackData)

    #expect(decodedRequest == request)
    #expect(decodedDecision == decision)
    #expect(decodedReadback == readback)
  }

  @Test
  func runtimeInterfaceCodecRejectsInvalidCmpPeerApprovalRequestedTierAsInvalidInput() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let invalidJSON =
      #"{"kind":"requestCmpPeerApproval","requestCmpPeerApproval":{"payloadSummary":"Invalid peer approval request","projectID":"cmp.local-runtime","agentID":"runtime.local","targetAgentID":"checker.local","capabilityKey":"tool.git","requestedTier":"not_a_real_requested_tier","summary":"Escalate git access to checker"}}"#

    do {
      _ = try codec.decodeRequest(Data(invalidJSON.utf8))
      Issue.record("Expected invalid input decoding failure for illegal CMP peer approval requestedTier.")
    } catch let error as PraxisError {
      guard case let .invalidInput(message) = error else {
        Issue.record("Expected invalidInput, got \(error).")
        return
      }
      #expect(message.contains("requestedTier"))
    } catch {
      Issue.record("Expected PraxisError.invalidInput, got \(error).")
    }
  }

  @Test
  func runtimeInterfaceReturnsInvalidInputForCorruptedTapAndCmpApprovalReadbacks() async throws {
    let runtimeInterface = makeThrowingRuntimeInterface(
      readbackTapStatusError: PraxisError.invalidInput("TAP status readback found invalid humanGateState raw value."),
      readbackTapHistoryError: PraxisError.invalidInput("TAP history readback found invalid route raw value."),
      readbackCmpPeerApprovalError: PraxisError.invalidInput(
        "CMP peer approval readback found invalid requestedTier raw value."
      )
    )
    let cases: [(String, PraxisRuntimeInterfaceRequest)] = [
      (
        "humanGateState",
        .readbackTapStatus(
          .init(
            payloadSummary: "Read back TAP status",
            projectID: "cmp.local-runtime",
            agentID: "checker.local"
          )
        )
      ),
      (
        "route",
        .readbackTapHistory(
          .init(
            payloadSummary: "Read back TAP history",
            projectID: "cmp.local-runtime",
            agentID: "checker.local",
            limit: 5
          )
        )
      ),
      (
        "requestedTier",
        .readbackCmpPeerApproval(
          .init(
            payloadSummary: "Read back peer approval",
            projectID: "cmp.local-runtime",
            agentID: "runtime.local",
            targetAgentID: "checker.local",
            capabilityKey: capabilityID("tool.git")
          )
        )
      ),
    ]

    for (fieldName, request) in cases {
      let response = await runtimeInterface.handle(request)

      #expect(response.status == .failure)
      #expect(response.snapshot == nil)
      #expect(response.events.isEmpty)
      #expect(response.error?.code == .invalidInput)
      #expect(response.error?.retryable == false)
      #expect(response.error?.message.contains(fieldName) == true)
    }
  }

  @Test
  func runtimeInterfaceCodecDecodesLegacyFlatRunGoalAndResumeRequests() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let legacyRunGoalJSON = """
    {"kind":"runGoal","payloadSummary":"Legacy run goal","goalID":"goal.legacy-flat","goalTitle":"Legacy Flat Goal","sessionID":"session.legacy-flat"}
    """
    let legacyResumeJSON = """
    {"kind":"resumeRun","payloadSummary":"Legacy resume","runID":"run:session.legacy-flat:goal.legacy-flat"}
    """

    let decodedRunGoal = try codec.decodeRequest(Data(legacyRunGoalJSON.utf8))
    let decodedResume = try codec.decodeRequest(Data(legacyResumeJSON.utf8))

    #expect(
      decodedRunGoal ==
        .runGoal(
          .init(
            payloadSummary: "Legacy run goal",
            goalID: "goal.legacy-flat",
            goalTitle: "Legacy Flat Goal",
            sessionID: "session.legacy-flat"
          )
        )
    )
    #expect(
      decodedResume ==
        .resumeRun(
          .init(
            payloadSummary: "Legacy resume",
            runID: "run:session.legacy-flat:goal.legacy-flat"
          )
        )
    )
  }

  @Test
  func runtimeInterfaceCodecRejectsLegacyFlatPayloadsOutsideRunGoalAndResume() throws {
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let legacyReadbackCmpProjectJSON = """
    {"kind":"readbackCmpProject","payloadSummary":"Legacy flat CMP project readback","projectID":"cmp.legacy-flat"}
    """

    do {
      _ = try codec.decodeRequest(Data(legacyReadbackCmpProjectJSON.utf8))
      Issue.record("Expected invalid input decoding failure for unsupported legacy flat request.")
    } catch let error as PraxisError {
      guard case let .invalidInput(message) = error else {
        Issue.record("Expected invalidInput, got \(error).")
        return
      }
      #expect(message.contains("readbackCmpProject"))
    } catch {
      Issue.record("Expected PraxisError.invalidInput, got \(error).")
    }
  }
}
