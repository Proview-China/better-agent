import Testing
@testable import PraxisUserIOContracts

struct PraxisUserIOContractsTests {
  @Test
  func promptPermissionAndPresentationContractsRemainStructured() async throws {
    let userInput = PraxisStubUserInputDriver { request in
      PraxisPromptResponse(
        content: request.defaultValue ?? "yes",
        selectedChoiceID: request.choices.first?.id,
        acceptedDefault: request.defaultValue != nil
      )
    }
    let promptResponse = try await userInput.prompt(
      .init(
        summary: "Choose execution mode",
        detail: "Pick one mode for runtime smoke",
        kind: .choice,
        defaultValue: "review",
        choices: [
          .init(id: "review", label: "Review", description: "Recommended"),
          .init(id: "run", label: "Run"),
        ]
      )
    )

    #expect(promptResponse.selectedChoiceID == "review")
    #expect(promptResponse.acceptedDefault == true)

    let permissionDriver = PraxisStubPermissionDriver { request in
      PraxisPermissionDecision(
        granted: request.scope == "git.push",
        reason: request.scope == "git.push" ? "User approved push" : "Not approved"
      )
    }
    let decision = try await permissionDriver.request(
      .init(scope: "git.push", summary: "Push current branch", urgency: .high)
    )

    #expect(decision.granted == true)
    #expect(decision.reason == "User approved push")

    let terminalPresenter = PraxisSpyTerminalPresenter()
    await terminalPresenter.present(
      .init(
        title: "Running tests",
        detail: "swift test",
        kind: .progress,
        command: "swift test"
      )
    )
    #expect((await terminalPresenter.allEvents()).first?.kind == .progress)

    let conversationPresenter = PraxisSpyConversationPresenter()
    await conversationPresenter.present(
      .init(
        summary: "Wave5 complete",
        detail: "All HostContracts landed",
        kind: .result,
        chips: [
          .init(kind: .audioTranscribe, label: "Audio", summary: "Transcribe uploaded audio"),
        ]
      )
    )
    #expect((await conversationPresenter.allPresentations()).first?.chips.first?.kind == .audioTranscribe)
  }

  @Test
  func multimodalDriversExposeExtendedRequestAndResponseShapes() async throws {
    let audioDriver = PraxisStubAudioTranscriptionDriver { request in
      PraxisAudioTranscriptionResponse(
        transcript: "Meeting notes",
        durationSeconds: request.diarizationEnabled ? 32 : 30,
        language: request.locale
      )
    }
    let transcription = try await audioDriver.transcribe(
      .init(
        sourceRef: "file://meeting.m4a",
        locale: "zh-CN",
        hint: "project sync",
        diarizationEnabled: true
      )
    )
    #expect(transcription.durationSeconds == 32)
    #expect(transcription.language == "zh-CN")

    let speechDriver = PraxisStubSpeechSynthesisDriver { request in
      PraxisSpeechSynthesisResponse(
        audioAssetRef: "file://speech.wav",
        format: request.format ?? "wav",
        durationSeconds: 4.2
      )
    }
    let speech = try await speechDriver.synthesize(
      .init(text: "Runtime ready", voice: "alloy", locale: "en-US", format: "wav")
    )
    #expect(speech.format == "wav")
    #expect(speech.durationSeconds == 4.2)

    let imageDriver = PraxisStubImageGenerationDriver { request in
      PraxisImageGenerationResponse(
        assetRef: "file://diagram.png",
        mimeType: request.transparentBackground ? "image/png" : "image/jpeg",
        revisedPrompt: "\(request.prompt) polished"
      )
    }
    let image = try await imageDriver.generate(
      .init(
        prompt: "diagram of runtime architecture",
        style: "technical",
        size: "1024x1024",
        transparentBackground: true
      )
    )
    #expect(image.mimeType == "image/png")
    #expect(image.revisedPrompt == "diagram of runtime architecture polished")
  }
}
