import PraxisCoreTypes

/// Stable identifier for a capability.
public struct PraxisCapabilityID: PraxisIdentifier {
  public let rawValue: String

  /// Creates a stable capability identifier.
  ///
  /// - Parameter rawValue: The persisted string form of the identifier.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }
}

/// Broad capability kind used for planning and catalog grouping.
public enum PraxisCapabilityKind: String, Sendable, Equatable, Codable {
  case model
  case tool
  case resource
  case runtime
}

/// Binding lifecycle state for a capability implementation.
public enum PraxisCapabilityBindingState: String, Sendable, Equatable, Codable {
  case active
  case draining
  case disabled
}

/// Schema reference used by capability manifests.
public struct PraxisCapabilitySchemaRef: Sendable, Equatable, Codable {
  public let id: String
  public let version: String?

  /// Creates a schema reference.
  ///
  /// - Parameters:
  ///   - id: Stable schema identifier.
  ///   - version: Optional schema version string.
  public init(id: String, version: String? = nil) {
    self.id = id
    self.version = version
  }
}

/// Routing hint attached to a capability manifest.
public struct PraxisCapabilityRouteHint: Sendable, Equatable, Codable {
  public let key: String
  public let value: String

  /// Creates a route hint.
  ///
  /// - Parameters:
  ///   - key: Hint key.
  ///   - value: Hint value.
  public init(key: String, value: String) {
    self.key = key
    self.value = value
  }
}

/// Public manifest describing a capability and its planning surface.
public struct PraxisCapabilityManifest: Sendable, Equatable, Codable {
  public let id: PraxisCapabilityID
  public let name: String
  public let summary: String
  public let kind: PraxisCapabilityKind
  public let version: String
  public let generation: Int
  public let inputSchemaRef: PraxisCapabilitySchemaRef?
  public let outputSchemaRef: PraxisCapabilitySchemaRef?
  public let supportsStreaming: Bool
  public let supportsCancellation: Bool
  public let supportsPrepare: Bool
  public let hotPath: Bool
  public let routeHints: [PraxisCapabilityRouteHint]
  public let tags: [String]
  public let metadata: [String: PraxisValue]?

  /// Creates a capability manifest.
  ///
  /// - Parameters:
  ///   - id: Stable capability identifier.
  ///   - name: Human-readable capability name.
  ///   - summary: Human-readable summary of the capability surface.
  ///   - kind: Broad capability kind.
  ///   - version: Manifest version string.
  ///   - generation: Monotonic manifest generation.
  ///   - inputSchemaRef: Optional input schema reference.
  ///   - outputSchemaRef: Optional output schema reference.
  ///   - supportsStreaming: Whether the capability supports streaming output.
  ///   - supportsCancellation: Whether the capability supports cancellation.
  ///   - supportsPrepare: Whether the capability supports a separate prepare step.
  ///   - hotPath: Whether the capability is suitable for hot-path planning.
  ///   - routeHints: Routing hints used by planners and catalogs.
  ///   - tags: Discoverability tags.
  ///   - metadata: Extra plain-data metadata preserved with the manifest.
  public init(
    id: PraxisCapabilityID,
    name: String,
    summary: String,
    kind: PraxisCapabilityKind = .tool,
    version: String = "0.1.0",
    generation: Int = 1,
    inputSchemaRef: PraxisCapabilitySchemaRef? = nil,
    outputSchemaRef: PraxisCapabilitySchemaRef? = nil,
    supportsStreaming: Bool = false,
    supportsCancellation: Bool = false,
    supportsPrepare: Bool = true,
    hotPath: Bool = false,
    routeHints: [PraxisCapabilityRouteHint] = [],
    tags: [String] = [],
    metadata: [String: PraxisValue]? = nil
  ) {
    self.id = id
    self.name = name
    self.summary = summary
    self.kind = kind
    self.version = version
    self.generation = generation
    self.inputSchemaRef = inputSchemaRef
    self.outputSchemaRef = outputSchemaRef
    self.supportsStreaming = supportsStreaming
    self.supportsCancellation = supportsCancellation
    self.supportsPrepare = supportsPrepare
    self.hotPath = hotPath
    self.routeHints = routeHints
    self.tags = tags
    self.metadata = metadata
  }
}

