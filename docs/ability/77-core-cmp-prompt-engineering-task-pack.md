# Core CMP Prompt Engineering Task Pack

状态：任务清单 / 已补入 B/F/G 实现读回。

更新时间：2026-04-13

## 当前唯一目标

把 [76-core-cmp-prompt-engineering-direction.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/76-core-cmp-prompt-engineering-direction.md:1) 拆成一份可以直接分发给多智能体的正式任务包文档。

这份文档只做三件事：

1. 明确任务簇
2. 明确依赖顺序
3. 明确每个任务包的产物与验收

## 先说结论

后续任务不应再按“文件归属”拆。

更适合按下面四大簇来拆：

1. `core` 固定层
2. `CMP` 动态层
3. `core-CMP` 接缝
4. 验证与回归

一句白话：

- 先把 `core` 哪些必须顶死做好
- 再把 `CMP` 哪些应该持续动态负责做好
- 再把两边 handoff 做顺
- 最后再做验证和回归

## 这轮实现快照

这轮已经回读到真实落地结果的任务包只有三块：

- `Task Pack B`
- `Task Pack F`
- `Task Pack G`

当前状态一句话：

- `B`：已落地到 `development.ts + live-agent-chat.ts`，且有定向测试
- `F`：已落地到结构化 `CMP package + layered prompt assembly`，但 contract 还没完全冻结
- `G`：已落地 `overlay index + minimal skill/memory producers`，并已接入 live path

统一测试结论：

```bash
node --import tsx --test \
  src/agent_core/core-prompt/development.test.ts \
  src/agent_core/core-prompt/live-chat-assembly.test.ts \
  src/agent_core/core-prompt/live-chat-contextual.test.ts \
  src/agent_core/core-prompt/live-chat-overlays.test.ts \
  src/agent_core/core-prompt/overlays.index.test.ts \
  src/agent_core/tap-availability/foundation-family-check.test.ts \
  src/agent_core/tap-availability/capability-usage-index.test.ts \
  src/agent_core/live-agent-chat/browser-grounding.test.ts
```

结果：`35 passed / 0 failed`

## 一、总依赖图

### Level 0：当前基线

这是已经存在的基线，不再重复实现：

- [69-cmp-role-workmode-prompt-design.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/69-cmp-role-workmode-prompt-design.md:1)
- [72-core-system-v1-engineering-spec.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/72-core-system-v1-engineering-spec.md:1)
- [73-core-system-v1-formal-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/73-core-system-v1-formal-draft.md:1)
- [74-core-prompt-assembly-v0-design.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/74-core-prompt-assembly-v0-design.md:1)
- [75-core-development-v1-formal-draft.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/75-core-development-v1-formal-draft.md:1)
- [76-core-cmp-prompt-engineering-direction.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/76-core-cmp-prompt-engineering-direction.md:1)

### Level 1：必须先完成

- `Task Pack A`: `core-system` 加厚与冻结
- `Task Pack B`: `core-development` 加厚与冻结
- `Task Pack C`: `core-contextual` 结构化与 on-demand 入口

### Level 2：可并行推进

- `Task Pack D`: `CMP dynamic package quality`
- `Task Pack E`: `CMP prompt variant governance`
- `Task Pack F`: `core-CMP handoff contract`

### Level 3：在上面基本稳定后推进

- `Task Pack G`: `memory / skills / capability` 索引化与按需加载
- `Task Pack H`: `continuation / compaction / resume` 协议
- `Task Pack I`: `layered message assembly` 深化与统一入口

### Level 4：收口

- `Task Pack J`: 验证、回归、smoke、对照与冻结

## 二、任务包拆分

## Task Pack A：`core-system` 加厚与冻结

### 目标

把 `core-system/v1` 从当前 formal draft 推到真正可冻结版本。

### 范围

- 主工身份
- 与 `CMP / TAP / MP` 的根关系
- truthfulness contract
- prohibitions
- recoverability

### 不要做

- 不往里塞 runtime discipline
- 不往里塞动态 contextual
- 不往里塞 capability schema

