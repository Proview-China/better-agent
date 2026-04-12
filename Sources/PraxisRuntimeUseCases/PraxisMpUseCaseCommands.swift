import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpTypes

public struct PraxisSearchMpCommand: Sendable, Equatable, Codable {
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
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
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

public struct PraxisMpSearchHitRecord: Sendable, Equatable, Codable, Identifiable {
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

public struct PraxisMpSearchResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let summary: String
  public let hits: [PraxisMpSearchHitRecord]
  public let issues: [String]

  public init(
    projectID: String,
    query: String,
    summary: String,
    hits: [PraxisMpSearchHitRecord],
    issues: [String]
  ) {
    self.projectID = projectID
    self.query = query
    self.summary = summary
    self.hits = hits
    self.issues = issues
  }
}

public struct PraxisReadbackMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: String?
  public let sessionID: String?
  public let includeSuperseded: Bool

  public init(
    projectID: String,
    query: String = "",
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 10,
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

public struct PraxisMpReadback: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let totalMemoryCount: Int
  public let primaryCount: Int
  public let supportingCount: Int
  public let omittedSupersededCount: Int
  public let freshnessBreakdown: [String: Int]
  public let alignmentBreakdown: [String: Int]
  public let scopeBreakdown: [String: Int]
  public let issues: [String]

  public init(
    projectID: String,
    summary: String,
    totalMemoryCount: Int,
    primaryCount: Int,
    supportingCount: Int,
    omittedSupersededCount: Int,
    freshnessBreakdown: [String: Int],
    alignmentBreakdown: [String: Int],
    scopeBreakdown: [String: Int],
    issues: [String]
  ) {
    self.projectID = projectID
    self.summary = summary
    self.totalMemoryCount = totalMemoryCount
    self.primaryCount = primaryCount
    self.supportingCount = supportingCount
    self.omittedSupersededCount = omittedSupersededCount
    self.freshnessBreakdown = freshnessBreakdown
    self.alignmentBreakdown = alignmentBreakdown
    self.scopeBreakdown = scopeBreakdown
    self.issues = issues
  }
}

public struct PraxisSmokeMpCommand: Sendable, Equatable, Codable {
  public let projectID: String

  public init(projectID: String) {
    self.projectID = projectID
  }
}

public struct PraxisMpSmoke: Sendable, Equatable, Codable {
  public let projectID: String
  public let summary: String
  public let checks: [PraxisRuntimeSmokeCheckRecord]

  public init(projectID: String, summary: String, checks: [PraxisRuntimeSmokeCheckRecord]) {
    self.projectID = projectID
    self.summary = summary
    self.checks = checks
  }
}

public struct PraxisIngestMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String?
  public let scopeLevel: PraxisMpScopeLevel
  public let summary: String
  public let checkedSnapshotRef: String
  public let branchRef: String
  public let storageKey: String?
  public let memoryKind: PraxisMpMemoryKind
  public let observedAt: String?
  public let capturedAt: String?
  public let semanticGroupID: String?
  public let tags: [String]
  public let sourceRefs: [String]
  public let confidence: PraxisMpMemoryConfidenceLevel

  public init(
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    scopeLevel: PraxisMpScopeLevel = .agentIsolated,
    summary: String,
    checkedSnapshotRef: String,
    branchRef: String,
    storageKey: String? = nil,
    memoryKind: PraxisMpMemoryKind = .semantic,
    observedAt: String? = nil,
    capturedAt: String? = nil,
    semanticGroupID: String? = nil,
    tags: [String] = [],
    sourceRefs: [String] = [],
    confidence: PraxisMpMemoryConfidenceLevel = .medium
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.scopeLevel = scopeLevel
    self.summary = summary
    self.checkedSnapshotRef = checkedSnapshotRef
    self.branchRef = branchRef
    self.storageKey = storageKey
    self.memoryKind = memoryKind
    self.observedAt = observedAt
    self.capturedAt = capturedAt
    self.semanticGroupID = semanticGroupID
    self.tags = tags
    self.sourceRefs = sourceRefs
    self.confidence = confidence
  }
}

public struct PraxisMpIngestResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String?
  public let summary: String
  public let primaryMemoryID: String
  public let storageKey: String
  public let updatedMemoryIDs: [String]
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let decision: PraxisMpAlignmentDecision
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
  public let issues: [String]

  public init(
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    summary: String,
    primaryMemoryID: String,
    storageKey: String,
    updatedMemoryIDs: [String],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decision: PraxisMpAlignmentDecision,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
    issues: [String]
  ) {
    self.projectID = projectID
    self.agentID = agentID
    self.sessionID = sessionID
    self.summary = summary
    self.primaryMemoryID = primaryMemoryID
    self.storageKey = storageKey
    self.updatedMemoryIDs = updatedMemoryIDs
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.decision = decision
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.issues = issues
  }
}

public struct PraxisAlignMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let alignedAt: String?
  public let queryText: String?

  public init(
    projectID: String,
    memoryID: String,
    alignedAt: String? = nil,
    queryText: String? = nil
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.alignedAt = alignedAt
    self.queryText = queryText
  }
}

public struct PraxisMpAlignResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let primaryMemoryID: String
  public let updatedMemoryIDs: [String]
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let decision: PraxisMpAlignmentDecision
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let alignmentStatus: PraxisMpMemoryAlignmentStatus
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    primaryMemoryID: String,
    updatedMemoryIDs: [String],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decision: PraxisMpAlignmentDecision,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    alignmentStatus: PraxisMpMemoryAlignmentStatus,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.primaryMemoryID = primaryMemoryID
    self.updatedMemoryIDs = updatedMemoryIDs
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.decision = decision
    self.freshnessStatus = freshnessStatus
    self.alignmentStatus = alignmentStatus
    self.issues = issues
  }
}

