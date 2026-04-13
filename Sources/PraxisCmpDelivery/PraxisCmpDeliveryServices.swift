import PraxisCoreTypes
import PraxisCmpTypes

public struct PraxisDeliveryPlanner: Sendable {
  public init() {}

  /// Advances the active line without allowing backward stage transitions.
  ///
  /// - Parameters:
  ///   - record: Existing active-line record.
  ///   - nextStage: Next desired stage.
  ///   - updatedAt: Transition timestamp.
  ///   - snapshotID: Optional snapshot created by the stage transition.
  /// - Returns: An updated active-line record.
  public func advance(
    _ record: PraxisCmpActiveLineRecord,
    to nextStage: PraxisCmpActiveLineStage,
    updatedAt: String,
    snapshotID: PraxisCmpSnapshotID? = nil
  ) throws -> PraxisCmpActiveLineRecord {
    let order: [PraxisCmpActiveLineStage] = [
      .captured,
      .queuedForGit,
      .writtenToGit,
      .candidateReady,
      .checkedReady,
      .promotedPending,
    ]
    guard let currentIndex = order.firstIndex(of: record.stage),
          let nextIndex = order.firstIndex(of: nextStage),
          nextIndex >= currentIndex else {
      throw PraxisCmpValidationError.invalid("CMP active line must not move backwards.")
    }
    return PraxisCmpActiveLineRecord(
      lineageID: record.lineageID,
      stage: nextStage,
      latestEventID: record.latestEventID,
      deltaID: record.deltaID,
      snapshotID: snapshotID ?? record.snapshotID,
      updatedAt: updatedAt
    )
  }

  /// Builds a single dispatch instruction for a context package.
  ///
  /// - Parameters:
  ///   - package: Context package to dispatch.
  ///   - targetKind: Target relation kind.
  ///   - reason: Human-readable dispatch reason.
  /// - Returns: A dispatch instruction.
  public func buildInstruction(
    for package: PraxisContextPackage,
    targetKind: PraxisCmpDispatchTargetKind,
    reason: String
  ) -> PraxisDispatchInstruction {
    PraxisDispatchInstruction(
      packageID: package.id,
      sourceAgentID: package.sourceAgentID,
      targetAgentID: package.targetAgentID,
      targetKind: targetKind,
      reason: reason,
      summary: "Deliver \(package.kind.rawValue) package to \(package.targetAgentID)."
    )
  }

  /// Builds a delivery plan from a prepared context package.
  ///
  /// - Parameters:
  ///   - package: Context package to deliver.
  ///   - targets: Target kind and reason pairs.
  /// - Returns: A delivery plan containing all instructions.
  public func buildPlan(
    for package: PraxisContextPackage,
    targets: [(PraxisCmpDispatchTargetKind, String)]
  ) -> PraxisDeliveryPlan {
    let instructions = targets.map { buildInstruction(for: package, targetKind: $0.0, reason: $0.1) }
    return PraxisDeliveryPlan(contextPackage: package, instructions: instructions)
  }

  /// Builds a dispatch receipt from a delivery instruction.
  ///
  /// - Parameters:
  ///   - instruction: Dispatch instruction that was executed.
  ///   - status: Current dispatch status.
  ///   - createdAt: Receipt creation timestamp.
  /// - Returns: A dispatch receipt.
  public func buildReceipt(
    for instruction: PraxisDispatchInstruction,
    status: PraxisCmpDispatchStatus,
    createdAt: String
  ) -> PraxisCmpDispatchReceipt {
    PraxisCmpDispatchReceipt(
      id: PraxisCmpDispatchReceiptID(rawValue: "\(instruction.packageID.rawValue):\(instruction.targetAgentID)"),
      packageID: instruction.packageID,
      sourceAgentID: instruction.sourceAgentID,
      targetAgentID: instruction.targetAgentID,
      targetKind: instruction.targetKind,
      status: status,
      createdAt: createdAt,
      deliveredAt: status == .delivered || status == .acknowledged ? createdAt : nil,
      acknowledgedAt: status == .acknowledged ? createdAt : nil
    )
  }

  /// Resolves the highest-signal historical context response available to a requester.
  ///
  /// - Parameters:
  ///   - input: Historical request input.
  ///   - snapshots: Candidate checked snapshots.
  ///   - packages: Candidate pre-materialized context packages.
  /// - Returns: A deterministic response that prefers packages over raw snapshot-only results.
  public func requestHistoricalContext(
    _ input: PraxisRequestHistoricalContextInput,
    snapshots: [PraxisCmpCheckedSnapshot],
    packages: [PraxisContextPackage]
  ) -> PraxisRequestHistoricalContextResult {
    let requestedSnapshotID = input.query.snapshotID
    let requestedLineageID = input.query.lineageID
    let requestedBranchRef = input.query.branchRef
    let requestedKind = input.query.packageKindHint
    let requestedVisibility = input.query.projectionVisibilityHint

    let matchingSnapshots = snapshots.filter { snapshot in
      if let requestedSnapshotID, snapshot.id != requestedSnapshotID {
        return false
      }
      if let requestedLineageID, snapshot.lineageID != requestedLineageID {
        return false
      }
      if let requestedBranchRef, snapshot.branchRef != requestedBranchRef.rawValue {
        return false
      }
      return true
    }
    let matchingSnapshotIDs = Set(matchingSnapshots.map(\.id))

    let matchingPackage = packages.first { package in
      guard package.targetAgentID == input.requesterAgentID else {
        return false
      }
      if let requestedSnapshotID, package.sourceSnapshotID != requestedSnapshotID {
        return false
      }
      if let requestedKind, package.kind != requestedKind {
        return false
      }
      if let requestedVisibility {
        guard package.metadata["projection_visibility"]?.stringValue == requestedVisibility.rawValue else {
          return false
        }
      }
      if requestedLineageID != nil || requestedBranchRef != nil {
        guard let sourceSnapshotID = package.sourceSnapshotID,
              matchingSnapshotIDs.contains(sourceSnapshotID) else {
          return false
        }
      }
      return true
    }
    let matchingSnapshot = matchingSnapshots.first

    return PraxisRequestHistoricalContextResult(
      status: matchingPackage != nil ? .resolved : (matchingSnapshot != nil ? .resolved : .notFound),
      found: matchingPackage != nil || matchingSnapshot != nil,
      snapshot: matchingSnapshot,
      contextPackage: matchingPackage,
      metadata: [
        "reason": .string(input.reason),
      ]
    )
  }

  /// Builds a fallback plan for passive historical delivery when nothing is pre-materialized.
  ///
  /// - Parameter query: Historical query that needs a fallback route.
  /// - Returns: A fallback plan describing the passive replay path.
  public func buildFallbackPlan(for query: PraxisCmpHistoricalContextQuery) -> PraxisDeliveryFallbackPlan {
    PraxisDeliveryFallbackPlan(
      query: query,
      summary: "Rebuild a high-signal package from checked snapshot and projection state."
    )
  }
}
