import PraxisCapabilityContracts
import PraxisCmpDelivery
import PraxisCmpFiveAgent
import PraxisCmpTypes
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpTypes
import PraxisRun
import PraxisSession
import PraxisTapReview
import PraxisTapTypes
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
  public let tapMode: PraxisTapMode
  public let riskLevel: PraxisTapRiskLevel
  public let humanGateState: PraxisHumanGateState
  public let availableCapabilityCount: Int
  public let availableCapabilityIDs: [PraxisCapabilityID]
  public let pendingApprovalCount: Int
  public let approvedApprovalCount: Int
  public let latestCapabilityKey: PraxisCapabilityID?
  public let latestDecisionSummary: String?

  public init(
    summary: String,
    readinessSummary: String,
    projectID: String,
    agentID: String? = nil,
    tapMode: PraxisTapMode,
    riskLevel: PraxisTapRiskLevel,
    humanGateState: PraxisHumanGateState,
    availableCapabilityCount: Int,
    availableCapabilityIDs: [PraxisCapabilityID],
    pendingApprovalCount: Int,
    approvedApprovalCount: Int,
    latestCapabilityKey: PraxisCapabilityID? = nil,
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
    summary: String,
    projectID: String,
    sourceAgentID: String,
    targetAgentID: String,
    status: PraxisCmpRecoveryStatus,
    recoverySource: PraxisCmpRecoverySource,
    foundHistoricalContext: Bool,
    snapshotID: PraxisCmpSnapshotID?,
    packageID: PraxisCmpPackageID,
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
  public let requestID: PraxisCmpRequestID
  public let acceptedEventCount: Int
  public let sectionCount: Int
  public let storedSectionCount: Int
  public let nextAction: PraxisCmpFlowIngestNextAction

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    sessionID: String,
    requestID: PraxisCmpRequestID,
    acceptedEventCount: Int,
    sectionCount: Int,
    storedSectionCount: Int,
    nextAction: PraxisCmpFlowIngestNextAction
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
  public let deltaID: PraxisCmpDeltaID
  public let snapshotCandidateID: PraxisCmpSnapshotID?
  public let activeLineStage: PraxisCmpActiveLineStage
  public let branchRef: String

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    deltaID: PraxisCmpDeltaID,
    snapshotCandidateID: PraxisCmpSnapshotID?,
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
  public let snapshotID: PraxisCmpSnapshotID?
  public let branchRef: String?
  public let qualityLabel: PraxisCmpCheckedSnapshotQualityLabel?

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    found: Bool,
    snapshotID: PraxisCmpSnapshotID?,
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
  public let packageID: PraxisCmpPackageID
  public let targetAgentID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let selectedSectionCount: Int

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    packageID: PraxisCmpPackageID,
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
  public let dispatchID: PraxisCmpDispatchReceiptID
  public let targetAgentID: String
  public let targetKind: PraxisCmpDispatchTargetKind
  public let status: PraxisCmpDispatchStatus

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    dispatchID: PraxisCmpDispatchReceiptID,
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
  public let snapshotID: PraxisCmpSnapshotID?
  public let packageID: PraxisCmpPackageID?

  public init(
    summary: String,
    projectID: String,
    requesterAgentID: String,
    found: Bool,
    snapshotID: PraxisCmpSnapshotID?,
    packageID: PraxisCmpPackageID?
  ) {
    self.summary = summary
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.found = found
    self.snapshotID = snapshotID
    self.packageID = packageID
  }
}

public struct PraxisCmpRoleStageMap: Sendable, Equatable, Codable {
  public let stages: [PraxisFiveAgentRole: PraxisCmpRoleStage]

  public init(stages: [PraxisFiveAgentRole: PraxisCmpRoleStage]) {
    self.stages = stages
  }

  public subscript(_ role: PraxisFiveAgentRole) -> PraxisCmpRoleStage? {
    stages[role]
  }

