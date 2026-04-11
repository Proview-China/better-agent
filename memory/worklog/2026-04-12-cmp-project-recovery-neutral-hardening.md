# 2026-04-12 CMP Project Recovery Neutral Hardening

## 本次落地内容

- 第 2 包继续留在 `CMP neutral surface hardening` 范围内，这次只收紧 `project recovery` 这一条链路，没有扩到 roles、readback、interface 依赖方向、MP 或其它 surface。
- recovery 外显 contract 里原本仍是裸字符串的核心字段已经收紧：
  - `PraxisCmpProjectRecovery.status -> PraxisCmpRecoveryStatus`
  - `PraxisCmpProjectRecoverySnapshot.status -> PraxisCmpRecoveryStatus`
  - `PraxisCmpProjectRecoverySnapshot.packageKind -> PraxisCmpContextPackageKind`
- `use case result -> facade snapshot` 这条链路已经贯通，`packageKind` 不再在 facade 层降成 raw string。
- 新增最小 typed enum `PraxisCmpRecoveryStatus`，当前只承接现有实现事实里的两种成功态结果：
  - `aligned`
  - `degraded`

一句白话：

- recovery 这条宿主无关链路，现在关键状态也不再靠字符串凑合传递了。

## 语义收紧

- recovery 的 summary 仍然只做人类可读文本：
  - `summary`
  - `projectionRecoverySummary`
  - `hydratedRecoverySummary`
- 这些文案没有被抬成业务真相；状态真相现在由 typed enum 承担。
- `recoverySource` 这次刻意没动，避免在同一小包里继续扩大 surface。
- 当前 recovery interface response 仍然只返回通用 snapshot/event，不直接暴露 recovery detail 字段，所以这次没有去扩 `PraxisRuntimeInterface`。

## 测试

- 本次补充和更新的验证覆盖：
  - recovery `status` / `packageKind` typed assertions
  - `PraxisCmpProjectRecoverySnapshot` 的 `Codable` raw-value roundtrip
  - 非法 `status` / `packageKind` 解码稳定失败
- 本地最终验收：
  - `swift test --filter HostRuntimeSurfaceTests`
  - `swift test`
- 结果：
  - `238 tests / 52 suites` 通过
- 复审结果：
  - `无 findings`

## 残余限制

- `PraxisCmpRecoveryStatus` 当前只覆盖现实现有两种 recovery 结果；如果以后 recovery 语义扩展，需要显式扩 enum 和测试，而不是重新退回字符串。
- recovery surface 里的 `recoverySource` 仍是字符串，这次没有继续 typed 化。
- 这轮没有把 recovery detail 投到 `PraxisRuntimeInterfaceSnapshot`；如果未来要对 interface 暴露 recovery 详情，必须直接沿用 typed surface，不能再把 `status` / `packageKind` 降回字符串。
- 当前测试已覆盖 `aligned` 和 codec/reject-unknown，但还没有单独打穿一个真实 `.degraded` 集成路径来钉住该分支。

## 下一包入口

- 第 2 包下一小段仍应留在 CMP neutral surface hardening 内，优先收口剩余的 stringly-typed project/readback 邻接面，而不是跳去 MP、localDefaults 或 HostContracts seam。
- 更可能继续收口的方向：
  - `recoverySource` 是否需要 typed 化
  - recovery / project surface 里仍直接暴露字符串状态的字段
  - interface 层若未来暴露 recovery detail，需要同步 pin 住 typed contract