/// Binding from a manifest to a concrete runtime adapter.
public struct PraxisCapabilityBinding: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let bindingKey: String
  public let state: PraxisCapabilityBindingState
  public let runtimeKind: String?
  public let generation: Int
  public let prioritySummary: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a capability binding.
  ///
  /// - Parameters:
  ///   - capabilityID: Bound capability identifier.
  ///   - bindingKey: Stable binding key or adapter identifier.
  ///   - state: Binding lifecycle state.
  ///   - runtimeKind: Optional runtime kind implementing the binding.
  ///   - generation: Manifest generation the binding is compatible with.
  ///   - prioritySummary: Optional priority class summary.
  ///   - metadata: Extra plain-data metadata preserved with the binding.
  public init(
    capabilityID: PraxisCapabilityID,
    bindingKey: String,
    state: PraxisCapabilityBindingState = .active,
    runtimeKind: String? = nil,
    generation: Int = 1,
    prioritySummary: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.capabilityID = capabilityID
    self.bindingKey = bindingKey
    self.state = state
    self.runtimeKind = runtimeKind
    self.generation = generation
    self.prioritySummary = prioritySummary
    self.metadata = metadata
  }
}

/// Invocation request created by the planning layer.
public struct PraxisCapabilityInvocationRequest: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let operation: String
  public let inputSummary: String
  public let inputPayload: [String: PraxisValue]?
  public let timeoutMs: Int?
  public let idempotencyKey: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a capability invocation request.
  ///
  /// - Parameters:
  ///   - capabilityID: Capability identifier being requested.
  ///   - operation: Capability operation or sub-command.
  ///   - inputSummary: Human-readable summary of the request input.
  ///   - inputPayload: Optional structured plain-data payload.
  ///   - timeoutMs: Optional timeout in milliseconds.
  ///   - idempotencyKey: Optional stable idempotency key.
  ///   - metadata: Extra plain-data metadata preserved with the request.
  public init(
    capabilityID: PraxisCapabilityID,
    operation: String? = nil,
    inputSummary: String,
    inputPayload: [String: PraxisValue]? = nil,
    timeoutMs: Int? = nil,
    idempotencyKey: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.capabilityID = capabilityID
    self.operation = operation ?? capabilityID.rawValue
    self.inputSummary = inputSummary
    self.inputPayload = inputPayload
    self.timeoutMs = timeoutMs
    self.idempotencyKey = idempotencyKey
    self.metadata = metadata
  }
}

/// Execution preferences and governance hints attached to a capability.
public struct PraxisCapabilityExecutionPolicy: Sendable, Equatable, Codable {
  public let requiresReview: Bool
  public let prefersStructuredOutput: Bool
  public let supportsStreaming: Bool
  public let supportsCancellation: Bool
  public let supportsPrepare: Bool
  public let queuePreference: String?
  public let metadata: [String: PraxisValue]?

  /// Creates a capability execution policy.
  ///
  /// - Parameters:
  ///   - requiresReview: Whether capability use requires explicit review.
  ///   - prefersStructuredOutput: Whether planners should prefer structured outputs.
  ///   - supportsStreaming: Whether the capability supports streaming output.
  ///   - supportsCancellation: Whether the capability supports cancellation.
  ///   - supportsPrepare: Whether the capability supports a separate prepare step.
  ///   - queuePreference: Optional queue class preference.
  ///   - metadata: Extra plain-data metadata preserved with the policy.
  public init(
    requiresReview: Bool,
    prefersStructuredOutput: Bool,
    supportsStreaming: Bool = false,
    supportsCancellation: Bool = false,
    supportsPrepare: Bool = true,
    queuePreference: String? = nil,
    metadata: [String: PraxisValue]? = nil
  ) {
    self.requiresReview = requiresReview
    self.prefersStructuredOutput = prefersStructuredOutput
    self.supportsStreaming = supportsStreaming
    self.supportsCancellation = supportsCancellation
    self.supportsPrepare = supportsPrepare
    self.queuePreference = queuePreference
    self.metadata = metadata
  }
}
