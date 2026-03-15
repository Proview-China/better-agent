# 2026-03-14 Skill Provider Mapping And Context Manager

## 本次结论

- `rax.skill` v0 动作草案已补上 provider action mapping。
- `Context Manager` 已从空标题推进到第一版三层加载与注入草案。

## 当前更稳的判断

### `rax.skill` v0 provider mapping

- `define`
- `discover`
- `bind`
- `activate`
- `loadLocal`

这些动作已开始映射到：

- OpenAI
- Anthropic
- Google ADK

### Skill 的三层加载

- Tier 1: metadata
- Tier 2: entry markdown
- Tier 3: resources / helpers

## 当前更稳的分工

- `Skill Container`
  - 回答“有什么”
- `Context Manager`
  - 回答“何时加载、加载多少、怎么注入”
- `callback`
  - 回答“要不要拦、怎么降级”
- `plugin`
  - 回答“怎么接 provider/runtime”

## 当前更稳的下一步

1. 继续把 `rax.skill` 动作映射表细化成更接近接口签名的草案
2. 继续细化 `Skill Container` 槽位，尤其是 `bindings / policy / ledger`
