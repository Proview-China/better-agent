import Foundation
import PraxisCoreTypes

/// Optional overrides used while normalizing a raw goal source.
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

/// Capability metadata that helps compile a goal into concrete instructions.
public struct PraxisGoalCompileCapabilityHint: Sendable, Equatable, Codable {
  public let key: String
  public let description: String?

  public init(key: String, description: String? = nil) {
    self.key = key
    self.description = description
  }
}

/// Extra compile-time context appended to the normalized goal.
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

/// Converts raw goal input into a normalized domain model.
public protocol PraxisGoalNormalizing: Sendable {
  /// Normalizes a raw goal source, applying optional overrides and defaults.
  ///
  /// - Parameters:
  ///   - source: The raw goal payload captured from a user or system surface.
  ///   - options: Optional overrides for task statement, criteria, and extra constraints.
  /// - Returns: A normalized goal ready for validation, compilation, and downstream planning.
  /// - Throws: `PraxisError.invalidInput` when the resulting task statement is empty after trimming,
  ///   or any implementation-specific normalization failure.
  func normalize(
    _ source: PraxisGoalSource,
    options: PraxisGoalNormalizationOptions
  ) throws -> PraxisNormalizedGoal
}

/// Converts a normalized goal into instruction text plus cache metadata.
public protocol PraxisGoalCompiling: Sendable {
  /// Compiles a normalized goal with runtime context into a prompt-ready package.
  ///
  /// - Parameters:
  ///   - goal: The normalized goal that represents the domain truth to compile.
  ///   - context: Additional static instructions, capability hints, and metadata for rendering.
  /// - Returns: A compiled goal containing instruction text plus deterministic cache metadata.
  /// - Throws: Any implementation-specific compilation failure, including cache-key generation errors.
  func compile(
    _ goal: PraxisNormalizedGoal,
    context: PraxisGoalCompileContext
  ) throws -> PraxisCompiledGoal
}

public extension PraxisGoalNormalizing {
  /// Normalizes a source using default options.
  ///
  /// - Parameter source: The raw goal payload to normalize.
  /// - Returns: A normalized goal derived from the source without caller overrides.
  /// - Throws: Any error thrown by ``normalize(_:options:)``.
  func normalize(_ source: PraxisGoalSource) throws -> PraxisNormalizedGoal {
    try normalize(source, options: .init())
  }
}

public extension PraxisGoalCompiling {
  /// Compiles a goal using an empty compile context.
  ///
  /// - Parameter goal: The normalized goal to compile.
  /// - Returns: A compiled goal rendered without extra compile-time context.
  /// - Throws: Any error thrown by ``compile(_:context:)``.
  func compile(_ goal: PraxisNormalizedGoal) throws -> PraxisCompiledGoal {
    try compile(goal, context: .init())
  }
}

/// Default implementation that trims input and injects baseline goal criteria.
public struct PraxisDefaultGoalNormalizer: Sendable, PraxisGoalNormalizing {
  public init() {}

  /// Builds a normalized goal from raw source input and optional caller overrides.
  ///
  /// This implementation trims the final task statement, merges constraints with
  /// deduplication, and injects baseline success and failure criteria when the
  /// caller does not provide explicit lists.
  ///
  /// - Parameters:
  ///   - source: The raw goal source collected from the current entry surface.
  ///   - options: Optional overrides used to replace or extend the source payload.
  /// - Returns: A normalized goal with stable defaults applied.
  /// - Throws: `PraxisError.invalidInput` when the resolved task statement is empty after trimming.
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

/// Default implementation that renders normalized goals into instruction text.
public struct PraxisDefaultGoalCompiler: Sendable, PraxisGoalCompiling {
  public init() {}

  /// Produces a compiled goal containing instruction text and cache metadata.
  ///
  /// The generated instruction text is organized into named sections so downstream
  /// runtime layers can inspect or display the output without reparsing opaque text.
  ///
  /// - Parameters:
  ///   - goal: The normalized goal to render into instruction text.
  ///   - context: Additional compilation context such as static instructions and capability hints.
  /// - Returns: A compiled goal whose instruction text and metadata are ready for execution-time use.
  /// - Throws: Any error thrown while building the deterministic cache key.
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

  /// Builds a deterministic cache key from the normalized goal and compile context.
  ///
  /// The cache key is encoded as sorted JSON so semantically identical inputs
  /// produce a stable string across runs.
  ///
  /// - Parameters:
  ///   - goal: The normalized goal that forms the primary cache seed.
  ///   - context: The compile-time context merged into the cache seed.
  /// - Returns: A deterministic JSON string suitable for cache lookup and snapshot tests.
  /// - Throws: `PraxisError.invariantViolation` when the encoded seed cannot be represented
  ///   as UTF-8 text, or any encoding error produced while serializing the seed.
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

/// Lightweight validation helpers for raw and normalized goal payloads.
public struct PraxisGoalValidationService: Sendable {
  public init() {}

  /// Validates a raw goal source before normalization.
  ///
  /// - Parameter source: The raw goal source to inspect.
  /// - Returns: Zero or more validation issues describing why the source is incomplete or invalid.
  public func validate(source: PraxisGoalSource) -> [PraxisGoalValidationIssue] {
    var issues: [PraxisGoalValidationIssue] = []
    if source.userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      issues.append(.init(message: "Goal source userInput must not be empty."))
    }
    return issues
  }

  /// Validates a normalized goal before compilation or execution.
  ///
  /// - Parameter goal: The normalized goal to inspect.
  /// - Returns: Zero or more validation issues describing missing or invalid normalized fields.
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
