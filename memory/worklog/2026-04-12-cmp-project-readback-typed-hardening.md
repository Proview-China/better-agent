# 2026-04-12 CMP Project Readback Typed Hardening

## 本次落地内容

- 第 2 包继续留在 `CMP neutral surface hardening` 范围内，这次只收紧 `project/readback` 邻接面的两类真相字段：
  - `PraxisCmpProjectHostProfile`
  - `PraxisCmpProjectReadback.componentStatuses`
- `PraxisCmpProjectHostProfile` 不再暴露为裸字符串集合，而是改成最小 typed host-neutral enums：
  - `PraxisCmpProjectExecutionStyle`
  - `PraxisCmpProjectStructuredStoreProfile`
  - `PraxisCmpProjectDeliveryStoreProfile`
  - `PraxisCmpProjectMessageTransportProfile`
  - `PraxisCmpProjectGitAccessProfile`
  - `PraxisCmpProjectSemanticIndexProfile`
- `PraxisCmpProjectReadback.componentStatuses` 不再使用 `[String: String]`，改成：
  - `PraxisCmpProjectComponent`
  - `PraxisCmpProjectComponentStatus`
  - `PraxisCmpProjectComponentStatusMap`
- façade 仍然只做映射：use case 的 typed host profile / component status 会映到 `PraxisLocalRuntimeHostProfile` / `PraxisTruthLayerStatus`，但不是由 façade 决定 use case 真相。
- `PraxisLocalRuntimeHostProfile` 也同步改成复用同一组 shared typed enums，避免 project readback 在 façade 终点又降回自由字符串。

一句白话：

- `cmpProject` 的主机能力画像和组件状态，现在终于不再靠字符串猜语义了。

## 语义收紧

- 这轮只改有限集合字段，没有碰自由文本：
  - `summary`
  - `hostSummary`
  - `persistenceSummary`
  - `coordinationSummary`
- 未知 raw value 不再静默降级：
  - 非法 host profile raw value 会在 `Codable` 解码时失败
  - 非法 component key / status 会在 `Codable` 解码时失败
  - use case 内部从现有字符串状态收口到 typed component status 时，若遇到未知值也会显式抛 `invalidInput`
- 这轮刻意没有扩 `RuntimeInterface` 的 `cmpProject` surface，因为它当前并不结构化暴露 `hostProfile/componentStatuses`；继续强行扩接口会偏离本包目标。
- 本轮曾经误混入 `roleCounts` typed hardening 和 `RuntimeInterface` 扩字段，已在 review 后完全剥离，没有并入最终提交。

## 测试

- 新增或更新的验证覆盖：
  - use case 层对 typed `hostProfile/componentStatuses` 的正向断言
  - `PraxisCmpProjectReadback` 的 raw-value JSON roundtrip
  - 非法 host profile raw value / component key / component status 的稳定解码失败
  - façade 映射后的 project readback 结果对齐断言
- 本地最终验收：
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test --filter HostRuntimeSurfaceTests`
  - `swift test --filter HostRuntimeInterfaceTests`
  - `swift test`
- 结果：
  - `247 tests / 52 suites` 通过
- 复审结果：
  - 无 findings

## 残余限制

- `componentStatuses` 在 façade 层仍会映到 `[String: PraxisTruthLayerStatus]`，其中 `.missing -> .failed` 是既有展示压平，不是 use case 真相本身；如果以后要继续收紧 façade/smoke surface，需要单独拆包。
- `PraxisCmpProjectHostProfile` 当前只覆盖仓库里已出现的 local profile 语义；后续如果 profile 语义扩展，需要显式扩 enum 和测试，不能回退成自由字符串。
- 因为这轮按边界没有扩 `RuntimeInterface`，typed `hostProfile/componentStatuses` 目前停留在 shared types / use case / façade 层；这是刻意保留的限制，不是漏做。

## 下一包入口

- 第 2 包下一小段仍应留在 `CMP neutral surface hardening` 范围内，继续收口 `project/readback` 邻接面剩余的 stringly contract，而不是跳去 MP、localDefaults 或 HostContracts seam。
- 当前更合适的下一刀是：
  - `componentStatuses` 邻接的其它 project/readback 字段是否还存在自由字符串真相
  - host profile 之外、但仍属于 CMP project/readback 外显 contract 的有限集合字段
