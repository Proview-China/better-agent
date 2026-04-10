import Testing
@testable import PraxisCmpDbModel
@testable import PraxisCmpFiveAgent
@testable import PraxisCmpGitModel
@testable import PraxisCmpMqModel
@testable import PraxisCmpTypes

struct CmpRuntimeSupportTests {
  @Test
  func cmpBootstrapModelsCaptureGitDbAndMqPlans() {
    let lineageID = PraxisCmpLineageID(rawValue: "lineage-1")
    let gitPlan = PraxisCmpProjectRepoBootstrapPlan(
      projectID: "project-1",
      repoName: "praxis",
      repoRootPath: "/tmp/praxis",
      defaultBranchName: "main",
      lineages: [lineageID]
    )
    let gitRuntime = PraxisCmpGitBranchRuntime(
      lineageID: lineageID,
      worktreePath: "/tmp/praxis/.cmp/lineage-1",
      branches: [
        .init(kind: .cmp, agentID: "agent-1", name: "cmp/agent-1"),
        .init(kind: .tap, agentID: "agent-1", name: "tap/agent-1"),
      ]
    )
    let dbContract = PraxisCmpDbBootstrapContract(
      projectID: "project-1",
      databaseName: "praxis",
      schemaName: "cmp_project_1",
      sharedTargets: ["cmp_project_1.sections"],
      agentLocalTargets: ["agent-1.events"],
      bootstrapStatements: [
        .init(statementID: "stmt-1", phase: .bootstrap, target: "cmp_project_1.sections", sql: "create table ...")
      ],
      readbackStatements: [
        .init(statementID: "stmt-2", phase: .read, target: "cmp_project_1.sections", sql: "select ...")
      ]
    )
    let mqReceipt = PraxisCmpMqBootstrapReceipt(
      projectID: "project-1",
      agentID: "agent-1",
      namespace: .init(
        projectID: "project-1",
        namespaceRoot: "cmp/project-1",
        keyPrefix: "cmp:project-1",
        queuePrefix: "cmp:project-1:queue",
        streamPrefix: "cmp:project-1:stream"
      ),
      bindings: [
        .init(agentID: "agent-1", topicName: "neighbor.sync", channel: .peer, transportKey: "cmp:project-1:peer")
      ]
    )

    #expect(gitPlan.defaultBranchName == "main")
    #expect(gitRuntime.branches.count == 2)
    #expect(dbContract.bootstrapStatements.first?.phase == .bootstrap)
    #expect(mqReceipt.bindings.first?.channel == .peer)
    #expect(mqReceipt.bindings.first?.transportKey == "cmp:project-1:peer")
  }

  @Test
  func cmpFiveAgentLiveAndObservabilityModelsCaptureRoleStatus() {
    let liveRequest = PraxisCmpRoleLiveRequest(
      requestID: "request-1",
      role: .icma,
      stage: "capture",
      mode: .llmAssisted,
      promptSummary: "Summarize ingress into structured sections",
      outputContract: ["sections"]
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

    #expect(liveRequest.role == .icma)
    #expect(liveRequest.outputContract == ["sections"])
    #expect(summary.liveSummary[.icma]?.fallbackApplied == true)
    #expect(summary.recovery.resumableRoles == [.icma])
  }
}
