public enum PraxisMultimodalChipKind: String, Sendable, Codable {
  case audioTranscribe
  case speechSynthesize
  case imageGenerate
}

public struct PraxisMultimodalChip: Sendable, Equatable, Codable, Identifiable {
  public let kind: PraxisMultimodalChipKind
  public let label: String
  public let summary: String

  public var id: String {
    kind.rawValue
  }

  public init(kind: PraxisMultimodalChipKind, label: String, summary: String) {
    self.kind = kind
    self.label = label
    self.summary = summary
  }
}

public struct PraxisAudioTranscriptionRequest: Sendable, Equatable, Codable {
  public let sourceRef: String
  public let locale: String?
  public let hint: String?

  public init(sourceRef: String, locale: String? = nil, hint: String? = nil) {
    self.sourceRef = sourceRef
    self.locale = locale
    self.hint = hint
  }
}

public struct PraxisAudioTranscriptionResponse: Sendable, Equatable, Codable {
  public let transcript: String
  public let durationSeconds: Double?

  public init(transcript: String, durationSeconds: Double? = nil) {
    self.transcript = transcript
    self.durationSeconds = durationSeconds
  }
}

public struct PraxisSpeechSynthesisRequest: Sendable, Equatable, Codable {
  public let text: String
  public let voice: String
  public let locale: String?

  public init(text: String, voice: String, locale: String? = nil) {
    self.text = text
    self.voice = voice
    self.locale = locale
  }
}

public struct PraxisSpeechSynthesisResponse: Sendable, Equatable, Codable {
  public let audioAssetRef: String
  public let format: String

  public init(audioAssetRef: String, format: String) {
    self.audioAssetRef = audioAssetRef
    self.format = format
  }
}

public struct PraxisImageGenerationRequest: Sendable, Equatable, Codable {
  public let prompt: String
  public let style: String?
  public let size: String?

  public init(prompt: String, style: String? = nil, size: String? = nil) {
    self.prompt = prompt
    self.style = style
    self.size = size
  }
}

public struct PraxisImageGenerationResponse: Sendable, Equatable, Codable {
  public let assetRef: String
  public let mimeType: String

  public init(assetRef: String, mimeType: String) {
    self.assetRef = assetRef
    self.mimeType = mimeType
  }
}
