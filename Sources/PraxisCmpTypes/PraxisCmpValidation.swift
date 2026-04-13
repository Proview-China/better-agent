import Foundation
import PraxisCoreTypes

public enum PraxisCmpValidationError: Error {
  case empty(String)
  case invalid(String)
}

@inline(__always)
func praxisCmpRequire(_ value: String, _ label: String) throws -> String {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else {
    throw PraxisCmpValidationError.empty(label)
  }
  return trimmed
}

@inline(__always)
func praxisCmpOptional(_ value: String?) -> String? {
  guard let value else {
    return nil
  }
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}

/// Normalizes an optional CMP ref hint into the minimal typed boundary wrapper.
///
/// Blank input is treated as omitted so legacy optional-string initializers do not
/// produce non-nil empty wrappers.
///
/// - Parameter value: Optional raw CMP ref text.
/// - Returns: A normalized typed ref, or `nil` when the input is absent or blank.
@inline(__always)
public func praxisCmpOptionalRef(_ value: String?) -> PraxisCmpRefName? {
  praxisCmpOptional(value).map(PraxisCmpRefName.init(rawValue:))
}

/// Normalizes an optional typed CMP ref hint by collapsing blank wrappers to `nil`.
///
/// - Parameter value: Optional typed CMP ref hint.
/// - Returns: The original ref when it still carries non-empty boundary text; otherwise `nil`.
@inline(__always)
public func praxisCmpNormalizedRef(_ value: PraxisCmpRefName?) -> PraxisCmpRefName? {
  guard let value, !value.rawValue.isEmpty else {
    return nil
  }
  return value
}

func praxisCmpUnique(_ values: [String]) -> [String] {
  var seen = Set<String>()
  var result: [String] = []
  for value in values {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !seen.contains(trimmed) else {
      continue
    }
    seen.insert(trimmed)
    result.append(trimmed)
  }
  return result
}

/// Validates and normalizes the public CMP interface payloads.
public struct PraxisCmpInterfaceValidator: Sendable {
  public init() {}

  /// Validates an ingest input.
  ///
  /// - Parameter input: The input to validate.
  /// - Throws: An error when the input violates the public CMP contract.
  public func validate(_ input: PraxisIngestRuntimeContextInput) throws {
    _ = try praxisCmpRequire(input.agentID, "CMP ingest agentID")
    _ = try praxisCmpRequire(input.projectID, "CMP ingest projectID")
    _ = try praxisCmpRequire(input.sessionID, "CMP ingest sessionID")
    _ = try praxisCmpRequire(input.taskSummary, "CMP ingest taskSummary")
    guard !input.materials.isEmpty else {
      throw PraxisCmpValidationError.invalid("CMP ingest requires at least one material.")
    }
    try validate(input.lineage)
    for material in input.materials {
      _ = try praxisCmpRequire(material.ref, "CMP material ref")
    }
  }

  /// Validates a lineage record.
  ///
  /// - Parameter lineage: The lineage to validate.
  /// - Throws: An error when the lineage violates topology invariants.
  public func validate(_ lineage: PraxisCmpAgentLineage) throws {
    _ = try praxisCmpRequire(lineage.projectID, "CMP lineage projectID")
    _ = try praxisCmpRequire(lineage.agentID, "CMP lineage agentID")
    if lineage.depth < 0 {
      throw PraxisCmpValidationError.invalid("CMP lineage depth must be non-negative.")
    }
    if lineage.depth == 0, lineage.parentAgentID != nil {
      throw PraxisCmpValidationError.invalid("CMP root lineage must not carry a parentAgentID.")
    }
    if lineage.depth > 0, praxisCmpOptional(lineage.parentAgentID) == nil {
      throw PraxisCmpValidationError.invalid("CMP non-root lineage requires a parentAgentID.")
    }
  }

  /// Validates a context delta.
  ///
  /// - Parameter delta: The delta to validate.
  /// - Throws: An error when the delta violates the public CMP contract.
  public func validate(_ delta: PraxisCmpContextDelta) throws {
    _ = try praxisCmpRequire(delta.agentID, "CMP delta agentID")
    _ = try praxisCmpRequire(delta.changeSummary, "CMP delta changeSummary")
    guard !delta.eventRefs.isEmpty else {
      throw PraxisCmpValidationError.invalid("CMP delta must reference at least one event.")
    }
  }

  /// Validates a checked snapshot.
  ///
  /// - Parameter snapshot: The snapshot to validate.
  /// - Throws: An error when the snapshot violates the public CMP contract.
  public func validate(_ snapshot: PraxisCmpCheckedSnapshot) throws {
    _ = try praxisCmpRequire(snapshot.agentID, "CMP checked snapshot agentID")
    _ = try praxisCmpRequire(snapshot.branchRef, "CMP checked snapshot branchRef")
    _ = try praxisCmpRequire(snapshot.commitRef, "CMP checked snapshot commitRef")
  }

  /// Validates a context package.
  ///
  /// - Parameter package: The package to validate.
  /// - Throws: An error when the package violates the public CMP contract.
  public func validate(_ package: PraxisCmpContextPackage) throws {
    _ = try praxisCmpRequire(package.sourceAgentID, "CMP package sourceAgentID")
    _ = try praxisCmpRequire(package.targetAgentID, "CMP package targetAgentID")
    _ = try praxisCmpRequire(package.packageRef, "CMP package packageRef")
  }

  /// Validates a dispatch receipt.
  ///
  /// - Parameter receipt: The receipt to validate.
  /// - Throws: An error when the receipt violates the public CMP contract.
  public func validate(_ receipt: PraxisCmpDispatchReceipt) throws {
    _ = try praxisCmpRequire(receipt.sourceAgentID, "CMP dispatch receipt sourceAgentID")
    _ = try praxisCmpRequire(receipt.targetAgentID, "CMP dispatch receipt targetAgentID")
  }
}
