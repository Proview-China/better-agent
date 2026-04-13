import PraxisCapabilityContracts
import PraxisCmpDelivery
import PraxisCmpDbModel
import PraxisCmpFiveAgent
import PraxisCmpProjection
import PraxisCmpGitModel
import PraxisCmpMqModel
import PraxisCmpSections
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisGoal
import PraxisRun
import PraxisTapTypes
import PraxisSession
import PraxisTapGovernance
import PraxisTapReview
import PraxisTapRuntime
import PraxisTransition

public struct PraxisRunFollowUpAction: Sendable, Equatable, Codable {
  public let kind: PraxisStepActionKind
  public let reason: String
  public let intentID: String?
  public let intentKind: PraxisTransitionIntentKind?

  public init(
    kind: PraxisStepActionKind,
    reason: String,
    intentID: String? = nil,
    intentKind: PraxisTransitionIntentKind? = nil
  ) {
    self.kind = kind
    self.reason = reason
    self.intentID = intentID
    self.intentKind = intentKind
  }
}

public struct PraxisRunExecution: Sendable, Equatable, Codable {
  public let runID: PraxisRunID
  public let sessionID: PraxisSessionID
  public let phase: PraxisRunPhase
  public let tickCount: Int
  public let journalSequence: Int?
  public let checkpointReference: String?
  public let recoveredEventCount: Int
  public let resumeIssued: Bool
  public let followUpAction: PraxisRunFollowUpAction?

  public init(
    runID: PraxisRunID,
    sessionID: PraxisSessionID,
    phase: PraxisRunPhase,
    tickCount: Int,
    journalSequence: Int? = nil,
    checkpointReference: String? = nil,
    recoveredEventCount: Int = 0,
    resumeIssued: Bool = true,
    followUpAction: PraxisRunFollowUpAction? = nil
  ) {
    self.runID = runID
    self.sessionID = sessionID
    self.phase = phase
    self.tickCount = tickCount
    self.journalSequence = journalSequence
    self.checkpointReference = checkpointReference
    self.recoveredEventCount = recoveredEventCount
    self.resumeIssued = resumeIssued
    self.followUpAction = followUpAction
  }
}

public struct PraxisRunGoalCommand: Sendable, Equatable, Codable {
  public let goal: PraxisCompiledGoal
  public let sessionID: PraxisSessionID?

  public init(goal: PraxisCompiledGoal, sessionID: PraxisSessionID? = nil) {
    self.goal = goal
    self.sessionID = sessionID
  }
}

public struct PraxisResumeRunCommand: Sendable, Equatable, Codable {
  public let runID: PraxisRunID

  public init(runID: PraxisRunID) {
    self.runID = runID
  }
}

public struct PraxisTapInspection: Sendable, Equatable, Codable {
  public let summary: String
  public let governanceSnapshot: PraxisGovernanceSnapshot
  public let reviewContext: PraxisReviewContextAperture
  public let toolReviewReport: PraxisToolReviewReport
  public let runtimeSnapshot: PraxisTapRuntimeSnapshot

  public init(
    summary: String,
    governanceSnapshot: PraxisGovernanceSnapshot,
    reviewContext: PraxisReviewContextAperture,
    toolReviewReport: PraxisToolReviewReport,
    runtimeSnapshot: PraxisTapRuntimeSnapshot
  ) {
    self.summary = summary
    self.governanceSnapshot = governanceSnapshot
    self.reviewContext = reviewContext
    self.toolReviewReport = toolReviewReport
    self.runtimeSnapshot = runtimeSnapshot
  }
}

public struct PraxisReadbackTapStatusCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?

  public init(projectID: String, agentID: String? = nil) {
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisTapStatusReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let readinessSummary: String
  public let tapMode: PraxisTapMode
  public let riskLevel: PraxisTapRiskLevel
  public let humanGateState: PraxisHumanGateState
  public let availableCapabilityCount: Int
  public let availableCapabilityIDs: [PraxisCapabilityID]
  public let pendingApprovalCount: Int
  public let approvedApprovalCount: Int
  public let latestCapabilityKey: PraxisCapabilityID?
  public let latestDecisionSummary: String?
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    readinessSummary: String,
    tapMode: PraxisTapMode,
    riskLevel: PraxisTapRiskLevel,
    humanGateState: PraxisHumanGateState,
    availableCapabilityCount: Int,
    availableCapabilityIDs: [PraxisCapabilityID],
    pendingApprovalCount: Int,
    approvedApprovalCount: Int,
    latestCapabilityKey: PraxisCapabilityID? = nil,
    latestDecisionSummary: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.readinessSummary = readinessSummary
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.availableCapabilityCount = availableCapabilityCount
    self.availableCapabilityIDs = availableCapabilityIDs
    self.pendingApprovalCount = pendingApprovalCount
    self.approvedApprovalCount = approvedApprovalCount
    self.latestCapabilityKey = latestCapabilityKey
    self.latestDecisionSummary = latestDecisionSummary
    self.issues = issues
  }
}

public struct PraxisReadbackTapHistoryCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let limit: Int

  public init(projectID: String, agentID: String? = nil, limit: Int = 10) {
    self.projectID = projectID
    self.agentID = agentID
    self.limit = limit
  }
}

public enum PraxisCmpPeerApprovalOutcome: String, Sendable, Codable {
  case baselineApproved = "baseline_approved"
  case reviewRequired = "review_required"
  case redirectedToProvisioning = "redirected_to_provisioning"
  case escalatedToHuman = "escalated_to_human"
  case denied
  case approvedByHuman = "approved_by_human"
  case rejectedByHuman = "rejected_by_human"
  case gateReleased = "gate_released"
}

public struct PraxisTapHistoryEntry: Sendable, Equatable, Codable {
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let requestedTier: PraxisTapCapabilityTier
  public let route: PraxisReviewerRoute
  public let outcome: PraxisCmpPeerApprovalOutcome
  public let humanGateState: PraxisHumanGateState
  public let updatedAt: String
  public let decisionSummary: String

  public init(
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    requestedTier: PraxisTapCapabilityTier,
    route: PraxisReviewerRoute,
    outcome: PraxisCmpPeerApprovalOutcome,
    humanGateState: PraxisHumanGateState,
    updatedAt: String,
    decisionSummary: String
  ) {
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.route = route
    self.outcome = outcome
    self.humanGateState = humanGateState
    self.updatedAt = updatedAt
    self.decisionSummary = decisionSummary
  }
}

public struct PraxisTapHistoryReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let totalCount: Int
  public let entries: [PraxisTapHistoryEntry]
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    totalCount: Int,
    entries: [PraxisTapHistoryEntry],
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.totalCount = totalCount
    self.entries = entries
    self.issues = issues
  }
}

public struct PraxisCmpInspection: Sendable, Equatable, Codable {
  public let runtimeProfile: PraxisCmpLocalRuntimeProfile
  public let summary: String
  public let projectID: String
  public let issues: [String]
  public let hostSummary: String

  public init(
    runtimeProfile: PraxisCmpLocalRuntimeProfile,
    summary: String,
    projectID: String,
    issues: [String],
    hostSummary: String
  ) {
    self.runtimeProfile = runtimeProfile
    self.summary = summary
    self.projectID = projectID
    self.issues = issues
    self.hostSummary = hostSummary
  }
}

public struct PraxisCmpLocalRuntimeProfile: Sendable, Equatable, Codable {
  public let structuredStoreSummary: String
  public let deliveryStoreSummary: String
  public let messageBusSummary: String
  public let gitSummary: String
  public let semanticIndexSummary: String

  public init(
    structuredStoreSummary: String,
    deliveryStoreSummary: String,
    messageBusSummary: String,
    gitSummary: String,
    semanticIndexSummary: String
  ) {
    self.structuredStoreSummary = structuredStoreSummary
    self.deliveryStoreSummary = deliveryStoreSummary
    self.messageBusSummary = messageBusSummary
    self.gitSummary = gitSummary
    self.semanticIndexSummary = semanticIndexSummary
  }
}

public struct PraxisCmpProjectHostProfile: Sendable, Equatable, Codable {
  public let executionStyle: PraxisCmpProjectExecutionStyle
  public let structuredStore: PraxisCmpProjectStructuredStoreProfile
  public let deliveryStore: PraxisCmpProjectDeliveryStoreProfile
  public let messageTransport: PraxisCmpProjectMessageTransportProfile
  public let gitAccess: PraxisCmpProjectGitAccessProfile
  public let semanticIndex: PraxisCmpProjectSemanticIndexProfile

  public init(
    executionStyle: PraxisCmpProjectExecutionStyle,
    structuredStore: PraxisCmpProjectStructuredStoreProfile,
    deliveryStore: PraxisCmpProjectDeliveryStoreProfile,
    messageTransport: PraxisCmpProjectMessageTransportProfile,
    gitAccess: PraxisCmpProjectGitAccessProfile,
    semanticIndex: PraxisCmpProjectSemanticIndexProfile
  ) {
    self.executionStyle = executionStyle
    self.structuredStore = structuredStore
    self.deliveryStore = deliveryStore
    self.messageTransport = messageTransport
    self.gitAccess = gitAccess
    self.semanticIndex = semanticIndex
  }
}

public struct PraxisOpenCmpSessionCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let sessionID: String?

  public init(projectID: String, sessionID: String? = nil) {
    self.projectID = projectID
    self.sessionID = sessionID
  }
}

