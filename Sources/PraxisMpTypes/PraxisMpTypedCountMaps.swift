public struct PraxisMpTypedCountMap<Key>: Sendable, Equatable, Codable
where Key: Hashable & RawRepresentable & Sendable, Key.RawValue == String {
  enum ValidationError: Error, Equatable {
    case invalidKey(String)
  }

  public static var empty: Self {
    Self(counts: [:])
  }

  public let counts: [Key: Int]

  public init(counts: [Key: Int]) {
    self.counts = counts
  }

  public subscript(_ key: Key) -> Int? {
    counts[key]
  }

  public var isEmpty: Bool {
    counts.isEmpty
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    var typedCounts: [Key: Int] = [:]

    for key in container.allKeys {
      guard let typedKey = Key(rawValue: key.stringValue) else {
        throw DecodingError.dataCorruptedError(
          forKey: key,
          in: container,
          debugDescription: "Invalid MP typed count-map key \(key.stringValue)."
        )
      }

      typedCounts[typedKey] = try container.decode(Int.self, forKey: key)
    }

    self.counts = typedCounts
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)

    for key in counts.keys.sorted(by: { $0.rawValue < $1.rawValue }) {
      let codingKey = DynamicCodingKey(stringValue: key.rawValue)!
      try container.encode(counts[key], forKey: codingKey)
    }
  }

  private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(intValue: Int) {
      self.stringValue = String(intValue)
      self.intValue = intValue
    }
  }
}

public typealias PraxisMpFreshnessBreakdownMap = PraxisMpTypedCountMap<PraxisMpMemoryFreshnessStatus>
public typealias PraxisMpAlignmentBreakdownMap = PraxisMpTypedCountMap<PraxisMpMemoryAlignmentStatus>
public typealias PraxisMpScopeBreakdownMap = PraxisMpTypedCountMap<PraxisMpScopeLevel>
