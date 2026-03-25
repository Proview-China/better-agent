# TAP Final Closure Handoff Prompt

下面这段 prompt 是给压缩上下文后的新会话用的。

直接复制给新的 Codex 即可：

---

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

当前唯一目标：
继续推进 `TAP` 的 final closure，不要串到 `CMP / MP` 或别的 pool。

先锚定对象：

- 主工作树不是这次的开发现场
- 真正开发线在：
  `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge`
- 目标分支：
  `reboot/blank-slate`

当前远端最新 TAP 提交已经推进到：

- `44d7a4a`
- 提交主题：
  `推进 TAP Wave18 第二批终态收口与 TMA 显式恢复入口`

当前已经真实成立的阶段：

1. `Wave 0-1 availability baseline`
2. `Wave 2 formal family availability checks`
3. `Wave 3 backlog / taxonomy / gating`
4. `Wave 4-5 durable lane baseline`
5. `Wave 4-5` 后半段：
   - `tool_reviewer` 开始真实接入 runtime 主链
   - `resumeTaEnvelope(...)` 已成立
   - recover + hydrate + run/session/control-plane 恢复接缝已成立
6. `Wave 18` 第一批：
   - replay resume activation-fail short-circuit
   - malformed envelope / manual replay / governance-only / boundary tests
7. `Wave 18` 第二批：
   - human-gate 完成态收口
   - reviewer durable `completed`
   - `applyTaCapabilityLifecycle(...)`
   - `tool_reviewer` lifecycle blocked
   - `resumeTmaSession(...)`

当前已验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
  - 当前 `agent_core`：`321 pass / 0 fail`
- `npm test`
  - 当前仓库级：`199 pass / 0 fail / 1 skipped`

当前最关键的新总纲文档：

- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/48-tap-final-closure-and-three-agent-outline.md`

当前最关键的新任务包：

- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/tap-final-closure-task-pack/README.md`

当前还需要记住的旧状态文档：

- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/46-tap-wave4-wave5-durable-lanes-and-hydration.md`
- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/47-tap-wave18-negative-boundary-first-batch.md`

当前项目内记忆：

- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/memory/current-context.md`
- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/memory/worklog/2026-03-25-tap-wave45-late-half-runtime-resume.md`

当前已经和用户明确冻结的核心方向：

- 三种正式 agent 就是：
  - `reviewer`
  - `tool_reviewer`
  - `TMA`
- 三者都是独立可恢复 runtime
- `reviewer` 审主 agent 的行为
- `tool_reviewer` 审工具意图与持续治理
- `TMA` 只造工具
- 除人工门槛外，后链尽量自动继续
- `human gate` 是主要人工门槛
- 多重人工门尽量由 reviewer 合并成一次人类决策
- 15 种视角这次必须冻结成正式矩阵
- 结构是：
  - 一张共享总矩阵
  - reviewer / TR / TMA 三种映射
- 规则对象挂在 `TAP pool object`
- 策略实例化走双层：
  - 工作区级
  - 任务/会话级
- `CMP / MP` 在这轮是接口级强依赖
  - 要留 section 注册表接口坑位
  - 但当前实现先保留占位
- 面向普通用户：
  - 前台半透明
  - 默认暴露审批与自动化开关
  - 允许覆写工具策略和部分 agent 规则解释

当前三个 agent 的 baseline / 输出也已经冻结：

- `reviewer`
  - baseline：中等厚度，包含读取、搜索、测试
  - 输出：机器决策 + 白话解释
  - 入口策略：baseline + 一部分普通读操作可快路由，其它基本进 reviewer
- `tool_reviewer`
  - baseline：中厚治理基线，只针对工具/能力
  - 输出：持续治理计划 + 结构化任务单
  - 默认能拍板大多数工具治理，但受 15 视角约束
  - 可主动发起治理
- `TMA`
  - baseline：三者中最厚，施工/安装/下载默认都给
  - 输出：结构化 bundle + 质检证据
  - 恢复后默认自动继续，直到 `ready bundle`
  - 不自动 activation / dispatch 原任务

当前下一阶段不是直接写代码乱补，而是：

1. 先基于 `48` 和 task-pack README 再核一遍方向
2. 再决定要先做哪一个 wave
3. 然后继续多智能体开发

如果要继续实际开发，推荐顺序：

1. `00`
2. `01-03`
3. `04-06`
4. 然后分 reviewer / TR / TMA 三条线推进

注意事项：

- 不要碰 `cmp/mp` 主工作树代码现场
- 只在 `reboot-merge` 上工作
- 继续用多智能体，但不要递归失控
- 一个阶段完成就 commit + push
- 主控负责联调、测试、冲突控制和最终收口

---
