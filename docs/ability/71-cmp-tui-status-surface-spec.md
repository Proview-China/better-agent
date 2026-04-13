# CMP TUI Status Surface Spec

状态：交付给 TUI 侧的状态暴露规范。

更新时间：2026-04-12

## 这份文档回答什么

这份文档只回答一件事：

- 当用户运行 `npm run chat:single-agent:tui` 时，
  `CMP` 应该向 `TUI` 暴露什么状态，
  才能让用户看到“后台异步伴侣现在到底在干什么”。

这份文档**不**回答：

- `TUI` 的布局怎么画
- 组件怎么写
- 交互按键怎么定

一句白话：

- 这是 `CMP -> TUI` 的状态契约
- 不是 `TUI` 实现说明书

## 当前设计目标

`CMP` 在 `TUI` 里不应该表现成：

- 一坨原始 JSON
- 一坨 readback 细节
- 一堆难懂的内部对象名

而应该表现成：

- 后台有没有在工作
- 五个工位谁在工作
- 当前上下文包在走哪条流
- 有没有卡审批 / 卡回流
- 当前整体是不是健康
- 如果不健康，最大的问题是什么

一句白话：

- 用户想看的是“CMP 在干嘛”
- 不是“CMP 内部存了多少字段”

## 总原则

`CMP` 暴露给 `TUI` 的状态，默认分成三层：

### Layer 1. 主实时状态

给常驻侧栏或状态区。

目标：

- 一眼看懂现在 `CMP` 在不在工作
- 谁在干活
- 有没有卡住

数据来源优先：

- `statusPanel`

### Layer 2. 详情状态

给展开详情或二级面板。

目标：

- 解释“为什么现在是这个状态”
- 展示哪些 gate 没亮

数据来源优先：

- `readback`

### Layer 3. 诊断/验收状态

给手动触发的健康检查结果。

目标：

- 回答“现在到底有没有通过当前验收门”

数据来源优先：

- `smoke`

## 为什么主实时面优先用 `statusPanel`

原因很简单：

- `statusPanel` 已经是低噪音、短字段、稳定行模型
- 它天然适合 TUI
- 它已经把 `CMP` 的后台状态压缩成“人能看懂的状态”

而 `readback` 更像总账：

- 信息最全
- 但太重
- 不适合做第一屏

`smoke` 更像验收门：

- 很重要
- 但不适合常驻实时刷

## TUI 第一版建议暴露的五组状态

## 1. `overall`

这是 `CMP` 的总标题状态。

### 作用

- 让用户一眼知道 `CMP` 现在总体是不是在工作

### 建议字段

- `status`
- `summary`

### 建议枚举

- `idle`
- `working`
- `waiting`
- `healthy`
- `degraded`
- `failed`

### 白话解释

- `idle`：现在没有明显治理动作
- `working`：后台正在整理上下文
- `waiting`：卡在审批 / 回流 / review
- `healthy`：当前主工作面正常
- `degraded`：能用，但有门没亮
- `failed`：明显出错

### 建议展示文案

- `CMP working · peer pending 1 · readback degraded`
- `CMP healthy · no pending approvals`
- `CMP waiting · reintervention pending`

## 2. `roles`

这是最核心的一组。

它回答：

- 五个工位里谁在工作
- 谁已经做完
- 谁在等待

### 角色列表

- `icma`
- `iterator`
- `checker`
- `dbagent`
- `dispatcher`

### 每个角色建议暴露字段

- `role`
- `status`
- `latestStage`
- `semanticSummary`

### 角色状态枚举

- `idle`
- `working`
- `waiting`
- `done`
- `failed`

### 白话解释

- `ICMA working`
  表示：正在接混乱原料、切块、做后处理包雏形
- `Iterator working`
  表示：正在分线、控粒度、准备让 Checker 更容易看
- `Checker working`
  表示：正在做信噪比守门、拆合删增
- `DBAgent working`
  表示：正在整理高价值 section、持久化、回包准备
- `Dispatcher waiting`
  表示：路已经算出来了，但可能卡在 peer approval 或其他治理门

### 建议用户感知文案

