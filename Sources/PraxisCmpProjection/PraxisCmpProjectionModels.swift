import PraxisCheckpoint
import PraxisCmpTypes
import PraxisCmpSections
import PraxisCoreTypes

public struct PraxisProjectionRecord: Sendable, Equatable, Codable {
  public let id: PraxisCmpProjectionID
  public let snapshotID: PraxisCmpSnapshotID
  public let lineageID: PraxisCmpLineageID
  public let agentID: String
  public let sectionIDs: [PraxisCmpSectionID]
  public let storedRefs: [String]
  public let visibilityLevel: PraxisCmpProjectionVisibilityLevel
  public let updatedAt: String
  public let metadata: [String: PraxisValue]

  public init(
    id: PraxisCmpProjectionID,
    snapshotID: PraxisCmpSnapshotID,
    lineageID: PraxisCmpLineageID,
    agentID: String,
    sectionIDs: [PraxisCmpSectionID],
    storedRefs: [String],
    visibilityLevel: PraxisCmpProjectionVisibilityLevel,
    updatedAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.snapshotID = snapshotID
    self.lineageID = lineageID
    self.agentID = agentID
    self.sectionIDs = sectionIDs
    self.storedRefs = storedRefs
    self.visibilityLevel = visibilityLevel
    self.updatedAt = updatedAt
    self.metadata = metadata
  }
}

public struct PraxisMaterializationPlan: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let targetAgentID: String
  public let packageKind: PraxisCmpContextPackageKind
  public let selectedSectionIDs: [PraxisCmpSectionID]
  public let summary: String

  public init(
    projectionID: PraxisCmpProjectionID,
    targetAgentID: String,
    packageKind: PraxisCmpContextPackageKind,
    selectedSectionIDs: [PraxisCmpSectionID],
    summary: String
  ) {
    self.projectionID = projectionID
    self.targetAgentID = targetAgentID
    self.packageKind = packageKind
    self.selectedSectionIDs = selectedSectionIDs
    self.summary = summary
  }
}

public struct PraxisVisibilityPolicy: Sendable, Equatable, Codable {
  public let relation: PraxisCmpNeighborhoodRelation
  public let allowedLevels: [PraxisCmpProjectionVisibilityLevel]
  public let summary: String

  public init(
    relation: PraxisCmpNeighborhoodRelation,
    allowedLevels: [PraxisCmpProjectionVisibilityLevel],
    summary: String
  ) {
    self.relation = relation
    self.allowedLevels = allowedLevels
    self.summary = summary
  }
}

public struct PraxisProjectionRecoveryPlan: Sendable, Equatable, Codable {
  public let projectionID: PraxisCmpProjectionID
  public let checkpointPointer: PraxisCheckpointPointer?
  public let resumable: Bool
  public let missingSectionIDs: [PraxisCmpSectionID]
  public let summary: String

  public init(
    projectionID: PraxisCmpProjectionID,
    checkpointPointer: PraxisCheckpointPointer?,
    resumable: Bool,
    missingSectionIDs: [PraxisCmpSectionID],
    summary: String
  ) {
    self.projectionID = projectionID
    self.checkpointPointer = checkpointPointer
    self.resumable = resumable
    self.missingSectionIDs = missingSectionIDs
    self.summary = summary
  }
}

public struct PraxisCmpRuntimeSnapshot: Sendable, Equatable, Codable {
  public let checkedSnapshotIDs: [PraxisCmpSnapshotID]
  public let projectionIDs: [PraxisCmpProjectionID]
  public let latestProjectionByAgentID: [String: PraxisCmpProjectionID]
  public let checkpointPointer: PraxisCheckpointPointer?

  public init(
    checkedSnapshotIDs: [PraxisCmpSnapshotID],
    projectionIDs: [PraxisCmpProjectionID],
    latestProjectionByAgentID: [String: PraxisCmpProjectionID],
    checkpointPointer: PraxisCheckpointPointer? = nil
  ) {
    self.checkedSnapshotIDs = checkedSnapshotIDs
    self.projectionIDs = projectionIDs
    self.latestProjectionByAgentID = latestProjectionByAgentID
    self.checkpointPointer = checkpointPointer
  }
}

public struct PraxisCmpRuntimeHydratedRecovery: Sendable, Equatable, Codable {
  public let snapshot: PraxisCmpRuntimeSnapshot
  public let resumableProjectionIDs: [PraxisCmpProjectionID]
  public let missingProjectionIDs: [PraxisCmpProjectionID]
  public let issues: [String]

  public init(
    snapshot: PraxisCmpRuntimeSnapshot,
    resumableProjectionIDs: [PraxisCmpProjectionID],
    missingProjectionIDs: [PraxisCmpProjectionID],
    issues: [String]
  ) {
    self.snapshot = snapshot
    self.resumableProjectionIDs = resumableProjectionIDs
    self.missingProjectionIDs = missingProjectionIDs
    self.issues = issues
  }
}
