import PraxisCoreTypes

/// Describes the stable branch family attached to a CMP lineage.
public struct PraxisCmpBranchFamily: Sendable, Equatable, Codable {
  public let workBranch: String
  public let cmpBranch: String
  public let mpBranch: String
  public let tapBranch: String

  /// Creates a branch family from explicit branch names.
  ///
  /// - Parameters:
  ///   - workBranch: Work branch name for the lineage.
  ///   - cmpBranch: CMP branch name for the lineage.
  ///   - mpBranch: MP branch name for the lineage.
  ///   - tapBranch: TAP branch name for the lineage.
  public init(workBranch: String, cmpBranch: String, mpBranch: String, tapBranch: String) {
    self.workBranch = workBranch
    self.cmpBranch = cmpBranch
    self.mpBranch = mpBranch
    self.tapBranch = tapBranch
  }
}

/// Represents a lineage node inside the CMP project topology.
public struct PraxisCmpAgentLineage: Sendable, Equatable, Codable {
  public let id: PraxisCmpLineageID
  public let projectID: String
  public let agentID: String
  public let parentAgentID: String?
  public let depth: Int
  public let branchFamily: PraxisCmpBranchFamily
  public let childAgentIDs: [String]
  public let peerAgentIDs: [String]
  public let status: PraxisCmpLineageStatus
  public let metadata: [String: PraxisValue]

  /// Creates a CMP lineage record.
  ///
  /// - Parameters:
  ///   - id: Stable lineage identifier.
  ///   - projectID: Project that owns the lineage.
  ///   - agentID: Agent identifier represented by the lineage.
  ///   - parentAgentID: Optional direct parent agent identifier.
  ///   - depth: Depth in the lineage tree.
  ///   - branchFamily: Stable branch family attached to the lineage.
  ///   - childAgentIDs: Known direct child identifiers.
  ///   - peerAgentIDs: Known peer identifiers under the same parent.
  ///   - status: Current lineage lifecycle status.
  ///   - metadata: Plain metadata attached to the lineage.
  public init(
    id: PraxisCmpLineageID,
    projectID: String,
    agentID: String,
    parentAgentID: String? = nil,
    depth: Int,
    branchFamily: PraxisCmpBranchFamily,
    childAgentIDs: [String] = [],
    peerAgentIDs: [String] = [],
    status: PraxisCmpLineageStatus = .active,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.projectID = projectID
    self.agentID = agentID
    self.parentAgentID = parentAgentID
    self.depth = depth
    self.branchFamily = branchFamily
    self.childAgentIDs = childAgentIDs
    self.peerAgentIDs = peerAgentIDs
    self.status = status
    self.metadata = metadata
  }
}

/// Represents a plain runtime context material captured by CMP ingress.
public struct PraxisCmpRuntimeContextMaterial: Sendable, Equatable, Codable {
  public let kind: PraxisCmpContextEventKind
  public let ref: String
  public let metadata: [String: PraxisValue]

  /// Creates a runtime context material.
  ///
  /// - Parameters:
  ///   - kind: Canonical material kind.
  ///   - ref: Stable payload reference.
  ///   - metadata: Plain metadata attached to the material.
  public init(
    kind: PraxisCmpContextEventKind,
    ref: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.kind = kind
    self.ref = ref
    self.metadata = metadata
  }
}

/// Represents a single raw history event captured by CMP.
public struct PraxisCmpContextEvent: Sendable, Equatable, Codable {
  public let id: PraxisCmpEventID
  public let agentID: String
  public let sessionID: String
  public let runID: String?
  public let kind: PraxisCmpContextEventKind
  public let payloadRef: String
  public let createdAt: String
  public let source: PraxisCmpContextEventSource
  public let metadata: [String: PraxisValue]

