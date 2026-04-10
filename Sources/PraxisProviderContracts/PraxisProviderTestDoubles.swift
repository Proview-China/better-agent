import PraxisCapabilityResults

/// Stub capability executor used by runtime tests.
public struct PraxisStubCapabilityExecutor: PraxisCapabilityExecutor, Sendable {
  public let receiptFactory: @Sendable (PraxisHostCapabilityRequest) -> PraxisHostCapabilityReceipt

  public init(
    receiptFactory: @escaping @Sendable (PraxisHostCapabilityRequest) -> PraxisHostCapabilityReceipt
  ) {
    self.receiptFactory = receiptFactory
  }

  public func execute(_ request: PraxisHostCapabilityRequest) async throws -> PraxisHostCapabilityReceipt {
    receiptFactory(request)
  }
}

/// Stub inference executor that returns deterministic normalized outputs.
public struct PraxisStubProviderInferenceExecutor: PraxisProviderInferenceExecutor, Sendable {
  public let responseFactory: @Sendable (PraxisProviderInferenceRequest) -> PraxisProviderInferenceResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisProviderInferenceRequest) -> PraxisProviderInferenceResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func infer(_ request: PraxisProviderInferenceRequest) async throws -> PraxisProviderInferenceResponse {
    responseFactory(request)
  }
}

/// Stub embedding executor with deterministic responses.
public struct PraxisStubProviderEmbeddingExecutor: PraxisProviderEmbeddingExecutor, Sendable {
  public let responseFactory: @Sendable (PraxisProviderEmbeddingRequest) -> PraxisProviderEmbeddingResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisProviderEmbeddingRequest) -> PraxisProviderEmbeddingResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func embed(_ request: PraxisProviderEmbeddingRequest) async throws -> PraxisProviderEmbeddingResponse {
    responseFactory(request)
  }
}

/// In-memory fake file store that records uploads.
public actor PraxisFakeProviderFileStore: PraxisProviderFileStore {
  private var requests: [PraxisProviderFileUploadRequest] = []
  private let backend: String

  public init(backend: String = "provider-test") {
    self.backend = backend
  }

  public func upload(_ request: PraxisProviderFileUploadRequest) async throws -> PraxisProviderFileUploadReceipt {
    requests.append(request)
    return PraxisProviderFileUploadReceipt(fileID: "file-\(requests.count)", backend: backend)
  }

  public func allRequests() async -> [PraxisProviderFileUploadRequest] {
    requests
  }
}

/// In-memory fake batch executor that records enqueued work.
public actor PraxisFakeProviderBatchExecutor: PraxisProviderBatchExecutor {
  private var requests: [PraxisProviderBatchRequest] = []
  private let backend: String

  public init(backend: String = "provider-test") {
    self.backend = backend
  }

  public func enqueue(_ request: PraxisProviderBatchRequest) async throws -> PraxisProviderBatchReceipt {
    requests.append(request)
    return PraxisProviderBatchReceipt(batchID: "batch-\(requests.count)", backend: backend)
  }

  public func allRequests() async -> [PraxisProviderBatchRequest] {
    requests
  }
}

/// Stub skill registry for deterministic skill discovery.
public struct PraxisStubProviderSkillRegistry: PraxisProviderSkillRegistry, Sendable {
  public let skills: [String]

  public init(skills: [String]) {
    self.skills = skills
  }

  public func listSkillKeys() async throws -> [String] {
    skills
  }
}

/// In-memory fake skill activator that records activation requests.
public actor PraxisFakeProviderSkillActivator: PraxisProviderSkillActivator {
  private var requests: [PraxisProviderSkillActivationRequest] = []

  public init() {}

  public func activate(_ request: PraxisProviderSkillActivationRequest) async throws -> PraxisProviderSkillActivationReceipt {
    requests.append(request)
    return PraxisProviderSkillActivationReceipt(skillKey: request.skillKey, activated: true)
  }

  public func allRequests() async -> [PraxisProviderSkillActivationRequest] {
    requests
  }
}

/// Stub MCP executor that returns deterministic tool receipts.
public struct PraxisStubProviderMCPExecutor: PraxisProviderMCPExecutor, Sendable {
  public let receiptFactory: @Sendable (PraxisProviderMCPToolCallRequest) -> PraxisProviderMCPToolCallReceipt

  public init(
    receiptFactory: @escaping @Sendable (PraxisProviderMCPToolCallRequest) -> PraxisProviderMCPToolCallReceipt
  ) {
    self.receiptFactory = receiptFactory
  }

  public func callTool(_ request: PraxisProviderMCPToolCallRequest) async throws -> PraxisProviderMCPToolCallReceipt {
    receiptFactory(request)
  }
}
