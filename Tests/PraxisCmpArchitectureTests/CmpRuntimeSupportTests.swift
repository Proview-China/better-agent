import XCTest
@testable import PraxisCmpDbModel
@testable import PraxisCmpFiveAgent
@testable import PraxisCmpGitModel
@testable import PraxisCmpMqModel
@testable import PraxisCmpTypes

final class CmpRuntimeSupportTests: XCTestCase {
  func testCmpBootstrapModelsCaptureGitDbAndMqPlans() {
    let lineageID = PraxisCmpLineageID(rawValue: "lineage-1")
    let gitPlan = PraxisCmpProjectRepoBootstrapPlan(
      projectID: "project-1",
      repoName: "praxis",
      repoRootPath: "/tmp/praxis",
      defaultBranchName: "main"
    )
    let gitRuntime = PraxisCmpGitBranchRuntime(
      lineageID: lineageID,
      worktreePath: "/tmp/praxis/.cmp/lineage-1",
      branchNames: ["cmp/agent-1", "tap/agent-1"]
    )
    let dbContract = PraxisCmpDbBootstrapContract(
      projectID: "project-1",
      databaseName: "praxis",
      schemaName: "cmp_project_1",
      bootstrapStatements: [
        .init(statementID: "stmt-1", phase: .bootstrap, target: "cmp_project_1.sections", sql: "create table ...")
      ],
      readbackStatements: [
        .init(statementID: "stmt-2", phase: .readback, target: "cmp_project_1.sections", sql: "select ...")
      ]
    )
    let mqReceipt = PraxisCmpMqBootstrapReceipt(
      projectID: "project-1",
      agentID: "agent-1",
      namespace: .init(
        namespaceRoot: "cmp/project-1",
        keyPrefix: "cmp:project-1",
        queuePrefix: "cmp:project-1:queue",
        streamPrefix: "cmp:project-1:stream"
      ),
      bindings: [
        .init(topicName: "neighbor.sync", channel: "peer", transportKey: "cmp:project-1:peer")
      ]
    )

    XCTAssertEqual(gitPlan.defaultBranchName, "main")
    XCTAssertEqual(gitRuntime.branchNames.count, 2)
    XCTAssertEqual(dbContract.bootstrapStatements.first?.phase, .bootstrap)
    XCTAssertEqual(mqReceipt.bindings.first?.channel, "peer")
    XCTAssertEqual(mqReceipt.bindings.first?.transportKey, "cmp:project-1:peer")
  }

  func testCmpFiveAgentLiveAndObservabilityModelsCaptureRoleStatus() {
    let liveRequest = PraxisCmpRoleLiveRequest(
      requestID: "request-1",
      role: .icma,
      stage: "capture",
      mode: .llmAssisted,
      promptSummary: "Summarize ingress into structured sections"
    )
    let liveSummary = PraxisCmpRoleLiveSummary(
      mode: .llmAssisted,
      status: .fallback,
      fallbackApplied: true,
      provider: "openai",
      model: "gpt-5.4"
    )
    let summary = PraxisCmpFiveAgentRuntimeSummary(
      roleCounts: [.icma: 1, .iterator: 0, .checker: 0, .dbAgent: 0, .dispatcher: 0],
      latestStages: [.icma: "capture"],
      liveSummary: [.icma: liveSummary],
      flow: .init(pendingPeerApprovalCount: 1, approvedPeerApprovalCount: 0, reinterventionPendingCount: 0),
      recovery: .init(resumableRoles: [.icma], missingCheckpointRoles: [.iterator, .checker, .dbAgent, .dispatcher])
    )

    XCTAssertEqual(liveRequest.role, .icma)
    XCTAssertTrue(summary.liveSummary[.icma]?.fallbackApplied == true)
    XCTAssertEqual(summary.recovery.resumableRoles, [.icma])
  }
}
