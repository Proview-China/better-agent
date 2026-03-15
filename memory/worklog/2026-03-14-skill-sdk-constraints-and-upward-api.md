# 2026-03-14 Skill SDK Constraints And Upward API

## 本次结论

- Praxis 可以把“给 agent 加 skill 能力”抽成自己的高层接口。
- 当前更稳的方向是：
  - 向上暴露 `rax.skill.*`
  - 向下做 provider-specific binding
  - 中间用包装机容器承接 `SKILL.md`、资源、绑定和治理策略

## 三家约束收口

### OpenAI

- 可通过 `/v1/responses` 使用 skill。
- 但前提是：
  - 启用 shell tool
  - 在 `tools[].environment.skills` 中挂载 skill
- 更适合作为：
  - publish + attach + invoke
  这条路径的参考后端。

### Anthropic

- 有两条路：
  - API 路：`container.skills` + `code_execution`
  - SDK 路：filesystem skills + `settingSources` + `allowed_tools=["Skill"]`
- 更适合作为：
  - discover + lazy load + filesystem-backed bundle
  这条路径的参考后端。

### Google ADK

- 当前 skill 已是官方功能，但仍处于 experimental。
- 通过 `SkillToolset` 挂到 agent 的 tools 上。
- 支持：
  - 从目录加载
  - 代码定义 `Skill`
- 更适合作为：
  - toolset binding + workflow composition
  的参考后端。

## 当前建议的向上接口方向

- `rax.skill.containerCreate(...)`
- `rax.skill.bind(...)`
- `rax.agent.skillMount(...)`
- `rax.skill.publish(...)`
- `rax.skill.discover(...)`

## 当前建议的 container 槽位

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

## 当前不拍板的点

- 不冻结最终方法名和接口形状。
- 不冻结 container 与 publishable unit 是否完全同义。
- 不冻结 subagent / ledger 的最终归属层。