- `ICMA · working · emit`
- `Iterator · done · review ref stable`
- `Checker · working · checked`
- `DBAgent · done · passive return ready`
- `Dispatcher · waiting · peer approval required`

## 3. `flow`

这是“当前上下文包在走哪条路”。

### 作用

- 不看角色，看流动

### 建议字段

- `activeFlow`
- `packageMode`
- `targetIngress`
- `pendingPeerApprovalCount`
- `approvedPeerApprovalCount`
- `reinterventionPendingCount`
- `passiveReturnCount`

### 推荐 `activeFlow` 值

- `child_seed`
- `peer_exchange`
- `historical_return`
- `core_return`
- `lineage_delivery`

### 白话解释

- `child_seed`
  当前有背景播种流向子 ICMA
- `peer_exchange`
  当前有同级瘦交换流
- `historical_return`
  当前在做被动历史回送
- `core_return`
  当前有东西回给 core
- `lineage_delivery`
  当前沿 lineage 内部传递

### 建议用户感知文案

- `flow · peer_exchange · pending=1`
- `flow · historical_return · passive=1`
- `flow · child_seed · latest ingress=child_icma_only`

## 4. `health`

这是“整体现在看起来怎么样”。

### 建议字段

- `readbackStatus`
- `flowStatus`
- `finalAcceptance`
- `primaryIssue`

### 白话解释

- `readbackStatus`
  当前总账层看起来怎么样
- `flowStatus`
  当前流动层是不是通的
- `finalAcceptance`
  整套验收门是不是都亮了
- `primaryIssue`
  现在最大的问题一句话说清

### 非常重要的语义边界

- `flowStatus = ready`
  不等于
- `finalAcceptance = ready`

因为 `finalAcceptance` 还受下面这些 gate 影响：

- object model
- bundle schema
- TAP execution bridge
- live infra
- recovery

### 建议用户感知文案

- `health · readback=degraded · flow=ready · final=degraded`
- `issue · tap execution bridge not ready`

## 5. `requests`

这是“当前卡了哪些治理请求”。

### 建议字段

- `peerApproval`
- `promoteReview`
- `reintervention`
- `passiveHistoryRequest`

### 每项建议只给状态，不给大段细节

- `none`
- `pending`
- `serving`
- `completed`

### 白话解释

- `peerApproval`
  有没有同级交换卡在审批
- `promoteReview`
  有没有 promote 正在 review
- `reintervention`
  有没有后台治理主动介入
- `passiveHistoryRequest`
  有没有历史回取请求正在处理

## 推荐的最小状态对象

如果 `TUI` 第一版只接一个对象，
建议 `CMP` 暴露这个：

```ts
export interface CmpTuiStatus {
  overall: {
    status: "idle" | "working" | "waiting" | "healthy" | "degraded" | "failed";
    summary: string;
  };
  roles: Array<{
    role: "icma" | "iterator" | "checker" | "dbagent" | "dispatcher";
    status: "idle" | "working" | "waiting" | "done" | "failed";
    latestStage?: string;
    semanticSummary?: string;
  }>;
  flow: {
    activeFlow?: "child_seed" | "peer_exchange" | "historical_return" | "core_return" | "lineage_delivery";
    packageMode?: string;
    targetIngress?: string;
    pendingPeerApprovalCount: number;
    approvedPeerApprovalCount: number;
    reinterventionPendingCount: number;
    passiveReturnCount: number;
  };
  health: {
    readbackStatus?: "ready" | "degraded" | "failed";
    flowStatus?: "ready" | "degraded" | "failed";
    finalAcceptance?: "ready" | "degraded" | "failed";
    primaryIssue?: string;
  };
  requests: {
    peerApproval: "none" | "pending" | "serving" | "completed";
    promoteReview: "none" | "pending" | "serving" | "completed";
    reintervention: "none" | "pending" | "serving" | "completed";
    passiveHistoryRequest: "none" | "pending" | "serving" | "completed";
  };
}
```

## 这些字段从哪里来

## `overall`

优先从这些信息综合：

- `statusPanel.health.readbackStatus`
- `statusPanel.health.finalAcceptanceStatus`
- `statusPanel.requests.pendingPeerApprovalCount`
- `statusPanel.requests.reinterventionPendingCount`

