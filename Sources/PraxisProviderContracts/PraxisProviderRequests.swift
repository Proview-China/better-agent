import PraxisCapabilityResults
import PraxisCoreTypes

public enum PraxisHostCapabilityExecutionStatus: String, Sendable, Codable {
  case succeeded
  case failed
  case queued
}

public struct PraxisHostCapabilityRequest: Sendable, Equatable, Codable {
  public let capabilityKey: String
  public let payloadSummary: String
  public let traceID: String?
  public let metadata: [String: PraxisValue]

  public init(
    capabilityKey: String,
    payloadSummary: String,
    traceID: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.capabilityKey = capabilityKey
    self.payloadSummary = payloadSummary
    self.traceID = traceID
    self.metadata = metadata
  }
}

public struct PraxisHostCapabilityReceipt: Sendable, Equatable, Codable {
  public let capabilityKey: String
  public let backend: String
  public let status: PraxisHostCapabilityExecutionStatus
  public let providerOperationID: String?
  public let completedAt: String?
  public let summary: String

  public init(
    capabilityKey: String,
    backend: String,
    status: PraxisHostCapabilityExecutionStatus,
    providerOperationID: String? = nil,
    completedAt: String? = nil,
    summary: String
  ) {
    self.capabilityKey = capabilityKey
    self.backend = backend
    self.status = status
    self.providerOperationID = providerOperationID
    self.completedAt = completedAt
    self.summary = summary
  }
}

public struct PraxisProviderInferenceRequest: Sendable, Equatable, Codable {
  public let systemPrompt: String?
  public let prompt: String
  public let contextSummary: String?
  public let preferredModel: String?
  public let temperature: Double?
  public let requiredCapabilities: [String]
  public let metadata: [String: PraxisValue]

  public init(
    systemPrompt: String? = nil,
    prompt: String,
    contextSummary: String? = nil,
    preferredModel: String? = nil,
    temperature: Double? = nil,
    requiredCapabilities: [String] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.systemPrompt = systemPrompt
    self.prompt = prompt
    self.contextSummary = contextSummary
    self.preferredModel = preferredModel
    self.temperature = temperature
    self.requiredCapabilities = requiredCapabilities
    self.metadata = metadata
  }
}

public struct PraxisProviderInferenceResponse: Sendable, Equatable, Codable {
  public let output: PraxisNormalizedCapabilityOutput
  public let receipt: PraxisHostCapabilityReceipt

  public init(output: PraxisNormalizedCapabilityOutput, receipt: PraxisHostCapabilityReceipt) {
    self.output = output
    self.receipt = receipt
  }
}

public struct PraxisProviderEmbeddingRequest: Sendable, Equatable, Codable {
  public let content: String
  public let preferredModel: String?
  public let metadata: [String: PraxisValue]

  public init(
    content: String,
    preferredModel: String? = nil,
    metadata: [String: PraxisValue] = [:]
  ) {
    self.content = content
    self.preferredModel = preferredModel
    self.metadata = metadata
  }
}

public struct PraxisProviderEmbeddingResponse: Sendable, Equatable, Codable {
  public let vectorLength: Int
  public let model: String?

  public init(vectorLength: Int, model: String? = nil) {
    self.vectorLength = vectorLength
    self.model = model
  }
}

public struct PraxisProviderFileUploadRequest: Sendable, Equatable, Codable {
  public let summary: String
  public let purpose: String?

  public init(summary: String, purpose: String? = nil) {
    self.summary = summary
    self.purpose = purpose
  }
}

public struct PraxisProviderFileUploadReceipt: Sendable, Equatable, Codable {
  public let fileID: String
  public let backend: String

  public init(fileID: String, backend: String) {
    self.fileID = fileID
    self.backend = backend
  }
}

public struct PraxisProviderBatchRequest: Sendable, Equatable, Codable {
  public let summary: String
  public let itemCount: Int

  public init(summary: String, itemCount: Int) {
    self.summary = summary
    self.itemCount = itemCount
  }
}

public struct PraxisProviderBatchReceipt: Sendable, Equatable, Codable {
  public let batchID: String
  public let backend: String

  public init(batchID: String, backend: String) {
    self.batchID = batchID
    self.backend = backend
  }
}

public struct PraxisProviderSkillActivationRequest: Sendable, Equatable, Codable {
  public let skillKey: String
  public let reason: String?

  public init(skillKey: String, reason: String? = nil) {
    self.skillKey = skillKey
    self.reason = reason
  }
}

public struct PraxisProviderSkillActivationReceipt: Sendable, Equatable, Codable {
  public let skillKey: String
  public let activated: Bool

  public init(skillKey: String, activated: Bool) {
    self.skillKey = skillKey
    self.activated = activated
  }
}

public struct PraxisProviderMCPToolCallRequest: Sendable, Equatable, Codable {
  public let toolName: String
  public let summary: String
  public let serverName: String?

  public init(toolName: String, summary: String, serverName: String? = nil) {
    self.toolName = toolName
    self.summary = summary
    self.serverName = serverName
  }
}

public struct PraxisProviderMCPToolCallReceipt: Sendable, Equatable, Codable {
  public let toolName: String
  public let status: PraxisHostCapabilityExecutionStatus
  public let summary: String

  public init(toolName: String, status: PraxisHostCapabilityExecutionStatus, summary: String) {
    self.toolName = toolName
    self.status = status
    self.summary = summary
  }
}
