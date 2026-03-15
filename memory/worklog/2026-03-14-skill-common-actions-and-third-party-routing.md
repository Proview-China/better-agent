# 2026-03-14 Skill Common Actions And Third-Party Routing

## 本次结论

- 跨三家当前最稳的 skill 最小公共动作先收成：
  - `define`
  - `discover`
  - `bind`
  - `activate`
  - `loadLocal`
- `publish` / `version` / hosted registry 暂不作为三家最小公共动作。
- `contextBridge` 保留为包装机能力，不先算进 `skill` 的最小动作集。

## 第三方 skill 库收口

- 第三方 skill hub 当前主流交付物是：
  - 目录 bundle
  - `SKILL.md`
  - supporting files
- 最小 skill 单元：
  - `SKILL.md`
  - `name`
  - `description`

## Praxis 抽象层当前最重要的职责

- source discovery
- bundle normalization
- metadata translation
- runtime binding
- progressive loading
- security/policy enforcement

## 对 `rax.skill.*` 的启发

- `rax.skill.containerCreate(...)`
  负责：
  - source discovery
  - bundle normalization
  - metadata translation
- local package load
- `rax.skill.bind(...)`
  负责：
  - provider/runtime binding
- `rax.agent.skillMount(...)`
  负责：
  - agent-usable attachment

## 当前更稳的下一步

1. 列 `rax.skill` v0 最小动作草案
2. 画 `Skill Container` 的最小槽位和三层加载策略
