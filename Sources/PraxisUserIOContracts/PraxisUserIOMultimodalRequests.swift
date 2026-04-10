public enum PraxisMultimodalChipKind: String, Sendable, Codable {
  case audioTranscribe
  case speechSynthesize
  case imageGenerate
}

public struct PraxisMultimodalChip: Sendable, Equatable, Codable, Identifiable {
  public let kind: PraxisMultimodalChipKind
  public let label: String
  public let summary: String
  public let enabled: Bool

  public var id: String {
    kind.rawValue
  }

  public init(kind: PraxisMultimodalChipKind, label: String, summary: String, enabled: Bool = true) {
    self.kind = kind
    self.label = label
    self.summary = summary
    self.enabled = enabled
  }
}

public struct PraxisAudioTranscriptionRequest: Sendable, Equatable, Codable {
  public let sourceRef: String
  public let locale: String?
  public let hint: String?
  public let diarizationEnabled: Bool

  public init(
    sourceRef: String,
    locale: String? = nil,
    hint: String? = nil,
    diarizationEnabled: Bool = false
  ) {
    self.sourceRef = sourceRef
    self.locale = locale
    self.hint = hint
    self.diarizationEnabled = diarizationEnabled
  }
}

public struct PraxisAudioTranscriptionResponse: Sendable, Equatable, Codable {
  public let transcript: String
  public let durationSeconds: Double?
  public let language: String?

  public init(transcript: String, durationSeconds: Double? = nil, language: String? = nil) {
    self.transcript = transcript
    self.durationSeconds = durationSeconds
    self.language = language
  }
}

public struct PraxisSpeechSynthesisRequest: Sendable, Equatable, Codable {
  public let text: String
  public let voice: String
  public let locale: String?
  public let format: String?

  public init(text: String, voice: String, locale: String? = nil, format: String? = nil) {
    self.text = text
    self.voice = voice
    self.locale = locale
    self.format = format
  }
}

public struct PraxisSpeechSynthesisResponse: Sendable, Equatable, Codable {
  public let audioAssetRef: String
  public let format: String
  public let durationSeconds: Double?

  public init(audioAssetRef: String, format: String, durationSeconds: Double? = nil) {
    self.audioAssetRef = audioAssetRef
    self.format = format
    self.durationSeconds = durationSeconds
  }
}

public struct PraxisImageGenerationRequest: Sendable, Equatable, Codable {
  public let prompt: String
  public let style: String?
  public let size: String?
  public let transparentBackground: Bool

  public init(
    prompt: String,
    style: String? = nil,
    size: String? = nil,
    transparentBackground: Bool = false
  ) {
    self.prompt = prompt
    self.style = style
    self.size = size
    self.transparentBackground = transparentBackground
  }
}

public struct PraxisImageGenerationResponse: Sendable, Equatable, Codable {
  public let assetRef: String
  public let mimeType: String
  public let revisedPrompt: String?

  public init(assetRef: String, mimeType: String, revisedPrompt: String? = nil) {
    self.assetRef = assetRef
    self.mimeType = mimeType
    self.revisedPrompt = revisedPrompt
  }
}
