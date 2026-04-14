import Foundation
import PraxisCapabilityCatalog
import PraxisCapabilityContracts
import PraxisCapabilityResults
import PraxisCoreTypes
import PraxisProviderContracts
import PraxisRuntimeComposition
import PraxisSession
import PraxisToolingContracts

/// Structured generation command for the thin capability surface.
public struct PraxisCapabilityGenerateCommand: Sendable, Equatable, Codable {
  public let prompt: String
  public let systemPrompt: String?
  public let contextSummary: String?
  public let preferredModel: String?
  public let temperature: Double?
  public let requiredCapabilityIDs: [PraxisCapabilityID]

  public init(
    prompt: String,
    systemPrompt: String? = nil,
    contextSummary: String? = nil,
    preferredModel: String? = nil,
    temperature: Double? = nil,
    requiredCapabilityIDs: [PraxisCapabilityID] = []
  ) {
    self.prompt = prompt
    self.systemPrompt = systemPrompt
    self.contextSummary = contextSummary
    self.preferredModel = preferredModel
    self.temperature = temperature
    self.requiredCapabilityIDs = requiredCapabilityIDs
  }
}

/// Structured embedding command for the thin capability surface.
public struct PraxisCapabilityEmbedCommand: Sendable, Equatable, Codable {
  public let content: String
  public let preferredModel: String?

  public init(
    content: String,
    preferredModel: String? = nil
  ) {
    self.content = content
    self.preferredModel = preferredModel
  }
}

/// Structured tool-call command for the thin capability surface.
public struct PraxisCapabilityToolCallCommand: Sendable, Equatable, Codable {
  public let toolName: String
  public let summary: String
  public let serverName: String?

  public init(
    toolName: String,
    summary: String,
    serverName: String? = nil
  ) {
    self.toolName = toolName
    self.summary = summary
    self.serverName = serverName
  }
}

/// Structured file-upload command for the thin capability surface.
public struct PraxisCapabilityFileUploadCommand: Sendable, Equatable, Codable {
  public let summary: String
  public let purpose: String?

  public init(
    summary: String,
    purpose: String? = nil
  ) {
    self.summary = summary
    self.purpose = purpose
  }
}

/// Structured batch-submit command for the thin capability surface.
public struct PraxisCapabilityBatchSubmitCommand: Sendable, Equatable, Codable {
  public let summary: String
  public let itemCount: Int

  public init(
    summary: String,
    itemCount: Int
  ) {
    self.summary = summary
    self.itemCount = itemCount
  }
}

/// Structured runtime-session open command for the thin capability surface.
public struct PraxisOpenRuntimeSessionCommand: Sendable, Equatable, Codable {
  public let sessionID: String?
  public let title: String?

  public init(
    sessionID: String? = nil,
    title: String? = nil
  ) {
    self.sessionID = sessionID
    self.title = title
  }
}

/// Structured web-search command for the search capability chain.
public struct PraxisCapabilitySearchWebCommand: Sendable, Equatable, Codable {
  public let query: String
  public let locale: String?
  public let preferredDomains: [String]
  public let limit: Int

  public init(
    query: String,
    locale: String? = nil,
    preferredDomains: [String] = [],
    limit: Int = 5
  ) {
    self.query = query
    self.locale = locale
    self.preferredDomains = preferredDomains
    self.limit = limit
  }
}

/// Structured fetch command for the search capability chain.
public struct PraxisCapabilitySearchFetchCommand: Sendable, Equatable, Codable {
  public let url: String
  public let preferredTitle: String?
  public let captureSnapshot: Bool
  public let waitPolicy: PraxisBrowserWaitPolicy
  public let timeoutSeconds: Double?

  public init(
    url: String,
    preferredTitle: String? = nil,
    captureSnapshot: Bool = true,
    waitPolicy: PraxisBrowserWaitPolicy = .domReady,
    timeoutSeconds: Double? = 2
  ) {
    self.url = url
    self.preferredTitle = preferredTitle
    self.captureSnapshot = captureSnapshot
    self.waitPolicy = waitPolicy
    self.timeoutSeconds = timeoutSeconds
  }
}

