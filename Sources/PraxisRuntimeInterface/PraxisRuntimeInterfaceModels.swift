import PraxisCapabilityContracts
import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisMpTypes
import PraxisRun
import PraxisRuntimeFacades
import PraxisRuntimeUseCases
import PraxisSession
import PraxisTapReview
import PraxisTapTypes

public enum PraxisRuntimeInterfaceResponseStatus: String, Sendable, Equatable, Codable {
  case success
  case failure
}

public enum PraxisRuntimeInterfaceErrorCode: String, Sendable, Equatable, Codable {
  case sessionNotFound = "session_not_found"
  case missingRequiredField = "missing_required_field"
  case checkpointNotFound = "checkpoint_not_found"
  case cmpPeerApprovalNotFound = "cmp_peer_approval_not_found"
  case cmpPeerApprovalAlreadyResolved = "cmp_peer_approval_already_resolved"
  case cmpPackageNotFound = "cmp_package_not_found"
  case cmpDispatchNotRetryable = "cmp_dispatch_not_retryable"
  case invalidInput = "invalid_input"
  case dependencyMissing = "dependency_missing"
  case unsupportedOperation = "unsupported_operation"
  case invalidTransition = "invalid_transition"
  case invariantViolation = "invariant_violation"
  case unknown = "unknown_error"
}

public enum PraxisRuntimeInterfaceCommandKind: String, Sendable, Equatable, Codable {
  case inspectArchitecture
  case runGoal
  case resumeRun
  case inspectTap
  case readbackTapStatus
  case readbackTapHistory
  case openCmpSession
  case readbackCmpProject
  case readbackCmpRoles
  case readbackCmpControl
  case updateCmpControl
  case requestCmpPeerApproval
  case decideCmpPeerApproval
  case readbackCmpPeerApproval
  case readbackCmpStatus
  case bootstrapCmpProject
  case recoverCmpProject
  case ingestCmpFlow
  case commitCmpFlow
  case resolveCmpFlow
  case materializeCmpFlow
  case dispatchCmpFlow
  case retryCmpDispatch
  case requestCmpHistory
  case smokeCmpProject
  case inspectCmp
  case inspectMp
  case searchMp
  case readbackMp
  case smokeMp
  case ingestMp
  case alignMp
  case promoteMp
  case archiveMp
  case resolveMp
  case requestMpHistory
  case buildCapabilityCatalog
}

/// Stable opaque handle used to address one runtime interface session inside a registry.
///
/// This handle identifies the interface-side session lifecycle only. It does not imply an
/// isolated runtime persistence sandbox, because multiple handles may still share the same
/// host-backed stores underneath the facade layer.
public struct PraxisRuntimeInterfaceSessionHandle: RawRepresentable, Hashable, Sendable, Equatable, Codable {
  public let rawValue: String

  /// Creates a session handle from a stable raw value.
  ///
  /// - Parameter rawValue: Opaque handle identifier managed by the registry layer.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }
}

/// Stable host-neutral opaque reference identifier exposed by the runtime interface surface.
///
/// This type carries outward-facing reference handles such as follow-up intent references and
/// flow event references without implying any provider, UI, transport, or persistence semantics.
public struct PraxisRuntimeInterfaceReferenceID:
  RawRepresentable,
  Hashable,
  Sendable,
  Equatable,
  Codable,
  CustomStringConvertible
{
  public let rawValue: String

  /// Creates a runtime interface opaque reference from its stable raw value.
  ///
  /// - Parameter rawValue: Opaque host-neutral reference value.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }

  public var description: String {
    rawValue
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    self.init(rawValue: try container.decode(String.self))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }
}

public struct PraxisRuntimeInterfaceRunGoalRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let goalID: String
  public let goalTitle: String
  public let sessionID: String?

  public init(
    payloadSummary: String,
    goalID: String,
    goalTitle: String,
    sessionID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.goalID = goalID
    self.goalTitle = goalTitle
    self.sessionID = sessionID
  }
}

public struct PraxisRuntimeInterfaceResumeRunRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let runID: String

  public init(payloadSummary: String, runID: String) {
    self.payloadSummary = payloadSummary
    self.runID = runID
  }
}

public struct PraxisRuntimeInterfaceOpenCmpSessionRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let sessionID: String?

  public init(
    payloadSummary: String,
    projectID: String,
    sessionID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.sessionID = sessionID
  }
}

public struct PraxisRuntimeInterfaceCmpProjectRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String

  public init(payloadSummary: String, projectID: String) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
  }
}

public struct PraxisRuntimeInterfaceTapStatusRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisRuntimeInterfaceTapHistoryRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?
  public let limit: Int

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil,
    limit: Int = 10
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.limit = limit
  }
}

public struct PraxisRuntimeInterfaceCmpStatusRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisRuntimeInterfaceCmpRolesRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisRuntimeInterfaceCmpControlRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisRuntimeInterfaceUpdateCmpControlRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?
  public let executionStyle: PraxisCmpExecutionStyle?
  public let mode: PraxisCmpControlMode?
  public let readbackPriority: PraxisCmpReadbackPriority?
  public let fallbackPolicy: PraxisCmpFallbackPolicy?
  public let recoveryPreference: PraxisCmpRecoveryPreference?
  public let automation: PraxisCmpAutomationMap

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle? = nil,
    mode: PraxisCmpControlMode? = nil,
    readbackPriority: PraxisCmpReadbackPriority? = nil,
    fallbackPolicy: PraxisCmpFallbackPolicy? = nil,
    recoveryPreference: PraxisCmpRecoveryPreference? = nil,
    automation: PraxisCmpAutomationMap = .empty
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.executionStyle = executionStyle
    self.mode = mode
    self.readbackPriority = readbackPriority
    self.fallbackPolicy = fallbackPolicy
    self.recoveryPreference = recoveryPreference
    self.automation = automation
  }
}

public struct PraxisRuntimeInterfaceRequestCmpPeerApprovalPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let requestedTier: PraxisTapCapabilityTier
  public let summary: String

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    requestedTier: PraxisTapCapabilityTier,
    summary: String
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.summary = summary
  }
}

public struct PraxisRuntimeInterfaceReadbackCmpPeerApprovalPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String?
  public let targetAgentID: String?
  public let capabilityKey: PraxisCapabilityID?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: PraxisCapabilityID? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
  }
}