  /// Creates a context event.
  ///
  /// - Parameters:
  ///   - id: Stable event identifier.
  ///   - agentID: Agent that emitted the event.
  ///   - sessionID: Session that owns the event.
  ///   - runID: Optional run identifier.
  ///   - kind: Canonical event kind.
  ///   - payloadRef: Stable payload reference.
  ///   - createdAt: Event creation timestamp.
  ///   - source: Source surface that emitted the event.
  ///   - metadata: Plain event metadata.
  public init(
    id: PraxisCmpEventID,
    agentID: String,
    sessionID: String,
    runID: String? = nil,
    kind: PraxisCmpContextEventKind,
    payloadRef: String,
    createdAt: String,
    source: PraxisCmpContextEventSource,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.agentID = agentID
    self.sessionID = sessionID
    self.runID = runID
    self.kind = kind
    self.payloadRef = payloadRef
    self.createdAt = createdAt
    self.source = source
    self.metadata = metadata
  }
}

/// Represents a structured context delta derived from raw history events.
public struct PraxisCmpContextDelta: Sendable, Equatable, Codable {
  public let id: PraxisCmpDeltaID
  public let agentID: String
  public let baseRef: String?
  public let eventRefs: [PraxisCmpEventID]
  public let changeSummary: String
  public let createdAt: String
  public let syncIntent: PraxisCmpContextSyncIntent
  public let metadata: [String: PraxisValue]

  /// Creates a context delta.
  ///
  /// - Parameters:
  ///   - id: Stable delta identifier.
  ///   - agentID: Agent that owns the delta.
  ///   - baseRef: Optional base reference from which the delta was derived.
  ///   - eventRefs: Stable event identifiers captured by the delta.
  ///   - changeSummary: Human-readable delta summary.
  ///   - createdAt: Delta creation timestamp.
  ///   - syncIntent: Intended downstream propagation policy.
  ///   - metadata: Plain delta metadata.
  public init(
    id: PraxisCmpDeltaID,
    agentID: String,
    baseRef: String? = nil,
    eventRefs: [PraxisCmpEventID],
    changeSummary: String,
    createdAt: String,
    syncIntent: PraxisCmpContextSyncIntent,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.agentID = agentID
    self.baseRef = baseRef
    self.eventRefs = eventRefs
    self.changeSummary = changeSummary
    self.createdAt = createdAt
    self.syncIntent = syncIntent
    self.metadata = metadata
  }
}

/// Represents a candidate snapshot waiting for checker review.
public struct PraxisCmpSnapshotCandidate: Sendable, Equatable, Codable {
  public let id: PraxisCmpSnapshotID
  public let lineageID: PraxisCmpLineageID
  public let agentID: String
  public let branchRef: String
  public let commitRef: String
  public let deltaRefs: [PraxisCmpDeltaID]
  public let createdAt: String
  public let status: PraxisCmpSnapshotCandidateStatus
  public let metadata: [String: PraxisValue]

  /// Creates a snapshot candidate.
  ///
  /// - Parameters:
  ///   - id: Stable candidate identifier.
  ///   - lineageID: Lineage that owns the candidate.
  ///   - agentID: Agent that produced the candidate.
  ///   - branchRef: CMP branch reference.
  ///   - commitRef: Commit reference captured by the candidate.
  ///   - deltaRefs: Source deltas represented by the candidate.
  ///   - createdAt: Candidate creation timestamp.
  ///   - status: Current candidate review status.
  ///   - metadata: Plain candidate metadata.
  public init(
    id: PraxisCmpSnapshotID,
    lineageID: PraxisCmpLineageID,
    agentID: String,
    branchRef: String,
    commitRef: String,
    deltaRefs: [PraxisCmpDeltaID],
    createdAt: String,
    status: PraxisCmpSnapshotCandidateStatus = .pending,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.lineageID = lineageID
    self.agentID = agentID
    self.branchRef = branchRef
    self.commitRef = commitRef
    self.deltaRefs = deltaRefs
    self.createdAt = createdAt
    self.status = status
    self.metadata = metadata
  }
}

/// Represents a checked snapshot approved for downstream use.
public struct PraxisCmpCheckedSnapshot: Sendable, Equatable, Codable {
  public let id: PraxisCmpSnapshotID
  public let lineageID: PraxisCmpLineageID
  public let agentID: String
  public let branchRef: String
  public let commitRef: String
  public let checkedAt: String
  public let qualityLabel: PraxisCmpCheckedSnapshotQualityLabel
  public let promotable: Bool
  public let sourceDeltaRefs: [PraxisCmpDeltaID]
  public let metadata: [String: PraxisValue]

