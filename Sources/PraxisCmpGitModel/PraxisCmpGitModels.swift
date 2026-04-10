import PraxisCmpTypes

public enum PraxisCmpGitBranchKind: String, Sendable, Codable {
  case work
  case cmp
  case mp
  case tap
}

public struct PraxisCmpGitBranchRef: Sendable, Equatable, Codable {
  public let kind: PraxisCmpGitBranchKind
  public let agentID: String
  public let name: String

  public init(kind: PraxisCmpGitBranchKind, agentID: String, name: String) {
    self.kind = kind
    self.agentID = agentID
    self.name = name
  }
}

public struct PraxisGitBranchFamily: Sendable, Equatable, Codable {
  public let lineageID: PraxisCmpLineageID
  public let branches: [PraxisCmpGitBranchRef]

  public init(lineageID: PraxisCmpLineageID, branches: [PraxisCmpGitBranchRef]) {
    self.lineageID = lineageID
    self.branches = branches
  }
}

public struct PraxisCmpGitSnapshotCandidateRecord: Sendable, Equatable, Codable {
  public let id: PraxisCmpSnapshotID
  public let projectID: String
  public let agentID: String
  public let branchRef: PraxisCmpGitBranchRef
  public let commitSha: String
  public let deltaRefs: [PraxisCmpDeltaID]
  public let createdAt: String
  public let status: PraxisCmpSnapshotCandidateStatus

  public init(
    id: PraxisCmpSnapshotID,
    projectID: String,
    agentID: String,
    branchRef: PraxisCmpGitBranchRef,
    commitSha: String,
    deltaRefs: [PraxisCmpDeltaID],
    createdAt: String,
    status: PraxisCmpSnapshotCandidateStatus = .pending
  ) {
    self.id = id
    self.projectID = projectID
    self.agentID = agentID
    self.branchRef = branchRef
    self.commitSha = commitSha
    self.deltaRefs = deltaRefs
    self.createdAt = createdAt
    self.status = status
  }
}

public enum PraxisCmpGitCheckedRefStatus: String, Sendable, Codable {
  case active
  case superseded
}

public enum PraxisCmpGitPromotedRefStatus: String, Sendable, Codable {
  case promoted
  case archived
}

public struct PraxisCmpGitCheckedSnapshotRef: Sendable, Equatable, Codable {
  public let snapshotID: PraxisCmpSnapshotID
  public let branchRef: PraxisCmpGitBranchRef
  public let commitSha: String
  public let status: PraxisCmpGitCheckedRefStatus

  public init(
    snapshotID: PraxisCmpSnapshotID,
    branchRef: PraxisCmpGitBranchRef,
    commitSha: String,
    status: PraxisCmpGitCheckedRefStatus = .active
  ) {
    self.snapshotID = snapshotID
    self.branchRef = branchRef
    self.commitSha = commitSha
    self.status = status
  }
}

public struct PraxisCmpGitPromotedSnapshotRef: Sendable, Equatable, Codable {
  public let snapshotID: PraxisCmpSnapshotID
  public let branchRef: PraxisCmpGitBranchRef
  public let commitSha: String
  public let visibilityLevel: PraxisCmpProjectionVisibilityLevel
  public let status: PraxisCmpGitPromotedRefStatus

  public init(
    snapshotID: PraxisCmpSnapshotID,
    branchRef: PraxisCmpGitBranchRef,
    commitSha: String,
    visibilityLevel: PraxisCmpProjectionVisibilityLevel,
    status: PraxisCmpGitPromotedRefStatus = .promoted
  ) {
    self.snapshotID = snapshotID
    self.branchRef = branchRef
    self.commitSha = commitSha
    self.visibilityLevel = visibilityLevel
    self.status = status
  }
}

public struct PraxisGitRefLifecycle: Sendable, Equatable, Codable {
  public let checkedRef: PraxisCmpGitCheckedSnapshotRef
  public let promotedRef: PraxisCmpGitPromotedSnapshotRef?

