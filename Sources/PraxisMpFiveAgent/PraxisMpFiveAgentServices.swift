import PraxisCoreTypes
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes

private extension PraxisMpMemoryRecord {
  static func from(_ input: PraxisMpFiveAgentIngestInput) -> PraxisMpMemoryRecord {
    PraxisMpMemoryRecord(
      id: "memory.\(input.artifact.id)",
      scope: input.scope,
      summary: input.artifact.summary,
      storageKey: input.artifact.storageRef,
      memoryKind: input.memoryKind,
      freshness: .init(status: .fresh),
      confidence: input.confidence,
      alignment: .init(status: .unreviewed),
      sourceRefs: input.sourceRefs.isEmpty ? [input.artifact.storageRef] : input.sourceRefs,
      tags: input.artifact.tags,
      semanticGroupID: input.artifact.semanticGroupID,
      embedding: nil,
      ancestry: nil,
      createdAt: input.observedAt ?? input.artifact.persistedAt,
      updatedAt: input.observedAt ?? input.artifact.persistedAt,
      metadata: input.artifact.metadata
        .merging(input.metadata, uniquingKeysWith: { _, new in new })
        .merging([
          "checkedSnapshotRef": .string(input.checkedSnapshotRef),
          "branchRef": .string(input.branchRef),
          "artifactID": .string(input.artifact.id),
        ], uniquingKeysWith: { _, new in new })
    )
  }
}

public enum PraxisMpFiveAgentConfigurationService {
  public static let version = "mp-five-agent-role-catalog/v1"

