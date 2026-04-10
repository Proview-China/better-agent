import PraxisCoreTypes

public protocol PraxisStateProjecting: Sendable {
  func project(
    from events: [PraxisKernelEvent],
    initialState: PraxisStateSnapshot
  ) throws -> PraxisStateSnapshot
}

public protocol PraxisStateValidating: Sendable {
  func validate(_ snapshot: PraxisStateSnapshot) -> [PraxisStateInvariantViolation]
  func validate(_ delta: PraxisStateDelta) -> [PraxisStateInvariantViolation]
}

public extension PraxisStateProjecting {
  func project(from events: [PraxisKernelEvent]) throws -> PraxisStateSnapshot {
    try project(from: events, initialState: createInitialAgentState())
  }
}

public struct PraxisDefaultStateProjector: Sendable, PraxisStateProjecting {
  public init() {}

  public func project(
    from events: [PraxisKernelEvent],
    initialState: PraxisStateSnapshot = createInitialAgentState()
  ) throws -> PraxisStateSnapshot {
    try events.reduce(initialState) { state, event in
      try applyEventToState(state, event: event)
    }
  }
}

public struct PraxisDefaultStateValidator: Sendable, PraxisStateValidating {
  public init() {}

  public func validate(_ snapshot: PraxisStateSnapshot) -> [PraxisStateInvariantViolation] {
    var violations: [PraxisStateInvariantViolation] = []

    if snapshot.observed.artifactRefs.contains(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
      violations.append(.invalidValue("AgentState.observed.artifactRefs must not contain empty refs."))
    }

    violations.append(contentsOf: validateRecord(snapshot.working, section: "working"))

    if let derived = snapshot.derived {
      violations.append(contentsOf: validateRecord(derived, section: "derived"))
    }

    return violations
  }

  public func validate(_ delta: PraxisStateDelta) -> [PraxisStateInvariantViolation] {
    var violations: [PraxisStateInvariantViolation] = []

    if let working = delta.working {
      violations.append(contentsOf: validateRecord(working, section: "delta.working"))
    }

    if let derived = delta.derived {
      violations.append(contentsOf: validateRecord(derived, section: "delta.derived"))
    }

    if delta.clearWorkingKeys.contains(where: \.isEmpty) {
      violations.append(.invalidValue("clearWorkingKeys must not contain empty entries."))
    }

    if delta.clearDerivedKeys.contains(where: \.isEmpty) {
      violations.append(.invalidValue("clearDerivedKeys must not contain empty entries."))
    }

    if let refs = delta.observed?.artifactRefs,
       refs.contains(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
      violations.append(.invalidValue("observed.artifactRefs must not contain empty refs."))
    }

    return violations
  }
}

public func createInitialAgentState() -> PraxisStateSnapshot {
  PraxisStateSnapshot(
    control: .init(
      status: .created,
      phase: .decision,
      retryCount: 0
    ),
    working: [:],
    observed: .init(artifactRefs: []),
    recovery: .init()
  )
}

public func applyStateDelta(
  _ base: PraxisStateSnapshot,
  _ delta: PraxisStateDelta
) throws -> PraxisStateSnapshot {
  let validator = PraxisDefaultStateValidator()
  if let first = validator.validate(base).first {
    throw violationAsError(first)
  }
  if let first = validator.validate(delta).first {
    throw violationAsError(first)
  }

  let next = PraxisStateSnapshot(
    control: .init(
      status: delta.control?.status ?? base.control.status,
      phase: delta.control?.phase ?? base.control.phase,
      retryCount: delta.control?.retryCount ?? base.control.retryCount,
      pendingIntentID: delta.control?.pendingIntentID ?? base.control.pendingIntentID,
      pendingCheckpointReason: delta.control?.pendingCheckpointReason ?? base.control.pendingCheckpointReason
    ),
    working: mergeStateRecord(
      base.working,
      patch: delta.working,
      clearKeys: delta.clearWorkingKeys
    ),
    observed: .init(
      lastObservationRef: delta.observed?.lastObservationRef ?? base.observed.lastObservationRef,
      lastResultID: delta.observed?.lastResultID ?? base.observed.lastResultID,
      lastResultStatus: delta.observed?.lastResultStatus ?? base.observed.lastResultStatus,
      artifactRefs: delta.observed?.artifactRefs ?? base.observed.artifactRefs
    ),
    recovery: .init(
      lastCheckpointRef: delta.recovery?.lastCheckpointRef ?? base.recovery.lastCheckpointRef,
      resumePointer: delta.recovery?.resumePointer ?? base.recovery.resumePointer,
      lastErrorCode: delta.recovery?.lastErrorCode ?? base.recovery.lastErrorCode,
      lastErrorMessage: delta.recovery?.lastErrorMessage ?? base.recovery.lastErrorMessage
    ),
    derived: normalizedDerived(
      base: base.derived,
      patch: delta.derived,
      clearKeys: delta.clearDerivedKeys
    )
  )

  if let first = validator.validate(next).first {
    throw violationAsError(first)
  }
  return next
}

