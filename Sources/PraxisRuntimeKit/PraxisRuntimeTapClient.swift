import PraxisRuntimeFacades

/// Caller-friendly TAP entrypoint that hides lower-level command wrappers.
///
/// This surface exposes inspection and project-scoped TAP readback without leaking transport or
/// bootstrap details into framework callers.
public struct PraxisRuntimeTapClient: Sendable {
  private let inspectionFacade: PraxisInspectionFacade
  private let cmpFacade: PraxisCmpFacade

  init(
    inspectionFacade: PraxisInspectionFacade,
    cmpFacade: PraxisCmpFacade
  ) {
    self.inspectionFacade = inspectionFacade
    self.cmpFacade = cmpFacade
  }

  /// Reads the current TAP inspection snapshot.
  ///
  /// - Returns: A TAP inspection snapshot projected by the runtime facade.
  /// - Throws: Any inspection error raised by the underlying runtime use cases.
  public func inspect() async throws -> PraxisTapInspectionSnapshot {
    try await inspectionFacade.inspectTap()
  }

  /// Creates a TAP client scoped to one project identifier.
  ///
  /// - Parameter project: Stable project identifier used for follow-up TAP reads.
  /// - Returns: A project-scoped TAP client.
  public func project(_ project: PraxisRuntimeProjectRef) -> PraxisRuntimeTapProjectClient {
    PraxisRuntimeTapProjectClient(
      project: project,
      inspectionFacade: inspectionFacade,
      cmpFacade: cmpFacade
    )
  }

}

/// Project-scoped TAP surface for repeated readback calls.
public struct PraxisRuntimeTapProjectClient: Sendable {
  private let project: PraxisRuntimeProjectRef
  private let inspectionFacade: PraxisInspectionFacade
  private let cmpFacade: PraxisCmpFacade

  init(
    project: PraxisRuntimeProjectRef,
    inspectionFacade: PraxisInspectionFacade,
    cmpFacade: PraxisCmpFacade
  ) {
    self.project = project
    self.inspectionFacade = inspectionFacade
    self.cmpFacade = cmpFacade
  }

  /// Reads one TAP project overview for the scoped project.
  ///
  /// - Parameter options: Structured TAP overview options for one project read.
  /// - Returns: A TAP project overview composed from status and approval history snapshots.
  /// - Throws: Any readback error raised by the underlying runtime use cases.
  public func overview(
    _ options: PraxisRuntimeTapOverviewOptions = .init()
  ) async throws -> PraxisRuntimeTapProjectOverview {
    async let status = inspectionFacade.readbackTapStatus(
      .init(projectID: project.rawValue, agentID: options.agentID?.rawValue)
    )
    async let history = inspectionFacade.readbackTapHistory(
      .init(projectID: project.rawValue, agentID: options.agentID?.rawValue, limit: options.limit)
    )

    return try await PraxisRuntimeTapProjectOverview(
      status: status,
      history: history
    )
  }

  /// Reads one TAP project overview from lightweight call-site parameters.
  ///
  /// - Parameters:
  ///   - agent: Optional agent identifier used to scope TAP reads.
  ///   - limit: Maximum number of TAP history entries to load.
  /// - Returns: A TAP project overview composed from status and approval history snapshots.
  /// - Throws: Any readback error raised by the underlying runtime use cases.
  public func overview(
    for agent: PraxisRuntimeAgentRef? = nil,
    limit: Int = 10
  ) async throws -> PraxisRuntimeTapProjectOverview {
    try await overview(.init(agentID: agent, limit: limit))
  }

  /// Reads one TAP inspection snapshot scoped to the selected project.
  ///
  /// - Parameter historyLimit: Maximum number of TAP history entries to load into the inspection context.
  /// - Returns: A TAP inspection snapshot projected by the runtime facade for the scoped project.
  /// - Throws: Any inspection error raised by the underlying runtime use cases.
  public func inspect(historyLimit: Int = 5) async throws -> PraxisTapInspectionSnapshot {
    try await inspectionFacade.inspectTap(
      .init(projectID: project.rawValue, historyLimit: historyLimit)
    )
  }

