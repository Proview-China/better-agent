public protocol PraxisUserInputDriver: Sendable {
  /// Prompts the user for structured input.
  ///
  /// - Parameter request: Prompt request to show.
  /// - Returns: Prompt response including selected choice information when applicable.
  func prompt(_ request: PraxisPromptRequest) async throws -> PraxisPromptResponse
}

public protocol PraxisPermissionDriver: Sendable {
  /// Requests a user permission decision.
  ///
  /// - Parameter request: Permission request to present.
  /// - Returns: Structured permission decision.
  func request(_ request: PraxisPermissionRequest) async throws -> PraxisPermissionDecision
}

public protocol PraxisTerminalPresenter: Sendable {
  /// Presents a terminal event to the host.
  ///
  /// - Parameter event: Terminal event to render.
  func present(_ event: PraxisTerminalEvent) async
}

public protocol PraxisConversationPresenter: Sendable {
  /// Presents a conversation state update to the host.
  ///
  /// - Parameter presentation: Structured conversation presentation.
  func present(_ presentation: PraxisConversationPresentation) async
}

public protocol PraxisAudioTranscriptionDriver: Sendable {
  /// Transcribes audio into text.
  ///
  /// - Parameter request: Audio transcription request.
  /// - Returns: Transcription response.
  func transcribe(_ request: PraxisAudioTranscriptionRequest) async throws -> PraxisAudioTranscriptionResponse
}

public protocol PraxisSpeechSynthesisDriver: Sendable {
  /// Synthesizes speech from text.
  ///
  /// - Parameter request: Speech synthesis request.
  /// - Returns: Speech synthesis response.
  func synthesize(_ request: PraxisSpeechSynthesisRequest) async throws -> PraxisSpeechSynthesisResponse
}

public protocol PraxisImageGenerationDriver: Sendable {
  /// Generates an image from a structured prompt request.
  ///
  /// - Parameter request: Image generation request.
  /// - Returns: Image generation response.
  func generate(_ request: PraxisImageGenerationRequest) async throws -> PraxisImageGenerationResponse
}
