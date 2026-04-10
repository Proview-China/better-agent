import PraxisCmpTypes

public typealias PraxisContextPackage = PraxisCmpContextPackage

public enum PraxisCmpActiveLineStage: String, Sendable, Codable {
  case captured
  case queuedForGit
  case writtenToGit
  case candidateReady
  case checkedReady
  case promotedPending
}

public struct PraxisCmpActiveLineRecord: Sendable, Equatable, Codable {
  public let lineageID: PraxisCmpLineageID
  public let stage: PraxisCmpActiveLineStage
  public let latestEventID: PraxisCmpEventID?
  public let deltaID: PraxisCmpDeltaID?
  public let snapshotID: PraxisCmpSnapshotID?
  public let updatedAt: String

  public init(
    lineageID: PraxisCmpLineageID,
    stage: PraxisCmpActiveLineStage,
    latestEventID: PraxisCmpEventID? = nil,
    deltaID: PraxisCmpDeltaID? = nil,
    snapshotID: PraxisCmpSnapshotID? = nil,
    updatedAt: String
  ) {
    self.lineageID = lineageID
    self.stage = stage
    self.latestEventID = latestEventID
    self.deltaID = deltaID
    self.snapshotID = snapshotID
    self.updatedAt = updatedAt
  }
}

public struct PraxisDispatchInstruction: Sendable, Equatable, Codable {
  public let packageID: PraxisCmpPackageID
  public let sourceAgentID: String
  public let targetAgentID: String
  public let targetKind: PraxisCmpDispatchTargetKind
  public let reason: String
  public let summary: String

  public init(
    packageID: PraxisCmpPackageID,
    sourceAgentID: String,
    targetAgentID: String,
    targetKind: PraxisCmpDispatchTargetKind,
    reason: String,
    summary: String
  ) {
    self.packageID = packageID
    self.sourceAgentID = sourceAgentID
    self.targetAgentID = targetAgentID
    self.targetKind = targetKind
    self.reason = reason
    self.summary = summary
  }
}

public struct PraxisDeliveryPlan: Sendable, Equatable, Codable {
  public let contextPackage: PraxisContextPackage
  public let instructions: [PraxisDispatchInstruction]
  public let fallback: PraxisDeliveryFallbackPlan?

  public init(
    contextPackage: PraxisContextPackage,
    instructions: [PraxisDispatchInstruction],
    fallback: PraxisDeliveryFallbackPlan? = nil
  ) {
    self.contextPackage = contextPackage
    self.instructions = instructions
    self.fallback = fallback
  }
}

public struct PraxisDeliveryFallbackPlan: Sendable, Equatable, Codable {
  public let query: PraxisCmpHistoricalContextQuery
  public let summary: String

  public init(query: PraxisCmpHistoricalContextQuery, summary: String) {
    self.query = query
    self.summary = summary
  }
}
