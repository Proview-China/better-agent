import PraxisCheckpoint
import PraxisCmpSections
import PraxisCmpTypes

public struct PraxisProjectionMaterializer: Sendable {
  public init() {}

  /// Creates a projection record from stored sections and a checked snapshot.
  ///
  /// - Parameters:
  ///   - snapshot: Source checked snapshot.
  ///   - storedSections: Stored sections selected for projection.
  ///   - visibilityLevel: Initial visibility level.
  ///   - updatedAt: Projection update timestamp.
  /// - Returns: A deterministic projection record.
  public func createProjection(
    from snapshot: PraxisCmpCheckedSnapshot,
    storedSections: [PraxisCmpStoredSection],
    visibilityLevel: PraxisCmpProjectionVisibilityLevel,
    updatedAt: String
  ) -> PraxisProjectionRecord {
    PraxisProjectionRecord(
      id: PraxisCmpProjectionID(rawValue: "\(snapshot.id.rawValue):projection"),
      snapshotID: snapshot.id,
      lineageID: snapshot.lineageID,
      agentID: snapshot.agentID,
      sectionIDs: storedSections.map(\.sectionID),
      storedRefs: storedSections.map(\.storedRef),
      visibilityLevel: visibilityLevel,
      updatedAt: updatedAt,
      metadata: snapshot.metadata
    )
  }

  /// Creates a materialization plan for a downstream context package.
  ///
  /// - Parameters:
  ///   - projection: Source projection record.
  ///   - targetAgentID: Intended target agent identifier.
  ///   - packageKind: Package kind to materialize.
  /// - Returns: A materialization plan suitable for the delivery layer.
  public func createMaterializationPlan(
    from projection: PraxisProjectionRecord,
    targetAgentID: String,
    packageKind: PraxisCmpContextPackageKind
  ) -> PraxisMaterializationPlan {
    PraxisMaterializationPlan(
      projectionID: projection.id,
      targetAgentID: targetAgentID,
      packageKind: packageKind,
      selectedSectionIDs: projection.sectionIDs,
      summary: "Materialize \(projection.sectionIDs.count) section(s) for \(targetAgentID)."
    )
  }

  /// Projects a promotion-facing view from a projection record.
  ///
  /// - Parameters:
  ///   - projection: Source projection record.
  ///   - promotionStatus: Promotion status to attach.
  /// - Returns: A promoted projection descriptor.
  public func createPromotedProjection(
    from projection: PraxisProjectionRecord,
    promotionStatus: PraxisCmpProjectionPromotionStatus
  ) -> PraxisCmpPromotedProjection {
    PraxisCmpPromotedProjection(
      id: projection.id,
      snapshotID: projection.snapshotID,
      agentID: projection.agentID,
      visibilityLevel: projection.visibilityLevel,
      promotionStatus: promotionStatus,
      projectionRefs: projection.storedRefs,
      updatedAt: projection.updatedAt,
      metadata: projection.metadata
    )
  }

  /// Returns the visibility policy for a target lineage relation.
  ///
  /// - Parameter relation: Relation between source and target lineages.
  /// - Returns: A deterministic visibility policy.
  public func visibilityPolicy(for relation: PraxisCmpNeighborhoodRelation) -> PraxisVisibilityPolicy {
    switch relation {
    case .same:
      return PraxisVisibilityPolicy(
        relation: relation,
        allowedLevels: [.localOnly, .submittedToParent, .acceptedByParent, .promotedByParent, .dispatchedDownward],
        summary: "Self access may inspect any non-archived projection state."
      )
    case .parent:
      return PraxisVisibilityPolicy(
        relation: relation,
        allowedLevels: [.submittedToParent, .acceptedByParent, .promotedByParent],
        summary: "Parent access begins at submitted-to-parent visibility."
      )
    case .peer:
      return PraxisVisibilityPolicy(
        relation: relation,
        allowedLevels: [.promotedByParent],
        summary: "Peer access requires a parent-promoted projection."
      )
    case .child:
      return PraxisVisibilityPolicy(
        relation: relation,
        allowedLevels: [.dispatchedDownward],
        summary: "Child access only sees explicitly dispatched projections."
      )
    }
  }

