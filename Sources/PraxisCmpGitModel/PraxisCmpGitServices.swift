import PraxisCmpProjection
import PraxisCmpTypes

public actor PraxisCmpGitLineageRegistry {
  private var storage: [String: PraxisCmpAgentLineage]

  public init(lineages: [PraxisCmpAgentLineage] = []) {
    self.storage = Dictionary(uniqueKeysWithValues: lineages.map { ($0.agentID, $0) })
  }

  /// Stores or replaces a lineage.
  ///
  /// - Parameter lineage: Lineage to store.
  public func set(_ lineage: PraxisCmpAgentLineage) {
    storage[lineage.agentID] = lineage
  }

  /// Returns a lineage for an agent identifier.
  ///
  /// - Parameter agentID: Agent identifier to resolve.
  /// - Returns: The stored lineage when present.
  public func get(agentID: String) -> PraxisCmpAgentLineage? {
    storage[agentID]
  }
}

public struct PraxisCmpGitPlanner: Sendable {
  public init() {}

  /// Builds the canonical branch family for a lineage.
  ///
  /// - Parameter lineage: Lineage that owns the branch family.
  /// - Returns: Canonical branch refs for the lineage.
  public func branchFamily(for lineage: PraxisCmpAgentLineage) -> PraxisGitBranchFamily {
    let branches: [PraxisCmpGitBranchRef] = [
      .init(kind: .work, agentID: lineage.agentID, name: lineage.branchFamily.workBranch),
      .init(kind: .cmp, agentID: lineage.agentID, name: lineage.branchFamily.cmpBranch),
      .init(kind: .mp, agentID: lineage.agentID, name: lineage.branchFamily.mpBranch),
      .init(kind: .tap, agentID: lineage.agentID, name: lineage.branchFamily.tapBranch),
    ]
    return PraxisGitBranchFamily(lineageID: lineage.id, branches: branches)
  }

  /// Creates a git snapshot candidate from a checked delta.
  ///
  /// - Parameters:
  ///   - lineage: Lineage that owns the candidate.
  ///   - delta: Source context delta.
  ///   - commitSha: Commit written to git.
  ///   - createdAt: Candidate creation timestamp.
  /// - Returns: A git snapshot candidate.
  public func makeSnapshotCandidate(
    lineage: PraxisCmpAgentLineage,
    delta: PraxisCmpContextDelta,
    commitSha: String,
    createdAt: String
  ) -> PraxisCmpGitSnapshotCandidateRecord {
    PraxisCmpGitSnapshotCandidateRecord(
      id: PraxisCmpSnapshotID(rawValue: "\(delta.id.rawValue):snapshot"),
      projectID: lineage.projectID,
      agentID: lineage.agentID,
      branchRef: .init(kind: .cmp, agentID: lineage.agentID, name: lineage.branchFamily.cmpBranch),
      commitSha: commitSha,
      deltaRefs: [delta.id],
      createdAt: createdAt
    )
  }

  /// Opens a parent-directed promotion request.
  ///
  /// - Parameters:
  ///   - candidate: Candidate that should be reviewed by the parent.
  ///   - source: Source lineage.
  ///   - parent: Direct parent lineage.
  ///   - createdAt: Pull-request creation timestamp.
  /// - Returns: A promotion pull request record.
  public func openPromotionPullRequest(
    candidate: PraxisCmpGitSnapshotCandidateRecord,
    source: PraxisCmpAgentLineage,
    parent: PraxisCmpAgentLineage,
    createdAt: String
  ) throws -> PraxisCmpGitPullRequestRecord {
    try assertDirectParentPromotion(source: source, parent: parent)
    return PraxisCmpGitPullRequestRecord(
      pullRequestID: "pr:\(candidate.id.rawValue)",
      projectID: source.projectID,
      sourceAgentID: source.agentID,
      targetAgentID: parent.agentID,
      sourceBranchRef: .init(kind: .cmp, agentID: source.agentID, name: source.branchFamily.cmpBranch),
      targetBranchRef: .init(kind: .cmp, agentID: parent.agentID, name: parent.branchFamily.cmpBranch),
      candidateID: candidate.id,
      status: "open",
      createdAt: createdAt
    )
  }

