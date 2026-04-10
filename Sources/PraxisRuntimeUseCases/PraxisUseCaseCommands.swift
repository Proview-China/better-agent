import PraxisGoal
import PraxisRun
import PraxisSession
import PraxisTapGovernance
import PraxisTapReview
import PraxisTapRuntime

public struct PraxisRunGoalCommand: Sendable, Equatable, Codable {
  public let goal: PraxisCompiledGoal
  public let sessionID: PraxisSessionID?

  public init(goal: PraxisCompiledGoal, sessionID: PraxisSessionID? = nil) {
    self.goal = goal
    self.sessionID = sessionID
  }
}

public struct PraxisResumeRunCommand: Sendable, Equatable, Codable {
  public let runID: PraxisRunID

  public init(runID: PraxisRunID) {
    self.runID = runID
  }
}

public struct PraxisTapInspection: Sendable, Equatable, Codable {
  public let summary: String
  public let governanceSnapshot: PraxisGovernanceSnapshot
  public let reviewContext: PraxisReviewContextAperture
  public let toolReviewReport: PraxisToolReviewReport
  public let runtimeSnapshot: PraxisTapRuntimeSnapshot

  public init(
    summary: String,
    governanceSnapshot: PraxisGovernanceSnapshot,
    reviewContext: PraxisReviewContextAperture,
    toolReviewReport: PraxisToolReviewReport,
    runtimeSnapshot: PraxisTapRuntimeSnapshot
  ) {
    self.summary = summary
    self.governanceSnapshot = governanceSnapshot
    self.reviewContext = reviewContext
    self.toolReviewReport = toolReviewReport
    self.runtimeSnapshot = runtimeSnapshot
  }
}

public struct PraxisCmpInspection: Sendable, Equatable, Codable {
  public let runtimeProfile: PraxisCmpLocalRuntimeProfile
  public let summary: String
  public let projectID: String
  public let issues: [String]
  public let hostSummary: String

  public init(
    runtimeProfile: PraxisCmpLocalRuntimeProfile,
    summary: String,
    projectID: String,
    issues: [String],
    hostSummary: String
  ) {
    self.runtimeProfile = runtimeProfile
    self.summary = summary
    self.projectID = projectID
    self.issues = issues
    self.hostSummary = hostSummary
  }
}

public struct PraxisCmpLocalRuntimeProfile: Sendable, Equatable, Codable {
  public let structuredStoreSummary: String
  public let deliveryStoreSummary: String
  public let messageBusSummary: String
  public let gitSummary: String
  public let semanticIndexSummary: String

  public init(
    structuredStoreSummary: String,
    deliveryStoreSummary: String,
    messageBusSummary: String,
    gitSummary: String,
    semanticIndexSummary: String
  ) {
    self.structuredStoreSummary = structuredStoreSummary
    self.deliveryStoreSummary = deliveryStoreSummary
    self.messageBusSummary = messageBusSummary
    self.gitSummary = gitSummary
    self.semanticIndexSummary = semanticIndexSummary
  }
}
