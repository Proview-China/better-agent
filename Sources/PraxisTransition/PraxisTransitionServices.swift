import PraxisState

/// Runtime guard that can veto a state transition for a given event.
public protocol PraxisTransitionGuard: Sendable {
  /// Returns whether the current snapshot is allowed to consume the event.
  ///
  /// - Parameters:
  ///   - snapshot: The current runtime snapshot.
  ///   - event: The incoming kernel event under evaluation.
  /// - Returns: `true` when the event may proceed, otherwise `false`.
  func canTransition(snapshot: PraxisStateSnapshot, event: PraxisKernelEvent) -> Bool
}

/// Evaluates incoming kernel events against the runtime transition table.
public struct PraxisTransitionEvaluator: Sendable {
  public let table: PraxisTransitionTable

  /// Creates an evaluator with the supplied transition table.
  ///
  /// - Parameter table: The transition table used as the evaluator's policy source.
  public init(table: PraxisTransitionTable = .default) {
    self.table = table
  }

  /// Resolves the next transition decision for the current state and incoming event.
  ///
  /// - Parameters:
  ///   - currentState: The snapshot that represents the runtime state before the event is applied.
  ///   - incomingEvent: The kernel event requesting a transition.
  /// - Returns: A transition decision describing the next status, phase, state delta, and follow-up action.
  /// - Throws: A transition error when the event is illegal for the current runtime status.
  public func evaluate(
    currentState: PraxisStateSnapshot,
    incomingEvent: PraxisKernelEvent
  ) throws -> PraxisTransitionDecision {
    switch incomingEvent.payload {
    case .runCreated:
      guard matches(currentState.control.status, allowed: [.created, .idle]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .acting,
        nextPhase: .execution,
        reason: "Run \(incomingEvent.runID) created and entering first execution step.",
        stateDelta: .init(
          control: .init(status: .acting, phase: .execution)
        ),
        nextAction: defaultModelInferenceAction(for: incomingEvent),
        eventID: incomingEvent.eventID
      )
    case .runResumed(let checkpointID):
      guard matches(currentState.control.status, allowed: [.paused, .waiting, .failed]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      let instruction: String
      if let checkpointID {
        instruction = "Resume run from checkpoint \(checkpointID) and re-enter the kernel loop."
      } else {
        instruction = "Resume run and re-enter the kernel loop."
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .acting,
        nextPhase: .recovery,
        reason: checkpointID.map { "Run \(incomingEvent.runID) resumed from checkpoint \($0)." }
          ?? "Run \(incomingEvent.runID) resumed without a specific checkpoint pointer.",
        stateDelta: .init(
          control: .init(status: .acting, phase: .recovery),
          recovery: .init(lastCheckpointRef: checkpointID)
        ),
        nextAction: .init(
          kind: .internalStep,
          reason: "Resume the kernel loop from recovery.",
          intent: .init(
            intentID: "\(incomingEvent.eventID):resume",
            sessionID: incomingEvent.sessionID,
            runID: incomingEvent.runID,
            kind: .internalStep,
            createdAt: incomingEvent.createdAt,
            priority: .high,
            correlationID: incomingEvent.correlationID ?? incomingEvent.eventID,
            instruction: instruction
          ),
          metadata: ["path": "resume-recovery"]
        ),
        eventID: incomingEvent.eventID
      )
    case .stateDeltaApplied:
      guard matches(currentState.control.status, allowed: [.deciding, .acting]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .acting,
        nextPhase: .execution,
        reason: "State delta applied; evaluate next executable action.",
        stateDelta: .init(
          control: .init(status: .acting, phase: .execution)
        ),
        nextAction: resolveNextAction(state: currentState, event: incomingEvent),
        eventID: incomingEvent.eventID
      )
    case .intentQueued(let intentID, _, _):
      guard matches(currentState.control.status, allowed: [.acting, .deciding]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .waiting,
        nextPhase: .execution,
        reason: "Intent \(intentID) queued for asynchronous execution.",
        stateDelta: .init(
          control: .init(status: .waiting, phase: .execution, pendingIntentID: intentID)
        ),
        nextAction: .init(
          kind: .wait,
          reason: "Wait for the queued intent to finish.",
          metadata: ["pendingIntentID": .string(intentID)]
        ),
        eventID: incomingEvent.eventID
      )
    case .intentDispatched(_, let dispatchTarget):
      guard matches(currentState.control.status, allowed: [.waiting]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .waiting,
        nextPhase: .execution,
        reason: "Intent dispatched to \(dispatchTarget); run remains waiting.",
        nextAction: .init(
          kind: .wait,
          reason: "Intent is already in-flight.",
          metadata: ["dispatchTarget": .string(dispatchTarget)]
        ),
        eventID: incomingEvent.eventID
      )
    case .capabilityResultReceived(_, let resultID, let status):
      guard matches(currentState.control.status, allowed: [.waiting, .acting]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      let isFinalModelResult =
        incomingEvent.metadata?["resultSource"]?.stringValue == "model"
        && incomingEvent.metadata?["final"]?.boolValue == true
      if isFinalModelResult {
        return PraxisTransitionDecision(
          fromStatus: currentState.control.status,
          toStatus: .completed,
          nextPhase: .commit,
          reason: "Model result \(resultID) completed the run.",
          stateDelta: .init(
            control: .init(status: .completed, phase: .commit, pendingIntentID: nil),
            observed: .init(lastResultID: resultID, lastResultStatus: status)
          ),
          nextAction: .init(
            kind: .complete,
            reason: "Model produced a final result.",
            metadata: [
              "resultID": .string(resultID),
              "source": .string("model"),
            ]
          ),
          eventID: incomingEvent.eventID
        )
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .deciding,
        nextPhase: .decision,
        reason: "Capability result \(resultID) received; return to decision phase.",
        stateDelta: .init(
          control: .init(status: .deciding, phase: .decision, pendingIntentID: nil),
          observed: .init(lastResultID: resultID, lastResultStatus: status)
        ),
        nextAction: resolveNextAction(state: currentState, event: incomingEvent),
        eventID: incomingEvent.eventID
      )
    case .runPaused(let reason):
      guard matches(currentState.control.status, allowed: [.waiting, .acting, .deciding]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .paused,
        nextPhase: .recovery,
        reason: reason,
        stateDelta: .init(
          control: .init(status: .paused, phase: .recovery)
        ),
        nextAction: .init(
          kind: .pause,
          reason: reason,
          metadata: ["pauseReason": .string(reason)]
        ),
        eventID: incomingEvent.eventID
      )
    case .runFailed(let code, let message):
      guard !matches(currentState.control.status, allowed: [.completed, .cancelled]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .failed,
        nextPhase: .recovery,
        reason: message,
        stateDelta: .init(
          control: .init(status: .failed, phase: .recovery),
          recovery: .init(lastErrorCode: code, lastErrorMessage: message)
        ),
        nextAction: .init(
          kind: .fail,
          reason: message,
          metadata: ["code": .string(code)]
        ),
        eventID: incomingEvent.eventID
      )
    case .runCompleted(let resultID):
      guard !matches(currentState.control.status, allowed: [.failed, .cancelled]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: .completed,
        nextPhase: .commit,
        reason: "Run \(incomingEvent.runID) completed.",
        stateDelta: .init(
          control: .init(status: .completed, phase: .commit),
          observed: .init(lastResultID: resultID)
        ),
        nextAction: .init(
          kind: .complete,
          reason: "Run reached a terminal completion event.",
          metadata: resultID.map { ["resultID": .string($0)] } ?? [:]
        ),
        eventID: incomingEvent.eventID
      )
    case .checkpointCreated(let checkpointID, let tier):
      guard !matches(currentState.control.status, allowed: [.cancelled]) else {
        throw invalidTransition(state: currentState, event: incomingEvent)
      }
      return PraxisTransitionDecision(
        fromStatus: currentState.control.status,
        toStatus: currentState.control.status,
        nextPhase: currentState.control.phase,
        reason: "Checkpoint \(checkpointID) recorded at tier \(tier).",
        stateDelta: .init(
          recovery: .init(lastCheckpointRef: checkpointID)
        ),
        nextAction: .init(
          kind: .checkpoint,
          reason: "Checkpoint recorded for recovery.",
          metadata: [
            "checkpointID": .string(checkpointID),
            "tier": .string(tier),
          ]
        ),
        eventID: incomingEvent.eventID
      )
    }
  }
}

public extension PraxisTransitionTable {
  static let `default` = PraxisTransitionTable(
    rules: [
      .init(
        name: "run.created",
        path: .hot,
        eventType: .runCreated,
        fromStatuses: [.created, .idle],
        toStatus: .acting,
        nextPhase: .execution,
        summary: "进入首个执行步，默认走 model inference 热路径。"
      ),
      .init(
        name: "run.resumed",
        path: .hot,
        eventType: .runResumed,
        fromStatuses: [.paused, .waiting, .failed],
        toStatus: .acting,
        nextPhase: .recovery,
        summary: "恢复后回到 kernel loop。"
      ),
      .init(
        name: "state.delta_applied",
        path: .hot,
        eventType: .stateDeltaApplied,
        fromStatuses: [.deciding, .acting],
        toStatus: .acting,
        nextPhase: .execution,
        summary: "从 working state hints 解析下一步动作。"
      ),
      .init(
        name: "intent.queued",
        path: .hot,
        eventType: .intentQueued,
        fromStatuses: [.acting, .deciding],
        toStatus: .waiting,
        nextPhase: .execution,
        summary: "队列化异步 intent，run 进入 waiting。"
      ),
      .init(
        name: "intent.dispatched",
        path: .hot,
        eventType: .intentDispatched,
        fromStatuses: [.waiting],
        toStatus: .waiting,
        nextPhase: .execution,
        summary: "已分发但仍等待结果。"
      ),
      .init(
        name: "capability.result_received",
        path: .hot,
        eventType: .capabilityResultReceived,
        fromStatuses: [.waiting, .acting],
        toStatus: .deciding,
        nextPhase: .decision,
        summary: "收到能力结果后回到决策相位。"
      ),
      .init(
        name: "run.paused",
        path: .rare,
        eventType: .runPaused,
        fromStatuses: [.waiting, .acting, .deciding],
        toStatus: .paused,
        nextPhase: .recovery,
        summary: "稀有暂停路径。"
      ),
      .init(
        name: "run.failed",
        path: .rare,
        eventType: .runFailed,
        fromStatuses: PraxisAgentStatus.allCases.filter { ![.completed, .cancelled].contains($0) },
        toStatus: .failed,
        nextPhase: .recovery,
        summary: "失败后进入恢复路径。"
      ),
      .init(
        name: "run.completed",
        path: .rare,
        eventType: .runCompleted,
        fromStatuses: PraxisAgentStatus.allCases.filter { ![.failed, .cancelled].contains($0) },
        toStatus: .completed,
        nextPhase: .commit,
        summary: "显式完成事件。"
      ),
      .init(
        name: "checkpoint.created",
        path: .rare,
        eventType: .checkpointCreated,
        fromStatuses: PraxisAgentStatus.allCases.filter { $0 != .cancelled },
        toStatus: .created,
        nextPhase: nil,
        summary: "记录 checkpoint 指针，不改变主状态。"
      ),
    ]
  )
}

private func matches(_ status: PraxisAgentStatus, allowed: [PraxisAgentStatus]) -> Bool {
  allowed.contains(status)
}

private func invalidTransition(
  state: PraxisStateSnapshot,
  event: PraxisKernelEvent
) -> PraxisInvalidTransitionError {
  PraxisInvalidTransitionError(
    fromStatus: state.control.status,
    eventType: event.type,
    message: "No transition rule matched event \(event.type.rawValue) from status \(state.control.status.rawValue)."
  )
}

private func defaultModelInferenceAction(for event: PraxisKernelEvent) -> PraxisNextActionDecision {
  PraxisNextActionDecision(
    kind: .modelInference,
    reason: "Use the compiled goal and current state to produce the next kernel step.",
    intent: .init(
      intentID: "\(event.eventID):model",
      sessionID: event.sessionID,
      runID: event.runID,
      kind: .modelInference,
      createdAt: event.createdAt,
      priority: .normal,
      correlationID: event.correlationID ?? event.eventID
    )
  )
}

private func resolveNextAction(
  state: PraxisStateSnapshot,
  event: PraxisKernelEvent
) -> PraxisNextActionDecision {
  if let cmpAction = state.working["nextCmpAction"]?.stringValue,
     let cmpInput = state.working["nextCmpInput"]?.objectValue {
    return PraxisNextActionDecision(
      kind: .cmpAction,
      reason: "Working state requested a CMP action.",
      intent: .init(
        intentID: "\(event.eventID):cmp",
        sessionID: event.sessionID,
        runID: event.runID,
        kind: .cmpAction,
        createdAt: event.createdAt,
        priority: resolvePriority(from: state),
        correlationID: event.correlationID ?? event.eventID,
        cmpAction: cmpAction,
        cmpInput: cmpInput
      ),
      metadata: ["path": "state-driven-cmp"]
    )
  }

  if let capabilityKey = state.working["nextCapabilityKey"]?.stringValue,
     let capabilityInput = state.working["nextCapabilityInput"]?.objectValue {
    return PraxisNextActionDecision(
      kind: .capabilityCall,
      reason: "Working state requested a capability call.",
      intent: .init(
        intentID: "\(event.eventID):capability",
        sessionID: event.sessionID,
        runID: event.runID,
        kind: .capabilityCall,
        createdAt: event.createdAt,
        priority: resolvePriority(from: state),
        correlationID: event.correlationID ?? event.eventID,
        capabilityKey: capabilityKey,
        capabilityInput: capabilityInput
      ),
      metadata: ["path": "state-driven-capability"]
    )
  }

  if let instruction = state.working["nextInternalInstruction"]?.stringValue {
    return PraxisNextActionDecision(
      kind: .internalStep,
      reason: "Working state requested an internal instruction.",
      intent: .init(
        intentID: "\(event.eventID):internal",
        sessionID: event.sessionID,
        runID: event.runID,
        kind: .internalStep,
        createdAt: event.createdAt,
        priority: resolvePriority(from: state),
        correlationID: event.correlationID ?? event.eventID,
        instruction: instruction
      ),
      metadata: ["path": "state-driven-internal"]
    )
  }

  return defaultModelInferenceAction(for: event)
}

private func resolvePriority(from state: PraxisStateSnapshot) -> PraxisTransitionPriority {
  switch state.working["nextIntentPriority"]?.stringValue {
  case "low":
    .low
  case "high":
    .high
  case "critical":
    .critical
  default:
    .normal
  }
}