  public var isEmpty: Bool {
    stages.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var stages: [PraxisFiveAgentRole: PraxisCmpRoleStage] = [:]

    for key in container.allKeys {
      guard let role = PraxisFiveAgentRole(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP role key \(key.stringValue)."
        )
      }

      let rawStage = try container.decode(String.self, forKey: key)
      guard let stage = PraxisCmpRoleStage(rawValue: rawStage) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP role stage \(rawStage) for role \(role.rawValue)."
        )
      }

      stages[role] = stage
    }

    self.init(stages: stages)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for role in stages.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: role.rawValue)!
      try container.encode(
        stages[role]?.rawValue,
        forKey: key
      )
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}

public struct PraxisCmpRoleCountMap: Sendable, Equatable, Codable {
  public let counts: [PraxisFiveAgentRole: Int]

  public init(counts: [PraxisFiveAgentRole: Int]) {
    self.counts = counts
  }

  public subscript(_ role: PraxisFiveAgentRole) -> Int? {
    counts[role]
  }

  public var isEmpty: Bool {
    counts.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var counts: [PraxisFiveAgentRole: Int] = [:]

    for key in container.allKeys {
      guard let role = PraxisFiveAgentRole(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP role key \(key.stringValue)."
        )
      }

      counts[role] = try container.decode(Int.self, forKey: key)
    }

    self.init(counts: counts)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for role in counts.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: role.rawValue)!
      try container.encode(counts[role], forKey: key)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}

public struct PraxisCmpRolesPanelSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let agentID: String?
  public let roleCounts: PraxisCmpRoleCountMap
  public let roleStages: PraxisCmpRoleStageMap
  public let latestPackageID: PraxisCmpPackageID?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    roleCounts: PraxisCmpRoleCountMap,
    roleStages: PraxisCmpRoleStageMap,
    latestPackageID: PraxisCmpPackageID? = nil,
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
  public let automation: PraxisCmpAutomationMap
  public let latestPackageID: PraxisCmpPackageID?
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
    automation: PraxisCmpAutomationMap,
    latestPackageID: PraxisCmpPackageID? = nil,
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
  public let automation: PraxisCmpAutomationMap
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
    automation: PraxisCmpAutomationMap,
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
  public let capabilityKey: PraxisCapabilityID
  public let requestedTier: PraxisTapCapabilityTier
  public let route: PraxisReviewerRoute
  public let outcome: PraxisCmpPeerApprovalOutcome
  public let tapMode: PraxisTapMode
  public let riskLevel: PraxisTapRiskLevel
  public let humanGateState: PraxisHumanGateState
  public let requestedAt: String
  public let decisionSummary: String

  public init(
    summary: String,
    projectID: String,
    agentID: String,
    targetAgentID: String,
    capabilityKey: PraxisCapabilityID,
    requestedTier: PraxisTapCapabilityTier,
    route: PraxisReviewerRoute,
    outcome: PraxisCmpPeerApprovalOutcome,
    tapMode: PraxisTapMode,
    riskLevel: PraxisTapRiskLevel,
    humanGateState: PraxisHumanGateState,
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
  public let capabilityKey: PraxisCapabilityID?
  public let requestedTier: PraxisTapCapabilityTier?
  public let route: PraxisReviewerRoute?
  public let outcome: PraxisCmpPeerApprovalOutcome?
  public let tapMode: PraxisTapMode?
  public let riskLevel: PraxisTapRiskLevel?
  public let humanGateState: PraxisHumanGateState?
  public let requestedAt: String?
  public let decisionSummary: String?
  public let found: Bool

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    targetAgentID: String? = nil,
    capabilityKey: PraxisCapabilityID? = nil,
    requestedTier: PraxisTapCapabilityTier? = nil,
    route: PraxisReviewerRoute? = nil,
    outcome: PraxisCmpPeerApprovalOutcome? = nil,
    tapMode: PraxisTapMode? = nil,
    riskLevel: PraxisTapRiskLevel? = nil,
    humanGateState: PraxisHumanGateState? = nil,
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
  public let packageStatusCounts: PraxisCmpPackageStatusCountMap
  public let latestPackageID: PraxisCmpPackageID?
  public let latestDispatchStatus: PraxisCmpLatestDispatchStatus?
  public let roleCounts: PraxisCmpRoleCountMap
  public let roleStages: PraxisCmpRoleStageMap

  public init(
    summary: String,
    projectID: String,
    agentID: String? = nil,
    executionStyle: PraxisCmpExecutionStyle,
    readbackPriority: PraxisCmpReadbackPriority,
    packageCount: Int,
    packageStatusCounts: PraxisCmpPackageStatusCountMap,
    latestPackageID: PraxisCmpPackageID? = nil,
    latestDispatchStatus: PraxisCmpLatestDispatchStatus? = nil,
    roleCounts: PraxisCmpRoleCountMap,
    roleStages: PraxisCmpRoleStageMap
  ) {
    self.summary = summary
    self.projectID = projectID
    self.agentID = agentID
    self.executionStyle = executionStyle
    self.readbackPriority = readbackPriority
    self.packageCount = packageCount
    self.packageStatusCounts = packageStatusCounts
    self.latestPackageID = latestPackageID
    self.latestDispatchStatus = latestDispatchStatus
    self.roleCounts = roleCounts
    self.roleStages = roleStages
  }
}