  /// Merges a parent-directed promotion request.
  ///
  /// - Parameters:
  ///   - pullRequest: Pull request opened by the child.
  ///   - candidate: Candidate carried by the pull request.
  ///   - mergedAt: Merge timestamp.
  /// - Returns: A merge record.
  public func merge(
    pullRequest: PraxisCmpGitPullRequestRecord,
    candidate: PraxisCmpGitSnapshotCandidateRecord,
    mergedAt: String
  ) -> PraxisCmpGitMergeRecord {
    PraxisCmpGitMergeRecord(
      mergeID: "merge:\(pullRequest.pullRequestID)",
      projectID: pullRequest.projectID,
      pullRequestID: pullRequest.pullRequestID,
      sourceAgentID: pullRequest.sourceAgentID,
      targetAgentID: pullRequest.targetAgentID,
      sourceCommitSha: candidate.commitSha,
      mergedAt: mergedAt,
      status: "merged_to_parent"
    )
  }

  /// Promotes a merged child candidate into a parent-visible state.
  ///
  /// - Parameters:
  ///   - merge: Merge record to promote.
  ///   - candidate: Candidate carried by the merge.
  ///   - promotedAt: Promotion timestamp.
  /// - Returns: A promotion record.
  public func promote(
    merge: PraxisCmpGitMergeRecord,
    candidate: PraxisCmpGitSnapshotCandidateRecord,
    promotedAt: String
  ) -> PraxisCmpGitPromotionRecord {
    PraxisCmpGitPromotionRecord(
      promotionID: "promotion:\(merge.mergeID)",
      projectID: merge.projectID,
      mergeID: merge.mergeID,
      sourceAgentID: merge.sourceAgentID,
      targetAgentID: merge.targetAgentID,
      candidateID: candidate.id,
      checkedCommitSha: candidate.commitSha,
      visibilityLevel: .promotedByParent,
      promotedAt: promotedAt
    )
  }

  /// Supersedes a checked snapshot ref once a newer one becomes active.
  ///
  /// - Parameter ref: Checked ref to supersede.
  /// - Returns: A superseded checked ref.
  public func supersede(_ ref: PraxisCmpGitCheckedSnapshotRef) -> PraxisCmpGitCheckedSnapshotRef {
    PraxisCmpGitCheckedSnapshotRef(
      snapshotID: ref.snapshotID,
      branchRef: ref.branchRef,
      commitSha: ref.commitSha,
      status: .superseded
    )
  }

  /// Builds a git sync plan for a promoted projection.
  ///
  /// - Parameters:
  ///   - projection: Projection that should be synced.
  ///   - lineage: Lineage that owns the sync branch.
  /// - Returns: A git sync plan.
  public func syncPlan(
    for projection: PraxisProjectionRecord,
    lineage: PraxisCmpAgentLineage
  ) -> PraxisGitSyncPlan {
    PraxisGitSyncPlan(
      projectionID: projection.id,
      targetBranch: .init(kind: .cmp, agentID: lineage.agentID, name: lineage.branchFamily.cmpBranch),
      candidateID: projection.snapshotID,
      summary: "Sync projection \(projection.id.rawValue) into \(lineage.branchFamily.cmpBranch)."
    )
  }

  /// Ensures that promotion only targets the direct parent lineage.
  ///
  /// - Parameters:
  ///   - source: Source lineage.
  ///   - parent: Intended parent lineage.
  /// - Throws: An error when the target is not the direct parent.
  public func assertDirectParentPromotion(
    source: PraxisCmpAgentLineage,
    parent: PraxisCmpAgentLineage
  ) throws {
    guard source.parentAgentID == parent.agentID else {
      throw PraxisCmpValidationError.invalid("CMP git promotion must target the direct parent lineage.")
    }
  }

  /// Ensures that peer exchange does not bypass parent visibility rules.
  ///
  /// - Parameters:
  ///   - source: Source lineage.
  ///   - peer: Target peer lineage.
  /// - Throws: An error when the lineages are not peers.
  public func assertPeerExchangeStaysLocal(
    source: PraxisCmpAgentLineage,
    peer: PraxisCmpAgentLineage
  ) throws {
    guard source.parentAgentID != nil,
          source.parentAgentID == peer.parentAgentID,
          source.agentID != peer.agentID else {
      throw PraxisCmpValidationError.invalid("CMP git peer exchange requires siblings under the same parent.")
    }
  }
}
