/// In-memory fake workspace reader keyed by absolute path.
public actor PraxisFakeWorkspaceReader: PraxisWorkspaceReader {
  private var filesByPath: [String: PraxisWorkspaceReadResult]
  private var requests: [PraxisWorkspaceReadRequest] = []

  public init(filesByPath: [String: PraxisWorkspaceReadResult] = [:]) {
    self.filesByPath = filesByPath
  }

  public func read(_ request: PraxisWorkspaceReadRequest) async throws -> PraxisWorkspaceReadResult {
    requests.append(request)
    if let result = filesByPath[request.path] {
      let content = slicedContent(for: result.content, range: request.range)
      let revisionToken = request.includeRevisionToken ? result.revisionToken : nil
      return PraxisWorkspaceReadResult(
        path: result.path,
        content: content,
        revisionToken: revisionToken,
        lineCount: lineCount(for: content)
      )
    }
    return PraxisWorkspaceReadResult(path: request.path, content: "", lineCount: 0)
  }

  public func allRequests() async -> [PraxisWorkspaceReadRequest] {
    requests
  }

  private func slicedContent(for content: String, range: PraxisWorkspaceLineRange?) -> String {
    guard let range else {
      return content
    }

    let lines = normalizedLines(from: content)
    guard !lines.isEmpty else {
      return ""
    }

    let startIndex = max(range.startLine - 1, 0)
    let endIndex = min(range.endLine - 1, lines.count - 1)
    guard startIndex <= endIndex, startIndex < lines.count else {
      return ""
    }

    return lines[startIndex...endIndex].joined(separator: "\n")
  }

  private func lineCount(for content: String) -> Int {
    normalizedLines(from: content).count
  }

  private func normalizedLines(from content: String) -> [String] {
    guard !content.isEmpty else {
      return []
    }

    var lines = content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    if content.hasSuffix("\n"), lines.last == "" {
      lines.removeLast()
    }
    return lines
  }
}

/// Stub workspace searcher with deterministic canned results.
public struct PraxisStubWorkspaceSearcher: PraxisWorkspaceSearcher, Sendable {
  public let resultsByQuery: [String: [PraxisWorkspaceSearchMatch]]

  public init(resultsByQuery: [String: [PraxisWorkspaceSearchMatch]] = [:]) {
    self.resultsByQuery = resultsByQuery
  }

  public func search(_ request: PraxisWorkspaceSearchRequest) async throws -> [PraxisWorkspaceSearchMatch] {
    Array((resultsByQuery[request.query] ?? []).prefix(request.maxResults))
  }
}

/// Spy workspace writer that records applied changes and returns a deterministic receipt.
public actor PraxisSpyWorkspaceWriter: PraxisWorkspaceWriter {
  private var requests: [PraxisWorkspaceChangeRequest] = []

  public init() {}

  public func apply(_ request: PraxisWorkspaceChangeRequest) async throws -> PraxisWorkspaceChangeReceipt {
    requests.append(request)
    let changedPaths = request.changes.map(\.path)
    return PraxisWorkspaceChangeReceipt(
      changedPaths: changedPaths,
      appliedChangeCount: changedPaths.count,
      summary: request.changeSummary
    )
  }

  public func allRequests() async -> [PraxisWorkspaceChangeRequest] {
    requests
  }
}
