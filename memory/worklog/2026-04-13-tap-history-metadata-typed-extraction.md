# 2026-04-13 TAP history metadata typed extraction

## 背景

- 目标限定在 `PraxisRuntimeUseCases` 内部的 `tapHistoryEntries(from records:)` 读回路径。
- `PraxisTapRuntimeEventRecord.metadata` 的 public contract 保持为 `[String: PraxisValue]`，不改存储/持久化面。

## 本次改动

- 在 `Sources/PraxisRuntimeUseCases/PraxisUseCaseImplementations.swift` 内新增私有 typed extraction 层 `PraxisTapHistoryExtractedMetadata`。
- 将 `requestedTier`、`route`、`outcome`、`humanGateState`、`targetAgentID`、`decisionSummary`，以及同一路径上的 `capabilityKey` 提取逻辑统一收口到该内部层。
- 保留现有兼容语义：
  - 继续接受已有有效 raw metadata。
  - `route == "tapBridge"` 与 `outcome == eventKind.rawValue` 的 legacy fallback 保持不变。
  - 缺字段与坏 raw value 仍然抛稳定的 `PraxisError.invalidInput`。

## 验证

- 新增用例覆盖：
  - `targetAgentID` 从 metadata 提取。
  - `decisionSummary` 在 metadata 缺失时继续回退到 `detail`。
- 已执行：
  - `swift test --filter tapHistoryReadback`
  - `swift test --filter 'cmpPeerApprovalDecisionUseCasesPreserveExplicitHumanOutcomesAcrossStatusAndHistory|tapReadbackUseCasesSurfaceTypedPeerApprovalAndStatusWhileHistoryStaysDisplayOriented'`
  - `swift test`
- 当前全量结果：`324 tests / 53 suites` 全绿。

## 约束确认

- 没有调整 peer approval descriptor surface。
- 没有调整 tap status surface。
- 没有引入 CLI/UI/platform/provider 语义或 target 依赖变更。