  /// Determines whether a projection is visible to the given lineage relation.
  ///
  /// - Parameters:
  ///   - projection: Projection to evaluate.
  ///   - relation: Relation between source and target lineages.
  /// - Returns: `true` when the projection is visible; otherwise `false`.
  public func isVisible(
    _ projection: PraxisProjectionRecord,
    to relation: PraxisCmpNeighborhoodRelation
  ) -> Bool {
    visibilityPolicy(for: relation).allowedLevels.contains(projection.visibilityLevel)
  }

  /// Creates a compact runtime snapshot for CMP recovery.
  ///
  /// - Parameters:
  ///   - checkedSnapshots: Checked snapshots known to the runtime.
  ///   - projections: Projection records known to the runtime.
  ///   - checkpointPointer: Optional checkpoint pointer.
  /// - Returns: A serializable runtime snapshot.
  public func createRuntimeSnapshot(
    checkedSnapshots: [PraxisCmpCheckedSnapshot],
    projections: [PraxisProjectionRecord],
    checkpointPointer: PraxisCheckpointPointer? = nil
  ) -> PraxisCmpRuntimeSnapshot {
    let latest = projections.reduce(into: [String: PraxisProjectionRecord]()) { partialResult, projection in
      guard let existing = partialResult[projection.agentID] else {
        partialResult[projection.agentID] = projection
        return
      }

      if projection.updatedAt >= existing.updatedAt {
        partialResult[projection.agentID] = projection
      }
    }.mapValues(\.id)
    return PraxisCmpRuntimeSnapshot(
      checkedSnapshotIDs: checkedSnapshots.map(\.id),
      projectionIDs: projections.map(\.id),
      latestProjectionByAgentID: latest,
      checkpointPointer: checkpointPointer
    )
  }

  /// Builds a recovery plan for a projection against a checkpoint snapshot.
  ///
  /// - Parameters:
  ///   - projection: Projection that should be recoverable.
  ///   - availableSectionIDs: Section identifiers available after restore.
  ///   - checkpointPointer: Optional checkpoint pointer.
  /// - Returns: A recovery plan describing whether the projection is resumable.
  public func recoveryPlan(
    for projection: PraxisProjectionRecord,
    availableSectionIDs: Set<PraxisCmpSectionID>,
    checkpointPointer: PraxisCheckpointPointer?
  ) -> PraxisProjectionRecoveryPlan {
    let missing = projection.sectionIDs.filter { !availableSectionIDs.contains($0) }
    return PraxisProjectionRecoveryPlan(
      projectionID: projection.id,
      checkpointPointer: checkpointPointer,
      resumable: missing.isEmpty,
      missingSectionIDs: missing,
      summary: missing.isEmpty ? "Projection can resume from checkpoint." : "Projection is missing section state."
    )
  }

  /// Hydrates a runtime recovery summary from a saved runtime snapshot.
  ///
  /// - Parameters:
  ///   - snapshot: Runtime snapshot captured before failure.
  ///   - availableProjectionIDs: Projection identifiers currently restorable.
  /// - Returns: A lightweight recovery summary.
  public func hydrateRecovery(
    from snapshot: PraxisCmpRuntimeSnapshot,
    availableProjectionIDs: Set<PraxisCmpProjectionID>
  ) -> PraxisCmpRuntimeHydratedRecovery {
    let resumable = snapshot.projectionIDs.filter { availableProjectionIDs.contains($0) }
    let missing = snapshot.projectionIDs.filter { !availableProjectionIDs.contains($0) }
    let issues = missing.map { "Projection \($0.rawValue) is missing during recovery." }
    return PraxisCmpRuntimeHydratedRecovery(
      snapshot: snapshot,
      resumableProjectionIDs: resumable,
      missingProjectionIDs: missing,
      issues: issues
    )
  }
}