  /// Creates a checked snapshot.
  ///
  /// - Parameters:
  ///   - id: Stable snapshot identifier.
  ///   - lineageID: Lineage that owns the snapshot.
  ///   - agentID: Agent that produced the snapshot.
  ///   - branchRef: Checked branch reference.
  ///   - commitRef: Checked commit reference.
  ///   - checkedAt: Checker completion timestamp.
  ///   - qualityLabel: Quality grade for downstream selection.
  ///   - promotable: Whether the snapshot can be promoted upward.
  ///   - sourceDeltaRefs: Source deltas captured in the snapshot.
  ///   - metadata: Plain snapshot metadata.
  public init(
    id: PraxisCmpSnapshotID,
    lineageID: PraxisCmpLineageID,
    agentID: String,
    branchRef: String,
    commitRef: String,
    checkedAt: String,
    qualityLabel: PraxisCmpCheckedSnapshotQualityLabel,
    promotable: Bool,
    sourceDeltaRefs: [PraxisCmpDeltaID],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.lineageID = lineageID
    self.agentID = agentID
    self.branchRef = branchRef
    self.commitRef = commitRef
    self.checkedAt = checkedAt
    self.qualityLabel = qualityLabel
    self.promotable = promotable
    self.sourceDeltaRefs = sourceDeltaRefs
    self.metadata = metadata
  }
}

/// Represents a request record inside CMP control flow.
public struct PraxisCmpRequestRecord: Sendable, Equatable, Codable {
  public let id: PraxisCmpRequestID
  public let projectID: String
  public let requesterAgentID: String
  public let kind: PraxisCmpRequestKind
  public let status: PraxisCmpRequestStatus
  public let sourceAnchors: [String]
  public let createdAt: String
  public let updatedAt: String
  public let metadata: [String: PraxisValue]

  /// Creates a request record.
  ///
  /// - Parameters:
  ///   - id: Stable request identifier.
  ///   - projectID: Project that owns the request.
  ///   - requesterAgentID: Agent that opened the request.
  ///   - kind: Request kind.
  ///   - status: Request lifecycle status.
  ///   - sourceAnchors: Source anchor identifiers.
  ///   - createdAt: Request creation timestamp.
  ///   - updatedAt: Latest request update timestamp.
  ///   - metadata: Plain request metadata.
  public init(
    id: PraxisCmpRequestID,
    projectID: String,
    requesterAgentID: String,
    kind: PraxisCmpRequestKind,
    status: PraxisCmpRequestStatus,
    sourceAnchors: [String],
    createdAt: String,
    updatedAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.kind = kind
    self.status = status
    self.sourceAnchors = sourceAnchors
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.metadata = metadata
  }
}

/// Represents a promoted projection record visible to delivery planning.
public struct PraxisCmpPromotedProjection: Sendable, Equatable, Codable {
  public let id: PraxisCmpProjectionID
  public let snapshotID: PraxisCmpSnapshotID
  public let agentID: String
  public let visibilityLevel: PraxisCmpProjectionVisibilityLevel
  public let promotionStatus: PraxisCmpProjectionPromotionStatus
  public let projectionRefs: [String]
  public let updatedAt: String
  public let metadata: [String: PraxisValue]

  /// Creates a promoted projection record.
  ///
  /// - Parameters:
  ///   - id: Stable projection identifier.
  ///   - snapshotID: Source checked snapshot identifier.
  ///   - agentID: Agent that owns the projection.
  ///   - visibilityLevel: Current visibility level.
  ///   - promotionStatus: Current promotion status.
  ///   - projectionRefs: Backing projection references.
  ///   - updatedAt: Last update timestamp.
  ///   - metadata: Plain projection metadata.
  public init(
    id: PraxisCmpProjectionID,
    snapshotID: PraxisCmpSnapshotID,
    agentID: String,
    visibilityLevel: PraxisCmpProjectionVisibilityLevel,
    promotionStatus: PraxisCmpProjectionPromotionStatus,
    projectionRefs: [String],
    updatedAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.snapshotID = snapshotID
    self.agentID = agentID
    self.visibilityLevel = visibilityLevel
    self.promotionStatus = promotionStatus
    self.projectionRefs = projectionRefs
    self.updatedAt = updatedAt
    self.metadata = metadata
  }
}

