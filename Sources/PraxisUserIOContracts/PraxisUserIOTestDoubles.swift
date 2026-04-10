/// Stub user input driver that returns deterministic prompt responses.
public struct PraxisStubUserInputDriver: PraxisUserInputDriver, Sendable {
  public let responseFactory: @Sendable (PraxisPromptRequest) -> PraxisPromptResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisPromptRequest) -> PraxisPromptResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func prompt(_ request: PraxisPromptRequest) async throws -> PraxisPromptResponse {
    responseFactory(request)
  }
}

/// Stub permission driver that returns deterministic decisions.
public struct PraxisStubPermissionDriver: PraxisPermissionDriver, Sendable {
  public let decisionFactory: @Sendable (PraxisPermissionRequest) -> PraxisPermissionDecision

  public init(
    decisionFactory: @escaping @Sendable (PraxisPermissionRequest) -> PraxisPermissionDecision
  ) {
    self.decisionFactory = decisionFactory
  }

  public func request(_ request: PraxisPermissionRequest) async throws -> PraxisPermissionDecision {
    decisionFactory(request)
  }
}

/// Spy terminal presenter that records all terminal events.
public actor PraxisSpyTerminalPresenter: PraxisTerminalPresenter {
  private var events: [PraxisTerminalEvent] = []

  public init() {}

  public func present(_ event: PraxisTerminalEvent) async {
    events.append(event)
  }

  public func allEvents() async -> [PraxisTerminalEvent] {
    events
  }
}

/// Spy conversation presenter that records all conversation presentations.
public actor PraxisSpyConversationPresenter: PraxisConversationPresenter {
  private var presentations: [PraxisConversationPresentation] = []

  public init() {}

  public func present(_ presentation: PraxisConversationPresentation) async {
    presentations.append(presentation)
  }

  public func allPresentations() async -> [PraxisConversationPresentation] {
    presentations
  }
}

/// Stub multimodal driver for audio transcription.
public struct PraxisStubAudioTranscriptionDriver: PraxisAudioTranscriptionDriver, Sendable {
  public let responseFactory: @Sendable (PraxisAudioTranscriptionRequest) -> PraxisAudioTranscriptionResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisAudioTranscriptionRequest) -> PraxisAudioTranscriptionResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func transcribe(_ request: PraxisAudioTranscriptionRequest) async throws -> PraxisAudioTranscriptionResponse {
    responseFactory(request)
  }
}

/// Stub multimodal driver for speech synthesis.
public struct PraxisStubSpeechSynthesisDriver: PraxisSpeechSynthesisDriver, Sendable {
  public let responseFactory: @Sendable (PraxisSpeechSynthesisRequest) -> PraxisSpeechSynthesisResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisSpeechSynthesisRequest) -> PraxisSpeechSynthesisResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func synthesize(_ request: PraxisSpeechSynthesisRequest) async throws -> PraxisSpeechSynthesisResponse {
    responseFactory(request)
  }
}

/// Stub multimodal driver for image generation.
public struct PraxisStubImageGenerationDriver: PraxisImageGenerationDriver, Sendable {
  public let responseFactory: @Sendable (PraxisImageGenerationRequest) -> PraxisImageGenerationResponse

  public init(
    responseFactory: @escaping @Sendable (PraxisImageGenerationRequest) -> PraxisImageGenerationResponse
  ) {
    self.responseFactory = responseFactory
  }

  public func generate(_ request: PraxisImageGenerationRequest) async throws -> PraxisImageGenerationResponse {
    responseFactory(request)
  }
}
