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
  public let requestedFacts: [String]
  public let locale: String?
  public let maxPages: Int

  public init(
    taskSummary: String,
    exampleURL: String? = nil,
    requestedFacts: [String] = [],
    locale: String? = nil,
    maxPages: Int = 5
  ) {
    self.taskSummary = taskSummary
    self.exampleURL = exampleURL
    self.requestedFacts = requestedFacts
    self.locale = locale
    self.maxPages = maxPages
  }
}

public struct PraxisBrowserGroundingPageEvidence: Sendable, Equatable, Codable {
  public let role: PraxisBrowserGroundingSourceRole
  public let url: String
  public let title: String?
  public let snapshotPath: String?
  public let screenshotPath: String?
  public let capturedAt: String?

  public init(
    role: PraxisBrowserGroundingSourceRole,
    url: String,
    title: String? = nil,
    snapshotPath: String? = nil,
    screenshotPath: String? = nil,
    capturedAt: String? = nil
  ) {
    self.role = role
    self.url = url
    self.title = title
    self.snapshotPath = snapshotPath
    self.screenshotPath = screenshotPath
    self.capturedAt = capturedAt
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
  public let citationSnippet: String?
  public let observedAt: String?

  public init(
    name: String,
    status: PraxisBrowserGroundingFactStatus,
    value: String? = nil,
    unit: String? = nil,
    detail: String? = nil,
    sourceRole: PraxisBrowserGroundingSourceRole? = nil,
    sourceURL: String? = nil,
    sourceTitle: String? = nil,
    citationSnippet: String? = nil,
    observedAt: String? = nil
  ) {
    self.name = name
    self.status = status
    self.value = value
    self.unit = unit
    self.detail = detail
    self.sourceRole = sourceRole
    self.sourceURL = sourceURL
    self.sourceTitle = sourceTitle
    self.citationSnippet = citationSnippet
    self.observedAt = observedAt
  }
}

public struct PraxisBrowserGroundingEvidenceBundle: Sendable, Equatable, Codable {
  public let request: PraxisBrowserGroundingRequest?
  public let pages: [PraxisBrowserGroundingPageEvidence]
  public let facts: [PraxisBrowserGroundingFactEvidence]
  public let generatedAt: String?
  public let blockedReason: String?

  public init(
    request: PraxisBrowserGroundingRequest? = nil,
    pages: [PraxisBrowserGroundingPageEvidence],
    facts: [PraxisBrowserGroundingFactEvidence],
    generatedAt: String? = nil,
    blockedReason: String? = nil
  ) {
    self.request = request
    self.pages = pages
    self.facts = facts
    self.generatedAt = generatedAt
    self.blockedReason = blockedReason
  }
}
