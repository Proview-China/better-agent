# WP8: EventJournal

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `EventJournal` 模块，作为 `agent_core raw runtime kernel` 的主事实源，采用 append-only 设计。

## 项目背景

- 当前设计明确：
  - `EventJournal` 是主事实源
  - summary 是派生层
  - checkpoint 是恢复加速层
- 性能方向要求：
  - `event-first`
  - `append-only`
  - `async flush`
  - `by runId / by correlationId` 索引
- 本任务是整个 kernel 的核心数据总线

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`

## 你的任务

1. 在 `src/agent_core/journal/` 下实现 append-only event log。
2. 提供 cursor 读取、按 runId 读取、按 correlationId 读取。
3. 提供 flush trigger，但不负责 durable checkpoint。
4. 明确 journal segment 与后续 compaction 的边界。

## 建议新增文件

- `src/agent_core/journal/journal-types.ts`
- `src/agent_core/journal/append-only-log.ts`
- `src/agent_core/journal/journal-index.ts`
- `src/agent_core/journal/journal-cursor.ts`
- `src/agent_core/journal/journal-flush-trigger.ts`
- `src/agent_core/journal/append-only-log.test.ts`

## 边界约束

- 不做 snapshot 持久化
- 不做 state 计算
- 不做 run loop 规则
- 不做 event upcasting engine
- 不做复杂 schema migration

## 必须考虑的性能点

- append 是热路径，必须尽量轻
- index 只建最必要的
- flush trigger 异步化
- cursor 读取高效
- event payload 尽量支持大对象引用，而非大对象内嵌

## 验证要求

- `npm run typecheck`
- 覆盖：
  - append-only 顺序性
  - cursor 读取
  - runId 索引
  - correlationId 索引
  - flush trigger
  - 多生产者追加场景下的顺序稳定性

## 最终汇报格式

1. 你实现了哪些文件
2. journal 的核心数据流是什么
3. 事实源与派生层如何分离
4. 索引策略是什么
5. 与 State / Run / Checkpoint 的接口关系是什么
