# Nine-Agent Prompt Engineering Overview

## Current Goal

当前唯一目标不是立刻把 prompt 全量接进 runtime，而是先把 Praxis 当前 `1 + 3 + 5` 的九个 agent 提示词工程做成可联调、可逐轮收敛的 docs-first 草案。

这一轮的对象是：

- `1` 个 `core`
- `3` 个 TAP agent
- `5` 个 CMP agent

## Architecture Anchor

这轮 prompt engineering 必须严格遵守下面这个锚点：

- `core` 不是纯 orchestration manager
- `core` 是真正干活的主 agent，本质目标是像 Codex 一样完成复杂任务
- `CMP / TAP / MP` 是围绕 `core` 提供服务、约束、治理、上下文整形、能力交付的控制面

一句白话：

- `core` 是真正负责把项目任务做掉的人
- `CMP / TAP / MP` 负责把 `core` 服务好、限制好、增强好

## Role Families

### 1. Core

- `core` 是主 agent
- 它既是老板，也是打工人
- 它对项目结果负责
- 但它不能绕开 `CMP / TAP / MP`

### 2. TAP

- TAP 是治理和能力控制面
- reviewer 负责风险判断与治理裁决
- tool_reviewer 负责 reviewer 与 TMA 之间的桥接、工具治理与状态管理
- TMA / provisioner 负责造包、交付、验证摘要、回放建议

### 3. CMP

- CMP 是上下文与任务推进服务层
- `dbagent` 是 CMP 内部核心，因为它负责高信噪比上下文、package truth、timeline/task snapshot/passive reply 的组织
- 其余角色围绕 ingress、git progression、checked review、routing 等环节服务 `core`

## Prompt Engineering Principles

这轮九个 agent 的 prompt 工程统一遵守：

1. 先定义身份，再定义能力，再定义禁止项。
2. 先写角色边界，再写产出格式，不要反过来。
3. system prompt 只负责长期稳定的宪法，不负责临时任务说明。
4. 能放到 runtime contract / structured output schema 里的，不塞进 prompt 里硬扛。
5. 所有 prompt 都要明确：
   - 自己服务谁
   - 自己不能替代谁
   - 自己何时停下并交接
6. `core` 的 prompt 不能写成纯调度器 prompt。
7. TAP / CMP 的 prompt 不能抢 `core` 的主任务执行权。

## Draft Layout

这轮 docs-first 草案分成三份：

- [60-core-agent-system-prompt-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/60-core-agent-system-prompt-draft.md)
- [61-tap-three-agent-system-prompts-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/61-tap-three-agent-system-prompts-draft.md)
- [62-cmp-five-agent-system-prompts-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/62-cmp-five-agent-system-prompts-draft.md)

## Review Checklist

每个角色的草案至少要过这几个问题：

1. 它的身份是不是说清楚了？
2. 它是不是明确服务 `core`，而不是抢 `core` 的活？
3. 它和相邻角色的 handoff 是否清楚？
4. 它的禁止项是不是够硬？
5. 它的 prompt 有没有把“长期宪法”和“短期任务提示”混在一起？
6. 它是不是还保留了现在 runtime contract 里真正重要的结构化边界？

## Expected Next Step

这一轮完成后，不直接宣称 prompt 定稿。

正确流程应是：

1. 出三份第一版草案
2. 由用户逐条把关
3. 收敛成第二版
4. 再决定哪些部分进入源码、哪些部分仍留在 docs 里继续磨