### 主要文件

- `docs/ability/73-core-system-v1-formal-draft.md`
- `src/agent_core/core-prompt/system.ts`
- `src/agent_core/core-prompt/system.test.ts`

### 产物

1. 正式冻结版 system 文本
2. 对应代码常量
3. 定向测试

### 验收

- 体量明显高于当前版本，但仍不混入 development/contextual
- 测试明确防止 capability schema 渗入 system

## Task Pack B：`core-development` 加厚与冻结

### 目标

把 `core-development/v1` 做成真正的厚工作协议层。

### 范围

- current-objective discipline
- execution discipline
- validation ladder
- task-state semantics
- capability-loop discipline
- context economy
- continuation / compaction discipline
- `CMP / TAP / MP` 使用边界

### 不要做

- 不把 giant capability schema 塞回 development
- 不把当前 inventory / transcript / tool result 塞回 development

### 主要文件

- `docs/ability/75-core-development-v1-formal-draft.md`
- `src/agent_core/core-prompt/development.ts`
- `src/agent_core/core-prompt/development.test.ts`
- `src/agent_core/live-agent-chat.ts`

### 产物

1. 更厚的 development 正式稿
2. development helper / pack
3. 主链 builder 共享它的制度来源

### 验收

- `buildCoreUserInput(...)` 和 `buildCoreActionPlannerInstructionText(...)` 不再各自复制主要制度
- 定向测试覆盖 taskStatus / capability-loop / capability-window / browser/search discipline

### 当前实现状态

状态：已落地 / 已定向验证 / 待继续补厚

已完成：

- `core-development/v1` 已进入 `src/agent_core/core-prompt/development.ts`
- objective anchoring、workflow、validation、context economy、continuation/compaction、taskStatus、capability window 等已抽成共享 helper
- `live-agent-chat.ts` 的 user-input 与 action-planner 已共用这套 helper
- `src/agent_core/core-prompt/development.test.ts` 已通过

当前缺口：

- `blocked / incomplete / exhausted` 还没形成更完整的冻结文档
- continuation / resume 还没有单独的验收面
- 更广义 runtime 还没全部复用这套 discipline

直接分发建议：

- 让下一位 agent 只补制度冻结与测试，不要把动态现场材料再塞回 development

## Task Pack C：`core-contextual` 结构化与 on-demand 入口

### 目标

让 `core-contextual-user` 变成真正高信噪比的结构化现场层，并为后续 on-demand overlay 留口。

### 范围

- current objective
- workspace context
- `CMP` package
- `TAP` capability window
- tool result
- grounding evidence
- task-specific constraints

### 不要做

- 不把 raw history 正文常驻
- 不把 raw memory 正文常驻
- 不把 giant capability manual 常驻

### 主要文件

- `src/agent_core/core-prompt/contextual.ts`
- `src/agent_core/core-prompt/live-chat-contextual.ts`
- `src/agent_core/core-prompt/live-chat-contextual.test.ts`
- `src/agent_core/live-agent-chat.ts`

### 产物

1. 更完整的 contextual block schema
2. live-chat bridge
3. on-demand 入口说明

### 验收

- 当前 prompt 中的动态现场已经块化
- 空块省略、顺序稳定、桥接测试通过

## Task Pack D：`CMP dynamic package quality`

### 目标

继续做厚 `CMP` 的动态上下文整理能力，而不是把这部分吞回 `core`。

### 范围

- 当前工作现场整理质量
- 信噪比提升
- package family 质量
- passive historical return 质量
- route / delivery 语义质量

### 主要文件

- `docs/ability/69-cmp-role-workmode-prompt-design.md`
- `docs/ability/67-cmp-mode-map-and-test-matrix.md`
- `src/agent_core/cmp-five-agent/configuration.ts`
- `src/agent_core/cmp-five-agent/*-runtime.ts`

### 产物

1. `CMP` 动态工位质量改进
2. 角色工位 prompt 继续收敛
3. 相关对照测试

### 验收

- `CMP` 继续更像动态上下文编辑部
- 而不是更像第二个 `core`

