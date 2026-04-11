import PraxisCoreTypes

public enum PraxisMpMemoryKind: String, Sendable, Equatable, Codable, CaseIterable {
  case episodic
  case semantic
  case summary
  case directive
  case statusSnapshot = "status_snapshot"
}

public enum PraxisMpMemoryConfidenceLevel: String, Sendable, Equatable, Codable, CaseIterable {
  case low
  case medium
  case high
}

public enum PraxisMpMemoryFreshnessStatus: String, Sendable, Equatable, Codable, CaseIterable {
  case fresh
  case aging
  case stale
  case superseded
}

public enum PraxisMpMemoryAlignmentStatus: String, Sendable, Equatable, Codable, CaseIterable {
  case unreviewed
  case aligned
  case drifted
}

public struct PraxisMpMemoryFreshness: Sendable, Equatable, Codable {
  public let status: PraxisMpMemoryFreshnessStatus
  public let reason: String?

  public init(status: PraxisMpMemoryFreshnessStatus = .fresh, reason: String? = nil) {
    self.status = status
    self.reason = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

public struct PraxisMpMemoryAlignment: Sendable, Equatable, Codable {
  public let status: PraxisMpMemoryAlignmentStatus
  public let lastAlignedAt: String?
  public let reason: String?

  public init(
    status: PraxisMpMemoryAlignmentStatus = .unreviewed,
    lastAlignedAt: String? = nil,
    reason: String? = nil
  ) {
    self.status = status
    self.lastAlignedAt = lastAlignedAt?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.reason = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

public struct PraxisMpEmbeddingPayload: Sendable, Equatable, Codable {
  public let provider: String?
  public let model: String?
  public let dimensions: Int?
  public let vectorRef: String?
  public let metadata: [String: PraxisValue]

  public init(
    provider: String? = nil,
    model: String? = nil,
    dimensions: Int? = nil,
    vectorRef: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.provider = provider?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.model = model?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.dimensions = dimensions
    self.vectorRef = vectorRef?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.metadata = metadata
  }
}

public struct PraxisMpChunkAncestry: Sendable, Equatable, Codable {
  public let parentMemoryID: String?
  public let derivedFromIDs: [String]
  public let splitFromIDs: [String]
  public let mergedFromIDs: [String]

  public init(
    parentMemoryID: String? = nil,
    derivedFromIDs: [String] = [],
    splitFromIDs: [String] = [],
    mergedFromIDs: [String] = []
  ) {
    self.parentMemoryID = parentMemoryID?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.derivedFromIDs = Self.normalize(derivedFromIDs)
    self.splitFromIDs = Self.normalize(splitFromIDs)
    self.mergedFromIDs = Self.normalize(mergedFromIDs)
  }

  private static func normalize(_ values: [String]) -> [String] {
    Array(
      Set(values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
    ).sorted()
  }
}

public struct PraxisMpMemoryRecord: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let scope: PraxisMpScopeDescriptor
  public let summary: String
  public let storageKey: String
  public let memoryKind: PraxisMpMemoryKind
  public let freshness: PraxisMpMemoryFreshness
  public let confidence: PraxisMpMemoryConfidenceLevel
  public let alignment: PraxisMpMemoryAlignment
  public let sourceRefs: [String]
  public let tags: [String]
  public let semanticGroupID: String?
  public let embedding: PraxisMpEmbeddingPayload?
  public let ancestry: PraxisMpChunkAncestry?
  public let createdAt: String?
  public let updatedAt: String?
  public let metadata: [String: PraxisValue]

  public init(
    id: String,
    scope: PraxisMpScopeDescriptor,
    summary: String,
    storageKey: String,
    memoryKind: PraxisMpMemoryKind = .episodic,
    freshness: PraxisMpMemoryFreshness = .init(),
    confidence: PraxisMpMemoryConfidenceLevel = .medium,
    alignment: PraxisMpMemoryAlignment = .init(),
    sourceRefs: [String] = [],
    tags: [String] = [],
    semanticGroupID: String? = nil,
    embedding: PraxisMpEmbeddingPayload? = nil,
    ancestry: PraxisMpChunkAncestry? = nil,
    createdAt: String? = nil,
    updatedAt: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id.trimmingCharacters(in: .whitespacesAndNewlines)
    self.scope = scope
    self.summary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
    self.storageKey = storageKey.trimmingCharacters(in: .whitespacesAndNewlines)
    self.memoryKind = memoryKind
    self.freshness = freshness
    self.confidence = confidence
    self.alignment = alignment
    self.sourceRefs = Self.normalize(sourceRefs)
    self.tags = Self.normalize(tags)
    self.semanticGroupID = semanticGroupID?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.embedding = embedding
    self.ancestry = ancestry
    self.createdAt = createdAt?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.updatedAt = updatedAt?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.metadata = metadata
  }

  private static func normalize(_ values: [String]) -> [String] {
    Array(
      Set(values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
    ).sorted()
  }
}
