# Skill Cross-SDK Research Draft

状态：研究稿，不是冻结规范。

更新时间：2026-03-14

## 这份文档要回答什么

我们现在不急着定义 Praxis 的最终 `skill` 规范，而是先回答三个更基础的问题：

1. 三家官方体系里，`skill` 或最接近 `skill` 的东西到底是什么。
2. Praxis 能不能抽出一层真正跨 OpenAI / Anthropic / Google 的上层 `skill` 抽象。
3. 我们上层以后要不要把它做成 `new Skill().create(...)` 这类统一调用。

## 先说结论

- 可以做跨三家的上层 `skill` 抽象，但不能直接照搬任何一家当前 SDK 的具体形状。
- `skill` 更像“能力包”而不是“单次工具调用”。
- `skill` 也不应先被建模成某家 SDK 里的原生对象实例。
- 更稳的方向是先把 `skill` 抽象成一组 provider-agnostic 构件，再由 adapter 映射到各家 runtime。

一句白话：

`tool` 是动作，`agent` 是执行体，`skill` 是把“什么时候做、怎么做、看什么、调什么、怎么降级”打成的能力包。

## 三家官方定义对照

### OpenAI

OpenAI 官方现在已经有明确的 `Skills` 概念，但它首先是 shell/runtime 场景里的能力包，不是 Agents SDK 核心 primitive。

官方信号：

- OpenAI Skills guide 明确把 skill 定义成 “versioned bundle of files plus a `SKILL.md` manifest”。
- Skills 可以被 upload / manage / attach 到 hosted 或 local shell environments。
- 模型先看到 `name / description / path` 这类轻量 metadata，再按需读取完整 `SKILL.md`。

这意味着：

- OpenAI 证明了 `skill = 可版本化文件包 + 懒加载发现 + runtime attachment` 这条路成立。
- 但 OpenAI 当前的 `skill` 很强绑定 shell 语义，不适合直接拿来当三家统一真身。

对 Praxis 的启发：

- 可以借 OpenAI 的“两段式 skill”思路：
  - 先索引
  - 后展开
- 不要把 skill 默认做成全量 prompt 注入。

参考：