public struct PraxisCmpProjectSmokeSnapshot: Sendable, Equatable, Codable {
  public let projectID: String
  public let smokeResult: PraxisCmpProjectSmokeResult

  public init(projectID: String, smokeResult: PraxisCmpProjectSmokeResult) {
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
  public let scopeLevel: PraxisMpScopeLevel
  public let memoryKind: PraxisMpMemoryKind
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
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
    scopeLevel: PraxisMpScopeLevel,
    memoryKind: PraxisMpMemoryKind,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
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
  public let freshnessBreakdown: PraxisMpFreshnessBreakdownMap
  public let alignmentBreakdown: PraxisMpAlignmentBreakdownMap
  public let scopeBreakdown: PraxisMpScopeBreakdownMap
  public let issues: [String]

  public init(
    projectID: String,
    summary: String,
    totalMemoryCount: Int,
    primaryCount: Int,
    supportingCount: Int,
    omittedSupersededCount: Int,
    freshnessBreakdown: PraxisMpFreshnessBreakdownMap,
    alignmentBreakdown: PraxisMpAlignmentBreakdownMap,
    scopeBreakdown: PraxisMpScopeBreakdownMap,
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
  public let decision: PraxisMpAlignmentDecision
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
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
    decision: PraxisMpAlignmentDecision,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
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
  public let decision: PraxisMpAlignmentDecision
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    primaryMemoryID: String,
    updatedMemoryIDs: [String],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decision: PraxisMpAlignmentDecision,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
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
  public let scopeLevel: PraxisMpScopeLevel
  public let sessionID: String?
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: PraxisMpScopeLevel,
    sessionID: String? = nil,
    sessionMode: PraxisMpSessionMode,
    visibilityState: PraxisMpVisibilityState,
    promotionState: PraxisMpPromotionState,
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
  public let scopeLevel: PraxisMpScopeLevel
  public let sessionID: String?
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: PraxisMpScopeLevel,
    sessionID: String? = nil,
    sessionMode: PraxisMpSessionMode,
    visibilityState: PraxisMpVisibilityState,
    promotionState: PraxisMpPromotionState,
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
  public let roleCounts: PraxisMpRoleCountMap
  public let roleStages: PraxisMpRoleStageMap
  public let issues: [String]

  public init(
    projectID: String,
    query: String,
    summary: String,
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankCompositionSnapshot,
    roleCounts: PraxisMpRoleCountMap,
    roleStages: PraxisMpRoleStageMap,
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
  public let roleCounts: PraxisMpRoleCountMap
  public let roleStages: PraxisMpRoleStageMap
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
    roleCounts: PraxisMpRoleCountMap,
    roleStages: PraxisMpRoleStageMap,
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
