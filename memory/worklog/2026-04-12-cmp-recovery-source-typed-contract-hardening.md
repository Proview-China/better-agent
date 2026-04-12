# 2026-04-12 CMP Recovery Source Typed Contract Hardening

## 本次落地内容

- 这次严格只收 `CMP project recovery` 的 `recoverySource` 一条链路，没有顺手扩大到 summary、ID、branchRef、packageID 或别的 stringly 字段。
- 新增共享 typed enum：
  - `PraxisCmpRecoverySource`
- `recoverySource` 现在已经贯通为宿主无关 typed contract：
  - `PraxisCmpProjectRecovery`
  - `PraxisCmpProjectRecoverySnapshot`
- `PraxisRecoverCmpProjectUseCase` 内部恢复来源判断与 summary 选择，已经从裸字符串分支切到 typed enum。

一句白话：

- CMP recovery 现在明确区分“历史上下文包 / 历史快照 / 投影物化”三种来源，不再靠字符串碰运气。

## 语义收紧

- typed 真相放在 `PraxisCmpTypes`，保持 host-neutral，没有把语义塞回 CLI / UI / provider / platform 层。
- `PraxisCmpRecoverySource` 继续使用稳定 raw value codec：
  - `historical_context`
  - `historical_snapshot`
  - `projection_materialization`
- `RuntimeInterface` 不需要改 shape；通过 `Codable` 自动编码时，`recoverySource` 仍稳定对外编码为原始字符串值。

## 测试

- 本次补充和更新的验证覆盖：
  - use case `PraxisCmpProjectRecovery` roundtrip 会稳定编码 `recoverySource` raw value
  - use case 会拒绝未知 `recoverySource` raw value
  - host runtime surface 的 recover 正向断言改成 typed enum
  - `PraxisCmpProjectRecoverySnapshot` codec roundtrip 现在同时覆盖 `status` / `recoverySource` / `packageKind`
  - `PraxisCmpProjectRecoverySnapshot` 会拒绝未知 `recoverySource` raw value

## 残余限制

- 这次只收口了中间层 typed contract；底层历史数据、interface payload 和外部调用方仍然看到稳定 raw string codec，这是刻意保留的兼容边界。
- 其它 recovery 相关字段仍保持现状；如果后续要继续 typed 化，需要单独起包，不应把这次改动继续放大。
