# 2026-04-12 CMP Role Stage Typed Surface Hardening

## 本次落地内容

- 第 2 包继续留在 `CMP neutral surface hardening` 范围内，这次只收紧 `roles/readback` 外显 contract 里的 `latestStage` / `roleStages`，没有扩到 `MP`、`packageStatusCounts`、`recoverySource`、更多 recovery detail 或 interface->usecase 依赖清理。
- `PraxisCmpRoleReadback.latestStage` 已从裸字符串收紧为 `PraxisCmpRoleStage?`。
- façade 的两个外显 snapshot 已不再用 `[String: String]` 暴露角色阶段：
  - `PraxisCmpRolesPanelSnapshot.roleStages`
  - `PraxisCmpStatusPanelSnapshot.roleStages`
- `RuntimeInterface` 现已把 typed `roleStages` 贯通到 `cmpRoles` / `cmpStatus` snapshot，不再只剩 summary 文本和 `latestDispatchStatus`。
- dispatcher 的 `latestStage` 不再直接走字符串拼装，而是沿 `PraxisCmpLatestDispatchStatus -> PraxisCmpRoleStage` 映射，保留：
  - `prepared`
  - `delivered`
  - `acknowledged`
  - `rejected`
  - `retryScheduled`
  - `expired`

一句白话：

- CMP roles/status 这条宿主无关链路里，“角色现在处于哪个阶段”已经不再靠字符串约定传递了。

## 新增最小 typed 模型

- 新增共享 enum `PraxisCmpRoleStage`，只覆盖当前仓库里已实际出现或已被 readback surface 承接的阶段语义：
  - `ingested`
  - `candidateReady`
  - `checkedReady`
  - `projectionReady`
  - `materialized`
  - `prepared`
  - `delivered`
  - `acknowledged`
  - `rejected`
  - `retryScheduled`
  - `expired`
- 新增 façade/interface 复用的 typed 容器 `PraxisCmpRoleStageMap`，把角色到阶段的映射收紧成：
  - `[PraxisFiveAgentRole: PraxisCmpRoleStage]`

## 语义收紧

- `summary` 仍只做人类可读文本，没有被抬成阶段真相。
- `roleStages` 的 `Codable` 现在会显式拒绝：
  - 非法角色 key
  - 非法阶段 raw value
- 这次没有引入 CLI、GUI、平台控件等宿主词汇到 neutral output。
- 这次也没有改 CMP live/event 内部模型；只是把外显 contract typed 化，并让 use case -> façade -> interface 三层保持一致。

## 测试

- 本次补充和更新的验证覆盖：
  - use case 层对 typed `latestStage` 的正向断言
  - façade 层对 typed `roleStages` 的正向断言
  - runtime interface 层对 `roleStages` 的结构化暴露断言
  - `PraxisCmpRoleStageMap` / runtime interface snapshot 的 raw-value roundtrip
  - 非法 `broken_stage` 解码稳定失败
- 本地最终验收：
  - `swift test`
- 结果：
  - `245 tests / 52 suites` 通过
- 复审结果：
  - `无 findings`

## 残余限制

- `RuntimeInterface` 这轮只结构化暴露了 `roleStages`，没有再单独新增顶层 `latestStage` 字段；interface 调用方需要从 `roleStages[role]` 读取单角色阶段。
- `PraxisCmpRoleStage` 目前只覆盖当前仓库里已经出现的阶段语义；未来若新增阶段，必须显式扩 enum 和测试，不能回退成字符串。
- `MP` 的 `roleStages` 仍是字符串面，这轮按范围没有动。
- 针对特定 `agentID` 的 scoped roles readback，像 `iterator` / `checker` 阶段是否为空，仍沿用当前业务判定规则；这轮只做 contract typed 化，没有调整 readback 规则本身。
- `PraxisCmpRoleStageMap` 目前定义在 façade DTO 层，并被 `RuntimeInterfaceSnapshot` 直接复用；这次不构成阻塞，但如果后面继续把 contract 真相上提，这里会是后续收口点。

## 下一包入口

- 第 2 包仍应继续留在 CMP neutral surface hardening 内，优先清理剩余直接暴露在 roles/readback 邻接面的 stringly-typed contract，而不是跳到 MP、localDefaults 或 HostContracts seam。
- 更可能继续收口的方向：
  - `roles/readback` 里仍保留字符串的其它外显字段
  - interface 层是否需要更细粒度的 per-role typed projection
  - façade/interface 复用 DTO 的位置是否要继续上提为更稳定的 shared contract
