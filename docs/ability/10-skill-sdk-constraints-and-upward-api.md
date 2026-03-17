# Skill SDK Constraints And Upward API Draft

状态：研究稿，不是冻结接口。

更新时间：2026-03-14

## 这份文档要回答什么

如果 Praxis 要做自己的 `skill` SDK，我们不能只停留在“`SKILL.md` 是不是说明书”这一层。

更关键的问题是：

1. 三家官方在各自 `agent-sdk` / agent runtime 里，究竟通过什么机制真正“用上” skill。
2. 它们各自卡在哪里。
3. Praxis 的向上接口应该怎么设计，才能把这些差异包起来，同时为包装机架构留出空间。

## 先说结论

- 我们完全可以把“给 agent 加上可执行 skill 能力”抽成自己的高层接口。
- 但这个高层接口不应该直接等于任何一家官方 SDK 的 skill 对象。
- 更稳的方向是：
  - 向上暴露 `rax.skill.*`
  - 向下做 provider-specific binding
  - 中间用包装机容器承接 `SKILL.md`、资源、执行绑定和治理策略

一句白话：

程序员应该写：

```ts
const container = await rax.skill.containerCreate(...)
await rax.agent.skillMount(agentId, container)
```

而不是被迫理解：

- OpenAI 的 shell skill attachment
- Anthropic 的 container.skills / code_execution / settingSources
- Google ADK 的 `SkillToolset`

## 三家的实际接入约束

### OpenAI：可以走 `/v1/responses`，但前提是 shell tool 环境

OpenAI 当前的官方 skill 已经是稳定产品能力。

硬约束：

- skill 本身是一个 versioned bundle，包含 `SKILL.md`
- skill 的运行面依附于 shell tool
- 如果是 hosted 模式，要在 `tools[].environment.skills` 里挂 skill reference
- 如果是 local 模式，要提供本地 skill 目录的 `name / description / path`
- 真正调用是走 `/v1/responses`

这意味着：

- 你说“像 `/v1/responses` 这种 endpoint 就能正常用 OpenAI skill”，这句话基本成立
- 但更精确地说，是：
  - `/v1/responses`
  - 加 `shell` tool
  - 再加 `environment.skills`

不能把它误解成“任意 OpenAI agent runtime 都天然有 skill”

OpenAI 当前暴露出来的关键形状：

- `POST /v1/skills`
- `POST /v1/skills/<skill_id>/versions`
- `POST /v1/responses` + `tools[].environment.skills`
- 可选 inline skill / hosted skill / local shell skill

额外约束：

- Skill metadata 会进入 user prompt context，而不是 system prompt
- 官方明确把 Skill 当 privileged code/instructions 看待
- 不建议让终端用户自由挂载任意 skill

对 Praxis 的启发：

- OpenAI 路径最适合作为我们的 `publish + attach + invoke` 参考后端
- 但它较强绑定 shell runtime，不适合直接成为通用 skill 本体

参考：

- [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills)
- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents-sdk)

### Anthropic：有两条路，API 路和 SDK 路

Anthropic 这边要特别注意，它不是只有一种 skill 入口。

#### 1. API 路

官方已经有“用 Skills with the API”的路径。

硬约束：

- 通过 `client.beta.skills.list(...)` 发现 Anthropic-managed skills
- 通过 Messages API 请求中的 `container.skills` 指定 skill
- 同时启用 code execution tool
- 还需要对应 beta 标志

也就是说，API 侧更像：

- `Messages API`
- `container.skills`
- `tools=[code_execution]`

不是简单一个“把 skill id 塞进去”就自动跑完。

#### 2. SDK 路

Claude Agent SDK 里，skill 的接入方式又不同：

- skill 必须是 filesystem artifact
- 必须放在 `.claude/skills/` 或 `~/.claude/skills/`
- 必须配置 `settingSources`
- 必须把 `"Skill"` 放进 `allowed_tools`
- SDK 不提供 programmatic registration API

这意味着：

- Anthropic 官方已经把“skill 是文件系统能力包”这条路走得很深
- 但 SDK 路和 API 路不是同一个接入模型

对 Praxis 的启发：

- Anthropic 路径最适合作为我们的 `discover + lazy load + filesystem-backed bundle` 参考后端
- 但我们自己的高层接口不能绑死在 `.claude/skills/` 这套目录语义上

参考：

