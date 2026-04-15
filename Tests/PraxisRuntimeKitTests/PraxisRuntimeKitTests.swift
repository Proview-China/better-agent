import Foundation
import Testing
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisMpTypes
import PraxisRuntimeKit

private func makeRuntimeKitTemporaryDirectory() throws -> URL {
  let directory = FileManager.default.temporaryDirectory
    .appendingPathComponent("praxis-runtime-kit-tests-\(UUID().uuidString)", isDirectory: true)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  return directory
}

struct PraxisRuntimeKitTests {
  @Test
  func defaultClientBuildsAndReadsTapInspectionThroughScopedEntry() async throws {
    let client = try PraxisRuntimeClient.makeDefault()
    let inspection = try await client.tap.inspect()

    #expect(inspection.summary.isEmpty == false)
    #expect(inspection.governanceSummary.isEmpty == false)
    #expect(inspection.projectSummary.contains("cmp.local-runtime"))
    #expect(inspection.requestedAction.contains("reviewer context"))
    #expect(inspection.sections.isEmpty == false)
    #expect(inspection.advisorySummaries.isEmpty == false)
  }

  @Test
  func explicitRootDirectoryBuildsAndReadsMpInspectionThroughScopedEntry() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let inspection = try await client.mp.inspect()

    #expect(inspection.summary.isEmpty == false)
    #expect(inspection.memoryStoreSummary.isEmpty == false)
  }

  @Test
  func runsClientExecutesPlainTextGoalAndResumeWithoutLeakingGoalPreparationTypes() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let run = try await client.runs.run(
      .init(
        task: "  Summarize repository status  ",
        sessionID: "session.runtime-kit"
      )
    )
    let resumed = try await client.runs.resumeRun(.init(run.runID.rawValue))

    #expect(run.sessionID.rawValue == "session.runtime-kit")
    #expect(run.runID.rawValue.isEmpty == false)
    #expect(run.phaseSummary.isEmpty == false)
    #expect(resumed.runID == run.runID)
    #expect(resumed.sessionID == run.sessionID)
  }

  @Test
  func runtimeKitRecoversRunAndTapReviewerStateAcrossFreshClients() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let firstClient = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let startedRun = try await firstClient.runs.run(
      .init(
        task: "Recover runtime checkpoint state",
        sessionID: "session.runtime-kit-recovery"
      )
    )

    let cmpProject = firstClient.cmp.project("cmp.local-runtime")
    _ = try await cmpProject.openSession("cmp.runtime-kit-recovery")
    _ = try await cmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker for recovery coverage"
      )
    )
    _ = try await cmpProject.approvals.decide(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for recovery coverage"
      )
    )

    let secondClient = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let resumedRun = try await secondClient.runs.resume(.init(startedRun.runID.rawValue))
    let recoveredInspection = try await secondClient.tap.inspect()
    let recoveredWorkbench = try await secondClient.tap.project("cmp.local-runtime").reviewWorkbench(
      for: "checker.local",
      limit: 10
    )

    #expect(resumedRun.runID == startedRun.runID)
    #expect(resumedRun.checkpointReference == startedRun.checkpointReference)
    #expect(recoveredInspection.latestDecisionSummary?.contains("Approved git access for recovery coverage") == true)
    #expect(recoveredWorkbench.latestDecisionSummary?.contains("Approved git access for recovery coverage") == true)
    #expect(recoveredWorkbench.pendingItems.isEmpty)
  }

  @Test
  func cmpInspectionLivesBehindScopedClient() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let cmpInspection = try await client.cmp.inspect()

    #expect(cmpInspection.summary.isEmpty == false)
    #expect(cmpInspection.hostRuntimeSummary.isEmpty == false)
  }

  @Test
  func scopedTapAndCmpClientsExposeProjectCentricWorkflow() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let cmpProject = client.cmp.project("cmp.local-runtime")
    let tapProject = client.tap.project("cmp.local-runtime")

    let session = try await cmpProject.openSession(session: "cmp.runtime-kit")
    let requested = try await cmpProject.approvals.request(
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
    let approvalQuery = PraxisRuntimeCmpApprovalQuery(
      agentID: "runtime.local",
      targetAgentID: "checker.local",
      capabilityID: "tool.git"
    )
    let approvalReadback = try await cmpProject.approvals.readback(approvalQuery)
    let tapOverview = try await tapProject.overview(.init(agentID: "checker.local", limit: 10))
    let reviewWorkbench = try await tapProject.reviewWorkbench(.init(agentID: "checker.local", limit: 10))
    let cmpOverview = try await cmpProject.overview(.init(agentID: "checker.local"))
    let approvalOverview = try await cmpProject.approvalOverview(approvalQuery)

    #expect(session.sessionID == "cmp.runtime-kit")
    #expect(requested.capabilityKey.rawValue == "tool.git")
    #expect(decided.outcome == .approvedByHuman)
    #expect(approvalReadback.found)
    #expect(tapOverview.status.availableCapabilityIDs.map(\.rawValue).contains("tool.git"))
    #expect(tapOverview.history.entries.contains { $0.capabilityKey.rawValue == "tool.git" })
    #expect(cmpOverview.status.projectID == "cmp.local-runtime")
    #expect(cmpOverview.readback.projectSummary.projectID == "cmp.local-runtime")
    #expect(approvalOverview.approval.found)
    #expect(tapOverview.latestDecisionSummary?.contains("Approved git access") == true)
    #expect(tapOverview.hasWaitingHumanReview == false)
    #expect(reviewWorkbench.projectID == "cmp.local-runtime")
    #expect(reviewWorkbench.latestDecisionSummary?.contains("Approved git access") == true)
    #expect(reviewWorkbench.queueItems.isEmpty == false)
    #expect(reviewWorkbench.pendingItems.isEmpty)
    #expect(reviewWorkbench.summary.contains("registered capability surface"))
  }

  @Test
  func projectScopedTapClientStagesProvisioningAndSurfacesReplayEvidence() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let cmpProject = client.cmp.project("cmp.local-runtime")
    let tapProject = client.tap.project("cmp.local-runtime")

    _ = try await cmpProject.openSession("cmp.runtime-kit-provisioning")
    let requested = try await cmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.shell.exec",
        requestedTier: .b2,
        summary: "Redirect shell execution to provisioning"
      )
    )
    let staged = try await tapProject.provision(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.shell.exec",
        requestedTier: .b2,
        summary: "Stage shell execution provisioning for checker",
        expectedArtifacts: ["shell.exec binding"],
        requiredVerification: ["shell.exec smoke"]
      )
    )
    let provisioning = try await tapProject.provisioning()
    let inspection = try await tapProject.inspect(historyLimit: 10)
    let reviewWorkbench = try await tapProject.reviewWorkbench(for: "checker.local", limit: 10)

    #expect(requested.outcome == .redirectedToProvisioning)
    #expect(staged.capabilityID == "tool.shell.exec")
    #expect(staged.selectedAssetNames.isEmpty == false)
    #expect(staged.pendingReplayNextAction.rawValue == "re_review_then_dispatch")
    #expect(provisioning.found)
    #expect(provisioning.capabilityID == "tool.shell.exec")
    #expect(provisioning.activeReplayCount == 1)
    #expect(provisioning.activationBindingKey == nil)
    #expect(inspection.runSummary.contains("replay record"))
    #expect(inspection.sections.contains { $0.sectionID == "activation-replay" })
    #expect(reviewWorkbench.latestDecisionSummary?.contains("Activation staged attempt") == true)
  }

  @Test
  func projectScopedTapWorkbenchDoesNotReuseDefaultInspectionProject() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let defaultCmpProject = client.cmp.project("cmp.local-runtime")
    let otherCmpProject = client.cmp.project("other-project")
    let otherTapProject = client.tap.project("other-project")

    _ = try await defaultCmpProject.openSession("cmp.runtime-kit-default")
    _ = try await otherCmpProject.openSession("cmp.runtime-kit-other")
    _ = try await defaultCmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        requestedTier: .b1,
        summary: "Default project approval should stay scoped"
      )
    )
    _ = try await defaultCmpProject.approvals.decide(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved only for default project"
      )
    )

    let otherInspection = try await otherTapProject.inspect()
    let otherWorkbench = try await otherTapProject.reviewWorkbench(for: "checker.local", limit: 10)

    #expect(otherInspection.projectSummary.contains("other-project"))
    #expect(otherInspection.projectSummary.contains("cmp.local-runtime") == false)
    #expect(otherInspection.runSummary.contains("tap.session.snapshot.other-project"))
    #expect(otherInspection.runSummary.contains("available for inspection and recovery") == false)
    #expect(otherInspection.latestDecisionSummary?.contains("Approved only for default project") == false)
    #expect(otherWorkbench.projectID == "other-project")
    #expect(otherWorkbench.inspection.projectSummary.contains("other-project"))
    #expect(otherWorkbench.inspection.runSummary.contains("tap.session.snapshot.other-project"))
    #expect(otherWorkbench.latestDecisionSummary?.contains("Approved only for default project") == false)
    #expect(otherWorkbench.pendingItems.isEmpty)
  }

  @Test
  func scopedMpClientExposesProjectSearchResolveAndMemoryLifecycle() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let mpProject = client.mp.project("mp.local-runtime")

    let overview = try await mpProject.overview(.init(limit: 5))
    let search = try await mpProject.search(
      .init(
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let resolve = try await mpProject.resolve(
      .init(
        query: "onboarding",
        requesterAgentID: "runtime.local",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await mpProject.history(
      .init(
        query: "onboarding",
        requesterAgentID: "runtime.local",
        reason: "Need historical context",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let memoryLifecycle = mpProject.memory("memory.runtime-kit")

    #expect(overview.smoke.projectID == "mp.local-runtime")
    #expect(overview.smoke.summary.isEmpty == false)
    #expect(overview.readback.projectID == "mp.local-runtime")
    #expect(overview.readback.totalMemoryCount >= 0)
    #expect(search.projectID == "mp.local-runtime")
    #expect(search.query == "onboarding")
    #expect(resolve.projectID == "mp.local-runtime")
    #expect(resolve.query == "onboarding")
    #expect(history.projectID == "mp.local-runtime")
    #expect(history.reason == "Need historical context")
    #expect(String(describing: type(of: memoryLifecycle)) == "PraxisRuntimeMpMemoryClient")
  }

  @Test
  func runtimeKitConveniencesReduceRequestWrapperCeremonyWithoutChangingTypedSemantics() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let started = try await client.runs.run(
      task: "Summarize repository status",
      sessionID: "session.runtime-kit-convenience"
    )
    let resumed = try await client.runs.resume(.init(started.runID.rawValue))

    let cmpProject = client.cmp.project("cmp.local-runtime")
    let tapProject = client.tap.project("cmp.local-runtime")
    let mpProject = client.mp.project("mp.local-runtime")

    let session = try await cmpProject.openSession("cmp.runtime-kit-convenience")
    _ = try await cmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    _ = try await cmpProject.approvals.decide(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let cmpOverview = try await cmpProject.overview(for: "checker.local")
    let cmpSmoke = try await cmpProject.smoke()
    let tapOverview = try await tapProject.overview(for: "checker.local", limit: 10)
    let mpOverview = try await mpProject.overview(limit: 5)
    let mpSmoke = try await mpProject.smoke()
    let mpSearch = try await mpProject.search(query: "onboarding", scopeLevels: [.project], limit: 5)

    #expect(started.runID == resumed.runID)
    #expect(session.sessionID == "cmp.runtime-kit-convenience")
    #expect(cmpOverview.projectID == "cmp.local-runtime")
    #expect(cmpOverview.smokeChecks.count == cmpSmoke.smokeResult.checks.count)
    #expect(tapOverview.projectID == "cmp.local-runtime")
    #expect(mpOverview.projectID == "mp.local-runtime")
    #expect(mpOverview.smokeChecks.count == mpSmoke.smokeResult.checks.count)
    #expect(mpSearch.query == "onboarding")
  }

  @Test
  func runtimeKitErrorDiagnosticsMapCoreErrorCategoriesIntoCallerFacingRemediation() {
    let invalidInput = PraxisRuntimeErrorDiagnostics.diagnose(
      PraxisError.invalidInput("Field projectID must not be empty.")
    )
    let dependencyMissing = PraxisRuntimeErrorDiagnostics.diagnose(
      PraxisError.dependencyMissing("MP resolve requires a semantic memory store adapter.")
    )
    let unsupportedOperation = PraxisRuntimeErrorDiagnostics.diagnose(
      PraxisError.unsupportedOperation("System git execution is only wired for the macOS local runtime baseline today.")
    )
    let invariantViolation = PraxisRuntimeErrorDiagnostics.diagnose(
      PraxisError.invariantViolation("Failed to open local runtime SQLite database.")
    )

    #expect(invalidInput.category == .invalidInput)
    #expect(invalidInput.remediation.contains("required fields"))
    #expect(dependencyMissing.category == .dependencyMissing)
    #expect(dependencyMissing.remediation.contains("host adapter"))
    #expect(unsupportedOperation.category == .unsupportedOperation)
    #expect(unsupportedOperation.remediation.contains("supported runtime profile"))
    #expect(invariantViolation.category == .invariantViolation)
    #expect(invariantViolation.remediation.contains("runtime bug"))
  }

  @Test
  func capabilityClientExposesThinCapabilityBaselineWithoutLeakingProviderContracts() async throws {
    let rootDirectory = try makeRuntimeKitTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let catalog = client.capabilities.catalog()
    let openedSession = try await client.capabilities.openSession(
      .init(
        sessionID: "runtime.capabilities.test",
        title: "Runtime Capability Test"
      )
    )
    let generated = try await client.capabilities.generate(
      .init(
        prompt: "Summarize the thin capability baseline",
        preferredModel: "local-test-model",
        requiredCapabilities: ["generate.create", "embed.create"]
      )
    )
    let streamed = try await client.capabilities.stream(
      .init(
        prompt: "Stream one short capability summary",
        preferredModel: "local-test-model"
      ),
      chunkCharacterCount: 24
    )
    let embedded = try await client.capabilities.embed(
      .init(
        content: "runtime capability baseline test",
        preferredModel: "local-embed-test"
      )
    )
    let toolCall = try await client.capabilities.callTool(
      .init(
        toolName: "web.search",
        summary: "Find RuntimeKit docs",
        serverName: "local-test"
      )
    )
    let fileUpload = try await client.capabilities.uploadFile(
      .init(
        summary: "runtime capability test artifact",
        purpose: "analysis"
      )
    )
    let batchSubmit = try await client.capabilities.submitBatch(
      .init(
        summary: "runtime capability test batch",
        itemCount: 4
      )
    )
    let webSearch = try await client.capabilities.searchWeb(
      .init(
        query: "Swift runtime capability baseline",
        locale: "en-US",
        preferredDomains: ["example.com", "docs.example.com"],
        limit: 2
      )
    )
    let fetched = try await client.capabilities.fetchSearchResult(
      .init(
        url: webSearch.results.first?.url ?? "https://example.com/search/swift-runtime-capability-baseline",
        preferredTitle: "Capability Search Result",
        waitPolicy: .networkIdle
      )
    )
    let grounded = try await client.capabilities.groundSearchResult(
      .init(
        taskSummary: "Verify capability baseline docs page",
        exampleURL: fetched.finalURL,
        requestedFacts: ["final_url", "host", "page_title"],
        locale: "en-US",
        maxPages: 2
      )
    )

    #expect(catalog.capabilityIDs.map(\.rawValue).contains("generate.create"))
    #expect(catalog.capabilityIDs.map(\.rawValue).contains("session.open"))
    #expect(catalog.capabilityIDs.map(\.rawValue).contains("search.web"))
    #expect(catalog.capabilityIDs.map(\.rawValue).contains("search.fetch"))
    #expect(catalog.capabilityIDs.map(\.rawValue).contains("search.ground"))
    #expect(openedSession.sessionID.rawValue == "runtime.capabilities.test")
    #expect(openedSession.title == "Runtime Capability Test")
    #expect(generated.capabilityID.rawValue == "generate.create")
    #expect(generated.outputText.isEmpty == false)
    #expect(streamed.capabilityID.rawValue == "generate.stream")
    #expect(streamed.chunks.isEmpty == false)
    #expect(embedded.capabilityID.rawValue == "embed.create")
    #expect(embedded.vectorLength > 0)
    #expect(toolCall.capabilityID.rawValue == "tool.call")
    #expect(toolCall.toolName == "web.search")
    #expect(fileUpload.capabilityID.rawValue == "file.upload")
    #expect(fileUpload.fileID.isEmpty == false)
    #expect(batchSubmit.capabilityID.rawValue == "batch.submit")
    #expect(batchSubmit.batchID.isEmpty == false)
    #expect(webSearch.capabilityID.rawValue == "search.web")
    #expect(webSearch.results.isEmpty == false)
    #expect(fetched.capabilityID.rawValue == "search.fetch")
    #expect(fetched.finalURL.isEmpty == false)
    let snapshotPath = try #require(fetched.snapshotPath)
    let snapshotContents = try String(contentsOfFile: snapshotPath, encoding: .utf8)
    #expect(snapshotContents.contains("Wait policy: networkIdle"))
    #expect(grounded.capabilityID.rawValue == "search.ground")
    #expect(grounded.pages.isEmpty == false)
    #expect(grounded.facts.count == 3)
  }
}
