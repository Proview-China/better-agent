# Three-Agent Real Usage Task Pack

状态：面向多智能体并发施工的正式任务包 v1

更新时间：2026-03-30

## 任务包目标

这一包不是继续补“能不能调模型”。

这一包要解决的是：

- `reviewer`
- `tool_reviewer`
- `TMA`

这三个 agent 在 `TAP` 内部如何进入真实使用状态。

一句白话：

- 这包任务要把“三个会说话的壳子”
- 收成“能在真实任务里稳定接力的 worker 体系”

## 开工前必须先读

- [50-three-agent-real-usage-outline.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/50-three-agent-real-usage-outline.md)
- [48-tap-final-closure-and-three-agent-outline.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/48-tap-final-closure-and-three-agent-outline.md)
- [24-tap-mode-matrix-and-worker-contracts.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/24-tap-mode-matrix-and-worker-contracts.md)
- `memory/current-context.md`

## 本轮冻结共识

- `reviewer` 先总闸
- `tool_reviewer` 收在治理 + 验收
- `TMA` 先收成施工执行器
- 除 `human gate` 外尽量自动继续
- `reviewer` 只写审批记录，不直接施工
- `CMP / MP` 很快接入，因此当前实现不能把临时上下文方案写死
- 完成标准必须包括真实任务可跑

## 推荐并发方式

推荐总并发：

- `6-10` 个真正会改代码的 worker

推荐分层：

1. 主控
   - 负责 runtime 总装
   - 负责共享 helper
   - 负责联调
   - 负责测试
2. reviewer 线
3. tool_reviewer 线
4. TMA 线
5. durable / user-surface / CMP-MP aperture 线

## 高危共享文件

这些文件默认不要多人同时改：

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/agent_core/ta-pool-review/**`
- `src/agent_core/ta-pool-tool-review/**`
- `src/agent_core/ta-pool-provision/**`

## 推荐执行波次

### Wave 0

- `00-real-usage-protocol-freeze.md`

### Wave 1

- `01-reviewer-real-usage-mainline.md`
- `02-tool-reviewer-real-usage-mainline.md`
- `03-tma-real-usage-mainline.md`

### Wave 2

- `04-cross-agent-auto-chain.md`
- `05-durable-ledger-and-user-records.md`

### Wave 3

- `06-cmp-mp-aperture-ready-points.md`
- `07-end-to-end-real-task-closure.md`

## 本轮任务列表

## 当前阶段落地

截至 2026-03-31，下面这部分已经真实落地并通过测试：

- `05 Durable Ledger And User Records`
  - 已经补出 reviewer / tool_reviewer / TMA 的统一过程账本
  - 已经接进 TAP snapshot / hydrate
  - 已有 runtime 级测试证明账本会跟着三 agent 主链一起记录和恢复

- `04 Cross-Agent Auto Chain`
  - 当前最关键的 `provision -> activation -> replay -> auto-continue` 主链已经重新打绿
  - 这轮修复不是单点补丁，而是 runtime 主链重新联调后的收口

### 00 Real Usage Protocol Freeze

目标：

- 冻结三 agent 的真实使用语义

必须明确：

- 默认总链路
- 自动继续点
- 停止点
- durable 产物名
- 前台记录名

### 01 Reviewer Real Usage Mainline

目标：

- 把 reviewer 收成真实总闸

必须包括：

- 审批拍板
- 上下文研究
- 白话解释
- 审批记录 durable 化

必须不包括：

- 直接施工
- 直接写代码
- 直接造工具

### 02 Tool Reviewer Real Usage Mainline

目标：

- 把 tool_reviewer 收成真实治理 + 验收 agent

必须包括：

- 工具治理计划
- bundle / lifecycle / activation / replay 验收
- TMA 工单生成
- runtime pickup handoff

必须不包括：

- 直接施工
- 自动替用户完成原任务

### 03 TMA Real Usage Mainline

目标：

- 把 TMA 收成真实施工执行器

必须包括：

- 工单接收
- 计划执行
- bundle 生成
- verification evidence
- replay rationale
- resumable session

必须不包括：

- 自动批准 activation
- 自动 dispatch 原任务

### 04 Cross-Agent Auto Chain

目标：

- 真正把默认自动链路收口

必须包括：

- `reviewer -> tool_reviewer`
- `tool_reviewer -> TMA`
- `TMA -> tool_reviewer`
- `tool_reviewer -> runtime pickup`

必须明确：

- 哪些节点自动继续
- 哪些节点必须停

### 05 Durable Ledger And User Records

目标：

- 把三类 durable 一起做实

必须包括：

- reviewer session / decision durable
- tool_reviewer governance durable
- TMA session / bundle / replay durable
- 用户可解释记录

### 06 CMP MP Aperture Ready Points

目标：

- 让三 agent 的真实使用点都为 `CMP / MP` 预留正式注入点

必须包括：

- reviewer section intake
- tool_reviewer context intake
- TMA context intake
- runtime 总装注入点

### 07 End To End Real Task Closure

目标：

- 用一条真实任务链验证本轮完成定义

必须包括：

- reviewer 参与
- tool_reviewer 参与
- TMA 参与
- runtime pickup
- `human gate` 外的自动继续
- durable 回读

## 任务分派建议

### 主控

- 拥有 `runtime.ts`
- 拥有共享 helper
- 拥有最终联调和测试

### Worker A

- 负责人：reviewer 线
- 写域：`ta-pool-review/**`

### Worker B

- 负责人：tool_reviewer 线
- 写域：`ta-pool-tool-review/**`

### Worker C

- 负责人：TMA 线
- 写域：`ta-pool-provision/**`

### Worker D

- 负责人：durable / user record
- 写域：`ta-pool-runtime/**` 和对应 tests

### Worker E

- 负责人：CMP / MP aperture ready points
- 写域：context aperture / runtime injection points

## 本轮完成定义

本轮只要满足下面五条，就可以算阶段完成：

1. 三 agent 的真实职责已经进入主链
2. 默认总链路可以自动跑起来
3. `human gate` 仍是主要停点
4. durable 三类都已纳入实现
5. 至少一条真实任务链可跑通
