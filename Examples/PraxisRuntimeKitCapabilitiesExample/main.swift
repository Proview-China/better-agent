import Foundation
import PraxisRuntimeKit

@main
struct PraxisRuntimeKitCapabilitiesExampleMain {
  static func main() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-kit-capabilities-example", isDirectory: true)
      .appendingPathComponent(UUID().uuidString.lowercased(), isDirectory: true)
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let catalog = client.capabilities.catalog()
    let session = try await client.capabilities.openSession(
      .init(
        sessionID: "runtime.capabilities.example",
        title: "Runtime Capability Example"
      )
    )
    let generated = try await client.capabilities.generate(
      .init(
        prompt: "Summarize the RuntimeKit thin capability baseline",
        preferredModel: "local-example-model",
        requiredCapabilities: ["generate.create", "tool.call"]
      )
    )
    let streamed = try await client.capabilities.stream(
      .init(
        prompt: "Provide a short streaming capability summary",
        preferredModel: "local-example-model"
      ),
      chunkCharacterCount: 28
    )
    let embedded = try await client.capabilities.embed(
      .init(
        content: "runtime capability baseline example",
        preferredModel: "local-embed-example"
      )
    )
    let toolCall = try await client.capabilities.callTool(
      .init(
        toolName: "web.search",
        summary: "Find capability baseline docs",
        serverName: "local-example"
      )
    )
    let uploadedFile = try await client.capabilities.uploadFile(
      .init(
        summary: "runtime capability example artifact",
        purpose: "analysis"
      )
    )
    let submittedBatch = try await client.capabilities.submitBatch(
      .init(
        summary: "runtime capability example batch",
        itemCount: 3
      )
    )

    print("Thin capability catalog: \(catalog.capabilityIDs.map(\.rawValue).joined(separator: ", "))")
    print("Opened session: \(session.sessionID.rawValue) (\(session.title))")
    print("Generate summary: \(generated.summary)")
    print("Generate output: \(generated.outputText)")
    print("Stream chunks: \(streamed.chunks.map(\.text).joined(separator: " | "))")
    print("Embedding vector length: \(embedded.vectorLength)")
    print("Tool call: \(toolCall.toolName) -> \(toolCall.summary)")
    print("Uploaded file ID: \(uploadedFile.fileID)")
    print("Submitted batch ID: \(submittedBatch.batchID)")
  }
}
