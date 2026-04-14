import PraxisCapabilityContracts
import PraxisCoreTypes

/// Stable identifiers for the Phase 3 thin-capability baseline.
public enum PraxisThinCapabilityKey: String, Sendable, Codable, CaseIterable {
  case generateCreate = "generate.create"
  case generateStream = "generate.stream"
  case embedCreate = "embed.create"
  case toolCall = "tool.call"
  case fileUpload = "file.upload"
  case batchSubmit = "batch.submit"
  case sessionOpen = "session.open"

  /// Returns the typed capability identifier for the baseline key.
  public var capabilityID: PraxisCapabilityID {
    PraxisCapabilityID(rawValue: rawValue)
  }
}

/// Baseline manifest collection for the first Phase 3 capability slice.
public struct PraxisThinCapabilityBaseline: Sendable, Equatable, Codable {
  public let summary: String
  public let manifests: [PraxisCapabilityManifest]

  /// Creates the thin-capability baseline description.
  ///
  /// - Parameters:
  ///   - summary: Human-readable baseline summary.
  ///   - manifests: Capability manifests included in the baseline.
  public init(
    summary: String,
    manifests: [PraxisCapabilityManifest]
  ) {
    self.summary = summary
    self.manifests = manifests
  }
}

public extension PraxisCapabilityCatalogBuilder {
  /// Builds the initial Phase 3 thin-capability baseline manifests.
  ///
  /// - Returns: The baseline summary and manifests for the thin capability slice.
  func buildThinCapabilityBaseline() -> PraxisThinCapabilityBaseline {
    let manifests: [PraxisCapabilityManifest] = [
      .init(
        id: PraxisThinCapabilityKey.generateCreate.capabilityID,
        name: "Generate Create",
        summary: "Run one bounded generation request through the current provider inference lane.",
        kind: .model,
        supportsPrepare: false,
        hotPath: true,
        routeHints: [
          .init(key: "backend", value: "provider.inference")
        ],
        tags: ["phase3", "thin-baseline", "generation"]
      ),
      .init(
        id: PraxisThinCapabilityKey.generateStream.capabilityID,
        name: "Generate Stream",
        summary: "Expose a bounded streaming-style generation lane without leaking transport events.",
        kind: .model,
        supportsStreaming: true,
        supportsPrepare: false,
        hotPath: true,
        routeHints: [
          .init(key: "backend", value: "provider.inference")
        ],
        tags: ["phase3", "thin-baseline", "generation", "streaming"]
      ),
      .init(
        id: PraxisThinCapabilityKey.embedCreate.capabilityID,
        name: "Embed Create",
        summary: "Create one embedding request through the current embedding lane.",
        kind: .model,
        supportsPrepare: false,
        routeHints: [
          .init(key: "backend", value: "provider.embedding")
        ],
        tags: ["phase3", "thin-baseline", "embedding"]
      ),
      .init(
        id: PraxisThinCapabilityKey.toolCall.capabilityID,
        name: "Tool Call",
        summary: "Call one provider-hosted tool lane through the current MCP executor.",
        kind: .tool,
        supportsPrepare: false,
        routeHints: [
          .init(key: "backend", value: "provider.mcp")
        ],
        tags: ["phase3", "thin-baseline", "tooling"]
      ),
      .init(
        id: PraxisThinCapabilityKey.fileUpload.capabilityID,
        name: "File Upload",
        summary: "Upload one provider file payload through the current file-store lane.",
        kind: .resource,
        supportsPrepare: false,
        routeHints: [
          .init(key: "backend", value: "provider.file-store")
        ],
        tags: ["phase3", "thin-baseline", "files"]
      ),
      .init(
        id: PraxisThinCapabilityKey.batchSubmit.capabilityID,
        name: "Batch Submit",
        summary: "Submit one provider batch workload through the current batch lane.",
        kind: .runtime,
        supportsPrepare: false,
        routeHints: [
          .init(key: "backend", value: "provider.batch")
        ],
        tags: ["phase3", "thin-baseline", "batch"]
      ),
      .init(
        id: PraxisThinCapabilityKey.sessionOpen.capabilityID,
        name: "Session Open",
        summary: "Open one runtime session header for repeated caller workflows.",
        kind: .runtime,
        supportsPrepare: false,
        routeHints: [
          .init(key: "backend", value: "runtime.session")
        ],
        tags: ["phase3", "thin-baseline", "session"]
      ),
    ]

    return PraxisThinCapabilityBaseline(
      summary: "Phase 3 thin capability baseline covers generation, embeddings, tool calls, file upload, batch submission, and runtime session opening.",
      manifests: manifests
    )
  }
}
