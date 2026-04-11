import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisRun
import PraxisSession
import PraxisRuntimeUseCases

/// Describes which lifecycle path produced the current run summary.
public enum PraxisRunLifecycleDisposition: String, Sendable, Equatable, Codable {
  case started
  case resumed
  case recoveredWithoutResume
}

public struct PraxisRunSummary: Sendable, Equatable, Codable {
  public let runID: PraxisRunID
  public let sessionID: PraxisSessionID
  public let phase: PraxisRunPhase
  public let tickCount: Int
  public let lifecycleDisposition: PraxisRunLifecycleDisposition
  public let journalSequence: Int?
  public let checkpointReference: String?
  public let recoveredEventCount: Int
  public let followUpAction: PraxisRunFollowUpAction?
  public let phaseSummary: String

  public init(
    runID: PraxisRunID,
    sessionID: PraxisSessionID,
    phase: PraxisRunPhase,
    tickCount: Int,
    lifecycleDisposition: PraxisRunLifecycleDisposition,
    journalSequence: Int? = nil,
    checkpointReference: String? = nil,
    recoveredEventCount: Int = 0,
    followUpAction: PraxisRunFollowUpAction? = nil,
    phaseSummary: String
  ) {
    self.runID = runID
    self.sessionID = sessionID
    self.phase = phase
    self.tickCount = tickCount
    self.lifecycleDisposition = lifecycleDisposition
    self.journalSequence = journalSequence
    self.checkpointReference = checkpointReference
    self.recoveredEventCount = recoveredEventCount
    self.followUpAction = followUpAction
    self.phaseSummary = phaseSummary
  }
}

public struct PraxisInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String

  public init(summary: String) {
    self.summary = summary
  }
}

public struct PraxisTapInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let governanceSummary: String
  public let reviewSummary: String

  public init(summary: String, governanceSummary: String, reviewSummary: String) {
    self.summary = summary
    self.governanceSummary = governanceSummary
    self.reviewSummary = reviewSummary
  }
}

public struct PraxisTapStatusSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let readinessSummary: String
  public let projectID: String
  public let agentID: String?
  public let tapMode: String
  public let riskLevel: String
  public let humanGateState: String
  public let availableCapabilityCount: Int
  public let availableCapabilityIDs: [String]
  public let pendingApprovalCount: Int
  public let approvedApprovalCount: Int
  public let latestCapabilityKey: String?
  public let latestDecisionSummary: String?

  public init(
    summary: String,
    readinessSummary: String,
    projectID: String,
    agentID: String? = nil,
    tapMode: String,
    riskLevel: String,
    humanGateState: String,
    availableCapabilityCount: Int,
    availableCapabilityIDs: [String],
    pendingApprovalCount: Int,
    approvedApprovalCount: Int,
    latestCapabilityKey: String? = nil,
    latestDecisionSummary: String? = nil
  ) {
    self.summary = summary
    self.readinessSummary = readinessSummary
    self.projectID = projectID
    self.agentID = agentID
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.availableCapabilityCount = availableCapabilityCount
    self.availableCapabilityIDs = availableCapabilityIDs
    self.pendingApprovalCount = pendingApprovalCount
    self.approvedApprovalCount = approvedApprovalCount
    self.latestCapabilityKey = latestCapabilityKey
    self.latestDecisionSummary = latestDecisionSummary
  }
}

public struct PraxisTapHistoryEntrySnapshot: Sendable, Equatable, Codable {
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: String
  public let requestedTier: String
  public let route: String
  public let outcome: String
  public let humanGateState: String
  public let updatedAt: String
  public let decisionSummary: String

  public init(
    agentID: String,
    targetAgentID: String,
    capabilityKey: String,
    requestedTier: String,
    route: String,
    outcome: String,
    humanGateState: String,
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

public struct PraxisTapHistorySnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let totalCount: Int
  public let entries: [PraxisTapHistoryEntrySnapshot]

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    totalCount: Int,
    entries: [PraxisTapHistoryEntrySnapshot]
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.totalCount = totalCount
    self.entries = entries
  }
}

public struct PraxisCmpInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let hostRuntimeSummary: String
  public let persistenceSummary: String
  public let coordinationSummary: String

  public init(
    summary: String,
    projectID: String,
    hostRuntimeSummary: String,
    persistenceSummary: String,
    coordinationSummary: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.hostRuntimeSummary = hostRuntimeSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
  }
}

public struct PraxisCmpSessionSnapshot: Sendable, Equatable, Codable {
  public let sessionID: String
  public let projectID: String
  public let summary: String
  public let createdAt: String
  public let hostProfile: PraxisLocalRuntimeHostProfile
  public let issues: [String]

