public struct PraxisShellCommand: Sendable, Equatable, Codable {
  public let command: String

  public init(command: String) {
    self.command = command
  }
}

public struct PraxisShellResult: Sendable, Equatable, Codable {
  public let stdout: String
  public let stderr: String
  public let exitCode: Int32

  public init(stdout: String, stderr: String, exitCode: Int32) {
    self.stdout = stdout
    self.stderr = stderr
    self.exitCode = exitCode
  }
}

public struct PraxisBrowserNavigationRequest: Sendable, Equatable, Codable {
  public let url: String

  public init(url: String) {
    self.url = url
  }
}

public struct PraxisGitPlan: Sendable, Equatable, Codable {
  public let summary: String

  public init(summary: String) {
    self.summary = summary
  }
}

public enum PraxisGitAvailabilityStatus: String, Sendable, Codable {
  case ready
  case installPromptExpected
  case unavailable
}

public struct PraxisGitAvailabilityReport: Sendable, Equatable, Codable {
  public let status: PraxisGitAvailabilityStatus
  public let executablePath: String?
  public let notes: String

  public init(
    status: PraxisGitAvailabilityStatus,
    executablePath: String? = nil,
    notes: String
  ) {
    self.status = status
    self.executablePath = executablePath
    self.notes = notes
  }
}

public struct PraxisLongRunningTaskHandle: Sendable, Equatable, Codable {
  public let identifier: String

  public init(identifier: String) {
    self.identifier = identifier
  }
}
