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

/// Identifies which host-neutral recovery path produced a CMP project recovery result.
public enum PraxisCmpRecoverySource: String, Sendable, Codable {
  case historicalContext = "historical_context"
  case historicalSnapshot = "historical_snapshot"
  case projectionMaterialization = "projection_materialization"
}

public enum PraxisCmpProjectExecutionStyle: String, Sendable, Codable {
  case localFirst = "local-first"
}

public enum PraxisCmpProjectStructuredStoreProfile: String, Sendable, Codable {
  case sqlite
  case incomplete
}

public enum PraxisCmpProjectDeliveryStoreProfile: String, Sendable, Codable {
  case sqlite
  case missing
}

public enum PraxisCmpProjectMessageTransportProfile: String, Sendable, Codable {
  case inProcessActorBus = "in_process_actor_bus"
  case missing
}

public enum PraxisCmpProjectGitAccessProfile: String, Sendable, Codable {
  case systemGit = "system_git"
  case degraded
}

public enum PraxisCmpProjectSemanticIndexProfile: String, Sendable, Codable {
  case localSemanticIndex = "local_semantic_index"
  case partial
}

public enum PraxisCmpProjectComponent: String, Sendable, Codable {
  case workspace
  case structuredStore
  case packageRegistry
  case deliveryTruth
  case messageBus
  case gitProbe
  case gitExecutor
  case lineageStore
  case semanticIndex
  case semanticMemory
  case embeddingStore
}

public enum PraxisCmpProjectComponentStatus: String, Sendable, Codable {
  case ready
  case degraded
  case missing
}

public enum PraxisCmpSmokeGate: String, Sendable, Codable {
  case workspace
  case persistence
  case delivery
  case git
  case lineage
}

public struct PraxisCmpPackageStatusCountMap: Sendable, Equatable, Codable {
  public let counts: [PraxisCmpPackageStatus: Int]

  public init(counts: [PraxisCmpPackageStatus: Int]) {
    self.counts = counts
  }

  public subscript(_ status: PraxisCmpPackageStatus) -> Int? {
    counts[status]
  }

  public var isEmpty: Bool {
    counts.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var counts: [PraxisCmpPackageStatus: Int] = [:]

    for key in container.allKeys {
      guard let status = PraxisCmpPackageStatus(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP package status key \(key.stringValue)."
        )
      }

      counts[status] = try container.decode(Int.self, forKey: key)
    }

    self.init(counts: counts)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for status in counts.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: status.rawValue)!
      try container.encode(counts[status], forKey: key)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}

public struct PraxisCmpProjectComponentStatusMap: Sendable, Equatable, Codable {
  public let statuses: [PraxisCmpProjectComponent: PraxisCmpProjectComponentStatus]

  public init(statuses: [PraxisCmpProjectComponent: PraxisCmpProjectComponentStatus]) {
    self.statuses = statuses
  }

  public subscript(_ component: PraxisCmpProjectComponent) -> PraxisCmpProjectComponentStatus? {
    statuses[component]
  }

  public var isEmpty: Bool {
    statuses.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var statuses: [PraxisCmpProjectComponent: PraxisCmpProjectComponentStatus] = [:]

    for key in container.allKeys {
      guard let component = PraxisCmpProjectComponent(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP project component key \(key.stringValue)."
        )
      }

      let rawStatus = try container.decode(String.self, forKey: key)
      guard let status = PraxisCmpProjectComponentStatus(rawValue: rawStatus) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid CMP project component status \(rawStatus) for component \(component.rawValue)."
        )
      }

      statuses[component] = status
    }

    self.init(statuses: statuses)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for component in statuses.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: component.rawValue)!
      try container.encode(statuses[component]?.rawValue, forKey: key)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}

/// Stable readback-only dispatch status exposed by CMP roles/control/status surfaces.
public enum PraxisCmpLatestDispatchStatus: String, Sendable, Codable {
  case prepared
  case delivered
  case acknowledged
  case rejected
  case retryScheduled
  case expired
}

/// Stable readback-only role stage exposed by CMP roles/status surfaces.
public enum PraxisCmpRoleStage: String, Sendable, Codable {
  case ingested
  case candidateReady
  case checkedReady
  case projectionReady
  case materialized
  case prepared
  case delivered
  case acknowledged
  case rejected
  case retryScheduled
  case expired

  public init(dispatchStatus: PraxisCmpDispatchStatus) {
    switch dispatchStatus {
    case .prepared:
      self = .prepared
    case .delivered:
      self = .delivered
    case .acknowledged:
      self = .acknowledged
    case .rejected:
      self = .rejected
    case .expired:
      self = .expired
    }
  }

  public init(latestDispatchStatus: PraxisCmpLatestDispatchStatus) {
    switch latestDispatchStatus {
    case .prepared:
      self = .prepared
    case .delivered:
      self = .delivered
    case .acknowledged:
      self = .acknowledged
    case .rejected:
      self = .rejected
    case .retryScheduled:
      self = .retryScheduled
    case .expired:
      self = .expired
    }
  }
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