public struct PraxisCmpSession: Sendable, Equatable, Codable {
  public let sessionID: String
  public let projectID: String
  public let summary: String
  public let createdAt: String
  public let hostProfile: PraxisCmpProjectHostProfile
  public let issues: [String]

  public init(
    sessionID: String,
    projectID: String,
    summary: String,
    createdAt: String,
    hostProfile: PraxisCmpProjectHostProfile,
    issues: [String]
  ) {
    self.sessionID = sessionID
    self.projectID = projectID
    self.summary = summary
    self.createdAt = createdAt
    self.hostProfile = hostProfile
    self.issues = issues
  }
}

public struct PraxisReadbackCmpProjectCommand: Sendable, Equatable, Codable {
  public let projectID: String

  public init(projectID: String) {
    self.projectID = projectID
  }
}

public struct PraxisCmpProjectReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let hostSummary: String
  public let persistenceSummary: String
  public let coordinationSummary: String
  public let hostProfile: PraxisCmpProjectHostProfile
  public let componentStatuses: PraxisCmpProjectComponentStatusMap
  public let issues: [String]

  public init(
    projectID: String,
    summary: String,
    hostSummary: String,
    persistenceSummary: String,
    coordinationSummary: String,
    hostProfile: PraxisCmpProjectHostProfile,
    componentStatuses: PraxisCmpProjectComponentStatusMap,
    issues: [String]
  ) {
    self.projectID = projectID
    self.summary = summary
    self.hostSummary = hostSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
    self.hostProfile = hostProfile
    self.componentStatuses = componentStatuses
    self.issues = issues
  }
}

public struct PraxisBootstrapCmpProjectCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentIDs: [String]
  public let defaultAgentID: String?
  public let repoName: String?
  public let repoRootPath: String?
  public let defaultBranchName: String?
  public let databaseName: String?
  public let namespaceRoot: String?

  public init(
    projectID: String,
    agentIDs: [String] = [],
    defaultAgentID: String? = nil,
    repoName: String? = nil,
    repoRootPath: String? = nil,
    defaultBranchName: String? = nil,
    databaseName: String? = nil,
    namespaceRoot: String? = nil
  ) {
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

public struct PraxisCmpProjectBootstrap: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let hostSummary: String
  public let persistenceSummary: String
  public let coordinationSummary: String
  public let hostProfile: PraxisCmpProjectHostProfile
  public let gitReceipt: PraxisCmpGitBackendReceipt
  public let gitBranchRuntimes: [PraxisCmpGitBranchRuntime]
  public let dbReceipt: PraxisCmpDbBootstrapReceipt
  public let mqReceipts: [PraxisCmpMqBootstrapReceipt]
  public let lineages: [PraxisCmpAgentLineage]
  public let issues: [String]

  public init(
    projectID: String,
    summary: String,
    hostSummary: String,
    persistenceSummary: String,
    coordinationSummary: String,
    hostProfile: PraxisCmpProjectHostProfile,
    gitReceipt: PraxisCmpGitBackendReceipt,
    gitBranchRuntimes: [PraxisCmpGitBranchRuntime],
    dbReceipt: PraxisCmpDbBootstrapReceipt,
    mqReceipts: [PraxisCmpMqBootstrapReceipt],
    lineages: [PraxisCmpAgentLineage],
    issues: [String]
  ) {
    self.projectID = projectID
    self.summary = summary
    self.hostSummary = hostSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
    self.hostProfile = hostProfile
    self.gitReceipt = gitReceipt
    self.gitBranchRuntimes = gitBranchRuntimes
    self.dbReceipt = dbReceipt
    self.mqReceipts = mqReceipts
    self.lineages = lineages
    self.issues = issues
  }
}

public struct PraxisRecoverCmpProjectCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let reason: String
  public let lineageID: PraxisCmpLineageID?
  public let branchRef: PraxisCmpRefName?
  public let snapshotID: PraxisCmpSnapshotID?
  public let packageKind: PraxisCmpContextPackageKind
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel?

  init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    reason: String,
    lineageID: PraxisCmpLineageID?,
    branchRef: PraxisCmpRefName? = nil,
    snapshotID: PraxisCmpSnapshotID? = nil,
    packageKind: PraxisCmpContextPackageKind = .historicalReply,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil,
    canonical _: Void
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.reason = reason
    self.lineageID = lineageID
    self.branchRef = praxisCmpNormalizedRef(branchRef)
    self.snapshotID = snapshotID
    self.packageKind = packageKind
    self.fidelityLabel = fidelityLabel
  }

  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    reason: String,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: PraxisCmpRefName? = nil,
    snapshotID: PraxisCmpSnapshotID? = nil,
    packageKind: PraxisCmpContextPackageKind = .historicalReply,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      targetAgentID: targetAgentID,
      reason: reason,
      lineageID: lineageID,
      branchRef: branchRef,
      snapshotID: snapshotID,
      packageKind: packageKind,
      fidelityLabel: fidelityLabel,
      canonical: ()
    )
  }

  @_disfavoredOverload
  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    reason: String,
    lineageID: String?,
    branchRef: String? = nil,
    snapshotID: PraxisCmpSnapshotID? = nil,
    packageKind: PraxisCmpContextPackageKind = .historicalReply,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      targetAgentID: targetAgentID,
      reason: reason,
      lineageID: lineageID.map(PraxisCmpLineageID.init(rawValue:)),
      branchRef: praxisCmpOptionalRef(branchRef),
      snapshotID: snapshotID,
      packageKind: packageKind,
      fidelityLabel: fidelityLabel,
      canonical: ()
    )
  }
}

