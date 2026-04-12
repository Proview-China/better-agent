public enum PraxisMpFiveAgentRole: String, Sendable, Equatable, Codable, CaseIterable {
  case icma
  case iterator
  case checker
  case dbagent
  case dispatcher
}

public enum PraxisMpIcmaStage: String, Sendable, Equatable, Codable, CaseIterable {
  case capture
  case chunkCandidate = "chunk_candidate"
  case emitCandidate = "emit_candidate"
}

public enum PraxisMpIteratorStage: String, Sendable, Equatable, Codable, CaseIterable {
  case acceptCandidate = "accept_candidate"
  case rewriteDraft = "rewrite_draft"
  case handoffChecker = "handoff_checker"
}

public enum PraxisMpCheckerStage: String, Sendable, Equatable, Codable, CaseIterable {
  case inspectCandidate = "inspect_candidate"
  case judgeAlignment = "judge_alignment"
  case emitDecision = "emit_decision"
}

public enum PraxisMpDbAgentStage: String, Sendable, Equatable, Codable, CaseIterable {
  case materialize
  case updateLineage = "update_lineage"
  case persistTruth = "persist_truth"
}

public enum PraxisMpDispatcherStage: String, Sendable, Equatable, Codable, CaseIterable {
  case search
  case rerank
  case assembleBundle = "assemble_bundle"
}

public enum PraxisMpRoleTelemetryStage: String, Sendable, Equatable, Codable, CaseIterable {
  case capture
  case chunkCandidate = "chunk_candidate"
  case emitCandidate = "emit_candidate"
  case acceptCandidate = "accept_candidate"
  case rewriteDraft = "rewrite_draft"
  case handoffChecker = "handoff_checker"
  case inspectCandidate = "inspect_candidate"
  case judgeAlignment = "judge_alignment"
  case emitDecision = "emit_decision"
  case materialize
  case updateLineage = "update_lineage"
  case persistTruth = "persist_truth"
  case search
  case rerank
  case assembleBundle = "assemble_bundle"

  public init?(role: PraxisMpFiveAgentRole, rawValue: String) {
    switch role {
    case .icma:
      guard let stage = PraxisMpIcmaStage(rawValue: rawValue) else {
        return nil
      }
      self = Self(icmaStage: stage)
    case .iterator:
      guard let stage = PraxisMpIteratorStage(rawValue: rawValue) else {
        return nil
      }
      self = Self(iteratorStage: stage)
    case .checker:
      guard let stage = PraxisMpCheckerStage(rawValue: rawValue) else {
        return nil
      }
      self = Self(checkerStage: stage)
    case .dbagent:
      guard let stage = PraxisMpDbAgentStage(rawValue: rawValue) else {
        return nil
      }
      self = Self(dbAgentStage: stage)
    case .dispatcher:
      guard let stage = PraxisMpDispatcherStage(rawValue: rawValue) else {
        return nil
      }
      self = Self(dispatcherStage: stage)
    }
  }

  public init(icmaStage: PraxisMpIcmaStage) {
    switch icmaStage {
    case .capture:
      self = .capture
    case .chunkCandidate:
      self = .chunkCandidate
    case .emitCandidate:
      self = .emitCandidate
    }
  }

  public init(iteratorStage: PraxisMpIteratorStage) {
    switch iteratorStage {
    case .acceptCandidate:
      self = .acceptCandidate
    case .rewriteDraft:
      self = .rewriteDraft
    case .handoffChecker:
      self = .handoffChecker
    }
  }

  public init(checkerStage: PraxisMpCheckerStage) {
    switch checkerStage {
    case .inspectCandidate:
      self = .inspectCandidate
    case .judgeAlignment:
      self = .judgeAlignment
    case .emitDecision:
      self = .emitDecision
    }
  }

  public init(dbAgentStage: PraxisMpDbAgentStage) {
    switch dbAgentStage {
    case .materialize:
      self = .materialize
    case .updateLineage:
      self = .updateLineage
    case .persistTruth:
      self = .persistTruth
    }
  }

