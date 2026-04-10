import PraxisCapabilityContracts
import PraxisCoreTypes

/// Normalized capability output returned to Core layers.
public struct PraxisNormalizedCapabilityOutput: Sendable, Equatable, Codable {
  public let summary: String
  public let structuredFields: [String: PraxisValue]

  /// Creates a normalized capability output.
  ///
  /// - Parameters:
  ///   - summary: Human-readable output summary.
  ///   - structuredFields: Optional structured plain-data fields.
  public init(summary: String, structuredFields: [String: PraxisValue] = [:]) {
    self.summary = summary
    self.structuredFields = structuredFields
  }
}

/// Failure taxonomy for normalized capability results.
public enum PraxisCapabilityFailure: Sendable, Equatable, Codable {
  case unavailable(String)
  case invalidResult(String)
  case executionFailed(String)
}

/// Normalized result status surfaced to Core layers.
public enum PraxisCapabilityResultStatus: String, Sendable, Equatable, Codable {
  case success
  case partial
  case failed
  case blocked
  case timeout
  case cancelled
}

/// Artifact reference emitted by a capability result.
public struct PraxisCapabilityResultArtifact: Sendable, Equatable, Codable, Identifiable {
  public let id: String
  public let kind: String
  public let reference: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a result artifact reference.
  ///
  /// - Parameters:
  ///   - id: Stable artifact identifier.
  ///   - kind: Artifact kind label.
  ///   - reference: Optional durable artifact reference.
  ///   - metadata: Extra plain-data metadata preserved with the artifact.
  public init(
    id: String,
    kind: String,
    reference: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.id = id
    self.kind = kind
    self.reference = reference
    self.metadata = metadata
  }
}

/// Normalized result envelope surfaced after capability execution.
public struct PraxisCapabilityResultEnvelope: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let status: PraxisCapabilityResultStatus
  public let output: PraxisNormalizedCapabilityOutput?
  public let failure: PraxisCapabilityFailure?
  public let artifacts: [PraxisCapabilityResultArtifact]
  public let completedAt: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a normalized capability result envelope.
  ///
  /// - Parameters:
  ///   - capabilityID: Capability identifier that produced the result.
  ///   - status: Normalized result status.
  ///   - output: Optional normalized capability output.
  ///   - failure: Optional normalized failure.
  ///   - artifacts: Artifact references emitted with the result.
  ///   - completedAt: Optional completion timestamp string.
  ///   - metadata: Extra plain-data metadata preserved with the result.
  public init(
    capabilityID: PraxisCapabilityID,
    status: PraxisCapabilityResultStatus,
    output: PraxisNormalizedCapabilityOutput? = nil,
    failure: PraxisCapabilityFailure? = nil,
    artifacts: [PraxisCapabilityResultArtifact] = [],
    completedAt: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.capabilityID = capabilityID
    self.status = status
    self.output = output
    self.failure = failure
    self.artifacts = artifacts
    self.completedAt = completedAt
    self.metadata = metadata
  }
}
