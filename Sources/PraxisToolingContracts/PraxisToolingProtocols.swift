public protocol PraxisShellExecutor: Sendable {
  func run(_ command: PraxisShellCommand) async throws -> PraxisShellResult
}

public protocol PraxisBrowserExecutor: Sendable {
  func navigate(_ request: PraxisBrowserNavigationRequest) async throws
}

public protocol PraxisGitAvailabilityProbe: Sendable {
  func probeGitReadiness() async -> PraxisGitAvailabilityReport
}

public protocol PraxisGitExecutor: Sendable {
  func apply(_ plan: PraxisGitPlan) async throws -> String
}

public protocol PraxisProcessSupervisor: Sendable {
  func poll(handle: PraxisLongRunningTaskHandle) async throws -> String
}
