import Foundation

/// Represents a normalized CMP branch/base/history reference hint.
///
/// This type carries only the host-neutral ref text needed by the CMP boundary
/// surfaces. It does not model Git topology, provider payloads, or transport details.
public struct PraxisCmpRefName:
  RawRepresentable,
  Hashable,
  Sendable,
  Equatable,
  Codable,
  CustomStringConvertible
{
  public let rawValue: String

  /// Creates a CMP ref hint from a raw boundary string.
  ///
  /// Leading and trailing whitespace is removed so interface and use-case layers
  /// converge on one stable host-neutral representation.
  ///
  /// - Parameter rawValue: Raw CMP ref text from a boundary payload.
  public init(rawValue: String) {
    self.rawValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  public var description: String {
    rawValue
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    self.init(rawValue: try container.decode(String.self))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }
}
