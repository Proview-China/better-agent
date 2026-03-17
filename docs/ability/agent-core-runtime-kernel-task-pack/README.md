# Agent Core Runtime Kernel Task Pack

状态：并行编码任务包。

更新时间：2026-03-17

## 用途

这个目录里的文件，不是架构总纲，而是可直接发给独立 Codex 实例的任务说明书。

目标是为 `agent_core raw runtime kernel` 做并行开发准备。

## 任务背景

当前仓库已经有 `src/rax/**` 下的能力块 runtime，例如：

- `mcp`
- `skill`
- `websearch`

现在要新建的是 `src/agent_core/**` 下的 raw runtime kernel。

当前 kernel 已收口为：

- 5 个核心对象：
  - `AgentSession`
  - `AgentRun`
  - `AgentState`
  - `CapabilityPort`
  - `CheckpointStore`
- 3 条运行语义：
  - `GoalFrame`
  - `StepTransition`
  - `EventJournal`

当前性能方向已经定为：

- `event-first`
- `delta-state`
- `queued-port`
- `tiered-checkpoint`
- `hot/cold split`

## 执行顺序

不要直接 8 个 Codex 一起无脑开工。

当前更稳的顺序是：

1. `00-phase0-protocol-freeze.md`
2. 第一批并行：
   - `03-agent-state.md`
   - `06-goal-frame.md`
   - `07-step-transition.md`
   - `08-event-journal.md`
3. 第二批并行：
   - `04-capability-port.md`
   - `05-checkpoint-store.md`
4. 第三批：
   - `02-agent-run.md`
5. 第四批：
   - `01-agent-session.md`

## 文件列表

- `00-phase0-protocol-freeze.md`
- `01-agent-session.md`
- `02-agent-run.md`
- `03-agent-state.md`
- `04-capability-port.md`
- `05-checkpoint-store.md`
- `06-goal-frame.md`
- `07-step-transition.md`
- `08-event-journal.md`

## 统一要求

所有执行这些任务的 Codex 都应：

1. 先阅读：
   - `docs/ability/16-agent-core-runtime-kernel-outline.md`
   - `docs/master.md`
   - `memory/current-context.md`
2. 只在自己负责的目录下改动，避免和其他 WP 冲突。
3. 不要侵入 `src/rax/**` 的内部实现。
4. 新增实现时优先使用 TypeScript + Node.js 当前仓库基线。
5. 对接口变更保持克制；如果发现 `Phase 0` 冻结的类型不够用，应先明确说明。

## 一句话收口

这个目录是给并行 Codex 用的“开工包”，不是最终文档；总纲看 `16-agent-core-runtime-kernel-outline.md`，任务执行看这里。