  public init(
    checkedRef: PraxisCmpGitCheckedSnapshotRef,
    promotedRef: PraxisCmpGitPromotedSnapshotRef? = nil
  ) {
    self.checkedRef = checkedRef
    self.promotedRef = promotedRef
  }
}

public struct PraxisGitLineagePolicy: Sendable, Equatable, Codable {
  public let directParentOnly: Bool
  public let peersRequireParentPromotion: Bool
  public let summary: String

  public init(directParentOnly: Bool, peersRequireParentPromotion: Bool, summary: String) {
    self.directParentOnly = directParentOnly
    self.peersRequireParentPromotion = peersRequireParentPromotion
    self.summary = summary
  }
}

public struct PraxisCmpGitPullRequestRecord: Sendable, Equatable, Codable {
  public let pullRequestID: String
  public let projectID: String
  public let sourceAgentID: String
  public let targetAgentID: String
  public let sourceBranchRef: PraxisCmpGitBranchRef
  public let targetBranchRef: PraxisCmpGitBranchRef
  public let candidateID: PraxisCmpSnapshotID
  public let status: String
  public let createdAt: String

  public init(
    pullRequestID: String,
    projectID: String,
    sourceAgentID: String,
    targetAgentID: String,
    sourceBranchRef: PraxisCmpGitBranchRef,
    targetBranchRef: PraxisCmpGitBranchRef,
    candidateID: PraxisCmpSnapshotID,
    status: String,
    createdAt: String
  ) {
    self.pullRequestID = pullRequestID
    self.projectID = projectID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.sourceBranchRef = sourceBranchRef
    self.targetBranchRef = targetBranchRef
    self.candidateID = candidateID
    self.status = status
    self.createdAt = createdAt
  }
}

public struct PraxisCmpGitMergeRecord: Sendable, Equatable, Codable {
  public let mergeID: String
  public let projectID: String
  public let pullRequestID: String
  public let sourceAgentID: String
  public let targetAgentID: String
  public let sourceCommitSha: String
  public let mergedAt: String
  public let status: String

  public init(
    mergeID: String,
    projectID: String,
    pullRequestID: String,
    sourceAgentID: String,
    targetAgentID: String,
    sourceCommitSha: String,
    mergedAt: String,
    status: String
  ) {
    self.mergeID = mergeID
    self.projectID = projectID
    self.pullRequestID = pullRequestID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.sourceCommitSha = sourceCommitSha
    self.mergedAt = mergedAt
    self.status = status
  }
}

public struct PraxisCmpGitPromotionRecord: Sendable, Equatable, Codable {
  public let promotionID: String
  public let projectID: String
  public let mergeID: String
  public let sourceAgentID: String
  public let targetAgentID: String
  public let candidateID: PraxisCmpSnapshotID
  public let checkedCommitSha: String
  public let visibilityLevel: PraxisCmpProjectionVisibilityLevel
  public let promotedAt: String

  public init(
    promotionID: String,
    projectID: String,
    mergeID: String,
    sourceAgentID: String,
    targetAgentID: String,
    candidateID: PraxisCmpSnapshotID,
    checkedCommitSha: String,
    visibilityLevel: PraxisCmpProjectionVisibilityLevel,
    promotedAt: String
  ) {
    self.promotionID = promotionID
    self.projectID = projectID
    self.mergeID = mergeID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.candidateID = candidateID
    self.checkedCommitSha = checkedCommitSha
    self.visibilityLevel = visibilityLevel
    self.promotedAt = promotedAt
  }
}

public struct PraxisGitSyncPlan: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let targetBranch: PraxisCmpGitBranchRef
  public let candidateID: PraxisCmpSnapshotID?
  public let summary: String

  public init(
    projectionID: PraxisCmpProjectionID,
    targetBranch: PraxisCmpGitBranchRef,
    candidateID: PraxisCmpSnapshotID? = nil,
    summary: String
  ) {
    self.projectionID = projectionID
    self.targetBranch = targetBranch
    self.candidateID = candidateID
    self.summary = summary
  }
}
