# WP3: AgentState

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `AgentState` 模块，作为 `agent_core raw runtime kernel` 的小型、结构化、可序列化 state 层，并默认采用 `state_delta` 更新。

## 项目背景

- 当前 kernel 强调：
  - `event-first`
  - `delta-state`
- `AgentState` 不是 history，不是 memory，不是巨型 JSON 容器
- 它应当是事件驱动下的 materialized view / scratchpad
- 推荐结构已定为：
  - `control`
  - `working`
  - `observed`
  - `recovery`

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`

## 你的任务

1. 在 `src/agent_core/state/` 下实现 state 类型、state delta、state projector、state validator。
2. 让 state 的更新默认通过 delta merge。
3. 明确什么可以进 state，什么不能进 state。
4. 让 state 能从 journal event 序列或 delta 序列恢复。

## 建议新增文件

- `src/agent_core/state/state-types.ts`
- `src/agent_core/state/state-delta.ts`
- `src/agent_core/state/state-projector.ts`
- `src/agent_core/state/state-validator.ts`
- `src/agent_core/state/state-projector.test.ts`

## 边界约束

- 不要把完整 history 嵌进 state
- 不要放 provider SDK 对象
- 不要实现 CRDT
- 不要实现复杂 memory graph
- 不要改别的 WP 目录

## 必须考虑的性能点

- delta merge 要轻量
- state 要稳定可序列化
- derived 信息应与核心 state 分离
- 大 observation / artifact 只存引用或摘要

## 验证要求

- `npm run typecheck`
- 覆盖：
  - create initial state
  - delta merge
  - invalid delta reject
  - event -> state projection
  - observed / recovery 区隔离
  - state serialization

## 最终汇报格式

1. 你实现了哪些文件
2. state 的四区结构最终长什么样
3. delta merge 的关键规则是什么
4. 哪些信息被明确禁止进入 state
5. 与 journal / transition 的接口契约是什么
