import PraxisCoreTypes
import PraxisMpTypes

public struct PraxisMpSemanticBundle: Sendable, Equatable, Codable {
  public let bundleID: String
  public let projectID: String
  public let agentID: String
  public let scope: PraxisMpScopeDescriptor
  public let memberMemoryIDs: [String]
  public let semanticGroupID: String
  public let createdAt: String
  public let updatedAt: String
  public let metadata: [String: PraxisValue]

  public init(
    bundleID: String,
    projectID: String,
    agentID: String,
    scope: PraxisMpScopeDescriptor,
    memberMemoryIDs: [String],
    semanticGroupID: String,
    createdAt: String,
    updatedAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.bundleID = bundleID
    self.projectID = projectID
    self.agentID = agentID
    self.scope = scope
    self.memberMemoryIDs = memberMemoryIDs
    self.semanticGroupID = semanticGroupID
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.metadata = metadata
  }
}

public struct PraxisMpRerankComposition: Sendable, Equatable, Codable {
  public let fresh: Int
  public let aging: Int
  public let stale: Int
  public let superseded: Int
  public let aligned: Int
  public let unreviewed: Int
  public let drifted: Int

  public init(
    fresh: Int = 0,
    aging: Int = 0,
    stale: Int = 0,
    superseded: Int = 0,
    aligned: Int = 0,
    unreviewed: Int = 0,
    drifted: Int = 0
  ) {
    self.fresh = fresh
    self.aging = aging
    self.stale = stale
    self.superseded = superseded
    self.aligned = aligned
    self.unreviewed = unreviewed
    self.drifted = drifted
  }
}

public struct PraxisMpWorkflowBundleDiagnostics: Sendable, Equatable, Codable {
  public let omittedSupersededMemoryIDs: [String]
  public let rerankComposition: PraxisMpRerankComposition

  public init(
    omittedSupersededMemoryIDs: [String],
    rerankComposition: PraxisMpRerankComposition
  ) {
    self.omittedSupersededMemoryIDs = omittedSupersededMemoryIDs
    self.rerankComposition = rerankComposition
  }
}

public struct PraxisMpWorkflowBundle: Sendable, Equatable, Codable {
  public let scope: PraxisMpScopeDescriptor
  public let primary: [PraxisMpMemoryRecord]
  public let supporting: [PraxisMpMemoryRecord]
  public let diagnostics: PraxisMpWorkflowBundleDiagnostics

  public init(
    scope: PraxisMpScopeDescriptor,
    primary: [PraxisMpMemoryRecord],
    supporting: [PraxisMpMemoryRecord],
    diagnostics: PraxisMpWorkflowBundleDiagnostics
  ) {
    self.scope = scope
    self.primary = primary
    self.supporting = supporting
    self.diagnostics = diagnostics
  }
}

public enum PraxisMpAlignmentDecision: String, Sendable, Equatable, Codable, CaseIterable {
  case keep
  case supersedeExisting = "supersede_existing"
  case staleCandidate = "stale_candidate"
  case mergeRequired = "merge_required"
}

public struct PraxisMpAlignmentDecisionOutput: Sendable, Equatable, Codable {
  public let decision: PraxisMpAlignmentDecision
  public let confidence: PraxisMpMemoryConfidenceLevel
  public let freshnessStatus: PraxisMpMemoryFreshnessStatus
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let reason: String

  public init(
    decision: PraxisMpAlignmentDecision,
    confidence: PraxisMpMemoryConfidenceLevel,
    freshnessStatus: PraxisMpMemoryFreshnessStatus,
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    reason: String
  ) {
    self.decision = decision
    self.confidence = confidence
    self.freshnessStatus = freshnessStatus
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.reason = reason
  }
}

public struct PraxisMpAlignmentResult: Sendable, Equatable, Codable {
  public let primary: PraxisMpMemoryRecord
  public let updatedRecords: [PraxisMpMemoryRecord]
  public let supersededMemoryIDs: [String]
  public let staleMemoryIDs: [String]
  public let decisionOutput: PraxisMpAlignmentDecisionOutput

  public init(
    primary: PraxisMpMemoryRecord,
    updatedRecords: [PraxisMpMemoryRecord],
    supersededMemoryIDs: [String],
    staleMemoryIDs: [String],
    decisionOutput: PraxisMpAlignmentDecisionOutput
  ) {
    self.primary = primary
    self.updatedRecords = updatedRecords
    self.supersededMemoryIDs = supersededMemoryIDs
    self.staleMemoryIDs = staleMemoryIDs
    self.decisionOutput = decisionOutput
  }
}

