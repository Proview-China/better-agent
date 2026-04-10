import PraxisCmpProjection
import PraxisCmpTypes

public struct PraxisCmpDbPlanner: Sendable {
  public init() {}

  /// Builds the default project storage topology for a local CMP runtime.
  ///
  /// - Parameters:
  ///   - projectID: Project that owns the topology.
  ///   - databaseName: Logical database name.
  /// - Returns: A local-first storage topology.
  public func makeProjectTopology(projectID: String, databaseName: String) -> PraxisStorageTopology {
    PraxisStorageTopology(
      projectID: projectID,
      databaseName: databaseName,
      schemaName: "cmp_\(databaseName.replacingOccurrences(of: "-", with: "_"))",
      tableNames: PraxisCmpDbSharedTableKind.allCases.map(\.rawValue),
      storageEngine: .sqlite
    )
  }

  /// Builds a bootstrap contract for the local runtime topology.
  ///
  /// - Parameters:
  ///   - topology: Project topology to bootstrap.
  ///   - agentIDs: Agents that need local hot tables.
  /// - Returns: A bootstrap contract with readback statements.
  public func bootstrapContract(
    topology: PraxisStorageTopology,
    agentIDs: [String]
  ) -> PraxisCmpDbBootstrapContract {
    let sharedTargets = topology.tableNames.map { "\(topology.schemaName).\($0)" }
    let agentLocalTargets = advertisedAgentLocalTargets(for: agentIDs)
    let bootstrapTargets = sharedTargets + agentLocalTargets
    let bootstrapStatements = bootstrapTargets.map {
      PraxisCmpDbStatement(
        statementID: "bootstrap:\($0)",
        phase: .bootstrap,
        target: $0,
        sql: "create table if not exists \(tableReference(for: $0, in: topology)) (...)"
      )
    }
    let readbackStatements = bootstrapTargets.map {
      PraxisCmpDbStatement(
        statementID: "readback:\($0)",
        phase: .read,
        target: $0,
        sql: "select 1 from \(tableReference(for: $0, in: topology)) limit 1"
      )
    }
    return PraxisCmpDbBootstrapContract(
      projectID: topology.projectID,
      databaseName: topology.databaseName,
      schemaName: topology.schemaName,
      sharedTargets: sharedTargets,
      agentLocalTargets: agentLocalTargets,
      bootstrapStatements: bootstrapStatements,
      readbackStatements: readbackStatements
    )
  }

  /// Builds a projection persistence plan from a promoted projection.
  ///
  /// - Parameters:
  ///   - projection: Projection to persist.
  ///   - topology: Storage topology that receives the projection.
  /// - Returns: A projection persistence plan.
  public func projectionPlan(
    for projection: PraxisCmpPromotedProjection,
    topology: PraxisStorageTopology
  ) -> PraxisProjectionPersistencePlan {
    let state = mapProjectionState(from: projection.visibilityLevel)
    return PraxisProjectionPersistencePlan(
      projectionID: projection.id,
      topology: topology,
      state: state
    )
  }

  /// Builds a package persistence plan from a context package.
  ///
  /// - Parameters:
  ///   - package: Package to persist.
  ///   - topology: Storage topology that receives the package.
  /// - Returns: A package persistence plan.
  public func packagePlan(
    for package: PraxisCmpContextPackage,
    topology: PraxisStorageTopology
  ) -> PraxisPackagePersistencePlan {
    let state: PraxisCmpDbPackageRecordState = package.status == .materialized ? .materialized : .archived
    return PraxisPackagePersistencePlan(packageID: package.id, topology: topology, state: state)
  }

  /// Builds a delivery persistence plan from a dispatch receipt.
  ///
  /// - Parameters:
  ///   - receipt: Dispatch receipt to persist.
  ///   - topology: Storage topology that receives the receipt.
  /// - Returns: A delivery persistence plan.
  public func deliveryPlan(
    for receipt: PraxisCmpDispatchReceipt,
    topology: PraxisStorageTopology
  ) -> PraxisDeliveryPersistencePlan {
    PraxisDeliveryPersistencePlan(
      receiptID: receipt.id,
      topology: topology,
      state: mapDeliveryState(from: receipt.status)
    )
  }

  /// Advances a projection state without allowing the state machine to move backwards.
  ///
  /// - Parameters:
  ///   - current: Current projection state.
  ///   - next: Desired next projection state.
  /// - Throws: An error when the state transition moves backwards.
  public func advanceProjectionState(
    from current: PraxisCmpDbProjectionState,
    to next: PraxisCmpDbProjectionState
  ) throws {
    let order: [PraxisCmpDbProjectionState] = [
      .localOnly,
      .submittedToParent,
      .acceptedByParent,
      .promotedByParent,
      .dispatchedDownward,
      .archived,
    ]
    guard let currentIndex = order.firstIndex(of: current),
          let nextIndex = order.firstIndex(of: next),
          nextIndex >= currentIndex else {
      throw PraxisCmpValidationError.invalid("CMP DB projection state must not move backwards.")
    }
  }

  private func mapProjectionState(from level: PraxisCmpProjectionVisibilityLevel) -> PraxisCmpDbProjectionState {
    switch level {
    case .localOnly:
      .localOnly
    case .submittedToParent:
      .submittedToParent
    case .acceptedByParent:
      .acceptedByParent
    case .promotedByParent:
      .promotedByParent
    case .dispatchedDownward:
      .dispatchedDownward
    case .archived:
      .archived
    }
  }

  private func mapDeliveryState(from status: PraxisCmpDispatchStatus) -> PraxisCmpDbDeliveryRecordState {
    switch status {
    case .prepared:
      .pendingDelivery
    case .delivered:
      .delivered
    case .acknowledged:
      .acknowledged
    case .rejected:
      .rejected
    case .expired:
      .expired
    }
  }

  private func advertisedAgentLocalTargets(for agentIDs: [String]) -> [String] {
    agentIDs.flatMap { agentID in
      PraxisCmpDbAgentLocalTableKind.allCases.map { "\(agentID).\($0.rawValue)" }
    }
  }

  private func tableReference(for target: String, in topology: PraxisStorageTopology) -> String {
    if target.hasPrefix("\(topology.schemaName).") {
      return target
    }

    let segments = target.split(separator: ".", maxSplits: 1).map(String.init)
    guard segments.count == 2 else {
      return "\(topology.schemaName).\(target)"
    }

    let agentComponent = sanitizeSQLIdentifier(segments[0])
    let tableComponent = sanitizeSQLIdentifier(segments[1])
    return "\(topology.schemaName).\(agentComponent)_\(tableComponent)"
  }

  private func sanitizeSQLIdentifier(_ value: String) -> String {
    value.replacingOccurrences(of: "-", with: "_")
  }
}
