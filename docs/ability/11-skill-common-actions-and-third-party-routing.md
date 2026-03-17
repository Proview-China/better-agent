# Skill Common Actions And Third-Party Routing Draft

状态：研究稿，不是冻结规范。

更新时间：2026-03-14

## 这份文档要回答什么

如果 Praxis 真的要开始做 `rax.skill.*`，我们首先要知道两件事：

1. 三家官方 skill / agent runtime 之间，真正共同的最小动作是什么。
2. 第三方 skill 库接入时，Praxis 抽象层到底要吞掉哪些复杂度。

## 先说结论

- 跨三家都真正成立的最小公共动作，更稳地说是 `4.5` 个：
  - `define`
  - `discover`
  - `bind`
  - `activate`
  - `loadLocal` 作为半个公共动作
- `publish / version / registry-hosting` 不能算跨三家最小公共动作。
- `contextBridge` 很重要，但更适合作为包装机能力，而不是 `skill` 的最小公共动作。
- 第三方 skill 库的主流交付物已经不是对象实例，而是：
  - 目录 bundle
  - `SKILL.md`
  - supporting files
- 所以 Praxis 抽象层真正要做的，是：
  - 发现
  - 规范化
  - 路由
  - 绑定
  - 治理

## 跨三家最小公共动作

### 1. `define`

意思：

- 把一个 skill 定义成可交付、可发现、可绑定的能力包

三家共同点：

- OpenAI：skill 是 versioned bundle + `SKILL.md`
- Anthropic：skill 至少有 `SKILL.md`、frontmatter、`name`、`description`
- Google ADK：skill 是 self-contained unit，支持 metadata / instructions / resources 三层

工程收口：

- `define` 是最稳的跨三家公共动作

### 2. `discover`

意思：

- 让模型或 runtime 知道有哪些 skill 存在
- 通常只先加载轻量 metadata

三家共同点：

- OpenAI：会把 skill 的 `name / description / path` 放进 prompt context
- Anthropic：先加载 skill metadata，再按需读正文
- Google ADK：明确有 L1 Metadata 作为 discovery 层

工程收口：

- `discover` 可以作为 Praxis 的 provider-agnostic 原语

### 3. `bind`

意思：

- 把 skill 绑定到某个 runtime substrate

三家共同点：

- OpenAI：要绑定到 shell environment / `environment.skills`
- Anthropic：要绑定到 `container.skills` 或 SDK filesystem + `allowed_tools=["Skill"]`
- Google ADK：要绑定到 `SkillToolset`

工程收口：

- `bind` 是 Praxis 最核心的抽象层动作之一

### 4. `activate`

意思：

- skill 不默认全量展开，而是在相关时才真正触发

三家共同点：

- OpenAI：先看 metadata，再读 `SKILL.md`
- Anthropic：自动匹配后加载完整 instructions
- Google ADK：L2 instructions 在 skill 被触发时才加载

工程收口：

- `activate` 可以作为 Praxis 的 provider-agnostic 原语

### 5. `loadLocal`

意思：

- 从本地目录把 skill 实体读进来

三家共同点：

- OpenAI：支持 local shell skill
- Anthropic：支持 filesystem skills
- Google ADK：支持从目录加载 skill

工程收口：

- `loadLocal` 基本可作为公共动作，但它更像 `0.5` 个公共动作：
  - 三家都支持
  - 但装载入口和后续绑定方式并不相同

## 不能先当作公共原语的动作

### `publish`

为什么不能先放进最小表：

- OpenAI：明确支持
- Anthropic：明确支持
- Google ADK：当前没看到对应 hosted registry / publish API

结论：

- `publish` 应暂时视为 provider extension，不视为跨三家最低公共动作

### `version`

和 `publish` 同理：

- 对 OpenAI / Anthropic 成立
- 对 Google ADK 当前不能稳说

结论：

- `version` 应暂时视为 provider extension

### `contextBridge`