/// Structured grounding command for the search capability chain.
public struct PraxisCapabilitySearchGroundCommand: Sendable, Equatable, Codable {
  public let taskSummary: String
  public let exampleURL: String?
  public let requestedFacts: [String]
  public let locale: String?
  public let maxPages: Int

  public init(
    taskSummary: String,
    exampleURL: String? = nil,
    requestedFacts: [String] = [],
    locale: String? = nil,
    maxPages: Int = 5
  ) {
    self.taskSummary = taskSummary
    self.exampleURL = exampleURL
    self.requestedFacts = requestedFacts
    self.locale = locale
    self.maxPages = maxPages
  }
}

/// Result snapshot for one thin generation call.
public struct PraxisCapabilityGenerationSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let outputText: String
  public let structuredFields: [String: PraxisValue]
  public let backend: String
  public let providerOperationID: String?
  public let completedAt: String?
  public let preferredModel: String?

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    outputText: String,
    structuredFields: [String: PraxisValue],
    backend: String,
    providerOperationID: String? = nil,
    completedAt: String? = nil,
    preferredModel: String? = nil
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.outputText = outputText
    self.structuredFields = structuredFields
    self.backend = backend
    self.providerOperationID = providerOperationID
    self.completedAt = completedAt
    self.preferredModel = preferredModel
  }
}

/// One bounded stream chunk projected from a thin generation stream call.
public struct PraxisCapabilityGenerationChunkSnapshot: Sendable, Equatable, Codable {
  public let index: Int
  public let text: String
  public let isFinal: Bool

  public init(
    index: Int,
    text: String,
    isFinal: Bool
  ) {
    self.index = index
    self.text = text
    self.isFinal = isFinal
  }
}

/// Result snapshot for one bounded streaming-style generation call.
public struct PraxisCapabilityGenerationStreamSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let outputText: String
  public let chunks: [PraxisCapabilityGenerationChunkSnapshot]
  public let backend: String
  public let providerOperationID: String?
  public let completedAt: String?
  public let preferredModel: String?

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    outputText: String,
    chunks: [PraxisCapabilityGenerationChunkSnapshot],
    backend: String,
    providerOperationID: String? = nil,
    completedAt: String? = nil,
    preferredModel: String? = nil
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.outputText = outputText
    self.chunks = chunks
    self.backend = backend
    self.providerOperationID = providerOperationID
    self.completedAt = completedAt
    self.preferredModel = preferredModel
  }
}

/// Result snapshot for one thin embedding call.
public struct PraxisCapabilityEmbeddingSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let vectorLength: Int
  public let preferredModel: String?

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    vectorLength: Int,
    preferredModel: String? = nil
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.vectorLength = vectorLength
    self.preferredModel = preferredModel
  }
}

/// Result snapshot for one thin tool-call capability.
public struct PraxisCapabilityToolCallSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let toolName: String
  public let status: PraxisHostCapabilityExecutionStatus
  public let summary: String

  public init(
    capabilityID: PraxisCapabilityID,
    toolName: String,
    status: PraxisHostCapabilityExecutionStatus,
    summary: String
  ) {
    self.capabilityID = capabilityID
    self.toolName = toolName
    self.status = status
    self.summary = summary
  }
}

/// Result snapshot for one thin file-upload capability.
public struct PraxisCapabilityFileUploadSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let fileID: String
  public let backend: String

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    fileID: String,
    backend: String
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.fileID = fileID
    self.backend = backend
  }
}

/// Result snapshot for one thin batch-submit capability.
public struct PraxisCapabilityBatchSubmitSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let batchID: String
  public let backend: String

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    batchID: String,
    backend: String
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.batchID = batchID
    self.backend = backend
  }
}