/// Represents a high-signal context package prepared for delivery.
public struct PraxisCmpContextPackage: Sendable, Equatable, Codable {
  public let id: PraxisCmpPackageID
  public let sourceProjectionID: PraxisCmpProjectionID
  public let sourceSnapshotID: PraxisCmpSnapshotID?
  public let sourceAgentID: String
  public let targetAgentID: String
  public let kind: PraxisCmpContextPackageKind
  public let packageRef: String
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel
  public let createdAt: String
  public let status: PraxisCmpPackageStatus
  public let sourceSectionIDs: [PraxisCmpSectionID]
  public let metadata: [String: PraxisValue]

  /// Creates a context package.
  ///
  /// - Parameters:
  ///   - id: Stable package identifier.
  ///   - sourceProjectionID: Source projection identifier.
  ///   - sourceSnapshotID: Optional source checked snapshot identifier.
  ///   - sourceAgentID: Agent that produced the package.
  ///   - targetAgentID: Intended target agent identifier.
  ///   - kind: Package kind.
  ///   - packageRef: Stable package payload reference.
  ///   - fidelityLabel: Signal fidelity label.
  ///   - createdAt: Package creation timestamp.
  ///   - status: Current package lifecycle status.
  ///   - sourceSectionIDs: Source section identifiers included in the package.
  ///   - metadata: Plain package metadata.
  public init(
    id: PraxisCmpPackageID,
    sourceProjectionID: PraxisCmpProjectionID,
    sourceSnapshotID: PraxisCmpSnapshotID? = nil,
    sourceAgentID: String,
    targetAgentID: String,
    kind: PraxisCmpContextPackageKind,
    packageRef: String,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel,
    createdAt: String,
    status: PraxisCmpPackageStatus = .materialized,
    sourceSectionIDs: [PraxisCmpSectionID] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.sourceProjectionID = sourceProjectionID
    self.sourceSnapshotID = sourceSnapshotID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.kind = kind
    self.packageRef = packageRef
    self.fidelityLabel = fidelityLabel
    self.createdAt = createdAt
    self.status = status
    self.sourceSectionIDs = sourceSectionIDs
    self.metadata = metadata
  }
}

/// Represents a dispatch receipt emitted after a package delivery attempt.
public struct PraxisCmpDispatchReceipt: Sendable, Equatable, Codable {
  public let id: PraxisCmpDispatchReceiptID
  public let packageID: PraxisCmpPackageID
  public let sourceAgentID: String
  public let targetAgentID: String
  public let targetKind: PraxisCmpDispatchTargetKind
  public let status: PraxisCmpDispatchStatus
  public let createdAt: String
  public let deliveredAt: String?
  public let acknowledgedAt: String?
  public let metadata: [String: PraxisValue]

  /// Creates a dispatch receipt.
  ///
  /// - Parameters:
  ///   - id: Stable receipt identifier.
  ///   - packageID: Package covered by the receipt.
  ///   - sourceAgentID: Source agent identifier.
  ///   - targetAgentID: Target agent identifier.
  ///   - targetKind: Target relation kind.
  ///   - status: Delivery lifecycle status.
  ///   - createdAt: Receipt creation timestamp.
  ///   - deliveredAt: Optional delivery timestamp.
  ///   - acknowledgedAt: Optional acknowledgement timestamp.
  ///   - metadata: Plain receipt metadata.
  public init(
    id: PraxisCmpDispatchReceiptID,
    packageID: PraxisCmpPackageID,
    sourceAgentID: String,
    targetAgentID: String,
    targetKind: PraxisCmpDispatchTargetKind,
    status: PraxisCmpDispatchStatus,
    createdAt: String,
    deliveredAt: String? = nil,
    acknowledgedAt: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.packageID = packageID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.targetKind = targetKind
    self.status = status
    self.createdAt = createdAt
    self.deliveredAt = deliveredAt
    self.acknowledgedAt = acknowledgedAt
    self.metadata = metadata
  }
}

/// Represents a sync-side control event emitted by CMP planners.
public struct PraxisCmpSyncEvent: Sendable, Equatable, Codable {
  public let id: PraxisCmpSyncEventID
  public let objectRef: String
  public let channel: PraxisCmpSyncEventChannel
  public let direction: PraxisCmpSyncEventDirection
  public let createdAt: String
  public let metadata: [String: PraxisValue]

