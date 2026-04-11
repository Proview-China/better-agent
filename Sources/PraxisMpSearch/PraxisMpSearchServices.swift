import Foundation
import PraxisMpTypes

public struct PraxisMpSearchPlanningService: Sendable {
  public init() {}

  public func makePlan(
    projectID: String,
    query: String,
    scopeLevels: [PraxisMpScopeLevel],
    limit: Int,
    agentID: String? = nil,
    sessionID: String? = nil,
    includeSuperseded: Bool = false
  ) -> PraxisMpSearchPlan {
    let normalizedProjectID = projectID.trimmingCharacters(in: .whitespacesAndNewlines)
    precondition(!normalizedProjectID.isEmpty, "MP search projectID must not be empty.")

    let requestedScopes = scopeLevels.isEmpty
      ? PraxisMpScopeLevel.allCases
      : Array(Set(scopeLevels)).sorted { $0.rawValue < $1.rawValue }
    let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedLimit = min(max(limit, 1), 50)

    return PraxisMpSearchPlan(
      projectID: normalizedProjectID,
      query: normalizedQuery,
      scopeLevels: requestedScopes,
      limit: normalizedLimit,
      agentID: agentID?.trimmingCharacters(in: .whitespacesAndNewlines),
      sessionID: sessionID?.trimmingCharacters(in: .whitespacesAndNewlines),
      includeSuperseded: includeSuperseded
    )
  }
}

public struct PraxisMpSearchRankingService: Sendable {
  public init() {}

  public func rank(
    records: [PraxisMpMemoryRecord],
    semanticScoresByStorageKey: [String: Double],
    plan: PraxisMpSearchPlan
  ) -> [PraxisMpSearchHit] {
    let filtered = records.filter { record in
      guard plan.scopeLevels.contains(record.scope.scopeLevel) else {
        return false
      }
      if let agentID = plan.agentID, record.scope.agentID != agentID {
        return false
      }
      if let sessionID = plan.sessionID, record.scope.sessionID != sessionID {
        return false
      }
      if !plan.includeSuperseded, record.freshness.status == .superseded {
        return false
      }
      return true
    }

    return filtered
      .map { record in
        let semanticScore = semanticScoresByStorageKey[record.storageKey]
        let lexicalBoost = lexicalQueryBoost(query: plan.query, summary: record.summary)
        let finalScore =
          (semanticScore ?? 0) * 10
          + freshnessWeight(record.freshness.status)
          + alignmentWeight(record.alignment.status)
          + scopeWeight(record.scope.scopeLevel)
          + lexicalBoost
        return PraxisMpSearchHit(
          memory: record,
          semanticScore: semanticScore,
          finalScore: finalScore,
          rankExplanation: rankExplanation(
            for: record,
            semanticScore: semanticScore,
            lexicalBoost: lexicalBoost
          )
        )
      }
      .sorted { left, right in
        if left.finalScore != right.finalScore {
          return left.finalScore > right.finalScore
        }
        if left.memory.updatedAt != right.memory.updatedAt {
          return (left.memory.updatedAt ?? "") > (right.memory.updatedAt ?? "")
        }
        return left.memory.id < right.memory.id
      }
      .prefix(plan.limit)
      .map { $0 }
  }

  private func freshnessWeight(_ status: PraxisMpMemoryFreshnessStatus) -> Double {
    switch status {
    case .fresh:
      return 30
    case .aging:
      return 20
    case .stale:
      return 8
    case .superseded:
      return -20
    }
  }

  private func alignmentWeight(_ status: PraxisMpMemoryAlignmentStatus) -> Double {
    switch status {
    case .aligned:
      return 10
    case .unreviewed:
      return 4
    case .drifted:
      return -3
    }
  }

  private func scopeWeight(_ scopeLevel: PraxisMpScopeLevel) -> Double {
    switch scopeLevel {
    case .agentIsolated:
      return 3
    case .project:
      return 2
    case .global:
      return 1
    }
  }

  private func lexicalQueryBoost(query: String, summary: String) -> Double {
    guard !query.isEmpty else {
      return 0
    }
    return summary.localizedCaseInsensitiveContains(query) ? 5 : 0
  }

  private func rankExplanation(
    for record: PraxisMpMemoryRecord,
    semanticScore: Double?,
    lexicalBoost: Double
  ) -> String {
    var factors: [String] = [
      "freshness=\(record.freshness.status.rawValue)",
      "alignment=\(record.alignment.status.rawValue)",
      "scope=\(record.scope.scopeLevel.rawValue)",
    ]
    if let semanticScore {
      factors.append("semantic=\(String(format: "%.2f", semanticScore))")
    }
    if lexicalBoost > 0 {
      factors.append("query-match")
    }
    return factors.joined(separator: ", ")
  }
}

public struct PraxisMpSearchProjectionService: Sendable {
  public init() {}

  /// Projects ranked search hits into a stable read model for outer host layers.
  ///
  /// - Parameters:
  ///   - hits: Ranked MP search hits.
  ///   - candidateCount: Total candidate memory count before ranking truncation.
  ///   - plan: Search plan used for the current lookup.
  /// - Returns: One projected search payload containing summary and stable hit fields.
  public func project(
    hits: [PraxisMpSearchHit],
    candidateCount: Int,
    plan: PraxisMpSearchPlan
  ) -> PraxisMpSearchProjection {
    PraxisMpSearchProjection(
      summary: "MP search ranked \(hits.count) hit(s) from \(candidateCount) candidate memory record(s) across \(plan.scopeLevels.count) scope level(s).",
      hits: hits.map {
        PraxisMpSearchProjectionHit(
          memoryID: $0.memory.id,
          agentID: $0.memory.scope.agentID,
          scopeLevel: $0.memory.scope.scopeLevel,
          memoryKind: $0.memory.memoryKind,
          freshnessStatus: $0.memory.freshness.status,
          alignmentStatus: $0.memory.alignment.status,
          summary: $0.memory.summary,
          storageKey: $0.memory.storageKey,
          semanticScore: $0.semanticScore,
          finalScore: $0.finalScore,
          rankExplanation: $0.rankExplanation
        )
      }
    )
  }
}