  /// Reads one reviewer-facing workbench for the scoped project.
  ///
  /// - Parameter options: Structured workbench options for one project read.
  /// - Returns: A project-scoped workbench that combines TAP inspection, TAP overview, CMP overview, and a reviewer queue.
  /// - Throws: Any inspection, readback, or smoke error raised by the underlying runtime use cases.
  public func reviewWorkbench(
    _ options: PraxisRuntimeTapReviewWorkbenchOptions = .init()
  ) async throws -> PraxisRuntimeTapReviewWorkbench {
    async let inspection = inspect(historyLimit: options.limit)
    async let tapOverview = overview(.init(agentID: options.agentID, limit: options.limit))
    async let cmpReadback = cmpFacade.readbackProject(.init(projectID: project.rawValue))
    async let cmpSmoke = cmpFacade.smokeProject(.init(projectID: project.rawValue))
    async let cmpStatus = cmpFacade.readbackStatus(
      .init(projectID: project.rawValue, agentID: options.agentID?.rawValue)
    )

    return try await PraxisRuntimeTapReviewWorkbench(
      inspection: inspection,
      tapOverview: tapOverview,
      cmpOverview: .init(
        readback: cmpReadback,
        smoke: cmpSmoke,
        status: cmpStatus
      )
    )
  }

  /// Reads one reviewer-facing workbench from lightweight call-site parameters.
  ///
  /// - Parameters:
  ///   - agent: Optional agent identifier used to scope TAP and CMP reads.
  ///   - limit: Maximum number of TAP history entries to load into the workbench queue.
  /// - Returns: A project-scoped workbench that combines TAP inspection, TAP overview, CMP overview, and a reviewer queue.
  /// - Throws: Any inspection, readback, or smoke error raised by the underlying runtime use cases.
  public func reviewWorkbench(
    for agent: PraxisRuntimeAgentRef? = nil,
    limit: Int = 10
  ) async throws -> PraxisRuntimeTapReviewWorkbench {
    try await reviewWorkbench(.init(agentID: agent, limit: limit))
  }
}

/// Lightweight options for loading one TAP reviewer workbench.
public struct PraxisRuntimeTapReviewWorkbenchOptions: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef?
  public let limit: Int

  public init(
    agentID: PraxisRuntimeAgentRef? = nil,
    limit: Int = 10
  ) {
    self.agentID = agentID
    self.limit = limit
  }
}

/// Aggregated TAP read model for one scoped project.
public struct PraxisRuntimeTapProjectOverview: Sendable {
  public let status: PraxisTapStatusSnapshot
  public let history: PraxisTapHistorySnapshot

  public init(
    status: PraxisTapStatusSnapshot,
    history: PraxisTapHistorySnapshot
  ) {
    self.status = status
    self.history = history
  }

  /// Stable project identifier shared by the aggregated TAP snapshots.
  public var projectID: String {
    status.projectID
  }

  /// Stable scoped agent identifier when the TAP overview is agent-filtered.
  public var agentID: String? {
    status.agentID ?? history.agentID
  }

  /// Number of approvals that are still waiting for reviewer or human action.
  public var pendingApprovalCount: Int {
    status.pendingApprovalCount
  }

  /// Number of approvals that already reached an approved state.
  public var approvedApprovalCount: Int {
    status.approvedApprovalCount
  }

  /// Latest reviewer-facing decision summary for the scoped TAP overview.
  public var latestDecisionSummary: String? {
    status.latestDecisionSummary ?? history.entries.first?.decisionSummary
  }

  /// Whether the scoped TAP overview currently has at least one waiting approval.
  public var hasWaitingHumanReview: Bool {
    status.humanGateState == .waitingApproval || pendingApprovalCount > 0
  }
}