  /// Creates a sync event.
  ///
  /// - Parameters:
  ///   - id: Stable event identifier.
  ///   - objectRef: Object reference carried by the sync event.
  ///   - channel: Target control-plane channel.
  ///   - direction: Inbound or outbound direction.
  ///   - createdAt: Event creation timestamp.
  ///   - metadata: Plain event metadata.
  public init(
    id: PraxisCmpSyncEventID,
    objectRef: String,
    channel: PraxisCmpSyncEventChannel,
    direction: PraxisCmpSyncEventDirection,
    createdAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.objectRef = objectRef
    self.channel = channel
    self.direction = direction
    self.createdAt = createdAt
    self.metadata = metadata
  }
}

/// Represents a critical escalation alert that must leave the normal CMP lanes.
public struct PraxisCmpEscalationAlert: Sendable, Equatable, Codable {
  public let id: PraxisCmpEscalationID
  public let severity: PraxisCmpEscalationSeverity
  public let reason: String
  public let evidenceRef: String
  public let createdAt: String
  public let targetAncestorID: String?
  public let metadata: [String: PraxisValue]

  /// Creates an escalation alert.
  ///
  /// - Parameters:
  ///   - id: Stable escalation identifier.
  ///   - severity: Escalation severity.
  ///   - reason: Human-readable escalation reason.
  ///   - evidenceRef: Stable evidence reference.
  ///   - createdAt: Alert creation timestamp.
  ///   - targetAncestorID: Optional target ancestor identifier.
  ///   - metadata: Plain alert metadata.
  public init(
    id: PraxisCmpEscalationID,
    severity: PraxisCmpEscalationSeverity,
    reason: String,
    evidenceRef: String,
    createdAt: String,
    targetAncestorID: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.severity = severity
    self.reason = reason
    self.evidenceRef = evidenceRef
    self.createdAt = createdAt
    self.targetAncestorID = targetAncestorID
    self.metadata = metadata
  }
}

/// Represents a passive-history query sent into CMP.
public struct PraxisCmpHistoricalContextQuery: Sendable, Equatable, Codable {
  public let snapshotID: PraxisCmpSnapshotID?
  public let lineageID: PraxisCmpLineageID?
  public let branchRef: PraxisCmpRefName?
  public let packageKindHint: PraxisCmpContextPackageKind?
  public let projectionVisibilityHint: PraxisCmpProjectionVisibilityLevel?
  public let metadata: [String: PraxisValue]

  /// Creates a passive-history query.
  ///
  /// - Parameters:
  ///   - snapshotID: Optional exact snapshot identifier to query.
  ///   - lineageID: Optional lineage identifier to scope the query.
  ///   - branchRef: Optional branch reference hint.
  ///   - packageKindHint: Optional package kind hint.
  ///   - projectionVisibilityHint: Optional visibility hint.
  ///   - metadata: Plain query metadata.
  public init(
    snapshotID: PraxisCmpSnapshotID? = nil,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: PraxisCmpRefName? = nil,
    packageKindHint: PraxisCmpContextPackageKind? = nil,
    projectionVisibilityHint: PraxisCmpProjectionVisibilityLevel? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.snapshotID = snapshotID
    self.lineageID = lineageID
    self.branchRef = praxisCmpNormalizedRef(branchRef)
    self.packageKindHint = packageKindHint
    self.projectionVisibilityHint = projectionVisibilityHint
    self.metadata = metadata
  }

  @_disfavoredOverload
  public init(
    snapshotID: PraxisCmpSnapshotID? = nil,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: String? = nil,
    packageKindHint: PraxisCmpContextPackageKind? = nil,
    projectionVisibilityHint: PraxisCmpProjectionVisibilityLevel? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.init(
      snapshotID: snapshotID,
      lineageID: lineageID,
      branchRef: praxisCmpOptionalRef(branchRef),
      packageKindHint: packageKindHint,
      projectionVisibilityHint: projectionVisibilityHint,
      metadata: metadata
    )
  }
}