  public init(
    sessionID: String,
    projectID: String,
    summary: String,
    createdAt: String,
    hostProfile: PraxisLocalRuntimeHostProfile,
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

public struct PraxisCmpProjectReadbackSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectSummary: PraxisCmpProjectLocalRuntimeSummary
  public let persistenceSummary: String
  public let coordinationSummary: String

  public init(
    summary: String,
    projectSummary: PraxisCmpProjectLocalRuntimeSummary,
    persistenceSummary: String,
    coordinationSummary: String
  ) {
    self.summary = summary
    self.projectSummary = projectSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
  }
}

public struct PraxisCmpProjectBootstrapSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectSummary: PraxisCmpProjectLocalRuntimeSummary
  public let gitSummary: String
  public let persistenceSummary: String
  public let coordinationSummary: String

  public init(
    summary: String,
    projectSummary: PraxisCmpProjectLocalRuntimeSummary,
    gitSummary: String,
    persistenceSummary: String,
    coordinationSummary: String
  ) {
    self.summary = summary
    self.projectSummary = projectSummary
    self.gitSummary = gitSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
  }
}

public struct PraxisCmpProjectRecoverySnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let sourceAgentID: String
  public let targetAgentID: String
  public let status: PraxisCmpRecoveryStatus
  public let recoverySource: String
  public let foundHistoricalContext: Bool
  public let snapshotID: String?
  public let packageID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let projectionRecoverySummary: String?
  public let hydratedRecoverySummary: String
  public let resumableProjectionCount: Int
  public let missingProjectionCount: Int
  public let issues: [String]

  public init(
    summary: String,
    projectID: String,
    sourceAgentID: String,
    targetAgentID: String,
    status: PraxisCmpRecoveryStatus,
    recoverySource: String,
    foundHistoricalContext: Bool,
    snapshotID: String?,
    packageID: String,
    packageKind: PraxisCmpContextPackageKind,
    projectionRecoverySummary: String? = nil,
    hydratedRecoverySummary: String,
    resumableProjectionCount: Int,
    missingProjectionCount: Int,
    issues: [String]
  ) {
    self.summary = summary
    self.projectID = projectID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
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

public struct PraxisCmpFlowIngestSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let sessionID: String
  public let requestID: String
  public let acceptedEventCount: Int
  public let sectionCount: Int
  public let storedSectionCount: Int
  public let nextAction: String

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    sessionID: String,
    requestID: String,
    acceptedEventCount: Int,
    sectionCount: Int,
    storedSectionCount: Int,
    nextAction: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.requestID = requestID
    self.acceptedEventCount = acceptedEventCount
    self.sectionCount = sectionCount
    self.storedSectionCount = storedSectionCount
    self.nextAction = nextAction
  }
}

public struct PraxisCmpFlowCommitSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let deltaID: String
  public let snapshotCandidateID: String?
  public let activeLineStage: PraxisCmpActiveLineStage
  public let branchRef: String

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    deltaID: String,
    snapshotCandidateID: String?,
    activeLineStage: PraxisCmpActiveLineStage,
    branchRef: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.deltaID = deltaID
    self.snapshotCandidateID = snapshotCandidateID
    self.activeLineStage = activeLineStage
    self.branchRef = branchRef
  }
}

public struct PraxisCmpFlowResolveSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let found: Bool
  public let snapshotID: String?
  public let branchRef: String?
  public let qualityLabel: PraxisCmpCheckedSnapshotQualityLabel?

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    found: Bool,
    snapshotID: String?,
    branchRef: String?,
    qualityLabel: PraxisCmpCheckedSnapshotQualityLabel?
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.found = found
    self.snapshotID = snapshotID
    self.branchRef = branchRef
    self.qualityLabel = qualityLabel
  }
}

public struct PraxisCmpFlowMaterializeSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let packageID: String
  public let targetAgentID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let selectedSectionCount: Int

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    packageID: String,
    targetAgentID: String,
    packageKind: PraxisCmpContextPackageKind,
    selectedSectionCount: Int
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.packageID = packageID
    self.targetAgentID = targetAgentID
    self.packageKind = packageKind
    self.selectedSectionCount = selectedSectionCount
  }
}

public struct PraxisCmpFlowDispatchSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let dispatchID: String
  public let targetAgentID: String
  public let targetKind: PraxisCmpDispatchTargetKind
  public let status: PraxisCmpDispatchStatus

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    dispatchID: String,
    targetAgentID: String,
    targetKind: PraxisCmpDispatchTargetKind,
    status: PraxisCmpDispatchStatus
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.dispatchID = dispatchID
    self.targetAgentID = targetAgentID
    self.targetKind = targetKind
    self.status = status
  }
}

public struct PraxisCmpFlowHistorySnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let requesterAgentID: String
  public let found: Bool
  public let snapshotID: String?
  public let packageID: String?

  public init(
    summary: String,
    projectID: String,
    requesterAgentID: String,
    found: Bool,
    snapshotID: String?,
    packageID: String?
  ) {
    self.summary = summary
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.found = found
    self.snapshotID = snapshotID
    self.packageID = packageID
  }
}

public struct PraxisCmpRolesPanelSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let roleCounts: [String: Int]
  public let roleStages: [String: String]
  public let latestPackageID: String?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    roleCounts: [String: Int],
    roleStages: [String: String],
    latestPackageID: String? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
  }
}

public struct PraxisCmpControlPanelSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let executionStyle: PraxisCmpExecutionStyle
  public let mode: PraxisCmpControlMode
  public let readbackPriority: PraxisCmpReadbackPriority
  public let fallbackPolicy: PraxisCmpFallbackPolicy
  public let recoveryPreference: PraxisCmpRecoveryPreference
  public let automation: [String: Bool]
  public let latestPackageID: String?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let latestTargetAgentID: String?

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle,
    mode: PraxisCmpControlMode,
    readbackPriority: PraxisCmpReadbackPriority,
    fallbackPolicy: PraxisCmpFallbackPolicy,
    recoveryPreference: PraxisCmpRecoveryPreference,
    automation: [String: Bool],
    latestPackageID: String? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    latestTargetAgentID: String? = nil
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.executionStyle = executionStyle
    self.mode = mode
    self.readbackPriority = readbackPriority
    self.fallbackPolicy = fallbackPolicy
    self.recoveryPreference = recoveryPreference
    self.automation = automation
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.latestTargetAgentID = latestTargetAgentID
  }
}

public struct PraxisCmpControlUpdateSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let executionStyle: PraxisCmpExecutionStyle
  public let mode: PraxisCmpControlMode
  public let readbackPriority: PraxisCmpReadbackPriority
  public let fallbackPolicy: PraxisCmpFallbackPolicy
  public let recoveryPreference: PraxisCmpRecoveryPreference
  public let automation: [String: Bool]
  public let storedAt: String

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle,
    mode: PraxisCmpControlMode,
    readbackPriority: PraxisCmpReadbackPriority,
    fallbackPolicy: PraxisCmpFallbackPolicy,
    recoveryPreference: PraxisCmpRecoveryPreference,
    automation: [String: Bool],
    storedAt: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.executionStyle = executionStyle
    self.mode = mode
    self.readbackPriority = readbackPriority
    self.fallbackPolicy = fallbackPolicy
    self.recoveryPreference = recoveryPreference
    self.automation = automation
    self.storedAt = storedAt
  }
}

public struct PraxisCmpPeerApprovalSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String
  public let targetAgentID: String
  public let capabilityKey: String
  public let requestedTier: String
  public let route: String
  public let outcome: String
  public let tapMode: String
  public let riskLevel: String
  public let humanGateState: String
  public let requestedAt: String
  public let decisionSummary: String

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: String,
    requestedTier: String,
    route: String,
    outcome: String,
    tapMode: String,
    riskLevel: String,
    humanGateState: String,
    requestedAt: String,
    decisionSummary: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.route = route
    self.outcome = outcome
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.requestedAt = requestedAt
    self.decisionSummary = decisionSummary
  }
}

public struct PraxisCmpPeerApprovalReadbackSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let targetAgentID: String?
  public let capabilityKey: String?
  public let requestedTier: String?
  public let route: String?
  public let outcome: String?
  public let tapMode: String?
  public let riskLevel: String?
  public let humanGateState: String?
  public let requestedAt: String?
  public let decisionSummary: String?
  public let found: Bool

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: String? = nil,
    requestedTier: String? = nil,
    route: String? = nil,
    outcome: String? = nil,
    tapMode: String? = nil,
    riskLevel: String? = nil,
    humanGateState: String? = nil,
    requestedAt: String? = nil,
    decisionSummary: String? = nil,
    found: Bool
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityKey = capabilityKey
    self.requestedTier = requestedTier
    self.route = route
    self.outcome = outcome
    self.tapMode = tapMode
    self.riskLevel = riskLevel
    self.humanGateState = humanGateState
    self.requestedAt = requestedAt
    self.decisionSummary = decisionSummary
    self.found = found
  }
}

public struct PraxisCmpStatusPanelSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let executionStyle: PraxisCmpExecutionStyle
  public let readbackPriority: PraxisCmpReadbackPriority
  public let packageCount: Int
  public let latestPackageID: String?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let roleCounts: [String: Int]
  public let roleStages: [String: String]

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle,
    readbackPriority: PraxisCmpReadbackPriority,
    packageCount: Int,
    latestPackageID: String? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    roleCounts: [String: Int],
    roleStages: [String: String]
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.executionStyle = executionStyle
    self.readbackPriority = readbackPriority
    self.packageCount = packageCount
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.roleCounts = roleCounts
    self.roleStages = roleStages
  }
}

public struct PraxisCmpProjectSmokeSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let smokeResult: PraxisRuntimeSmokeResult

  public init(projectID: String, smokeResult: PraxisRuntimeSmokeResult) {
    self.projectID = projectID
    self.smokeResult = smokeResult
  }
}

public struct PraxisMpInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let workflowSummary: String
  public let memoryStoreSummary: String
  public let multimodalSummary: String

  public init(
    summary: String,
    workflowSummary: String,
    memoryStoreSummary: String,
    multimodalSummary: String
  ) {
    self.summary = summary
    self.workflowSummary = workflowSummary
    self.memoryStoreSummary = memoryStoreSummary
    self.multimodalSummary = multimodalSummary
  }
}

public struct PraxisMpSearchHitSnapshot: Sendable, Equatable, Codable, Identifiable {
  public let memoryID: String
  public let agentID: String
  public let scopeLevel: String
  public let memoryKind: String
  public let freshnessStatus: String
  public let alignmentStatus: String
  public let summary: String
  public let storageKey: String
  public let semanticScore: Double?
  public let finalScore: Double
  public let rankExplanation: String

  public var id: String {
    memoryID
  }

  public init(
    memoryID: String,
    agentID: String,
    scopeLevel: String,
    memoryKind: String,
    freshnessStatus: String,
    alignmentStatus: String,
    summary: String,
    storageKey: String,
    semanticScore: Double?,
    finalScore: Double,
    rankExplanation: String
  ) {
    self.memoryID = memoryID
    self.agentID = agentID
    self.scopeLevel = scopeLevel
    self.memoryKind = memoryKind
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.summary = summary
    self.storageKey = storageKey
    self.semanticScore = semanticScore
    self.finalScore = finalScore
    self.rankExplanation = rankExplanation
  }
}

public struct PraxisMpSearchSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let summary: String
  public let hits: [PraxisMpSearchHitSnapshot]
  public let issues: [String]

  public init(
    projectID: String,
    query: String,
    summary: String,
    hits: [PraxisMpSearchHitSnapshot],
    issues: [String]
  ) {
    self.projectID = projectID
    self.query = query
    self.summary = summary
    self.hits = hits
    self.issues = issues
  }
}

public struct PraxisMpReadbackSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let totalMemoryCount: Int
  public let primaryCount: Int
  public let supportingCount: Int
  public let omittedSupersededCount: Int
  public let freshnessBreakdown: [String: Int]
  public let alignmentBreakdown: [String: Int]
  public let scopeBreakdown: [String: Int]
  public let issues: [String]

  public init(
    projectID: String,
    summary: String,
    totalMemoryCount: Int,
    primaryCount: Int,
    supportingCount: Int,
    omittedSupersededCount: Int,
    freshnessBreakdown: [String: Int],
    alignmentBreakdown: [String: Int],
    scopeBreakdown: [String: Int],
    issues: [String]
  ) {
    self.projectID = projectID
    self.summary = summary
    self.totalMemoryCount = totalMemoryCount
    self.primaryCount = primaryCount
    self.supportingCount = supportingCount
    self.omittedSupersededCount = omittedSupersededCount
    self.freshnessBreakdown = freshnessBreakdown
    self.alignmentBreakdown = alignmentBreakdown
    self.scopeBreakdown = scopeBreakdown
    self.issues = issues
  }
}

public struct PraxisMpSmokeSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let smokeResult: PraxisRuntimeSmokeResult

  public init(
    projectID: String,
    summary: String,
    smokeResult: PraxisRuntimeSmokeResult
  ) {
    self.projectID = projectID
    self.summary = summary
    self.smokeResult = smokeResult
  }
}

public struct PraxisMpRerankCompositionSnapshot: Sendable, Equatable, Codable {
  public let fresh: Int
  public let aging: Int
  public let stale: Int
  public let superseded: Int
  public let aligned: Int
  public let unreviewed: Int
  public let drifted: Int