public struct PraxisRuntimeInterfaceDecideCmpPeerApprovalPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let decision: PraxisCmpPeerApprovalDecision
  public let reviewerAgentID: String?
  public let decisionSummary: String

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    decision: PraxisCmpPeerApprovalDecision,
    reviewerAgentID: String? = nil,
    decisionSummary: String
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.decision = decision
    self.reviewerAgentID = reviewerAgentID
    self.decisionSummary = decisionSummary
  }
}

public struct PraxisRuntimeInterfaceBootstrapCmpProjectRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentIDs: [String]
  public let defaultAgentID: String?
  public let repoName: String?
  public let repoRootPath: String?
  public let defaultBranchName: String?
  public let databaseName: String?
  public let namespaceRoot: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentIDs: [String] = [],
    defaultAgentID: String? = nil,
    repoName: String? = nil,
    repoRootPath: String? = nil,
    defaultBranchName: String? = nil,
    databaseName: String? = nil,
    namespaceRoot: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentIDs = agentIDs
    self.defaultAgentID = defaultAgentID
    self.repoName = repoName
    self.repoRootPath = repoRootPath
    self.defaultBranchName = defaultBranchName
    self.databaseName = databaseName
    self.namespaceRoot = namespaceRoot
  }
}

public struct PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let reason: String
  public let lineageID: String?
  public let branchRef: String?
  public let snapshotID: String?
  public let packageKind: PraxisCmpContextPackageKind
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    reason: String,
    lineageID: String? = nil,
    branchRef: String? = nil,
    snapshotID: String? = nil,
    packageKind: PraxisCmpContextPackageKind = .historicalReply,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.reason = reason
    self.lineageID = lineageID
    self.branchRef = branchRef
    self.snapshotID = snapshotID
    self.packageKind = packageKind
    self.fidelityLabel = fidelityLabel
  }
}

public struct PraxisRuntimeInterfaceIngestCmpFlowRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let runID: String?
  public let lineageID: String?
  public let parentAgentID: String?
  public let taskSummary: String
  public let materials: [PraxisCmpRuntimeContextMaterial]
  public let requiresActiveSync: Bool

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: String? = nil,
    parentAgentID: String? = nil,
    taskSummary: String,
    materials: [PraxisCmpRuntimeContextMaterial],
    requiresActiveSync: Bool = false
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.runID = runID
    self.lineageID = lineageID
    self.parentAgentID = parentAgentID
    self.taskSummary = taskSummary
    self.materials = materials
    self.requiresActiveSync = requiresActiveSync
  }
}

public struct PraxisRuntimeInterfaceCommitCmpFlowRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let runID: String?
  public let lineageID: String?
  public let parentAgentID: String?
  public let eventIDs: [PraxisRuntimeInterfaceReferenceID]
  public let baseRef: String?
  public let changeSummary: String
  public let syncIntent: PraxisCmpContextSyncIntent

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: String? = nil,
    parentAgentID: String? = nil,
    eventIDs: [PraxisRuntimeInterfaceReferenceID],
    baseRef: String? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.runID = runID
    self.lineageID = lineageID
    self.parentAgentID = parentAgentID
    self.eventIDs = eventIDs
    self.baseRef = baseRef
    self.changeSummary = changeSummary
    self.syncIntent = syncIntent
  }
}

public struct PraxisRuntimeInterfaceResolveCmpFlowRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let lineageID: String?
  public let branchRef: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    lineageID: String? = nil,
    branchRef: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.lineageID = lineageID
    self.branchRef = branchRef
  }
}

public struct PraxisRuntimeInterfaceMaterializeCmpFlowRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let snapshotID: String?
  public let projectionID: String?
  public let packageKind: PraxisCmpContextPackageKind
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    snapshotID: String? = nil,
    projectionID: String? = nil,
    packageKind: PraxisCmpContextPackageKind,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.snapshotID = snapshotID
    self.projectionID = projectionID
    self.packageKind = packageKind
    self.fidelityLabel = fidelityLabel
  }
}

public struct PraxisRuntimeInterfaceDispatchCmpFlowRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let contextPackage: PraxisCmpContextPackage
  public let targetKind: PraxisCmpDispatchTargetKind
  public let reason: String

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    contextPackage: PraxisCmpContextPackage,
    targetKind: PraxisCmpDispatchTargetKind,
    reason: String
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.contextPackage = contextPackage
    self.targetKind = targetKind
    self.reason = reason
  }
}

public struct PraxisRuntimeInterfaceRetryCmpDispatchRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let packageID: String
  public let reason: String?

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    packageID: String,
    reason: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.packageID = packageID
    self.reason = reason
  }
}

public struct PraxisRuntimeInterfaceRequestCmpHistoryPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let requesterAgentID: String
  public let reason: String
  public let query: PraxisCmpHistoricalContextQuery

  public init(
    payloadSummary: String,
    projectID: String,
    requesterAgentID: String,
    reason: String,
    query: PraxisCmpHistoricalContextQuery
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.reason = reason
    self.query = query
  }
}

public struct PraxisRuntimeInterfaceMpSearchRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?
  public let includeSuperseded: Bool

  public init(
    payloadSummary: String,
    projectID: String,
    query: String,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5,
    agentID: String? = nil,
    sessionID: String? = nil,
    includeSuperseded: Bool = false
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
    self.includeSuperseded = includeSuperseded
  }
}

public struct PraxisRuntimeInterfaceMpReadbackRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?
  public let includeSuperseded: Bool

  public init(
    payloadSummary: String,
    projectID: String,
    query: String = "",
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 10,
    agentID: String? = nil,
    sessionID: String? = nil,
    includeSuperseded: Bool = false
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
    self.includeSuperseded = includeSuperseded
  }
}

public struct PraxisRuntimeInterfaceMpSmokeRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String

  public init(payloadSummary: String, projectID: String) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
  }
}