public struct PraxisCmpProjectRecovery: Sendable, Equatable, Codable {
  public let projectID: String
  public let sourceAgentID: String
  public let targetAgentID: String
  public let summary: String
  public let status: PraxisCmpRecoveryStatus
  public let recoverySource: PraxisCmpRecoverySource
  public let foundHistoricalContext: Bool
  public let snapshotID: PraxisCmpSnapshotID?
  public let packageID: PraxisCmpPackageID
  public let packageKind: PraxisCmpContextPackageKind
  public let projectionRecoverySummary: String?
  public let hydratedRecoverySummary: String
  public let resumableProjectionCount: Int
  public let missingProjectionCount: Int
  public let issues: [String]

  public init(
    projectID: String,
    sourceAgentID: String,
    targetAgentID: String,
    summary: String,
    status: PraxisCmpRecoveryStatus,
    recoverySource: PraxisCmpRecoverySource,
    foundHistoricalContext: Bool,
    snapshotID: PraxisCmpSnapshotID? = nil,
    packageID: PraxisCmpPackageID,
    packageKind: PraxisCmpContextPackageKind,
    projectionRecoverySummary: String? = nil,
    hydratedRecoverySummary: String,
    resumableProjectionCount: Int,
    missingProjectionCount: Int,
    issues: [String]
  ) {
    self.projectID = projectID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.summary = summary
    self.status = status
    self.recoverySource = recoverySource
    self.foundHistoricalContext = foundHistoricalContext
    self.snapshotID = snapshotID
    self.packageID = packageID
    self.packageKind = packageKind
    self.projectionRecoverySummary = projectionRecoverySummary
    self.hydratedRecoverySummary = hydratedRecoverySummary
    self.resumableProjectionCount = resumableProjectionCount
    self.missingProjectionCount = missingProjectionCount
    self.issues = issues
  }
}

public struct PraxisIngestCmpFlowCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let runID: String?
  public let lineageID: PraxisCmpLineageID?
  public let parentAgentID: String?
  public let taskSummary: String
  public let materials: [PraxisCmpRuntimeContextMaterial]
  public let requiresActiveSync: Bool

  init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: PraxisCmpLineageID?,
    parentAgentID: String? = nil,
    taskSummary: String,
    materials: [PraxisCmpRuntimeContextMaterial],
    requiresActiveSync: Bool = false,
    canonical _: Void
  ) {
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

  public init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: PraxisCmpLineageID? = nil,
    parentAgentID: String? = nil,
    taskSummary: String,
    materials: [PraxisCmpRuntimeContextMaterial],
    requiresActiveSync: Bool = false
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      sessionID: sessionID,
      runID: runID,
      lineageID: lineageID,
      parentAgentID: parentAgentID,
      taskSummary: taskSummary,
      materials: materials,
      requiresActiveSync: requiresActiveSync,
      canonical: ()
    )
  }

  @_disfavoredOverload
  public init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: String?,
    parentAgentID: String? = nil,
    taskSummary: String,
    materials: [PraxisCmpRuntimeContextMaterial],
    requiresActiveSync: Bool = false
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      sessionID: sessionID,
      runID: runID,
      lineageID: lineageID.map(PraxisCmpLineageID.init(rawValue:)),
      parentAgentID: parentAgentID,
      taskSummary: taskSummary,
      materials: materials,
      requiresActiveSync: requiresActiveSync,
      canonical: ()
    )
  }
}

