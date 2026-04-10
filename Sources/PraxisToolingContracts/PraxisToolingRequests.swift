public enum PraxisToolingOutputMode: String, Sendable, Codable {
  case buffered
  case streaming
}

public enum PraxisShellTerminationReason: String, Sendable, Codable {
  case exited
  case timedOut
  case cancelled
  case failedToLaunch
}

public struct PraxisShellCommand: Sendable, Equatable, Codable {
  public let command: String
  public let workingDirectory: String?
  public let environment: [String: String]
  public let timeoutSeconds: Double?
  public let outputMode: PraxisToolingOutputMode
  public let requiresPTY: Bool

  public init(
    command: String,
    workingDirectory: String? = nil,
    environment: [String: String] = [:],
    timeoutSeconds: Double? = nil,
    outputMode: PraxisToolingOutputMode = .buffered,
    requiresPTY: Bool = false
  ) {
    self.command = command
    self.workingDirectory = workingDirectory
    self.environment = environment
    self.timeoutSeconds = timeoutSeconds
    self.outputMode = outputMode
    self.requiresPTY = requiresPTY
  }
}

public struct PraxisShellResult: Sendable, Equatable, Codable {
  public let stdout: String
  public let stderr: String
  public let exitCode: Int32
  public let durationMilliseconds: Int?
  public let terminationReason: PraxisShellTerminationReason
  public let outputWasTruncated: Bool

  public init(
    stdout: String,
    stderr: String,
    exitCode: Int32,
    durationMilliseconds: Int? = nil,
    terminationReason: PraxisShellTerminationReason = .exited,
    outputWasTruncated: Bool = false
  ) {
    self.stdout = stdout
    self.stderr = stderr
    self.exitCode = exitCode
    self.durationMilliseconds = durationMilliseconds
    self.terminationReason = terminationReason
    self.outputWasTruncated = outputWasTruncated
  }
}

public enum PraxisBrowserWaitPolicy: String, Sendable, Codable {
  case none
  case domReady
  case networkIdle
}

public struct PraxisBrowserNavigationRequest: Sendable, Equatable, Codable {
  public let url: String
  public let waitPolicy: PraxisBrowserWaitPolicy
  public let timeoutSeconds: Double?
  public let preferredTitle: String?
  public let captureSnapshot: Bool

  public init(
    url: String,
    waitPolicy: PraxisBrowserWaitPolicy = .domReady,
    timeoutSeconds: Double? = nil,
    preferredTitle: String? = nil,
    captureSnapshot: Bool = false
  ) {
    self.url = url
    self.waitPolicy = waitPolicy
    self.timeoutSeconds = timeoutSeconds
    self.preferredTitle = preferredTitle
    self.captureSnapshot = captureSnapshot
  }
}

public struct PraxisBrowserNavigationReceipt: Sendable, Equatable, Codable {
  public let requestedURL: String
  public let finalURL: String
  public let title: String?
  public let snapshotPath: String?

  public init(
    requestedURL: String,
    finalURL: String,
    title: String? = nil,
    snapshotPath: String? = nil
  ) {
    self.requestedURL = requestedURL
    self.finalURL = finalURL
    self.title = title
    self.snapshotPath = snapshotPath
  }
}

public enum PraxisGitStepKind: String, Sendable, Codable {
  case verifyRepository
  case fetch
  case checkout
  case commit
  case push
  case merge
  case inspectRef
  case updateRef
}

public struct PraxisGitPlanStep: Sendable, Equatable, Codable {
  public let kind: PraxisGitStepKind
  public let summary: String
  public let arguments: [String: String]
  public let allowsPrompt: Bool

  public init(
    kind: PraxisGitStepKind,
    summary: String,
    arguments: [String: String] = [:],
    allowsPrompt: Bool = false
  ) {
    self.kind = kind
    self.summary = summary
    self.arguments = arguments
    self.allowsPrompt = allowsPrompt
  }
}

public struct PraxisGitPlan: Sendable, Equatable, Codable {
  public let operationID: String
  public let repositoryRoot: String?
  public let steps: [PraxisGitPlanStep]
  public let summary: String

  public init(
    operationID: String,
    repositoryRoot: String? = nil,
    steps: [PraxisGitPlanStep] = [],
    summary: String
  ) {
    self.operationID = operationID
    self.repositoryRoot = repositoryRoot
    self.steps = steps
    self.summary = summary
  }
}

public enum PraxisGitExecutionStatus: String, Sendable, Codable {
  case applied
  case partial
  case rejected
}

public struct PraxisGitExecutionReceipt: Sendable, Equatable, Codable {
  public let operationID: String
  public let status: PraxisGitExecutionStatus
  public let outputSummary: String
  public let completedAt: String?

  public init(
    operationID: String,
    status: PraxisGitExecutionStatus,
    outputSummary: String,
    completedAt: String? = nil
  ) {
    self.operationID = operationID
    self.status = status
    self.outputSummary = outputSummary
    self.completedAt = completedAt
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
  public let versionString: String?
  public let supportsWorktree: Bool
  public let remediationHint: String?
  public let notes: String

  public init(
    status: PraxisGitAvailabilityStatus,
    executablePath: String? = nil,
    versionString: String? = nil,
    supportsWorktree: Bool = false,
    remediationHint: String? = nil,
    notes: String
  ) {
    self.status = status
    self.executablePath = executablePath
    self.versionString = versionString
    self.supportsWorktree = supportsWorktree
    self.remediationHint = remediationHint
    self.notes = notes
  }
}

public enum PraxisLongRunningTaskOrigin: String, Sendable, Codable {
  case shell
  case browser
  case git
  case provider
}

public struct PraxisLongRunningTaskHandle: Sendable, Equatable, Codable {
  public let identifier: String
  public let origin: PraxisLongRunningTaskOrigin
  public let startedAt: String?

  public init(
    identifier: String,
    origin: PraxisLongRunningTaskOrigin = .shell,
    startedAt: String? = nil
  ) {
    self.identifier = identifier
    self.origin = origin
    self.startedAt = startedAt
  }
}

public enum PraxisLongRunningTaskStatus: String, Sendable, Codable {
  case running
  case succeeded
  case failed
  case cancelled
}

public struct PraxisLongRunningTaskUpdate: Sendable, Equatable, Codable {
  public let handle: PraxisLongRunningTaskHandle
  public let status: PraxisLongRunningTaskStatus
  public let stdoutTail: String?
  public let stderrTail: String?
  public let exitCode: Int32?
  public let finishedAt: String?

  public init(
    handle: PraxisLongRunningTaskHandle,
    status: PraxisLongRunningTaskStatus,
    stdoutTail: String? = nil,
    stderrTail: String? = nil,
    exitCode: Int32? = nil,
    finishedAt: String? = nil
  ) {
    self.handle = handle
    self.status = status
    self.stdoutTail = stdoutTail
    self.stderrTail = stderrTail
    self.exitCode = exitCode
    self.finishedAt = finishedAt
  }
}
