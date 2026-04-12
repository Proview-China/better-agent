import PraxisCoreTypes
import PraxisMpMemory
import PraxisMpTypes

public enum PraxisMpRoleLiveLlmMode: String, Sendable, Equatable, Codable, CaseIterable {
  case rulesOnly = "rules_only"
  case llmAssisted = "llm_assisted"
  case llmRequired = "llm_required"
}

public struct PraxisMpRolePromptPack: Sendable, Equatable, Codable {
  public let role: PraxisMpFiveAgentRole
  public let promptPackID: String
  public let lane: String
  public let systemPrompt: String
  public let systemPurpose: String
  public let mission: String
  public let guardrails: [String]
  public let inputContract: [String]
  public let outputContract: [String]
  public let handoffContract: String

  public init(
    role: PraxisMpFiveAgentRole,
    promptPackID: String,
    lane: String,
    systemPrompt: String,
    systemPurpose: String,
    mission: String,
    guardrails: [String],
    inputContract: [String],
    outputContract: [String],
    handoffContract: String
  ) {
    self.role = role
    self.promptPackID = promptPackID
    self.lane = lane
    self.systemPrompt = systemPrompt
    self.systemPurpose = systemPurpose
    self.mission = mission
    self.guardrails = guardrails
    self.inputContract = inputContract
    self.outputContract = outputContract
    self.handoffContract = handoffContract
  }
}

public struct PraxisMpRoleProfile: Sendable, Equatable, Codable {
  public let role: PraxisMpFiveAgentRole
  public let profileID: String
  public let displayName: String
  public let missionLabel: String
  public let responsibilities: [String]
  public let hardBoundaries: [String]
  public let defaultStageOrder: [String]

  public init(
    role: PraxisMpFiveAgentRole,
    profileID: String,
    displayName: String,
    missionLabel: String,
    responsibilities: [String],
    hardBoundaries: [String],
    defaultStageOrder: [String]
  ) {
    self.role = role
    self.profileID = profileID
    self.displayName = displayName
    self.missionLabel = missionLabel
    self.responsibilities = responsibilities
    self.hardBoundaries = hardBoundaries
    self.defaultStageOrder = defaultStageOrder
  }
}

public struct PraxisMpRoleCapabilitySurface: Sendable, Equatable, Codable {
  public let access: String
  public let allowedOperations: [String]
  public let forbiddenOperations: [String]
  public let rationale: String

  public init(
    access: String,
    allowedOperations: [String],
    forbiddenOperations: [String],
    rationale: String
  ) {
    self.access = access
    self.allowedOperations = allowedOperations
    self.forbiddenOperations = forbiddenOperations
    self.rationale = rationale
  }
}

public struct PraxisMpRoleCapabilityContract: Sendable, Equatable, Codable {
  public let role: PraxisMpFiveAgentRole
  public let contractID: String
  public let memory: PraxisMpRoleCapabilitySurface
  public let retrieval: PraxisMpRoleCapabilitySurface
  public let alignment: PraxisMpRoleCapabilitySurface
  public let tapIntegrationMode: String

  public init(
    role: PraxisMpFiveAgentRole,
    contractID: String,
    memory: PraxisMpRoleCapabilitySurface,
    retrieval: PraxisMpRoleCapabilitySurface,
    alignment: PraxisMpRoleCapabilitySurface,
    tapIntegrationMode: String = "contract_ready"
  ) {
    self.role = role
    self.contractID = contractID
    self.memory = memory
    self.retrieval = retrieval
    self.alignment = alignment
    self.tapIntegrationMode = tapIntegrationMode
  }
}

public struct PraxisMpRoleConfiguration: Sendable, Equatable, Codable {
  public let role: PraxisMpFiveAgentRole
  public let promptPack: PraxisMpRolePromptPack
  public let profile: PraxisMpRoleProfile
  public let capabilityContract: PraxisMpRoleCapabilityContract

  public init(
    role: PraxisMpFiveAgentRole,
    promptPack: PraxisMpRolePromptPack,
    profile: PraxisMpRoleProfile,
    capabilityContract: PraxisMpRoleCapabilityContract
  ) {
    self.role = role
    self.promptPack = promptPack
    self.profile = profile
    self.capabilityContract = capabilityContract
  }
}

public struct PraxisMpFiveAgentConfiguration: Sendable, Equatable, Codable {
  public let version: String
  public let roles: [PraxisMpFiveAgentRole: PraxisMpRoleConfiguration]

  public init(
    version: String,
    roles: [PraxisMpFiveAgentRole: PraxisMpRoleConfiguration]
  ) {
    self.version = version
    self.roles = roles
  }
}

public struct PraxisMpFiveAgentRoleCatalogEntry: Sendable, Equatable, Codable {
  public let promptPackID: String
  public let profileID: String
  public let capabilityContractID: String

  public init(
    promptPackID: String,
    profileID: String,
    capabilityContractID: String
  ) {
    self.promptPackID = promptPackID
    self.profileID = profileID
    self.capabilityContractID = capabilityContractID
  }
}

