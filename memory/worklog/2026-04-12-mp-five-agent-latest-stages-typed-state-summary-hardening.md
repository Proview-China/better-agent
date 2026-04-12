# 2026-04-12 MP Five-Agent Latest Stages Typed State/Summary Hardening

## 本次落地内容

- 这次只处理 `PraxisMpFiveAgent` 自己的 `latestStages` 真相源、runtime state 和 summary，不外扩到 `RuntimeUseCases`、`RuntimeFacades`、`RuntimeInterface`。
- `PraxisMpFiveAgentRuntimeState.latestStages` 与 `PraxisMpFiveAgentSummary.latestStages` 已从 `[PraxisMpFiveAgentRole: String]` 收紧为 `PraxisMpRoleStageMap`。
- `PraxisMpFiveAgentRuntime` 内部保存的 `latestStages` 真相源也同步从自由字符串 map 改为 `PraxisMpRoleStageMap`，不再是“对外 DTO 换壳、内部仍 stringly”的半收口状态。
- `bump(...)` 现在直接接收 `PraxisMpRoleTelemetryStage`，各调用点不再传 stage raw string。
- `PraxisMpRoleStageMap` 补了一个最小的 `empty` / `setting(_:)` 辅助面，保证 runtime 内部更新 latest stage 时仍然复用同一套 typed contract，而不是重新散落字典写法。

一句白话：

- five-agent 自己现在也不再把最新阶段当普通字符串保存和导出了，而是统一用同一个可校验的 typed stage map。

## Host-Neutral 边界

- 这次没有引入 CLI、UI、平台控件、provider payload 或终端文案语义。
- `latestStages` 继续停留在 MP five-agent 自身的宿主无关领域语义里，只表达“哪个角色当前处在哪个阶段”。
- 已有 `PraxisMpRoleStageMap` / `PraxisMpRoleTelemetryStage` 被复用为唯一 typed contract，没有再造第二套近似状态模型。

## 测试

- 新增和调整的验证聚焦在 five-agent 自身：
  - `PraxisMpFiveAgentRuntimeState` roundtrip
  - 非法 `latestStages` payload decode failure
  - runtime `summary/state` 的 typed stage assertion
- 本地验收：
  - `swift test --filter PraxisMpFiveAgentTests`
- 复审结果：
  - `无 findings`

## 残余限制

- 这次按范围要求只收口了 five-agent 自己的 typed state/summary，没有把这个 surface 再往 `RuntimeUseCases / Facades / Interface` 外推。
- 当前 decode guard 主要钉住了 `PraxisMpFiveAgentRuntimeState` 的 `latestStages`；`PraxisMpFiveAgentSummary` 还没有单独做一条编解码守卫测试，不过它复用的是同一个 `PraxisMpRoleStageMap` contract。
- 测试没有直接覆盖：
  - `PraxisMpRoleStageMap.init(stages:)` 的 `precondition` 分支
  - `encode(to:)` 在对象被异常伪造成非法状态时的再校验分支

## 下一包入口

- MP five-agent 这一段继续往下收时，更合理的方向是把其余仍停留在 runtime 内部的 stringly stage/state 真相源继续收口，而不是反向去扩大 runtime outer surface。
