import PraxisCmpTypes

public struct PraxisCmpRoleLiveSummary: Sendable, Equatable, Codable {
  public let mode: PraxisCmpRoleLiveMode
  public let status: PraxisCmpRoleLiveStatus
  public let fallbackApplied: Bool
  public let provider: String?
  public let model: String?

  public init(
    mode: PraxisCmpRoleLiveMode,
    status: PraxisCmpRoleLiveStatus,
    fallbackApplied: Bool,
    provider: String? = nil,
    model: String? = nil
  ) {
    self.mode = mode
    self.status = status
    self.fallbackApplied = fallbackApplied
    self.provider = provider
    self.model = model
  }
}

public struct PraxisCmpRoleRuntimeRecord: Sendable, Equatable, Codable {
  public let role: PraxisFiveAgentRole
  public let stage: String
  public let assignment: PraxisRoleAssignment?
  public let sourceSnapshotID: PraxisCmpSnapshotID?

  public init(
    role: PraxisFiveAgentRole,
    stage: String,
    assignment: PraxisRoleAssignment? = nil,
    sourceSnapshotID: PraxisCmpSnapshotID? = nil
  ) {
    self.role = role
    self.stage = stage
    self.assignment = assignment
    self.sourceSnapshotID = sourceSnapshotID
  }
}

public struct PraxisCmpFiveAgentFlowSummary: Sendable, Equatable, Codable {
  public let pendingPeerApprovalCount: Int
  public let approvedPeerApprovalCount: Int
  public let reinterventionPendingCount: Int

  public init(
    pendingPeerApprovalCount: Int,
    approvedPeerApprovalCount: Int,
    reinterventionPendingCount: Int
  ) {
    self.pendingPeerApprovalCount = pendingPeerApprovalCount
    self.approvedPeerApprovalCount = approvedPeerApprovalCount
    self.reinterventionPendingCount = reinterventionPendingCount
  }
}

public struct PraxisCmpFiveAgentRecoverySummary: Sendable, Equatable, Codable {
  public let resumableRoles: [PraxisFiveAgentRole]
  public let missingCheckpointRoles: [PraxisFiveAgentRole]

  public init(
    resumableRoles: [PraxisFiveAgentRole],
    missingCheckpointRoles: [PraxisFiveAgentRole]
  ) {
    self.resumableRoles = resumableRoles
    self.missingCheckpointRoles = missingCheckpointRoles
  }
}

public struct PraxisCmpFiveAgentRuntimeSnapshot: Sendable, Equatable, Codable {
  public let roleRecords: [PraxisCmpRoleRuntimeRecord]
  public let handOffs: [PraxisAgentHandOff]
  public let liveTraces: [PraxisCmpRoleLiveTrace]

  public init(
    roleRecords: [PraxisCmpRoleRuntimeRecord],
    handOffs: [PraxisAgentHandOff],
    liveTraces: [PraxisCmpRoleLiveTrace]
  ) {
    self.roleRecords = roleRecords
    self.handOffs = handOffs
    self.liveTraces = liveTraces
  }
}

public struct PraxisCmpFiveAgentRuntimeSummary: Sendable, Equatable, Codable {
  public let roleCounts: [PraxisFiveAgentRole: Int]
  public let latestStages: [PraxisFiveAgentRole: String]
  public let liveSummary: [PraxisFiveAgentRole: PraxisCmpRoleLiveSummary]
  public let flow: PraxisCmpFiveAgentFlowSummary
  public let recovery: PraxisCmpFiveAgentRecoverySummary

  public init(
    roleCounts: [PraxisFiveAgentRole: Int],
    latestStages: [PraxisFiveAgentRole: String],
    liveSummary: [PraxisFiveAgentRole: PraxisCmpRoleLiveSummary],
    flow: PraxisCmpFiveAgentFlowSummary,
    recovery: PraxisCmpFiveAgentRecoverySummary
  ) {
    self.roleCounts = roleCounts
    self.latestStages = latestStages
    self.liveSummary = liveSummary
    self.flow = flow
    self.recovery = recovery
  }
}