  public static func defaultConfiguration() -> PraxisMpFiveAgentConfiguration {
    PraxisMpFiveAgentConfiguration(
      version: version,
      roles: [
        .icma: .init(
          role: .icma,
          promptPack: .init(
            role: .icma,
            promptPackID: "mp-five-agent/icma-prompt-pack/v1",
            lane: "ingress",
            systemPrompt: "Capture memory ingress without asserting final truth.",
            systemPurpose: "shape high-signal candidate memories from raw materials",
            mission: "Turn raw runtime materials into bounded memory candidates with stable source and time anchors.",
            guardrails: [
              "Never declare long-term truth.",
              "Always preserve source anchors.",
              "Always preserve observed time when available.",
            ],
            inputContract: ["stored artifact", "checked snapshot ref", "scope"],
            outputContract: ["candidate memory count", "source refs", "proposed memory kind"],
            handoffContract: "emit candidate memory metadata for iterator rewrite"
          ),
          profile: .init(
            role: .icma,
            profileID: "mp-five-agent/icma-profile/v1",
            displayName: "Memory Ingress Context Agent",
            missionLabel: "memory-ingress",
            responsibilities: [
              "Capture ingress materials into candidate memories.",
              "Preserve source anchors and observed time.",
              "Bound task-relevant memory fragments.",
            ],
            hardBoundaries: [
              "Cannot write final memory truth.",
              "Cannot judge supersede or staleness.",
            ],
            defaultStageOrder: PraxisMpIcmaStage.allCases.map(\.rawValue)
          ),
          capabilityContract: .init(
            role: .icma,
            contractID: "mp-five-agent/icma-capability-contract/v1",
            memory: .init(
              access: "draft_only",
              allowedOperations: ["memory.capture_candidate"],
              forbiddenOperations: ["memory.write_truth", "memory.archive"],
              rationale: "ICMA only prepares candidate memories."
            ),
            retrieval: .init(
              access: "read",
              allowedOperations: ["memory.read_context"],
              forbiddenOperations: ["memory.route_bundle"],
              rationale: "ICMA may inspect context but does not own retrieval."
            ),
            alignment: .init(
              access: "none",
              allowedOperations: [],
              forbiddenOperations: ["memory.align", "memory.supersede"],
              rationale: "ICMA never judges freshness or alignment."
            )
          )
        ),
        .iterator: .init(
          role: .iterator,
          promptPack: .init(
            role: .iterator,
            promptPackID: "mp-five-agent/iterator-prompt-pack/v1",
            lane: "rewrite",
            systemPrompt: "Rewrite candidate memories into retrieval-ready drafts without asserting final truth.",
            systemPurpose: "normalize candidate memories into stable drafts",
            mission: "Rewrite raw candidates into structured memory drafts that are easier to search and compare.",
            guardrails: [
              "Do not finalize truth.",
              "Preserve source refs and semantic group intent.",
            ],
            inputContract: ["candidate memory metadata"],
            outputContract: ["draft memory id", "normalized tags", "source refs"],
            handoffContract: "handoff retrieval-ready drafts to checker"
          ),
          profile: .init(
            role: .iterator,
            profileID: "mp-five-agent/iterator-profile/v1",
            displayName: "Memory Draft Iterator",
            missionLabel: "memory-rewrite",
            responsibilities: [
              "Rewrite candidates into stable drafts.",
              "Normalize tags and memory kind hints.",
            ],
            hardBoundaries: [
              "Cannot mark memories stale or superseded.",
              "Cannot write final truth.",
            ],
            defaultStageOrder: PraxisMpIteratorStage.allCases.map(\.rawValue)
          ),
          capabilityContract: .init(
            role: .iterator,
            contractID: "mp-five-agent/iterator-capability-contract/v1",
            memory: .init(
              access: "draft_only",
              allowedOperations: ["memory.rewrite_candidate"],
              forbiddenOperations: ["memory.write_truth", "memory.archive"],
              rationale: "Iterator only emits draft memories."
            ),
            retrieval: .init(
              access: "read",
              allowedOperations: ["memory.read_context"],
              forbiddenOperations: ["memory.route_bundle"],
              rationale: "Iterator can inspect context to improve drafts."
            ),
            alignment: .init(
              access: "none",
              allowedOperations: [],
              forbiddenOperations: ["memory.align", "memory.supersede"],
              rationale: "Iterator never judges alignment."
            )
          )
        ),
        .checker: .init(
          role: .checker,
          promptPack: .init(
            role: .checker,
            promptPackID: "mp-five-agent/checker-prompt-pack/v1",
            lane: "judgement",
            systemPrompt: "Judge freshness, staleness, dedupe, and supersede relations before truth changes.",
            systemPurpose: "raise signal-to-noise by memory judgement",
            mission: "Decide whether a candidate memory should stay fresh, become stale, or supersede older memories.",
            guardrails: [
              "Only checker may judge stale or superseded.",
              "Always emit explicit decision rationale.",
            ],
            inputContract: ["candidate memory draft", "similar memories"],
            outputContract: ["decision", "freshness status", "superseded ids", "stale ids"],
            handoffContract: "handoff explicit alignment decisions to dbagent"
          ),
          profile: .init(
            role: .checker,
            profileID: "mp-five-agent/checker-profile/v1",
            displayName: "Memory Quality Checker",
            missionLabel: "memory-judgement",
            responsibilities: [
              "Judge freshness and alignment.",
              "Detect dedupe and supersede relations.",
            ],
            hardBoundaries: [
              "Cannot route final retrieval bundle.",
              "Cannot write final truth directly.",
            ],
            defaultStageOrder: PraxisMpCheckerStage.allCases.map(\.rawValue)
          ),
          capabilityContract: .init(
            role: .checker,
            contractID: "mp-five-agent/checker-capability-contract/v1",
            memory: .init(
              access: "judge_only",
              allowedOperations: ["memory.inspect_candidate"],
              forbiddenOperations: ["memory.write_truth", "memory.archive"],
              rationale: "Checker emits judgement, not persistence."
            ),
            retrieval: .init(
              access: "read",
              allowedOperations: ["memory.read_context"],
              forbiddenOperations: ["memory.route_bundle"],
              rationale: "Checker compares candidate memories with nearby records."
            ),
            alignment: .init(
              access: "judge_only",
              allowedOperations: ["memory.align", "memory.supersede", "memory.mark_stale"],
              forbiddenOperations: [],
              rationale: "Checker owns freshness and alignment judgement."
            )
          )
        ),
        .dbagent: .init(
          role: .dbagent,
          promptPack: .init(
            role: .dbagent,
            promptPackID: "mp-five-agent/dbagent-prompt-pack/v1",
            lane: "truth_write",
            systemPrompt: "Persist aligned memory truth and keep lineage coherent.",
            systemPurpose: "apply alignment and persistence truth",
            mission: "Apply checker decisions, persist freshness and alignment metadata, and keep lineage coherent.",
            guardrails: [
              "Only apply explicit checker decisions.",
              "Do not rerank retrieval bundles.",
            ],
            inputContract: ["alignment decision", "candidate memory", "related memories"],
            outputContract: ["materialized ids", "updated ids", "archived ids"],
            handoffContract: "persist aligned truth for dispatcher retrieval"
          ),
          profile: .init(
            role: .dbagent,
            profileID: "mp-five-agent/dbagent-profile/v1",
            displayName: "Memory Truth Writer",
            missionLabel: "memory-truth-write",
            responsibilities: [
              "Persist alignment and freshness metadata together.",
              "Apply supersede relations to memory truth.",
            ],
            hardBoundaries: [
              "Cannot judge alignment itself.",
              "Cannot own final retrieval bundle.",
            ],
            defaultStageOrder: PraxisMpDbAgentStage.allCases.map(\.rawValue)
          ),
          capabilityContract: .init(
            role: .dbagent,
            contractID: "mp-five-agent/dbagent-capability-contract/v1",
            memory: .init(
              access: "primary_write",
              allowedOperations: ["memory.write_truth", "memory.archive"],
              forbiddenOperations: ["memory.route_bundle"],
              rationale: "Dbagent owns truth writes."
            ),
            retrieval: .init(
              access: "read",
              allowedOperations: ["memory.read_context"],
              forbiddenOperations: ["memory.route_bundle"],
              rationale: "Dbagent inspects context only to apply writes safely."
            ),
            alignment: .init(
              access: "write",
              allowedOperations: ["memory.apply_alignment"],
              forbiddenOperations: ["memory.judge_alignment"],
              rationale: "Dbagent applies checker decisions but does not judge them."
            )
          )
        ),
        .dispatcher: .init(
          role: .dispatcher,
          promptPack: .init(
            role: .dispatcher,
            promptPackID: "mp-five-agent/dispatcher-prompt-pack/v1",
            lane: "retrieval",
            systemPrompt: "Return high-signal bundles that prefer fresh, aligned, non-superseded memory.",
            systemPurpose: "assemble retrieval bundles",
            mission: "Search, rerank, and assemble workflow bundles for resolve and history requests.",
            guardrails: [
              "Prefer fresh and aligned memory.",
              "Never alter alignment truth while routing bundles.",
            ],
            inputContract: ["query", "requester lineage", "scope preferences"],
            outputContract: ["primary ids", "supporting ids", "rerank composition"],
            handoffContract: "return one workflow bundle to the caller"
          ),
          profile: .init(
            role: .dispatcher,
            profileID: "mp-five-agent/dispatcher-profile/v1",
            displayName: "Memory Dispatcher",
            missionLabel: "memory-retrieval",
            responsibilities: [
              "Search and rerank memories.",
              "Assemble workflow bundles for resolve and history.",
            ],
            hardBoundaries: [
              "Cannot judge alignment.",
              "Cannot write memory truth.",
            ],
            defaultStageOrder: PraxisMpDispatcherStage.allCases.map(\.rawValue)
          ),
          capabilityContract: .init(
            role: .dispatcher,
            contractID: "mp-five-agent/dispatcher-capability-contract/v1",
            memory: .init(
              access: "read",
              allowedOperations: ["memory.read_truth"],
              forbiddenOperations: ["memory.write_truth", "memory.archive"],
              rationale: "Dispatcher only reads memory truth."
            ),
            retrieval: .init(
              access: "route_only",
              allowedOperations: ["memory.search", "memory.bundle"],
              forbiddenOperations: [],
              rationale: "Dispatcher owns retrieval and bundle assembly."
            ),
            alignment: .init(
              access: "read",
              allowedOperations: ["memory.inspect_alignment"],
              forbiddenOperations: ["memory.judge_alignment", "memory.apply_alignment"],
              rationale: "Dispatcher consumes alignment state but does not alter it."
            )
          )
        ),
      ]
    )
  }

