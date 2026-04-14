import PraxisCmpTypes
import PraxisMpTypes
import PraxisTapTypes

/// Caller-friendly execution request for one runtime goal.
public struct PraxisRuntimeRunRequest: Sendable, Equatable {
  public let task: String
  public let sessionID: PraxisRuntimeSessionRef?

  public init(task: String, sessionID: PraxisRuntimeSessionRef? = nil) {
    self.task = task
    self.sessionID = sessionID
  }
}

/// Options for one scoped TAP overview query.
public struct PraxisRuntimeTapOverviewOptions: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef?
  public let limit: Int

  public init(agentID: PraxisRuntimeAgentRef? = nil, limit: Int = 10) {
    self.agentID = agentID
    self.limit = limit
  }
}

/// Options for one scoped CMP bootstrap call.
public struct PraxisRuntimeCmpBootstrapOptions: Sendable, Equatable {
  public let agentIDs: [PraxisRuntimeAgentRef]
  public let defaultAgentID: PraxisRuntimeAgentRef?
  public let repoName: String?
  public let repoRootPath: String?
  public let defaultBranchName: String?
  public let databaseName: String?
  public let namespaceRoot: String?

  public init(
    agentIDs: [PraxisRuntimeAgentRef] = [],
    defaultAgentID: PraxisRuntimeAgentRef? = nil,
    repoName: String? = nil,
    repoRootPath: String? = nil,
    defaultBranchName: String? = nil,
    databaseName: String? = nil,
    namespaceRoot: String? = nil
  ) {
    self.agentIDs = agentIDs
    self.defaultAgentID = defaultAgentID
    self.repoName = repoName
    self.repoRootPath = repoRootPath
    self.defaultBranchName = defaultBranchName
    self.databaseName = databaseName
    self.namespaceRoot = namespaceRoot
  }
}

/// Options for one scoped CMP overview query.
public struct PraxisRuntimeCmpOverviewOptions: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef?

  public init(agentID: PraxisRuntimeAgentRef? = nil) {
    self.agentID = agentID
  }
}

/// Approval request payload for one scoped CMP approval workflow.
public struct PraxisRuntimeCmpApprovalRequest: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef
  public let targetAgentID: PraxisRuntimeAgentRef
  public let capabilityID: PraxisRuntimeCapabilityRef
  public let requestedTier: PraxisTapCapabilityTier
  public let summary: String

  public init(
    agentID: PraxisRuntimeAgentRef,
    targetAgentID: PraxisRuntimeAgentRef,
    capabilityID: PraxisRuntimeCapabilityRef,
    requestedTier: PraxisTapCapabilityTier,
    summary: String
  ) {
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityID = capabilityID
    self.requestedTier = requestedTier
    self.summary = summary
  }
}

/// Approval decision payload for one scoped CMP approval workflow.
public struct PraxisRuntimeCmpApprovalDecisionInput: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef
  public let targetAgentID: PraxisRuntimeAgentRef
  public let capabilityID: PraxisRuntimeCapabilityRef
  public let decision: PraxisCmpPeerApprovalDecision
  public let reviewerAgentID: PraxisRuntimeAgentRef?
  public let decisionSummary: String

  public init(
    agentID: PraxisRuntimeAgentRef,
    targetAgentID: PraxisRuntimeAgentRef,
    capabilityID: PraxisRuntimeCapabilityRef,
    decision: PraxisCmpPeerApprovalDecision,
    reviewerAgentID: PraxisRuntimeAgentRef? = nil,
    decisionSummary: String
  ) {
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityID = capabilityID
    self.decision = decision
    self.reviewerAgentID = reviewerAgentID
    self.decisionSummary = decisionSummary
  }
}

/// Query payload for one scoped CMP approval readback.
public struct PraxisRuntimeCmpApprovalQuery: Sendable, Equatable {
  public let agentID: PraxisRuntimeAgentRef?
  public let targetAgentID: PraxisRuntimeAgentRef?
  public let capabilityID: PraxisRuntimeCapabilityRef?

  public init(
    agentID: PraxisRuntimeAgentRef? = nil,
    targetAgentID: PraxisRuntimeAgentRef? = nil,
    capabilityID: PraxisRuntimeCapabilityRef? = nil
  ) {
    self.agentID = agentID
    self.targetAgentID = targetAgentID
    self.capabilityID = capabilityID
  }
}

