public enum PraxisMpFiveAgentRole: String, Sendable, Equatable, Codable, CaseIterable {
  case icma
  case iterator
  case checker
  case dbagent
  case dispatcher
}

public enum PraxisMpIcmaStage: String, Sendable, Equatable, Codable, CaseIterable {
  case capture
  case chunkCandidate = "chunk_candidate"
  case emitCandidate = "emit_candidate"
}

public enum PraxisMpIteratorStage: String, Sendable, Equatable, Codable, CaseIterable {
  case acceptCandidate = "accept_candidate"
  case rewriteDraft = "rewrite_draft"
  case handoffChecker = "handoff_checker"
}

public enum PraxisMpCheckerStage: String, Sendable, Equatable, Codable, CaseIterable {
  case inspectCandidate = "inspect_candidate"
  case judgeAlignment = "judge_alignment"
  case emitDecision = "emit_decision"
}

public enum PraxisMpDbAgentStage: String, Sendable, Equatable, Codable, CaseIterable {
  case materialize
  case updateLineage = "update_lineage"
  case persistTruth = "persist_truth"
}

public enum PraxisMpDispatcherStage: String, Sendable, Equatable, Codable, CaseIterable {
  case search
  case rerank
  case assembleBundle = "assemble_bundle"
}
