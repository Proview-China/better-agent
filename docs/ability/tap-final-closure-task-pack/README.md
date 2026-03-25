# TAP Final Closure Task Pack

状态：面向多智能体并发施工的正式任务包。

更新时间：2026-03-25

## 这包任务是干什么的

这包任务不是再补一个零散功能点。

这包任务的目标是：

- 真正收尾 `TAP`
- 正式做出：
  - `reviewer`
  - `tool_reviewer`
  - `TMA`
- 冻结 15 种视角
- 为普通用户可用与未来 `CMP / MP` 联调做好接口级准备

一句白话：

- 我们现在不再是在“补模块”
- 而是在把 TAP 收成一个真正可交付的样板池

## 开工前必须先读

所有执行这包任务的 Codex 都必须先读：

- [48-tap-final-closure-and-three-agent-outline.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/48-tap-final-closure-and-three-agent-outline.md)
- [47-tap-wave18-negative-boundary-first-batch.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/47-tap-wave18-negative-boundary-first-batch.md)
- [46-tap-wave4-wave5-durable-lanes-and-hydration.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/46-tap-wave4-wave5-durable-lanes-and-hydration.md)
- [24-tap-mode-matrix-and-worker-contracts.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/24-tap-mode-matrix-and-worker-contracts.md)
- [20-ta-pool-control-plane-outline.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/20-ta-pool-control-plane-outline.md)
- `memory/current-context.md`

## 本轮冻结共识

- 三种正式 agent：
  - `reviewer`
  - `tool_reviewer`
  - `TMA`
- 三者都是独立可恢复 runtime
- reviewer 审行为
- tool_reviewer 审工具意图与持续治理
- TMA 只造工具
- 除人工门槛外，后链尽量自动继续
- 15 种视角这次必须冻结成正式矩阵
- 规则对象挂在 `TAP pool object`
- 策略实例化走双层：
  - 工作区级
  - 任务/会话级
- `CMP / MP` 这次是接口级强依赖
- 普通用户前台默认半透明

## 推荐分波顺序

### Wave 0: Protocol Freeze

- `00-final-closure-protocol-freeze.md`

### Wave 1: Policy / Matrix / Governance Object

- `01-shared-15-view-matrix.md`
- `02-pool-governance-object-and-instantiation.md`
- `03-user-surface-and-override-contract.md`

### Wave 2: Three Agent Runtime Contracts

- `04-reviewer-runtime-contract-v2.md`
- `05-tool-reviewer-runtime-contract-v2.md`
- `06-tma-runtime-contract-v2.md`

### Wave 3: Reviewer Final Closure

- `07-reviewer-behavior-review-mainline.md`
- `08-reviewer-human-gate-idempotency-and-final-state.md`
- `09-reviewer-cmp-mp-section-aperture-contract.md`

### Wave 4: Tool Reviewer Final Closure

- `10-tool-reviewer-continuous-governance-plan.md`
- `11-tool-reviewer-runtime-orchestration.md`
- `12-tool-reviewer-runtime-smoke-and-quality-report.md`

### Wave 5: TMA Final Closure

- `13-tma-build-bundle-autocontinue.md`
- `14-tma-explicit-resume-and-resumable-executor.md`
- `15-tma-delivery-artifacts-and-quality-evidence.md`

### Wave 6: End-to-End Assembly

- `16-cross-agent-auto-chain-and-human-gate-merge.md`
- `17-ordinary-user-usable-surface.md`
- `18-tap-cmp-mp-ready-interface-checklist.md`
- `19-end-to-end-final-closure-and-report.md`

## 推荐并发量

- Wave 0：`1`
- Wave 1：`3`
- Wave 2：`3`
- Wave 3：`3`
- Wave 4：`3`
- Wave 5：`3`
- Wave 6：`2`

建议总并发控制在：

- `8-12` 个真正会改代码的 worker

可以额外挂更多只读 explorer。

## 共享文件高危提醒