建议规则：

- 如果 `finalAcceptanceStatus === failed`
  -> `overall.status = failed`
- 否则如果存在 pending approval / pending reintervention
  -> `overall.status = waiting`
- 否则如果 `readbackStatus === degraded`
  -> `overall.status = degraded`
- 否则如果任一角色最近仍在推进 stage
  -> `overall.status = working`
- 否则
  -> `overall.status = healthy`

## `roles`

直接来自：

- `statusPanel.roles`

建议映射：

- `latestStage` 直接透出
- `semanticSummary` 直接透出
- `status` 由 `latestStage + liveStatus + fallbackApplied` 做一层轻映射

推荐映射：

- `liveStatus = failed` -> `failed`
- `latestStage` 是正在推进态 -> `working`
- `latestStage` 是稳定收口态 -> `done`
- 某些审批态 / 等待态 -> `waiting`
- 没观测到活跃记录 -> `idle`

## `flow`

优先来自：

- `statusPanel.packageFlow`
- `statusPanel.requests`

## `health`

优先来自：

- `statusPanel.health`
- 再补 `readback.summary.issues[0]` 作为 `primaryIssue`

## `requests`

优先来自：

- `statusPanel.requests`

建议映射：

- `pendingPeerApprovalCount > 0`
  -> `peerApproval = pending`
- `approvedPeerApprovalCount > 0 && pendingPeerApprovalCount === 0`
  -> `peerApproval = completed`
- `reinterventionPendingCount > 0`
  -> `reintervention = pending`
- `reinterventionServedCount > 0 && reinterventionPendingCount === 0`
  -> `reintervention = completed`

## 第一版不要暴露给主面的东西

下面这些不适合直接常驻到主屏：

- 整份 `readback.summary`
- 全量 `issues[]`
- 全量 `truthLayers`
- 全量 `smoke.checks`
- 原始 dispatcher bundle JSON
- 原始 package / snapshot / receipt 内部对象

原因很简单：

- 这些信息太重
- 会让 `CMP` 变成新的噪音源

## 推荐的主屏文案粒度

主屏应该尽量短。

### 推荐一行总标题

- `CMP working · peer pending 1 · final degraded`
- `CMP healthy · no pending approvals`
- `CMP waiting · passive history serving`

### 推荐角色行

- `ICMA      working   emit          chunking=multi_auto`
- `Iterator  done      update_ref    verdict=advance_review`
- `Checker   done      checked       split=1 merge=0`
- `DBAgent   working   attach_pkg    passive=historical_return`
- `Dispatch  waiting   collect       peer approval required`

### 推荐流动行

- `flow: peer_exchange · ingress=peer_exchange · pending=1`
- `flow: historical_return · ingress=core_agent_return · passive=1`

### 推荐健康行

- `health: readback=degraded · flow=ready · final=degraded`
- `issue: tap execution bridge not ready`

## 第一版交付建议

如果要给 TUI 那边负责的 Codex，
建议直接按下面优先级接：

### Priority 1

- `CmpTuiStatus.overall`
- `CmpTuiStatus.roles`
- `CmpTuiStatus.flow`

原因：

- 这是“后台到底在干嘛”的最小完整答案

### Priority 2

- `CmpTuiStatus.health`
- `CmpTuiStatus.requests`

原因：

- 这是“为什么没继续往前”的解释层

### Priority 3

- `readback` 详情页
- `smoke` 诊断页

原因：

- 这层适合展开，不适合常驻主面

## 给 TUI 侧 Codex 的一句话说明

可以直接把下面这句发给对方：

`CMP` 第一版给 `TUI` 暴露的不是原始 `readback` JSON，而是一份低噪音 `CmpTuiStatus`：包含 overall、roles、flow、health、requests 五组状态。主实时面优先展示 statusPanel 语义，readback 只做详情，smoke 只做诊断。

## 一句话收口

`CMP` 暴露给 `TUI` 的最佳状态，不是“内部全对象”，而是：

- 谁在工作
- 在干什么
- 卡在哪
- 现在健康不健康
- 最大的问题是什么
