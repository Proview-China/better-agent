public enum PraxisCmpPriority: String, Sendable, Codable {
  case low
  case normal
  case high
  case urgent
}

public enum PraxisCmpScope: String, Sendable, Codable {
  case local
  case shared
  case global
}

public enum PraxisCmpLineageStatus: String, Sendable, Codable {
  case active
  case paused
  case archived
}

public enum PraxisCmpBranchLayer: String, Sendable, Codable {
  case work
  case cmp
  case mp
  case tap
}

public enum PraxisCmpNeighborhoodRelation: String, Sendable, Codable {
  case same
  case parent
  case peer
  case child
}

public enum PraxisCmpContextEventKind: String, Sendable, Codable {
  case userInput
  case systemPrompt
  case assistantOutput
  case toolResult
  case stateMarker
  case contextPackage
}

public enum PraxisCmpContextEventSource: String, Sendable, Codable {
  case coreAgent
  case user
  case system
  case tooling
  case cmp
}

public enum PraxisCmpContextSyncIntent: String, Sendable, Codable {
  case localOnly
  case toParent
  case toPeers
  case toChildren
  case broadcast
  case criticalEscalation
}

public enum PraxisCmpSnapshotCandidateStatus: String, Sendable, Codable {
  case pending
  case reviewed
  case accepted
  case rejected
}

public enum PraxisCmpCheckedSnapshotQualityLabel: String, Sendable, Codable {
  case draft
  case usable
  case highSignal
}

public enum PraxisCmpRequestKind: String, Sendable, Codable {
  case activeIngest
  case historicalContext
  case materializePackage
  case dispatchPackage
  case reintervention
}

public enum PraxisCmpRequestStatus: String, Sendable, Codable {
  case received
  case reviewed
  case accepted
  case denied
  case served
}

public enum PraxisCmpSectionLifecycleState: String, Sendable, Codable {
  case raw
  case pre
  case checked
  case persisted
}

public enum PraxisCmpSnapshotStage: String, Sendable, Codable {
  case pre
  case checked
  case persisted
}

public enum PraxisCmpPackageStatus: String, Sendable, Codable {
  case materialized
  case dispatched
  case served
  case archived
}

public enum PraxisCmpInterfaceResultStatus: String, Sendable, Codable {
  case accepted
  case resolved
  case materialized
  case dispatched
  case notFound
  case rejected
}

public enum PraxisCmpDispatchTargetKind: String, Sendable, Codable {
  case coreAgent
  case parent
  case peer
  case child
}

public enum PraxisCmpPeerApprovalDecision: String, Sendable, Codable {
  case approve
  case reject
  case release
}

public enum PraxisCmpContextPackageKind: String, Sendable, Codable {
  case runtimeFill
  case childSeed
  case peerExchange
  case historicalReply
}

public enum PraxisCmpRecoveryStatus: String, Sendable, Codable {
  case aligned
  case degraded
}

public enum PraxisCmpContextPackageFidelityLabel: String, Sendable, Codable {
  case exact
  case highSignal
  case summary
}

public enum PraxisCmpProjectionVisibilityLevel: String, Sendable, Codable {
  case localOnly
  case submittedToParent
  case acceptedByParent
  case promotedByParent
  case dispatchedDownward
  case archived
}

public enum PraxisCmpProjectionPromotionStatus: String, Sendable, Codable {
  case pendingPromotion
  case promoted
  case archived
}

public enum PraxisCmpDispatchStatus: String, Sendable, Codable {
  case prepared
  case delivered
  case acknowledged
  case rejected
  case expired
}

public enum PraxisCmpSyncEventChannel: String, Sendable, Codable {
  case git
  case db
  case mq
  case tapBridge
}

public enum PraxisCmpSyncEventDirection: String, Sendable, Codable {
  case outbound
  case inbound
}

public enum PraxisCmpEscalationSeverity: String, Sendable, Codable {
  case high
  case critical
}
