public protocol PraxisShellExecutor: Sendable {
  /// Executes a structured shell command request.
  ///
  /// - Parameter command: Command request to run.
  /// - Returns: A normalized shell execution result.
  func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult
}

public protocol PraxisBrowserExecutor: Sendable {
  /// Navigates the host browser to the requested location.
  ///
  /// - Parameter request: Navigation request to execute.
  /// - Returns: A receipt describing the loaded page.
  func navigate(_ request: PraxisBrowserNavigationRequest) async throws -> PraxisBrowserNavigationReceipt
}

public protocol PraxisBrowserGroundingCollector: Sendable {
  /// Collects browser-grounded evidence for a task.
  ///
  /// - Parameter request: Browser grounding request.
  /// - Returns: A normalized evidence bundle.
  func collectEvidence(_ request: PraxisBrowserGroundingRequest) async throws -> PraxisBrowserGroundingEvidenceBundle
}

public protocol PraxisGitAvailabilityProbe: Sendable {
  /// Probes whether system git is ready for host use.
  ///
  /// - Returns: A readiness report with remediation hints when unavailable.
  func probeGitReadiness() async -> PraxisGitAvailabilityReport
}

public protocol PraxisGitExecutor: Sendable {
  /// Applies a structured git plan through the host tooling layer.
  ///
  /// - Parameter plan: Git plan to apply.
  /// - Returns: A receipt describing the outcome.
  func apply(_ plan: PraxisGitPlan) async throws -> PraxisGitExecutionReceipt
}

public protocol PraxisProcessSupervisor: Sendable {
  /// Polls a long-running host task.
  ///
  /// - Parameter handle: Long-running task handle.
  /// - Returns: A task update describing current status and output tails.
  func poll(handle: PraxisLongRunningTaskHandle) async throws -> PraxisLongRunningTaskUpdate
}