- [OpenAI Skills guide](https://developers.openai.com/api/docs/guides/tools-skills)
- [OpenAI Agents SDK guide](https://developers.openai.com/api/docs/guides/agents-sdk)
- [OpenAI Tools guide](https://developers.openai.com/api/docs/guides/tools)
- [OpenAI MCP and Connectors guide](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OpenAI Conversation state guide](https://developers.openai.com/api/docs/guides/conversation-state)

### Anthropic

Anthropic 是三家里把 `skill` 讲得最完整、最像“厚能力”的。

官方信号：

- Agent Skills 被官方定义为模块化能力包。
- 一个 skill 至少有：
  - `SKILL.md`
  - frontmatter
  - `name`
  - `description`
- skill 还可以带：
  - resources
  - examples
  - templates
  - utility scripts
- Claude / Claude Code 会先发现 skill metadata，命中后再读取正文。
- 在 Claude Code 里，skill 还能挂：
  - `allowed-tools`
  - `context`
  - `agent`
  - `hooks`
  - `!command` 动态上下文注入
  - `context: fork` 子代理执行

这意味着：

- Anthropic 的 `skill` 本质上不是 prompt，也不是 tool，而是“面向 agent 的能力包”。
- Anthropic 当前实现是 filesystem-first，这个落地方式很强，但不宜直接当作跨 provider 的标准。

对 Praxis 的启发：

- Anthropic 提供了最完整的 `skill package` 参考。
- 尤其值得借的是：
  - progressive disclosure
  - supporting resources
  - utility scripts
  - invocation policy
  - subagent composition

参考：

- [Anthropic Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Anthropic Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Anthropic Agent SDK skills](https://platform.claude.com/docs/en/agent-sdk/skills)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Anthropic Agent SDK subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)

### Google / Gemini ADK

Google 现在已经有官方的 `Skills for ADK agents` 页面，但它仍处于 experimental 阶段，成熟度和能力完备度还弱于 Anthropic / OpenAI 的稳定形态。

官方信号：

- ADK 现在官方提供 `Skills for ADK agents`：
  - 一个 agent skill 被定义为“self-contained unit of functionality”
  - 基于 Agent Skills specification
  - 允许 incremental loading，以减少上下文窗口压力
- ADK skill 有明确三层结构：
  - L1 Metadata
  - L2 Instructions
  - L3 Resources
- ADK 支持两种定义方式：
  - 从文件目录加载 skill
  - 在代码里直接定义 `Skill` model
- A2A agent card 依然可以作为“能力名片”层。
- workflow agents 如 `SequentialAgent` / `ParallelAgent` / `LoopAgent` 继续提供 skill 所需的编排骨架。

这意味着：

- Google 现在已经有本地 skill 形态，不再是“完全没有 skill runtime”。
- 但它仍然是 experimental，且当前限制明显，比如 `scripts/` 执行尚未支持。
- Gemini 现在对 skill 的兼容性仍偏弱，更多体现在成熟度、能力完备度和跨语言一致性上，而不是概念完全缺位。

对 Praxis 的启发：

- 值得借 Google 的四点：
  - workflow composition
  - context substrate
  - agent-card style metadata
  - skill 的三层分级装载

参考：

- [Google ADK overview](https://google.github.io/adk-docs/)
- [Google ADK Skills for Agents](https://google.github.io/adk-docs/skills/)
- [Google ADK technical agents](https://google.github.io/adk-docs/agents/technical-agents/)
- [Google ADK tools](https://google.github.io/adk-docs/tools/)
- [Google ADK sessions](https://google.github.io/adk-docs/sessions/)
- [Google ADK context](https://google.github.io/adk-docs/context/)
- [Google ADK artifacts](https://google.github.io/adk-docs/artifacts/)
- [Google ADK A2A exposing](https://google.github.io/adk-docs/a2a/quickstart-exposing/)
- [Google ADK A2A consuming](https://google.github.io/adk-docs/a2a/quickstart-consuming/)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)

## 交集是什么

虽然三家产品形状不一样，但有几个共同信号已经很清楚：

1. `skill` 不应等同于单个 `tool`

- tool 负责做动作
- skill 负责把动作、上下文、约束、流程和资源打成包

2. `skill` 应该是可发现的

- 不管是 OpenAI 的 metadata injection
- Anthropic 的 skill discovery
- 还是 Google A2A 的 agent card

都说明 skill 需要先有“被发现”的描述层。

3. `skill` 应该是懒加载的

- 先暴露轻量索引
- 再按需读取正文、资源和脚本

4. `skill` 应该能绑定执行面

skill 自己不是执行引擎。

它要绑定到某种 runtime substrate，例如：

- tool bundle
- MCP surface
- subagent
- workflow node
- shell environment

5. `skill` 要能跨轮工作

如果 skill 完全没有 state bridge，它就很容易退化成“一次性技巧提示词”。

## 不能过早定死的地方

### 不建议现在就把本体做成 `new Skill().create(...)`

这个形状以后可以作为便捷 API 存在，但不适合现在拿它当 skill 的本体定义。

原因：

- Anthropic 官方强调 skill 是 artifact，不是 API 注册对象。
- OpenAI 官方 skill 也更接近 bundle + attachment，而不是 agent runtime 中的核心对象 primitive。
- Google 侧更偏 agent/workflow/context 组合，强推 object-first 很容易把抽象做窄。

更稳的理解是：

- `Skill` 先是一个 bundle / descriptor / policy / binding 的组合体
- 然后才可能在 Praxis SDK 上提供某种对象式便利封装

### 不建议现在就把 skill 绑定到某一家 provider 的原生实现

例如：

- 不能把 Anthropic 的 `SKILL.md + frontmatter + hooks` 直接当通用标准
- 不能把 OpenAI 的 shell attachment 直接当通用标准
- 不能把 Google 的 A2A `skills` metadata 当作本地 skill runtime

## 当前更稳的抽象候选

下面这些更像是我们后续真正应该讨论的“抽象面”，不是最终 API：

### 1. `SkillDescriptor`

作用：发现与路由。

建议至少包含：

- `id`
- `name`
- `description`
- `triggers`
- `tags`
- `version`
- `providerHints`

### 2. `SkillBundle`

作用：承载正文与资源。

建议至少包含：

- main instructions
- references
- examples
- templates
- scripts

### 3. `SkillExecutionPolicy`

作用：治理与约束。

建议至少包含：

- invocation mode
- allowed tools
- allowed MCP servers
- permission/risk level
- isolation mode

### 4. `SkillBinding`

作用：把 skill 映射到具体运行时。

可能的 binding：

- OpenAI shell/tools/responses/conversation
- Anthropic skills/tools/mcp/subagents/hooks
- Google agent/workflow/tool/context/artifact

### 5. `SkillStateBridge`

作用：连接上下文与长期状态。

建议至少考虑：

- session state
- memory
- artifacts
- trace/ledger

### 6. `SkillLedger`

作用：命中与收益记录。

建议至少记录：

- 是否命中
- 谁触发
- 加载成本
- 是否成功
- 失败原因
- 复用收益

## 暂时可以接受的中间判断

这一轮研究后，可以先接受下面这些中间判断：

- `skill` 属于 runtime plane，而不是 tool plane。
- `skill` 是“能力包装与分发单元”，这个方向没有问题。
- `skill` 的跨家真抽象更接近：
  - descriptor
  - bundle
  - binding
  - activation
  - state bridge
  - ledger
- Anthropic 最适合提供 package 形状参考。
- OpenAI 最适合提供 attachment / safety / lazy materialization 参考。
- Google 最适合提供 workflow / context / layered skill loading 参考。

## 现在还不要拍板的事情

- 最终 TypeScript interface 长什么样
- 最终是否暴露 `new Skill()` 风格 API
- skill 是不是可以直接被 agent 当 tool 调用
- skill 和 plugin / callback / session / trace 的精确边界
- provider-specific adapter 是不是放进 `rax` 内核

## 下一步更值得做什么

比“直接写 skill 规范”更值当的，是先做下面两件事：

1. 画出 Praxis 内部的 `skill lifecycle`

建议至少画清楚：

- discover
- match
- load
- bind
- activate
- record

2. 先做一张 `provider mapping` 表

把同一个 skill 抽象在三家上分别怎么落，先用表格写清楚，再决定接口。

## 和当前项目文档的一致性

这份研究稿与当前项目里已有的 skill 方向一致：

- [`docs/ability/01-basic-implementation.md`](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/01-basic-implementation.md) 已经把 `skill` 定义为：
  - 版本化技能描述
  - 装载策略
  - 上下文注入
  - 命中与收益记录
- 这次研究没有推翻这个方向，只是说明：
  - 这条方向可以跨三家成立
  - 但不要过早冻结成某一种对象 API 或某一家 provider 的实现语义