  public init(dispatcherStage: PraxisMpDispatcherStage) {
    switch dispatcherStage {
    case .search:
      self = .search
    case .rerank:
      self = .rerank
    case .assembleBundle:
      self = .assembleBundle
    }
  }

  public var role: PraxisMpFiveAgentRole {
    switch self {
    case .capture, .chunkCandidate, .emitCandidate:
      .icma
    case .acceptCandidate, .rewriteDraft, .handoffChecker:
      .iterator
    case .inspectCandidate, .judgeAlignment, .emitDecision:
      .checker
    case .materialize, .updateLineage, .persistTruth:
      .dbagent
    case .search, .rerank, .assembleBundle:
      .dispatcher
    }
  }
}

public struct PraxisMpRoleStageMap: Sendable, Equatable, Codable {
  public enum ValidationError: Error, Equatable {
    case incompatibleStage(role: PraxisMpFiveAgentRole, stage: PraxisMpRoleTelemetryStage)
  }

  public static let empty = Self(stages: [:])

  public let stages: [PraxisMpFiveAgentRole: PraxisMpRoleTelemetryStage]

  public init(stages: [PraxisMpFiveAgentRole: PraxisMpRoleTelemetryStage]) {
    precondition(
      (try? Self.validate(stages: stages)) != nil,
      "Invalid MP role-stage combination."
    )
    self.stages = stages
  }

  public init(validating stages: [PraxisMpFiveAgentRole: PraxisMpRoleTelemetryStage]) throws {
    try Self.validate(stages: stages)
    self.stages = stages
  }

  public subscript(_ role: PraxisMpFiveAgentRole) -> PraxisMpRoleTelemetryStage? {
    stages[role]
  }

  public var isEmpty: Bool {
    stages.isEmpty
  }

  /// Returns a copy of the map with the latest stage for the stage's role updated.
  ///
  /// - Parameter stage: The typed role stage to record.
  /// - Returns: A new map with the updated role stage.
  public func setting(_ stage: PraxisMpRoleTelemetryStage) -> Self {
    var updated = stages
    updated[stage.role] = stage
    return Self(stages: updated)
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var stages: [PraxisMpFiveAgentRole: PraxisMpRoleTelemetryStage] = [:]

    for key in container.allKeys {
      guard let role = PraxisMpFiveAgentRole(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid MP role key \(key.stringValue)."
        )
      }

      let rawStage = try container.decode(String.self, forKey: key)
      guard let stage = PraxisMpRoleTelemetryStage(role: role, rawValue: rawStage) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid MP role stage \(rawStage) for role \(role.rawValue)."
        )
      }

      stages[role] = stage
    }

    try self.init(validating: stages)
  }

  public func encode(to encoder: Encoder) throws {
    try Self.validate(stages: stages)
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for role in stages.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: role.rawValue)!
      try container.encode(stages[role]?.rawValue, forKey: key)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }

  private static func validate(stages: [PraxisMpFiveAgentRole: PraxisMpRoleTelemetryStage]) throws {
    for (role, stage) in stages where stage.role != role {
      throw ValidationError.incompatibleStage(role: role, stage: stage)
    }
  }
}

public struct PraxisMpRoleCountMap: Sendable, Equatable, Codable {
  public let counts: [PraxisMpFiveAgentRole: Int]

  public init(counts: [PraxisMpFiveAgentRole: Int]) {
    self.counts = counts
  }

  public subscript(_ role: PraxisMpFiveAgentRole) -> Int? {
    counts[role]
  }

  public var isEmpty: Bool {
    counts.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var counts: [PraxisMpFiveAgentRole: Int] = [:]

    for key in container.allKeys {
      guard let role = PraxisMpFiveAgentRole(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid MP role key \(key.stringValue)."
        )
      }

      counts[role] = try container.decode(Int.self, forKey: key)
    }

    self.init(counts: counts)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    for role in counts.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let key = DynamicCodingKey(stringValue: role.rawValue)!
      try container.encode(counts[role], forKey: key)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}
