import Foundation
import PraxisCapabilityContracts
import PraxisGoal
import PraxisRun

/// Selects the most appropriate capability for a compiled goal.
public protocol PraxisCapabilitySelecting: Sendable {
  /// Selects a capability for a compiled goal.
  ///
  /// - Parameter goal: The compiled goal to inspect.
  /// - Returns: The selected capability, or `nil` when no capability should be planned.
  func select(for goal: PraxisCompiledGoal) -> PraxisCapabilitySelection?
}

/// Builds capability invocation plans from compiled goals.
public struct PraxisCapabilityPlanner: Sendable {
  public let selector: any PraxisCapabilitySelecting

  /// Creates the capability planner.
  ///
  /// - Parameter selector: Selector used to choose a capability for a goal.
  public init(selector: any PraxisCapabilitySelecting) {
    self.selector = selector
  }

  /// Builds a capability invocation plan for a compiled goal.
  ///
  /// - Parameters:
  ///   - goal: Compiled goal to plan from.
  ///   - runID: Optional run identifier carrying the plan.
  ///   - holder: Logical holder for the generated lease. Defaults to `"planner"`.
  /// - Returns: A capability invocation plan, or `nil` when no capability matches the goal.
  public func plan(
    for goal: PraxisCompiledGoal,
    runID: PraxisRunID? = nil,
    holder: String = "planner"
  ) -> PraxisCapabilityInvocationPlan? {
    guard let selection = selector.select(for: goal) else {
      return nil
    }

    let request = PraxisCapabilityInvocationRequest(
      capabilityID: selection.capabilityID,
      inputSummary: goal.instructionText,
      inputPayload: goal.metadata,
      idempotencyKey: "goal.\(goal.cacheKey)",
      metadata: [
        "goalID": .string(goal.goalID.rawValue),
      ]
    )
    let dispatchPlan = PraxisCapabilityDispatchPlan(
      request: request,
      runID: runID,
      preferredBindingKey: selection.bindingKey,
      prioritySummary: inferPrioritySummary(from: goal)
    )
    let lease = PraxisCapabilityLease(
      capabilityID: selection.capabilityID,
      holder: holder,
      bindingKey: selection.bindingKey,
      prioritySummary: dispatchPlan.prioritySummary
    )

    return PraxisCapabilityInvocationPlan(
      selection: selection,
      dispatchPlan: dispatchPlan,
      lease: lease,
      fingerprint: buildFingerprint(for: request, runID: runID)
    )
  }
}

/// Default heuristic selector for capability planning.
public struct PraxisDefaultCapabilitySelector: Sendable, PraxisCapabilitySelecting {
  public let availableCapabilities: [PraxisCapabilityManifest]
  public let bindings: [PraxisCapabilityBinding]

  /// Creates the default capability selector.
  ///
  /// - Parameters:
  ///   - availableCapabilities: Capability manifests available for selection.
  ///   - bindings: Optional bindings available for preferred routing.
  public init(
    availableCapabilities: [PraxisCapabilityManifest] = [],
    bindings: [PraxisCapabilityBinding] = []
  ) {
    self.availableCapabilities = availableCapabilities
    self.bindings = bindings
  }

  public func select(for goal: PraxisCompiledGoal) -> PraxisCapabilitySelection? {
    guard !availableCapabilities.isEmpty else {
      return nil
    }

    if let explicit = explicitManifest(for: goal) {
      return selection(for: explicit, reason: "Matched explicit capability constraint from goal.")
    }

    let scored = availableCapabilities
      .map { manifest in
        (manifest, score(manifest: manifest, goal: goal))
      }
      .filter { $0.1 > 0 }
      .sorted { lhs, rhs in
        if lhs.1 == rhs.1 {
          return lhs.0.id.rawValue < rhs.0.id.rawValue
        }
        return lhs.1 > rhs.1
      }

    if let best = scored.first?.0 {
      return selection(for: best, reason: "Selected capability by keyword and tag match.")
    }

    if let hotPath = availableCapabilities.first(where: \.hotPath) {
      return selection(for: hotPath, reason: "Selected first hot-path capability as fallback.")
    }

    guard let first = availableCapabilities.sorted(by: { $0.id.rawValue < $1.id.rawValue }).first else {
      return nil
    }
    return selection(for: first, reason: "Selected first available capability as deterministic fallback.")
  }
}

private extension PraxisCapabilityPlanner {
  func inferPrioritySummary(from goal: PraxisCompiledGoal) -> String {
    let text = goal.instructionText.lowercased()
    if text.contains("urgent") || text.contains("立即") || text.contains("马上") {
      return "high"
    }
    return "normal"
  }

  func buildFingerprint(
    for request: PraxisCapabilityInvocationRequest,
    runID: PraxisRunID?
  ) -> String {
    let payload = request.inputPayload?.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value.canonicalDescription)" }.joined(separator: "&") ?? ""
    return [
      request.capabilityID.rawValue,
      request.operation,
      runID?.rawValue ?? "",
      request.idempotencyKey ?? "",
      payload,
    ].joined(separator: "|")
  }
}

private extension PraxisDefaultCapabilitySelector {
  func explicitManifest(for goal: PraxisCompiledGoal) -> PraxisCapabilityManifest? {
    let keys = Set(["capability", "capabilityKey", "capability_id", "preferredCapability"])

    if let explicitValue = goal.constraints
      .first(where: { keys.contains($0.key) })?
      .value
      .stringValue?
      .lowercased()
    {
      return availableCapabilities.first {
        $0.id.rawValue.lowercased() == explicitValue
          || $0.name.lowercased() == explicitValue
      }
    }

    if let family = goal.constraints
      .first(where: { $0.key == "capabilityFamily" || $0.key == "family" })?
      .value
      .stringValue?
      .lowercased()
    {
      return availableCapabilities.first {
        familyName(for: $0.id) == family
      }
    }

    return nil
  }

  func score(manifest: PraxisCapabilityManifest, goal: PraxisCompiledGoal) -> Int {
    let haystack = [
      goal.normalizedGoal.title,
      goal.normalizedGoal.summary,
      goal.instructionText,
      goal.constraints.map(\.summary).joined(separator: " "),
      goal.inputRefs.joined(separator: " "),
    ]
      .joined(separator: " ")
      .lowercased()

    var score = 0
    let capabilityKey = manifest.id.rawValue.lowercased()
    let name = manifest.name.lowercased()

    if haystack.contains(capabilityKey) {
      score += 10
    }
    if haystack.contains(name) {
      score += 6
    }
    for tag in manifest.tags where haystack.contains(tag.lowercased()) {
      score += 3
    }
    for hint in manifest.routeHints where haystack.contains(hint.value.lowercased()) {
      score += 2
    }
    if haystack.contains(familyName(for: manifest.id)) {
      score += 1
    }
    if manifest.hotPath {
      score += 1
    }

    return score
  }

  func selection(for manifest: PraxisCapabilityManifest, reason: String) -> PraxisCapabilitySelection {
    let binding = bindings.first {
      $0.capabilityID == manifest.id && $0.state == .active
    }
    return PraxisCapabilitySelection(
      capabilityID: manifest.id,
      reason: reason,
      bindingKey: binding?.bindingKey,
      routeHints: manifest.routeHints
    )
  }

  func familyName(for capabilityID: PraxisCapabilityID) -> String {
    capabilityID.rawValue.split(separator: ".").first.map(String.init) ?? capabilityID.rawValue
  }
}
