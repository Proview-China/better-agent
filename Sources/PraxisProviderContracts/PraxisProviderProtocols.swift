public protocol PraxisCapabilityExecutor: Sendable {
  /// Executes a host capability through the selected provider backend.
  ///
  /// - Parameter request: Host capability request.
  /// - Returns: Execution receipt from the provider layer.
  func execute(_ request: PraxisHostCapabilityRequest) async throws -> PraxisHostCapabilityReceipt
}

public protocol PraxisProviderInferenceExecutor: Sendable {
  /// Runs a provider inference request.
  ///
  /// - Parameter request: Inference request.
  /// - Returns: Normalized inference response.
  func infer(_ request: PraxisProviderInferenceRequest) async throws -> PraxisProviderInferenceResponse
}

public protocol PraxisProviderEmbeddingExecutor: Sendable {
  /// Runs a provider embedding request.
  ///
  /// - Parameter request: Embedding request.
  /// - Returns: Embedding response.
  func embed(_ request: PraxisProviderEmbeddingRequest) async throws -> PraxisProviderEmbeddingResponse
}

public protocol PraxisProviderFileStore: Sendable {
  /// Uploads a provider file payload.
  ///
  /// - Parameter request: File upload request.
  /// - Returns: File upload receipt.
  func upload(_ request: PraxisProviderFileUploadRequest) async throws -> PraxisProviderFileUploadReceipt
}

public protocol PraxisProviderBatchExecutor: Sendable {
  /// Enqueues a provider batch workload.
  ///
  /// - Parameter request: Batch request.
  /// - Returns: Batch receipt.
  func enqueue(_ request: PraxisProviderBatchRequest) async throws -> PraxisProviderBatchReceipt
}

public protocol PraxisProviderSkillRegistry: Sendable {
  /// Lists available provider skill keys.
  ///
  /// - Returns: Stable skill keys.
  func listSkillKeys() async throws -> [String]
}

public protocol PraxisProviderSkillActivator: Sendable {
  /// Activates a provider skill.
  ///
  /// - Parameter request: Skill activation request.
  /// - Returns: Activation receipt.
  func activate(_ request: PraxisProviderSkillActivationRequest) async throws -> PraxisProviderSkillActivationReceipt
}

public protocol PraxisProviderMCPExecutor: Sendable {
  /// Calls a provider-hosted MCP tool.
  ///
  /// - Parameter request: MCP tool call request.
  /// - Returns: Tool call receipt.
  func callTool(_ request: PraxisProviderMCPToolCallRequest) async throws -> PraxisProviderMCPToolCallReceipt
}
