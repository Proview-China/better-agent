import PraxisCmpTypes

public enum PraxisCmpDbStorageEngine: String, Sendable, Codable {
  case sqlite
  case postgresql
}

public enum PraxisCmpDbSharedTableKind: String, Sendable, Codable, CaseIterable {
  case agentRegistry
  case agentLineage
  case branchRegistry
  case syncEventRegistry
  case promotionRegistry
  case deliveryRegistry
}

public enum PraxisCmpDbAgentLocalTableKind: String, Sendable, Codable, CaseIterable {
  case events
  case snapshots
  case packages
  case dispatch
}

public enum PraxisCmpDbProjectionState: String, Sendable, Codable {
  case localOnly
  case submittedToParent
  case acceptedByParent
  case promotedByParent
  case dispatchedDownward
  case archived
}

public enum PraxisCmpDbPackageRecordState: String, Sendable, Codable {
  case materialized
  case delivered
  case acknowledged
  case archived
}

public enum PraxisCmpDbDeliveryRecordState: String, Sendable, Codable {
  case pendingDelivery
  case delivered
  case acknowledged
  case rejected
  case expired
}

public struct PraxisStorageTopology: Sendable, Equatable, Codable {
  public let projectID: String
  public let databaseName: String
  public let schemaName: String
  public let tableNames: [String]
  public let storageEngine: PraxisCmpDbStorageEngine

  public init(
    projectID: String,
    databaseName: String,
    schemaName: String,
    tableNames: [String],
    storageEngine: PraxisCmpDbStorageEngine = .sqlite
  ) {
    self.projectID = projectID
    self.databaseName = databaseName
    self.schemaName = schemaName
    self.tableNames = tableNames
    self.storageEngine = storageEngine
  }
}

public struct PraxisCmpDbTableDefinition: Sendable, Equatable, Codable {
  public let tableName: String
  public let ownership: String
  public let kind: String

  public init(tableName: String, ownership: String, kind: String) {
    self.tableName = tableName
    self.ownership = ownership
    self.kind = kind
  }
}

public struct PraxisProjectionPersistencePlan: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let topology: PraxisStorageTopology
  public let state: PraxisCmpDbProjectionState

  public init(
    projectionID: PraxisCmpProjectionID,
    topology: PraxisStorageTopology,
    state: PraxisCmpDbProjectionState
  ) {
    self.projectionID = projectionID
    self.topology = topology
    self.state = state
  }
}

public struct PraxisPackagePersistencePlan: Sendable, Equatable, Codable {
  public let packageID: PraxisCmpPackageID
  public let topology: PraxisStorageTopology
  public let state: PraxisCmpDbPackageRecordState

  public init(
    packageID: PraxisCmpPackageID,
    topology: PraxisStorageTopology,
    state: PraxisCmpDbPackageRecordState
  ) {
    self.packageID = packageID
    self.topology = topology
    self.state = state
  }
}

public struct PraxisDeliveryPersistencePlan: Sendable, Equatable, Codable {
  public let receiptID: PraxisCmpDispatchReceiptID
  public let topology: PraxisStorageTopology
  public let state: PraxisCmpDbDeliveryRecordState

  public init(
    receiptID: PraxisCmpDispatchReceiptID,
    topology: PraxisStorageTopology,
    state: PraxisCmpDbDeliveryRecordState
  ) {
    self.receiptID = receiptID
    self.topology = topology
    self.state = state
  }
}

public struct PraxisCmpDbContextPackageRecord: Sendable, Equatable, Codable {
  public let packageID: PraxisCmpPackageID
  public let sourceProjectionID: PraxisCmpProjectionID
  public let sourceSnapshotID: PraxisCmpSnapshotID?
  public let sourceAgentID: String
  public let targetAgentID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let packageRef: String
  public let fidelityLabel: PraxisCmpContextPackageFidelityLabel
  public let state: PraxisCmpDbPackageRecordState
  public let createdAt: String
  public let updatedAt: String

  public init(
    packageID: PraxisCmpPackageID,
    sourceProjectionID: PraxisCmpProjectionID,
    sourceSnapshotID: PraxisCmpSnapshotID?,
    sourceAgentID: String,
    targetAgentID: String,
    packageKind: PraxisCmpContextPackageKind,
    packageRef: String,
    fidelityLabel: PraxisCmpContextPackageFidelityLabel,
    state: PraxisCmpDbPackageRecordState,
    createdAt: String,
    updatedAt: String
  ) {
    self.packageID = packageID
    self.sourceProjectionID = sourceProjectionID
    self.sourceSnapshotID = sourceSnapshotID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.packageKind = packageKind
    self.packageRef = packageRef
    self.fidelityLabel = fidelityLabel
    self.state = state
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }
}

public struct PraxisCmpDbDeliveryRegistryRecord: Sendable, Equatable, Codable {
  public let deliveryID: String
  public let dispatchID: PraxisCmpDispatchReceiptID
  public let packageID: PraxisCmpPackageID
  public let sourceAgentID: String
  public let targetAgentID: String
  public let state: PraxisCmpDbDeliveryRecordState
  public let createdAt: String
  public let deliveredAt: String?
  public let acknowledgedAt: String?

  public init(
    deliveryID: String,
    dispatchID: PraxisCmpDispatchReceiptID,
    packageID: PraxisCmpPackageID,
    sourceAgentID: String,
    targetAgentID: String,
    state: PraxisCmpDbDeliveryRecordState,
    createdAt: String,
    deliveredAt: String? = nil,
    acknowledgedAt: String? = nil
  ) {
    self.deliveryID = deliveryID
    self.dispatchID = dispatchID
    self.packageID = packageID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.state = state
    self.createdAt = createdAt
    self.deliveredAt = deliveredAt
    self.acknowledgedAt = acknowledgedAt
  }
}
