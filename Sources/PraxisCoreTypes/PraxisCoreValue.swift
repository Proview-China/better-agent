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

    if let bool = try? container.decode(Bool.self) {
      self = .bool(bool)
      return
    }

    if let int = try? container.decode(Int.self) {
      self = .number(Double(int))
      return
    }

    if let double = try? container.decode(Double.self) {
      self = .number(double)
      return
    }

    if let string = try? container.decode(String.self) {
      self = .string(string)
      return
    }

    if let object = try? container.decode([String: PraxisValue].self) {
      self = .object(object)
      return
    }

    if let array = try? container.decode([PraxisValue].self) {
      self = .array(array)
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
