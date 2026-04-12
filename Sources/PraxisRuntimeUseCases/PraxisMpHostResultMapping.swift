import PraxisCoreTypes
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes

/// Maps MP domain projections into host-neutral use-case result DTOs.
///
/// This mapper keeps the final DTO flattening step out of MP use cases without
/// pulling ranking or projection rules back into HostRuntime.
public struct PraxisMpHostResultMappingService: Sendable {
  public init() {}

  /// Builds one search result DTO from the projected MP search read model.
  ///
  /// - Parameters:
  ///   - projectID: Project identifier for the result.
  ///   - query: Query string for the result.
  ///   - projection: Projected MP search read model.
  ///   - issues: Stable host-side issues collected during retrieval.
  /// - Returns: One flattened host-neutral search result.
  public func searchResult(
    projectID: String,
    query: String,
    projection: PraxisMpSearchProjection,
    issues: [String]
  ) -> PraxisMpSearchResult {
    PraxisMpSearchResult(
      projectID: projectID,
      query: query,
      summary: projection.summary,
      hits: projection.hits.map(searchHitRecord),
      issues: issues
    )
  }

  /// Builds one flattened search hit DTO from one MP search projection hit.
  ///
  /// - Parameter hit: Projected hit from MP domain search services.
  /// - Returns: One host-neutral search hit DTO.
  public func searchHitRecord(_ hit: PraxisMpSearchProjectionHit) -> PraxisMpSearchHitRecord {
    PraxisMpSearchHitRecord(
      memoryID: hit.memoryID,
      agentID: hit.agentID,
      scopeLevel: hit.scopeLevel,
      memoryKind: hit.memoryKind,
      freshnessStatus: hit.freshnessStatus,
      alignmentStatus: hit.alignmentStatus,
      summary: hit.summary,
      storageKey: hit.storageKey,
      semanticScore: hit.semanticScore,
      finalScore: hit.finalScore,
      rankExplanation: hit.rankExplanation
    )
  }

  /// Builds one readback result DTO from the projected MP readback model.
  ///
  /// - Parameters:
  ///   - projectID: Project identifier for the result.
  ///   - projection: Projected MP readback model.
  ///   - issues: Stable host-side issues collected during retrieval.
  /// - Returns: One flattened host-neutral readback result.
  public func readbackResult(
    projectID: String,
    projection: PraxisMpReadbackProjection,
    issues: [String]
  ) throws -> PraxisMpReadback {
    PraxisMpReadback(
      projectID: projectID,
      summary: projection.summary,
      totalMemoryCount: projection.totalMemoryCount,
      primaryCount: projection.primaryCount,
      supportingCount: projection.supportingCount,
      omittedSupersededCount: projection.omittedSupersededCount,
      freshnessBreakdown: try typedBreakdownMap(
        from: projection.freshnessBreakdown,
        label: "freshnessBreakdown",
        keyType: PraxisMpMemoryFreshnessStatus.self
      ),
      alignmentBreakdown: try typedBreakdownMap(
        from: projection.alignmentBreakdown,
        label: "alignmentBreakdown",
        keyType: PraxisMpMemoryAlignmentStatus.self
      ),
      scopeBreakdown: try typedBreakdownMap(
        from: projection.scopeBreakdown,
        label: "scopeBreakdown",
        keyType: PraxisMpScopeLevel.self
      ),
      issues: issues
    )
  }

  private func typedBreakdownMap<Key>(
    from rawCounts: [String: Int],
    label: String,
    keyType: Key.Type
  ) throws -> PraxisMpTypedCountMap<Key>
  where Key: Hashable & RawRepresentable & Sendable, Key.RawValue == String {
    var typedCounts: [Key: Int] = [:]
    for (rawKey, count) in rawCounts {
      guard let key = Key(rawValue: rawKey) else {
        throw PraxisError.invariantViolation(
          "MP readback projection produced invalid \(label) key \(rawKey)."
        )
      }
      typedCounts[key] = count
    }
    return PraxisMpTypedCountMap(counts: typedCounts)
  }
}
