# rax.skill v0 Actions Draft

状态：动作草案，不是冻结 API。

更新时间：2026-03-14

## 这份文档要回答什么

我们已经收敛出一批跨 provider 都比较稳的 skill 最小公共动作。

这份文档不讨论底层实现，只回答：

1. `rax.skill` v0 第一批应该暴露哪些动作。
2. 每个动作负责什么。
3. 哪些动作先不要放进第一批。

## 先说结论

`rax.skill` v0 第一批建议只认这 5 个动作：

- `define`
- `discover`
- `bind`
- `activate`
- `loadLocal`

这 5 个动作里：

- `define / discover / bind / activate` 是最稳的公共主轴
- `loadLocal` 作为半个公共动作进入第一批，优先支持本地实践

先不要放进第一批：

- `publish`
- `version`
- `syncState`
- `registryList`

## v0 动作表

### 1. `rax.skill.define(...)`

目标：

- 把一个 skill 定义成 Praxis 内部可识别的 container candidate

它负责：

- 读取 descriptor 级别信息
- 确定 entry markdown
- 注册 resources/helpers/bindings/policy

它不负责：

- 真正 provider attachment
- 远端 publish
- agent mount

更像：

- “定义能力包”

### 2. `rax.skill.discover(...)`

目标：

- 枚举当前上下文中可用的 skills

它负责：

- 返回 skill metadata
- 支持 project / user / workspace / registry / provider source 的可见性范围
- 默认不展开全部正文和资源

它不负责：

- 自动触发
- 自动 mount

更像：

- “列目录 / 看名片”

### 3. `rax.skill.bind(...)`

目标：

- 把 skill container 翻译到目标 provider/runtime 的 skill 接入方式

它负责：

- OpenAI:
  - shell / `environment.skills`
- Anthropic:
  - `container.skills`
  - 或 filesystem skill + `Skill`
- Google ADK:
  - `SkillToolset`

它不负责：

- 真正执行 skill 里的业务动作

更像：

- “接插头”

### 4. `rax.skill.activate(...)`

目标：

- 把一个已定义/已绑定的 skill 送入可执行态

它负责：

- 确认是否命中
- 展开主入口 markdown
- 按需准备 resources/helpers
- 调用底层 runtime substrate

它不负责：

- 自动治理所有副作用

更像：

- “点火”

### 5. `rax.skill.loadLocal(...)`

目标：

- 从本地目录或 bundle 读入 skill

它负责：

- 定位 `SKILL.md`
- 读取基础 metadata
- 发现 supporting files

它不负责：

- provider binding
- hosted publish

为什么进入 v0：

- 三家都支持本地/目录式 skill
- 本地实践是最容易先跑通的一条线

## 对应的高层组合

虽然 v0 先列 5 个动作，但程序员不一定直接逐个调用。

高层上可以继续保留短接口目标：

```ts
const container = await rax.skill.containerCreate({
  source: "./skills/pdf"
});

await rax.agent.skillMount(agentId, container);
```

而内部可能拆成：

```ts
const local = await rax.skill.loadLocal("./skills/pdf");
const defined = await rax.skill.define(local);
const bound = await rax.skill.bind(defined, { provider: "openai" });
await rax.agent.skillMount(agentId, bound);
```

也就是说：

- 面向程序员可以短
- 面向 runtime 仍然应该拆动作

## v0 暂不进入第一批的动作

### `publish`

原因：

- 不是三家共同稳定动作
- 更适合作为 provider extension

### `version`

原因：

- 与 `publish` 强耦合
- 当前不应绑死在 v0 skill core

### `syncState`

原因：

- `state/context bridge` 更像包装机层能力
- 不是 skill 最小公共动作

### `registryList`

原因：

- registry 能力过于 source-specific
- 应放在 discovery/source adapter 侧，不先进 core action

## v0 动作与其他层的边界

### 与 `plugin`

