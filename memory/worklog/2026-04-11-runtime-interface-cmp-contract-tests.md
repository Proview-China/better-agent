# 2026-04-11 Runtime Interface CMP Contract Tests

## 背景

- `PraxisRuntimeUseCasesTests` 已经补到 use case 层，但 `PraxisRuntimeInterface` 仍需要单独钉住：
  - facade snapshot 到 interface snapshot 的投影；
  - event `detail / intentID` 的稳定规则；
  - CMP specialized error code 在 interface envelope 中的呈现边界。

## 本轮实现

- 扩展 `Tests/PraxisHostRuntimeArchitectureTests/HostRuntimeInterfaceTests.swift`
- 新增一组轻量 stub helper，用于隔离验证 RuntimeInterface 自身 contract，而不是再次依赖全量 local runtime

新增覆盖：

1. `resolveCmpFlow` not-found success contract
   - 即使没有找到 checked snapshot，RuntimeInterface 仍返回 `success`
   - snapshot 仍然是 `cmpFlow`
   - event 仍然发出 `cmp.flow.resolved`
   - `intentID` 必须保持 `nil`

2. CMP approval event detail contract
   - `requestCmpPeerApproval` / `decideCmpPeerApproval`
     - snapshot summary 使用 approval snapshot summary
     - event detail 使用 `decisionSummary`
   - `readbackCmpPeerApproval`
     - event detail 继续使用 readback summary

3. CMP specialized error envelope boundary
   - `cmp_peer_approval_not_found`
   - `cmp_peer_approval_already_resolved`
   - `cmp_package_not_found`
   - `cmp_dispatch_not_retryable`
   - 上述 CMP request 在无 run/session 语境时，不应伪造 `runID / sessionID`

## 边界结论

- `PraxisRuntimeInterface` 对 CMP 的 contract 不只是“能转发成功/失败”，还包括：
  - not-found 是否仍然是 success；
  - event detail 是取 snapshot summary 还是 decision summary；
  - `intentID` 在 not-found 时是否留空；
  - specialized error code 是否保留且不伪造运行态上下文。

- 这层测试适合继续留在 `HostRuntimeInterfaceTests`，因为它验证的是 interface envelope contract，而不是 use case 业务规则。

## 验证

- `swift test --filter HostRuntimeInterfaceTests` 通过
- `swift test` 全量通过
- 当前快照：
  - `180` tests
  - `47` suites

## 下一步建议

- 继续把 CMP interface payload 校验补成表格化 contract tests，特别是 `agentID / sessionID / targetAgentID` 这类目前仍主要靠 deeper layer 自校验的字段。
- 开始为 MP interface surface 建立同级 contract tests，优先 `memory / search / readback`。