  public init(
    fresh: Int,
    aging: Int,
    stale: Int,
    superseded: Int,
    aligned: Int,
    unreviewed: Int,
    drifted: Int
  ) {
    self.fresh = fresh
    self.aging = aging
    self.stale = stale
    self.superseded = superseded
    self.aligned = aligned
    self.unreviewed = unreviewed
    self.drifted = drifted
  }
}

public struct PraxisMpIngestSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String?
  public let summary: String
  public let primaryMemoryID: String
  public let storageKey: String
  public let updatedMemoryIDs: [String]
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let decision: String
  public let freshnessStatus: String
  public let alignmentStatus: String
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    summary: String,
    primaryMemoryID: String,
    storageKey: String,
    updatedMemoryIDs: [String],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decision: String,
    freshnessStatus: String,
    alignmentStatus: String,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.summary = summary
    self.primaryMemoryID = primaryMemoryID
    self.storageKey = storageKey
    self.updatedMemoryIDs = updatedMemoryIDs
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.decision = decision
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.issues = issues
  }
}

public struct PraxisMpAlignSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let primaryMemoryID: String
  public let updatedMemoryIDs: [String]
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let decision: String
  public let freshnessStatus: String
  public let alignmentStatus: String
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    primaryMemoryID: String,
    updatedMemoryIDs: [String],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decision: String,
    freshnessStatus: String,
    alignmentStatus: String,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.primaryMemoryID = primaryMemoryID
    self.updatedMemoryIDs = updatedMemoryIDs
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.decision = decision
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.issues = issues
  }
}

public struct PraxisMpPromoteSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let scopeLevel: String
  public let sessionID: String?
  public let sessionMode: String
  public let visibilityState: String
  public let promotionState: String
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: String,
    sessionID: String? = nil,
    sessionMode: String,
    visibilityState: String,
    promotionState: String,
    updatedAt: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.scopeLevel = scopeLevel
    self.sessionID = sessionID
    self.sessionMode = sessionMode
    self.visibilityState = visibilityState
    self.promotionState = promotionState
    self.updatedAt = updatedAt
    self.issues = issues
  }
}

public struct PraxisMpArchiveSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let scopeLevel: String
  public let sessionID: String?
  public let sessionMode: String
  public let visibilityState: String
  public let promotionState: String
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: String,
    sessionID: String? = nil,
    sessionMode: String,
    visibilityState: String,
    promotionState: String,
    updatedAt: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.scopeLevel = scopeLevel
    self.sessionID = sessionID
    self.sessionMode = sessionMode
    self.visibilityState = visibilityState
    self.promotionState = promotionState
    self.updatedAt = updatedAt
    self.issues = issues
  }
}

public struct PraxisMpResolveSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let summary: String
  public let primaryMemoryIDs: [String]
  public let supportingMemoryIDs: [String]
  public let omittedSupersededMemoryIDs: [String]
  public let rerankComposition: PraxisMpRerankCompositionSnapshot
  public let roleCounts: [String: Int]
  public let roleStages: [String: String]
  public let issues: [String]

  public init(
    projectID: String,
    query: String,
    summary: String,
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankCompositionSnapshot,
    roleCounts: [String: Int],
    roleStages: [String: String],
    issues: [String]
  ) {
    self.projectID = projectID
    self.query = query
    self.summary = summary
    self.primaryMemoryIDs = primaryMemoryIDs
    self.supportingMemoryIDs = supportingMemoryIDs
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
    self.rerankComposition = rerankComposition
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.issues = issues
  }
}

public struct PraxisMpHistorySnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let requesterAgentID: String
  public let query: String
  public let reason: String
  public let summary: String
  public let primaryMemoryIDs: [String]
  public let supportingMemoryIDs: [String]
  public let omittedSupersededMemoryIDs: [String]
  public let rerankComposition: PraxisMpRerankCompositionSnapshot
  public let roleCounts: [String: Int]
  public let roleStages: [String: String]
  public let issues: [String]

  public init(
    projectID: String,
    requesterAgentID: String,
    query: String,
    reason: String,
    summary: String,
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankCompositionSnapshot,
    roleCounts: [String: Int],
    roleStages: [String: String],
    issues: [String]
  ) {
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.query = query
    self.reason = reason
    self.summary = summary
    self.primaryMemoryIDs = primaryMemoryIDs
    self.supportingMemoryIDs = supportingMemoryIDs
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
    self.rerankComposition = rerankComposition
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.issues = issues
  }
}