/// Represents the ingest request entering the CMP interface.
public struct PraxisIngestRuntimeContextInput: Sendable, Equatable, Codable {
  public let agentID: String
  public let projectID: String
  public let sessionID: String
  public let runID: String?
  public let lineage: PraxisCmpAgentLineage
  public let taskSummary: String
  public let materials: [PraxisCmpRuntimeContextMaterial]
  public let requiresActiveSync: Bool
  public let metadata: [String: PraxisValue]

  /// Creates an ingest input.
  ///
  /// - Parameters:
  ///   - agentID: Agent that is currently running.
  ///   - projectID: Project owning the ingest request.
  ///   - sessionID: Session that owns the ingest request.
  ///   - runID: Optional run identifier.
  ///   - lineage: Current lineage metadata.
  ///   - taskSummary: Human-readable task summary.
  ///   - materials: Captured runtime materials.
  ///   - requiresActiveSync: Whether active sync should continue after ingest.
  ///   - metadata: Plain ingest metadata.
  public init(
    agentID: String,
    projectID: String,
    sessionID: String,
    runID: String? = nil,
    lineage: PraxisCmpAgentLineage,
    taskSummary: String,
    materials: [PraxisCmpRuntimeContextMaterial],
    requiresActiveSync: Bool = false,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.agentID = agentID
    self.projectID = projectID
    self.sessionID = sessionID
    self.runID = runID
    self.lineage = lineage
    self.taskSummary = taskSummary
    self.materials = materials
    self.requiresActiveSync = requiresActiveSync
    self.metadata = metadata
  }
}

public enum PraxisCmpFlowIngestNextAction: String, Sendable, Equatable, Codable {
  case commitContextDelta = "commit_context_delta"
  case noop
}

public struct PraxisIngestRuntimeContextResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let acceptedEventIDs: [PraxisCmpEventID]
  public let nextAction: PraxisCmpFlowIngestNextAction
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    acceptedEventIDs: [PraxisCmpEventID],
    nextAction: PraxisCmpFlowIngestNextAction,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.acceptedEventIDs = acceptedEventIDs
    self.nextAction = nextAction
    self.metadata = metadata
  }
}

public struct PraxisCommitContextDeltaInput: Sendable, Equatable, Codable {
  public let agentID: String
  public let projectID: String
  public let sessionID: String
  public let runID: String?
  public let eventIDs: [PraxisCmpEventID]
  public let baseRef: PraxisCmpRefName?
  public let changeSummary: String
  public let syncIntent: PraxisCmpContextSyncIntent
  public let metadata: [String: PraxisValue]

  public init(
    agentID: String,
    projectID: String,
    sessionID: String,
    runID: String? = nil,
    eventIDs: [PraxisCmpEventID],
    baseRef: PraxisCmpRefName? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.agentID = agentID
    self.projectID = projectID
    self.sessionID = sessionID
    self.runID = runID
    self.eventIDs = eventIDs
    self.baseRef = praxisCmpNormalizedRef(baseRef)
    self.changeSummary = changeSummary
    self.syncIntent = syncIntent
    self.metadata = metadata
  }

  @_disfavoredOverload
  public init(
    agentID: String,
    projectID: String,
    sessionID: String,
    runID: String? = nil,
    eventIDs: [PraxisCmpEventID],
    baseRef: String? = nil,
    changeSummary: String,
    syncIntent: PraxisCmpContextSyncIntent,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.init(
      agentID: agentID,
      projectID: projectID,
      sessionID: sessionID,
      runID: runID,
      eventIDs: eventIDs,
      baseRef: praxisCmpOptionalRef(baseRef),
      changeSummary: changeSummary,
      syncIntent: syncIntent,
      metadata: metadata
    )
  }
}

public struct PraxisCommitContextDeltaResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let delta: PraxisCmpContextDelta
  public let snapshotCandidateID: PraxisCmpSnapshotID?
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    delta: PraxisCmpContextDelta,
    snapshotCandidateID: PraxisCmpSnapshotID? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.delta = delta
    self.snapshotCandidateID = snapshotCandidateID
    self.metadata = metadata
  }
}

