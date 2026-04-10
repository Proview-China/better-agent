public struct PraxisProviderWebSearchRequest: Sendable, Equatable, Codable {
  public let query: String
  public let locale: String?
  public let preferredDomains: [String]
  public let limit: Int

  public init(
    query: String,
    locale: String? = nil,
    preferredDomains: [String] = [],
    limit: Int = 5
  ) {
    self.query = query
    self.locale = locale
    self.preferredDomains = preferredDomains
    self.limit = limit
  }
}

public struct PraxisProviderWebSearchResult: Sendable, Equatable, Codable {
  public let title: String
  public let snippet: String
  public let url: String
  public let source: String?

  public init(title: String, snippet: String, url: String, source: String? = nil) {
    self.title = title
    self.snippet = snippet
    self.url = url
    self.source = source
  }
}

public struct PraxisProviderWebSearchResponse: Sendable, Equatable, Codable {
  public let query: String
  public let results: [PraxisProviderWebSearchResult]
  public let provider: String?
  public let summary: String?

  public init(
    query: String,
    results: [PraxisProviderWebSearchResult],
    provider: String? = nil,
    summary: String? = nil
  ) {
    self.query = query
    self.results = results
    self.provider = provider
    self.summary = summary
  }
}