public struct PraxisRuntimeInterfaceMpIngestRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let agentID: String
  public let sessionID: String?
  public let scopeLevel: PraxisMpScopeLevel
  public let summary: String
  public let checkedSnapshotRef: String
  public let branchRef: String
  public let storageKey: String?
  public let memoryKind: PraxisMpMemoryKind
  public let observedAt: String?
  public let capturedAt: String?
  public let semanticGroupID: String?
  public let tags: [String]
  public let sourceRefs: [String]
  public let confidence: PraxisMpMemoryConfidenceLevel

  public init(
    payloadSummary: String,
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    scopeLevel: PraxisMpScopeLevel = .agentIsolated,
    summary: String,
    checkedSnapshotRef: String,
    branchRef: String,
    storageKey: String? = nil,
    memoryKind: PraxisMpMemoryKind = .semantic,
    observedAt: String? = nil,
    capturedAt: String? = nil,
    semanticGroupID: String? = nil,
    tags: [String] = [],
    sourceRefs: [String] = [],
    confidence: PraxisMpMemoryConfidenceLevel = .medium
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.scopeLevel = scopeLevel
    self.summary = summary
    self.checkedSnapshotRef = checkedSnapshotRef
    self.branchRef = branchRef
    self.storageKey = storageKey
    self.memoryKind = memoryKind
    self.observedAt = observedAt
    self.capturedAt = capturedAt
    self.semanticGroupID = semanticGroupID
    self.tags = tags
    self.sourceRefs = sourceRefs
    self.confidence = confidence
  }
}

public struct PraxisRuntimeInterfaceMpAlignRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let memoryID: String
  public let alignedAt: String?
  public let queryText: String?

  public init(
    payloadSummary: String,
    projectID: String,
    memoryID: String,
    alignedAt: String? = nil,
    queryText: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.memoryID = memoryID
    self.alignedAt = alignedAt
    self.queryText = queryText
  }
}

public struct PraxisRuntimeInterfaceMpPromoteRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let memoryID: String
  public let targetPromotionState: PraxisMpPromotionState
  public let targetSessionID: String?
  public let promotedAt: String?
  public let reason: String?

  public init(
    payloadSummary: String,
    projectID: String,
    memoryID: String,
    targetPromotionState: PraxisMpPromotionState,
    targetSessionID: String? = nil,
    promotedAt: String? = nil,
    reason: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.memoryID = memoryID
    self.targetPromotionState = targetPromotionState
    self.targetSessionID = targetSessionID
    self.promotedAt = promotedAt
    self.reason = reason
  }
}

public struct PraxisRuntimeInterfaceMpArchiveRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let memoryID: String
  public let archivedAt: String?
  public let reason: String?

  public init(
    payloadSummary: String,
    projectID: String,
    memoryID: String,
    archivedAt: String? = nil,
    reason: String? = nil
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.memoryID = memoryID
    self.archivedAt = archivedAt
    self.reason = reason
  }
}

public struct PraxisRuntimeInterfaceMpResolveRequestPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let query: String
  public let requesterAgentID: String
  public let sessionID: String?
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    payloadSummary: String,
    projectID: String,
    query: String,
    requesterAgentID: String,
    sessionID: String? = nil,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.query = query
    self.requesterAgentID = requesterAgentID
    self.sessionID = sessionID
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

public struct PraxisRuntimeInterfaceRequestMpHistoryPayload: Sendable, Equatable, Codable {
  public let payloadSummary: String
  public let projectID: String
  public let requesterAgentID: String
  public let sessionID: String?
  public let reason: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    payloadSummary: String,
    projectID: String,
    requesterAgentID: String,
    sessionID: String? = nil,
    reason: String,
    query: String,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.payloadSummary = payloadSummary
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.sessionID = sessionID
    self.reason = reason
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

public enum PraxisRuntimeInterfaceRequest: Sendable, Equatable, Codable {
  case inspectArchitecture
  case runGoal(PraxisRuntimeInterfaceRunGoalRequestPayload)
  case resumeRun(PraxisRuntimeInterfaceResumeRunRequestPayload)
  case inspectTap
  case readbackTapStatus(PraxisRuntimeInterfaceTapStatusRequestPayload)
  case readbackTapHistory(PraxisRuntimeInterfaceTapHistoryRequestPayload)
  case openCmpSession(PraxisRuntimeInterfaceOpenCmpSessionRequestPayload)
  case readbackCmpProject(PraxisRuntimeInterfaceCmpProjectRequestPayload)
  case readbackCmpRoles(PraxisRuntimeInterfaceCmpRolesRequestPayload)
  case readbackCmpControl(PraxisRuntimeInterfaceCmpControlRequestPayload)
  case updateCmpControl(PraxisRuntimeInterfaceUpdateCmpControlRequestPayload)
  case requestCmpPeerApproval(PraxisRuntimeInterfaceRequestCmpPeerApprovalPayload)
  case decideCmpPeerApproval(PraxisRuntimeInterfaceDecideCmpPeerApprovalPayload)
  case readbackCmpPeerApproval(PraxisRuntimeInterfaceReadbackCmpPeerApprovalPayload)
  case readbackCmpStatus(PraxisRuntimeInterfaceCmpStatusRequestPayload)
  case bootstrapCmpProject(PraxisRuntimeInterfaceBootstrapCmpProjectRequestPayload)
  case recoverCmpProject(PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload)
  case ingestCmpFlow(PraxisRuntimeInterfaceIngestCmpFlowRequestPayload)
  case commitCmpFlow(PraxisRuntimeInterfaceCommitCmpFlowRequestPayload)
  case resolveCmpFlow(PraxisRuntimeInterfaceResolveCmpFlowRequestPayload)
  case materializeCmpFlow(PraxisRuntimeInterfaceMaterializeCmpFlowRequestPayload)
  case dispatchCmpFlow(PraxisRuntimeInterfaceDispatchCmpFlowRequestPayload)
  case retryCmpDispatch(PraxisRuntimeInterfaceRetryCmpDispatchRequestPayload)
  case requestCmpHistory(PraxisRuntimeInterfaceRequestCmpHistoryPayload)
  case smokeCmpProject(PraxisRuntimeInterfaceCmpProjectRequestPayload)
  case inspectCmp
  case inspectMp
  case searchMp(PraxisRuntimeInterfaceMpSearchRequestPayload)
  case readbackMp(PraxisRuntimeInterfaceMpReadbackRequestPayload)
  case smokeMp(PraxisRuntimeInterfaceMpSmokeRequestPayload)
  case ingestMp(PraxisRuntimeInterfaceMpIngestRequestPayload)
  case alignMp(PraxisRuntimeInterfaceMpAlignRequestPayload)
  case promoteMp(PraxisRuntimeInterfaceMpPromoteRequestPayload)
  case archiveMp(PraxisRuntimeInterfaceMpArchiveRequestPayload)
  case resolveMp(PraxisRuntimeInterfaceMpResolveRequestPayload)
  case requestMpHistory(PraxisRuntimeInterfaceRequestMpHistoryPayload)
  case buildCapabilityCatalog

