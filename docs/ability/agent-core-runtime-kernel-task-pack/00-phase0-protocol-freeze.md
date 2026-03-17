# Phase 0: Protocol Freeze

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

冻结 `agent_core raw runtime kernel` 的共享协议和类型，为后续 8 个并行 coding agent 提供稳定接口。

你是协议冻结负责人，不负责实现业务逻辑。

## 项目背景

- 这个仓库当前已有 `rax` 能力块，例如 `mcp`、`skill`、`websearch`，它们位于 `src/rax/**`。
- 当前要新建的是 `agent_core`，它不是治理层，不是 packaging engine，不是 context manager，而是最小 raw runtime kernel。
- 当前 kernel 已收口为：
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
- 当前性能方向已经定为：
  - `event-first`
  - `delta-state`
  - `queued-port`
  - `tiered-checkpoint`
  - `hot/cold split`

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `docs/master.md`
- `memory/current-context.md`

## 你的任务

1. 在 `src/agent_core/types/` 下建立共享协议与类型定义。
2. 冻结所有后续工作包都会依赖的最小接口。
3. 不实现具体 journal/state/run/port/checkpoint 逻辑。
4. 让类型“小而硬”，避免过早设计复杂框架。

## 建议新增文件

- `src/agent_core/types/kernel-events.ts`
- `src/agent_core/types/kernel-intents.ts`
- `src/agent_core/types/kernel-results.ts`
- `src/agent_core/types/kernel-state.ts`
- `src/agent_core/types/kernel-goal.ts`
- `src/agent_core/types/kernel-transition.ts`
- `src/agent_core/types/kernel-session.ts`
- `src/agent_core/types/kernel-run.ts`
- `src/agent_core/types/kernel-checkpoint.ts`
- `src/agent_core/types/index.ts`

## 你必须冻结的最小概念

- `KernelEvent`
- `KernelIntent`
- `KernelResult`
- `AgentStatus`
- `AgentPhase`
- `AgentState`
- `AgentStateDelta`
- `GoalFrameSource`
- `GoalFrameNormalized`
- `GoalFrameCompiled`
- `StepTransitionDecision`
- `CheckpointRecord`
- `SessionHeader`
- `RunRecord`
- `CapabilityPortRequest`
- `CapabilityPortResponse`

## 你必须至少定义这些事件类型

- `RunCreated`
- `RunResumed`
- `RunPaused`
- `RunCompleted`
- `RunFailed`
- `StateDeltaApplied`
- `IntentQueued`
- `IntentDispatched`
- `CapabilityResultReceived`
- `CheckpointCreated`

## 边界约束

- 不要修改 `src/rax/**`
- 不要写 `src/agent_core/run/**`、`state/**`、`journal/**` 等具体实现目录
- 不要做复杂 schema migration、event upcasting、CRDT、speculative execution
- 除非绝对必要，不要改动现有 docs 总纲

## 验证要求

- `npm run typecheck`
- 若需要，为类型模块补最小编译型测试
- 最终说明哪些类型是强冻结接口，哪些字段允许未来扩展

## 最终汇报格式

1. 你新增/修改了哪些文件
2. 你冻结了哪些核心类型
3. 哪些字段是必需的
4. 哪些字段是可选扩展
5. 你认为后续 8 个工作包最关键的接口依赖是什么