public struct PraxisCmpFlowIngest: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let summary: String
  public let requestID: PraxisCmpRequestID
  public let result: PraxisIngestRuntimeContextResult
  public let ingress: PraxisSectionIngressRecord
  public let loweredSections: [PraxisSectionLoweringPlan]
  public let roleAssignments: [PraxisRoleAssignment]

  public init(
    projectID: String,
    agentID: String,
    sessionID: String,
    summary: String,
    requestID: PraxisCmpRequestID,
    result: PraxisIngestRuntimeContextResult,
    ingress: PraxisSectionIngressRecord,
    loweredSections: [PraxisSectionLoweringPlan],
    roleAssignments: [PraxisRoleAssignment]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.summary = summary
    self.requestID = requestID
    self.result = result
    self.ingress = ingress
    self.loweredSections = loweredSections
    self.roleAssignments = roleAssignments
  }
}

public struct PraxisCommitCmpFlowCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let runID: String?
  public let lineageID: PraxisCmpLineageID?
  public let parentAgentID: String?
  public let eventIDs: [PraxisCmpEventID]
  public let baseRef: PraxisCmpRefName?
  public let changeSummary: String
  public let syncIntent: PraxisCmpContextSyncIntent

  init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: PraxisCmpLineageID?,
    parentAgentID: String? = nil,
    eventIDs: [PraxisCmpEventID],
    baseRef: PraxisCmpRefName? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent,
    canonical _: Void
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.runID = runID
    self.lineageID = lineageID
    self.parentAgentID = parentAgentID
    self.eventIDs = eventIDs
    self.baseRef = praxisCmpNormalizedRef(baseRef)
    self.changeSummary = changeSummary
    self.syncIntent = syncIntent
  }

  public init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: PraxisCmpLineageID? = nil,
    parentAgentID: String? = nil,
    eventIDs: [PraxisCmpEventID],
    baseRef: PraxisCmpRefName? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      sessionID: sessionID,
      runID: runID,
      lineageID: lineageID,
      parentAgentID: parentAgentID,
      eventIDs: eventIDs,
      baseRef: baseRef,
      changeSummary: changeSummary,
      syncIntent: syncIntent,
      canonical: ()
    )
  }

  @_disfavoredOverload
  public init(
    projectID: String,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    lineageID: String?,
    parentAgentID: String? = nil,
    eventIDs: [PraxisCmpEventID],
    baseRef: String? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      sessionID: sessionID,
      runID: runID,
      lineageID: lineageID.map(PraxisCmpLineageID.init(rawValue:)),
      parentAgentID: parentAgentID,
      eventIDs: eventIDs,
      baseRef: praxisCmpOptionalRef(baseRef),
      changeSummary: changeSummary,
      syncIntent: syncIntent,
      canonical: ()
    )
  }
}

public struct PraxisCmpFlowCommit: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let summary: String
  public let result: PraxisCommitContextDeltaResult
  public let snapshotCandidate: PraxisCmpSnapshotCandidate
  public let activeLine: PraxisCmpActiveLineRecord

  public init(
    projectID: String,
    agentID: String,
    summary: String,
    result: PraxisCommitContextDeltaResult,
    snapshotCandidate: PraxisCmpSnapshotCandidate,
    activeLine: PraxisCmpActiveLineRecord
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.result = result
    self.snapshotCandidate = snapshotCandidate
    self.activeLine = activeLine
  }
}

public struct PraxisResolveCmpFlowCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let lineageID: PraxisCmpLineageID?
  public let branchRef: PraxisCmpRefName?

  init(
    projectID: String,
    agentID: String,
    lineageID: PraxisCmpLineageID?,
    branchRef: PraxisCmpRefName? = nil,
    canonical _: Void
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.lineageID = lineageID
    self.branchRef = praxisCmpNormalizedRef(branchRef)
  }

  public init(
    projectID: String,
    agentID: String,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: PraxisCmpRefName? = nil
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      lineageID: lineageID,
      branchRef: branchRef,
      canonical: ()
    )
  }

  @_disfavoredOverload
  public init(
    projectID: String,
    agentID: String,
    lineageID: String?,
    branchRef: String? = nil
  ) {
    self.init(
      projectID: projectID,
      agentID: agentID,
      lineageID: lineageID.map(PraxisCmpLineageID.init(rawValue:)),
      branchRef: praxisCmpOptionalRef(branchRef),
      canonical: ()
    )
  }
}

public struct PraxisCmpFlowResolve: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let summary: String
  public let result: PraxisResolveCheckedSnapshotResult
  public let snapshot: PraxisCmpCheckedSnapshot?

  public init(
    projectID: String,
    agentID: String,
    summary: String,
    result: PraxisResolveCheckedSnapshotResult,
    snapshot: PraxisCmpCheckedSnapshot?
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.result = result
    self.snapshot = snapshot
  }
}

public struct PraxisMaterializeCmpFlowCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let snapshotID: PraxisCmpSnapshotID?
  public let projectionID: PraxisCmpProjectionID?
  public let packageKind: PraxisCmpContextPackageKind
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel?

  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    snapshotID: PraxisCmpSnapshotID? = nil,
    projectionID: PraxisCmpProjectionID? = nil,
    packageKind: PraxisCmpContextPackageKind,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.snapshotID = snapshotID
    self.projectionID = projectionID
    self.packageKind = packageKind
    self.fidelityLabel = fidelityLabel
  }
}