/// Search request payload for one scoped MP query.
public struct PraxisRuntimeMpSearchRequest: Sendable, Equatable {
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: PraxisRuntimeAgentRef?
  public let sessionID: PraxisRuntimeSessionRef?
  public let includeSuperseded: Bool

  public init(
    query: String,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5,
    agentID: PraxisRuntimeAgentRef? = nil,
    sessionID: PraxisRuntimeSessionRef? = nil,
    includeSuperseded: Bool = false
  ) {
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
    self.includeSuperseded = includeSuperseded
  }
}

/// Overview options for one scoped MP summary query.
public struct PraxisRuntimeMpOverviewOptions: Sendable, Equatable {
  public let query: String
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int
  public let agentID: PraxisRuntimeAgentRef?
  public let sessionID: PraxisRuntimeSessionRef?
  public let includeSuperseded: Bool

  public init(
    query: String = "",
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 10,
    agentID: PraxisRuntimeAgentRef? = nil,
    sessionID: PraxisRuntimeSessionRef? = nil,
    includeSuperseded: Bool = false
  ) {
    self.query = query
    self.scopeLevels = scopeLevels
    self.limit = limit
    self.agentID = agentID
    self.sessionID = sessionID
    self.includeSuperseded = includeSuperseded
  }
}

/// Resolve request payload for one scoped MP workflow query.
public struct PraxisRuntimeMpResolveRequest: Sendable, Equatable {
  public let query: String
  public let requesterAgentID: PraxisRuntimeAgentRef
  public let requesterSessionID: PraxisRuntimeSessionRef?
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    query: String,
    requesterAgentID: PraxisRuntimeAgentRef,
    requesterSessionID: PraxisRuntimeSessionRef? = nil,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.query = query
    self.requesterAgentID = requesterAgentID
    self.requesterSessionID = requesterSessionID
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

/// History request payload for one scoped MP workflow query.
public struct PraxisRuntimeMpHistoryRequest: Sendable, Equatable {
  public let query: String
  public let requesterAgentID: PraxisRuntimeAgentRef
  public let reason: String
  public let requesterSessionID: PraxisRuntimeSessionRef?
  public let scopeLevels: [PraxisMpScopeLevel]
  public let limit: Int

  public init(
    query: String,
    requesterAgentID: PraxisRuntimeAgentRef,
    reason: String,
    requesterSessionID: PraxisRuntimeSessionRef? = nil,
    scopeLevels: [PraxisMpScopeLevel] = PraxisMpScopeLevel.allCases,
    limit: Int = 5
  ) {
    self.query = query
    self.requesterAgentID = requesterAgentID
    self.reason = reason
    self.requesterSessionID = requesterSessionID
    self.scopeLevels = scopeLevels
    self.limit = limit
  }
}

/// Alignment input for one scoped MP memory mutation.
public struct PraxisRuntimeMpMemoryAlignmentInput: Sendable, Equatable {
  public let alignedAt: String?
  public let queryText: String?

  public init(alignedAt: String? = nil, queryText: String? = nil) {
    self.alignedAt = alignedAt
    self.queryText = queryText
  }
}

/// Promotion input for one scoped MP memory mutation.
public struct PraxisRuntimeMpMemoryPromotionInput: Sendable, Equatable {
  public let targetPromotionState: PraxisMpPromotionState
  public let targetSessionID: PraxisRuntimeSessionRef?
  public let promotedAt: String?
  public let reason: String?

  public init(
    targetPromotionState: PraxisMpPromotionState,
    targetSessionID: PraxisRuntimeSessionRef? = nil,
    promotedAt: String? = nil,
    reason: String? = nil
  ) {
    self.targetPromotionState = targetPromotionState
    self.targetSessionID = targetSessionID
    self.promotedAt = promotedAt
    self.reason = reason
  }
}

/// Caller-friendly request for one thin generation call.
public struct PraxisRuntimeGenerateRequest: Sendable, Equatable {
  public let prompt: String
  public let systemPrompt: String?
  public let contextSummary: String?
  public let preferredModel: String?
  public let temperature: Double?
  public let requiredCapabilities: [PraxisRuntimeCapabilityRef]