  public var kind: PraxisRuntimeInterfaceCommandKind {
    switch self {
    case .inspectArchitecture:
      return .inspectArchitecture
    case .runGoal:
      return .runGoal
    case .resumeRun:
      return .resumeRun
    case .inspectTap:
      return .inspectTap
    case .readbackTapStatus:
      return .readbackTapStatus
    case .readbackTapHistory:
      return .readbackTapHistory
    case .openCmpSession:
      return .openCmpSession
    case .readbackCmpProject:
      return .readbackCmpProject
    case .readbackCmpRoles:
      return .readbackCmpRoles
    case .readbackCmpControl:
      return .readbackCmpControl
    case .updateCmpControl:
      return .updateCmpControl
    case .requestCmpPeerApproval:
      return .requestCmpPeerApproval
    case .decideCmpPeerApproval:
      return .decideCmpPeerApproval
    case .readbackCmpPeerApproval:
      return .readbackCmpPeerApproval
    case .readbackCmpStatus:
      return .readbackCmpStatus
    case .bootstrapCmpProject:
      return .bootstrapCmpProject
    case .recoverCmpProject:
      return .recoverCmpProject
    case .ingestCmpFlow:
      return .ingestCmpFlow
    case .commitCmpFlow:
      return .commitCmpFlow
    case .resolveCmpFlow:
      return .resolveCmpFlow
    case .materializeCmpFlow:
      return .materializeCmpFlow
    case .dispatchCmpFlow:
      return .dispatchCmpFlow
    case .retryCmpDispatch:
      return .retryCmpDispatch
    case .requestCmpHistory:
      return .requestCmpHistory
    case .smokeCmpProject:
      return .smokeCmpProject
    case .inspectCmp:
      return .inspectCmp
    case .inspectMp:
      return .inspectMp
    case .searchMp:
      return .searchMp
    case .readbackMp:
      return .readbackMp
    case .smokeMp:
      return .smokeMp
    case .ingestMp:
      return .ingestMp
    case .alignMp:
      return .alignMp
    case .promoteMp:
      return .promoteMp
    case .archiveMp:
      return .archiveMp
    case .resolveMp:
      return .resolveMp
    case .requestMpHistory:
      return .requestMpHistory
    case .buildCapabilityCatalog:
      return .buildCapabilityCatalog
    }
  }

  public var payloadSummary: String {
    switch self {
    case .runGoal(let payload):
      return payload.payloadSummary
    case .resumeRun(let payload):
      return payload.payloadSummary
    case .readbackTapStatus(let payload):
      return payload.payloadSummary
    case .readbackTapHistory(let payload):
      return payload.payloadSummary
    case .openCmpSession(let payload):
      return payload.payloadSummary
    case .readbackCmpProject(let payload):
      return payload.payloadSummary
    case .readbackCmpRoles(let payload):
      return payload.payloadSummary
    case .readbackCmpControl(let payload):
      return payload.payloadSummary
    case .updateCmpControl(let payload):
      return payload.payloadSummary
    case .requestCmpPeerApproval(let payload):
      return payload.payloadSummary
    case .decideCmpPeerApproval(let payload):
      return payload.payloadSummary
    case .readbackCmpPeerApproval(let payload):
      return payload.payloadSummary
    case .readbackCmpStatus(let payload):
      return payload.payloadSummary
    case .bootstrapCmpProject(let payload):
      return payload.payloadSummary
    case .recoverCmpProject(let payload):
      return payload.payloadSummary
    case .ingestCmpFlow(let payload):
      return payload.payloadSummary
    case .commitCmpFlow(let payload):
      return payload.payloadSummary
    case .resolveCmpFlow(let payload):
      return payload.payloadSummary
    case .materializeCmpFlow(let payload):
      return payload.payloadSummary
    case .dispatchCmpFlow(let payload):
      return payload.payloadSummary
    case .retryCmpDispatch(let payload):
      return payload.payloadSummary
    case .requestCmpHistory(let payload):
      return payload.payloadSummary
    case .smokeCmpProject(let payload):
      return payload.payloadSummary
    case .searchMp(let payload):
      return payload.payloadSummary
    case .readbackMp(let payload):
      return payload.payloadSummary
    case .smokeMp(let payload):
      return payload.payloadSummary
    case .ingestMp(let payload):
      return payload.payloadSummary
    case .alignMp(let payload):
      return payload.payloadSummary
    case .promoteMp(let payload):
      return payload.payloadSummary
    case .archiveMp(let payload):
      return payload.payloadSummary
    case .resolveMp(let payload):
      return payload.payloadSummary
    case .requestMpHistory(let payload):
      return payload.payloadSummary
    case .inspectArchitecture, .inspectTap, .inspectCmp, .inspectMp, .buildCapabilityCatalog:
      return ""
    }
  }

  public var sessionID: String? {
    switch self {
    case .runGoal(let payload):
      return payload.sessionID
    case .openCmpSession(let payload):
      return payload.sessionID
    case .ingestCmpFlow(let payload):
      return payload.sessionID
    case .commitCmpFlow(let payload):
      return payload.sessionID
    case .searchMp(let payload):
      return payload.sessionID
    case .readbackMp(let payload):
      return payload.sessionID
    case .ingestMp(let payload):
      return payload.sessionID
    case .promoteMp(let payload):
      return payload.targetSessionID
    case .resolveMp(let payload):
      return payload.sessionID
    case .requestMpHistory(let payload):
      return payload.sessionID
    case .inspectArchitecture, .resumeRun, .inspectTap, .readbackTapStatus, .readbackTapHistory, .readbackCmpProject, .readbackCmpRoles, .readbackCmpControl, .updateCmpControl, .requestCmpPeerApproval, .decideCmpPeerApproval, .readbackCmpPeerApproval, .readbackCmpStatus, .bootstrapCmpProject, .recoverCmpProject, .resolveCmpFlow, .materializeCmpFlow, .dispatchCmpFlow, .retryCmpDispatch, .requestCmpHistory, .smokeCmpProject, .inspectCmp, .inspectMp, .smokeMp, .alignMp, .archiveMp, .buildCapabilityCatalog:
      return nil
    }
  }

