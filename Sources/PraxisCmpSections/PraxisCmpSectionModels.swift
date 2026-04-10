import PraxisCmpTypes
import PraxisCoreTypes

public struct PraxisSectionIngressRequest: Sendable, Equatable, Codable {
  public let requestID: PraxisCmpRequestID
  public let lineageID: PraxisCmpLineageID
  public let taskSummary: String
  public let createdAt: String

  public init(
    requestID: PraxisCmpRequestID,
    lineageID: PraxisCmpLineageID,
    taskSummary: String,
    createdAt: String
  ) {
    self.requestID = requestID
    self.lineageID = lineageID
    self.taskSummary = taskSummary
    self.createdAt = createdAt
  }
}

public enum PraxisCmpSectionSource: String, Sendable, Codable {
  case runtimeMaterial
  case derivedSummary
  case historicalReply
}

public enum PraxisCmpSectionKind: String, Sendable, Codable {
  case userInput
  case systemPrompt
  case assistantOutput
  case toolResult
  case stateMarker
  case contextPackage
  case compositeSummary
}

public enum PraxisCmpSectionFidelity: String, Sendable, Codable {
  case exact
  case highSignal
  case summary
}

public enum PraxisCmpStoredSectionPlane: String, Sendable, Codable {
  case git
  case db
  case dispatcher
}

public enum PraxisCmpStoredSectionState: String, Sendable, Codable {
  case candidate
  case checked
  case promoted
}

public struct PraxisCmpSectionSourceAnchor: Sendable, Equatable, Codable {
  public let payloadRef: String
  public let label: String

  public init(payloadRef: String, label: String) {
    self.payloadRef = payloadRef
    self.label = label
  }
}

public struct PraxisCmpSection: Sendable, Equatable, Codable {
  public let id: PraxisCmpSectionID
  public let lineageID: PraxisCmpLineageID
  public let title: String
  public let source: PraxisCmpSectionSource
  public let kind: PraxisCmpSectionKind
  public let fidelity: PraxisCmpSectionFidelity
  public let scope: PraxisCmpScope
  public let payloadRefs: [String]
  public let sourceAnchors: [PraxisCmpSectionSourceAnchor]
  public let ancestry: [PraxisCmpSectionID]
  public let metadata: [String: PraxisValue]

  public init(
    id: PraxisCmpSectionID,
    lineageID: PraxisCmpLineageID,
    title: String,
    source: PraxisCmpSectionSource,
    kind: PraxisCmpSectionKind,
    fidelity: PraxisCmpSectionFidelity,
    scope: PraxisCmpScope,
    payloadRefs: [String],
    sourceAnchors: [PraxisCmpSectionSourceAnchor],
    ancestry: [PraxisCmpSectionID] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.lineageID = lineageID
    self.title = title
    self.source = source
    self.kind = kind
    self.fidelity = fidelity
    self.scope = scope
    self.payloadRefs = payloadRefs
    self.sourceAnchors = sourceAnchors
    self.ancestry = ancestry
    self.metadata = metadata
  }
}

public struct PraxisCmpStoredSection: Sendable, Equatable, Codable {
  public let id: String
  public let sectionID: PraxisCmpSectionID
  public let plane: PraxisCmpStoredSectionPlane
  public let state: PraxisCmpStoredSectionState
  public let scope: PraxisCmpScope
  public let storedRef: String
  public let metadata: [String: PraxisValue]

  public init(
    id: String,
    sectionID: PraxisCmpSectionID,
    plane: PraxisCmpStoredSectionPlane,
    state: PraxisCmpStoredSectionState,
    scope: PraxisCmpScope,
    storedRef: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.id = id
    self.sectionID = sectionID
    self.plane = plane
    self.state = state
    self.scope = scope
    self.storedRef = storedRef
    self.metadata = metadata
  }
}

public struct PraxisSectionOwnershipRule: Sendable, Equatable, Codable {
  public let ruleID: String
  public let ownerRole: String
  public let summary: String
  public let allowedKinds: [PraxisCmpSectionKind]
  public let requiredScope: PraxisCmpScope?
  public let targetPlane: PraxisCmpStoredSectionPlane
  public let targetState: PraxisCmpStoredSectionState

  public init(
    ruleID: String,
    ownerRole: String,
    summary: String,
    allowedKinds: [PraxisCmpSectionKind],
    requiredScope: PraxisCmpScope? = nil,
    targetPlane: PraxisCmpStoredSectionPlane,
    targetState: PraxisCmpStoredSectionState
  ) {
    self.ruleID = ruleID
    self.ownerRole = ownerRole
    self.summary = summary
    self.allowedKinds = allowedKinds
    self.requiredScope = requiredScope
    self.targetPlane = targetPlane
    self.targetState = targetState
  }
}

public struct PraxisSectionRuleEvaluation: Sendable, Equatable, Codable {
  public let ruleID: String
  public let accepted: Bool
  public let summary: String

  public init(ruleID: String, accepted: Bool, summary: String) {
    self.ruleID = ruleID
    self.accepted = accepted
    self.summary = summary
  }
}

public struct PraxisSectionRulePack: Sendable, Equatable, Codable {
  public let rules: [PraxisSectionOwnershipRule]

  public init(rules: [PraxisSectionOwnershipRule]) {
    self.rules = rules
  }
}

public struct PraxisSectionIngressRecord: Sendable, Equatable, Codable {
  public let request: PraxisSectionIngressRequest
  public let sections: [PraxisCmpSection]
  public let requiresActiveSync: Bool

  public init(
    request: PraxisSectionIngressRequest,
    sections: [PraxisCmpSection],
    requiresActiveSync: Bool
  ) {
    self.request = request
    self.sections = sections
    self.requiresActiveSync = requiresActiveSync
  }
}

public struct PraxisSectionLoweringPlan: Sendable, Equatable, Codable {
  public let section: PraxisCmpSection
  public let storedSection: PraxisCmpStoredSection?
  public let evaluations: [PraxisSectionRuleEvaluation]
  public let targetSummary: String

  public init(
    section: PraxisCmpSection,
    storedSection: PraxisCmpStoredSection?,
    evaluations: [PraxisSectionRuleEvaluation],
    targetSummary: String
  ) {
    self.section = section
    self.storedSection = storedSection
    self.evaluations = evaluations
    self.targetSummary = targetSummary
  }
}
