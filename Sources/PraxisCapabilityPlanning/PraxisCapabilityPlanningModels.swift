import PraxisCapabilityContracts
import PraxisGoal
import PraxisRun

/// Result of selecting a capability for a compiled goal.
public struct PraxisCapabilitySelection: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let reason: String
  public let bindingKey: String?
  public let routeHints: [PraxisCapabilityRouteHint]

  /// Creates a capability selection.
  ///
  /// - Parameters:
  ///   - capabilityID: Selected capability identifier.
  ///   - reason: Human-readable selection reason.
  ///   - bindingKey: Optional preferred binding key.
  ///   - routeHints: Route hints carried forward from the manifest.
  public init(
    capabilityID: PraxisCapabilityID,
    reason: String,
    bindingKey: String? = nil,
    routeHints: [PraxisCapabilityRouteHint] = []
  ) {
    self.capabilityID = capabilityID
    self.reason = reason
    self.bindingKey = bindingKey
    self.routeHints = routeHints
  }
}

/// Lightweight lease metadata attached to a planned capability call.
public struct PraxisCapabilityLease: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let holder: String
  public let bindingKey: String?
  public let grantedAt: String?
  public let prioritySummary: String?

  /// Creates a capability lease.
  ///
  /// - Parameters:
  ///   - capabilityID: Capability identifier covered by the lease.
  ///   - holder: Logical holder of the lease.
  ///   - bindingKey: Optional preferred binding key.
  ///   - grantedAt: Optional lease grant timestamp string.
  ///   - prioritySummary: Optional priority summary.
  public init(
    capabilityID: PraxisCapabilityID,
    holder: String,
    bindingKey: String? = nil,
    grantedAt: String? = nil,
    prioritySummary: String? = nil
  ) {
    self.capabilityID = capabilityID
    self.holder = holder
    self.bindingKey = bindingKey
    self.grantedAt = grantedAt
    self.prioritySummary = prioritySummary
  }
}

/// Dispatch plan produced for a selected capability invocation.
public struct PraxisCapabilityDispatchPlan: Sendable, Equatable, Codable {
  public let request: PraxisCapabilityInvocationRequest
  public let runID: PraxisRunID?
  public let preferredBindingKey: String?
  public let prioritySummary: String?

  /// Creates a capability dispatch plan.
  ///
  /// - Parameters:
  ///   - request: Invocation request to dispatch.
  ///   - runID: Optional run identifier carrying the request.
  ///   - preferredBindingKey: Optional preferred binding key.
  ///   - prioritySummary: Optional priority summary for queueing and dispatch.
  public init(
    request: PraxisCapabilityInvocationRequest,
    runID: PraxisRunID?,
    preferredBindingKey: String? = nil,
    prioritySummary: String? = nil
  ) {
    self.request = request
    self.runID = runID
    self.preferredBindingKey = preferredBindingKey
    self.prioritySummary = prioritySummary
  }
}

/// Complete capability invocation plan produced by the planning layer.
public struct PraxisCapabilityInvocationPlan: Sendable, Equatable, Codable {
  public let selection: PraxisCapabilitySelection
  public let dispatchPlan: PraxisCapabilityDispatchPlan
  public let lease: PraxisCapabilityLease?
  public let fingerprint: String?

  /// Creates a capability invocation plan.
  ///
  /// - Parameters:
  ///   - selection: Selection result produced by the selector.
  ///   - dispatchPlan: Dispatch plan produced for the request.
  ///   - lease: Optional planned lease metadata.
  ///   - fingerprint: Optional deterministic fingerprint for the plan.
  public init(
    selection: PraxisCapabilitySelection,
    dispatchPlan: PraxisCapabilityDispatchPlan,
    lease: PraxisCapabilityLease?,
    fingerprint: String? = nil
  ) {
    self.selection = selection
    self.dispatchPlan = dispatchPlan
    self.lease = lease
    self.fingerprint = fingerprint
  }
}
