# WP1: AgentSession

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `AgentSession` 模块，采用 `hot header + cold log` 思路，作为 `agent_core raw runtime kernel` 的会话容器层。

## 项目背景

- 当前仓库已有 `src/rax/**` 能力块，请不要侵入它们。
- 当前要做的是 `src/agent_core/**` 下的新 kernel。
- kernel 不是治理层，不是 packaging engine。
- `AgentSession` 的角色是长生命周期会话容器，不是 run loop 执行器。
- 当前性能方向明确要求：
  - `hot/cold split`
  - `event-first`
  - `tiered-checkpoint`

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `memory/current-context.md`
- `src/agent_core/types/**` 中被冻结的共享类型

## 你的任务

1. 在 `src/agent_core/session/` 下实现 `AgentSession` 相关结构和会话管理器。
2. 重点实现热头部（header）与冷日志引用的分离。
3. 让 session 只保存最小热索引，不保存巨型历史正文。
4. 为后续 `AgentRun` 和 `CheckpointStore` 提供稳定接口。

## 建议新增文件

- `src/agent_core/session/session-types.ts`
- `src/agent_core/session/session-manager.ts`
- `src/agent_core/session/session-header-store.ts`
- `src/agent_core/session/session-eviction.ts`
- `src/agent_core/session/session-manager.test.ts`

## 建议核心能力

- 创建 session
- 加载 session header
- 更新 session header
- 绑定 run 到 session
- 切换 active run
- 标记最近 checkpoint 引用
- 预留 session eviction / swap-out

## 边界约束

- 不要实现 run loop
- 不要实现 capability 调用
- 不要实现复杂 memory 系统
- 不要修改 `src/rax/**`
- 不要修改其他 WP 的目录
- 除非绝对必要，不要改共享 type freeze 文件；如缺字段，先报告

## 必须考虑的性能点

- session header 读写应尽量轻
- cold log 只存引用或外部定位信息
- 支持 lazy load
- 支持未来 eviction，但本任务不做复杂后台调度器

## 验证要求

- `npm run typecheck`
- 运行你新增的针对 session 的测试
- 覆盖：
  - create/load/update
  - active run 切换
  - checkpoint ref 更新
  - header 与 cold log 引用分离
  - eviction 后 header 仍可恢复索引

## 最终汇报格式

1. 你实现了哪些文件
2. `SessionHeader` 里最终保留了哪些热字段
3. 哪些内容被明确留在 cold log
4. 与 `AgentRun` / `CheckpointStore` 的接口约定是什么
5. 还有哪些地方需要后续联调时确认
