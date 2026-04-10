import PraxisCoreTypes

public enum PraxisWorkspaceSearchKind: String, Sendable, Codable {
  case fullText
  case fileName
  case symbol
}

public struct PraxisWorkspaceLineRange: Sendable, Equatable, Codable {
  public let startLine: Int
  public let endLine: Int

  public init(startLine: Int, endLine: Int) {
    self.startLine = startLine
    self.endLine = endLine
  }
}

public struct PraxisWorkspaceReadRequest: Sendable, Equatable, Codable {
  public let path: String
  public let range: PraxisWorkspaceLineRange?
  public let includeRevisionToken: Bool
  public let metadata: [String: PraxisValue]

  public init(
    path: String,
    range: PraxisWorkspaceLineRange? = nil,
    includeRevisionToken: Bool = false,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.path = path
    self.range = range
    self.includeRevisionToken = includeRevisionToken
    self.metadata = metadata
  }
}

public struct PraxisWorkspaceReadResult: Sendable, Equatable, Codable {
  public let path: String
  public let content: String
  public let revisionToken: String?
  public let lineCount: Int

  public init(path: String, content: String, revisionToken: String? = nil, lineCount: Int) {
    self.path = path
    self.content = content
    self.revisionToken = revisionToken
    self.lineCount = lineCount
  }
}

public struct PraxisWorkspaceSearchRequest: Sendable, Equatable, Codable {
  public let query: String
  public let kind: PraxisWorkspaceSearchKind
  public let roots: [String]
  public let filePattern: String?
  public let maxResults: Int

  public init(
    query: String,
    kind: PraxisWorkspaceSearchKind = .fullText,
    roots: [String] = [],
    filePattern: String? = nil,
    maxResults: Int = 20
  ) {
    self.query = query
    self.kind = kind
    self.roots = roots
    self.filePattern = filePattern
    self.maxResults = maxResults
  }
}

public struct PraxisWorkspaceSearchMatch: Sendable, Equatable, Codable {
  public let path: String
  public let line: Int?
  public let column: Int?
  public let summary: String
  public let snippet: String?

  public init(
    path: String,
    line: Int? = nil,
    column: Int? = nil,
    summary: String,
    snippet: String? = nil
  ) {
    self.path = path
    self.line = line
    self.column = column
    self.summary = summary
    self.snippet = snippet
  }
}

public enum PraxisWorkspaceChangeKind: String, Sendable, Codable {
  case createFile
  case updateFile
  case deleteFile
  case applyPatch
}

public struct PraxisWorkspaceFileChange: Sendable, Equatable, Codable {
  public let kind: PraxisWorkspaceChangeKind
  public let path: String
  public let content: String?
  public let patch: String?
  public let expectedRevisionToken: String?

  public init(
    kind: PraxisWorkspaceChangeKind,
    path: String,
    content: String? = nil,
    patch: String? = nil,
    expectedRevisionToken: String? = nil
  ) {
    self.kind = kind
    self.path = path
    self.content = content
    self.patch = patch
    self.expectedRevisionToken = expectedRevisionToken
  }
}

public struct PraxisWorkspaceChangeRequest: Sendable, Equatable, Codable {
  public let changes: [PraxisWorkspaceFileChange]
  public let changeSummary: String
  public let metadata: [String: PraxisValue]

  public init(
    changes: [PraxisWorkspaceFileChange],
    changeSummary: String,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.changes = changes
    self.changeSummary = changeSummary
    self.metadata = metadata
  }
}

public struct PraxisWorkspaceChangeReceipt: Sendable, Equatable, Codable {
  public let changedPaths: [String]
  public let appliedChangeCount: Int
  public let summary: String

  public init(changedPaths: [String], appliedChangeCount: Int, summary: String) {
    self.changedPaths = changedPaths
    self.appliedChangeCount = appliedChangeCount
    self.summary = summary
  }
}
