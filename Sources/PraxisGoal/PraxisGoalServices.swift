import Foundation
import PraxisCoreTypes

public struct PraxisGoalNormalizationOptions: Sendable, Equatable, Codable {
  public let taskStatement: String?
  public let successCriteria: [PraxisGoalCriterion]?
  public let failureCriteria: [PraxisGoalCriterion]?
  public let additionalConstraints: [PraxisGoalConstraint]

  public init(
    taskStatement: String? = nil,
    successCriteria: [PraxisGoalCriterion]? = nil,
    failureCriteria: [PraxisGoalCriterion]? = nil,
    additionalConstraints: [PraxisGoalConstraint] = []
  ) {
    self.taskStatement = taskStatement
    self.successCriteria = successCriteria
    self.failureCriteria = failureCriteria
    self.additionalConstraints = additionalConstraints
  }
}

public struct PraxisGoalCompileCapabilityHint: Sendable, Equatable, Codable {
  public let key: String
  public let description: String?

  public init(key: String, description: String? = nil) {
    self.key = key
    self.description = description
  }
}

public struct PraxisGoalCompileContext: Sendable, Equatable, Codable {
  public let staticInstructions: [String]
  public let capabilityHints: [PraxisGoalCompileCapabilityHint]
  public let contextSummary: String?
  public let metadata: [String: PraxisValue]?

  public init(
    staticInstructions: [String] = [],
    capabilityHints: [PraxisGoalCompileCapabilityHint] = [],
    contextSummary: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.staticInstructions = staticInstructions
    self.capabilityHints = capabilityHints
    self.contextSummary = contextSummary
    self.metadata = metadata
  }
}

public protocol PraxisGoalNormalizing: Sendable {
  func normalize(
    _ source: PraxisGoalSource,
    options: PraxisGoalNormalizationOptions
  ) throws -> PraxisNormalizedGoal
}

public protocol PraxisGoalCompiling: Sendable {
  func compile(
    _ goal: PraxisNormalizedGoal,
    context: PraxisGoalCompileContext
  ) throws -> PraxisCompiledGoal
}

public extension PraxisGoalNormalizing {
  func normalize(_ source: PraxisGoalSource) throws -> PraxisNormalizedGoal {
    try normalize(source, options: .init())
  }
}

public extension PraxisGoalCompiling {
  func compile(_ goal: PraxisNormalizedGoal) throws -> PraxisCompiledGoal {
    try compile(goal, context: .init())
  }
}

public struct PraxisDefaultGoalNormalizer: Sendable, PraxisGoalNormalizing {
  public init() {}

  public func normalize(
    _ source: PraxisGoalSource,
    options: PraxisGoalNormalizationOptions = .init()
  ) throws -> PraxisNormalizedGoal {
    let taskStatement = try trimmed(
      options.taskStatement ?? source.userInput,
      label: "PraxisNormalizedGoal.taskStatement"
    )
    let mergedConstraints = dedupeConstraints(source.constraints + options.additionalConstraints)
    return PraxisNormalizedGoal(
      id: source.id,
      taskStatement: taskStatement,
      title: taskStatement,
      summary: taskStatement,
      successCriteria: normalizeCriteria(
        options.successCriteria,
        fallback: buildDefaultSuccessCriteria(taskStatement: taskStatement)
      ),
      failureCriteria: normalizeCriteria(
        options.failureCriteria,
        fallback: buildDefaultFailureCriteria()
      ),
      constraints: mergedConstraints,
      inputRefs: source.inputRefs,
      metadata: source.metadata
    )
  }
}

public struct PraxisDefaultGoalCompiler: Sendable, PraxisGoalCompiling {
  public init() {}

  public func compile(
    _ goal: PraxisNormalizedGoal,
    context: PraxisGoalCompileContext = .init()
  ) throws -> PraxisCompiledGoal {
    let instructionLines = [
      renderSection("Task", lines: [goal.taskStatement]),
      renderSection(
        "Success Criteria",
        lines: goal.successCriteria.map { "- \($0.description)" }
      ),
      renderSection(
        "Failure Criteria",
        lines: goal.failureCriteria.map { "- \($0.description)" }
      ),
      renderSection(
        "Constraints",
        lines: goal.constraints.map { "- \($0.summary)" }
      ),
      renderSection(
        "Input Refs",
        lines: goal.inputRefs.map { "- \($0)" }
      ),
      renderSection(
        "Static Instructions",
        lines: context.staticInstructions.map { "- \($0)" }
      ),
      renderSection(
        "Capability Hints",
        lines: context.capabilityHints.map {
          if let description = $0.description {
            return "- \($0.key): \(description)"
          }
          return "- \($0.key)"
        }
      ),
      renderSection(
        "Context Summary",
        lines: context.contextSummary.map { [$0] } ?? []
      ),
    ].flatMap { $0 }

    let mergedMetadata = mergeMetadata(goal.metadata, context.metadata)
    return PraxisCompiledGoal(
      normalizedGoal: goal,
      instructionText: instructionLines.joined(separator: "\n"),
      cacheKey: try buildGoalCompiledCacheKey(goal, context: context),
      metadata: mergedMetadata
    )
  }

