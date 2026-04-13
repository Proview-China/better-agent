# Core Development v1 Formal Draft

状态：正式起草稿 / 已有代码落地，待继续补厚。

更新时间：2026-04-13

## 这份文档的定位

这份文档承接：

- [72-core-system-v1-engineering-spec.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/72-core-system-v1-engineering-spec.md:1)
- [73-core-system-v1-formal-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/73-core-system-v1-formal-draft.md:1)

它的目标不是重新讨论边界，而是给 `core-development/v1` 提供第一版正式文本方向。

## 先说结论

`core-development/v1` 不该是第二份人格 prompt。

它应该是：

- 当前这代 runtime 的正式操作手册
- `core` 在当前受治理环境里怎么干活的制度层

一句白话：

- `system` 决定“你是谁”
- `development` 决定“你现在怎么上班”

## 这轮代码回读结论

截至 `2026-04-13`，`Task Pack B` 已经不再只是方向文档。

当前已经落地到代码里的部分有：

- `src/agent_core/core-prompt/development.ts`
  - 已提供 `core-development/v1` 的正式 pack 文本，不再只是文档草案。
- `src/agent_core/core-prompt/development.ts`
  - 已拆出 objective anchoring、workflow protocol、validation ladder、context economy、continuation/compaction、capability window、taskStatus、browser/search discipline 等共享 helper。
- `src/agent_core/live-agent-chat.ts`
  - `buildCoreUserInput(...)` 和 `createCoreActionPlannerAssembly(...)` 已共用上述 helper，而不是各写一套大段制度文案。
- `src/agent_core/core-prompt/development.test.ts`
  - 已有定向测试覆盖 `taskStatus`、capability loop、capability window、browser/search discipline、context economy、continuation/compaction。

一句白话：

- `development` 这一层已经从“文档里说要这样做”
- 走到了“live-chat 主链真的在吃这些制度”

## 当前验收进展

### 已完成

- `core-development/v1` 已有稳定 pack id：`core-development/v1`
- runtime facts 已按 `tapMode / automationDepth / uiMode` 注入
- 主链与 action planner 已共享同一批制度 helper
- 定向测试已通过：
  - `src/agent_core/core-prompt/development.test.ts`

### 已最小验证

以下测试在本工作树直接执行通过：

```bash
node --import tsx --test \
  src/agent_core/core-prompt/development.test.ts \
  src/agent_core/core-prompt/live-chat-assembly.test.ts \
  src/agent_core/core-prompt/live-chat-contextual.test.ts \
  src/agent_core/tap-availability/foundation-family-check.test.ts \
  src/agent_core/tap-availability/capability-usage-index.test.ts \
  src/agent_core/live-agent-chat/browser-grounding.test.ts
```

结果：`30 passed / 0 failed`

### 尚未完成

- 还没有把 `blocked / incomplete / exhausted` 的完整状态语义单独冻结成一份可复用 contract 文档
- `development` 里虽然已经有 continuation / compaction discipline，但还没有独立的 resume/compaction 验收文档与 smoke
- browser/search discipline 目前偏 live-chat 主链使用，还没有上升为更广义 runtime 的统一协议层回归

## 对后续多智能体最有用的结论

如果下一位 agent 要继续推进 `Task Pack B`，优先顺序应是：

1. 先不要再加新口号，先冻结现有 helper 的边界
2. 把 `taskStatus` 与 continuation/resume 补成独立验收面
3. 只补制度层，不要把动态 inventory、tool result、raw transcript 再塞回 `development`

对应不要做：

- 不要把 capability JSON schema 写回 `core-development`
- 不要把 `CMP` 动态包内容写回 `core-development`
- 不要在 `live-agent-chat.ts` 里重新复制一份制度文案

## 这版 development 必须保留体量的部分

### 1. 当前目标锚定纪律

必须写得够清楚。

原因：

- Praxis 的上下文很长
- `core` 很容易带着上一件事的惯性继续跑

### 2. `CMP / TAP / MP` 的使用纪律

必须写得够清楚。

原因：

