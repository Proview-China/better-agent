# TAP Wave 0-1 Availability Baseline

状态：已落地代码与测试，不再只是任务拆解。

更新时间：2026-03-25

## 这次真正落下了什么

这次把 TAP production closure 的 `Wave 0 -> Wave 1` 先收成了一套可运行的 availability 基线。

对应到任务包，就是：

- `00-program-control-and-definition-of-done`
  - 先不去碰 durable 主链，优先补 availability 层
- `01-capability-availability-truth-table`
  - 已有统一 truth table 代码入口
- `02-formal-family-inventory-and-registration-audit`
  - 已有 formal family inventory 和 live registration audit 入口
- `03-health-smoke-report-contract`
  - 已有统一 contract 和 report 生成入口

一句白话：

- TAP 现在已经不只是“有几组 capability family”
- 而是已经有一层正式的“清点表 + 契约层 + 审计入口”

## 这次新增/收口的代码入口

### 1. TAP availability 核心层

位于：

- [availability-types.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/availability-types.ts)
- [availability-contract.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/availability-contract.ts)
- [formal-family-inventory.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/formal-family-inventory.ts)
- [availability-audit.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/availability-audit.ts)
- [index.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/index.ts)

这一层现在负责：

- formal family inventory
- package verification contract 归一化
- availability truth table
- availability report

### 2. Family assembly / tooling register helper 对齐

位于：

- [tap-capability-family-assembly.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/integrations/tap-capability-family-assembly.ts)
- [tap-tooling-adapter.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/integrations/tap-tooling-adapter.ts)

现在这两处已经能提供：

- family key 冻结
- registration audit
- activation factory audit
- bootstrap tooling registration result

这一层现在的作用是：

- 把 formal family 的装配结果变成结构化审计信息
- 让 `tap-availability/*` 可以直接站在 assembly audit 之上生成 truth table 和 report

## 当前已被这层正式覆盖的 formal family

- `foundation`
- `websearch`
- `skill`
- `mcp`

## 当前这层已经能回答的问题

- formal family 各自有哪些 capability
- 每个 capability 来自哪个 package source
- 由哪个 register helper 接入
- activation factory 是否声明
- prepare / execute / health / smoke / evidence contract 是否齐全
- 当前是否已观察到 registration / binding / health
- 当前 gate 是 `ready / review_required / blocked`

## 验证结果

这次在 `reboot-merge` 上已验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 这一步还没有做什么

这一步还没有进入这些内容：

- pending-closure capability 的完整 backlog 审计
- reviewer / tool_reviewer / TMA 的 durable closure
- activation / replay / human gate 的崩溃恢复闭环
- production closure 最终报告

所以它当前的真实定位是：

- `Wave 0-1 baseline is now code-backed`
- 但还不是整个 TAP production closure 的最终完成

## 下一步最自然的接力点

从这里继续，最顺的顺序是：

1. 用 availability live audit 先检查 formal family 当前到底哪里还不够 production-like
2. 再做 half-wired / pending-closure backlog 统一审计
3. 再推进 reviewer / tool_reviewer / TMA 的 durable 收口

## 一句话收口

这次已经把 TAP production closure 的第一段地基真正写进了代码：formal family inventory、health/smoke/report contract、以及 live availability audit 入口都已经存在并通过验证，后面所有 Wave 2+ 的检查和 durable 收口都可以直接站在这层之上继续推进。
