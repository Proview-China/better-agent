# 2026-04-11 Runtime Interface CMP Request Validation

## 背景

- 前一轮已经补了 `PraxisRuntimeInterface` 的 CMP snapshot / event / specialized error contract tests。
- 但 interface 层对 CMP request 的必填字段校验还不完整，部分命令仍然把空 `agentID / sessionID / targetAgentID / requesterAgentID / capabilityKey` 直接下传给 deeper layer。

## 本轮实现

- 在 `Sources/PraxisRuntimeInterface/PraxisRuntimeInterfaceServices.swift` 新增统一的 `requireRuntimeInterfaceField`
- 将下列 CMP request 的必填字段检查前移到 RuntimeInterface：
  - `requestCmpPeerApproval`
    - `projectID`
    - `agentID`
    - `targetAgentID`
    - `capabilityKey`
  - `decideCmpPeerApproval`
    - `projectID`
    - `agentID`
    - `targetAgentID`
    - `capabilityKey`
  - `ingestCmpFlow`
    - `projectID`
    - `agentID`
    - `sessionID`
  - `commitCmpFlow`
    - `projectID`
    - `agentID`
    - `sessionID`
  - `resolveCmpFlow`
    - `projectID`
    - `agentID`
  - `materializeCmpFlow`
    - `projectID`
    - `agentID`
    - `targetAgentID`
  - `dispatchCmpFlow`
    - `projectID`
    - `agentID`
  - `retryCmpDispatch`
    - `projectID`
    - `agentID`
    - `packageID`
  - `requestCmpHistory`
    - `projectID`
    - `requesterAgentID`

- 同时收紧了 `failureResponse`：
  - 空字符串 `runID / sessionID` 不再被包装成伪上下文 ID
  - 只有非空值才进入 error envelope

## 测试

- 扩展 `Tests/PraxisHostRuntimeArchitectureTests/HostRuntimeInterfaceTests.swift`
- 新增表格化测试：
  - `runtimeInterfaceReturnsStructuredCmpApprovalMissingFieldErrors`
  - `runtimeInterfaceReturnsStructuredCmpFlowMissingFieldErrors`

这些测试确认：

- interface 层直接返回 `missing_required_field`
- deeper layer 不再承担这些空字段的第一道报错职责
- error envelope 的 `sessionID` 只在 request 本身带有有效 session 语境时保留

## 边界结论

- `PraxisRuntimeInterface` 现在对 CMP request 的 contract 更像真正的宿主无关 API 边界，而不是“薄转发层”。
- 必填字段校验应优先停留在 interface 层；deeper layer 继续负责业务语义校验，而不是空字段防守。

## 验证

- `swift test --filter HostRuntimeInterfaceTests` 通过
- `swift test` 全量通过
- 当前快照：
  - `182` tests
  - `47` suites

## 下一步建议

- 对 `eventIDs`、`materials`、`reason`、`decisionSummary` 这类非 ID 但仍影响 contract 的字段继续补 interface-level validation strategy。
- 开始把同样的 request validation / envelope contract 方法迁移到 MP surface。
