# 2026-03-14 rax.skill v0 And Packaging Engine

## 本次结论

- 从纯研究阶段进入第一版设计阶段。
- 当前先不冻结最终 API，但已经形成两份可承接实现的底稿：
  - `Packaging Engine Architecture`
  - `rax.skill v0 Actions Draft`

## 当前更稳的判断

- `包装机` 仍先视为架构层总机制。
- `Skill Container` 是包装机在 runtime 里的第一批可执行载体。
- `SKILL.md` 是 skill 的标准主入口文档，不是完整运行时。

## `rax.skill` v0 最小动作

- `define`
- `discover`
- `bind`
- `activate`
- `loadLocal`

## 当前不进入第一批的动作

- `publish`
- `version`
- `syncState`
- `registryList`

## 当前更稳的接口方向

- 面向 runtime：
  - `rax.skill.define(...)`
  - `rax.skill.discover(...)`
  - `rax.skill.bind(...)`
  - `rax.skill.activate(...)`
  - `rax.skill.loadLocal(...)`
- 面向程序员的高层接口仍可继续保留短路径目标：
  - `rax.skill.containerCreate(...)`
  - `rax.agent.skillMount(...)`

## 当前更稳的下一步

1. 画三家 provider 的 action mapping 表
2. 继续细化 `Skill Container` 槽位与三层加载策略
