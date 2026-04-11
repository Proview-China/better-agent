import Foundation
import PraxisCoreTypes
import PraxisMpTypes

private extension PraxisMpMemoryRecord {
  var recencyAnchor: String {
    updatedAt ?? createdAt ?? ""
  }

  var normalizedSummaryKey: String {
    summary.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  func updating(
    scope: PraxisMpScopeDescriptor? = nil,
    freshnessStatus: PraxisMpMemoryFreshnessStatus? = nil,
    freshnessReason: String? = nil,
    alignmentStatus: PraxisMpMemoryAlignmentStatus? = nil,
    alignmentReason: String? = nil,
    alignedAt: String? = nil,
    updatedAt: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) -> PraxisMpMemoryRecord {
    PraxisMpMemoryRecord(
      id: id,
      scope: scope ?? self.scope,
      summary: summary,
      storageKey: storageKey,
      memoryKind: memoryKind,
      freshness: .init(
        status: freshnessStatus ?? freshness.status,
        reason: freshnessReason ?? freshness.reason
      ),
      confidence: confidence,
      alignment: .init(
        status: alignmentStatus ?? alignment.status,
        lastAlignedAt: alignedAt ?? alignment.lastAlignedAt,
        reason: alignmentReason ?? alignment.reason
      ),
      sourceRefs: sourceRefs,
      tags: tags,
      semanticGroupID: semanticGroupID,
      embedding: embedding,
      ancestry: ancestry,
      createdAt: createdAt,
      updatedAt: updatedAt ?? self.updatedAt,
      metadata: metadata ?? self.metadata
    )
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}

private func splitSourceRefs(_ sourceRefs: [String], parts: Int) -> [[String]] {
  let normalizedRefs = sourceRefs.isEmpty ? ["source:unavailable"] : sourceRefs
  var result: [[String]] = Array(repeating: [], count: parts)
  for (index, sourceRef) in normalizedRefs.enumerated() {
    result[index % parts].append(sourceRef)
  }
  for index in result.indices where result[index].isEmpty {
    result[index].append(normalizedRefs[index % normalizedRefs.count])
  }
  return result
}

public final class PraxisMpMemoryAlignmentService: Sendable {
  public init() {}

  /// Aligns one candidate memory against related records and emits supersede or stale decisions.
  ///
  /// - Parameters:
  ///   - candidate: The candidate memory to judge.
  ///   - relatedRecords: Comparable records already known to the workflow.
  ///   - alignedAt: Timestamp to stamp onto alignment updates.
  /// - Returns: The aligned primary record plus all updated records.
  public func align(
    candidate: PraxisMpMemoryRecord,
    relatedRecords: [PraxisMpMemoryRecord],
    alignedAt: String
  ) -> PraxisMpAlignmentResult {
    let comparableRecords = relatedRecords.filter {
      $0.id != candidate.id && isRelated($0, to: candidate)
    }

    let freshestExisting = comparableRecords.max { left, right in
      left.recencyAnchor < right.recencyAnchor
    }

    if let freshestExisting, freshestExisting.recencyAnchor > candidate.recencyAnchor {
      let staleCandidate = candidate.updating(
        freshnessStatus: .stale,
        freshnessReason: "A fresher related memory already exists.",
        alignmentStatus: .aligned,
        alignmentReason: "Marked stale during checker alignment.",
        alignedAt: alignedAt,
        updatedAt: alignedAt
      )
      return PraxisMpAlignmentResult(
        primary: freshestExisting,
        updatedRecords: [freshestExisting, staleCandidate],
        supersededMemoryIDs: [],
        staleMemoryIDs: [staleCandidate.id],
        decisionOutput: .init(
          decision: .staleCandidate,
          confidence: candidate.confidence,
          freshnessStatus: .stale,
          supersededMemoryIDs: [],
          staleMemoryIDs: [staleCandidate.id],
          reason: "Candidate is older than the freshest related memory."
        )
      )
    }

    let supersededRecords = comparableRecords
      .filter { $0.recencyAnchor < candidate.recencyAnchor && $0.freshness.status != .superseded }
      .map {
        $0.updating(
          freshnessStatus: .superseded,
          freshnessReason: "Superseded by \(candidate.id).",
          alignmentStatus: .aligned,
          alignmentReason: "Supersede relation confirmed during checker alignment.",
          alignedAt: alignedAt,
          updatedAt: alignedAt
        )
      }

    let alignedCandidate = candidate.updating(
      freshnessStatus: supersededRecords.isEmpty ? candidate.freshness.status : .fresh,
      freshnessReason: candidate.freshness.reason,
      alignmentStatus: .aligned,
      alignmentReason: supersededRecords.isEmpty
        ? "Candidate accepted as current memory truth."
        : "Candidate superseded older related memories.",
      alignedAt: alignedAt,
      updatedAt: alignedAt
    )

    let decision: PraxisMpAlignmentDecision = supersededRecords.isEmpty ? .keep : .supersedeExisting
    let reason: String = supersededRecords.isEmpty
      ? "Candidate was kept as current memory truth."
      : "Candidate superseded \(supersededRecords.count) older related memory record(s)."
    return PraxisMpAlignmentResult(
      primary: alignedCandidate,
      updatedRecords: supersededRecords + [alignedCandidate],
      supersededMemoryIDs: supersededRecords.map(\.id),
      staleMemoryIDs: [],
      decisionOutput: .init(
        decision: decision,
        confidence: candidate.confidence,
        freshnessStatus: alignedCandidate.freshness.status,
        supersededMemoryIDs: supersededRecords.map(\.id),
        staleMemoryIDs: [],
        reason: reason
      )
    )
  }

  private func isRelated(_ record: PraxisMpMemoryRecord, to candidate: PraxisMpMemoryRecord) -> Bool {
    if let semanticGroupID = candidate.semanticGroupID, semanticGroupID == record.semanticGroupID {
      return true
    }
    return candidate.normalizedSummaryKey == record.normalizedSummaryKey
  }
}

public final class PraxisMpWorkflowBundleService: Sendable {
  public init() {}

  /// Builds one workflow bundle from an already ordered memory list.
  ///
  /// - Parameters:
  ///   - scope: Scope descriptor for the requesting workflow lane.
  ///   - orderedRecords: Records already filtered and ranked for retrieval.
  ///   - limit: Maximum number of visible records to return.
  /// - Returns: One workflow bundle containing primary/supporting slices and diagnostics.
  public func assemble(
    scope: PraxisMpScopeDescriptor,
    orderedRecords: [PraxisMpMemoryRecord],
    limit: Int = 5,
    omittedSupersededMemoryIDs: [String]? = nil
  ) -> PraxisMpWorkflowBundle {
    let boundedLimit = max(1, limit)
    let visibleRecords = Array(
      orderedRecords.filter { $0.freshness.status != .superseded }.prefix(boundedLimit)
    )
    let primary = Array(visibleRecords.prefix(1))
    let supporting = Array(visibleRecords.dropFirst())
    let diagnosticOmittedSupersededMemoryIDs = omittedSupersededMemoryIDs
      ?? orderedRecords
        .filter { $0.freshness.status == .superseded }
        .map(\.id)

    return PraxisMpWorkflowBundle(
      scope: scope,
      primary: primary,
      supporting: supporting,
      diagnostics: .init(
        omittedSupersededMemoryIDs: diagnosticOmittedSupersededMemoryIDs,
        rerankComposition: rerankComposition(for: orderedRecords)
      )
    )
  }

  public func rerankComposition(for records: [PraxisMpMemoryRecord]) -> PraxisMpRerankComposition {
    PraxisMpRerankComposition(
      fresh: records.filter { $0.freshness.status == .fresh }.count,
      aging: records.filter { $0.freshness.status == .aging }.count,
      stale: records.filter { $0.freshness.status == .stale }.count,
      superseded: records.filter { $0.freshness.status == .superseded }.count,
      aligned: records.filter { $0.alignment.status == .aligned }.count,
      unreviewed: records.filter { $0.alignment.status == .unreviewed }.count,
      drifted: records.filter { $0.alignment.status == .drifted }.count
    )
  }
}

public final class PraxisMpMemoryMaintenanceService: Sendable {
  public init() {}

  /// Splits one source memory into multiple derived child memories while preserving ancestry.
  ///
  /// - Parameters:
  ///   - sourceRecord: The source memory record to split.
  ///   - split: Split policy describing the target chunk count and timestamps.
  /// - Returns: Derived split records plus a stable split result summary.
  /// - Throws: Propagates validation failures such as invalid chunk counts or mismatched source identifiers.
  public func split(
    sourceRecord: PraxisMpMemoryRecord,
    split: PraxisMpSplitMemoryInput
  ) throws -> (records: [PraxisMpMemoryRecord], result: PraxisMpSplitMemoryResult) {
    guard split.sourceMemoryID == sourceRecord.id else {
      throw PraxisError.invalidInput("MP split sourceMemoryID must match the provided source record.")
    }
    guard split.sourceAgentID == sourceRecord.scope.agentID else {
      throw PraxisError.invalidInput("MP split sourceAgentID must match the provided source record.")
    }
    guard split.targetChunkCount >= 2 else {
      throw PraxisError.invalidInput("MP split targetChunkCount must be >= 2.")
    }

    let sourceRefGroups = splitSourceRefs(sourceRecord.sourceRefs, parts: split.targetChunkCount)
    let derivedRecords = sourceRefGroups.enumerated().map { index, sourceRefs in
      let derivedID = "\(sourceRecord.id):split:\(index)"
      let summary = "\(sourceRecord.summary) [split \(index + 1)/\(split.targetChunkCount)]"
      let metadata = splitMetadata(
        sourceRecord: sourceRecord,
        split: split,
        chunkIndex: index,
        totalChunks: split.targetChunkCount
      )
      let ancestry = PraxisMpChunkAncestry(
        parentMemoryID: sourceRecord.id,
        derivedFromIDs: [sourceRecord.id],
        splitFromIDs: [sourceRecord.id],
        mergedFromIDs: sourceRecord.ancestry?.mergedFromIDs ?? []
      )
      return PraxisMpMemoryRecord(
        id: derivedID,
        scope: sourceRecord.scope,
        summary: summary,
        storageKey: "\(sourceRecord.storageKey)#chunk-\(index)",
        memoryKind: sourceRecord.memoryKind,
        freshness: sourceRecord.freshness,
        confidence: sourceRecord.confidence,
        alignment: sourceRecord.alignment,
        sourceRefs: sourceRefs,
        tags: sourceRecord.tags,
        semanticGroupID: sourceRecord.semanticGroupID,
        embedding: nil,
        ancestry: ancestry,
        createdAt: split.createdAt,
        updatedAt: split.createdAt,
        metadata: metadata
      )
    }

    return (
      records: derivedRecords,
      result: PraxisMpSplitMemoryResult(
        sourceMemoryID: sourceRecord.id,
        derivedMemoryIDs: derivedRecords.map(\.id),
        createdAt: split.createdAt,
        metadata: split.metadata
      )
    )
  }

  /// Merges sibling memories into one derived memory record and bundle without archiving sources.
  ///
  /// - Parameters:
  ///   - sourceRecords: Source memories to merge.
  ///   - merge: Merge policy describing the target memory identity and timestamps.
  /// - Returns: One merged memory record, its semantic bundle, and a stable merge result summary.
  /// - Throws: Propagates validation failures such as insufficient source memories or mismatched metadata.
  public func merge(
    sourceRecords: [PraxisMpMemoryRecord],
    merge: PraxisMpMergeMemoriesInput
  ) throws -> (record: PraxisMpMemoryRecord, bundle: PraxisMpSemanticBundle, result: PraxisMpMergeMemoriesResult) {
    guard sourceRecords.count >= 2 else {
      throw PraxisError.invalidInput("MP merge requires at least two source records.")
    }

    let normalizedSourceIDs = Array(Set(sourceRecords.map(\.id))).sorted()
    guard normalizedSourceIDs == Array(Set(merge.sourceMemoryIDs)).sorted() else {
      throw PraxisError.invalidInput("MP merge sourceMemoryIDs must match the provided source records.")
    }

    guard let anchorRecord = sourceRecords.first else {
      throw PraxisError.invalidInput("MP merge requires a non-empty source record list.")
    }
    let uniqueProjectIDs = Set(sourceRecords.map { $0.scope.projectID })
    guard uniqueProjectIDs.count == 1,
          sourceRecords.dropFirst().allSatisfy({ $0.scope == anchorRecord.scope }) else {
      throw PraxisError.invalidInput("MP merge currently requires all source records to share one identical scope.")
    }
    guard sourceRecords.allSatisfy({ $0.scope.agentID == merge.targetAgentID }) else {
      throw PraxisError.invalidInput("MP merge targetAgentID must match all source records in the current local baseline.")
    }

    let mergedRecord = PraxisMpMemoryRecord(
      id: merge.mergedMemoryID,
      scope: anchorRecord.scope,
      summary: mergedSummary(sourceRecords: sourceRecords),
      storageKey: "bundle:\(merge.mergedMemoryID)",
      memoryKind: anchorRecord.memoryKind,
      freshness: anchorRecord.freshness,
      confidence: highestConfidence(in: sourceRecords),
      alignment: anchorRecord.alignment,
      sourceRefs: Array(Set(sourceRecords.flatMap(\.sourceRefs))).sorted(),
      tags: Array(Set(sourceRecords.flatMap(\.tags))).sorted(),
      semanticGroupID: anchorRecord.semanticGroupID ?? merge.mergedMemoryID,
      embedding: nil,
      ancestry: PraxisMpChunkAncestry(
        parentMemoryID: anchorRecord.id,
        derivedFromIDs: normalizedSourceIDs,
        splitFromIDs: Array(Set(sourceRecords.flatMap { $0.ancestry?.splitFromIDs ?? [] })).sorted(),
        mergedFromIDs: normalizedSourceIDs
      ),
      createdAt: merge.createdAt,
      updatedAt: merge.createdAt,
      metadata: mergeMetadata(sourceRecords: sourceRecords, merge: merge)
    )
    let bundle = PraxisMpSemanticBundle(
      bundleID: "bundle:\(merge.mergedMemoryID)",
      projectID: anchorRecord.scope.projectID,
      agentID: merge.targetAgentID,
      scope: anchorRecord.scope,
      memberMemoryIDs: normalizedSourceIDs,
      semanticGroupID: mergedRecord.semanticGroupID ?? mergedRecord.id,
      createdAt: merge.createdAt,
      updatedAt: merge.createdAt,
      metadata: merge.metadata
    )
    return (
      record: mergedRecord,
      bundle: bundle,
      result: PraxisMpMergeMemoriesResult(
        mergedMemoryID: merge.mergedMemoryID,
        sourceMemoryIDs: normalizedSourceIDs,
        createdAt: merge.createdAt,
        metadata: merge.metadata
      )
    )
  }

  private func splitMetadata(
    sourceRecord: PraxisMpMemoryRecord,
    split: PraxisMpSplitMemoryInput,
    chunkIndex: Int,
    totalChunks: Int
  ) -> [String: PraxisValue] {
    sourceRecord.metadata
      .merging(split.metadata, uniquingKeysWith: { _, new in new })
      .merging([
        "splitReason": .string(split.splitReason),
        "splitCreatedAt": .string(split.createdAt),
        "splitChunkIndex": .number(Double(chunkIndex)),
        "splitChunkCount": .number(Double(totalChunks)),
      ], uniquingKeysWith: { _, new in new })
  }

  private func mergeMetadata(
    sourceRecords: [PraxisMpMemoryRecord],
    merge: PraxisMpMergeMemoriesInput
  ) -> [String: PraxisValue] {
    (sourceRecords.first?.metadata ?? [:])
      .merging(merge.metadata, uniquingKeysWith: { _, new in new })
      .merging([
        "mergeReason": .string(merge.mergeReason),
        "mergeCreatedAt": .string(merge.createdAt),
      ], uniquingKeysWith: { _, new in new })
  }

  private func mergedSummary(sourceRecords: [PraxisMpMemoryRecord]) -> String {
    sourceRecords.map(\.summary).joined(separator: " | ")
  }

  private func highestConfidence(in records: [PraxisMpMemoryRecord]) -> PraxisMpMemoryConfidenceLevel {
    if records.contains(where: { $0.confidence == .high }) {
      return .high
    }
    if records.contains(where: { $0.confidence == .medium }) {
      return .medium
    }
    return .low
  }
}

public final class PraxisMpMemoryGovernanceService: Sendable {
  public init() {}

  /// Promotes one memory record by advancing its governance state and remapping scope visibility.
  ///
  /// - Parameters:
  ///   - record: The current memory truth to mutate.
  ///   - targetPromotionState: The requested target promotion state.
  ///   - targetSessionID: Optional bridged session identifier for parent-submitted states.
  ///   - changedAt: Stable timestamp for the governance mutation.
  ///   - reason: Optional human-readable explanation for the mutation.
  /// - Returns: An updated memory record carrying the new scope/governance truth.
  /// - Throws: Propagates invalid promotion-state or scope transitions.
  public func promote(
    record: PraxisMpMemoryRecord,
    targetPromotionState: PraxisMpPromotionState,
    targetSessionID: String? = nil,
    changedAt: String,
    reason: String? = nil
  ) throws -> PraxisMpMemoryRecord {
    try PraxisMpScopeDescriptor.assertPromotionTransition(
      from: record.scope.promotionState,
      to: targetPromotionState
    )
    let targetScope = try promotedScope(
      from: record.scope,
      targetPromotionState: targetPromotionState,
      targetSessionID: targetSessionID
    )
    return record.updating(
      scope: targetScope,
      updatedAt: changedAt,
      metadata: governanceMetadata(
        for: record,
        targetPromotionState: targetPromotionState,
        changedAt: changedAt,
        reason: reason
      )
    )
  }

  /// Archives one memory record without removing its underlying persisted truth.
  ///
  /// - Parameters:
  ///   - record: The current memory truth to archive.
  ///   - archivedAt: Stable timestamp for the archive mutation.
  ///   - reason: Optional human-readable explanation for the archive.
  /// - Returns: An updated memory record marked archived.
  /// - Throws: Propagates invalid promotion-state transitions.
  public func archive(
    record: PraxisMpMemoryRecord,
    archivedAt: String,
    reason: String? = nil
  ) throws -> PraxisMpMemoryRecord {
    try promote(
      record: record,
      targetPromotionState: .archived,
      changedAt: archivedAt,
      reason: reason
    )
  }

  private func promotedScope(
    from scope: PraxisMpScopeDescriptor,
    targetPromotionState: PraxisMpPromotionState,
    targetSessionID: String?
  ) throws -> PraxisMpScopeDescriptor {
    let bridgedSessionID = targetSessionID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ?? scope.sessionID

    switch targetPromotionState {
    case .localOnly:
      return .init(
        projectID: scope.projectID,
        agentID: scope.agentID,
        scopeLevel: .agentIsolated,
        sessionMode: .isolated,
        visibilityState: .localOnly,
        promotionState: .localOnly,
        lineagePath: scope.lineagePath,
        metadata: scope.metadata
      )
    case .submittedToParent, .acceptedByParent:
      guard let sessionID = bridgedSessionID else {
        throw PraxisError.invalidInput("MP promotion to \(targetPromotionState.rawValue) requires a sessionID.")
      }
      return .init(
        projectID: scope.projectID,
        agentID: scope.agentID,
        sessionID: sessionID,
        scopeLevel: .agentIsolated,
        sessionMode: .bridged,
        visibilityState: .sessionBridged,
        promotionState: targetPromotionState,
        lineagePath: scope.lineagePath,
        metadata: scope.metadata
      )
    case .promotedToProject:
      return .init(
        projectID: scope.projectID,
        agentID: scope.agentID,
        scopeLevel: .project,
        sessionMode: .shared,
        visibilityState: .projectShared,
        promotionState: .promotedToProject,
        lineagePath: scope.lineagePath,
        metadata: scope.metadata
      )
    case .promotedToGlobal:
      return .init(
        projectID: scope.projectID,
        agentID: scope.agentID,
        scopeLevel: .global,
        sessionMode: .shared,
        visibilityState: .globalShared,
        promotionState: .promotedToGlobal,
        lineagePath: scope.lineagePath,
        metadata: scope.metadata
      )
    case .archived:
      return .init(
        projectID: scope.projectID,
        agentID: scope.agentID,
        sessionID: scope.sessionID,
        scopeLevel: scope.scopeLevel,
        sessionMode: scope.sessionMode,
        visibilityState: .archived,
        promotionState: .archived,
        lineagePath: scope.lineagePath,
        metadata: scope.metadata
      )
    }
  }

  private func governanceMetadata(
    for record: PraxisMpMemoryRecord,
    targetPromotionState: PraxisMpPromotionState,
    changedAt: String,
    reason: String?
  ) -> [String: PraxisValue] {
    let normalizedReason = reason?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    var metadata = record.metadata
    metadata["lastPromotionState"] = .string(record.scope.promotionState.rawValue)
    metadata["promotionUpdatedAt"] = .string(changedAt)
    metadata["promotionTargetState"] = .string(targetPromotionState.rawValue)
    if let normalizedReason {
      metadata["promotionReason"] = .string(normalizedReason)
    }
    return metadata
  }
}

public final class PraxisMpMemoryQualityService: Sendable {
  public init() {}

  /// Summarizes current memory quality using stale/supersede counts and rerank composition.
  ///
  /// - Parameters:
  ///   - records: Current known workflow records.
  ///   - dedupeDecisionCount: Number of checker decisions that performed dedupe-like judgement.
  ///   - ingestCount: Number of ingest attempts observed so far.
  /// - Returns: A stable quality summary snapshot.
  public func summarize(
    records: [PraxisMpMemoryRecord],
    dedupeDecisionCount: Int,
    ingestCount: Int
  ) -> PraxisMpMemoryQualitySummary {
    let bundleService = PraxisMpWorkflowBundleService()
    let dedupeRate = ingestCount > 0 ? Double(dedupeDecisionCount) / Double(ingestCount) : 0
    return PraxisMpMemoryQualitySummary(
      dedupeRate: dedupeRate,
      staleMemoryCount: records.filter { $0.freshness.status == .stale }.count,
      supersededMemoryCount: records.filter { $0.freshness.status == .superseded }.count,
      rerankComposition: bundleService.rerankComposition(for: records)
    )
  }
}

public final class PraxisMpReadbackProjectionService: Sendable {
  public init() {}

  /// Projects MP records into a stable readback summary with scope/freshness/alignment breakdowns.
  ///
  /// - Parameters:
  ///   - records: MP records reconstructed from host truth.
  ///   - primaryCount: Number of primary bundle members.
  ///   - supportingCount: Number of supporting bundle members.
  ///   - omittedSupersededCount: Number of omitted superseded records.
  /// - Returns: One projected readback payload for higher layers.
  public func project(
    records: [PraxisMpMemoryRecord],
    primaryCount: Int,
    supportingCount: Int,
    omittedSupersededCount: Int
  ) -> PraxisMpReadbackProjection {
    PraxisMpReadbackProjection(
      summary: "MP readback reconstructed \(records.count) memory record(s), \(primaryCount) primary bundle members, and \(omittedSupersededCount) omitted superseded record(s).",
      totalMemoryCount: records.count,
      primaryCount: primaryCount,
      supportingCount: supportingCount,
      omittedSupersededCount: omittedSupersededCount,
      freshnessBreakdown: Dictionary(records.map { ($0.freshness.status.rawValue, 1) }, uniquingKeysWith: +),
      alignmentBreakdown: Dictionary(records.map { ($0.alignment.status.rawValue, 1) }, uniquingKeysWith: +),
      scopeBreakdown: Dictionary(records.map { ($0.scope.scopeLevel.rawValue, 1) }, uniquingKeysWith: +)
    )
  }
}
