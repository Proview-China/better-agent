# Core And CMP Prompt Engineering Direction

状态：方向冻结文档 / 已对齐当前实现。

更新时间：2026-04-13

## 当前唯一目标

在 Praxis 已经有 `CMP`、`TAP`、`MP` 三个控制面的前提下，明确：

- `core` 应该固定预埋什么
- `CMP` 应该动态供给什么
- 两者之间的 handoff 为什么必须走最小 contract，而不是回到散文摘要

## 先说结论

Praxis 当前最合理的方向不是把更多动态上下文塞回 `core`，而是：

- `core` 继续做厚固定层和厚工作协议层
- `CMP` 继续做动态上下文治理和动态任务包供给层
- `core` 与 `CMP` 之间通过 `core-cmp-context-package/v1` 传递最小、结构化、可降级的上下文

一句白话：

- `core` 负责“主工怎么长期稳定工作”
- `CMP` 负责“当前现场怎么被整理成可执行包”

## 一、为什么 Praxis 不能直接照抄官方 prompt

很多官方 agent 的厚 prompt，同一时间承担了这些职责：

- 维护长上下文稳定
- 维护工具治理
- 维护任务状态
- 注入 memory / skills
- 做 continuation / compaction

但 Praxis 已经把这些职责拆开了：

- `CMP` 负责上下文治理
- `TAP` 负责能力治理
- `MP` 负责记忆和拓扑治理

所以如果把外部厚段整包搬进 `core`，结果通常不是“更强”，而是：

1. `core` 重新吞掉本来已经拆出去的职责
2. `CMP/TAP/MP` 的控制面意义被 prompt 本体抵消

## 二、当前代码已经证明的方向

当前代码里，`core` 和 `CMP` 的分层不是口头设计，已经有对应实现：

### 1. `core` 已经是分层 prompt，不再是单体段落

对应代码：

- `src/agent_core/core-prompt/system.ts`
- `src/agent_core/core-prompt/development.ts`
- `src/agent_core/core-prompt/live-chat-assembly.ts`

其中 `buildLiveChatPromptMessages(...)` 已经把 live prompt 分成：

- `system`
- `developer`
- `user`

这说明方向已经从“单体 instructionText”切到“可组合层”。

### 2. `CMP` 已经通过结构化 package 回流到 `core`

对应代码：

- `src/agent_core/core-prompt/types.ts`
- `src/agent_core/core-prompt/live-chat-contextual.ts`
- `src/agent_core/core-prompt/contextual.ts`
- `src/agent_core/live-agent-chat.ts`

当前回流形状已经是 `core-cmp-context-package/v1`，而不是自由散文。当前结构包括：

- `identity`
- `objective`
- `payload`
- `governance`
- `deliveryStatus`

### 3. `core` 已经把“怎么消费 CMP”放进协议层，而不是临时发挥

对应代码：

- `src/agent_core/core-prompt/development.ts`

当前 `createCoreCmpHandoffLines(...)` 已经把 core 端消费规则写成开发层纪律：

- `available` 时，把 CMP 当作当前可执行上下文
- `partial` 时，保守使用并先核关键事实
- `pending/skipped/absent` 时，不把 CMP 当权威来源
- 任意状态下，都不能覆盖显式用户目标

这意味着 handoff 现在已经不是“有没有包”，而是“包能被怎样信任和降级”。

## 三、Praxis 里 `core` 应该固定承担什么

### 1. `core-system`

它负责长期不轻易变化的主工宪法：

- 主工身份
- 与 `CMP/TAP/MP` 的根关系
- truthfulness contract
- 长期禁止项
- continuation / recoverability

它不应该承担：

- 当前任务现场
- 当前 CMP 包正文
- 当前 capability inventory 正文
- 当前工具结果正文

### 2. `core-development`

它负责长期工作协议：

- objective anchoring
- workflow protocol
- validation ladder
- context economy
- continuation / compaction
- capability window discipline
- CMP handoff discipline