  public static func capabilityMatrixSummary() -> PraxisMpFiveAgentCapabilityMatrixSummary {
    PraxisMpFiveAgentCapabilityMatrixSummary(
      ingressOwners: [.icma],
      rewriteOwners: [.iterator],
      alignmentJudges: [.checker],
      memoryWriters: [.dbagent],
      retrievalOwners: [.dispatcher]
    )
  }

  public static func configuredRoleCatalog(
    configuration: PraxisMpFiveAgentConfiguration
  ) -> [PraxisMpFiveAgentRole: PraxisMpFiveAgentRoleCatalogEntry] {
    Dictionary(uniqueKeysWithValues: configuration.roles.map { role, config in
      (
        role,
        PraxisMpFiveAgentRoleCatalogEntry(
          promptPackID: config.promptPack.promptPackID,
          profileID: config.profile.profileID,
          capabilityContractID: config.capabilityContract.contractID
        )
      )
    })
  }
}

public actor PraxisMpFiveAgentRuntime: PraxisMpFiveAgentRuntimeProtocol {
  private let configuration: PraxisMpFiveAgentConfiguration
  private let searchPlanner = PraxisMpSearchPlanningService()
  private let rankingService = PraxisMpSearchRankingService()
  private let alignmentService = PraxisMpMemoryAlignmentService()
  private let bundleService = PraxisMpWorkflowBundleService()
  private let qualityService = PraxisMpMemoryQualityService()

  private var recordsByID: [String: PraxisMpMemoryRecord]
  private var roleCounts: [PraxisMpFiveAgentRole: Int]
  private var latestStages: PraxisMpRoleStageMap
  private var latestRoleMetadata: [PraxisMpFiveAgentRole: [String: PraxisValue]]
  private var pendingAlignmentCount: Int
  private var pendingSupersedeCount: Int
  private var passiveReturnCount: Int
  private var dedupeDecisionCount: Int
  private var ingestCount: Int
  private var rerankComposition: PraxisMpRerankComposition

  public init(
    configuration: PraxisMpFiveAgentConfiguration = PraxisMpFiveAgentConfigurationService.defaultConfiguration(),
    seedRecords: [PraxisMpMemoryRecord] = []
  ) {
    self.configuration = configuration
    self.recordsByID = Dictionary(uniqueKeysWithValues: seedRecords.map { ($0.id, $0) })
    self.roleCounts = Dictionary(uniqueKeysWithValues: PraxisMpFiveAgentRole.allCases.map { ($0, 0) })
    self.latestStages = .empty
    self.latestRoleMetadata = [:]
    self.pendingAlignmentCount = 0
    self.pendingSupersedeCount = 0
    self.passiveReturnCount = 0
    self.dedupeDecisionCount = 0
    self.ingestCount = 0
    self.rerankComposition = PraxisMpRerankComposition()
  }

  public func ingest(_ input: PraxisMpFiveAgentIngestInput) async -> PraxisMpFiveAgentIngestResult {
    ingestCount += 1
    bump(.init(icmaStage: .capture))
    latestRoleMetadata[.icma] = [
      "artifactID": .string(input.artifact.id),
      "candidateCount": 1,
      "proposedMemoryKind": .string(input.memoryKind.rawValue),
    ]

    let candidate = PraxisMpMemoryRecord.from(input)

    bump(.init(iteratorStage: .rewriteDraft))
    latestRoleMetadata[.iterator] = [
      "memoryID": .string(candidate.id),
      "tagCount": .number(Double(candidate.tags.count)),
      "sourceRefCount": .number(Double(candidate.sourceRefs.count)),
    ]

    pendingAlignmentCount += 1
    let alignment = await align(
      .init(
        record: candidate,
        alignedAt: input.observedAt ?? input.artifact.persistedAt,
        queryText: input.artifact.summary
      )
    )
    pendingAlignmentCount = max(0, pendingAlignmentCount - 1)
    return PraxisMpFiveAgentIngestResult(records: alignment.updatedRecords, alignment: alignment)
  }

  public func align(_ input: PraxisMpFiveAgentAlignInput) async -> PraxisMpAlignmentResult {
    bump(.init(checkerStage: .judgeAlignment))
    let relatedRecords = recordsByID.values.filter { $0.scope.projectID == input.record.scope.projectID }
    let alignment = alignmentService.align(
      candidate: input.record,
      relatedRecords: relatedRecords,
      alignedAt: input.alignedAt
    )
    latestRoleMetadata[.checker] = [
      "decision": .string(alignment.decisionOutput.decision.rawValue),
      "supersededCount": .number(Double(alignment.supersededMemoryIDs.count)),
      "staleCount": .number(Double(alignment.staleMemoryIDs.count)),
    ]

    bump(.init(dbAgentStage: .persistTruth))
    for record in alignment.updatedRecords {
      recordsByID[record.id] = record
    }
    pendingSupersedeCount += alignment.supersededMemoryIDs.count
    if alignment.decisionOutput.decision == PraxisMpAlignmentDecision.supersedeExisting
      || alignment.decisionOutput.decision == PraxisMpAlignmentDecision.staleCandidate {
      dedupeDecisionCount += 1
    }
    latestRoleMetadata[.dbagent] = [
      "materializedMemoryIDs": .array(alignment.updatedRecords.map { PraxisValue.string($0.id) }),
      "updatedMemoryCount": .number(Double(alignment.updatedRecords.count)),
      "archivedMemoryCount": .number(0),
    ]
    rerankComposition = bundleService.rerankComposition(for: Array(recordsByID.values))
    return alignment
  }

  public func resolve(_ input: PraxisMpFiveAgentResolveInput) async -> PraxisMpFiveAgentResolveResult {
    let bundle = dispatchBundle(for: input)
    return PraxisMpFiveAgentResolveResult(bundle: bundle)
  }

  public func requestHistory(_ input: PraxisMpFiveAgentHistoryInput) async -> PraxisMpFiveAgentHistoryResult {
    passiveReturnCount += 1
    let bundle = dispatchBundle(for: input)
    return PraxisMpFiveAgentHistoryResult(bundle: bundle)
  }

  public func summary() async -> PraxisMpFiveAgentSummary {
    PraxisMpFiveAgentSummary(
      configurationVersion: configuration.version,
      roleCounts: roleCounts,
      latestStages: latestStages,
      latestRoleMetadata: latestRoleMetadata,
      configuredRoles: PraxisMpFiveAgentConfigurationService.configuredRoleCatalog(configuration: configuration),
      capabilityMatrix: PraxisMpFiveAgentConfigurationService.capabilityMatrixSummary(),
      flow: .init(
        pendingAlignmentCount: pendingAlignmentCount,
        pendingSupersedeCount: pendingSupersedeCount,
        staleMemoryCandidateCount: recordsByID.values.filter { $0.freshness.status == .stale }.count,
        passiveReturnCount: passiveReturnCount
      ),
      quality: qualityService.summarize(
        records: Array(recordsByID.values),
        dedupeDecisionCount: dedupeDecisionCount,
        ingestCount: ingestCount
      )
    )
  }

  public func state() async -> PraxisMpFiveAgentRuntimeState {
    PraxisMpFiveAgentRuntimeState(
      roleCounts: roleCounts,
      latestStages: latestStages,
      latestRoleMetadata: latestRoleMetadata,
      pendingAlignmentCount: pendingAlignmentCount,
      pendingSupersedeCount: pendingSupersedeCount,
      passiveReturnCount: passiveReturnCount,
      records: Array(recordsByID.values).sorted { $0.id < $1.id },
      dedupeDecisionCount: dedupeDecisionCount,
      ingestCount: ingestCount,
      rerankComposition: rerankComposition
    )
  }

  private func dispatchBundle(for input: PraxisMpFiveAgentResolveInput) -> PraxisMpWorkflowBundle {
    bump(.init(dispatcherStage: .search))
    let plan = searchPlanner.makePlan(
      projectID: input.projectID,
      query: input.queryText,
      scopeLevels: input.scopeLevels,
      limit: input.limit,
      agentID: input.requesterLineage.agentID,
      sessionID: input.requesterSessionID,
      includeSuperseded: false
    )
    let candidateRecords = recordsByID.values
      .filter { $0.scope.projectID == input.projectID && plan.scopeLevels.contains($0.scope.scopeLevel) }
    let rankedRecords = rankingService.rank(
      records: candidateRecords,
      semanticScoresByStorageKey: [:],
      plan: plan
    ).map(\.memory)

    bump(.init(dispatcherStage: .assembleBundle), count: false)
    let requesterScope = PraxisMpScopeDescriptor(
      projectID: input.requesterLineage.projectID,
      agentID: input.requesterLineage.agentID,
      sessionID: input.requesterSessionID,
      scopeLevel: input.scopeLevels.first ?? .agentIsolated
    )
    let bundle = bundleService.assemble(
      scope: requesterScope,
      orderedRecords: rankedRecords,
      limit: input.limit
    )
    latestRoleMetadata[.dispatcher] = [
      "primaryMemoryIDs": .array(bundle.primary.map { .string($0.id) }),
      "supportingMemoryIDs": .array(bundle.supporting.map { .string($0.id) }),
      "omittedSupersededMemoryIDs": .array(bundle.diagnostics.omittedSupersededMemoryIDs.map { .string($0) }),
    ]
    rerankComposition = bundle.diagnostics.rerankComposition
    return bundle
  }

  private func bump(_ stage: PraxisMpRoleTelemetryStage, count: Bool = true) {
    let role = stage.role
    if count {
      roleCounts[role, default: 0] += 1
    }
    latestStages = latestStages.setting(stage)
  }
}
