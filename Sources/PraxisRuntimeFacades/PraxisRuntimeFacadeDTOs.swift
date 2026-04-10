import PraxisRun

public struct PraxisRunSummary: Sendable, Equatable, Codable {
  public let runID: PraxisRunID
  public let phaseSummary: String

  public init(runID: PraxisRunID, phaseSummary: String) {
    self.runID = runID
    self.phaseSummary = phaseSummary
  }
}

public struct PraxisInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String

  public init(summary: String) {
    self.summary = summary
  }
}

public struct PraxisTapInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let governanceSummary: String
  public let reviewSummary: String

  public init(summary: String, governanceSummary: String, reviewSummary: String) {
    self.summary = summary
    self.governanceSummary = governanceSummary
    self.reviewSummary = reviewSummary
  }
}

public struct PraxisCmpInspectionSnapshot: Sendable, Equatable, Codable {
  public let summary: String
  public let projectID: String
  public let hostRuntimeSummary: String
  public let persistenceSummary: String
  public let coordinationSummary: String

  public init(
    summary: String,
    projectID: String,
    hostRuntimeSummary: String,
    persistenceSummary: String,
    coordinationSummary: String
  ) {
    self.summary = summary
    self.projectID = projectID
    self.hostRuntimeSummary = hostRuntimeSummary
    self.persistenceSummary = persistenceSummary
    self.coordinationSummary = coordinationSummary
  }
}