public struct PraxisMpFiveAgentCapabilityMatrixSummary: Sendable, Equatable, Codable {
  public let ingressOwners: [PraxisMpFiveAgentRole]
  public let rewriteOwners: [PraxisMpFiveAgentRole]
  public let alignmentJudges: [PraxisMpFiveAgentRole]
  public let memoryWriters: [PraxisMpFiveAgentRole]
  public let retrievalOwners: [PraxisMpFiveAgentRole]

  public init(
    ingressOwners: [PraxisMpFiveAgentRole],
    rewriteOwners: [PraxisMpFiveAgentRole],
    alignmentJudges: [PraxisMpFiveAgentRole],
    memoryWriters: [PraxisMpFiveAgentRole],
    retrievalOwners: [PraxisMpFiveAgentRole]
  ) {
    self.ingressOwners = ingressOwners
    self.rewriteOwners = rewriteOwners
    self.alignmentJudges = alignmentJudges
    self.memoryWriters = memoryWriters
    self.retrievalOwners = retrievalOwners
  }
}

public struct PraxisMpFiveAgentFlowSummary: Sendable, Equatable, Codable {
  public let pendingAlignmentCount: Int
  public let pendingSupersedeCount: Int
  public let staleMemoryCandidateCount: Int
  public let passiveReturnCount: Int

  public init(
    pendingAlignmentCount: Int,
    pendingSupersedeCount: Int,
    staleMemoryCandidateCount: Int,
    passiveReturnCount: Int
  ) {
    self.pendingAlignmentCount = pendingAlignmentCount
    self.pendingSupersedeCount = pendingSupersedeCount
    self.staleMemoryCandidateCount = staleMemoryCandidateCount
    self.passiveReturnCount = passiveReturnCount
  }
}

public struct PraxisMpFiveAgentSummary: Sendable, Equatable, Codable {
  public let configurationVersion: String
  public let roleCounts: [PraxisMpFiveAgentRole: Int]
  public let latestStages: PraxisMpRoleStageMap
  public let latestRoleMetadata: [PraxisMpFiveAgentRole: [String: PraxisValue]]
  public let configuredRoles: [PraxisMpFiveAgentRole: PraxisMpFiveAgentRoleCatalogEntry]
  public let capabilityMatrix: PraxisMpFiveAgentCapabilityMatrixSummary
  public let flow: PraxisMpFiveAgentFlowSummary
  public let quality: PraxisMpMemoryQualitySummary

  public init(
    configurationVersion: String,
    roleCounts: [PraxisMpFiveAgentRole: Int],
    latestStages: PraxisMpRoleStageMap,
    latestRoleMetadata: [PraxisMpFiveAgentRole: [String: PraxisValue]],
    configuredRoles: [PraxisMpFiveAgentRole: PraxisMpFiveAgentRoleCatalogEntry],
    capabilityMatrix: PraxisMpFiveAgentCapabilityMatrixSummary,
    flow: PraxisMpFiveAgentFlowSummary,
    quality: PraxisMpMemoryQualitySummary
  ) {
    self.configurationVersion = configurationVersion
    self.roleCounts = roleCounts
    self.latestStages = latestStages
    self.latestRoleMetadata = latestRoleMetadata
    self.configuredRoles = configuredRoles
    self.capabilityMatrix = capabilityMatrix
    self.flow = flow
    self.quality = quality
  }
}

public struct PraxisMpFiveAgentRuntimeState: Sendable, Equatable, Codable {
  public let roleCounts: [PraxisMpFiveAgentRole: Int]
  public let latestStages: PraxisMpRoleStageMap
  public let latestRoleMetadata: [PraxisMpFiveAgentRole: [String: PraxisValue]]
  public let pendingAlignmentCount: Int
  public let pendingSupersedeCount: Int
  public let passiveReturnCount: Int
  public let records: [PraxisMpMemoryRecord]
  public let dedupeDecisionCount: Int
  public let ingestCount: Int
  public let rerankComposition: PraxisMpRerankComposition

  public init(
    roleCounts: [PraxisMpFiveAgentRole: Int],
    latestStages: PraxisMpRoleStageMap,
    latestRoleMetadata: [PraxisMpFiveAgentRole: [String: PraxisValue]],
    pendingAlignmentCount: Int,
    pendingSupersedeCount: Int,
    passiveReturnCount: Int,
    records: [PraxisMpMemoryRecord],
    dedupeDecisionCount: Int,
    ingestCount: Int,
    rerankComposition: PraxisMpRerankComposition
  ) {
    self.roleCounts = roleCounts
    self.latestStages = latestStages
    self.latestRoleMetadata = latestRoleMetadata
    self.pendingAlignmentCount = pendingAlignmentCount
    self.pendingSupersedeCount = pendingSupersedeCount
    self.passiveReturnCount = passiveReturnCount
    self.records = records
    self.dedupeDecisionCount = dedupeDecisionCount
    self.ingestCount = ingestCount
    self.rerankComposition = rerankComposition
  }
}

public struct PraxisMpFiveAgentLineageNode: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let depth: Int

  public init(projectID: String, agentID: String, depth: Int) {
    self.projectID = projectID
    self.agentID = agentID
    self.depth = depth
  }
}