- `plugin` 负责 provider/host 扩展
- `rax.skill.bind(...)` 可以依赖 plugin，但不等于 plugin

### 与 `callback`

- `callback` 负责治理与拦截
- `rax.skill.activate(...)` 可能触发 callback，但不等于 callback

### 与 `packaging machine`

- `rax.skill` v0 是包装机的第一批对外动作
- 它不是包装机的全部

## 三家 provider action mapping

下面这张表不讨论最终代码实现，只回答：

- 同一个 `rax.skill` 动作
- 在三家 provider 上大致会被翻译成什么

| `rax.skill` 动作 | OpenAI | Anthropic | Google ADK |
|---|---|---|---|
| `define` | 组装 skill bundle，准备 `SKILL.md`、metadata、optional hosted payload | 组装 filesystem/API skill payload，准备 `SKILL.md`、frontmatter、resources | 组装 ADK skill definition，准备 metadata / instructions / resources |
| `discover` | skill metadata 注入上下文，或列出本地/托管 skill 引用 | 列 skill metadata，或从 filesystem/source 发现 skill | 读取 L1 metadata，或从 agent card / local source 发现 skill |
| `bind` | 绑定到 `shell` + `environment.skills` | API 路绑定到 `container.skills` + `code_execution`；SDK 路绑定到 filesystem + `Skill` | 绑定到 `SkillToolset`，再进入 agent `tools` |
| `activate` | 命中 skill 后展开 `SKILL.md`，通过 shell/tool runtime 执行 | 命中 skill 后展开 instructions，通过 code execution / Skill tool / subagent 进入执行态 | 命中 skill 后展开 L2/L3，通过 skill toolset / workflow agent 进入执行态 |
| `loadLocal` | 读取本地 shell skill 目录 | 读取 `.claude/skills` 或 project-local filesystem skill | `load_skill_from_dir(...)` 或等效目录装载 |

## 每个动作的 provider 侧翻译重点

### `define`

`define` 的重点不是“立刻可执行”，而是把 skill 变成可绑定的 container candidate。

在三家上，它更像：

- OpenAI：为 shell skill 或 hosted skill 准备 bundle 形状
- Anthropic：为 API route 或 SDK filesystem route 准备同一个 skill 包
- Google：为 file-based skill 或 code-defined skill 准备统一输入

### `discover`

`discover` 解决的是“谁知道这个 skill 存在”。

在三家上，它更像：

- OpenAI：metadata 进入上下文，或从 attached skills 可见
- Anthropic：metadata 先发现，再按需展开
- Google：L1 Metadata / A2A card 先暴露

### `bind`

`bind` 是最需要 adapter 的地方。

如果没有这一层，上层程序员就得自己理解：

- OpenAI 的 `environment.skills`
- Anthropic 的 `container.skills` / filesystem skill
- Google 的 `SkillToolset`

这正是 `rax.skill.bind(...)` 最有价值的地方。

### `activate`

`activate` 不等于“运行 markdown”。

它真正做的是：

1. 确认 skill 命中
2. 展开 entry markdown
3. 再把执行交给底层 runtime substrate

所以在不同 provider 上，激活后的执行面会不同：

- OpenAI：shell / tool runtime
- Anthropic：code execution / Skill tool / subagent
- Google：SkillToolset / workflow agent

### `loadLocal`

`loadLocal` 之所以放进 v0，是因为它让我们可以先在本地把 skill 跑起来，而不需要先啃 hosted registry。

它也最适合先承接第三方 skill hub 的 bundle 下载落地。

## 当前可接受的中间判断

- `rax.skill` v0 应先围绕“定义、发现、绑定、激活、本地装载”建模。
- 先把三家的 skill 接入方式翻译掉，比一开始追求 publish/registry/hosted 闭环更值当。
- v0 的重点不是覆盖所有高级能力，而是让 skill container 能稳定地进入 agent runtime。
