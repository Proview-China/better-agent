import Foundation
import Testing
import PraxisCmpTypes
import PraxisCapabilityResults
import PraxisInfraContracts
import PraxisProviderContracts
import PraxisRuntimeComposition
import PraxisRuntimeGateway
import PraxisRuntimeUseCases
import PraxisTapTypes

private struct StubSemanticMemoryStore: PraxisSemanticMemoryStoreContract {
  let bundleResult: PraxisSemanticMemoryBundle

  func save(_ record: PraxisSemanticMemoryRecord) async throws -> PraxisSemanticMemoryWriteReceipt {
    PraxisSemanticMemoryWriteReceipt(memoryID: record.id, storageKey: record.storageKey)
  }

  func load(memoryID: String) async throws -> PraxisSemanticMemoryRecord? {
    nil
  }

  func search(_ request: PraxisSemanticMemorySearchRequest) async throws -> [PraxisSemanticMemoryRecord] {
    []
  }

  func bundle(_ request: PraxisSemanticMemoryBundleRequest) async throws -> PraxisSemanticMemoryBundle {
    bundleResult
  }
}

struct PraxisRuntimeUseCasesTests {
  @Test
  func cmpProjectUseCasesBuildNeutralSessionBootstrapReadbackAndSmoke() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-project-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let dependencies = try makeDependencies(rootDirectory: rootDirectory)
    let openSessionUseCase = PraxisOpenCmpSessionUseCase(dependencies: dependencies)
    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: dependencies)
    let readbackProjectUseCase = PraxisReadbackCmpProjectUseCase(dependencies: dependencies)
    let smokeProjectUseCase = PraxisSmokeCmpProjectUseCase(dependencies: dependencies)

    let session = try await openSessionUseCase.execute(
      PraxisOpenCmpSessionCommand(projectID: "cmp.local-runtime", sessionID: "cmp.session.usecases")
    )
    let bootstrap = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let readback = try await readbackProjectUseCase.execute(
      PraxisReadbackCmpProjectCommand(projectID: "cmp.local-runtime")
    )
    let smoke = try await smokeProjectUseCase.execute(
      PraxisSmokeCmpProjectCommand(projectID: "cmp.local-runtime")
    )

    #expect(session.projectID == "cmp.local-runtime")
    #expect(session.sessionID == "cmp.session.usecases")
    #expect(session.hostProfile.executionStyle == "local-first")
    #expect(session.summary.contains("host-neutral CMP session"))
    #expect(bootstrap.projectID == "cmp.local-runtime")
    #expect(bootstrap.hostProfile.structuredStore == "sqlite")
    #expect(bootstrap.gitBranchRuntimes.count == 2)
    #expect(bootstrap.lineages.count == 2)
    #expect(readback.projectID == "cmp.local-runtime")
    let gitExecutorStatus = try #require(readback.componentStatuses["gitExecutor"])
    let gitSmokeCheck = try #require(smoke.checks.first { $0.gate == "git" })
    #expect(gitExecutorStatus != "missing")
    #expect(readback.persistenceSummary.contains("Checkpoint and journal persistence"))
    #expect(smoke.projectID == "cmp.local-runtime")
    #expect(smoke.checks.count == 5)
    #expect(gitSmokeCheck.status == gitExecutorStatus)
  }

  @Test
  func cmpFlowUseCasesReturnDomainModelsWithoutFacadeProjection() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-flow-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let dependencies = try makeDependencies(rootDirectory: rootDirectory)
    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: dependencies)
    let ingestFlowUseCase = PraxisIngestCmpFlowUseCase(dependencies: dependencies)
    let commitFlowUseCase = PraxisCommitCmpFlowUseCase(dependencies: dependencies)
    let readbackRolesUseCase = PraxisReadbackCmpRolesUseCase(dependencies: dependencies)

    _ = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let ingest = try await ingestFlowUseCase.execute(
      PraxisIngestCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.usecases",
        taskSummary: "Capture one runtime context material",
        materials: [
          PraxisCmpRuntimeContextMaterial(kind: .userInput, ref: "payload:user:usecases")
        ],
        requiresActiveSync: true
      )
    )
    let commit = try await commitFlowUseCase.execute(
      PraxisCommitCmpFlowCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        sessionID: "cmp.flow.usecases",
        eventIDs: ["evt.usecases.1"],
        changeSummary: "Commit one runtime context event",
        syncIntent: .toParent
      )
    )
    let roles = try await readbackRolesUseCase.execute(
      PraxisReadbackCmpRolesCommand(projectID: "cmp.local-runtime", agentID: "runtime.local")
    )

    #expect(ingest.projectID == "cmp.local-runtime")
    #expect(ingest.agentID == "runtime.local")
    #expect(ingest.sessionID == "cmp.flow.usecases")
    #expect(ingest.result.acceptedEventIDs.count == 1)
    #expect(ingest.result.nextAction == "commit_context_delta")
    #expect(ingest.ingress.sections.count == 1)
    #expect(ingest.loweredSections.isEmpty == false)
    #expect(commit.projectID == "cmp.local-runtime")
    #expect(commit.agentID == "runtime.local")
    #expect(commit.result.delta.eventRefs.map(\.rawValue) == ["evt.usecases.1"])
    #expect(commit.activeLine.stage == .candidateReady)
    #expect(commit.snapshotCandidate.deltaRefs == [commit.result.delta.id])
    #expect(roles.projectID == "cmp.local-runtime")
    #expect(roles.agentID == "runtime.local")
    #expect(roles.roles.map(\.role) == [.icma, .iterator, .checker, .dbAgent, .dispatcher])
    #expect(roles.issues.contains { $0.contains("no package descriptors") })
  }

  @Test
  func cmpControlAndApprovalUseCasesPersistAcrossIndependentDependencyGraphs() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-usecases-readback-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let firstDependencies = try makeDependencies(rootDirectory: rootDirectory)
    let secondDependencies = try makeDependencies(rootDirectory: rootDirectory)

    let bootstrapProjectUseCase = PraxisBootstrapCmpProjectUseCase(dependencies: firstDependencies)
    let updateControlUseCase = PraxisUpdateCmpControlUseCase(dependencies: firstDependencies)
    let requestApprovalUseCase = PraxisRequestCmpPeerApprovalUseCase(dependencies: firstDependencies)
    let decideApprovalUseCase = PraxisDecideCmpPeerApprovalUseCase(dependencies: firstDependencies)

    let readbackControlUseCase = PraxisReadbackCmpControlUseCase(dependencies: secondDependencies)
    let readbackApprovalUseCase = PraxisReadbackCmpPeerApprovalUseCase(dependencies: secondDependencies)
    let readbackStatusUseCase = PraxisReadbackCmpStatusUseCase(dependencies: secondDependencies)

    _ = try await bootstrapProjectUseCase.execute(
      PraxisBootstrapCmpProjectCommand(
        projectID: "cmp.local-runtime",
        agentIDs: ["runtime.local", "checker.local"],
        defaultAgentID: "runtime.local"
      )
    )
    let updatedControl = try await updateControlUseCase.execute(
      PraxisUpdateCmpControlCommand(
        projectID: "cmp.local-runtime",
        agentID: "checker.local",
        executionStyle: "manual",
        mode: "peer_review",
        readbackPriority: "package_first",
        automation: ["autoDispatch": false]
      )
    )
    let requestedApproval = try await requestApprovalUseCase.execute(
      PraxisRequestCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decidedApproval = try await decideApprovalUseCase.execute(
      PraxisDecideCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let controlReadback = try await readbackControlUseCase.execute(
      PraxisReadbackCmpControlCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )
    let approvalReadback = try await readbackApprovalUseCase.execute(
      PraxisReadbackCmpPeerApprovalCommand(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityKey: "tool.git"
      )
    )
    let statusReadback = try await readbackStatusUseCase.execute(
      PraxisReadbackCmpStatusCommand(projectID: "cmp.local-runtime", agentID: "checker.local")
    )

    #expect(updatedControl.control.executionStyle == "manual")
    #expect(updatedControl.control.mode == "peer_review")
    #expect(updatedControl.control.automation["autoDispatch"] == false)
    #expect(requestedApproval.route == "humanReview")
    #expect(requestedApproval.outcome == "escalated_to_human")
    #expect(requestedApproval.humanGateState == "waitingApproval")
    #expect(decidedApproval.outcome == "approved_by_human")
    #expect(decidedApproval.humanGateState == "approved")
    #expect(decidedApproval.decisionSummary == "Approved git access for checker")
    #expect(controlReadback.projectID == "cmp.local-runtime")
    #expect(controlReadback.agentID == "checker.local")
    #expect(controlReadback.control.executionStyle == "manual")
    #expect(controlReadback.control.mode == "peer_review")
    #expect(controlReadback.control.readbackPriority == "package_first")
    #expect(controlReadback.control.automation["autoDispatch"] == false)
    #expect(approvalReadback.found)
    #expect(approvalReadback.capabilityKey == "tool.git")
    #expect(approvalReadback.requestedTier == .b1)
    #expect(approvalReadback.outcome == "approved_by_human")
    #expect(approvalReadback.humanGateState == "approved")
    #expect(approvalReadback.decisionSummary == "Approved git access for checker")
    #expect(statusReadback.projectID == "cmp.local-runtime")
    #expect(statusReadback.agentID == "checker.local")
    #expect(statusReadback.control.executionStyle == "manual")
    #expect(statusReadback.control.mode == "peer_review")
    #expect(statusReadback.control.automation["autoDispatch"] == false)
    #expect(statusReadback.roles.isEmpty == false)
  }

  @Test
  func mpInspectUseCaseReportsHostBackedMemoryAndSearchState() async throws {
    let memoryStore = StubSemanticMemoryStore(
      bundleResult: .init(
        primaryMemoryIDs: ["memory.primary"],
        supportingMemoryIDs: [],
        omittedSupersededMemoryIDs: ["memory.superseded"]
      )
    )
    let searchIndex = PraxisStubSemanticSearchIndex(
      cannedResults: [
        "host runtime": [
          .init(id: "match-1", score: 0.9, contentSummary: "Host runtime memory hit", storageKey: "memory/primary"),
          .init(id: "match-2", score: 0.7, contentSummary: "Secondary host runtime hit", storageKey: "memory/secondary"),
        ]
      ]
    )
    let inferenceExecutor = PraxisStubProviderInferenceExecutor { _ in
      PraxisProviderInferenceResponse(
        output: .init(summary: "stubbed inference"),
        receipt: .init(
          capabilityKey: "provider.infer",
          backend: "stub-provider",
          status: .succeeded,
          summary: "Inference is stubbed for MP tests."
        )
      )
    }
    let dependencies = try makeDependencies(
      hostAdapters: PraxisHostAdapterRegistry(
        providerInferenceExecutor: inferenceExecutor,
        semanticSearchIndex: searchIndex,
        semanticMemoryStore: memoryStore
      )
    )
    let inspectMpUseCase = PraxisInspectMpUseCase(dependencies: dependencies)

    let inspection = try await inspectMpUseCase.execute()

    #expect(inspection.summary == "MP workflow surface is now reading HostRuntime memory and multimodal adapter state.")
    #expect(inspection.workflowSummary.contains("provider inference surface available"))
    #expect(inspection.memoryStoreSummary.contains("1 primary records and omits 1 superseded records"))
    #expect(inspection.memoryStoreSummary.contains("Semantic search matches for inspection query: 2."))
    #expect(inspection.multimodalSummary == "No multimodal host chips are currently registered.")
    #expect(inspection.issues.contains { $0.contains("Browser grounding and multimodal chips") })
    #expect(inspection.issues.contains { $0.contains("semantic memory store") } == false)
    #expect(inspection.issues.contains { $0.contains("semantic search index") } == false)
  }

  private func makeDependencies(rootDirectory: URL) throws -> PraxisDependencyGraph {
    try makeDependencies(hostAdapters: PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory))
  }

  private func makeDependencies(hostAdapters: PraxisHostAdapterRegistry) throws -> PraxisDependencyGraph {
    try PraxisRuntimeGatewayFactory.makeCompositionRoot(
      hostAdapters: hostAdapters,
      blueprint: PraxisRuntimeGatewayModule.bootstrap
    ).makeDependencyGraph()
  }
}
