import Foundation
import PraxisRuntimeKit

private func makeRuntimeRoot(named name: String) throws -> URL {
  let rootDirectory = FileManager.default.temporaryDirectory
    .appendingPathComponent("praxis-examples", isDirectory: true)
    .appendingPathComponent(name, isDirectory: true)
  try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
  return rootDirectory
}

@main
struct PraxisRuntimeKitCmpTapExample {
  static func main() async throws {
    let rootDirectory = try makeRuntimeRoot(named: "runtime-kit-cmp-tap")
    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)

    let projectID: PraxisRuntimeProjectRef = "cmp.local-runtime"
    let cmpProject = client.cmp.project(projectID)
    let tapProject = client.tap.project(projectID)

    let session = try await cmpProject.openSession(session: "cmp.runtime-kit")
    _ = try await cmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decided = try await cmpProject.approvals.decide(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let approval = try await cmpProject.approvals.readback(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git"
      )
    )
    let cmpOverview = try await cmpProject.overview(.init(agentID: "checker.local"))
    let tapOverview = try await tapProject.overview(.init(agentID: "checker.local", limit: 10))

    print("Praxis RuntimeKit CMP + TAP Example")
    print("rootDirectory: \(rootDirectory.path)")
    print("session.id: \(session.sessionID)")
    print("approval.outcome: \(decided.outcome.rawValue)")
    print("approval.readbackFound: \(approval.found)")
    print("cmp.status.projectID: \(cmpOverview.status.projectID)")
    print("cmp.summary: \(cmpOverview.readback.summary)")
    print("tap.availableCapabilities: \(tapOverview.status.availableCapabilityIDs.map(\.rawValue).joined(separator: ", "))")
    print("tap.historyCount: \(tapOverview.history.totalCount)")
    if let latestDecision = tapOverview.status.latestDecisionSummary {
      print("tap.latestDecision: \(latestDecision)")
    }
  }
}
