# Packaging Engine Architecture

状态：设计稿，不是冻结实现。

更新时间：2026-03-14

## 这份文档要回答什么

如果 Praxis 要把“包装机”作为自己的最佳 `skill` 实践，我们需要先回答：

1. 包装机在系统里到底处于哪一层。
2. `skill`、`SKILL.md`、`Skill Container`、`plugin`、`callback` 各自是什么关系。
3. 一个最小可实现的包装机容器至少要有哪些槽位。

## 先说结论

- `包装机` 先视为架构层总机制，不直接等同于某个单一对象。
- `Skill Container` 是包装机在 runtime 里的第一批可执行载体。
- `SKILL.md` 是 skill 面向 agent 和作者的主入口文档，不是完整运行时。
- `skill` 是交付语义。
- `container` 是运行时语义。

一句白话：

- `SKILL.md` 是说明书
- `skill` 是能力包
- `container` 是装配后的可执行包
- `包装机` 是把这些东西装起来的工厂

## 分层关系

### 1. 包装机架构

这是最上层。

它负责：

- 把工具、知识、上下文、资源、策略组织成可复用单元
- 定义装配、注入、转移、分发、迭代的机制

它不直接等于某个 provider runtime，也不直接等于某个对象实例。

### 2. `skill`

这是面向 agent 的能力包装单元。

它负责：

- 描述“这项能力是什么”
- 描述“什么时候该用”
- 描述“如何进入后续流程”

它不等于单次工具调用，也不等于单个 prompt。

### 3. `Skill Container`

这是包装机在 runtime 里的第一批可执行载体。

它负责：

- 承接一个 skill 的正文、资源、绑定和治理策略
- 让 skill 从“文档入口”变成“可装到 agent 身上的对象”

### 4. `plugin`

这是系统扩展单元。

它负责：

- provider / host 接入
- 生命周期
- 权限边界

它解决的是“系统能接什么”，不是“这项能力怎么用”。

### 5. `callback`

这是治理单元。

它负责：

- 前后置拦截
- 中断和降级
- 事件注入

它解决的是“何时拦、如何审、如何记录”，不是“包装什么能力”。

## `SKILL.md` 的定位

当前更稳的定位是：

- `SKILL.md` 是主入口文档
- 是 discovery 和 activation 的第一层入口
- 是 progressive loading 的第二层材料

它至少承担这几件事：

- intro
- 适用场景
- 主流程说明
- 资源/脚本/附属材料入口
- 对 runtime 的加载提示

但它不应单独承担：

- provider binding
- tool / MCP 真实装配
- 权限治理
- 记账
- 生命周期管理

## Skill Container 的最小槽位

下面这些槽位已经足够支撑第一批实践。

### 1. `descriptor`

负责：

- `id`
- `name`
- `description`
- `version`
- `tags`
- `triggers`

### 2. `entry`

负责：

- 主入口文档
- 通常就是 `SKILL.md`

### 3. `resources`

负责：

- references
- examples
- templates
- assets

### 4. `helpers`

负责：

- scripts
- deterministic helpers
- validators

### 5. `bindings`

负责：

- tool bindings
- MCP bindings
- subagent bindings
- workflow bindings
- provider/runtime attachment hints

### 6. `policy`

负责：

- invocation mode
- permission/risk level
- safety constraints
- approval requirements
- source trust

### 7. `loading`

负责：

- metadata-first
- full markdown on activation
- resources on demand

### 8. `ledger`

负责：

- hit/miss
- load cost
- success/failure
- fallback reason
- reuse value

## 包装机的最小生命周期

当前更稳的骨架是：

1. `define`
把一个 skill 定义成 bundle / container candidate。

2. `discover`
只暴露轻量 metadata。

3. `load`
按需读取 `SKILL.md` 和 supporting files。

4. `bind`
映射到 provider/runtime substrate。

5. `mount`
挂到 agent。

6. `activate`
在相关时进入可执行态。

7. `record`
写入 ledger。

## 对实现层的启发

如果我们沿着这个架构做，Praxis runtime 里最先应该出现的不是一个大而全的“万能 skill 对象”，而是：

- `rax.skill.containerCreate(...)`
- `rax.skill.bind(...)`
- `rax.agent.skillMount(...)`

也就是说，先有 container，再谈 publish、registry、跨端同步。

## 当前不要过早定死的事情

- `container` 是否等同于最终 publishable unit
- `subagent` 是 container 的内建槽位还是外部 binding
- `ledger` 放在 container 内还是独立 service
- `plugin` 与 `packaging machine` 是否会出现一部分重叠能力

## 当前可接受的中间判断

- `skill` 是包装机暴露给 agent 的能力单元。
- `Skill Container` 是包装机在 runtime 里的最小可执行载体。
- `SKILL.md` 是 skill 的标准入口文档。
- `包装机` 目前仍应保留为架构层概念，不急着把整个词直接压成某一个类名。
