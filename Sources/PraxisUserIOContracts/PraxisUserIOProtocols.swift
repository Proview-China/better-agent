public protocol PraxisUserInputDriver: Sendable {
  func prompt(_ request: PraxisPromptRequest) async throws -> PraxisPromptResponse
}

public protocol PraxisPermissionDriver: Sendable {
  func request(_ request: PraxisPermissionRequest) async throws -> Bool
}

public protocol PraxisTerminalPresenter: Sendable {
  func present(_ event: PraxisTerminalEvent) async
}

public protocol PraxisConversationPresenter: Sendable {
  func present(_ presentation: PraxisConversationPresentation) async
}

public protocol PraxisAudioTranscriptionDriver: Sendable {
  func transcribe(_ request: PraxisAudioTranscriptionRequest) async throws -> PraxisAudioTranscriptionResponse
}

public protocol PraxisSpeechSynthesisDriver: Sendable {
  func synthesize(_ request: PraxisSpeechSynthesisRequest) async throws -> PraxisSpeechSynthesisResponse
}

public protocol PraxisImageGenerationDriver: Sendable {
  func generate(_ request: PraxisImageGenerationRequest) async throws -> PraxisImageGenerationResponse
}