/// Result snapshot for one runtime session-open capability call.
public struct PraxisRuntimeSessionSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let sessionID: PraxisSessionID
  public let title: String
  public let temperature: PraxisSessionTemperature
  public let summary: String

  public init(
    capabilityID: PraxisCapabilityID,
    sessionID: PraxisSessionID,
    title: String,
    temperature: PraxisSessionTemperature,
    summary: String
  ) {
    self.capabilityID = capabilityID
    self.sessionID = sessionID
    self.title = title
    self.temperature = temperature
    self.summary = summary
  }
}

/// One projected web-search result snapshot.
public struct PraxisCapabilitySearchWebResultSnapshot: Sendable, Equatable, Codable {
  public let title: String
  public let snippet: String
  public let url: String
  public let source: String?

  public init(
    title: String,
    snippet: String,
    url: String,
    source: String? = nil
  ) {
    self.title = title
    self.snippet = snippet
    self.url = url
    self.source = source
  }
}

/// Result snapshot for one web-search capability call.
public struct PraxisCapabilitySearchWebSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let query: String
  public let summary: String
  public let provider: String?
  public let results: [PraxisCapabilitySearchWebResultSnapshot]

  public init(
    capabilityID: PraxisCapabilityID,
    query: String,
    summary: String,
    provider: String? = nil,
    results: [PraxisCapabilitySearchWebResultSnapshot]
  ) {
    self.capabilityID = capabilityID
    self.query = query
    self.summary = summary
    self.provider = provider
    self.results = results
  }
}

/// Result snapshot for one fetch capability call.
public struct PraxisCapabilitySearchFetchSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let requestedURL: String
  public let finalURL: String
  public let title: String?
  public let snapshotPath: String?
  public let summary: String

  public init(
    capabilityID: PraxisCapabilityID,
    requestedURL: String,
    finalURL: String,
    title: String? = nil,
    snapshotPath: String? = nil,
    summary: String
  ) {
    self.capabilityID = capabilityID
    self.requestedURL = requestedURL
    self.finalURL = finalURL
    self.title = title
    self.snapshotPath = snapshotPath
    self.summary = summary
  }
}

/// One projected page record for grounded search evidence.
public struct PraxisCapabilityGroundedPageSnapshot: Sendable, Equatable, Codable {
  public let role: PraxisBrowserGroundingSourceRole
  public let url: String
  public let title: String?
  public let snapshotPath: String?
  public let screenshotPath: String?
  public let capturedAt: String?

  public init(page: PraxisBrowserGroundingPageEvidence) {
    role = page.role
    url = page.url
    title = page.title
    snapshotPath = page.snapshotPath
    screenshotPath = page.screenshotPath
    capturedAt = page.capturedAt
  }
}

/// One projected fact record for grounded search evidence.
public struct PraxisCapabilityGroundedFactSnapshot: Sendable, Equatable, Codable {
  public let name: String
  public let status: PraxisBrowserGroundingFactStatus
  public let value: String?
  public let unit: String?
  public let detail: String?
  public let sourceRole: PraxisBrowserGroundingSourceRole?
  public let sourceURL: String?
  public let sourceTitle: String?
  public let citationSnippet: String?
  public let observedAt: String?

  public init(fact: PraxisBrowserGroundingFactEvidence) {
    name = fact.name
    status = fact.status
    value = fact.value
    unit = fact.unit
    detail = fact.detail
    sourceRole = fact.sourceRole
    sourceURL = fact.sourceURL
    sourceTitle = fact.sourceTitle
    citationSnippet = fact.citationSnippet
    observedAt = fact.observedAt
  }
}

/// Result snapshot for one grounding capability call.
public struct PraxisCapabilitySearchGroundSnapshot: Sendable, Equatable, Codable {
  public let capabilityID: PraxisCapabilityID
  public let summary: String
  public let pages: [PraxisCapabilityGroundedPageSnapshot]
  public let facts: [PraxisCapabilityGroundedFactSnapshot]
  public let generatedAt: String?
  public let blockedReason: String?

