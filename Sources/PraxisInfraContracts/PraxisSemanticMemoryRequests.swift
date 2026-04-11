import Foundation
import PraxisCoreTypes
import PraxisMpTypes

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
  public let sessionID: String?
  public let scopeLevel: PraxisMemoryScopeLevel
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let memoryKind: PraxisMemoryKind
  public let summary: String
  public let storageKey: String
  public let freshnessStatus: PraxisMemoryFreshnessStatus
  public let alignmentStatus: PraxisMemoryAlignmentStatus
  public let sourceRefs: [String]
  public let tags: [String]
  public let semanticGroupID: String?
  public let confidence: PraxisMpMemoryConfidenceLevel
  public let lineagePath: [String]
  public let createdAt: String?
  public let updatedAt: String?
  public let metadata: [String: PraxisValue]
  public let embeddingStorageKey: String?

  public init(
    id: String,
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    scopeLevel: PraxisMemoryScopeLevel,
    sessionMode: PraxisMpSessionMode? = nil,
    visibilityState: PraxisMpVisibilityState? = nil,
    promotionState: PraxisMpPromotionState? = nil,
    memoryKind: PraxisMemoryKind,
    summary: String,
    storageKey: String,
    freshnessStatus: PraxisMemoryFreshnessStatus,
    alignmentStatus: PraxisMemoryAlignmentStatus,
    sourceRefs: [String] = [],
    tags: [String] = [],
    semanticGroupID: String? = nil,
    confidence: PraxisMpMemoryConfidenceLevel = .medium,
    lineagePath: [String] = [],
    createdAt: String? = nil,
    updatedAt: String? = nil,
    metadata: [String: PraxisValue] = [:],
    embeddingStorageKey: String? = nil
  ) {
    self.id = id
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    self.scopeLevel = scopeLevel
    self.sessionMode = sessionMode ?? Self.defaultSessionMode(for: scopeLevel, sessionID: sessionID)
    self.visibilityState = visibilityState ?? Self.defaultVisibilityState(
      scopeLevel: scopeLevel,
      sessionMode: self.sessionMode
    )
    self.promotionState = promotionState ?? Self.defaultPromotionState(for: self.visibilityState)
    self.memoryKind = memoryKind
    self.summary = summary
    self.storageKey = storageKey
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.sourceRefs = Self.normalizeIdentifiers(sourceRefs)
    self.tags = Self.normalizeIdentifiers(tags)
    self.semanticGroupID = semanticGroupID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    self.confidence = confidence
    self.lineagePath = Self.normalizeIdentifiers(lineagePath)
    self.createdAt = createdAt?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    self.updatedAt = updatedAt?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    self.metadata = metadata
    self.embeddingStorageKey = embeddingStorageKey
  }

  private enum CodingKeys: String, CodingKey {
    case id
    case projectID
    case agentID
    case sessionID
    case scopeLevel
    case sessionMode
    case visibilityState
    case promotionState
    case memoryKind
    case summary
    case storageKey
    case freshnessStatus
    case alignmentStatus
    case sourceRefs
    case tags
    case semanticGroupID
    case confidence
    case lineagePath
    case createdAt
    case updatedAt
    case metadata
    case embeddingStorageKey
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let id = try container.decode(String.self, forKey: .id)
    let projectID = try container.decode(String.self, forKey: .projectID)
    let agentID = try container.decode(String.self, forKey: .agentID)
    let sessionID = try container.decodeIfPresent(String.self, forKey: .sessionID)
    let scopeLevel = try container.decode(PraxisMemoryScopeLevel.self, forKey: .scopeLevel)
    let memoryKind = try container.decode(PraxisMemoryKind.self, forKey: .memoryKind)
    let summary = try container.decode(String.self, forKey: .summary)
    let storageKey = try container.decode(String.self, forKey: .storageKey)
    let freshnessStatus = try container.decode(PraxisMemoryFreshnessStatus.self, forKey: .freshnessStatus)
    let alignmentStatus = try container.decode(PraxisMemoryAlignmentStatus.self, forKey: .alignmentStatus)
    self.init(
      id: id,
      projectID: projectID,
      agentID: agentID,
      sessionID: sessionID,
      scopeLevel: scopeLevel,
      sessionMode: try container.decodeIfPresent(PraxisMpSessionMode.self, forKey: .sessionMode),
      visibilityState: try container.decodeIfPresent(PraxisMpVisibilityState.self, forKey: .visibilityState),
      promotionState: try container.decodeIfPresent(PraxisMpPromotionState.self, forKey: .promotionState),
      memoryKind: memoryKind,
      summary: summary,
      storageKey: storageKey,
      freshnessStatus: freshnessStatus,
      alignmentStatus: alignmentStatus,
      sourceRefs: try container.decodeIfPresent([String].self, forKey: .sourceRefs) ?? [],
      tags: try container.decodeIfPresent([String].self, forKey: .tags) ?? [],
      semanticGroupID: try container.decodeIfPresent(String.self, forKey: .semanticGroupID),
      confidence: try container.decodeIfPresent(PraxisMpMemoryConfidenceLevel.self, forKey: .confidence) ?? .medium,
      lineagePath: try container.decodeIfPresent([String].self, forKey: .lineagePath) ?? [],
      createdAt: try container.decodeIfPresent(String.self, forKey: .createdAt),
      updatedAt: try container.decodeIfPresent(String.self, forKey: .updatedAt),
      metadata: try container.decodeIfPresent([String: PraxisValue].self, forKey: .metadata) ?? [:],
      embeddingStorageKey: try container.decodeIfPresent(String.self, forKey: .embeddingStorageKey)
    )
  }

  private static func normalizeIdentifiers(_ values: [String]) -> [String] {
    Array(
      Set(values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
    ).sorted()
  }

  private static func defaultSessionMode(
    for scopeLevel: PraxisMemoryScopeLevel,
    sessionID: String?
  ) -> PraxisMpSessionMode {
    switch scopeLevel {
    case .global, .project:
      return .shared
    case .agent:
      return .isolated
    case .session:
      return sessionID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty == nil ? .isolated : .bridged
    }
  }

  private static func defaultVisibilityState(
    scopeLevel: PraxisMemoryScopeLevel,
    sessionMode: PraxisMpSessionMode
  ) -> PraxisMpVisibilityState {
    switch scopeLevel {
    case .global:
      return .globalShared
    case .project:
      return .projectShared
    case .agent:
      return .localOnly
    case .session:
      return sessionMode == .bridged ? .sessionBridged : .localOnly
    }
  }

  private static func defaultPromotionState(for visibilityState: PraxisMpVisibilityState) -> PraxisMpPromotionState {
    switch visibilityState {
    case .localOnly:
      return .localOnly
    case .sessionBridged:
      return .submittedToParent
    case .projectShared:
      return .promotedToProject
    case .globalShared:
      return .promotedToGlobal
    case .archived:
      return .archived
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
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