public struct PraxisMpFiveAgentStoredArtifact: Sendable, Equatable, Codable {
  public let id: String
  public let projectID: String
  public let agentID: String
  public let storageRef: String
  public let persistedAt: String
  public let summary: String
  public let semanticGroupID: String?
  public let tags: [String]
  public let metadata: [String: PraxisValue]

  public init(
    id: String,
    projectID: String,
    agentID: String,
    storageRef: String,
    persistedAt: String,
    summary: String,
    semanticGroupID: String? = nil,
    tags: [String] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.projectID = projectID
    self.agentID = agentID
    self.storageRef = storageRef
    self.persistedAt = persistedAt
    self.summary = summary
    self.semanticGroupID = semanticGroupID
    self.tags = tags
    self.metadata = metadata
  }
}

public struct PraxisMpFiveAgentIngestInput: Sendable, Equatable, Codable {
  public let projectID: String
  public let artifact: PraxisMpFiveAgentStoredArtifact
  public let checkedSnapshotRef: String
  public let branchRef: String
  public let scope: PraxisMpScopeDescriptor
  public let memoryKind: PraxisMpMemoryKind
  public let observedAt: String?
  public let capturedAt: String?
  public let sourceRefs: [String]
  public let confidence: PraxisMpMemoryConfidenceLevel
  public let metadata: [String: PraxisValue]

  public init(
    projectID: String,
    artifact: PraxisMpFiveAgentStoredArtifact,
    checkedSnapshotRef: String,
    branchRef: String,
    scope: PraxisMpScopeDescriptor,
    memoryKind: PraxisMpMemoryKind = .semantic,
    observedAt: String? = nil,
    capturedAt: String? = nil,
    sourceRefs: [String] = [],
    confidence: PraxisMpMemoryConfidenceLevel = .medium,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.projectID = projectID
    self.artifact = artifact
    self.checkedSnapshotRef = checkedSnapshotRef
    self.branchRef = branchRef
    self.scope = scope
    self.memoryKind = memoryKind
    self.observedAt = observedAt
    self.capturedAt = capturedAt
    self.sourceRefs = sourceRefs
    self.confidence = confidence
    self.metadata = metadata
  }
}

public struct PraxisMpFiveAgentAlignInput: Sendable, Equatable, Codable {
  public let record: PraxisMpMemoryRecord
  public let alignedAt: String
  public let queryText: String?
  public let metadata: [String: PraxisValue]

  public init(
    record: PraxisMpMemoryRecord,
    alignedAt: String,
    queryText: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.record = record
    self.alignedAt = alignedAt
    self.queryText = queryText
    self.metadata = metadata
  }
}

public struct PraxisMpFiveAgentResolveInput: Sendable, Equatable, Codable {
  public let projectID: String
  public let queryText: String
  public let requesterLineage: PraxisMpFiveAgentLineageNode
  public let requesterSessionID: String?
  public let sourceLineages: [String: PraxisMpFiveAgentLineageNode]
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let metadata: [String: PraxisValue]

  public init(
    projectID: String,
    queryText: String,
    requesterLineage: PraxisMpFiveAgentLineageNode,
    requesterSessionID: String? = nil,
    sourceLineages: [String: PraxisMpFiveAgentLineageNode],
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.projectID = projectID
    self.queryText = queryText
    self.requesterLineage = requesterLineage
    self.requesterSessionID = requesterSessionID
    self.sourceLineages = sourceLineages
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.metadata = metadata
  }
}

public typealias PraxisMpFiveAgentHistoryInput = PraxisMpFiveAgentResolveInput

public struct PraxisMpFiveAgentIngestResult: Sendable, Equatable, Codable {
  public let records: [PraxisMpMemoryRecord]
  public let alignment: PraxisMpAlignmentResult

  public init(records: [PraxisMpMemoryRecord], alignment: PraxisMpAlignmentResult) {
    self.records = records
    self.alignment = alignment
  }
}

public struct PraxisMpFiveAgentResolveResult: Sendable, Equatable, Codable {
  public let bundle: PraxisMpWorkflowBundle

  public init(bundle: PraxisMpWorkflowBundle) {
    self.bundle = bundle
  }
}

public struct PraxisMpFiveAgentHistoryResult: Sendable, Equatable, Codable {
  public let bundle: PraxisMpWorkflowBundle

  public init(bundle: PraxisMpWorkflowBundle) {
    self.bundle = bundle
  }
}

public protocol PraxisMpFiveAgentRuntimeProtocol: Sendable {
  func ingest(_ input: PraxisMpFiveAgentIngestInput) async -> PraxisMpFiveAgentIngestResult
  func align(_ input: PraxisMpFiveAgentAlignInput) async -> PraxisMpAlignmentResult
  func resolve(_ input: PraxisMpFiveAgentResolveInput) async -> PraxisMpFiveAgentResolveResult
  func requestHistory(_ input: PraxisMpFiveAgentHistoryInput) async -> PraxisMpFiveAgentHistoryResult
  func summary() async -> PraxisMpFiveAgentSummary
  func state() async -> PraxisMpFiveAgentRuntimeState
}
