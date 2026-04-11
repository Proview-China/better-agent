import PraxisMpMemory
import PraxisMpTypes

/// Centralizes stable MP host-runtime diagnostics text for summaries and fallback issues.
///
/// This type keeps human-readable strings out of individual MP use cases so the
/// orchestration layer focuses on control flow instead of wording.
public struct PraxisMpHostDiagnosticsService: Sendable {
  public init() {}

  /// Returns the stable missing-store summary for one MP operation.
  ///
  /// - Parameter operation: Short MP operation label such as `search` or `readback`.
  /// - Returns: One stable summary string for the missing memory-store case.
  public func missingSemanticMemoryStoreSummary(for operation: String) -> String {
    "MP \(operation) could not run because the semantic memory store is not wired into HostRuntime."
  }

  /// Returns the stable missing-store issue for one MP operation.
  ///
  /// - Parameter operation: Short MP operation label such as `search` or `readback`.
  /// - Returns: One stable issue string for the missing memory-store case.
  public func missingSemanticMemoryStoreIssue(for operation: String) -> String {
    "MP \(operation) requires a semantic memory store adapter."
  }

  /// Returns the stable semantic-search fallback issue for one MP operation.
  ///
  /// - Parameter operation: Short MP operation label such as `search`, `readback`, `resolve`, or `history`.
  /// - Returns: One stable issue string for semantic-search fallback behavior.
  public func semanticSearchFallbackIssue(for operation: String) -> String {
    switch operation {
    case "search":
      return "Semantic search index is not wired; ranking fell back to memory governance only."
    case "readback":
      return "Semantic search index is not wired; readback currently reflects memory-store truth only."
    case "resolve":
      return "Semantic search index is not wired; MP resolve currently uses governance-only ranking."
    case "history":
      return "Semantic search index is not wired; MP history currently uses governance-only ranking."
    default:
      return "Semantic search index is not wired; MP runtime currently uses governance-only ranking."
    }
  }

  /// Returns the stable smoke summary for one MP smoke run.
  ///
  /// - Parameters:
  ///   - readyChecks: Number of ready runtime gates.
  ///   - totalChecks: Total runtime gate count.
  ///   - projectID: Project identifier under inspection.
  /// - Returns: One stable smoke summary string.
  public func smokeSummary(
    readyChecks: Int,
    totalChecks: Int,
    projectID: String
  ) -> String {
    "MP smoke reports \(readyChecks)/\(totalChecks) runtime gates ready for project \(projectID)."
  }

  /// Returns the stable ingest summary for one MP ingest run.
  ///
  /// - Parameters:
  ///   - updatedCount: Number of updated records.
  ///   - decision: Final alignment decision.
  ///   - primaryMemoryID: Primary memory identifier.
  /// - Returns: One stable ingest summary string.
  public func ingestSummary(
    updatedCount: Int,
    decision: PraxisMpAlignmentDecision,
    primaryMemoryID: String
  ) -> String {
    "MP ingest stored \(updatedCount) record update(s) and finished with \(decision.rawValue) for \(primaryMemoryID)."
  }

  /// Returns the stable align summary for one MP align run.
  ///
  /// - Parameters:
  ///   - updatedCount: Number of updated records.
  ///   - decision: Final alignment decision.
  ///   - memoryID: Target memory identifier.
  /// - Returns: One stable align summary string.
  public func alignSummary(
    updatedCount: Int,
    decision: PraxisMpAlignmentDecision,
    memoryID: String
  ) -> String {
    "MP align updated \(updatedCount) record(s) and produced \(decision.rawValue) for \(memoryID)."
  }

  /// Returns the stable resolve summary for one MP retrieval bundle.
  ///
  /// - Parameters:
  ///   - primaryCount: Primary bundle member count.
  ///   - supportingCount: Supporting bundle member count.
  ///   - query: Query string.
  /// - Returns: One stable resolve summary string.
  public func resolveSummary(
    primaryCount: Int,
    supportingCount: Int,
    query: String
  ) -> String {
    "MP resolve assembled \(primaryCount) primary and \(supportingCount) supporting memory record(s) for query \(query)."
  }

  /// Returns the stable history summary for one MP history bundle.
  ///
  /// - Parameters:
  ///   - primaryCount: Primary bundle member count.
  ///   - supportingCount: Supporting bundle member count.
  ///   - requesterAgentID: Requesting agent identifier.
  /// - Returns: One stable history summary string.
  public func historySummary(
    primaryCount: Int,
    supportingCount: Int,
    requesterAgentID: String
  ) -> String {
    "MP history returned \(primaryCount) primary and \(supportingCount) supporting memory record(s) for \(requesterAgentID)."
  }

  /// Returns the stable promotion summary for one MP promotion mutation.
  ///
  /// - Parameters:
  ///   - memoryID: Target memory identifier.
  ///   - promotionState: Updated promotion state.
  ///   - visibilityState: Updated visibility state.
  /// - Returns: One stable promotion summary string.
  public func promoteSummary(
    memoryID: String,
    promotionState: PraxisMpPromotionState,
    visibilityState: PraxisMpVisibilityState
  ) -> String {
    "MP promotion moved \(memoryID) to \(promotionState.rawValue) with \(visibilityState.rawValue) visibility."
  }

  /// Returns the stable archive summary for one MP archive mutation.
  ///
  /// - Parameter memoryID: Target memory identifier.
  /// - Returns: One stable archive summary string.
  public func archiveSummary(memoryID: String) -> String {
    "MP archive marked \(memoryID) archived while preserving persisted memory truth."
  }
}
