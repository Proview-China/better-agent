public enum PraxisBrowserGroundingSourceRole: String, Sendable, Codable {
  case example
  case googleSearch
  case candidateSource
  case verifiedSource
}

public enum PraxisBrowserGroundingFactStatus: String, Sendable, Codable {
  case observed
  case candidate
  case verified
  case blocked
}

public struct PraxisBrowserGroundingRequest: Sendable, Equatable, Codable {
  public let taskSummary: String
  public let exampleURL: String?

  public init(taskSummary: String, exampleURL: String? = nil) {
    self.taskSummary = taskSummary
    self.exampleURL = exampleURL
  }
}

public struct PraxisBrowserGroundingPageEvidence: Sendable, Equatable, Codable {
  public let role: PraxisBrowserGroundingSourceRole
  public let url: String
  public let title: String?
  public let snapshotPath: String?
  public let screenshotPath: String?

  public init(
    role: PraxisBrowserGroundingSourceRole,
    url: String,
    title: String? = nil,
    snapshotPath: String? = nil,
    screenshotPath: String? = nil
  ) {
    self.role = role
    self.url = url
    self.title = title
    self.snapshotPath = snapshotPath
    self.screenshotPath = screenshotPath
  }
}

public struct PraxisBrowserGroundingFactEvidence: Sendable, Equatable, Codable {
  public let name: String
  public let status: PraxisBrowserGroundingFactStatus
  public let value: String?
  public let unit: String?
  public let detail: String?
  public let sourceRole: PraxisBrowserGroundingSourceRole?
  public let sourceURL: String?
  public let sourceTitle: String?

  public init(
    name: String,
    status: PraxisBrowserGroundingFactStatus,
    value: String? = nil,
    unit: String? = nil,
    detail: String? = nil,
    sourceRole: PraxisBrowserGroundingSourceRole? = nil,
    sourceURL: String? = nil,
    sourceTitle: String? = nil
  ) {
    self.name = name
    self.status = status
    self.value = value
    self.unit = unit
    self.detail = detail
    self.sourceRole = sourceRole
    self.sourceURL = sourceURL
    self.sourceTitle = sourceTitle
  }
}

public struct PraxisBrowserGroundingEvidenceBundle: Sendable, Equatable, Codable {
  public let pages: [PraxisBrowserGroundingPageEvidence]
  public let facts: [PraxisBrowserGroundingFactEvidence]

  public init(
    pages: [PraxisBrowserGroundingPageEvidence],
    facts: [PraxisBrowserGroundingFactEvidence]
  ) {
    self.pages = pages
    self.facts = facts
  }
}
