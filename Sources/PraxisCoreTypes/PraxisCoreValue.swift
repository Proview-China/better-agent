import Foundation

public enum PraxisValue: Sendable, Equatable, Codable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case object([String: PraxisValue])
  case array([PraxisValue])
  case null

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

    if container.decodeNil() {
      self = .null
      return
    }

    if let value =
      container.decodeValue(Bool.self, map: PraxisValue.bool) ??
      container.decodeValue(Int.self, map: { .number(Double($0)) }) ??
      container.decodeValue(Double.self, map: PraxisValue.number) ??
      container.decodeValue(String.self, map: PraxisValue.string) ??
      container.decodeValue([String: PraxisValue].self, map: PraxisValue.object) ??
      container.decodeValue([PraxisValue].self, map: PraxisValue.array)
    {
      self = value
      return
    }

    throw DecodingError.dataCorruptedError(
      in: container,
      debugDescription: "PraxisValue only supports JSON-like plain data."
    )
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let value):
      try container.encode(value)
    case .number(let value):
      try container.encode(value)
    case .bool(let value):
      try container.encode(value)
    case .object(let value):
      try container.encode(value)
    case .array(let value):
      try container.encode(value)
    case .null:
      try container.encodeNil()
    }
  }
}

public extension PraxisValue {
  var stringValue: String? {
    guard case .string(let value) = self else {
      return nil
    }
    return value
  }

  var boolValue: Bool? {
    guard case .bool(let value) = self else {
      return nil
    }
    return value
  }

  var numberValue: Double? {
    guard case .number(let value) = self else {
      return nil
    }
    return value
  }

  var objectValue: [String: PraxisValue]? {
    guard case .object(let value) = self else {
      return nil
    }
    return value
  }

  var arrayValue: [PraxisValue]? {
    guard case .array(let value) = self else {
      return nil
    }
    return value
  }

  var canonicalDescription: String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    guard let data = try? encoder.encode(self),
          let string = String(data: data, encoding: .utf8) else {
      return "null"
    }
    return string
  }
}

extension PraxisValue: ExpressibleByStringLiteral {
  public init(stringLiteral value: String) {
    self = .string(value)
  }
}

extension PraxisValue: ExpressibleByBooleanLiteral {
  public init(booleanLiteral value: Bool) {
    self = .bool(value)
  }
}

extension PraxisValue: ExpressibleByIntegerLiteral {
  public init(integerLiteral value: Int) {
    self = .number(Double(value))
  }
}

extension PraxisValue: ExpressibleByFloatLiteral {
  public init(floatLiteral value: Double) {
    self = .number(value)
  }
}

extension PraxisValue: ExpressibleByNilLiteral {
  public init(nilLiteral: ()) {
    self = .null
  }
}

extension PraxisValue: ExpressibleByArrayLiteral {
  public init(arrayLiteral elements: PraxisValue...) {
    self = .array(elements)
  }
}

extension PraxisValue: ExpressibleByDictionaryLiteral {
  public init(dictionaryLiteral elements: (String, PraxisValue)...) {
    self = .object(Dictionary(uniqueKeysWithValues: elements))
  }
}

private extension SingleValueDecodingContainer {
  func decodeValue<T: Decodable>(
    _ type: T.Type,
    map: (T) -> PraxisValue
  ) -> PraxisValue? {
    guard let value = try? decode(type) else {
      return nil
    }
    return map(value)
  }
}
