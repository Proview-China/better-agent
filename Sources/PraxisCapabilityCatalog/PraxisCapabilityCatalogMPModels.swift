import PraxisCapabilityContracts

public enum PraxisMpCapabilityKey: String, Sendable, Codable, CaseIterable {
  case ingest = "mp.ingest"
  case align = "mp.align"
  case resolve = "mp.resolve"
  case historyRequest = "mp.history.request"
  case search = "mp.search"
  case materialize = "mp.materialize"
  case promote = "mp.promote"
  case archive = "mp.archive"
  case split = "mp.split"
  case merge = "mp.merge"
  case reindex = "mp.reindex"
  case compact = "mp.compact"

  public var capabilityID: PraxisCapabilityID {
    PraxisCapabilityID(rawValue: rawValue)
  }
}

public struct PraxisMpCapabilityBaseline: Sendable, Equatable, Codable {
  public let familyName: String
  public let summary: String
  public let capabilityIDs: [PraxisCapabilityID]

  public init(
    familyName: String,
    summary: String,
    capabilityIDs: [PraxisCapabilityID]
  ) {
    self.familyName = familyName
    self.summary = summary
    self.capabilityIDs = capabilityIDs
  }
}

public extension PraxisCapabilityCatalogBuilder {
  func buildMpBaseline() -> PraxisMpCapabilityBaseline {
    PraxisMpCapabilityBaseline(
      familyName: "mp",
      summary: "MP family covers ingest, alignment, retrieval, materialization, promotion, and maintenance workflows.",
      capabilityIDs: PraxisMpCapabilityKey.allCases.map(\.capabilityID)
    )
  }
}