public struct PraxisPromoteMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let targetPromotionState: PraxisMpPromotionState
  public let targetSessionID: String?
  public let promotedAt: String?
  public let reason: String?

  public init(
    projectID: String,
    memoryID: String,
    targetPromotionState: PraxisMpPromotionState,
    targetSessionID: String? = nil,
    promotedAt: String? = nil,
    reason: String? = nil
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.targetPromotionState = targetPromotionState
    self.targetSessionID = targetSessionID
    self.promotedAt = promotedAt
    self.reason = reason
  }
}

public struct PraxisMpPromoteResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let scopeLevel: PraxisMpScopeLevel
  public let sessionID: String?
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: PraxisMpScopeLevel,
    sessionID: String? = nil,
    sessionMode: PraxisMpSessionMode,
    visibilityState: PraxisMpVisibilityState,
    promotionState: PraxisMpPromotionState,
    updatedAt: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.scopeLevel = scopeLevel
    self.sessionID = sessionID
    self.sessionMode = sessionMode
    self.visibilityState = visibilityState
    self.promotionState = promotionState
    self.updatedAt = updatedAt
    self.issues = issues
  }
}

public struct PraxisArchiveMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let archivedAt: String?
  public let reason: String?

  public init(
    projectID: String,
    memoryID: String,
    archivedAt: String? = nil,
    reason: String? = nil
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.archivedAt = archivedAt
    self.reason = reason
  }
}

public struct PraxisMpArchiveResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let memoryID: String
  public let summary: String
  public let scopeLevel: PraxisMpScopeLevel
  public let sessionID: String?
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let updatedAt: String?
  public let issues: [String]

  public init(
    projectID: String,
    memoryID: String,
    summary: String,
    scopeLevel: PraxisMpScopeLevel,
    sessionID: String? = nil,
    sessionMode: PraxisMpSessionMode,
    visibilityState: PraxisMpVisibilityState,
    promotionState: PraxisMpPromotionState,
    updatedAt: String? = nil,
    issues: [String]
  ) {
    self.projectID = projectID
    self.memoryID = memoryID
    self.summary = summary
    self.scopeLevel = scopeLevel
    self.sessionID = sessionID
    self.sessionMode = sessionMode
    self.visibilityState = visibilityState
    self.promotionState = promotionState
    self.updatedAt = updatedAt
    self.issues = issues
  }
}

public struct PraxisResolveMpCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let requesterAgentID: String
  public let requesterSessionID: String?
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    projectID: String,
    query: String,
    requesterAgentID: String,
    requesterSessionID: String? = nil,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.projectID = projectID
    self.query = query
    self.requesterAgentID = requesterAgentID
    self.requesterSessionID = requesterSessionID
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

public struct PraxisMpResolveResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let query: String
  public let summary: String
  public let primaryMemoryIDs: [String]
  public let supportingMemoryIDs: [String]
  public let omittedSupersededMemoryIDs: [String]
  public let rerankComposition: PraxisMpRerankComposition
  public let roleCounts: PraxisMpRoleCountMap
  public let roleStages: PraxisMpRoleStageMap
  public let issues: [String]

  public init(
    projectID: String,
    query: String,
    summary: String,
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankComposition,
    roleCounts: PraxisMpRoleCountMap,
    roleStages: PraxisMpRoleStageMap,
    issues: [String]
  ) {
    self.projectID = projectID
    self.query = query
    self.summary = summary
    self.primaryMemoryIDs = primaryMemoryIDs
    self.supportingMemoryIDs = supportingMemoryIDs
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
    self.rerankComposition = rerankComposition
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.issues = issues
  }
}

public struct PraxisRequestMpHistoryCommand: Sendable, Equatable, Codable {
  public let projectID: String
  public let requesterAgentID: String
  public let requesterSessionID: String?
  public let reason: String
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    projectID: String,
    requesterAgentID: String,
    requesterSessionID: String? = nil,
    reason: String,
    query: String,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.requesterSessionID = requesterSessionID
    self.reason = reason
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

public struct PraxisMpHistoryResult: Sendable, Equatable, Codable {
  public let projectID: String
  public let requesterAgentID: String
  public let query: String
  public let reason: String
  public let summary: String
  public let primaryMemoryIDs: [String]
  public let supportingMemoryIDs: [String]
  public let omittedSupersededMemoryIDs: [String]
  public let rerankComposition: PraxisMpRerankComposition
  public let roleCounts: PraxisMpRoleCountMap
  public let roleStages: PraxisMpRoleStageMap
  public let issues: [String]

  public init(
    projectID: String,
    requesterAgentID: String,
    query: String,
    reason: String,
    summary: String,
    primaryMemoryIDs: [String],
    supportingMemoryIDs: [String],
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankComposition,
    roleCounts: PraxisMpRoleCountMap,
    roleStages: PraxisMpRoleStageMap,
    issues: [String]
  ) {
    self.projectID = projectID
    self.requesterAgentID = requesterAgentID
    self.query = query
    self.reason = reason
    self.summary = summary
    self.primaryMemoryIDs = primaryMemoryIDs
    self.supportingMemoryIDs = supportingMemoryIDs
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
    self.rerankComposition = rerankComposition
    self.roleCounts = roleCounts
    self.roleStages = roleStages
    self.issues = issues
  }
}