  public var runID: String? {
    switch self {
    case .resumeRun(let payload):
      return payload.runID
    case .ingestCmpFlow(let payload):
      return payload.runID
    case .commitCmpFlow(let payload):
      return payload.runID
    case .inspectArchitecture, .runGoal, .inspectTap, .openCmpSession, .readbackTapStatus, .readbackTapHistory, .readbackCmpProject, .readbackCmpRoles, .readbackCmpControl, .updateCmpControl, .requestCmpPeerApproval, .decideCmpPeerApproval, .readbackCmpPeerApproval, .readbackCmpStatus, .bootstrapCmpProject, .recoverCmpProject, .resolveCmpFlow, .materializeCmpFlow, .dispatchCmpFlow, .retryCmpDispatch, .requestCmpHistory, .smokeCmpProject, .inspectCmp, .inspectMp, .searchMp, .readbackMp, .smokeMp, .ingestMp, .alignMp, .promoteMp, .archiveMp, .resolveMp, .requestMpHistory, .buildCapabilityCatalog:
      return nil
    }
  }

  public var projectID: String? {
    switch self {
    case .readbackTapStatus(let payload):
      return payload.projectID
    case .readbackTapHistory(let payload):
      return payload.projectID
    case .openCmpSession(let payload):
      return payload.projectID
    case .readbackCmpProject(let payload):
      return payload.projectID
    case .readbackCmpRoles(let payload):
      return payload.projectID
    case .readbackCmpControl(let payload):
      return payload.projectID
    case .updateCmpControl(let payload):
      return payload.projectID
    case .requestCmpPeerApproval(let payload):
      return payload.projectID
    case .decideCmpPeerApproval(let payload):
      return payload.projectID
    case .readbackCmpPeerApproval(let payload):
      return payload.projectID
    case .readbackCmpStatus(let payload):
      return payload.projectID
    case .bootstrapCmpProject(let payload):
      return payload.projectID
    case .recoverCmpProject(let payload):
      return payload.projectID
    case .ingestCmpFlow(let payload):
      return payload.projectID
    case .commitCmpFlow(let payload):
      return payload.projectID
    case .resolveCmpFlow(let payload):
      return payload.projectID
    case .materializeCmpFlow(let payload):
      return payload.projectID
    case .dispatchCmpFlow(let payload):
      return payload.projectID
    case .retryCmpDispatch(let payload):
      return payload.projectID
    case .requestCmpHistory(let payload):
      return payload.projectID
    case .smokeCmpProject(let payload):
      return payload.projectID
    case .searchMp(let payload):
      return payload.projectID
    case .readbackMp(let payload):
      return payload.projectID
    case .smokeMp(let payload):
      return payload.projectID
    case .ingestMp(let payload):
      return payload.projectID
    case .alignMp(let payload):
      return payload.projectID
    case .promoteMp(let payload):
      return payload.projectID
    case .archiveMp(let payload):
      return payload.projectID
    case .resolveMp(let payload):
      return payload.projectID
    case .requestMpHistory(let payload):
      return payload.projectID
    case .inspectArchitecture, .runGoal, .resumeRun, .inspectTap, .inspectCmp, .inspectMp, .buildCapabilityCatalog:
      return nil
    }
  }

  private enum CodingKeys: String, CodingKey {
    case kind
    case runGoal
    case resumeRun
    case readbackTapStatus
    case readbackTapHistory
    case openCmpSession
    case readbackCmpProject
    case readbackCmpRoles
    case readbackCmpControl
    case updateCmpControl
    case requestCmpPeerApproval
    case decideCmpPeerApproval
    case readbackCmpPeerApproval
    case readbackCmpStatus
    case bootstrapCmpProject
    case recoverCmpProject
    case ingestCmpFlow
    case commitCmpFlow
    case resolveCmpFlow
    case materializeCmpFlow
    case dispatchCmpFlow
    case retryCmpDispatch
    case requestCmpHistory
    case smokeCmpProject
    case searchMp
    case readbackMp
    case smokeMp
    case ingestMp
    case alignMp
    case promoteMp
    case archiveMp
    case resolveMp
    case requestMpHistory
    case payloadSummary
    case goalID
    case goalTitle
    case sessionID
    case runID
    case projectID
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let kind = try container.decode(PraxisRuntimeInterfaceCommandKind.self, forKey: .kind)

