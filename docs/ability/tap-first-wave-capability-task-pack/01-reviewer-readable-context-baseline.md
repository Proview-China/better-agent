# 01 Reviewer Readable Context Baseline

## 任务目标

把 reviewer 的最小只读基线从 placeholder-only 推进到“至少能看到真实可读摘要”，但仍保持 reviewer 不执行。

## 必须完成

- 补齐 reviewer 可读上下文的正式槽位语义：
  - `project.summary.read`
  - `inventory.snapshot.read`
  - `memory.summary.read`
- 明确 reviewer 当前可读内容来自哪里：
  - 项目摘要
  - 当前 capability inventory
  - 记忆摘要占位或真实摘要桥
- 在 `reviewer-runtime` 中把 placeholder 和 ready 状态明确区分
- 补 reviewer 输入封装测试，证明 reviewer 看见的上下文不再只是硬编码默认文本

## 允许修改范围

- `src/agent_core/ta-pool-context/**`
- `src/agent_core/ta-pool-review/**`
- `src/agent_core/runtime.test.ts`

## 不要做

- 不要给 reviewer 写权限
- 不要接 shell
- 不要把 CMP/MP 真后端硬耦合进来

## 验收标准

- reviewer 仍只审不执行
- reviewer 至少能看到真实 inventory 摘要
- placeholder 与 ready 状态在测试里可区分

## 交付说明

- 明确哪些输入仍是 placeholder
- 明确后续可由 `CMP/MP/Memory` 提供的坑位