public struct PraxisCmpFlowMaterialize: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let summary: String
  public let result: PraxisMaterializeContextPackageResult
  public let materializationPlan: PraxisMaterializationPlan

  public init(
    projectID: String,
    agentID: String,
    summary: String,
    result: PraxisMaterializeContextPackageResult,
    materializationPlan: PraxisMaterializationPlan
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.result = result
    self.materializationPlan = materializationPlan
  }
}

public struct PraxisDispatchCmpFlowCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let contextPackage: PraxisCmpContextPackage
  public let targetKind: PraxisCmpDispatchTargetKind
  public let reason: String

  public init(
    projectID: String,
    agentID: String,
    contextPackage: PraxisCmpContextPackage,
    targetKind: PraxisCmpDispatchTargetKind,
    reason: String
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.contextPackage = contextPackage
    self.targetKind = targetKind
    self.reason = reason
  }
}

public struct PraxisRetryCmpDispatchCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let packageID: PraxisCmpPackageID
  public let reason: String?

  public init(
    projectID: String,
    agentID: String,
    packageID: PraxisCmpPackageID,
    reason: String? = nil
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.packageID = packageID
    self.reason = reason
  }
}

public struct PraxisCmpFlowDispatch: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let summary: String
  public let result: PraxisDispatchContextPackageResult
  public let deliveryPlan: PraxisDeliveryPlan

  public init(
    projectID: String,
    agentID: String,
    summary: String,
    result: PraxisDispatchContextPackageResult,
    deliveryPlan: PraxisDeliveryPlan
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.result = result
    self.deliveryPlan = deliveryPlan
  }
}

public struct PraxisRequestCmpHistoryCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let requesterAgentID: String
  public let reason: String
  public let query: PraxisCmpHistoricalContextQuery

  public init(
    projectID: String,
    requesterAgentID: String,
    reason: String,
    query: PraxisCmpHistoricalContextQuery
  ) {
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.reason = reason
    self.query = query
  }
}

public struct PraxisCmpFlowHistory: Sendable, Equatable, Codable {
  public let projectID: String
  public let requesterAgentID: String
  public let summary: String
  public let result: PraxisRequestHistoricalContextResult

  public init(
    projectID: String,
    requesterAgentID: String,
    summary: String,
    result: PraxisRequestHistoricalContextResult
  ) {
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.summary = summary
    self.result = result
  }
}

/// Describes how CMP orchestration should execute work once a control surface is resolved.
public enum PraxisCmpExecutionStyle: String, Sendable, Equatable, Codable {
  case automatic
  case manual
  case guided
}

/// Describes the host-neutral CMP routing posture that should be projected into TAP mode.
public enum PraxisCmpControlMode: String, Sendable, Equatable, Codable {
  case activePreferred = "active_preferred"
  case peerReview = "peer_review"
  case manual
  case humanGate = "human_gate"
  case restricted
  case bapr
  case yolo
  case permissive
  case strict
  case balanced
  case standard
  case automatic
}

/// Describes which persisted truth source CMP should prefer during readback.
public enum PraxisCmpReadbackPriority: String, Sendable, Equatable, Codable {
  case gitFirst = "git_first"
  case packageFirst = "package_first"
}

/// Describes which fallback path CMP should use when preferred truth is unavailable.
public enum PraxisCmpFallbackPolicy: String, Sendable, Equatable, Codable {
  case gitRebuild = "git_rebuild"
  case registryOnly = "registry_only"
}

/// Describes which recovery posture CMP should prefer when rebuilding runtime state.
public enum PraxisCmpRecoveryPreference: String, Sendable, Equatable, Codable {
  case reconcile
  case resumeLatest = "resume_latest"
}

public struct PraxisCmpControlSurface: Sendable, Equatable, Codable {
  public let executionStyle: PraxisCmpExecutionStyle
  public let mode: PraxisCmpControlMode
  public let readbackPriority: PraxisCmpReadbackPriority
  public let fallbackPolicy: PraxisCmpFallbackPolicy
  public let recoveryPreference: PraxisCmpRecoveryPreference
  public let automation: PraxisCmpAutomationMap

  public init(
    executionStyle: PraxisCmpExecutionStyle,
    mode: PraxisCmpControlMode,
    readbackPriority: PraxisCmpReadbackPriority,
    fallbackPolicy: PraxisCmpFallbackPolicy,
    recoveryPreference: PraxisCmpRecoveryPreference,
    automation: PraxisCmpAutomationMap
  ) {
    self.executionStyle = executionStyle
    self.mode = mode
    self.readbackPriority = readbackPriority
    self.fallbackPolicy = fallbackPolicy
    self.recoveryPreference = recoveryPreference
    self.automation = automation
  }
}