    switch kind {
    case .inspectArchitecture:
      self = .inspectArchitecture
    case .runGoal:
      if let payload = try container.decodeIfPresent(PraxisRuntimeInterfaceRunGoalRequestPayload.self, forKey: .runGoal) {
        self = .runGoal(payload)
      } else {
        self = .runGoal(
          .init(
            payloadSummary: try container.decodeIfPresent(String.self, forKey: .payloadSummary) ?? "",
            goalID: try container.decodeIfPresent(String.self, forKey: .goalID) ?? "external.goal",
            goalTitle: try container.decodeIfPresent(String.self, forKey: .goalTitle) ?? "External requested goal",
            sessionID: try container.decodeIfPresent(String.self, forKey: .sessionID)
          )
        )
      }
    case .resumeRun:
      if let payload = try container.decodeIfPresent(PraxisRuntimeInterfaceResumeRunRequestPayload.self, forKey: .resumeRun) {
        self = .resumeRun(payload)
      } else {
        self = .resumeRun(
          .init(
            payloadSummary: try container.decodeIfPresent(String.self, forKey: .payloadSummary) ?? "",
            runID: try container.decodeIfPresent(String.self, forKey: .runID) ?? ""
          )
        )
      }
    case .inspectTap:
      self = .inspectTap
    case .readbackTapStatus:
      self = .readbackTapStatus(
        try container.decode(
          PraxisRuntimeInterfaceTapStatusRequestPayload.self,
          forKey: .readbackTapStatus
        )
      )
    case .readbackTapHistory:
      self = .readbackTapHistory(
        try container.decode(
          PraxisRuntimeInterfaceTapHistoryRequestPayload.self,
          forKey: .readbackTapHistory
        )
      )
    case .openCmpSession:
      self = .openCmpSession(
        try container.decode(
          PraxisRuntimeInterfaceOpenCmpSessionRequestPayload.self,
          forKey: .openCmpSession
        )
      )
    case .readbackCmpProject:
      self = .readbackCmpProject(
        try container.decode(
          PraxisRuntimeInterfaceCmpProjectRequestPayload.self,
          forKey: .readbackCmpProject
        )
      )
    case .readbackCmpRoles:
      self = .readbackCmpRoles(
        try container.decode(
          PraxisRuntimeInterfaceCmpRolesRequestPayload.self,
          forKey: .readbackCmpRoles
        )
      )
    case .readbackCmpControl:
      self = .readbackCmpControl(
        try container.decode(
          PraxisRuntimeInterfaceCmpControlRequestPayload.self,
          forKey: .readbackCmpControl
        )
      )
    case .updateCmpControl:
      self = .updateCmpControl(
        try container.decode(
          PraxisRuntimeInterfaceUpdateCmpControlRequestPayload.self,
          forKey: .updateCmpControl
        )
      )
    case .requestCmpPeerApproval:
      self = .requestCmpPeerApproval(
        try container.decode(
          PraxisRuntimeInterfaceRequestCmpPeerApprovalPayload.self,
          forKey: .requestCmpPeerApproval
        )
      )
    case .decideCmpPeerApproval:
      self = .decideCmpPeerApproval(
        try container.decode(
          PraxisRuntimeInterfaceDecideCmpPeerApprovalPayload.self,
          forKey: .decideCmpPeerApproval
        )
      )
    case .readbackCmpPeerApproval:
      self = .readbackCmpPeerApproval(
        try container.decode(
          PraxisRuntimeInterfaceReadbackCmpPeerApprovalPayload.self,
          forKey: .readbackCmpPeerApproval
        )
      )
    case .readbackCmpStatus:
      self = .readbackCmpStatus(
        try container.decode(
          PraxisRuntimeInterfaceCmpStatusRequestPayload.self,
          forKey: .readbackCmpStatus
        )
      )
    case .bootstrapCmpProject:
      self = .bootstrapCmpProject(
        try container.decode(
          PraxisRuntimeInterfaceBootstrapCmpProjectRequestPayload.self,
          forKey: .bootstrapCmpProject
        )
      )
    case .recoverCmpProject:
      self = .recoverCmpProject(
        try container.decode(
          PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload.self,
          forKey: .recoverCmpProject
        )
      )
    case .ingestCmpFlow:
      self = .ingestCmpFlow(
        try container.decode(
          PraxisRuntimeInterfaceIngestCmpFlowRequestPayload.self,
          forKey: .ingestCmpFlow
        )
      )
    case .commitCmpFlow:
      self = .commitCmpFlow(
        try container.decode(
          PraxisRuntimeInterfaceCommitCmpFlowRequestPayload.self,
          forKey: .commitCmpFlow
        )
      )
    case .resolveCmpFlow:
      self = .resolveCmpFlow(
        try container.decode(
          PraxisRuntimeInterfaceResolveCmpFlowRequestPayload.self,
          forKey: .resolveCmpFlow
        )
      )
    case .materializeCmpFlow:
      self = .materializeCmpFlow(
        try container.decode(
          PraxisRuntimeInterfaceMaterializeCmpFlowRequestPayload.self,
          forKey: .materializeCmpFlow
        )
      )
    case .dispatchCmpFlow:
      self = .dispatchCmpFlow(
        try container.decode(
          PraxisRuntimeInterfaceDispatchCmpFlowRequestPayload.self,
          forKey: .dispatchCmpFlow
        )
      )
    case .retryCmpDispatch:
      self = .retryCmpDispatch(
        try container.decode(
          PraxisRuntimeInterfaceRetryCmpDispatchRequestPayload.self,
          forKey: .retryCmpDispatch
        )
      )
    case .requestCmpHistory:
      self = .requestCmpHistory(
        try container.decode(
          PraxisRuntimeInterfaceRequestCmpHistoryPayload.self,
          forKey: .requestCmpHistory
        )
      )
    case .smokeCmpProject:
      self = .smokeCmpProject(
        try container.decode(
          PraxisRuntimeInterfaceCmpProjectRequestPayload.self,
          forKey: .smokeCmpProject
        )
      )
    case .inspectCmp:
      self = .inspectCmp
    case .inspectMp:
      self = .inspectMp
    case .searchMp:
      self = .searchMp(
        try container.decode(
          PraxisRuntimeInterfaceMpSearchRequestPayload.self,
          forKey: .searchMp
        )
      )
    case .readbackMp:
      self = .readbackMp(
        try container.decode(
          PraxisRuntimeInterfaceMpReadbackRequestPayload.self,
          forKey: .readbackMp
        )
      )
    case .smokeMp:
      self = .smokeMp(
        try container.decode(
          PraxisRuntimeInterfaceMpSmokeRequestPayload.self,
          forKey: .smokeMp
        )
      )
    case .ingestMp:
      self = .ingestMp(
        try container.decode(
          PraxisRuntimeInterfaceMpIngestRequestPayload.self,
          forKey: .ingestMp
        )
      )
    case .alignMp:
      self = .alignMp(
        try container.decode(
          PraxisRuntimeInterfaceMpAlignRequestPayload.self,
          forKey: .alignMp
        )
      )
    case .promoteMp:
      self = .promoteMp(
        try container.decode(
          PraxisRuntimeInterfaceMpPromoteRequestPayload.self,
          forKey: .promoteMp
        )
      )
    case .archiveMp:
      self = .archiveMp(
        try container.decode(
          PraxisRuntimeInterfaceMpArchiveRequestPayload.self,
          forKey: .archiveMp
        )
      )
    case .resolveMp:
      self = .resolveMp(
        try container.decode(
          PraxisRuntimeInterfaceMpResolveRequestPayload.self,
          forKey: .resolveMp
        )
      )
    case .requestMpHistory:
      self = .requestMpHistory(
        try container.decode(
          PraxisRuntimeInterfaceRequestMpHistoryPayload.self,
          forKey: .requestMpHistory
        )
      )
    case .buildCapabilityCatalog:
      self = .buildCapabilityCatalog
    }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(kind, forKey: .kind)