  public init(
    prompt: String,
    systemPrompt: String? = nil,
    contextSummary: String? = nil,
    preferredModel: String? = nil,
    temperature: Double? = nil,
    requiredCapabilities: [PraxisRuntimeCapabilityRef] = []
  ) {
    self.prompt = prompt
    self.systemPrompt = systemPrompt
    self.contextSummary = contextSummary
    self.preferredModel = preferredModel
    self.temperature = temperature
    self.requiredCapabilities = requiredCapabilities
  }
}

/// Caller-friendly request for one thin embedding call.
public struct PraxisRuntimeEmbeddingRequest: Sendable, Equatable {
  public let content: String
  public let preferredModel: String?

  public init(
    content: String,
    preferredModel: String? = nil
  ) {
    self.content = content
    self.preferredModel = preferredModel
  }
}

/// Caller-friendly request for one thin tool call.
public struct PraxisRuntimeToolCallRequest: Sendable, Equatable {
  public let toolName: String
  public let summary: String
  public let serverName: String?

  public init(
    toolName: String,
    summary: String,
    serverName: String? = nil
  ) {
    self.toolName = toolName
    self.summary = summary
    self.serverName = serverName
  }
}

/// Caller-friendly request for one thin file-upload call.
public struct PraxisRuntimeFileUploadRequest: Sendable, Equatable {
  public let summary: String
  public let purpose: String?

  public init(
    summary: String,
    purpose: String? = nil
  ) {
    self.summary = summary
    self.purpose = purpose
  }
}

/// Caller-friendly request for one thin batch-submit call.
public struct PraxisRuntimeBatchSubmitRequest: Sendable, Equatable {
  public let summary: String
  public let itemCount: Int

  public init(
    summary: String,
    itemCount: Int
  ) {
    self.summary = summary
    self.itemCount = itemCount
  }
}

/// Caller-friendly request for one thin runtime-session open call.
public struct PraxisRuntimeSessionOpenRequest: Sendable, Equatable {
  public let sessionID: PraxisRuntimeSessionRef?
  public let title: String?

  public init(
    sessionID: PraxisRuntimeSessionRef? = nil,
    title: String? = nil
  ) {
    self.sessionID = sessionID
    self.title = title
  }
}

/// Caller-friendly request for one web-search call.
public struct PraxisRuntimeWebSearchRequest: Sendable, Equatable {
  public let query: String
  public let locale: String?
  public let preferredDomains: [String]
  public let limit: Int

  public init(
    query: String,
    locale: String? = nil,
    preferredDomains: [String] = [],
    limit: Int = 5
  ) {
    self.query = query
    self.locale = locale
    self.preferredDomains = preferredDomains
    self.limit = limit
  }
}

/// Caller-friendly request for one fetched search candidate.
public struct PraxisRuntimeSearchFetchRequest: Sendable, Equatable {
  public let url: String
  public let preferredTitle: String?
  public let captureSnapshot: Bool
  public let timeoutSeconds: Double?

  public init(
    url: String,
    preferredTitle: String? = nil,
    captureSnapshot: Bool = true,
    timeoutSeconds: Double? = 2
  ) {
    self.url = url
    self.preferredTitle = preferredTitle
    self.captureSnapshot = captureSnapshot
    self.timeoutSeconds = timeoutSeconds
  }
}

/// Caller-friendly request for one grounded search candidate.
public struct PraxisRuntimeSearchGroundRequest: Sendable, Equatable {
  public let taskSummary: String
  public let exampleURL: String?
  public let requestedFacts: [String]
  public let locale: String?
  public let maxPages: Int

  public init(
    taskSummary: String,
    exampleURL: String? = nil,
    requestedFacts: [String] = [],
    locale: String? = nil,
    maxPages: Int = 5
  ) {
    self.taskSummary = taskSummary
    self.exampleURL = exampleURL
    self.requestedFacts = requestedFacts
    self.locale = locale
    self.maxPages = maxPages
  }
}

/// Archive input for one scoped MP memory mutation.
public struct PraxisRuntimeMpMemoryArchiveInput: Sendable, Equatable {
  public let archivedAt: String?
  public let reason: String?

  public init(archivedAt: String? = nil, reason: String? = nil) {
    self.archivedAt = archivedAt
    self.reason = reason
  }
}
