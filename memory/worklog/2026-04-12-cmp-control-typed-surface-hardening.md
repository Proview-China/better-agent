# 2026-04-12 CMP Control Typed Surface Hardening

## 本次落地内容

- 第 2 包先收紧了 `CMP neutral surface hardening` 的第一段，只覆盖 control surface。
- `PraxisCmpControlSurface` / `PraxisUpdateCmpControlCommand` / façade control snapshots / runtime interface update payload 现在都使用强类型 control enums，不再把下面五个策略字段暴露成裸字符串：
  - `executionStyle`
  - `mode`
  - `readbackPriority`
  - `fallbackPolicy`
  - `recoveryPreference`
- runtime interface codec 现在会把非法 control enum 输入稳定映射成 `invalid_input`，而不是让底层解码错误直接漏出。

一句白话：

- control 策略现在是“宿主无关的 typed contract”，不是“碰运气的字符串约定”。

## 语义收紧

- local baseline 仍然保留，但只在“没有 persisted control record”时生效。
- 如果 control store 里已经有记录，但其中某个 raw string 已损坏或是未知值，HostRuntime 现在会显式报 `invalidInput`，而不是偷偷回退到 baseline：
  - 不再把坏 `mode` 吞成 `.activePreferred`
  - 不再把坏 `fallbackPolicy` 吞成 `.gitRebuild`
  - 不再把坏 `recoveryPreference` 吞成 `.reconcile`
- 这次仍然允许 infra contract 保持 `String` raw value；收紧的是 host-neutral 中间层表面和解码/恢复语义，不是假装 infra 已经强类型化。

## 测试

- 已补的验证覆盖：
  - control update/readback/status 正向通路改为 typed assertions
  - runtime interface request encode/decode roundtrip 覆盖 `fallbackPolicy` / `recoveryPreference`
  - runtime interface codec 对五个 control enum 字段的非法 raw value 都会返回 `invalid_input`
  - FFI encoded request 入口会把非法 control enum 稳定包成结构化 `invalid_input` failure response
  - persisted corrupted descriptor 不会被归一化成 baseline，而是显式失败，当前覆盖 `executionStyle` / `mode` / `fallbackPolicy`
- 本地最终验收：
  - `swift test`
  - 结果：`228 tests / 52 suites` 通过
- 复审结果：
  - 无 findings

## 残余限制

- `PraxisCmpStatusPanelSnapshot` 仍然只暴露 status 需要的 control 子集，没有把 `fallbackPolicy` / `recoveryPreference` 再展开成新的状态面板字段；这次没有扩 DTO 形状。
- FFI bridge 的结构化失败断言目前只用 `executionStyle` 非法值举例；`mode` 在 codec 层已补到，但在 encoded request 全链路上没有再重复一遍。
- persisted control 损坏现在统一视为结构化失败；如果未来要支持“带损坏标记的只读展示”而不是失败，需要单独设计新的 neutral snapshot，而不是回退成 baseline。

## 下一包入口

- 第 2 包下一段继续做 CMP neutral surface hardening，但应转向剩余分面，而不是回头继续放大 control。
- 优先顺序保持：
  - `session`
  - `project`
  - `flow`
  - `roles`
  - `readback`
- 如果继续碰到 raw string / 泛化 bucket / façade 膨胀问题，优先拆成更小的 host-neutral typed surface，再补行为测试。
