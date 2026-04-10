import Testing
@testable import PraxisCapabilityResults
@testable import PraxisProviderContracts

struct PraxisProviderContractsTests {
  @Test
  func inferenceEmbeddingAndCapabilityContractsStayStructured() async throws {
    let inferenceExecutor = PraxisStubProviderInferenceExecutor { request in
      let receipt = PraxisHostCapabilityReceipt(
        capabilityKey: "model.inference",
        backend: "openai",
        status: .succeeded,
        providerOperationID: "op-1",
        completedAt: "2026-04-10T22:00:00Z",
        summary: request.prompt
      )
      let output = PraxisNormalizedCapabilityOutput(
        summary: "Inference complete",
        structuredFields: ["model": "gpt-5.4"]
      )
      return PraxisProviderInferenceResponse(output: output, receipt: receipt)
    }
    let inference = try await inferenceExecutor.infer(
      .init(
        systemPrompt: "Be concise",
        prompt: "Summarize Wave5",
        contextSummary: "Host contract migration",
        preferredModel: "gpt-5.4",
        temperature: 0.2,
        requiredCapabilities: ["cmp.inspect"]
      )
    )

    #expect(inference.receipt.backend == "openai")
    #expect(inference.output.summary == "Inference complete")

    let embeddingExecutor = PraxisStubProviderEmbeddingExecutor { request in
      PraxisProviderEmbeddingResponse(vectorLength: request.content.count, model: request.preferredModel)
    }
    let embedding = try await embeddingExecutor.embed(
      .init(content: "CMP delivery baseline", preferredModel: "text-embedding-3-large")
    )

    #expect(embedding.model == "text-embedding-3-large")
    #expect(embedding.vectorLength == "CMP delivery baseline".count)

    let capabilityExecutor = PraxisStubCapabilityExecutor { request in
      PraxisHostCapabilityReceipt(
        capabilityKey: request.capabilityKey,
        backend: "host-capability",
        status: .queued,
        summary: request.payloadSummary
      )
    }
    let capabilityReceipt = try await capabilityExecutor.execute(
      .init(capabilityKey: "browser.grounding", payloadSummary: "Need browser evidence", traceID: "trace-1")
    )

    #expect(capabilityReceipt.status == .queued)
    #expect(capabilityReceipt.capabilityKey == "browser.grounding")
  }

  @Test
  func fileBatchSkillAndMcpContractsReturnDeterministicReceipts() async throws {
    let fileStore = PraxisFakeProviderFileStore(backend: "openai")
    let fileReceipt = try await fileStore.upload(.init(summary: "Upload transcript", purpose: "assistants"))
    #expect(fileReceipt.backend == "openai")
    #expect((await fileStore.allRequests()).first?.purpose == "assistants")

    let batchExecutor = PraxisFakeProviderBatchExecutor(backend: "openai")
    let batchReceipt = try await batchExecutor.enqueue(.init(summary: "Nightly embedding batch", itemCount: 8))
    #expect(batchReceipt.backend == "openai")
    #expect((await batchExecutor.allRequests()).first?.itemCount == 8)

    let registry = PraxisStubProviderSkillRegistry(skills: ["swift.test", "workspace.search"])
    #expect(try await registry.listSkillKeys() == ["swift.test", "workspace.search"])

    let activator = PraxisFakeProviderSkillActivator()
    let activationReceipt = try await activator.activate(.init(skillKey: "swift.test", reason: "Run verification"))
    #expect(activationReceipt.activated == true)
    #expect((await activator.allRequests()).first?.reason == "Run verification")

    let mcp = PraxisStubProviderMCPExecutor { request in
      PraxisProviderMCPToolCallReceipt(
        toolName: request.toolName,
        status: .succeeded,
        summary: request.summary
      )
    }
    let mcpReceipt = try await mcp.callTool(.init(toolName: "web.search", summary: "Find Swift docs", serverName: "openai"))
    #expect(mcpReceipt.toolName == "web.search")
    #expect(mcpReceipt.status == .succeeded)
  }
}