  public init(
    capabilityID: PraxisCapabilityID,
    summary: String,
    pages: [PraxisCapabilityGroundedPageSnapshot],
    facts: [PraxisCapabilityGroundedFactSnapshot],
    generatedAt: String? = nil,
    blockedReason: String? = nil
  ) {
    self.capabilityID = capabilityID
    self.summary = summary
    self.pages = pages
    self.facts = facts
    self.generatedAt = generatedAt
    self.blockedReason = blockedReason
  }
}

private func normalizedCapabilityText(_ rawValue: String?, fieldName: String) throws -> String {
  guard let trimmed = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
    throw PraxisError.invalidInput("Thin capability \(fieldName) must not be empty.")
  }
  return trimmed
}

private func chunkedCapabilityText(_ text: String, chunkCharacterCount: Int) -> [PraxisCapabilityGenerationChunkSnapshot] {
  guard !text.isEmpty else {
    return [.init(index: 0, text: "", isFinal: true)]
  }

  var chunks: [PraxisCapabilityGenerationChunkSnapshot] = []
  var currentIndex = text.startIndex
  var chunkIndex = 0
  while currentIndex < text.endIndex {
    let nextIndex = text.index(currentIndex, offsetBy: chunkCharacterCount, limitedBy: text.endIndex) ?? text.endIndex
    let chunkText = String(text[currentIndex..<nextIndex])
    chunks.append(
      .init(
        index: chunkIndex,
        text: chunkText,
        isFinal: nextIndex == text.endIndex
      )
    )
    currentIndex = nextIndex
    chunkIndex += 1
  }
  return chunks
}

private func thinCapabilityManifestIDs(for adapters: PraxisHostAdapterRegistry) -> Set<PraxisCapabilityID> {
  var capabilityIDs: Set<PraxisCapabilityID> = [PraxisThinCapabilityKey.sessionOpen.capabilityID]

  if adapters.providerInferenceExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.generateCreate.capabilityID)
    capabilityIDs.insert(PraxisThinCapabilityKey.generateStream.capabilityID)
  }
  if adapters.providerEmbeddingExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.embedCreate.capabilityID)
  }
  if adapters.providerMCPExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.toolCall.capabilityID)
  }
  if adapters.providerFileStore != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.fileUpload.capabilityID)
  }
  if adapters.providerBatchExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.batchSubmit.capabilityID)
  }
  if adapters.providerWebSearchExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.searchWeb.capabilityID)
  }
  if adapters.browserExecutor != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.searchFetch.capabilityID)
  }
  if adapters.browserGroundingCollector != nil {
    capabilityIDs.insert(PraxisThinCapabilityKey.searchGround.capabilityID)
  }

  return capabilityIDs
}

/// Facade for the Phase 3 thin-capability baseline.
///
/// This surface exposes provider-backed generation, embedding, tool, file, batch, and session
/// calls without leaking composition or transport-specific details to RuntimeKit callers.
public final class PraxisCapabilityFacade: Sendable {
  private let dependencies: PraxisDependencyGraph?
  private let sessionRegistry: PraxisSessionRegistry
  private let catalogBuilder: PraxisCapabilityCatalogBuilder

  public init(
    dependencies: PraxisDependencyGraph,
    sessionRegistry: PraxisSessionRegistry = .init(),
    catalogBuilder: PraxisCapabilityCatalogBuilder = .init()
  ) {
    self.dependencies = dependencies
    self.sessionRegistry = sessionRegistry
    self.catalogBuilder = catalogBuilder
  }

  public static func unsupported() -> PraxisCapabilityFacade {
    PraxisCapabilityFacade(dependencies: nil)
  }

  private init(
    dependencies: PraxisDependencyGraph?,
    sessionRegistry: PraxisSessionRegistry = .init(),
    catalogBuilder: PraxisCapabilityCatalogBuilder = .init()
  ) {
    self.dependencies = dependencies
    self.sessionRegistry = sessionRegistry
    self.catalogBuilder = catalogBuilder
  }