  public func buildGoalCompiledCacheKey(
    _ goal: PraxisNormalizedGoal,
    context: PraxisGoalCompileContext = .init()
  ) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let seed = GoalCacheSeed(
      goal: goal,
      staticInstructions: context.staticInstructions,
      capabilityHints: context.capabilityHints,
      contextSummary: context.contextSummary,
      metadata: mergeMetadata(goal.metadata, context.metadata)
    )
    let data = try encoder.encode(seed)
    guard let json = String(data: data, encoding: .utf8) else {
      throw PraxisError.invariantViolation("Failed to build goal cache key JSON string.")
    }
    return json
  }
}

public struct PraxisGoalValidationService: Sendable {
  public init() {}

  public func validate(source: PraxisGoalSource) -> [PraxisGoalValidationIssue] {
    var issues: [PraxisGoalValidationIssue] = []
    if source.userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      issues.append(.init(message: "Goal source userInput must not be empty."))
    }
    return issues
  }

  public func validate(normalized goal: PraxisNormalizedGoal) -> [PraxisGoalValidationIssue] {
    var issues: [PraxisGoalValidationIssue] = []
    if goal.taskStatement.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      issues.append(.init(message: "Normalized goal taskStatement must not be empty."))
    }
    if goal.successCriteria.isEmpty {
      issues.append(.init(message: "Normalized goal should provide at least one success criterion."))
    }
    if goal.failureCriteria.isEmpty {
      issues.append(.init(message: "Normalized goal should provide at least one failure criterion."))
    }
    return issues
  }
}

private struct GoalCacheSeed: Encodable {
  let goal: PraxisNormalizedGoal
  let staticInstructions: [String]
  let capabilityHints: [PraxisGoalCompileCapabilityHint]
  let contextSummary: String?
  let metadata: [String: PraxisValue]?
}

private func renderSection(_ title: String, lines: [String]) -> [String] {
  guard !lines.isEmpty else {
    return []
  }
  return [title] + lines
}

private func trimmed(_ value: String, label: String) throws -> String {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else {
    throw PraxisError.invalidInput("\(label) must not be empty.")
  }
  return trimmed
}

private func normalizeCriteria(
  _ criteria: [PraxisGoalCriterion]?,
  fallback: [PraxisGoalCriterion]
) -> [PraxisGoalCriterion] {
  let list = criteria ?? fallback
  return list.map {
    .init(
      id: $0.id,
      description: $0.description.trimmingCharacters(in: .whitespacesAndNewlines),
      required: $0.required
    )
  }
}

private func dedupeConstraints(_ constraints: [PraxisGoalConstraint]) -> [PraxisGoalConstraint] {
  var seen: Set<String> = []
  var normalized: [PraxisGoalConstraint] = []

  for constraint in constraints {
    let key = "\(constraint.key.trimmingCharacters(in: .whitespacesAndNewlines)):\(constraint.value.canonicalDescription)"
    guard !seen.contains(key) else {
      continue
    }
    seen.insert(key)
    normalized.append(
      .init(
        key: constraint.key.trimmingCharacters(in: .whitespacesAndNewlines),
        value: constraint.value,
        description: constraint.description?.trimmingCharacters(in: .whitespacesAndNewlines)
      )
    )
  }

  return normalized
}

private func buildDefaultSuccessCriteria(taskStatement: String) -> [PraxisGoalCriterion] {
  [
    .init(
      id: "complete-task",
      description: "完成目标：\(taskStatement)",
      required: true
    ),
  ]
}

private func buildDefaultFailureCriteria() -> [PraxisGoalCriterion] {
  [
    .init(
      id: "goal-blocked",
      description: "遇到阻塞且无法继续推进当前目标",
      required: true
    ),
  ]
}

private func mergeMetadata(
  _ lhs: [String: PraxisValue]?,
  _ rhs: [String: PraxisValue]?
) -> [String: PraxisValue]? {
  guard lhs != nil || rhs != nil else {
    return nil
  }
  return (lhs ?? [:]).merging(rhs ?? [:]) { _, new in new }
}