- [Anthropic Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Anthropic Agent Skills in the SDK](https://platform.claude.com/docs/en/agent-sdk/skills)
- [Anthropic Agent Skills quickstart for API](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart)

### Google ADK：已经有 skill，但当前是 ADK runtime 功能，不是通用原生端点能力

Google 现在已经有官方 ADK skill 了，但它的落点不是“给 Gemini 原生 API 一个 skill id 就能用”。

硬约束：

- 当前官方 skill 页面明确标注：
  - ADK Python v1.25.0 Experimental
- 通过 `SkillToolset` 把 skill 放进 agent 的 tools 列表
- skill 可以：
  - 从目录加载
  - 在代码中定义 `Skill`
- scripts 目录当前还不支持执行

这意味着：

- Google 的 skill 当前更像 ADK agent runtime 的上层扩展
- 不是一个简单可以映射成“统一 endpoint + skill reference”的原生能力

对 Praxis 的启发：

- Google 路最适合作为我们的 `toolset binding + workflow composition + code-defined skill` 参考后端
- 也说明我们的包装机必须兼容“不是所有 provider 都有 hosted skill registry”这种现实

参考：

- [Google ADK Skills](https://google.github.io/adk-docs/skills/)
- [Google ADK overview](https://google.github.io/adk-docs/)

## 一个重要判断：不能只盯 endpoint

你提的 “看接入的 url endpoint 就行” 这个方向，对 OpenAI 和 Anthropic API 路是有帮助的，但不够完整。

因为 skill 真正落地时，至少还牵涉 4 层：

1. 发现层

- 这个 skill 如何让模型知道它存在

2. 绑定层

- skill 如何挂到 runtime / shell / container / toolset 上

3. 执行层

- skill 最终通过什么去做事
  - shell
  - code execution
  - tool
  - MCP
  - workflow

4. 治理层

- 权限
- 安全
- 批准
- 版本
- 可见性

所以 endpoint 很重要，但它只是包装机落地的一层。

## Praxis 向上接口应该长什么样

这轮我不建议直接冻结最终 API，只建议先接受下面这条方向：

### 1. 面向程序员的高层接口

高层目标是：

- 给 agent 加 skill 能力时，调用要足够短
- 不暴露 provider-specific 细节
- 默认走我们的包装机最佳实践

建议形状：

```ts
const container = await rax.skill.containerCreate({
  entry: "./skills/pdf",
});

await rax.agent.skillMount(agentId, container);
```

或者：

```ts
await rax.agent.skillEnable(agentId, {
  source: "./skills/pdf",
});
```

### 2. 面向 runtime 的中层原语

我建议高层接口底下至少拆成这几层：

#### `rax.skill.containerCreate(...)`

作用：

- 把 `SKILL.md`、resources、scripts、bindings、policy 组装成包装机容器

#### `rax.skill.bind(...)`

作用：

- 把 skill container 映射到目标 provider runtime

例如：

- OpenAI -> shell environment skills
- Anthropic API -> container.skills + code_execution
- Anthropic SDK -> filesystem + settingSources + allowed_tools
- Google ADK -> `SkillToolset`

#### `rax.agent.skillMount(...)`

作用：

- 把已经可执行的 skill container 挂到指定 agent

#### `rax.skill.publish(...)`

作用：

- 当目标 provider 支持托管 skill 时，负责发布/升级版本

#### `rax.skill.discover(...)`

作用：

- 枚举当前 agent / project / provider 可用的 skill

### 3. 面向未来包装机架构的底层槽位

如果我们真要把包装机当作最佳实践，那 container 里至少要允许这些槽位存在：

- descriptor
- entry markdown
- references
- assets
- scripts
- tool bindings
- MCP bindings
- subagent / workflow binding
- execution policy
- safety policy
- state bridge
- ledger

## 现在最值得明确的事情

这轮研究后，我认为有三件事已经可以比较硬地确定：

### 1. `SKILL.md` 只是主入口，不是完整运行时

它很重要，但它只是：

- intro
- discovery hint
- main instructions

真正让 skill 成为厚能力的，是后面的包装机容器。

### 2. `containerCreate()` 这类原语是对的

因为它刚好能把：

- 文档入口
- 运行时绑定
- 资源与工具
- 治理策略

收在一起。

### 3. 我们做的是“整合 + 预制最佳实践 + 更方便的接口”

这点我认同，而且现在越来越清楚：

Praxis 不是简单复刻任何一家 skill。

Praxis 要做的是：

- 给程序员一个稳定的 skill 接入层
- 把三家已有能力包起来
- 再用我们自己的包装机架构把最佳实践预制进去

## 暂时不要拍板的点

- 最终 API 名称是不是 `containerCreate`
- 是 `skillMount` 还是 `mountSkill`
- container 是否直接等于 publishable unit
- `subagent` 是不是 container 的内建槽位还是外部 binding
- ledger 是 runtime 内建还是单独 service

## 当前更稳的下一步

如果继续往下走，比直接写代码更值当的是两件事：

1. 画 `Skill Container` 的最小骨架
2. 画三家 provider adapter mapping 表

这两件事一旦清楚，上层 API 就不会飘。
