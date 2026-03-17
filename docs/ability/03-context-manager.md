# Context Manager

状态：设计稿，不是冻结实现。

更新时间：2026-03-14

## 这份文档要回答什么

`skill` 已经被定义成能力包装单元，而不是单次工具调用。

既然如此，Praxis 迟早要回答：

1. skill 的上下文到底怎么进入模型/runtime。
2. `SKILL.md`、resources、scripts 应该在什么时机被加载。
3. 如何避免 skill 一上来就把上下文塞爆。

## 先说结论

- `Context Manager` 不应等于 `skill`，而应为 skill container 提供加载、注入、隔离和降级规则。
- 当前更稳的装载方式是三层：
  - Tier 1: metadata
  - Tier 2: entry markdown
  - Tier 3: resources/helpers
- `contextBridge` 很重要，但它更适合作为包装机能力，而不是 `rax.skill` v0 最小动作。

一句白话：

- `skill` 决定“要不要用这项能力”
- `Context Manager` 决定“用的时候往上下文里放多少东西”

## Context Manager 的职责

当前先只认 5 类职责：

### 1. discovery injection

负责：

- 只注入轻量 metadata
- 让模型知道 skill 存在

### 2. activation expansion

负责：

- 在 skill 命中后再加载 entry markdown

### 3. resource escalation

负责：

- 只有在需要时再展开 references、assets、scripts、examples

### 4. isolation and override

负责：

- 控制 skill 作用域
- 避免多个 skill 同时污染上下文
- 控制覆盖优先级

### 5. fallback and compaction

负责：

- 上下文过大时降级
- 当 skill 无法完整展开时给出紧缩版路径

## 三层加载策略

### Tier 1: Metadata

加载内容：

- `id`
- `name`
- `description`
- `tags`
- `triggers`
- 最少量 provider hints

目的：

- 用于 `discover`
- 用于初次路由
- 成本最低

默认时机：

- agent 启动时
- 调用 `rax.skill.discover(...)` 时
- skill catalog 展示时

### Tier 2: Entry Markdown

加载内容：

- `SKILL.md`
- 主流程说明
- 使用边界
- 资源入口说明

目的：

- 用于 `activate`
- 让模型理解“接下来该怎么走”

默认时机：

- skill 被命中时
- agent 决定准备使用 skill 时

### Tier 3: Resources / Helpers

加载内容：

- references
- examples
- templates
- scripts
- validators
- assets

目的：

- 只在执行阶段按需展开
- 不让所有 supporting files 一次性进入上下文

默认时机：

- entry markdown 明确请求时
- runtime 确认需要该材料时
- callback/policy 允许时

## 注入顺序

当前更稳的顺序是：

1. 先注入 metadata
2. 命中后再注入 entry markdown
3. 只有需要时才引入 resources/helpers

不建议的顺序：

- 启动时全量注入 `SKILL.md`
- 启动时全量注入 references/scripts
- 多个 skill 同时全量展开

## Skill Container 与 Context Manager 的关系

可以先这样理解：

- `Skill Container`
  - 承载：
    - descriptor
    - entry
    - resources
    - helpers
    - bindings
    - policy
    - ledger

- `Context Manager`
  - 决定：
    - 什么时候加载哪个槽位
    - 以什么粒度注入
    - 发生冲突时谁覆盖谁
    - 上下文过大时怎么降级

也就是说：

- container 是“有什么”
- context manager 是“何时给、给多少、怎么给”

## 对 `rax.skill` 的启发

虽然 `contextBridge` 不先进 `rax.skill` v0 最小动作，但 runtime 还是需要有对应能力。

更稳的拆法是：

- `rax.skill.discover(...)`
  - 只走 Tier 1
- `rax.skill.activate(...)`
  - 至少走 Tier 2
- provider binding / execution path
  - 需要时再触发 Tier 3

## 隔离与冲突规则

当前先接受下面这组简化规则：

1. 一个 agent 在同一时刻默认只允许一个 skill 进入 Tier 2 主入口展开。
2. Tier 3 资源默认按需展开，不允许无界自动铺开。
3. 来自 skill 的内容优先级低于显式用户输入。
4. 多 skill 冲突时，优先保留当前激活 skill，其他 skill 回退到 Tier 1。

## 与 `callback` 的关系

- `callback` 负责治理与拦截
- `Context Manager` 负责装载与注入

当前更稳的关系是：

- callback 可以否决或缩减某次 skill expansion
- 但 callback 本身不负责决定 skill 的三层结构

## 与 `plugin` 的关系

- plugin 负责 provider/runtime 接入
- context manager 负责 skill 内容进入上下文的策略

例如：

- OpenAI plugin 决定怎么挂 `environment.skills`
- context manager 决定何时只给 metadata，何时读完整 `SKILL.md`

## 当前不要过早定死的事情

- skill 之间是否允许并发进入 Tier 2
- Tier 3 是否要继续细分成 references / scripts 两种通道
- compaction 策略是全局统一还是 provider-specific
- 是否允许 callback 重写 entry markdown

## 当前可接受的中间判断

- `Context Manager` 是 skill container 的加载与注入系统。
- skill 的最稳装载方式是 `metadata -> entry markdown -> resources/helpers` 三层。
- `contextBridge` 暂时不作为 `rax.skill` v0 动作暴露，但它迟早会成为包装机 runtime 的核心部件。