  /// Reads the currently available thin-capability catalog snapshot.
  ///
  /// - Returns: Catalog entries currently wired for the active host profile.
  public func catalog() -> PraxisCapabilityCatalogSnapshot {
    guard let dependencies else {
      return catalogBuilder.buildSnapshot(manifests: [])
    }

    let baseline = catalogBuilder.buildThinCapabilityBaseline()
    let availableIDs = thinCapabilityManifestIDs(for: dependencies.hostAdapters)
    let manifests = baseline.manifests.filter { availableIDs.contains($0.id) }
    return catalogBuilder.buildSnapshot(manifests: manifests)
  }

  /// Executes one bounded generation request.
  ///
  /// - Parameter command: The caller-friendly generation command.
  /// - Returns: The normalized generation snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func generate(_ command: PraxisCapabilityGenerateCommand) async throws -> PraxisCapabilityGenerationSnapshot {
    let prompt = try normalizedCapabilityText(command.prompt, fieldName: "prompt")
    let executor = try requireInferenceExecutor(capability: PraxisThinCapabilityKey.generateCreate.rawValue)
    let response = try await executor.infer(
      .init(
        systemPrompt: command.systemPrompt,
        prompt: prompt,
        contextSummary: command.contextSummary,
        preferredModel: command.preferredModel,
        temperature: command.temperature,
        requiredCapabilities: command.requiredCapabilityIDs.map(\.rawValue)
      )
    )