    switch self {
    case .runGoal(let payload):
      try container.encode(payload, forKey: .runGoal)
    case .resumeRun(let payload):
      try container.encode(payload, forKey: .resumeRun)
    case .readbackTapStatus(let payload):
      try container.encode(payload, forKey: .readbackTapStatus)
    case .readbackTapHistory(let payload):
      try container.encode(payload, forKey: .readbackTapHistory)
    case .openCmpSession(let payload):
      try container.encode(payload, forKey: .openCmpSession)
    case .readbackCmpProject(let payload):
      try container.encode(payload, forKey: .readbackCmpProject)
    case .readbackCmpRoles(let payload):
      try container.encode(payload, forKey: .readbackCmpRoles)
    case .readbackCmpControl(let payload):
      try container.encode(payload, forKey: .readbackCmpControl)
    case .updateCmpControl(let payload):
      try container.encode(payload, forKey: .updateCmpControl)
    case .requestCmpPeerApproval(let payload):
      try container.encode(payload, forKey: .requestCmpPeerApproval)
    case .decideCmpPeerApproval(let payload):
      try container.encode(payload, forKey: .decideCmpPeerApproval)
    case .readbackCmpPeerApproval(let payload):
      try container.encode(payload, forKey: .readbackCmpPeerApproval)
    case .readbackCmpStatus(let payload):
      try container.encode(payload, forKey: .readbackCmpStatus)
    case .bootstrapCmpProject(let payload):
      try container.encode(payload, forKey: .bootstrapCmpProject)
    case .recoverCmpProject(let payload):
      try container.encode(payload, forKey: .recoverCmpProject)
    case .ingestCmpFlow(let payload):
      try container.encode(payload, forKey: .ingestCmpFlow)
    case .commitCmpFlow(let payload):
      try container.encode(payload, forKey: .commitCmpFlow)
    case .resolveCmpFlow(let payload):
      try container.encode(payload, forKey: .resolveCmpFlow)
    case .materializeCmpFlow(let payload):
      try container.encode(payload, forKey: .materializeCmpFlow)
    case .dispatchCmpFlow(let payload):
      try container.encode(payload, forKey: .dispatchCmpFlow)
    case .retryCmpDispatch(let payload):
      try container.encode(payload, forKey: .retryCmpDispatch)
    case .requestCmpHistory(let payload):
      try container.encode(payload, forKey: .requestCmpHistory)
    case .smokeCmpProject(let payload):
      try container.encode(payload, forKey: .smokeCmpProject)
    case .searchMp(let payload):
      try container.encode(payload, forKey: .searchMp)
    case .readbackMp(let payload):
      try container.encode(payload, forKey: .readbackMp)
    case .smokeMp(let payload):
      try container.encode(payload, forKey: .smokeMp)
    case .ingestMp(let payload):
      try container.encode(payload, forKey: .ingestMp)
    case .alignMp(let payload):
      try container.encode(payload, forKey: .alignMp)
    case .promoteMp(let payload):
      try container.encode(payload, forKey: .promoteMp)
    case .archiveMp(let payload):
      try container.encode(payload, forKey: .archiveMp)
    case .resolveMp(let payload):
      try container.encode(payload, forKey: .resolveMp)
    case .requestMpHistory(let payload):
      try container.encode(payload, forKey: .requestMpHistory)
    case .inspectArchitecture, .inspectTap, .inspectCmp, .inspectMp, .buildCapabilityCatalog:
      break
    }
  }
}

public enum PraxisRuntimeInterfaceSnapshotKind: String, Sendable, Equatable, Codable {
  case architecture
  case run
  case tapStatus
  case tapHistory
  case cmpSession
  case cmpProject
  case cmpRecover
  case cmpRoles
  case cmpControl
  case cmpApproval
  case cmpStatus
  case cmpBootstrap
  case cmpFlow
  case smoke
  case inspection
  case mpSearch
  case mpReadback
  case mpSmoke
  case mpIngest
  case mpAlign
  case mpPromote
  case mpArchive
  case mpResolve
  case mpHistory
  case catalog
}

public struct PraxisRuntimeInterfaceSnapshot: Sendable, Equatable, Codable {
  public let kind: PraxisRuntimeInterfaceSnapshotKind
  public let title: String
  public let summary: String
  public let projectID: String?
  public let agentID: String?
  public let targetAgentID: String?
  public let capabilityKey: PraxisCapabilityID?
  public let hostProfile: PraxisLocalRuntimeHostProfile?
  public let componentStatuses: PraxisCmpProjectComponentStatusMap?
  public let runID: PraxisRunID?
  public let sessionID: PraxisSessionID?
  public let phase: PraxisRunPhase?
  public let tickCount: Int?
  public let lifecycleDisposition: PraxisRunLifecycleDisposition?
  public let checkpointReference: String?
  public let pendingIntentID: PraxisRuntimeInterfaceReferenceID?
  public let recoveredEventCount: Int?
  public let nextAction: PraxisCmpFlowIngestNextAction?
  public let activeLineStage: PraxisCmpActiveLineStage?
  public let qualityLabel: PraxisCmpCheckedSnapshotQualityLabel?
  public let packageKind: PraxisCmpContextPackageKind?
  public let recoveryStatus: PraxisCmpRecoveryStatus?
  public let targetKind: PraxisCmpDispatchTargetKind?
  public let dispatchStatus: PraxisCmpDispatchStatus?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let packageStatusCounts: PraxisCmpPackageStatusCountMap?
  public let roleCounts: PraxisCmpRoleCountMap?
  public let roleStages: PraxisCmpRoleStageMap?
  public let requestedTier: PraxisTapCapabilityTier?
  public let route: PraxisReviewerRoute?
  public let outcome: PraxisCmpPeerApprovalOutcome?
  public let tapMode: PraxisTapMode?
  public let riskLevel: PraxisTapRiskLevel?
  public let humanGateState: PraxisHumanGateState?
  public let requestedAt: String?
  public let decisionSummary: String?
  public let tapHistoryTotalCount: Int?
  public let tapHistoryEntries: [PraxisTapHistoryEntrySnapshot]?

