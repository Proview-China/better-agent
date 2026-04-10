import Testing
@testable import PraxisCapabilityContracts
@testable import PraxisCoreTypes

struct PraxisCapabilityContractsTests {
  @Test
  func capabilityManifestCapturesRoutingAndExecutionSurface() {
    let manifest = PraxisCapabilityManifest(
      id: .init(rawValue: "search.web"),
      name: "Web Search",
      summary: "Search current web results.",
      kind: .tool,
      version: "1.2.0",
      generation: 3,
      inputSchemaRef: .init(id: "schema.search.request", version: "v1"),
      outputSchemaRef: .init(id: "schema.search.result", version: "v1"),
      supportsStreaming: false,
      supportsCancellation: true,
      supportsPrepare: true,
      hotPath: true,
      routeHints: [
        .init(key: "family", value: "search"),
      ],
      tags: ["search", "web"],
      metadata: ["scope": "network"]
    )
    let binding = PraxisCapabilityBinding(
      capabilityID: manifest.id,
      bindingKey: "binding.search.default",
      state: .active,
      runtimeKind: "tool-gateway",
      generation: manifest.generation,
      prioritySummary: "interactive"
    )

    #expect(manifest.kind == .tool)
    #expect(manifest.hotPath)
    #expect(manifest.routeHints.first?.value == "search")
    #expect(binding.state == .active)
    #expect(binding.runtimeKind == "tool-gateway")
    #expect(binding.generation == 3)
  }
}
