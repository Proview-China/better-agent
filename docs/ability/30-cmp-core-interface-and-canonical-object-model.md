# CMP Core Interface And Canonical Object Model

状态：指导性分册，不是冻结实现。

更新时间：2026-03-20

## 这份文档要回答什么

在真正写 `CMP` 代码之前，必须先把两件事讲清楚：

1. `CMP` 到底如何特化接入 `core_agent`。
2. `CMP` 内部有哪些 canonical object，后续所有 agent / git / DB / MQ 都围绕哪些对象运转。

一句白话：

- 没有对象模型，后面只会变成一堆“上下文大对象”到处飞
- 没有 interface，`CMP` 只会变成一个难以挂接回 `core_agent` 的外部服务

## 先说结论

- `CMP` 不应该沿用 `TAP` 的 `capability_call` 语义。
- `CMP` 需要在现有 `agent_core` interface 基础上做一层“上下文治理特化”。
- 这层 interface 更像：
  - 截获
  - 推进
  - 甄选
  - 投影
  - 分发
- `CMP` 的对象模型必须先区分：
  - 事实历史对象
  - checked 状态对象
  - DB 投影对象
  - 可分发对象

## `CMP` 对 `core_agent` 的特化 interface

当前建议 `CMP` 对 `core_agent` 暴露最小的 6 类动作。

### 1. `ingest_runtime_context`

作用：

- `ICMA` 截获当前 `core_agent` 的上下文输入与运行中新历史。
- 进入 `CMP` 的入口动作。

输入重点：

- 当前 agent identity
- 当前 lineage 信息
- 当前上下文材料
- 当前任务语义
- 当前是否需要主动同步

### 2. `commit_context_delta`

作用：

- 把本轮上下文变化转成一个可追踪的 `ContextDelta`。
- 交给 git/iterator/checker 流程继续推进。

### 3. `resolve_checked_snapshot`

作用：

- 获取某个 agent / lineage 当前最新、可用、已检查通过的状态点。
- 给主动回填和被动查询都提供统一入口。

### 4. `materialize_context_package`

作用：

- 从 checked snapshot 和 DB projection 里生产一个高信噪比交付包。
- 这个包不是 raw history，而是面向消费端的 context package。

### 5. `dispatch_context_package`

作用：

- 把 materialized package 分发给：
  - 主 agent
  - 直属子 agent 的 `ICMA`
  - 同级 agent（在允许时）

### 6. `request_historical_context`

作用：

- 被动模式下按需求拉取高信噪比历史状态。
- 不直接暴露所有 raw 历史。

## canonical object model

下面这些对象建议先冻结成 `CMP v1` 的基础对象。

### 1. `AgentLineage`

作用：

- 表示一个 agent 在项目中的 lineage 身份和父子关系。

最少应表达：

- `agentId`
- `parentAgentId`
- `depth`
- `projectId`
- `branchFamily`
- `childAgentIds`
- `status`

### 2. `ContextEvent`

作用：

- 表示 `ICMA` 截获到的一次原始上下文事件。

它是事实层，不是总结层。

最少应表达：

- `eventId`
- `agentId`
- `sessionId`
- `runId`
- `kind`
- `payloadRef`
- `createdAt`
- `source`

### 3. `ContextDelta`

作用：

- 表示一次上下文变化的结构化增量。

它是从一批 `ContextEvent` 归并出来的可推进对象。

最少应表达：

- `deltaId`
- `agentId`
- `baseRef`
- `eventRefs`
- `changeSummary`
- `createdAt`
- `syncIntent`

### 4. `SnapshotCandidate`

作用：

- 表示一个等待 checker 判定的候选状态点。

最少应表达：

- `candidateId`
- `agentId`
- `branchRef`
- `commitRef`
- `deltaRefs`
- `createdAt`
- `status`

### 5. `CheckedSnapshot`

作用：

- 表示 checker 已确认可用的状态点。

最少应表达：

- `snapshotId`
- `agentId`
- `lineageRef`
- `branchRef`
- `commitRef`
- `checkedAt`
- `qualityLabel`
- `promotable`
- `metadata`

### 6. `PromotedProjection`

作用：

- 表示已被提升、可进入父节点视野或可进入分发流程的 DB 投影。

最少应表达：

- `projectionId`
- `snapshotId`
- `agentId`
- `visibilityLevel`
- `promotionStatus`
- `projectionRefs`
- `updatedAt`

### 7. `ContextPackage`

作用：

- 真正给主 agent / 子 agent 消费的高信噪比上下文包。

最少应表达：

- `packageId`
- `sourceProjectionId`
- `targetAgentId`
- `packageKind`
- `packageRef`
- `fidelityLabel`
- `createdAt`

### 8. `DispatchReceipt`

作用：

- 表示一次上下文包派发的结果。

最少应表达：

- `dispatchId`
- `packageId`
- `sourceAgentId`
- `targetAgentId`
- `status`
- `deliveredAt`
- `acknowledgedAt`

### 9. `SyncEvent`

作用：

- 表示从 git / DB / MQ 任一侧触发的一次结构化同步事件。

最少应表达：

- `syncEventId`
- `agentId`
- `channel`
- `direction`
- `objectRef`
- `createdAt`

### 10. `EscalationAlert`

作用：

- 极少数情况下允许的越级严重告警。

它不是常规同步对象。

最少应表达：

- `alertId`
- `sourceAgentId`
- `targetAncestorId`
- `severity`
- `reason`
- `evidenceRef`
- `createdAt`

## 主动模式下对象如何流转

当前建议是：

`ContextEvent -> ContextDelta -> SnapshotCandidate -> CheckedSnapshot -> PromotedProjection -> ContextPackage -> DispatchReceipt`

这条链里：

- 前三段更偏事实与推进
- 中两段更偏检查与投影
- 后两段更偏交付与回填

## 被动模式下对象如何流转

当前建议是：

`request_historical_context -> resolve_checked_snapshot -> select PromotedProjection -> materialize ContextPackage -> dispatch`

被动模式不绕开 active mode 产生的 checked state。

## 哪些对象是事实层，哪些不是

### 事实层

- `ContextEvent`
- `ContextDelta`
- git branch / commit / PR / merge

### 检查层

- `SnapshotCandidate`
- `CheckedSnapshot`

### 投影层

- `PromotedProjection`

### 交付层

- `ContextPackage`
- `DispatchReceipt`

## 当前不要做错的事

- 不要把 `ContextPackage` 当成历史真相。
- 不要让 `CheckedSnapshot` 和 `PromotedProjection` 混成一个对象。
- 不要让 `DispatchReceipt` 反向承载大段上下文正文。
- 不要让 `CMP` interface 退化成一个“给我搜点历史”的单点函数。

