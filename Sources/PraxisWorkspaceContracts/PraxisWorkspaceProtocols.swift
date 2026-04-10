public protocol PraxisWorkspaceReader: Sendable {
  /// Reads workspace content from a single file path.
  ///
  /// - Parameter request: Structured workspace read request.
  /// - Returns: A normalized read result.
  func read(_ request: PraxisWorkspaceReadRequest) async throws -> PraxisWorkspaceReadResult
}

public protocol PraxisWorkspaceSearcher: Sendable {
  /// Searches the workspace using the supplied search mode.
  ///
  /// - Parameter request: Structured workspace search request.
  /// - Returns: Search matches ordered by host preference.
  func search(_ request: PraxisWorkspaceSearchRequest) async throws -> [PraxisWorkspaceSearchMatch]
}

public protocol PraxisWorkspaceWriter: Sendable {
  /// Applies one or more workspace changes.
  ///
  /// - Parameter request: Structured workspace change request.
  /// - Returns: A change receipt describing the affected paths.
  func apply(_ request: PraxisWorkspaceChangeRequest) async throws -> PraxisWorkspaceChangeReceipt
}
