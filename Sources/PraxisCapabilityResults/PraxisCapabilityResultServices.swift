import PraxisCapabilityContracts
import PraxisCoreTypes

/// Normalizes raw capability responses into stable Core result envelopes.
public protocol PraxisCapabilityResultNormalizing: Sendable {
  /// Normalizes a raw textual summary into a stable result envelope.
  ///
  /// - Parameters:
  ///   - rawSummary: Raw textual summary returned by a capability implementation.
  ///   - capabilityID: Capability identifier that produced the response.
  /// - Returns: A normalized capability result envelope.
  func normalize(rawSummary: String, capabilityID: PraxisCapabilityID) -> PraxisCapabilityResultEnvelope
}

/// Default textual result normalizer.
public struct PraxisDefaultCapabilityResultNormalizer: Sendable, PraxisCapabilityResultNormalizing {
  /// Creates the default capability result normalizer.
  public init() {}

  public func normalize(
    rawSummary: String,
    capabilityID: PraxisCapabilityID
  ) -> PraxisCapabilityResultEnvelope {
    let summary = rawSummary.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !summary.isEmpty else {
      return failureEnvelope(
        capabilityID: capabilityID,
        failure: .invalidResult("Capability result summary must not be empty.")
      )
    }
    return PraxisCapabilityResultEnvelope(
      capabilityID: capabilityID,
      status: .success,
      output: .init(summary: summary)
    )
  }

  /// Builds a normalized success envelope from plain-data output.
  ///
  /// - Parameters:
  ///   - capabilityID: Capability identifier that produced the response.
  ///   - summary: Human-readable output summary.
  ///   - structuredFields: Optional structured plain-data fields.
  ///   - artifacts: Optional emitted artifact references.
  ///   - completedAt: Optional completion timestamp string.
  /// - Returns: A normalized success envelope.
  public func successEnvelope(
    capabilityID: PraxisCapabilityID,
    summary: String,
    structuredFields: [String: PraxisValue] = [:],
    artifacts: [PraxisCapabilityResultArtifact] = [],
    completedAt: String? = nil
  ) -> PraxisCapabilityResultEnvelope {
    PraxisCapabilityResultEnvelope(
      capabilityID: capabilityID,
      status: .success,
      output: .init(summary: summary, structuredFields: structuredFields),
      artifacts: artifacts,
      completedAt: completedAt
    )
  }

  /// Builds a normalized failure envelope.
  ///
  /// - Parameters:
  ///   - capabilityID: Capability identifier that produced the response.
  ///   - failure: Normalized failure taxonomy value.
  ///   - completedAt: Optional completion timestamp string.
  /// - Returns: A normalized failure envelope.
  public func failureEnvelope(
    capabilityID: PraxisCapabilityID,
    failure: PraxisCapabilityFailure,
    completedAt: String? = nil
  ) -> PraxisCapabilityResultEnvelope {
    PraxisCapabilityResultEnvelope(
      capabilityID: capabilityID,
      status: status(for: failure),
      failure: failure,
      completedAt: completedAt
    )
  }
}

private extension PraxisDefaultCapabilityResultNormalizer {
  func status(for failure: PraxisCapabilityFailure) -> PraxisCapabilityResultStatus {
    switch failure {
    case .unavailable:
      return .blocked
    case .invalidResult, .executionFailed:
      return .failed
    }
  }
}