public struct PraxisMpMemoryQualitySummary: Sendable, Equatable, Codable {
  public let dedupeRate: Double
  public let staleMemoryCount: Int
  public let supersededMemoryCount: Int
  public let rerankComposition: PraxisMpRerankComposition

  public init(
    dedupeRate: Double,
    staleMemoryCount: Int,
    supersededMemoryCount: Int,
    rerankComposition: PraxisMpRerankComposition
  ) {
    self.dedupeRate = dedupeRate
    self.staleMemoryCount = staleMemoryCount
    self.supersededMemoryCount = supersededMemoryCount
    self.rerankComposition = rerankComposition
  }
}

public struct PraxisMpReadbackProjection: Sendable, Equatable, Codable {
  public let summary: String
  public let totalMemoryCount: Int
  public let primaryCount: Int
  public let supportingCount: Int
  public let omittedSupersededCount: Int
  public let freshnessBreakdown: [String: Int]
  public let alignmentBreakdown: [String: Int]
  public let scopeBreakdown: [String: Int]

  public init(
    summary: String,
    totalMemoryCount: Int,
    primaryCount: Int,
    supportingCount: Int,
    omittedSupersededCount: Int,
    freshnessBreakdown: [String: Int],
    alignmentBreakdown: [String: Int],
    scopeBreakdown: [String: Int]
  ) {
    self.summary = summary
    self.totalMemoryCount = totalMemoryCount
    self.primaryCount = primaryCount
    self.supportingCount = supportingCount
    self.omittedSupersededCount = omittedSupersededCount
    self.freshnessBreakdown = freshnessBreakdown
    self.alignmentBreakdown = alignmentBreakdown
    self.scopeBreakdown = scopeBreakdown
  }
}

public struct PraxisMpSplitMemoryInput: Sendable, Equatable, Codable {
  public let sourceMemoryID: String
  public let sourceAgentID: String
  public let targetChunkCount: Int
  public let splitReason: String
  public let createdAt: String
  public let metadata: [String: PraxisValue]

  public init(
    sourceMemoryID: String,
    sourceAgentID: String,
    targetChunkCount: Int,
    splitReason: String,
    createdAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.sourceMemoryID = sourceMemoryID
    self.sourceAgentID = sourceAgentID
    self.targetChunkCount = targetChunkCount
    self.splitReason = splitReason
    self.createdAt = createdAt
    self.metadata = metadata
  }
}

public struct PraxisMpSplitMemoryResult: Sendable, Equatable, Codable {
  public let sourceMemoryID: String
  public let derivedMemoryIDs: [String]
  public let createdAt: String
  public let metadata: [String: PraxisValue]

  public init(
    sourceMemoryID: String,
    derivedMemoryIDs: [String],
    createdAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.sourceMemoryID = sourceMemoryID
    self.derivedMemoryIDs = derivedMemoryIDs
    self.createdAt = createdAt
    self.metadata = metadata
  }
}

public struct PraxisMpMergeMemoriesInput: Sendable, Equatable, Codable {
  public let sourceMemoryIDs: [String]
  public let mergedMemoryID: String
  public let targetAgentID: String
  public let mergeReason: String
  public let createdAt: String
  public let metadata: [String: PraxisValue]

  public init(
    sourceMemoryIDs: [String],
    mergedMemoryID: String,
    targetAgentID: String,
    mergeReason: String,
    createdAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.sourceMemoryIDs = sourceMemoryIDs
    self.mergedMemoryID = mergedMemoryID
    self.targetAgentID = targetAgentID
    self.mergeReason = mergeReason
    self.createdAt = createdAt
    self.metadata = metadata
  }
}

public struct PraxisMpMergeMemoriesResult: Sendable, Equatable, Codable {
  public let mergedMemoryID: String
  public let sourceMemoryIDs: [String]
  public let createdAt: String
  public let metadata: [String: PraxisValue]

  public init(
    mergedMemoryID: String,
    sourceMemoryIDs: [String],
    createdAt: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.mergedMemoryID = mergedMemoryID
    self.sourceMemoryIDs = sourceMemoryIDs
    self.createdAt = createdAt
    self.metadata = metadata
  }
}
