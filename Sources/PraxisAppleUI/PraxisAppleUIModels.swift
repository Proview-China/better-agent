public enum PraxisAppleRoute: String, Sendable, Codable, CaseIterable, Identifiable {
  case architecture
  case tap
  case cmp
  case mp
  case capabilityCatalog

  public var id: String {
    rawValue
  }

  public var title: String {
    switch self {
    case .architecture:
      return "Architecture"
    case .tap:
      return "TAP"
    case .cmp:
      return "CMP"
    case .mp:
      return "MP"
    case .capabilityCatalog:
      return "Capability Catalog"
    }
  }
}

public struct PraxisRunDashboardViewState: Sendable, Equatable {
  public let title: String
  public let summary: String

  public init(title: String, summary: String) {
    self.title = title
    self.summary = summary
  }
}

public struct PraxisSessionListViewState: Sendable, Equatable {
  public let title: String
  public let items: [String]

  public init(title: String, items: [String]) {
    self.title = title
    self.items = items
  }
}
