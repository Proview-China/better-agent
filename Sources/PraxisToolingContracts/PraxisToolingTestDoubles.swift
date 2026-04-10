/// In-memory fake shell executor for HostContracts and HostRuntime tests.
public actor PraxisFakeShellExecutor: PraxisShellExecutor {
  private var resultsByCommand: [String: PraxisShellResult]
  private var executedCommands: [PraxisShellCommand] = []

  public init(resultsByCommand: [String: PraxisShellResult] = [:]) {
    self.resultsByCommand = resultsByCommand
  }

  public func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult {
    executedCommands.append(command)
    return resultsByCommand[command.command] ?? PraxisShellResult(stdout: "", stderr: "", exitCode: 0)
  }

  public func allExecutedCommands() async -> [PraxisShellCommand] {
    executedCommands
  }
}

/// Spy browser executor that records navigation requests.
public actor PraxisSpyBrowserExecutor: PraxisBrowserExecutor {
  private var requests: [PraxisBrowserNavigationRequest] = []
  private let receiptFactory: @Sendable (PraxisBrowserNavigationRequest) -> PraxisBrowserNavigationReceipt

  public init(
    receiptFactory: @escaping @Sendable (PraxisBrowserNavigationRequest) -> PraxisBrowserNavigationReceipt = {
      PraxisBrowserNavigationReceipt(requestedURL: $0.url, finalURL: $0.url)
    }
  ) {
    self.receiptFactory = receiptFactory
  }

  public func navigate(_ request: PraxisBrowserNavigationRequest) async throws -> PraxisBrowserNavigationReceipt {
    requests.append(request)
    return receiptFactory(request)
  }

  public func allRequests() async -> [PraxisBrowserNavigationRequest] {
    requests
  }
}

/// Stub browser grounding collector that returns deterministic evidence bundles.
public struct PraxisStubBrowserGroundingCollector: PraxisBrowserGroundingCollector, Sendable {
  public let bundleFactory: @Sendable (PraxisBrowserGroundingRequest) -> PraxisBrowserGroundingEvidenceBundle

  public init(
    bundleFactory: @escaping @Sendable (PraxisBrowserGroundingRequest) -> PraxisBrowserGroundingEvidenceBundle
  ) {
    self.bundleFactory = bundleFactory
  }

  public func collectEvidence(_ request: PraxisBrowserGroundingRequest) async throws -> PraxisBrowserGroundingEvidenceBundle {
    bundleFactory(request)
  }
}

/// Stub system git probe used to model host readiness states.
public struct PraxisStubGitAvailabilityProbe: PraxisGitAvailabilityProbe, Sendable {
  public let report: PraxisGitAvailabilityReport

  public init(report: PraxisGitAvailabilityReport) {
    self.report = report
  }

  public func probeGitReadiness() async -> PraxisGitAvailabilityReport {
    report
  }
}

/// In-memory fake git executor that records applied plans.
public actor PraxisFakeGitExecutor: PraxisGitExecutor {
  private var plans: [PraxisGitPlan] = []
  private let receiptFactory: @Sendable (PraxisGitPlan) -> PraxisGitExecutionReceipt

  public init(
    receiptFactory: @escaping @Sendable (PraxisGitPlan) -> PraxisGitExecutionReceipt = {
      PraxisGitExecutionReceipt(operationID: $0.operationID, status: .applied, outputSummary: $0.summary)
    }
  ) {
    self.receiptFactory = receiptFactory
  }

  public func apply(_ plan: PraxisGitPlan) async throws -> PraxisGitExecutionReceipt {
    plans.append(plan)
    return receiptFactory(plan)
  }

  public func allPlans() async -> [PraxisGitPlan] {
    plans
  }
}

/// Stub process supervisor that returns canned task updates by handle identifier.
public struct PraxisStubProcessSupervisor: PraxisProcessSupervisor, Sendable {
  public let updatesByIdentifier: [String: PraxisLongRunningTaskUpdate]

  public init(updatesByIdentifier: [String: PraxisLongRunningTaskUpdate] = [:]) {
    self.updatesByIdentifier = updatesByIdentifier
  }

  public func poll(handle: PraxisLongRunningTaskHandle) async throws -> PraxisLongRunningTaskUpdate {
    updatesByIdentifier[handle.identifier]
      ?? PraxisLongRunningTaskUpdate(handle: handle, status: .running)
  }
}
