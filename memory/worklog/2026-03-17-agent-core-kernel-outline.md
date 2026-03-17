# 2026-03-17 Agent Core Kernel Outline

## 本次结论

- 当前 `agent_core` 的第一优先级，不是治理层，不是包装机总机制，而是 `raw runtime kernel`。
- `agent_core` 先收成：
  - `AgentSession`
  - `AgentRun`
  - `AgentState`
  - `CapabilityPort`
  - `CheckpointStore`
- 同时明确 3 条必须存在的运行语义：
  - `GoalFrame`
  - `StepTransition`
  - `EventJournal`

## 当前更稳的判断

- 一个最小 agent 是否成立，不看能力多少，而看是否同时具备：
  - 持续身份
  - 目标锚定
  - 动态推进
  - 外部作用
  - 暂停恢复
  - 历史留存
- `summary` 不能取代 `history`：
  - `history` 是事实层
  - `summary` 是压缩层
  - `pointer` 是恢复锚点
- `Context Manager`、`Packaging Engine`、`Policy`、`Topology` 这批内容当前仍视为治理层，不进入 raw kernel 本体。
- kernel 当前还新增了 5 条高性能导向：
  - `event-first`
  - `delta-state`
  - `queued-port`
  - `tiered-checkpoint`
  - `hot/cold split`
- 当前建议的对象级性能收口：
  - `AgentSession` -> `hot header + cold log`
  - `AgentRun` -> `single decision lane + async execution lanes`
  - `AgentState` -> `small structured state + state_delta`
  - `CapabilityPort` -> `broker + queue + cache + backpressure`
  - `CheckpointStore` -> `fast checkpoint + durable checkpoint`

## 与现有 rax 的关系

- `rax` 当前已有多个能力块 runtime：
  - `mcp`
  - `skill`
  - `websearch`
- 这些能力块不应被 `agent_core` 重写。
- `agent_core` 只应通过统一插槽调它们，而不是接管它们的 provider lowering 和内部生命周期。

## 本次新增文档

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/README.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/00-phase0-protocol-freeze.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/01-agent-session.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/02-agent-run.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/03-agent-state.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/04-capability-port.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/05-checkpoint-store.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/06-goal-frame.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/07-step-transition.md`
- `docs/ability/agent-core-runtime-kernel-task-pack/08-event-journal.md`

## 下一步

1. 先细化 `AgentRun + AgentState + GoalFrame`
2. 再细化 `StepTransition`
3. 然后定义 `CapabilityPort` 协议
4. 最后再进入 `topology / io / ooa / autonomy` 的治理层细化
5. 当前也已可按任务包顺序分发给多个 Codex 并行实现