为什么不先放进 skill 最小动作：

- OpenAI 的 conversation state 不是 skill 独有动作
- Anthropic 这轮更接近 inferred，没有统一 skill-state primitive
- Google 的 session / state / memory 是 ADK 基础设施，不是 skill 独有动作

结论：

- `contextBridge` 很重要
- 但更适合作为包装机能力，而不是 `skill` 的第一批最小公共动作

## 第三方 skill 库到底在卖什么

当前主流 skill hub / registry 的交付物已经比较统一：

- 一个目录
- 一个 `SKILL.md`
- 若干 supporting files

常见 supporting files：

- `scripts/`
- `references/`
- `assets/`
- registry-specific metadata

这意味着：

- 第三方 skill 库卖的不是对象实例
- 卖的是版本化能力包

## Praxis 抽象层真正要吞掉的复杂度

如果目标是“几行代码接入第三方 skill 库”，Praxis 至少要负责 6 类转换。

### 1. Source discovery

可能来源：

- GitHub repo
- skill hub API
- zip bundle
- 本地目录
- workspace skills

### 2. Bundle normalization

把外部 skill 统一整理成 Praxis 内部形状，例如：

- descriptor
- entry markdown
- resources
- scripts
- registry metadata

### 3. Metadata translation

外部 skill 常会携带 client-specific metadata，例如：

- `metadata.openclaw`
- `metadata.clawdbot`
- `allowed-tools`
- `user-invocable`
- `disable-model-invocation`

Praxis 需要决定：

- 哪些保留
- 哪些翻译成 policy
- 哪些忽略

### 4. Runtime binding

同一个 skill container，最终要映射成不同官方 runtime 调用：

- OpenAI：
  - shell environment skills
  - `/v1/responses`
- Anthropic：
  - API 路：`container.skills`
  - SDK 路：filesystem + `allowed_tools=["Skill"]`
- Google ADK：
  - `SkillToolset`

### 5. Progressive loading

更稳的加载策略应该内建三层：

- Tier 1：catalog / metadata
- Tier 2：full `SKILL.md`
- Tier 3：resources / scripts / assets

### 6. Security and policy

第三方 skill 不应被默认视为可信。

Praxis 抽象层最好负责：

- allowlist / denylist
- source trust
- version pinning
- install requirements
- permission gating

## 现在对 `rax.skill.*` 最有帮助的接口理解

这轮研究后，更稳的理解是：

### `rax.skill.containerCreate(...)`

负责：

- source discovery
- bundle normalization
- metadata translation
- progressive loading 配置
- local package load

### `rax.skill.bind(...)`

负责：

- provider/runtime binding

### `rax.agent.skillMount(...)`

负责：

- 把一个已绑定好的 skill container 挂到 agent

### `rax.skill.publish(...)`

负责：

- 仅在 provider 支持 hosted skill registry 时使用
- 不应默认视为所有 provider 都有

## 一个更稳的工程判断

如果我们要支持：

- OpenAI 官方 skill
- Anthropic 官方 skill
- Google ADK skill
- ClawHub / OpenClaw / 第三方 skill hub

那么最合理的心智模型不是：

```ts
rax.skill.use(url)
```

而是更像：

```ts
const container = await rax.skill.containerCreate({
  source: "clawhub://pdf-processing@latest"
});

await rax.skill.bind(container, {
  provider: "openai"
});

await rax.agent.skillMount(agentId, container);
```

原因很简单：

- registry artifact
  -> Praxis container
- Praxis container
  -> provider binding
- provider binding
  -> agent-usable surface

中间至少就是这三层转换。

## 当前更稳的下一步

比继续空谈更值当的是两件事：

1. 把 `rax.skill` v0 最小动作草案列出来：
   - `define`
   - `discover`
   - `bind`
   - `activate`
   - `loadLocal`
2. 把 `Skill Container` 的最小槽位和三层加载策略写成一页骨架图