public struct PraxisCmpRoleReadback: Sendable, Equatable, Codable {
  public let role: PraxisFiveAgentRole
  public let assignmentCount: Int
  public let latestStage: PraxisCmpRoleStage?
  public let summary: String

  public init(
    role: PraxisFiveAgentRole,
    assignmentCount: Int,
    latestStage: PraxisCmpRoleStage? = nil,
    summary: String
  ) {
    self.role = role
    self.assignmentCount = assignmentCount
    self.latestStage = latestStage
    self.summary = summary
  }
}

public struct PraxisCmpObjectModelReadback: Sendable, Equatable, Codable {
  public let projectionCount: Int
  public let snapshotCount: Int
  public let packageCount: Int
  public let deliveryCount: Int
  public let packageStatusCounts: PraxisCmpPackageStatusCountMap

  public init(
    projectionCount: Int,
    snapshotCount: Int,
    packageCount: Int,
    deliveryCount: Int,
    packageStatusCounts: PraxisCmpPackageStatusCountMap
  ) {
    self.projectionCount = projectionCount
    self.snapshotCount = snapshotCount
    self.packageCount = packageCount
    self.deliveryCount = deliveryCount
    self.packageStatusCounts = packageStatusCounts
  }
}

public struct PraxisReadbackCmpRolesCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?

  public init(projectID: String, agentID: String? = nil) {
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisCmpRolesReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let roles: [PraxisCmpRoleReadback]
  public let latestPackageID: PraxisCmpPackageID?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    roles: [PraxisCmpRoleReadback],
    latestPackageID: PraxisCmpPackageID? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.roles = roles
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.issues = issues
  }
}

public struct PraxisReadbackCmpControlCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?

  public init(projectID: String, agentID: String? = nil) {
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisCmpControlReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let control: PraxisCmpControlSurface
  public let latestPackageID: PraxisCmpPackageID?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let latestTargetAgentID: String?
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    control: PraxisCmpControlSurface,
    latestPackageID: PraxisCmpPackageID? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    latestTargetAgentID: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.control = control
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.latestTargetAgentID = latestTargetAgentID
    self.issues = issues
  }
}

public struct PraxisUpdateCmpControlCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let executionStyle: PraxisCmpExecutionStyle?
  public let mode: PraxisCmpControlMode?
  public let readbackPriority: PraxisCmpReadbackPriority?
  public let fallbackPolicy: PraxisCmpFallbackPolicy?
  public let recoveryPreference: PraxisCmpRecoveryPreference?
  public let automation: PraxisCmpAutomationMap

  public init(
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle? = nil,
    mode: PraxisCmpControlMode? = nil,
    readbackPriority: PraxisCmpReadbackPriority? = nil,
    fallbackPolicy: PraxisCmpFallbackPolicy? = nil,
    recoveryPreference: PraxisCmpRecoveryPreference? = nil,
    automation: PraxisCmpAutomationMap = .empty
  ) {
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

public struct PraxisCmpControlUpdate: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let control: PraxisCmpControlSurface
  public let storedAt: String
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    control: PraxisCmpControlSurface,
    storedAt: String,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.control = control
    self.storedAt = storedAt
    self.issues = issues
  }
}

public struct PraxisRequestCmpPeerApprovalCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let requestedTier: PraxisTapCapabilityTier
  public let summary: String

  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    requestedTier: PraxisTapCapabilityTier,
    summary: String
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.summary = summary
  }
}

public struct PraxisCmpPeerApproval: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let requestedTier: PraxisTapCapabilityTier
  public let summary: String
  public let route: PraxisReviewerRoute
  public let outcome: PraxisCmpPeerApprovalOutcome
  public let tapMode: PraxisTapMode
  public let riskLevel: PraxisTapRiskLevel
  public let humanGateState: PraxisHumanGateState
  public let requestedAt: String
  public let decisionSummary: String

  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    requestedTier: PraxisTapCapabilityTier,
    summary: String,
    route: PraxisReviewerRoute,
    outcome: PraxisCmpPeerApprovalOutcome,
    tapMode: PraxisTapMode,
    riskLevel: PraxisTapRiskLevel,
    humanGateState: PraxisHumanGateState,
    requestedAt: String,
    decisionSummary: String
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.summary = summary
    self.route = route
    self.outcome = outcome
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.requestedAt = requestedAt
    self.decisionSummary = decisionSummary
  }
}

public struct PraxisReadbackCmpPeerApprovalCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let targetAgentID: String?
  public let capabilityKey: PraxisCapabilityID?

  public init(
    projectID: String,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: PraxisCapabilityID? = nil
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
  }
}

public struct PraxisDecideCmpPeerApprovalCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: PraxisCapabilityID
  public let decision: PraxisCmpPeerApprovalDecision
  public let reviewerAgentID: String?
  public let decisionSummary: String

  public init(
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    decision: PraxisCmpPeerApprovalDecision,
    reviewerAgentID: String? = nil,
    decisionSummary: String
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.decision = decision
    self.reviewerAgentID = reviewerAgentID
    self.decisionSummary = decisionSummary
  }
}

public struct PraxisCmpPeerApprovalReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let targetAgentID: String?
  public let capabilityKey: PraxisCapabilityID?
  public let requestedTier: PraxisTapCapabilityTier?
  public let summary: String
  public let route: PraxisReviewerRoute?
  public let outcome: PraxisCmpPeerApprovalOutcome?
  public let tapMode: PraxisTapMode?
  public let riskLevel: PraxisTapRiskLevel?
  public let humanGateState: PraxisHumanGateState?
  public let requestedAt: String?
  public let decisionSummary: String?
  public let found: Bool
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: PraxisCapabilityID? = nil,
    requestedTier: PraxisTapCapabilityTier? = nil,
    summary: String,
    route: PraxisReviewerRoute? = nil,
    outcome: PraxisCmpPeerApprovalOutcome? = nil,
    tapMode: PraxisTapMode? = nil,
    riskLevel: PraxisTapRiskLevel? = nil,
    humanGateState: PraxisHumanGateState? = nil,
    requestedAt: String? = nil,
    decisionSummary: String? = nil,
    found: Bool,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.summary = summary
    self.route = route
    self.outcome = outcome
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.requestedAt = requestedAt
    self.decisionSummary = decisionSummary
    self.found = found
    self.issues = issues
  }
}

public struct PraxisReadbackCmpStatusCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?

  public init(projectID: String, agentID: String? = nil) {
    self.projectID = projectID
    self.agentID = agentID
  }
}

public struct PraxisCmpStatusReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String?
  public let summary: String
  public let control: PraxisCmpControlSurface
  public let roles: [PraxisCmpRoleReadback]
  public let objectModel: PraxisCmpObjectModelReadback
  public let latestPackageID: PraxisCmpPackageID?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let latestTargetAgentID: String?
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String? = nil,
    summary: String,
    control: PraxisCmpControlSurface,
    roles: [PraxisCmpRoleReadback],
    objectModel: PraxisCmpObjectModelReadback,
    latestPackageID: PraxisCmpPackageID? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    latestTargetAgentID: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.summary = summary
    self.control = control
    self.roles = roles
    self.objectModel = objectModel
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.latestTargetAgentID = latestTargetAgentID
    self.issues = issues
  }
}

public struct PraxisRuntimeSmokeCheckRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let gate: PraxisRuntimeSmokeGate
  public let status: PraxisRuntimeTruthLayerStatus
  public let summary: String

  public init(
    id: String,
    gate: PraxisRuntimeSmokeGate,
    status: PraxisRuntimeTruthLayerStatus,
    summary: String
  ) {
    self.id = id
    self.gate = gate
    self.status = status
    self.summary = summary
  }
}

public struct PraxisCmpSmokeCheckRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let gate: PraxisCmpSmokeGate
  public let status: PraxisCmpProjectComponentStatus
  public let summary: String

  public init(
    id: String,
    gate: PraxisCmpSmokeGate,
    status: PraxisCmpProjectComponentStatus,
    summary: String
  ) {
    self.id = id
    self.gate = gate
    self.status = status
    self.summary = summary
  }
}

public struct PraxisSmokeCmpProjectCommand: Sendable, Equatable, Codable {
  public let projectID: String

  public init(projectID: String) {
    self.projectID = projectID
  }
}

public struct PraxisCmpProjectSmoke: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let checks: [PraxisCmpSmokeCheckRecord]

  public init(
    projectID: String,
    summary: String,
    checks: [PraxisCmpSmokeCheckRecord]
  ) {
    self.projectID = projectID
    self.summary = summary
    self.checks = checks
  }
}

public struct PraxisMpInspection: Sendable, Equatable, Codable {
  public let summary: String
  public let workflowSummary: String
  public let memoryStoreSummary: String
  public let multimodalSummary: String
  public let issues: [String]

  public init(
    summary: String,
    workflowSummary: String,
    memoryStoreSummary: String,
    multimodalSummary: String,
    issues: [String]
  ) {
    self.summary = summary
    self.workflowSummary = workflowSummary
    self.memoryStoreSummary = memoryStoreSummary
    self.multimodalSummary = multimodalSummary
    self.issues = issues
  }
}