它也不应该承担：

- 当前 transcript
- 当前 inventory 列表
- 每个 capability 的长 schema
- 当前 CMP 原始包细节

### 3. `core-contextual-user`

它允许现场进入 `core`，但必须是结构化、可替换、可降级的现场。

适合进入这层的：

- 当前 objective
- `CMP` package
- `TAP` capability window
- latest tool result
- grounding evidence
- task-specific constraints

不适合常驻这层的：

- 大量 raw history
- 大量 raw memory
- capability manual 正文

## 四、Praxis 里 `CMP` 应该动态承担什么

`CMP` 在 Praxis 里不是“补背景的附属件”，而是动态上下文治理位。

它应该持续承担：

- 当前工作现场整理
- timeline / lineage 压缩
- 高信噪比 package 供给
- route / scope / checker 等治理信息供给
- passive historical return
- future recall 准备

一句白话：

`CMP` 不是负责“多塞点历史”，而是负责“把现在最值得给主工的现场整理干净再交过去”。

## 五、为什么 `core-CMP` 之间必须冻结正式 contract

如果没有正式 contract，`core` 迟早会重新滑回两种坏状态：

1. 把 `CMP` 当散文摘要来读
2. 遇到缺字段或陈旧包时，临场脑补消费规则

这在当前实现里已经没有必要，因为代码已经具备三件事：

### 1. 包形状已经结构化

`types.ts` 已经定义了 `identity/objective/payload/governance/deliveryStatus`。

### 2. producer 已经会推断交付状态

`live-chat-contextual.ts` 已经会从 `CmpTurnArtifacts` 推断：

- `available`
- `partial`
- `pending`
- `skipped`
- `absent`

并且同步给出：

- `confidenceLabel`
- `freshness`

### 3. core 端已经有状态化消费纪律

`development.ts` 已经按 `deliveryStatus` 区分信任强度和降级路径。

所以当前最合理的动作，不是再写更多方向话术，而是把已经存在的事实冻结成正式 contract。

## 六、这次 contract 应该冻结什么，不应该冻结什么

### 应该冻结的

- `identity/objective/payload/governance/deliveryStatus` 的最小语义
- `available/partial/pending/skipped/absent` 的明确含义
- core 端消费优先级
- 缺字段、陈旧、跳过时的降级纪律

### 不应该冻结成空中楼阁的

- 当前代码还没产出的新字段
- 还没存在的复杂状态机
- 还没落地的 deep overlay / manifest producer 细节
- 假设 `CMP` 已经会提供完整 `primaryContext/constraints/risks/sourceAnchorRefs`

一句白话：

这次冻结的是“当前能稳定说清楚并且代码已经在做的那部分”，不是替未来版本抢写设计。

## 七、基于当前实现的方向冻结

截至 2026-04-13，可以先冻结下面几条：

1. `core` 不再回到单体 prompt 路线。
2. `CMP` 回流给 `core` 的主路径必须优先走结构化 package。
3. `deliveryStatus` 不是展示字段，而是 core 端消费纪律的开关。
4. 显式用户目标始终高于 `CMP.requested_action`。
5. `partial/pending/skipped/absent` 都必须有正式降级语义，不能让 core 自己脑补。

## 八、与 Task Pack F 的关系

Task Pack F 这轮真正要交付的，不是更多 prompt 理论，而是把上面的方向落成正式 handoff contract。

对应文档：

- [78-core-cmp-bfg-implementation-status-and-handoff.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/78-core-cmp-bfg-implementation-status-and-handoff.md:1)
- [80-core-cmp-handoff-contract-v1.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/80-core-cmp-handoff-contract-v1.md:1)

## 一句话收口

Praxis 当前正确的路线不是让 `core` 更会自己整理上下文，而是让 `CMP` 更会把上下文整理成一个可被 `core` 稳定消费、稳定降级的最小 contract。
