# 2026-04-10 Wave5 UserIO And Closure

## 做了什么

- 完成 `Wave 5 / HostContracts` 的最后一块：`PraxisUserIOContracts`。
- 现在五个 HostContracts target 都已经从“协议骨架”进入“有 structured contract + doubles + tests”的状态：
  - `PraxisInfraContracts`
  - `PraxisToolingContracts`
  - `PraxisWorkspaceContracts`
  - `PraxisProviderContracts`
  - `PraxisUserIOContracts`

## UserIOContracts 这次补了什么

- 结构化 prompt contract：
  - prompt kind
  - choice
  - prompt request / response
- 结构化 permission contract：
  - urgency
  - permission request / decision
- 结构化 presentation contract：
  - terminal event kind / command / metadata
  - conversation presentation kind / chips / metadata
- 结构化 multimodal contract：
  - richer audio transcription request / response
  - richer speech synthesis request / response
  - richer image generation request / response

## 新增 test doubles

- `PraxisStubUserInputDriver`
- `PraxisStubPermissionDriver`
- `PraxisSpyTerminalPresenter`
- `PraxisSpyConversationPresenter`
- `PraxisStubAudioTranscriptionDriver`
- `PraxisStubSpeechSynthesisDriver`
- `PraxisStubImageGenerationDriver`

## 当前结论

- Wave5 已整体完成。
- HostRuntime 下一步应该优先消费这些 contract doubles，把 `PraxisRuntimeComposition` / `PraxisRuntimeUseCases` 从 inspection-only 进一步推进，而不是跳过 doubles 直接接 live adapter。

## 验证

- 新增 `PraxisUserIOContractsTests`
- `swift test` 通过，当前共 `87` 个测试
