import PraxisMpTypes

public struct PraxisMpSearchPlan: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?
  public let includeSuperseded: Bool

  public init(
    projectID: String,
    query: String,
    scopeLevels: [PraxisMpScopeLevel],
    limit: Int,
    agentID: String? = nil,
    sessionID: String? = nil,
    includeSuperseded: Bool = false
  ) {
    self.projectID = projectID
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
    self.includeSuperseded = includeSuperseded
  }
}

public struct PraxisMpSearchHit: Sendable, Equatable, Codable, Identifiable {
  public let memory: PraxisMpMemoryRecord
  public let semanticScore: Double?
  public let finalScore: Double
  public let rankExplanation: String

  public var id: String {
    memory.id
  }

  public init(
    memory: PraxisMpMemoryRecord,
    semanticScore: Double?,
    finalScore: Double,
    rankExplanation: String
  ) {
    self.memory = memory
    self.semanticScore = semanticScore
    self.finalScore = finalScore
    self.rankExplanation = rankExplanation
  }
}

public struct PraxisMpSearchProjectionHit: Sendable, Equatable, Codable, Identifiable {
  public let memoryID: String
  public let agentID: String
  public let scopeLevel: PraxisMpScopeLevel
  public let memoryKind: PraxisMpMemoryKind
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
  public let summary: String
  public let storageKey: String
  public let semanticScore: Double?
  public let finalScore: Double
  public let rankExplanation: String

  public var id: String {
    memoryID
  }

  public init(
    memoryID: String,
    agentID: String,
    scopeLevel: PraxisMpScopeLevel,
    memoryKind: PraxisMpMemoryKind,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
    summary: String,
    storageKey: String,
    semanticScore: Double?,
    finalScore: Double,
    rankExplanation: String
  ) {
    self.memoryID = memoryID
    self.agentID = agentID
    self.scopeLevel = scopeLevel
    self.memoryKind = memoryKind
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.summary = summary
    self.storageKey = storageKey
    self.semanticScore = semanticScore
    self.finalScore = finalScore
    self.rankExplanation = rankExplanation
  }
}

public struct PraxisMpSearchProjection: Sendable, Equatable, Codable {
  public let summary: String
  public let hits: [PraxisMpSearchProjectionHit]

  public init(summary: String, hits: [PraxisMpSearchProjectionHit]) {
    self.summary = summary
    self.hits = hits
  }
}
