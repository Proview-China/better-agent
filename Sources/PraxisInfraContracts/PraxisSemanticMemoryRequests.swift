public enum PraxisMemoryScopeLevel: String, Sendable, Codable {
  case global
  case project
  case agent
  case session
}

public enum PraxisMemoryKind: String, Sendable, Codable {
  case episodic
  case semantic
  case summary
  case directive
  case statusSnapshot
}

public enum PraxisMemoryFreshnessStatus: String, Sendable, Codable {
  case fresh
  case aging
  case stale
  case superseded
}

public enum PraxisMemoryAlignmentStatus: String, Sendable, Codable {
  case unreviewed
  case aligned
  case drifted
}

public struct PraxisSemanticMemoryRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let projectID: String
  public let agentID: String
  public let scopeLevel: PraxisMemoryScopeLevel
  public let memoryKind: PraxisMemoryKind
  public let summary: String
  public let storageKey: String
  public let freshnessStatus: PraxisMemoryFreshnessStatus
  public let alignmentStatus: PraxisMemoryAlignmentStatus
  public let embeddingStorageKey: String?

  public init(
    id: String,
    projectID: String,
    agentID: String,
    scopeLevel: PraxisMemoryScopeLevel,
    memoryKind: PraxisMemoryKind,
    summary: String,
    storageKey: String,
    freshnessStatus: PraxisMemoryFreshnessStatus,
    alignmentStatus: PraxisMemoryAlignmentStatus,
    embeddingStorageKey: String? = nil
  ) {
    self.id = id
    self.projectID = projectID
    self.agentID = agentID
    self.scopeLevel = scopeLevel
    self.memoryKind = memoryKind
    self.summary = summary
    self.storageKey = storageKey
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.embeddingStorageKey = embeddingStorageKey
  }
}

public struct PraxisSemanticMemoryWriteReceipt: Sendable, Equatable, Codable {
  public let memoryID: String
  public let storageKey: String

  public init(memoryID: String, storageKey: String) {
    self.memoryID = memoryID
    self.storageKey = storageKey
  }
}

public struct PraxisSemanticMemorySearchRequest: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMemoryScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?

  public init(
    projectID: String,
    query: String,
    scopeLevels: [PraxisMemoryScopeLevel],
    limit: Int = 5,
    agentID: String? = nil,
    sessionID: String? = nil
  ) {
    self.projectID = projectID
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
  }
}

public struct PraxisSemanticMemoryBundleRequest: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMemoryScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?
  public let includeSuperseded: Bool

  public init(
    projectID: String,
    query: String,
    scopeLevels: [PraxisMemoryScopeLevel],
    limit: Int = 5,
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

public struct PraxisSemanticMemoryBundle: Sendable, Equatable, Codable {
  public let primaryMemoryIDs: [String]
  public let supportingMemoryIDs: [String]
  public let omittedSupersededMemoryIDs: [String]

  public init(
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String]
  ) {
    self.primaryMemoryIDs = primaryMemoryIDs
    self.supportingMemoryIDs = supportingMemoryIDs
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
  }
}