这些文件不要让多个 worker 同时乱改：

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/agent_core/ta-pool-runtime/**`
- `src/agent_core/ta-pool-review/**`
- `src/agent_core/ta-pool-tool-review/**`
- `src/agent_core/ta-pool-provision/**`
- `docs/ability/48-tap-final-closure-and-three-agent-outline.md`

## 任务清单

## 00 Final Closure Protocol Freeze

目标：

- 冻结这轮所有共享对象名、agent 名、状态名、handoff 名、用户前台名词

必须明确：

- reviewer / tool_reviewer / TMA 的正式命名
- governance object
- 15-view matrix object
- section registry object
- user override object

## 01 Shared 15-View Matrix

目标：

- 把 5×3 共享总矩阵正式写出来
- 明确三种 agent 的映射方式

必须明确：

- 自动链路
- 中断点
- 人类门槛
- reviewer 权限
- TR 权限
- TMA 权限

## 02 Pool Governance Object And Instantiation

目标：

- 明确规则对象挂在 pool 上
- 明确工作区级 + 任务级双层实例化

必须明确：

- 人类定 `5`
- agent/reviewer 定 `3`
- 子 agent 如何继承父 agent 的策略实例

## 03 User Surface And Override Contract

目标：

- 冻结普通用户前台半透明语义
- 冻结前台高级开关

必须明确：

- 模式切换
- 自动化深度
- 人工门槛
- 工具策略覆写
- agent 规则解释自定义

## 04 Reviewer Runtime Contract V2

目标：

- 把 reviewer 正式收成“主行为审查员”

必须明确：

- 输入 section
- 输出结构
- baseline 能力
- 自动批准边界
- LLM 判定优先级

## 05 Tool Reviewer Runtime Contract V2

目标：

- 把 TR 正式收成“工具意图审查员 + 持续治理负责人”

必须明确：

- reviewer -> TR 的正式输入
- TR -> TMA 的正式工单
- TR 的持续治理计划结构
- 主动治理的规则

## 06 TMA Runtime Contract V2

目标：

- 把 TMA 正式收成“只造工具的施工 agent”

必须明确：

- baseline 施工能力
- 恢复后自动继续直到 `ready bundle`
- 不自动 activation / dispatch 原任务
- 结构化回执与证据合同

## 07 Reviewer Behavior Review Mainline

目标：

- reviewer 主链从“能审”推进到“正式行为总闸门”

必须包括：

- baseline + 部分普通读操作的快路由
- 大多数非 baseline 请求进入 reviewer agent
- 机器决策 + 白话解释双输出

## 08 Reviewer Human Gate Idempotency And Final State

目标：

- reviewer / human-gate 完成态完全收口

必须包括：

- human gate 幂等
- human gate 终态 envelope 清理
- reviewer durable completed
- 多个人工门槛的合并规则

## 09 Reviewer CMP/MP Section Aperture Contract

目标：

- 冻结 reviewer 将来消费的 `CMP / MP section` 接口

必须包括：

- 标准 section registry schema
- source / freshness / trust level
- 当前占位与未来联调点

## 10 Tool Reviewer Continuous Governance Plan

目标：

- 把 TR 的“持续治理计划”正式对象化

必须包括：

- 家族层治理计划
- 工具级治理项
- 增删合拆淘汰
- 老化与过时检查

## 11 Tool Reviewer Runtime Orchestration

目标：

- 把 TR 从“只记账”推进到“正式治理编排 agent”

必须包括：

- reviewer -> TR 自动转交
- TR -> TMA 自动下单
- TR 对 lifecycle / activation / replay / smoke 的主导关系

## 12 Tool Reviewer Runtime Smoke And Quality Report

目标：

- 冻结 TR 主导的运行期 smoke 与最终质检报告

必须包括：

- TMA 提交 smoke 资料
- TR 主导运行期 smoke
- TR 输出上线/回炉/继续迭代结论

## 13 TMA Build Bundle AutoContinue

目标：

- TMA 自动继续直到 `ready bundle`

必须包括：

- planner -> executor 自动串联
- 中断后恢复默认继续
- 不越权到 activation / dispatch

## 14 TMA Explicit Resume And Resumable Executor

目标：

- 把当前显式 `resumeTmaSession(...)` 收成正式能力

必须包括：

- planner 与 executor 分相可辨
- restore 后显式继续
- executor 可恢复过程态

## 15 TMA Delivery Artifacts And Quality Evidence

目标：

- 冻结 TMA 的正式交付物

必须包括：

- bundle
- smoke evidence
- rollback handle
- usage artifact
- dependency / version / config evidence

## 16 Cross-Agent Auto Chain And Human Gate Merge

目标：

- 把三者串成真正自动链

必须包括：

- reviewer -> TR -> TMA -> TR -> runtime
- human gate 合并策略
- 自动继续和中断点

## 17 Ordinary User Usable Surface

目标：

- 冻结面向普通用户的半透明前台

必须包括：

- 风险说明
- 当前层级展示
- 工具准备进度
- 模式和高级开关

## 18 TAP CMP MP Ready Interface Checklist

目标：

- 冻结后续 TAP/CMP/MP 联调的接口检查表

必须包括：

- section registry 对齐点
- reviewer/TR/TMA 的 section 消费位
- 仍未实现的占位和联调前提

## 19 End-To-End Final Closure And Report

目标：

- 产出最终收尾报告
- 明确哪些完成、哪些还只是占位

必须包括：

- 代码级完成定义
- 体验级完成定义
- 仍存风险
- 下一阶段建议

## 一句话收口

这包任务的目标，是把 TAP 从“已经很强的 runtime 控制面”正式收成“一套以 reviewer / tool_reviewer / TMA 为核心、15 视角冻结、普通用户可用、并准备好接 CMP / MP section 接口的正式 pool 样板”。
