# 2026-04-12 CMP Latest Dispatch And Recovery Interface Hardening

## 本次落地内容

- 这次只处理两个已确认问题，没有继续扩 scope：
  - `latestDispatchStatus` 把 `retryScheduled` 压成 `.rejected` 的行为回退
  - recovery typed contract 没有贯通到 `RuntimeInterface` surface
- 为了不把 dispatch receipt / flow status 整条线一起拖大，这次新增了一个只服务 readback/interface surface 的最小 typed enum：
  - `PraxisCmpLatestDispatchStatus`
- `latestDispatchStatus` 现在在以下三层统一使用这个 enum：
  - use case readback
  - facade snapshots
  - runtime interface snapshot
- runtime interface 的 recovery response 现在会真正携带 typed recovery 字段：
  - `recoveryStatus`
  - `packageKind`

一句白话：

- “最新 dispatch 状态” 这条外显 surface 现在能区分“已安排重试”，而 recovery 的 typed 真相也终于能被 interface 调用方看到了。

## 语义修正

- `retryScheduled` 不再被压扁成 `.rejected`。
- `latestDispatchStatus` 的择新逻辑现在优先使用 dispatch 专用时间 `last_dispatch_updated_at`，而不是 package descriptor 的整体 `updatedAt`。
- 只有在旧数据缺少 `last_dispatch_updated_at` 时，才受控 fallback 到 descriptor `updatedAt`。
- 如果 `last_dispatch_updated_at` 存在但为空白，会显式报 `invalidInput`，不再静默吞错。
- `cmpDispatcherLatestStage` 没有被扩成新的 typed surface，但内部比较逻辑已经与 `latestDispatchStatus` 对齐，不再继续用错误的更新时间源。

## Runtime Interface

- `PraxisRuntimeInterfaceSnapshot` 新增：
  - `recoveryStatus`
- recovery response 现在会带出：
  - `packageKind`
  - `recoveryStatus`
- response codec 已补 raw-value roundtrip 断言，保证 recovery typed field 的 JSON 编码稳定。

## 测试

- 本次补充和更新的验证覆盖：
  - use case / facade / runtime interface 三层都覆盖 `retryScheduled` latestDispatchStatus
  - 三层都覆盖“package 后续发生非 dispatch 更新，但 delivery truth 的 retryScheduled 更晚，readback 仍应取 retryScheduled”这个真实回退场景
  - runtime interface recovery snapshot 的 typed field 集成断言
  - runtime interface codec 对 recovery typed field 的 raw-value roundtrip
  - runtime interface codec 对 `latestDispatchStatus = retryScheduled` 的 raw-value roundtrip
- 本地最终验收：
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test --filter HostRuntimeInterfaceTests`
  - `swift test`
- 结果：
  - `242 tests / 52 suites` 通过
- 复审结果：
  - 第一轮发现 dispatch 专用时间比较仍未真正修正
  - 修复后复审 `无 findings`

## 残余限制

- 按约束这次没有继续动 `roles latestStage / roleStages`；如果外部调用方继续把 `dispatcher.latestStage` 当作 `latestDispatchStatus` 的替代品，仍然会看到旧 surface 的限制。
- 对没有 `last_dispatch_updated_at` 的历史 package 记录，仍然只能 fallback 到 descriptor `updatedAt`；这是受控兼容路径，但无法完全恢复旧数据里真实的 dispatch 时间。
- 这次没有做存量数据回填，也没有改动持久化格式迁移。

## 下一包入口

- 仍然留在第 2 包 `CMP neutral surface hardening` 范围内时，应该优先继续处理剩余 stringly-typed CMP readback / project surface，而不是跳去 MP、HostContracts seam 或 interface 依赖方向问题。
