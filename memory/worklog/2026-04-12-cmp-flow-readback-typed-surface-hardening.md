# 2026-04-12 CMP Flow Readback Typed Surface Hardening

## 本次落地内容

- 第 2 包继续推进 `CMP neutral surface hardening`，这次只做 `flow/readback` 的最小可交付，没有扩到 project recovery、peer approval、角色阶段建模或 `packageStatusCounts` typed 化。
- 复用已有领域枚举，把下列外显 contract 从裸字符串收紧成 host-neutral typed surface，并贯通到 `use case -> facade snapshot -> runtime interface response`：
  - `activeLineStage -> PraxisCmpActiveLineStage`
  - `qualityLabel -> PraxisCmpCheckedSnapshotQualityLabel`
  - `packageKind -> PraxisCmpContextPackageKind`
  - `targetKind -> PraxisCmpDispatchTargetKind`
  - flow `status -> PraxisCmpDispatchStatus`
  - readback `latestDispatchStatus -> PraxisCmpDispatchStatus`
- runtime interface snapshot 现在会显式携带 typed CMP flow/readback 字段，并继续通过稳定 raw value JSON 编解码往返，不再只靠 summary 文案传达状态真相。

一句白话：

- flow/readback 里最容易漂成“字符串口头约定”的状态字段，这次已经收紧成真正可验证的中间层类型契约。

## 语义收紧

- `latestDispatchStatus` 不再直接透传 delivery truth 的底层词表，也不再盲信 package metadata。
- HostRuntime 现在会同时看：
  - package metadata 里的 `last_dispatch_status`
  - 最新 delivery truth record
- 两边都存在时，按 `updatedAt` 选真正较新的 truth，再统一映射成 `PraxisCmpDispatchStatus`。
- 如果 persisted metadata 已损坏：
  - `last_dispatch_status` 非法值会显式报 `invalidInput`
  - `dispatch_target_kind` 非法值会显式报 `invalidInput`
  - retry/readback/status 都不再把坏宿主状态伪装成合法 fallback
- `readbackCmpRoles` / `readbackCmpControl` 的摘要文案已经去掉 `CLI` / `GUI` 宿主词汇，统一改成 host-neutral 表述。
- dispatcher 的 `roleStages` 虽然这次仍是 `String` 容器，但其值域不再直接使用 `PraxisDeliveryTruthStatus.rawValue`，而是改成 CMP-neutral 词表，避免继续漏出 `pending/published/retryScheduled` 这类底层 delivery 术语。

## 测试

- 本次补充和更新的验证覆盖：
  - flow snapshot typed assertions：`activeLineStage` / `qualityLabel` / `packageKind` / `targetKind` / `dispatchStatus`
  - readback/status typed assertions：`latestDispatchStatus`
  - runtime interface response codec 对 typed CMP snapshot 字段保持稳定 raw-value roundtrip
  - corrupted `dispatch_target_kind` 稳定失败
  - corrupted `last_dispatch_status` 在 readback / status / retry 路径稳定失败
  - “旧 package metadata + 更新 delivery truth” 时，readback 选择较新的 truth，而不是卡在旧状态
  - dispatcher role stage 不再回落成 delivery truth 原词表
- 本地最终验收：
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test --filter HostRuntimeInterfaceTests`
  - `swift test`
- 结果：
  - `236 tests / 52 suites` 通过
- 复审结果：
  - 第一轮有 3 个 findings
  - 修复后复审 `无 findings`

## 残余限制

- `roleStages` 这次仍然是 `[String: String]` 容器，只是值域已收紧到 CMP-neutral 词表；没有顺带重做成 typed 容器。
- `latestDispatchStatus` 的“谁更新”判断依赖 `updatedAt` 使用可按时间顺序比较的标准时间戳格式；当前仓库和测试都满足这个前提，但这次没有为非规范时间串补额外防御层。
- project recovery 的 `status` / `packageKind` 仍然保持原状，这次没有把 recovery surface 一并 typed 化。
- `latestStage` 这类角色阶段字段仍未建模为 typed contract，本包只处理了 dispatcher readback 不再漏出 delivery truth 原词表。

## 下一包入口

- 第 2 包下一小段应继续留在 CMP neutral surface hardening 范围内，但优先从还残留裸字符串的 flow/readback 邻接面继续收口，而不是回头放大 control。
- 更值得继续收紧的方向：
  - `roleStages` 容器本身的 typed 化
  - recovery / readback 里仍然直接暴露字符串状态的外显 surface
  - interface surface 对这些 typed CMP 字段的更多入口级失败测试钉住