public func applyEventToState(
  _ state: PraxisStateSnapshot,
  event: PraxisKernelEvent
) throws -> PraxisStateSnapshot {
  switch event.payload {
  case .runCreated:
    return PraxisStateSnapshot(
      control: .init(
        status: .created,
        phase: .decision,
        retryCount: 0
      ),
      working: state.working,
      observed: state.observed,
      recovery: state.recovery,
      derived: state.derived
    )
  case .runResumed(let checkpointID):
    return PraxisStateSnapshot(
      control: .init(
        status: .deciding,
        phase: .recovery,
        retryCount: state.control.retryCount,
        pendingIntentID: state.control.pendingIntentID,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: state.observed,
      recovery: .init(
        lastCheckpointRef: checkpointID ?? state.recovery.lastCheckpointRef,
        resumePointer: event.eventID,
        lastErrorCode: state.recovery.lastErrorCode,
        lastErrorMessage: state.recovery.lastErrorMessage
      ),
      derived: state.derived
    )
  case .runPaused(let reason):
    return PraxisStateSnapshot(
      control: .init(
        status: .paused,
        phase: state.control.phase,
        retryCount: state.control.retryCount,
        pendingIntentID: state.control.pendingIntentID,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: state.observed,
      recovery: .init(
        lastCheckpointRef: state.recovery.lastCheckpointRef,
        resumePointer: state.recovery.resumePointer,
        lastErrorCode: state.recovery.lastErrorCode,
        lastErrorMessage: reason
      ),
      derived: state.derived
    )
  case .runCompleted(let resultID):
    return PraxisStateSnapshot(
      control: .init(
        status: .completed,
        phase: state.control.phase,
        retryCount: state.control.retryCount,
        pendingIntentID: nil,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: .init(
        lastObservationRef: state.observed.lastObservationRef,
        lastResultID: resultID ?? state.observed.lastResultID,
        lastResultStatus: state.observed.lastResultStatus,
        artifactRefs: state.observed.artifactRefs
      ),
      recovery: state.recovery,
      derived: state.derived
    )
  case .runFailed(let code, let message):
    return PraxisStateSnapshot(
      control: .init(
        status: .failed,
        phase: state.control.phase,
        retryCount: state.control.retryCount,
        pendingIntentID: nil,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: state.observed,
      recovery: .init(
        lastCheckpointRef: state.recovery.lastCheckpointRef,
        resumePointer: state.recovery.resumePointer,
        lastErrorCode: code,
        lastErrorMessage: message
      ),
      derived: state.derived
    )
  case .stateDeltaApplied(let delta, _, _):
    return try applyStateDelta(state, delta)
  case .intentQueued(let intentID, _, _):
    return PraxisStateSnapshot(
      control: .init(
        status: state.control.status,
        phase: state.control.phase,
        retryCount: state.control.retryCount,
        pendingIntentID: intentID,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: state.observed,
      recovery: state.recovery,
      derived: state.derived
    )
  case .intentDispatched(let intentID, _):
    return PraxisStateSnapshot(
      control: .init(
        status: state.control.status,
        phase: .execution,
        retryCount: state.control.retryCount,
        pendingIntentID: intentID,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: state.observed,
      recovery: state.recovery,
      derived: state.derived
    )
  case .capabilityResultReceived(_, let resultID, let status):
    return PraxisStateSnapshot(
      control: .init(
        status: state.control.status,
        phase: .commit,
        retryCount: state.control.retryCount,
        pendingIntentID: nil,
        pendingCheckpointReason: state.control.pendingCheckpointReason
      ),
      working: state.working,
      observed: .init(
        lastObservationRef: state.observed.lastObservationRef,
        lastResultID: resultID,
        lastResultStatus: status,
        artifactRefs: state.observed.artifactRefs
      ),
      recovery: state.recovery,
      derived: state.derived
    )
  case .checkpointCreated(let checkpointID, _):
    return PraxisStateSnapshot(
      control: state.control,
      working: state.working,
      observed: state.observed,
      recovery: .init(
        lastCheckpointRef: checkpointID,
        resumePointer: event.eventID,
        lastErrorCode: state.recovery.lastErrorCode,
        lastErrorMessage: state.recovery.lastErrorMessage
      ),
      derived: state.derived
    )
  }
}

private func validateRecord(
  _ record: PraxisStateRecord,
  section: String
) -> [PraxisStateInvariantViolation] {
  var violations: [PraxisStateInvariantViolation] = []
  for key in record.keys {
    if PraxisForbiddenStateTopLevelKeys.contains(key) {
      violations.append(.invalidValue("State section \(section) may not contain top-level key \(key)."))
    }
  }
  return violations
}

private func normalizedDerived(
  base: PraxisStateRecord?,
  patch: PraxisStateRecord?,
  clearKeys: [String]
) -> PraxisStateRecord? {
  let merged = mergeStateRecord(base ?? [:], patch: patch, clearKeys: clearKeys)
  return merged.isEmpty ? nil : merged
}

private func mergeStateRecord(
  _ base: PraxisStateRecord,
  patch: PraxisStateRecord?,
  clearKeys: [String]
) -> PraxisStateRecord {
  var next = base

  for key in clearKeys {
    next.removeValue(forKey: key)
  }

  guard let patch else {
    return next
  }

  for (key, value) in patch {
    if let current = next[key],
       case .object(let currentObject) = current,
       case .object(let nextObject) = value {
      next[key] = .object(
        mergeStateRecord(currentObject, patch: nextObject, clearKeys: [])
      )
      continue
    }

    next[key] = value
  }

  return next
}

private func violationAsError(_ violation: PraxisStateInvariantViolation) -> PraxisError {
  switch violation {
  case .missingValue(let message):
    return .invalidInput(message)
  case .invalidValue(let message):
    return .invalidInput(message)
  }
}