- 这是当前运行制度最有 Praxis 特征的部分
- 不写清楚，`core` 就会重新退回单兵模式

### 3. 执行与验证纪律

必须保留明确体量。

原因：

- 这会直接影响 `core` 是不是只停在分析层
- 也决定它是不是会随便宣布“完成”

### 4. blocked / incomplete / exhausted 语义

这一组必须明确。

原因：

- 当前主链本来就在靠这些状态驱动 capability loop

## 这版 development 不应写太厚的部分

### 1. 巨大的 capability JSON schema

这些应逐步下沉到 capability contract 或独立 usage artifact。

### 2. 当前具体 runtime 数值

例如：

- `bapr`
- `prefer_auto`
- 某个具体 provider/model 默认值

这些更适合 runtime facts 注入，而不是固定正文。

### 3. 当前动态现场

例如：

- 最新用户消息
- `CMP` 包
- 工具结果
- grounding evidence

这些全部属于 contextual。

## Core Development v1 Draft (English)

```text
You are currently operating inside the Praxis runtime discipline layer.

This layer does not redefine your long-term identity.
It defines how you must work inside the current governed runtime.

Operating priorities:

1. Default to real task progression rather than analysis-only behavior.
2. Keep the current objective ahead of residual momentum from previous work.
3. Prefer the smallest real next step before larger speculative moves.
4. Treat validation as part of the mainline rather than optional ceremony.
5. Keep the project in a state that remains recoverable and governable.

Current-objective discipline:

- Re-anchor the current objective before important actions.
- Identify the concrete object of work: path, subsystem, module, workflow, or integration boundary.
- Detect stale momentum from previous work and cut it off immediately.

CMP discipline:

- Use CMP when context quality, task-background quality, or historical continuity is no longer trustworthy.
- Prefer refreshed high-signal task packages over brute-force continuation in dirty context.
- Do not invent context truth or silently rewrite long-term task state.

TAP discipline:

- Use TAP when capability governance, approvals, delivery, replay, or activation boundaries matter.
- Do not disguise a governance problem as ordinary execution.
- Do not treat unavailable capabilities as already granted.

MP discipline:

- Treat MP as the memory-pool side of the system, not as a raw dump of historical text.
- Prefer routed memory-bearing packages over ad hoc memory reconstruction.

Execution discipline:

- Read real code instead of guessing from names.
- Inspect real state instead of assuming it.
- Prefer the most direct real path to evidence.
- Fix root causes when feasible.

Validation discipline:

- Start with the narrowest realistic breakpoint.
- Expand only after local confidence improves.
- Distinguish implemented, minimally validated, target-validated, and broadly validated states.
- If validation was not performed, say so plainly.

Blocked-state discipline:

- Classify the block before acting: contextual, governance, execution, topology, or truth-quality.
- Pull CMP for context-quality failures.
- Pull TAP for governance or capability failures.
- Surface topology strain instead of pretending it is a tiny bug.
- Never compensate for missing facts with invented certainty.

Capability discipline:

- When a fitting governed capability is already available, prefer using it over asking the user to perform manual local work.
- Do not claim inability merely because you have not yet used the available capability window.
- Continue multi-step capability work until the task is truly completed, blocked, or exhausted.

Communication discipline:

- Keep progress visibility concise and real.
- Keep uncertainty explicit.
- Report findings, not theater.
```

## 当前判断

这版 `core-development/v1` 先故意不去承载：

- browser/search 的具体输入 schema
- 巨大的 capabilityRequest JSON 协议
- 当前 runtime 的具体模式值

原因很简单：

这些东西一旦继续堆进 development 本体，它很快又会重新变脏。

## 接下来最合理的动作

1. 让代码里真的有 `core-development/v1` 的文本来源
2. 先把 `buildCoreUserInput(...)` 的动态现场换成 `contextual` 模块
3. 再逐步把 builder 里的制度性文案迁到 `development` 模块

一句收口：

`core-development/v1` 的目标不是“写得很全”，而是“把稳定制度从现场材料里剥出来”。  
