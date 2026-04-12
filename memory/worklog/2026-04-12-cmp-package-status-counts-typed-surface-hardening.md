# 2026-04-12 CMP PackageStatusCounts Typed Surface Hardening

## 本次落地内容

- 第 2 包继续留在 `CMP neutral surface hardening` 范围内，这次只收紧 `cmp objectModel / cmpStatus` 外显链路里的 `packageStatusCounts`，没有扩到 roles、approval、project host profile、recovery、MP 或其他 object-model backlog。
- 新增最小 typed map：
  - `PraxisCmpPackageStatusCountMap`
- 复用现有 typed enum：
  - `PraxisCmpPackageStatus`
- `packageStatusCounts` 现在已经贯通为宿主无关 typed surface：
  - `PraxisCmpObjectModelReadback.packageStatusCounts`
  - `PraxisCmpStatusPanelSnapshot.packageStatusCounts`
  - `PraxisRuntimeInterfaceSnapshot.packageStatusCounts`

一句白话：

- CMP status 里“各包状态分布”现在不再靠字符串 key 约定，而是有明确的 typed contract 了。

## 语义收紧

- `packageStatusCounts` 的真相现在由 `PraxisCmpPackageStatusCountMap` 承担，`summary` 仍只做人类可读文本，没有被抬成业务真相。
- use case 侧不再把 `status.rawValue` 暴露给高层，而是直接用 `PraxisCmpPackageStatus` 聚合并编码成 typed map。
- interface codec 对未知 package status key 现在会稳定解码失败，不再允许静默 fallback 或丢弃非法值。

## 测试

- 本次补充和更新的验证覆盖：
  - use case 正向断言：`status.objectModel.packageStatusCounts[.dispatched] == 1`
  - use case JSON roundtrip：`"packageStatusCounts":{"dispatched":2,"materialized":1}`
  - use case 非法 key 拒绝：未知 package status key 解码抛出 `DecodingError`
  - façade 正向断言：`statusReadback.packageStatusCounts[.dispatched] == 1`
  - façade / surface / interface roundtrip：`cmpStatus` 快照带出 typed `packageStatusCounts`
  - façade / surface / interface 非法 key 拒绝：未知 package status key 解码抛出 `DecodingError`
- 本地验收：
  - `swift test`
- 结果：
  - 全量通过，`275 tests / 52 suites`
- 复审结果：
  - `无 findings`

## 残余限制

- 这次只把 `packageStatusCounts` 收紧到了 `cmpStatus` 外显链路；如果后续别的 object-model surface 也要直接暴露 package status 分布，需要单独确认是否复用同一 typed map。
- 本包没有顺手扩其他 object-model 字段，刻意保持单一意图。

## 下一包入口

- 第 2 包下一小段仍应留在 `CMP neutral surface hardening` 内，优先继续找仍然直接暴露状态语义但尚未 typed 化的 CMP surface。
- `packageStatusCounts` 这条链路已经收口完成，后续不应再围绕它扩大到无关的 TAP/CMP approval 或其它 interface 细节扩张。
