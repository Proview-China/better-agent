# WP5: CheckpointStore

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `CheckpointStore` 模块，作为 `agent_core raw runtime kernel` 的恢复加速层，采用 `event + snapshot` 混合恢复模式。

## 项目背景

- 当前设计明确：
  - `EventJournal` 是主事实源
  - `CheckpointStore` 是恢复加速层
- 性能方向要求：
  - `tiered-checkpoint`
  - `fast checkpoint + durable checkpoint`
- 本任务不做分布式一致性，只做本地可恢复设计

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`
- `src/agent_core/journal/**`
- `src/agent_core/state/**`

## 你的任务

1. 在 `src/agent_core/checkpoint/` 下实现 checkpoint 分层存储。
2. 支持：
  - fast checkpoint
  - durable checkpoint
  - journal offset
  - resume pointer
  - snapshot load/save
3. 提供从 checkpoint + journal 恢复 run 的能力。

## 建议新增文件

- `src/agent_core/checkpoint/checkpoint-types.ts`
- `src/agent_core/checkpoint/checkpoint-store.ts`
- `src/agent_core/checkpoint/checkpoint-fast.ts`
- `src/agent_core/checkpoint/checkpoint-durable.ts`
- `src/agent_core/checkpoint/checkpoint-recovery.ts`
- `src/agent_core/checkpoint/checkpoint-store.test.ts`

## 边界约束

- 不要接数据库集群
- 不要改 `EventJournal` 的事实源定义
- 不要实现复杂 WAL 管理平台
- 不要承担 state 业务逻辑判断

## 必须考虑的性能点

- fast checkpoint 轻量高频
- durable checkpoint 稀疏关键点写入
- snapshot + events 恢复路径清晰
- 尽量异步提交，不阻塞热路径

## 验证要求

- `npm run typecheck`
- 覆盖：
  - fast checkpoint write/read
  - durable checkpoint write/read
  - journal offset 对齐
  - snapshot + replay 恢复
  - crash-like recovery 场景

## 最终汇报格式

1. 你实现了哪些文件
2. fast / durable 是怎么分层的
3. checkpoint 里到底保存哪些字段
4. 恢复时如何与 `EventJournal` 配合
5. 哪些点需要联调验证