public struct PraxisResolveCheckedSnapshotInput: Sendable, Equatable, Codable {
  public let agentID: String
  public let projectID: String
  public let lineageID: PraxisCmpLineageID?
  public let branchRef: PraxisCmpRefName?
  public let metadata: [String: PraxisValue]

  public init(
    agentID: String,
    projectID: String,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: PraxisCmpRefName? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.agentID = agentID
    self.projectID = projectID
    self.lineageID = lineageID
    self.branchRef = praxisCmpNormalizedRef(branchRef)
    self.metadata = metadata
  }

  @_disfavoredOverload
  public init(
    agentID: String,
    projectID: String,
    lineageID: PraxisCmpLineageID? = nil,
    branchRef: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.init(
      agentID: agentID,
      projectID: projectID,
      lineageID: lineageID,
      branchRef: praxisCmpOptionalRef(branchRef),
      metadata: metadata
    )
  }
}

public struct PraxisResolveCheckedSnapshotResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let found: Bool
  public let snapshot: PraxisCmpCheckedSnapshot?
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    found: Bool,
    snapshot: PraxisCmpCheckedSnapshot? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.found = found
    self.snapshot = snapshot
    self.metadata = metadata
  }
}

public struct PraxisMaterializeContextPackageInput: Sendable, Equatable, Codable {
  public let agentID: String
  public let snapshotID: PraxisCmpSnapshotID
  public let projectionID: PraxisCmpProjectionID?
  public let targetAgentID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel?
  public let metadata: [String: PraxisValue]

  public init(
    agentID: String,
    snapshotID: PraxisCmpSnapshotID,
    projectionID: PraxisCmpProjectionID? = nil,
    targetAgentID: String,
    packageKind: PraxisCmpContextPackageKind,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.agentID = agentID
    self.snapshotID = snapshotID
    self.projectionID = projectionID
    self.targetAgentID = targetAgentID
    self.packageKind = packageKind
    self.fidelityLabel = fidelityLabel
    self.metadata = metadata
  }
}

public struct PraxisMaterializeContextPackageResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let contextPackage: PraxisCmpContextPackage
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    contextPackage: PraxisCmpContextPackage,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.contextPackage = contextPackage
    self.metadata = metadata
  }
}

public struct PraxisDispatchContextPackageInput: Sendable, Equatable, Codable {
  public let agentID: String
  public let packageID: PraxisCmpPackageID
  public let sourceAgentID: String
  public let targetAgentID: String
  public let targetKind: PraxisCmpDispatchTargetKind
  public let metadata: [String: PraxisValue]

  public init(
    agentID: String,
    packageID: PraxisCmpPackageID,
    sourceAgentID: String,
    targetAgentID: String,
    targetKind: PraxisCmpDispatchTargetKind,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.agentID = agentID
    self.packageID = packageID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.targetKind = targetKind
    self.metadata = metadata
  }
}

public struct PraxisDispatchContextPackageResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let receipt: PraxisCmpDispatchReceipt
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    receipt: PraxisCmpDispatchReceipt,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.receipt = receipt
    self.metadata = metadata
  }
}

public struct PraxisRequestHistoricalContextInput: Sendable, Equatable, Codable {
  public let requesterAgentID: String
  public let projectID: String
  public let reason: String
  public let query: PraxisCmpHistoricalContextQuery
  public let metadata: [String: PraxisValue]

  public init(
    requesterAgentID: String,
    projectID: String,
    reason: String,
    query: PraxisCmpHistoricalContextQuery,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.requesterAgentID = requesterAgentID
    self.projectID = projectID
    self.reason = reason
    self.query = query
    self.metadata = metadata
  }
}

public struct PraxisRequestHistoricalContextResult: Sendable, Equatable, Codable {
  public let status: PraxisCmpInterfaceResultStatus
  public let found: Bool
  public let snapshot: PraxisCmpCheckedSnapshot?
  public let contextPackage: PraxisCmpContextPackage?
  public let metadata: [String: PraxisValue]

  public init(
    status: PraxisCmpInterfaceResultStatus,
    found: Bool,
    snapshot: PraxisCmpCheckedSnapshot? = nil,
    contextPackage: PraxisCmpContextPackage? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.status = status
    self.found = found
    self.snapshot = snapshot
    self.contextPackage = contextPackage
    self.metadata = metadata
  }
}