## Task Pack E：`CMP prompt variant governance`

### 目标

把 `CMP` 的 prompt variant 管理和运行接入彻底对齐。

### 范围

- `workmode_v8` / future variants 的治理
- runtime 是否显式消费 variant
- variant 与 live-chat / facade / smoke 的对齐

### 主要文件

- `src/agent_core/cmp-five-agent/configuration.ts`
- `src/agent_core/cmp-five-agent/five-agent-runtime.ts`
- `src/agent_core/live-agent-chat.ts`
- `src/rax/cmp-five-agent-live-smoke.ts`

### 产物

1. 明确的 variant 接入点
2. 对应 smoke/test
3. 文档化的 variant truth

### 验收

- 文档冻结的最佳候选，真实运行链也在吃
- 不再出现“文档说是 v8，runtime 实际吃 baseline”的风险

## Task Pack F：`core-CMP handoff contract`

### 目标

把 `core` 固定层与 `CMP` 动态层的 handoff 做成正式 contract，而不是默契拼接。

### 范围

- `CMP` 包进 `core-contextual-user` 的最小字段集
- `core` 消费 `CMP` 包的规则
- 冲突、缺失、降级时的行为

### 主要文件

- `docs/ability/76-core-cmp-prompt-engineering-direction.md`
- `docs/ability/72-core-system-v1-engineering-spec.md`
- `src/agent_core/core-prompt/contextual.ts`
- `src/agent_core/live-agent-chat.ts`

### 产物

1. handoff contract 文档
2. 对应 schema / types
3. bridge tests

### 验收

- `core` 不再假装自己负责动态整理
- `CMP` 输出也不再模糊成一段散文摘要

### 当前实现状态

状态：已落地主路径 / contract 待补完

已完成：

- `core-cmp-context-package/v1` 和 `core-overlay-index/v1` 类型已存在
- `live-chat-contextual.ts` 已把 `CmpTurnArtifacts` 映射成结构化包
- `CMP` 缺席时已有 `deliveryStatus: absent` 降级路径
- `live-chat-assembly.ts` 已完成 layer assembly
- `buildLiveChatPromptMessages(...)` 已输出 `system / developer / user` 三层消息
- 对应测试已通过：
  - `src/agent_core/core-prompt/live-chat-contextual.test.ts`
  - `src/agent_core/core-prompt/live-chat-assembly.test.ts`

当前缺口：

- `partial / pending / skipped` 状态还没形成系统验收
- conflict/missing/stale 消费规则尚未冻结
- handoff 还缺一份独立 contract 文档

直接分发建议：

- 下一位 agent 重点补 `deliveryStatus` 状态机、字段优先级和冲突处理

## Task Pack G：`memory / skills / capability` 索引化与按需加载

### 目标

把未来厚度增长主要放在 index/on-demand，而不是全塞进 base prompt。

### 范围

- skill index
- memory index
- capability family index
- on-demand overlay entrypoints

### 主要文件

- `src/agent_core/core-prompt/*`
- `src/agent_core/live-agent-chat.ts`
- [79-core-overlay-index-minimal-producer-design.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/79-core-overlay-index-minimal-producer-design.md:1)

### 产物

1. index layer 设计
2. on-demand overlay 入口
3. 对应 prompt budget 说明

### 验收

- 总调用可以长到 `10k-30k`
- 但主固定层不被 raw 正文污染

### 当前实现状态

状态：已完成 capability / skill / memory 最小 index 主路径 / 正文仍待接入

已完成：

- `overlays.ts` 已支持 `capabilityFamilies / skills / memories`
- `live-chat-overlays.ts` 已实现最小 live producer：
  - `capabilityFamilies` 来自 capability usage index
  - `skills` 来自 skill family 轻索引
  - `memories` 来自 repo memory 层目录卡
