import PraxisCmpDelivery
import PraxisCmpProjection
import PraxisCmpSections
import PraxisCmpTypes

public struct PraxisCmpFiveAgentPlanner: Sendable {
  public init() {}

  /// Returns the canonical five-agent protocol definition.
  ///
  /// - Returns: A stable five-agent protocol definition.
  public func defaultProtocolDefinition() -> PraxisFiveAgentProtocolDefinition {
    PraxisFiveAgentProtocolDefinition(
      roles: [
        .init(
          role: .icma,
          responsibility: "Capture ingress and decide context granularity.",
          consumes: ["runtime materials"],
          produces: ["section ingress"],
          nextRoles: [.iterator]
        ),
        .init(
          role: .iterator,
          responsibility: "Advance context deltas through git-facing lanes.",
          consumes: ["section ingress", "context delta"],
          produces: ["snapshot candidate"],
          nextRoles: [.checker]
        ),
        .init(
          role: .checker,
          responsibility: "Select usable checked snapshots and promotion candidates.",
          consumes: ["snapshot candidate"],
          produces: ["checked snapshot"],
          nextRoles: [.dbAgent]
        ),
        .init(
          role: .dbAgent,
          responsibility: "Turn checked state into projections and context packages.",
          consumes: ["checked snapshot", "stored sections"],
          produces: ["projection", "context package"],
          nextRoles: [.dispatcher]
        ),
        .init(
          role: .dispatcher,
          responsibility: "Route high-signal packages to parents, peers, and children.",
          consumes: ["context package"],
          produces: ["dispatch receipt"],
          nextRoles: []
        ),
      ],
      handOffRules: [
        .init(from: .icma, to: .iterator, summary: "ICMA hands structured ingress to Iterator."),
        .init(from: .iterator, to: .checker, summary: "Iterator hands snapshot candidates to Checker."),
        .init(from: .checker, to: .dbAgent, summary: "Checker hands checked snapshots to DBAgent.", requiresCheckedSnapshot: true),
        .init(from: .dbAgent, to: .dispatcher, summary: "DBAgent hands packages to Dispatcher.", requiresCheckedSnapshot: true),
      ]
    )
  }

  /// Builds role assignments from lowered sections.
  ///
  /// - Parameter loweringPlans: Lowered sections captured during ingress.
  /// - Returns: Role assignments for ICMA, Iterator, DBAgent, and Dispatcher surfaces.
  public func assignments(
    from loweringPlans: [PraxisSectionLoweringPlan]
  ) -> [PraxisRoleAssignment] {
    let sectionIDs = loweringPlans.map(\.section.id)
    return [
      PraxisRoleAssignment(role: .icma, sectionIDs: sectionIDs),
      PraxisRoleAssignment(role: .iterator, sectionIDs: sectionIDs),
      PraxisRoleAssignment(role: .dbAgent, sectionIDs: loweringPlans.compactMap { $0.storedSection?.sectionID }),
      PraxisRoleAssignment(role: .dispatcher, sectionIDs: loweringPlans.compactMap { $0.storedSection?.sectionID }),
    ]
  }

  /// Builds a runtime snapshot from active role records and traces.
  ///
  /// - Parameters:
  ///   - records: Role runtime records.
  ///   - handOffs: Handoff rules currently in play.
  ///   - traces: Live traces captured so far.
  /// - Returns: A runtime snapshot.
  public func runtimeSnapshot(
    records: [PraxisCmpRoleRuntimeRecord],
    handOffs: [PraxisAgentHandOff],
    traces: [PraxisCmpRoleLiveTrace]
  ) -> PraxisCmpFiveAgentRuntimeSnapshot {
    PraxisCmpFiveAgentRuntimeSnapshot(roleRecords: records, handOffs: handOffs, liveTraces: traces)
  }

  /// Summarizes a runtime snapshot into stable inspection output.
  ///
  /// - Parameter snapshot: Snapshot to summarize.
  /// - Returns: A runtime summary for inspection surfaces.
  public func summarize(_ snapshot: PraxisCmpFiveAgentRuntimeSnapshot) -> PraxisCmpFiveAgentRuntimeSummary {
    let grouped = Dictionary(grouping: snapshot.roleRecords, by: \.role)
    let roleCounts = grouped.mapValues(\.count)
    let latestStages = grouped.reduce(into: [PraxisFiveAgentRole: String]()) { partialResult, entry in
      partialResult[entry.key] = entry.value.last?.stage
    }
    let liveSummary = Dictionary(uniqueKeysWithValues: snapshot.liveTraces.map {
      ($0.role, PraxisCmpRoleLiveSummary(
        mode: $0.mode,
        status: $0.status,
        fallbackApplied: $0.fallbackApplied,
        provider: $0.provider,
        model: $0.model
      ))
    })
    return PraxisCmpFiveAgentRuntimeSummary(
      roleCounts: roleCounts,
      latestStages: latestStages,
      liveSummary: liveSummary,
      flow: .init(
        pendingPeerApprovalCount: snapshot.handOffs.filter { $0.requiresCheckedSnapshot }.count,
        approvedPeerApprovalCount: snapshot.handOffs.filter { !$0.requiresCheckedSnapshot }.count,
        reinterventionPendingCount: snapshot.liveTraces.filter { $0.status == .fallback || $0.status == .failed }.count
      ),
      recovery: .init(
        resumableRoles: snapshot.roleRecords.filter { $0.sourceSnapshotID != nil }.map(\.role),
        missingCheckpointRoles: snapshot.roleRecords.filter { $0.sourceSnapshotID == nil }.map(\.role)
      )
    )
  }

  /// Builds a neutral TAP bridge payload from a CMP delivery context.
  ///
  /// - Parameters:
  ///   - role: Role requesting TAP access.
  ///   - capabilityKey: Capability key requested through TAP.
  ///   - reason: Human-readable reason.
  ///   - package: Optional package in flight.
  /// - Returns: A neutral TAP bridge payload.
  public func tapBridgePayload(
    role: PraxisFiveAgentRole,
    capabilityKey: String,
    reason: String,
    package: PraxisCmpContextPackage? = nil
  ) -> PraxisCmpFiveAgentTapBridgePayload {
    PraxisCmpFiveAgentTapBridgePayload(
      role: role,
      capabilityKey: capabilityKey,
      reason: reason,
      packageID: package?.id,
      sourceSnapshotID: package?.sourceSnapshotID
    )
  }
}