    return PraxisCapabilityGenerationSnapshot(
      capabilityID: PraxisThinCapabilityKey.generateCreate.capabilityID,
      summary: "Thin capability \(PraxisThinCapabilityKey.generateCreate.rawValue) returned a bounded generation response.",
      outputText: response.output.summary,
      structuredFields: response.output.structuredFields,
      backend: response.receipt.backend,
      providerOperationID: response.receipt.providerOperationID,
      completedAt: response.receipt.completedAt,
      preferredModel: command.preferredModel
    )
  }

  /// Executes one bounded streaming-style generation request.
  ///
  /// - Parameters:
  ///   - command: The caller-friendly generation command.
  ///   - chunkCharacterCount: Maximum number of characters in each projected chunk.
  /// - Returns: The normalized streaming snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func stream(
    _ command: PraxisCapabilityGenerateCommand,
    chunkCharacterCount: Int = 80
  ) async throws -> PraxisCapabilityGenerationStreamSnapshot {
    guard chunkCharacterCount > 0 else {
      throw PraxisError.invalidInput("Thin capability generate.stream requires a positive chunkCharacterCount.")
    }

    let generated = try await generate(command)
    let chunks = chunkedCapabilityText(generated.outputText, chunkCharacterCount: chunkCharacterCount)
    return PraxisCapabilityGenerationStreamSnapshot(
      capabilityID: PraxisThinCapabilityKey.generateStream.capabilityID,
      summary: "Thin capability \(PraxisThinCapabilityKey.generateStream.rawValue) projected \(chunks.count) bounded chunk(s).",
      outputText: generated.outputText,
      chunks: chunks,
      backend: generated.backend,
      providerOperationID: generated.providerOperationID,
      completedAt: generated.completedAt,
      preferredModel: generated.preferredModel
    )
  }

  /// Executes one embedding request.
  ///
  /// - Parameter command: The caller-friendly embedding command.
  /// - Returns: The normalized embedding snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func embed(_ command: PraxisCapabilityEmbedCommand) async throws -> PraxisCapabilityEmbeddingSnapshot {
    let content = try normalizedCapabilityText(command.content, fieldName: "content")
    let executor = try requireEmbeddingExecutor()
    let response = try await executor.embed(
      .init(
        content: content,
        preferredModel: command.preferredModel
      )
    )
    return PraxisCapabilityEmbeddingSnapshot(
      capabilityID: PraxisThinCapabilityKey.embedCreate.capabilityID,
      summary: "Thin capability \(PraxisThinCapabilityKey.embedCreate.rawValue) created an embedding response with vector length \(response.vectorLength).",
      vectorLength: response.vectorLength,
      preferredModel: response.model ?? command.preferredModel
    )
  }

  /// Executes one tool call through the MCP-backed tool lane.
  ///
  /// - Parameter command: The caller-friendly tool-call command.
  /// - Returns: The normalized tool-call snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func callTool(_ command: PraxisCapabilityToolCallCommand) async throws -> PraxisCapabilityToolCallSnapshot {
    let toolName = try normalizedCapabilityText(command.toolName, fieldName: "toolName")
    let summary = try normalizedCapabilityText(command.summary, fieldName: "summary")
    let executor = try requireMCPExecutor()
    let receipt = try await executor.callTool(
      .init(
        toolName: toolName,
        summary: summary,
        serverName: command.serverName?.trimmingCharacters(in: .whitespacesAndNewlines)
      )
    )
    return PraxisCapabilityToolCallSnapshot(
      capabilityID: PraxisThinCapabilityKey.toolCall.capabilityID,
      toolName: receipt.toolName,
      status: receipt.status,
      summary: receipt.summary
    )
  }

  /// Uploads one provider file payload.
  ///
  /// - Parameter command: The caller-friendly file-upload command.
  /// - Returns: The normalized file-upload snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func uploadFile(_ command: PraxisCapabilityFileUploadCommand) async throws -> PraxisCapabilityFileUploadSnapshot {
    let summary = try normalizedCapabilityText(command.summary, fieldName: "summary")
    let store = try requireFileStore()
    let receipt = try await store.upload(
      .init(
        summary: summary,
        purpose: command.purpose?.trimmingCharacters(in: .whitespacesAndNewlines)
      )
    )
    return PraxisCapabilityFileUploadSnapshot(
      capabilityID: PraxisThinCapabilityKey.fileUpload.capabilityID,
      summary: "Thin capability \(PraxisThinCapabilityKey.fileUpload.rawValue) uploaded one provider file payload.",
      fileID: receipt.fileID,
      backend: receipt.backend
    )
  }

  /// Submits one provider batch workload.
  ///
  /// - Parameter command: The caller-friendly batch-submit command.
  /// - Returns: The normalized batch-submit snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func submitBatch(_ command: PraxisCapabilityBatchSubmitCommand) async throws -> PraxisCapabilityBatchSubmitSnapshot {
    let summary = try normalizedCapabilityText(command.summary, fieldName: "summary")
    guard command.itemCount > 0 else {
      throw PraxisError.invalidInput("Thin capability batch.submit requires itemCount > 0.")
    }
    let executor = try requireBatchExecutor()
    let receipt = try await executor.enqueue(
      .init(
        summary: summary,
        itemCount: command.itemCount
      )
    )
    return PraxisCapabilityBatchSubmitSnapshot(
      capabilityID: PraxisThinCapabilityKey.batchSubmit.capabilityID,
      summary: "Thin capability \(PraxisThinCapabilityKey.batchSubmit.rawValue) enqueued \(command.itemCount) batch item(s).",
      batchID: receipt.batchID,
      backend: receipt.backend
    )
  }

  /// Opens one runtime session header for repeated caller workflows.
  ///
  /// - Parameter command: The caller-friendly session-open command.
  /// - Returns: The normalized session snapshot.
  /// - Throws: Propagates validation failures.
  public func openSession(_ command: PraxisOpenRuntimeSessionCommand = .init()) async throws -> PraxisRuntimeSessionSnapshot {
    guard dependencies != nil else {
      throw PraxisError.unsupportedOperation("Thin capability session.open is not available in this facade profile.")
    }

    let rawSessionID = command.sessionID?.trimmingCharacters(in: .whitespacesAndNewlines)
    let sessionID = PraxisSessionID(
      rawValue: (rawSessionID?.isEmpty == false ? rawSessionID : "runtime.session.\(UUID().uuidString.lowercased())")!
    )
    let rawTitle = command.title?.trimmingCharacters(in: .whitespacesAndNewlines)
    let title = rawTitle?.isEmpty == false ? rawTitle! : "Runtime Session \(sessionID.rawValue)"
    let metadata: [String: PraxisValue] = [
      "openedBy": .string("PraxisCapabilityFacade"),
      "capabilityID": .string(PraxisThinCapabilityKey.sessionOpen.rawValue),
    ]
    let header = await sessionRegistry.create(
      id: sessionID,
      title: title,
      metadata: metadata
    )
    return PraxisRuntimeSessionSnapshot(
      capabilityID: PraxisThinCapabilityKey.sessionOpen.capabilityID,
      sessionID: header.id,
      title: header.title,
      temperature: header.temperature,
      summary: "Thin capability \(PraxisThinCapabilityKey.sessionOpen.rawValue) opened runtime session \(header.id.rawValue)."
    )
  }

  /// Executes one web search request.
  ///
  /// - Parameter command: The caller-friendly web-search command.
  /// - Returns: The normalized web-search snapshot.
  /// - Throws: Propagates provider or validation failures.
  public func searchWeb(_ command: PraxisCapabilitySearchWebCommand) async throws -> PraxisCapabilitySearchWebSnapshot {
    let query = try normalizedCapabilityText(command.query, fieldName: "query")
    guard command.limit > 0 else {
      throw PraxisError.invalidInput("Thin capability search.web requires limit > 0.")
    }
    let executor = try requireWebSearchExecutor()
    let response = try await executor.search(
      .init(
        query: query,
        locale: command.locale?.trimmingCharacters(in: .whitespacesAndNewlines),
        preferredDomains: command.preferredDomains.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
        limit: command.limit
      )
    )
    return PraxisCapabilitySearchWebSnapshot(
      capabilityID: PraxisThinCapabilityKey.searchWeb.capabilityID,
      query: response.query,
      summary: response.summary ?? "Thin capability \(PraxisThinCapabilityKey.searchWeb.rawValue) returned \(response.results.count) result(s).",
      provider: response.provider,
      results: response.results.map {
        .init(
          title: $0.title,
          snippet: $0.snippet,
          url: $0.url,
          source: $0.source
        )
      }
    )
  }

  /// Executes one fetch request for a candidate URL.
  ///
  /// - Parameter command: The caller-friendly fetch command.
  /// - Returns: The normalized fetch snapshot.
  /// - Throws: Propagates browser or validation failures.
  public func fetchSearchResult(_ command: PraxisCapabilitySearchFetchCommand) async throws -> PraxisCapabilitySearchFetchSnapshot {
    let url = try normalizedCapabilityText(command.url, fieldName: "url")
    let executor = try requireBrowserExecutor()
    let receipt = try await executor.navigate(
      .init(
        url: url,
        waitPolicy: command.waitPolicy,
        timeoutSeconds: command.timeoutSeconds,
        preferredTitle: command.preferredTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
        captureSnapshot: command.captureSnapshot
      )
    )
    return PraxisCapabilitySearchFetchSnapshot(
      capabilityID: PraxisThinCapabilityKey.searchFetch.capabilityID,
      requestedURL: receipt.requestedURL,
      finalURL: receipt.finalURL,
      title: receipt.title,
      snapshotPath: receipt.snapshotPath,
      summary: "Thin capability \(PraxisThinCapabilityKey.searchFetch.rawValue) fetched candidate page \(receipt.finalURL)."
    )
  }

  /// Collects grounded evidence for one candidate URL.
  ///
  /// - Parameter command: The caller-friendly grounding command.
  /// - Returns: The normalized grounded evidence snapshot.
  /// - Throws: Propagates collector or validation failures.
  public func groundSearchResult(_ command: PraxisCapabilitySearchGroundCommand) async throws -> PraxisCapabilitySearchGroundSnapshot {
    let taskSummary = try normalizedCapabilityText(command.taskSummary, fieldName: "taskSummary")
    guard command.maxPages > 0 else {
      throw PraxisError.invalidInput("Thin capability search.ground requires maxPages > 0.")
    }
    let collector = try requireBrowserGroundingCollector()
    let bundle = try await collector.collectEvidence(
      .init(
        taskSummary: taskSummary,
        exampleURL: command.exampleURL?.trimmingCharacters(in: .whitespacesAndNewlines),
        requestedFacts: command.requestedFacts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
        locale: command.locale?.trimmingCharacters(in: .whitespacesAndNewlines),
        maxPages: command.maxPages
      )
    )
    let summary: String
    if let blockedReason = bundle.blockedReason {
      summary = "Thin capability \(PraxisThinCapabilityKey.searchGround.rawValue) returned blocked grounding evidence: \(blockedReason)"
    } else {
      summary = "Thin capability \(PraxisThinCapabilityKey.searchGround.rawValue) collected \(bundle.pages.count) page(s) and \(bundle.facts.count) fact(s)."
    }
    return PraxisCapabilitySearchGroundSnapshot(
      capabilityID: PraxisThinCapabilityKey.searchGround.capabilityID,
      summary: summary,
      pages: bundle.pages.map(PraxisCapabilityGroundedPageSnapshot.init(page:)),
      facts: bundle.facts.map(PraxisCapabilityGroundedFactSnapshot.init(fact:)),
      generatedAt: bundle.generatedAt,
      blockedReason: bundle.blockedReason
    )
  }

  private func requireInferenceExecutor(capability: String) throws -> any PraxisProviderInferenceExecutor {
    guard let executor = dependencies?.hostAdapters.providerInferenceExecutor else {
      throw PraxisError.dependencyMissing("Thin capability \(capability) requires a provider inference executor.")
    }
    return executor
  }

  private func requireEmbeddingExecutor() throws -> any PraxisProviderEmbeddingExecutor {
    guard let executor = dependencies?.hostAdapters.providerEmbeddingExecutor else {
      throw PraxisError.dependencyMissing("Thin capability embed.create requires a provider embedding executor.")
    }
    return executor
  }

  private func requireFileStore() throws -> any PraxisProviderFileStore {
    guard let store = dependencies?.hostAdapters.providerFileStore else {
      throw PraxisError.dependencyMissing("Thin capability file.upload requires a provider file store.")
    }
    return store
  }

  private func requireBatchExecutor() throws -> any PraxisProviderBatchExecutor {
    guard let executor = dependencies?.hostAdapters.providerBatchExecutor else {
      throw PraxisError.dependencyMissing("Thin capability batch.submit requires a provider batch executor.")
    }
    return executor
  }

  private func requireMCPExecutor() throws -> any PraxisProviderMCPExecutor {
    guard let executor = dependencies?.hostAdapters.providerMCPExecutor else {
      throw PraxisError.dependencyMissing("Thin capability tool.call requires a provider MCP executor.")
    }
    return executor
  }

  private func requireWebSearchExecutor() throws -> any PraxisProviderWebSearchExecutor {
    guard let executor = dependencies?.hostAdapters.providerWebSearchExecutor else {
      throw PraxisError.dependencyMissing("Thin capability search.web requires a provider web search executor.")
    }
    return executor
  }

  private func requireBrowserExecutor() throws -> any PraxisBrowserExecutor {
    guard let executor = dependencies?.hostAdapters.browserExecutor else {
      throw PraxisError.dependencyMissing("Thin capability search.fetch requires a browser executor.")
    }
    return executor
  }

  private func requireBrowserGroundingCollector() throws -> any PraxisBrowserGroundingCollector {
    guard let collector = dependencies?.hostAdapters.browserGroundingCollector else {
      throw PraxisError.dependencyMissing("Thin capability search.ground requires a browser grounding collector.")
    }
    return collector
  }
}