- `capability-usage-index.ts` 已能生成面向 core 的 capability index
- `formal-family-inventory.ts` 已冻结 formal family inventory
- `foundation-family-check.ts` 已能判断 foundation baseline 是否 production-like
- `79-core-overlay-index-minimal-producer-design.md` 已把 `skill index / memory index` 的最小生产者边界、`bodyRef` 约定、预算与排序策略写成可分发设计
- 相关测试已通过：
  - `src/agent_core/core-prompt/live-chat-overlays.test.ts`
  - `src/agent_core/core-prompt/overlays.index.test.ts`
  - `src/agent_core/tap-availability/capability-usage-index.test.ts`
  - `src/agent_core/tap-availability/foundation-family-check.test.ts`

当前缺口：

- `skills` 已接上最小生产者，但仍是 family 轻索引，不是更强的 manifest producer
- `memories` 已接上最小生产者，但仍是 repo memory 目录卡，不是 freshness/objective 更敏感的 producer
- on-demand deep overlay 入口尚未形成
- prompt budget 说明已写入设计文档，但尚未变成 live 路径里的硬约束

直接分发建议：

- 下一位 agent 先升级 `skill index producer`
- 再升级 `memory index producer`
- 最后才考虑按需正文展开，不要反过来

## Task Pack H：`continuation / compaction / resume` 协议

### 目标

让厚 prompt 在长会话、压缩、resume 后仍然稳。

### 范围

- continuation contract
- compaction handoff
- resume baseline
- task path preservation

### 主要文件

- 新增 continuation/compaction docs
- `core-development` 相关文档
- 可能涉及 future memory/context docs

### 产物

1. continuation prompt 协议
2. compaction 后保留字段清单
3. resume 验证清单

### 验收

- 厚 prompt 不是只在第一轮强
- 而是压缩后还能继续强

## Task Pack I：`layered message assembly` 深化与统一入口

### 目标

把当前已经出现的 `promptMessages` 能力真正扩展成统一的 layered message path。

### 范围

- `system / developer / user` message layering
- `instructionText` 向后兼容
- `model-inference` lower 层
- live-chat / runtime / future goal-compiler 对接

### 主要文件

- `src/agent_core/core-prompt/live-chat-assembly.ts`
- `src/agent_core/integrations/model-inference.ts`
- `src/agent_core/integrations/prompt-message-parts.ts`
- `src/agent_core/live-agent-chat.ts`

### 产物

1. 更统一的 layered message assembly
2. 兼容旧 `instructionText` 的 fallback
3. 定向测试

### 验收

- 分层消息不再只是内部对象
- 而是真正在模型调用层稳定工作

## Task Pack J：验证、回归、smoke、冻结

### 目标

收口整条线，避免“方向对了但回归不稳”。

### 范围

- 单元测试
- bridge 测试
- prompt assembly 测试
- 定向 smoke
- token budget 回读

### 主要文件

- `src/agent_core/core-prompt/*.test.ts`
- `src/agent_core/integrations/*.test.ts`
- 相关 smoke/documentation

### 产物

1. 回归测试基线
2. prompt 预算读数
3. 冻结说明

### 验收

- 新 prompt engineering 路径可回归
- token 量级与 section 分布可读回

## 三、并行建议

### 第一波可并行

- `Task Pack A`
- `Task Pack B`
- `Task Pack D`
- `Task Pack E`

### 第二波可并行

- `Task Pack C`
- `Task Pack F`
- `Task Pack G`

说明：

- 如果只按当前代码成熟度派发，优先派 `F` 和 `G`
- 因为 `B` 已经进入“补冻结和补验收”，而 `F/G` 还更需要结构化收口

### 第三波

- `Task Pack H`
- `Task Pack I`

### 最后收口

- `Task Pack J`

## 四、任务拆分原则

后续分给多智能体时，每个任务包都必须写清楚：

1. 当前唯一目标
2. 不要做什么
3. 产物文件
4. 验收方式
5. 依赖哪个上游任务包

## 当前一句话收口

这份任务包文档的目的，不是把事情拆碎。

而是确保后续多智能体推进时，始终围绕这条主线：

**`core` 厚在固定协议层，`CMP` 厚在动态上下文层，`core-CMP` 的 handoff 做成正式 contract。**
