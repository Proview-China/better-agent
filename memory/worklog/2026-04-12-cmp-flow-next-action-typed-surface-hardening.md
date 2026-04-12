# 2026-04-12 CMP Flow NextAction Typed Surface Hardening

## 本次落地内容

- 第 2 包继续留在 `CMP neutral surface hardening` 范围内，这次只收紧 `cmp flow ingest` 的 `nextAction` 一条链路，没有扩到 approval、roles、project、recovery、MP 或其它 flow backlog。
- 新增最小 typed enum：
  - `PraxisCmpFlowIngestNextAction`
  - 当前只覆盖仓库里已经实际存在的两个语义：
    - `commit_context_delta`
    - `noop`
- `nextAction` 现在已经贯通为宿主无关 typed surface：
  - `PraxisIngestRuntimeContextResult.nextAction`
  - `PraxisCmpFlowIngestSnapshot.nextAction`
  - `PraxisRuntimeInterfaceSnapshot.nextAction`
- `ingestCmpFlow(...)` 不再写入裸字符串，而是直接返回 typed enum。

一句白话：

- CMP flow ingest 下一步该做什么，现在不再靠字符串约定，而是有明确的 typed contract 了。

## 语义收紧

- `nextAction` 的真相现在由 `PraxisCmpFlowIngestNextAction` 承担，`summary` 仍只做人类可读文本，没有被抬成业务真相。
- 这次最小量补了 `RuntimeInterface` parity，因为如果停在 use case/facade，外部经 `RuntimeGateway -> RuntimeInterface` 进入系统时只能看到 summary，会再次形成 facade 强类型、interface 弱契约的裂缝。
- interface codec 对未知 `nextAction` raw value 现在会稳定解码失败，不再允许静默 fallback 成默认值。

## 测试

- 本次补充和更新的验证覆盖：
  - use case 正向断言：`ingest.result.nextAction == .commitContextDelta`
  - interface 正向断言：`cmpFlow` snapshot 带出 typed `nextAction`
  - interface codec raw-value JSON roundtrip：`"nextAction":"commit_context_delta"`
  - interface codec 非法值拒绝：未知 `nextAction` 解码抛出 `DecodingError`
- 本地验收：
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test --filter HostRuntimeSurfaceTests`
  - `swift test --filter HostRuntimeInterfaceTests`
- 结果：
  - 全部通过
- 复审结果：
  - `无 findings`

## 残余限制

- 当前显式钉住的正向样本主要是 `.commitContextDelta`；`.noop` 作为第二个合法值还没有单独在 interface 响应链路上补一个专门样本。
- 这不是当前缺陷，因为 enum 本身和 codec roundtrip 已经收口；但如果继续补覆盖，最自然的下一条就是为 `.noop` 增加一条 interface 级正向样本，而不是扩大到别的 CMP backlog。

## 下一包入口

- 第 2 包下一小段仍应留在 `CMP neutral surface hardening` 内，优先处理剩余仍明显 stringly-typed 的 CMP surface。
- 这条 `nextAction` 已经收口完成，后续不应再为了它反向扩大到 approval、project、recovery 或 MP。
