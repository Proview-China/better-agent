# 2026-04-12 TAP CMP Approval Invalid Raw Value Coverage Hardening

## 本次落地内容

- 这次不是新 surface，也不是模型改造，而是给已经 typed 化的 `peer-approval / tap` 链路补“非法 raw 值必须稳定失败”的覆盖。
- 范围刻意收在两层：
  - `PraxisRuntimeUseCasesTests`
  - `HostRuntimeInterfaceTests`
- 没有改 `RuntimeInterface`、`Facade`、`UseCases` 实现，也没有新增 snapshot 字段。

一句白话：

- 这包做的事，就是把“坏数据不能悄悄混过去”这件事补成显式测试。

## 覆盖补强

- `PraxisRuntimeUseCasesTests`
  - `cmpPeerApprovalReadback` 现在对以下字段逐项补了 persisted 损坏失败覆盖：
    - `requestedTier`
    - `tapMode`
    - `riskLevel`
    - `route`
    - `outcome`
    - `humanGateState`
  - `tapStatusReadback` 补了 `humanGateState` 损坏失败覆盖。
  - `tapHistoryReadback` 补了以下字段的对称失败覆盖：
    - `requestedTier`
    - `route`
    - `outcome`
    - `humanGateState`
- `HostRuntimeInterfaceTests`
  - 补了 `requestCmpPeerApproval` 请求 codec 对非法 `requestedTier` raw 值的 `invalidInput` 断言。
  - 补了 `readbackTapStatus / readbackTapHistory / readbackCmpPeerApproval` 在收到 use case `invalidInput` 时，runtime interface 侧 failure response 的稳定映射断言。

## 测试

- 本地验收：
  - `swift test`
- 结果：
  - 全量通过，`278 tests / 52 suites`
- 复审结果：
  - `无 findings`

## 残余限制

- 这次 interface 层补的是“代表性失败映射”覆盖，而不是把 `tapMode / riskLevel / outcome` 也在 runtime interface codec 层逐字段做穷举矩阵。
- 这些字段当前主要由 use case 层的 persisted-corruption 测试兜住；如果后续要把 runtime interface 做成更严格的 enum failure matrix，可以另起一个纯测试包继续补。

## 下一包入口

- CMP 主线 typed surface 现在已经比较完整，下一步更适合继续找：
  - 仍残留的 host-neutral runtime smoke / generic runtime string leak
  - 或者进入下一大包的 seam hardening / localDefaults 真实性审视
