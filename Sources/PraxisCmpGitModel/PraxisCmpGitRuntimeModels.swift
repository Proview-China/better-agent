import PraxisCmpTypes

public enum PraxisCmpGitBootstrapStatus: String, Sendable, Codable {
  case bootstrapped
  case alreadyExists
  case conflicted
}

public struct PraxisCmpProjectRepoBootstrapPlan: Sendable, Equatable, Codable {
  public let projectID: String
  public let repoName: String
  public let repoRootPath: String
  public let defaultBranchName: String
  public let lineages: [PraxisCmpLineageID]

  public init(
    projectID: String,
    repoName: String,
    repoRootPath: String,
    defaultBranchName: String,
    lineages: [PraxisCmpLineageID] = []
  ) {
    self.projectID = projectID
    self.repoName = repoName
    self.repoRootPath = repoRootPath
    self.defaultBranchName = defaultBranchName
    self.lineages = lineages
  }
}

public struct PraxisCmpGitBranchRuntime: Sendable, Equatable, Codable {
  public let lineageID: PraxisCmpLineageID
  public let worktreePath: String
  public let branches: [PraxisCmpGitBranchRef]

  public init(
    lineageID: PraxisCmpLineageID,
    worktreePath: String,
    branches: [PraxisCmpGitBranchRef]
  ) {
    self.lineageID = lineageID
    self.worktreePath = worktreePath
    self.branches = branches
  }
}

public struct PraxisCmpGitBackendReceipt: Sendable, Equatable, Codable {
  public let repoName: String
  public let status: PraxisCmpGitBootstrapStatus
  public let createdBranches: [PraxisCmpGitBranchRef]

  public init(
    repoName: String,
    status: PraxisCmpGitBootstrapStatus,
    createdBranches: [PraxisCmpGitBranchRef]
  ) {
    self.repoName = repoName
    self.status = status
    self.createdBranches = createdBranches
  }
}