  public init(
    kind: PraxisRuntimeInterfaceSnapshotKind,
    title: String,
    summary: String,
    projectID: String? = nil,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: PraxisCapabilityID? = nil,
    hostProfile: PraxisLocalRuntimeHostProfile? = nil,
    componentStatuses: PraxisCmpProjectComponentStatusMap? = nil,
    runID: PraxisRunID? = nil,
    sessionID: PraxisSessionID? = nil,
    phase: PraxisRunPhase? = nil,
    tickCount: Int? = nil,
    lifecycleDisposition: PraxisRunLifecycleDisposition? = nil,
    checkpointReference: String? = nil,
    pendingIntentID: PraxisRuntimeInterfaceReferenceID? = nil,
    recoveredEventCount: Int? = nil,
    nextAction: PraxisCmpFlowIngestNextAction? = nil,
    activeLineStage: PraxisCmpActiveLineStage? = nil,
    qualityLabel: PraxisCmpCheckedSnapshotQualityLabel? = nil,
    packageKind: PraxisCmpContextPackageKind? = nil,
    recoveryStatus: PraxisCmpRecoveryStatus? = nil,
    targetKind: PraxisCmpDispatchTargetKind? = nil,
    dispatchStatus: PraxisCmpDispatchStatus? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    packageStatusCounts: PraxisCmpPackageStatusCountMap? = nil,
    roleCounts: PraxisCmpRoleCountMap? = nil,
    roleStages: PraxisCmpRoleStageMap? = nil,
    requestedTier: PraxisTapCapabilityTier? = nil,
    route: PraxisReviewerRoute? = nil,
    outcome: PraxisCmpPeerApprovalOutcome? = nil,
    tapMode: PraxisTapMode? = nil,
    riskLevel: PraxisTapRiskLevel? = nil,
    humanGateState: PraxisHumanGateState? = nil,
    requestedAt: String? = nil,
    decisionSummary: String? = nil,
    tapHistoryTotalCount: Int? = nil,
    tapHistoryEntries: [PraxisTapHistoryEntrySnapshot]? = nil
  ) {
    self.kind = kind
    self.title = title
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.hostProfile = hostProfile
    self.componentStatuses = componentStatuses
    self.runID = runID
    self.sessionID = sessionID
    self.phase = phase
    self.tickCount = tickCount
    self.lifecycleDisposition = lifecycleDisposition
    self.checkpointReference = checkpointReference
    self.pendingIntentID = pendingIntentID
    self.recoveredEventCount = recoveredEventCount
    self.nextAction = nextAction
    self.activeLineStage = activeLineStage
    self.qualityLabel = qualityLabel
    self.packageKind = packageKind
    self.recoveryStatus = recoveryStatus
    self.targetKind = targetKind
    self.dispatchStatus = dispatchStatus
    self.latestDispatchStatus = latestDispatchStatus
    self.packageStatusCounts = packageStatusCounts
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.requestedTier = requestedTier
    self.route = route
    self.outcome = outcome
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.requestedAt = requestedAt
    self.decisionSummary = decisionSummary
    self.tapHistoryTotalCount = tapHistoryTotalCount
    self.tapHistoryEntries = tapHistoryEntries
  }
}

/// Enumerates the stable runtime interface event channels exposed by the host-neutral surface.
///
/// This contract is limited to the currently shipped runtime interface event set. It does not
/// carry CLI, UI, platform, or provider-specific semantics beyond those stable channels.
public enum PraxisRuntimeInterfaceEventName: String, Sendable, Equatable, Codable, CaseIterable {
  case cmpSessionOpened = "cmp.session.opened"
  case tapStatusReadback = "tap.status.readback"
  case tapHistoryReadback = "tap.history.readback"
  case cmpRolesReadback = "cmp.roles.readback"
  case cmpControlReadback = "cmp.control.readback"
  case cmpControlUpdated = "cmp.control.updated"
  case cmpPeerApprovalRequested = "cmp.peer_approval.requested"
  case cmpPeerApprovalDecided = "cmp.peer_approval.decided"
  case cmpPeerApprovalReadback = "cmp.peer_approval.readback"
  case cmpStatusReadback = "cmp.status.readback"
  case cmpProjectBootstrapped = "cmp.project.bootstrapped"
  case cmpProjectRecovered = "cmp.project.recovered"
  case cmpFlowIngested = "cmp.flow.ingested"
  case cmpFlowCommitted = "cmp.flow.committed"
  case cmpFlowResolved = "cmp.flow.resolved"
  case cmpFlowMaterialized = "cmp.flow.materialized"
  case cmpFlowDispatched = "cmp.flow.dispatched"
  case cmpFlowDispatchRetried = "cmp.flow.dispatch_retried"
  case cmpFlowHistoryRequested = "cmp.flow.history_requested"
  case runStarted = "run.started"
  case runResumed = "run.resumed"
  case runRecovered = "run.recovered"
  case runFollowUpReady = "run.follow_up_ready"
}

extension PraxisRuntimeInterfaceEventName: CustomStringConvertible {
  public var description: String {
    rawValue
  }
}

public struct PraxisRuntimeInterfaceEvent: Sendable, Equatable, Codable {
  public let name: PraxisRuntimeInterfaceEventName
  public let detail: String
  public let runID: PraxisRunID?
  public let sessionID: PraxisSessionID?
  public let intentID: PraxisRuntimeInterfaceReferenceID?

  public init(
    name: PraxisRuntimeInterfaceEventName,
    detail: String,
    runID: PraxisRunID? = nil,
    sessionID: PraxisSessionID? = nil,
    intentID: PraxisRuntimeInterfaceReferenceID? = nil
  ) {
    self.name = name
    self.detail = detail
    self.runID = runID
    self.sessionID = sessionID
    self.intentID = intentID
  }
}

public struct PraxisRuntimeInterfaceErrorEnvelope: Sendable, Equatable, Codable {
  public let code: PraxisRuntimeInterfaceErrorCode
  public let message: String
  public let retryable: Bool
  public let missingField: String?
  public let runID: PraxisRunID?
  public let sessionID: PraxisSessionID?

  public init(
    code: PraxisRuntimeInterfaceErrorCode,
    message: String,
    retryable: Bool = false,
    missingField: String? = nil,
    runID: PraxisRunID? = nil,
    sessionID: PraxisSessionID? = nil
  ) {
    self.code = code
    self.message = message
    self.retryable = retryable
    self.missingField = missingField
    self.runID = runID
    self.sessionID = sessionID
  }
}

public struct PraxisRuntimeInterfaceResponse: Sendable, Equatable, Codable {
  public let status: PraxisRuntimeInterfaceResponseStatus
  public let snapshot: PraxisRuntimeInterfaceSnapshot?
  public let events: [PraxisRuntimeInterfaceEvent]
  public let error: PraxisRuntimeInterfaceErrorEnvelope?

  public init(
    status: PraxisRuntimeInterfaceResponseStatus,
    snapshot: PraxisRuntimeInterfaceSnapshot? = nil,
    events: [PraxisRuntimeInterfaceEvent] = [],
    error: PraxisRuntimeInterfaceErrorEnvelope? = nil
  ) {
    self.status = status
    self.snapshot = snapshot
    self.events = events
    self.error = error
  }

  public static func success(
    snapshot: PraxisRuntimeInterfaceSnapshot,
    events: [PraxisRuntimeInterfaceEvent] = []
  ) -> PraxisRuntimeInterfaceResponse {
    .init(
      status: .success,
      snapshot: snapshot,
      events: events,
      error: nil
    )
  }

  public static func failure(
    error: PraxisRuntimeInterfaceErrorEnvelope,
    events: [PraxisRuntimeInterfaceEvent] = []
  ) -> PraxisRuntimeInterfaceResponse {
    .init(
      status: .failure,
      snapshot: nil,
      events: events,
      error: error
    )
  }

  public var isSuccess: Bool {
    status == .success
  }
}