/// One reviewer-facing queue item derived from TAP history.
public struct PraxisRuntimeTapReviewQueueItem: Sendable, Equatable {
  public let agentID: String
  public let targetAgentID: String
  public let capabilityID: String
  public let requestedTier: String
  public let route: String
  public let outcome: String
  public let humanGateState: String
  public let updatedAt: String
  public let decisionSummary: String

  public init(entry: PraxisTapHistoryEntrySnapshot) {
    self.agentID = entry.agentID
    self.targetAgentID = entry.targetAgentID
    self.capabilityID = entry.capabilityKey.rawValue
    self.requestedTier = entry.requestedTier.rawValue
    self.route = entry.route.rawValue
    self.outcome = entry.outcome.rawValue
    self.humanGateState = entry.humanGateState.rawValue
    self.updatedAt = entry.updatedAt
    self.decisionSummary = entry.decisionSummary
  }

  /// Whether this queue item still needs reviewer or human action.
  public var requiresAttention: Bool {
    humanGateState == "waitingApproval" || outcome == "review_required" || outcome == "escalated_to_human"
  }
}

/// Aggregated reviewer-facing workbench for one project-scoped TAP surface.
public struct PraxisRuntimeTapReviewWorkbench: Sendable {
  public let inspection: PraxisTapInspectionSnapshot
  public let tapOverview: PraxisRuntimeTapProjectOverview
  public let cmpOverview: PraxisRuntimeCmpProjectOverview
  public let queueItems: [PraxisRuntimeTapReviewQueueItem]

  public init(
    inspection: PraxisTapInspectionSnapshot,
    tapOverview: PraxisRuntimeTapProjectOverview,
    cmpOverview: PraxisRuntimeCmpProjectOverview
  ) {
    self.inspection = inspection
    self.tapOverview = tapOverview
    self.cmpOverview = cmpOverview
    self.queueItems = tapOverview.history.entries.map(PraxisRuntimeTapReviewQueueItem.init)
  }

  /// Stable project identifier shared by the aggregated workbench state.
  public var projectID: String {
    tapOverview.projectID
  }

  /// Stable scoped agent identifier when the workbench is agent-filtered.
  public var agentID: String? {
    tapOverview.agentID ?? cmpOverview.agentID
  }

  /// Current reviewer-facing queue entries that still require attention.
  public var pendingItems: [PraxisRuntimeTapReviewQueueItem] {
    var latestItemsByReviewKey: [String: PraxisRuntimeTapReviewQueueItem] = [:]
    for item in queueItems {
      let reviewKey = "\(item.agentID)|\(item.targetAgentID)|\(item.capabilityID)"
      if let existing = latestItemsByReviewKey[reviewKey] {
        if item.isMoreCurrent(than: existing) {
          latestItemsByReviewKey[reviewKey] = item
        }
      } else {
        latestItemsByReviewKey[reviewKey] = item
      }
    }
    return queueItems.compactMap { item in
      let reviewKey = "\(item.agentID)|\(item.targetAgentID)|\(item.capabilityID)"
      guard latestItemsByReviewKey[reviewKey] == item else {
        return nil
      }
      return item
    }.filter(\.requiresAttention)
  }

  /// Latest decision summary surfaced by TAP status or inspection.
  public var latestDecisionSummary: String? {
    tapOverview.latestDecisionSummary ?? inspection.latestDecisionSummary
  }

  /// High-level reviewer workbench summary suitable for logs or diagnostics.
  public var summary: String {
    "Reviewer workbench for \(projectID) sees \(pendingItems.count) pending queue item(s), \(tapOverview.approvedApprovalCount) approved item(s), and \(inspection.availableCapabilityCount) registered capability surface(s)."
  }
}

private extension PraxisRuntimeTapReviewQueueItem {
  func isMoreCurrent(than other: PraxisRuntimeTapReviewQueueItem) -> Bool {
    if updatedAt != other.updatedAt {
      return updatedAt > other.updatedAt
    }
    return statePriority > other.statePriority
  }

  var statePriority: Int {
    if !requiresAttention {
      return 2
    }
    if humanGateState == "waitingApproval" {
      return 1
    }
    return 0
  }
}
